import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import i18n from '../i18n';
import { Ytdlp, isYtdlpAvailable, type YtdlpCompleteEvent, type YtdlpErrorEvent, type YtdlpProgressEvent } from '../modules/ytdlp';
import * as db from '../src/db';
import type { DownloadRecord, DownloadStatus } from '../src/db/downloads';
import { toFileUri, toNativePath } from './filePaths';
import { formatDownloadError, refineDownloadError } from './downloadError';
import { formatBytes, requiredFreeBytes } from './downloadEstimate';
import { maybeUpdateYtdlp } from './ytdlpUpdater';

export type EnqueueInput = {
  url: string;
  categoryId: string;
  format?: 'video' | 'audio';
  quality?: '480p' | '720p' | '1080p';
};

type Listener = () => void;

let downloads: DownloadRecord[] = [];
const listeners = new Set<Listener>();
const processByDownload = new Map<string, string>();
const lastDbWrite = new Map<string, number>();
let initialized = false;
let initPromise: Promise<void> | null = null;

/** Un téléchargement qui n'a pas bougé depuis ce délai est considéré bloqué. */
const STALL_TIMEOUT_MS = 90_000;
const STALL_CHECK_INTERVAL_MS = 15_000;
/** Un échec réseau isolé ne doit pas accuser la connexion : il en faut trois. */
const NETWORK_FAILURE_LIMIT = 3;
/** Sous ce seuil, le fichier en cours d'écriture ne peut plus aboutir. */
const CRITICAL_FREE_BYTES = 150 * 1024 * 1024;
const DISK_CHECK_INTERVAL_MS = 30_000;
/** `emit()` par ligne de progression repeindrait toute la liste. */
const PROGRESS_EMIT_INTERVAL_MS = 250;
/**
 * La fusion ffmpeg d'une vidéo longue ne produit aucune ligne de progression
 * pendant plusieurs minutes. Sans budget élargi, le chien de garde annulerait
 * un téléchargement pourtant terminé.
 */
const POSTPROCESS_STALL_TIMEOUT_MS = 10 * 60 * 1000;
const POSTPROCESS_PATTERN = /\[(?:merger|extractaudio|videoconvert|fixup|ffmpeg)/i;

const lastProgressAt = new Map<string, number>();
const lastEmitAt = new Map<string, number>();
const lastDiskCheckAt = new Map<string, number>();
/** Téléchargements passés en post-traitement (fusion, extraction audio). */
const postprocessingIds = new Set<string>();

/**
 * Téléchargements arrêtés par nous-mêmes (blocage, stockage). L'erreur
 * `ERR_YTDLP_CANCELED` que le processus émet alors ne doit pas écraser le
 * diagnostic retenu.
 */
const abortedDownloads = new Set<string>();
let networkFailureStreak = 0;
let watchdog: ReturnType<typeof setInterval> | null = null;

export type DownloadQueueState = {
  paused: boolean;
  /** `network` : la file s'est arrêtée après une panne de connexion. */
  reason: 'network' | null;
};

// Objet stable : `useSyncExternalStore` compare les instantanés par référence.
let queueState: DownloadQueueState = { paused: false, reason: null };

export function getDownloadQueueState(): DownloadQueueState {
  return queueState;
}

function setQueuePaused(reason: 'network' | null) {
  // Lever la pause remet le compteur à zéro : une nouvelle tentative doit
  // repartir de trois échecs possibles avant de re-pauser.
  if (reason == null) networkFailureStreak = 0;
  if (queueState.reason === reason) return;
  queueState = { paused: reason != null, reason };
  emit();
}

/** Relance la file après une pause (bouton « Réessayer tout »). */
export function resumeDownloadQueue(): void {
  setQueuePaused(null);
  void processQueue();
}

/** Libellé de la notification de premier plan, traduit une seule fois. */
function notificationLabel(): string {
  return String(i18n.t('downloads:notificationLabel'));
}

/**
 * Marque un téléchargement en échec et arrête son processus natif.
 *
 * Utilisé par le chien de garde (processus figé sans événement) et par le
 * contrôle d'espace disque. `abortedDownloads` empêche l'erreur d'annulation
 * émise par yt-dlp d'écraser ce diagnostic.
 */
async function abortDownload(rec: DownloadRecord, code: string, message: string | null): Promise<void> {
  abortedDownloads.add(rec.id);
  rec.status = 'failed';
  rec.progress = 0;
  rec.errorCode = code;
  rec.errorMessage = message;
  emit();
  await db.updateDownload(rec.id, {
    status: 'failed',
    progress: 0,
    errorCode: code,
    errorMessage: message,
  });
  const pid = processByDownload.get(rec.id);
  processByDownload.delete(rec.id);
  if (pid && Ytdlp) {
    try {
      await Ytdlp.cancel(pid);
    } catch {}
  }
  void processQueue();
}

/**
 * Chien de garde : un processus tué par le système (mémoire, gestionnaire
 * constructeur) n'émet aucun événement. Sans ce contrôle, la ligne restait
 * `downloading` pour toujours et bloquait toute la file.
 */
async function checkStalledDownload(): Promise<void> {
  const rec = downloads.find((d) => d.status === 'downloading');
  if (!rec || abortedDownloads.has(rec.id)) return;
  const last = lastProgressAt.get(rec.id) ?? Date.now();
  const budget = postprocessingIds.has(rec.id)
    ? POSTPROCESS_STALL_TIMEOUT_MS
    : STALL_TIMEOUT_MS;
  if (Date.now() - last < budget) return;
  await abortDownload(
    rec,
    'ERR_YTDLP_STALLED',
    `No progress for ${Math.round(budget / 1000)}s`,
  );
}

function startWatchdog(): void {
  if (watchdog) return;
  watchdog = setInterval(() => {
    void checkStalledDownload();
  }, STALL_CHECK_INTERVAL_MS);
}

function resetAttemptState(id: string): void {
  abortedDownloads.delete(id);
  postprocessingIds.delete(id);
  lastEmitAt.delete(id);
  lastDiskCheckAt.delete(id);
}

function emit() {
  // Nouvelle référence pour que useSyncExternalStore détecte le changement.
  downloads = [...downloads];
  for (const l of listeners) l();
}

export function getDownloadsSnapshot(): DownloadRecord[] {
  return downloads;
}

export function subscribeDownloads(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function refreshFromDb(): Promise<void> {
  downloads = await db.listDownloads();
  emit();
}

/**
 * Supprime les restes d'échecs anciens (`.part`, `.frag`…).
 *
 * Un téléchargement qui échoue conserve son partiel pour pouvoir reprendre ;
 * mais un échec jamais relancé laisse sinon des gigaoctets inutiles, et le
 * stockage est justement l'une des causes d'échec des vidéos longues.
 */
const STALE_PARTIAL_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const PARTIAL_FILE = /\.(part|frag|ytdl|temp)$/i;

function cleanupStalePartials(): void {
  const cutoff = Date.now() - STALE_PARTIAL_AGE_MS;
  for (const rec of downloads) {
    if (rec.status === 'downloading' || rec.status === 'queued' || rec.status === 'completed') continue;
    if (rec.createdAt > cutoff) continue;
    try {
      downloadDir(rec.categoryId).list()?.forEach((entry: any) => {
        if (!entry?.name?.startsWith(`${rec.id}.`) || !PARTIAL_FILE.test(entry.name)) return;
        try {
          new File(entry.uri).delete();
        } catch {}
      });
    } catch {}
  }
}

export async function initDownloadManager(categories: { id: string; name: string }[]): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await db.ensureCategories(categories);
    const { interruptedIds } = await db.startupReconcile();
    // Reprise automatique : une vidéo interrompue par un kill système repart
    // sans intervention (les `.part` conservés permettent la reprise réelle).
    if (interruptedIds.length > 0) {
      try {
        await db.requeueDownloads(interruptedIds);
      } catch (error) {
        console.warn('download resume failed', error);
      }
    }
    await refreshFromDb();
    startWatchdog();
    // Nettoyage non bloquant : libère les partiels d'échecs abandonnés.
    setTimeout(cleanupStalePartials, 5000);
    // Wire native events.
    if (Ytdlp) {
      Ytdlp.addListener('onProgress', (e: YtdlpProgressEvent) => {
        const rec = downloads.find((d) => d.id === e.id);
        if (!rec) return;
        // Téléchargement arrêté par nous (stockage, blocage) : le processus met
        // quelques instants à mourir, ses dernières lignes ne doivent pas
        // remettre la ligne en `downloading`.
        if (abortedDownloads.has(e.id)) return;
        const now = Date.now();
        lastProgressAt.set(e.id, now);
        // La fusion/extraction (ffmpeg) d'une vidéo longue reste silencieuse
        // plusieurs minutes : on élargit le budget du chien de garde.
        if (POSTPROCESS_PATTERN.test(e.detail ?? '')) postprocessingIds.add(e.id);
        rec.progress = e.progress;
        rec.status = 'downloading';
        // Sur une vidéo d'une heure, yt-dlp émet plusieurs lignes par seconde :
        // repeindre la liste à chaque ligne sature le fil JS.
        if (now - (lastEmitAt.get(e.id) ?? 0) > PROGRESS_EMIT_INTERVAL_MS) {
          lastEmitAt.set(e.id, now);
          emit();
        }
        if (!lastDbWrite.has(e.id) || now - (lastDbWrite.get(e.id) ?? 0) > 1000) {
          lastDbWrite.set(e.id, now);
          void db.updateDownload(e.id, { progress: e.progress, status: 'downloading' });
        }
        // Le disque peut se remplir en cours de route (fusion ffmpeg). On
        // arrête proprement avant l'erreur brute « No space left on device ».
        if (now - (lastDiskCheckAt.get(e.id) ?? 0) > DISK_CHECK_INTERVAL_MS) {
          lastDiskCheckAt.set(e.id, now);
          if (Paths.availableDiskSpace < CRITICAL_FREE_BYTES) {
            void abortDownload(
              rec,
              'ERR_YTDLP_STORAGE',
              `Less than ${formatBytes(CRITICAL_FREE_BYTES)} free`,
            );
          }
        }
      });
      Ytdlp.addListener('onComplete', async (e: YtdlpCompleteEvent) => {
        const rec = downloads.find((d) => d.id === e.id);
        if (!rec) return;
        abortedDownloads.delete(e.id);
        postprocessingIds.delete(e.id);
        networkFailureStreak = 0;
        // Le module renvoie déjà une URI, mais on normalise pour rester
        // robuste si un chemin brut arrive (ancienne version du module).
        const filePath = toFileUri(e.filePath);
        const metadata = e.metadata;
        if (metadata?.durationSec && metadata.durationSec > 0) {
          rec.durationSec = metadata.durationSec;
        }
        if (!rec.title && metadata?.title) rec.title = metadata.title;
        if (!rec.channelName && metadata?.channelName) {
          rec.channelName = metadata.channelName;
        }
        rec.filePath = filePath;
        rec.sizeBytes = e.sizeBytes;
        rec.status = 'completed';
        rec.progress = 1;
        rec.errorCode = null;
        rec.errorMessage = null;
        emit();
        await db.updateDownload(e.id, {
          filePath,
          sizeBytes: e.sizeBytes,
          status: 'completed',
          progress: 1,
          errorCode: null,
          errorMessage: null,
          durationSec: rec.durationSec,
          title: rec.title,
          channelName: rec.channelName,
        });
        // Repli si le flux n'avait pas de miniature exploitable.
        if (!rec.thumbnailLocalPath) {
          void cacheThumbnail(rec, metadata?.thumbnailUrl);
        }
        await refreshFromDb();
        processByDownload.delete(e.id);
        void processQueue();
      });
      Ytdlp.addListener('onError', async (e: YtdlpErrorEvent) => {
        const rec = downloads.find((d) => d.id === e.id);
        if (!rec) return;
        // Échec décidé côté JS (blocage, stockage) : on garde ce diagnostic,
        // l'annulation technique qui suit ne doit pas l'écraser.
        if (abortedDownloads.has(e.id)) {
          processByDownload.delete(e.id);
          void processQueue();
          return;
        }
        const canceled = e.code === 'ERR_YTDLP_CANCELED';
        // Affinage à partir du message brut : le natif ne connaît pas toutes
        // les variantes de texte de yt-dlp.
        const code = refineDownloadError(e.code, e.message);
        rec.status = canceled ? 'canceled' : 'failed';
        rec.progress = 0;
        rec.errorCode = code;
        rec.errorMessage = formatDownloadError(e.message);
        emit();
        await db.updateDownload(e.id, {
          status: rec.status,
          progress: 0,
          errorCode: code,
          errorMessage: rec.errorMessage,
        });
        processByDownload.delete(e.id);
        // Un échec isolé ne prouve rien sur la connexion : on ne met la file
        // en pause qu'après plusieurs échecs réseau consécutifs. Les vrais
        // problèmes de flux (403, 429, ffmpeg) n'accusent plus le réseau.
        if (!canceled && code === 'ERR_YTDLP_NETWORK') {
          networkFailureStreak += 1;
          if (networkFailureStreak >= NETWORK_FAILURE_LIMIT) setQueuePaused('network');
        } else if (!canceled) {
          networkFailureStreak = 0;
        }
        if (!queueState.reason) void processQueue();
      });
    }
    // yt-dlp est mis à jour avant de reprendre la file : une version trop
    // ancienne provoque des 403 et des « format indisponible ».
    await maybeUpdateYtdlp();
    // Prépare Python/ffmpeg tout de suite, en tâche de fond : le premier clic
    // sur « télécharger » ne doit pas payer l'initialisation du module.
    if (Ytdlp) void Ytdlp.getVersion().catch(() => {});
    initialized = true;
    await processQueue();
  })();
  return initPromise;
}

const thumbnailTasks = new Map<string, Promise<void>>();

/**
 * Télécharge la miniature en tâche de fond. Appelée après le démarrage de la
 * file : elle ne doit jamais retarder yt-dlp. Déduplique les appels (flux puis
 * repli métadonnées) pour un même téléchargement.
 */
function cacheThumbnail(rec: DownloadRecord, url?: string | null): Promise<void> {
  const existing = thumbnailTasks.get(rec.id);
  if (existing) return existing;
  if (!url) return Promise.resolve();

  const task = (async () => {
    try {
      const dir = await ensureDir(rec.categoryId);
      const thumbFile = new File(dir, `${rec.id}.jpg`);
      const downloaded = await File.downloadFileAsync(url, thumbFile);
      rec.thumbnailLocalPath = downloaded.uri;
      await db.updateDownload(rec.id, { thumbnailLocalPath: downloaded.uri });
    } catch {
      rec.thumbnailLocalPath = null;
      await db.updateDownload(rec.id, { thumbnailLocalPath: null });
    } finally {
      thumbnailTasks.delete(rec.id);
      emit();
    }
  })();

  thumbnailTasks.set(rec.id, task);
  return task;
}

function downloadDir(categoryId: string): Directory {
  return new Directory(Paths.document, 'downloads', categoryId);
}

/** En dessous de cette marge, on vérifie la durée avant de lancer un fichier. */
const LARGE_DOWNLOAD_RISK_BYTES = 4 * 1024 * 1024 * 1024;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Récupère la durée d'une vidéo dont le flux ne la fournit pas.
 *
 * Uniquement appelée quand l'espace libre est juste : elle coûte une extraction
 * yt-dlp, mais évite de lancer un fichier qui ne pourra pas tenir sur le disque.
 * Toute erreur est ignorée : mieux vaut tenter le téléchargement que le refuser.
 */
async function probeDuration(rec: DownloadRecord): Promise<void> {
  if (!Ytdlp) return;
  try {
    const meta = await withTimeout(Ytdlp.getMetadata(rec.sourceUrl), 20_000);
    if (meta?.durationSec && meta.durationSec > 0) {
      rec.durationSec = meta.durationSec;
      await db.updateDownload(rec.id, { durationSec: meta.durationSec });
    }
  } catch {
    // Réseau lent, vidéo indisponible : le plancher de sécurité s'applique.
  }
}

async function ensureDir(categoryId: string): Promise<Directory> {
  const dir = downloadDir(categoryId);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

let queueRunning = false;

async function processQueue(): Promise<void> {
  if (queueRunning) return;
  // File en pause après une panne réseau : ne pas enchaîner les échecs.
  if (queueState.reason) return;
  queueRunning = true;
  try {
    const active = downloads.find((d) => d.status === 'downloading');
    if (active) return;
    const next = downloads.find((d) => d.status === 'queued');
    if (!next) return;
    // Espace disque : on estime à partir de la durée quand elle est connue
    // (le flux RSS ne la fournit pas toujours), sinon on exige un plancher.
    let free = Paths.availableDiskSpace;
    if (next.durationSec <= 0 && free < LARGE_DOWNLOAD_RISK_BYTES) {
      // Peu de place et durée inconnue : on paie une extraction (quelques
      // secondes) pour savoir si la vidéo tiendra, plutôt que d'échouer à 80 %.
      await probeDuration(next);
      free = Paths.availableDiskSpace;
    }
    const required = requiredFreeBytes(next.durationSec, next.quality);
    if (free < required) {
      const detail = String(
        i18n.t('downloads:errorStorageDetail', {
          required: formatBytes(required),
          free: formatBytes(free),
        }),
      );
      await db.updateDownload(next.id, {
        status: 'failed',
        progress: 0,
        errorCode: 'ERR_YTDLP_STORAGE',
        errorMessage: detail,
      });
      next.status = 'failed';
      next.progress = 0;
      next.errorCode = 'ERR_YTDLP_STORAGE';
      next.errorMessage = detail;
      emit();
      return processQueue();
    }
    resetAttemptState(next.id);
    lastProgressAt.set(next.id, Date.now());
    next.status = 'downloading';
    next.progress = 0;
    await db.updateDownload(next.id, { status: 'downloading', progress: 0 });
    emit();
    if (!Ytdlp) {
      await db.updateDownload(next.id, {
        status: 'failed',
        errorCode: 'ERR_PLATFORM',
        errorMessage: 'Ytdlp unavailable on this platform',
      });
      next.status = 'failed';
      next.errorCode = 'ERR_PLATFORM';
      next.errorMessage = 'Ytdlp unavailable on this platform';
      emit();
      return processQueue();
    }
    await ensureDir(next.categoryId);
    const dir = downloadDir(next.categoryId);
    try {
      const pid = await Ytdlp.download({
        id: next.id,
        url: next.sourceUrl,
        outDir: toNativePath(dir.uri),
        // Nom unique par tentative : deux téléchargements de la même vidéo ne
        // partagent plus leurs fichiers `.part` (l'ancien nom `videoId`
        // provoquait des « Unable to rename file »).
        fileName: next.id,
        format: next.format,
        quality: (next.quality as any) ?? '720p',
        // Notification du service de premier plan, dans la langue de l'app.
        notificationLabel: notificationLabel(),
      });
      processByDownload.set(next.id, pid);
    } catch (e: any) {
      next.status = 'failed';
      next.progress = 0;
      next.errorCode = refineDownloadError(e?.code ?? 'ERR_YTDLP_FAILED', e?.message);
      next.errorMessage = formatDownloadError(e?.message ?? String(e));
      await db.updateDownload(next.id, {
        status: 'failed',
        progress: 0,
        errorCode: next.errorCode,
        errorMessage: next.errorMessage,
      });
      emit();
      if (!queueState.reason) await processQueue();
    }
  } finally {
    queueRunning = false;
  }
}

export async function enqueueDownload(input: EnqueueInput & { metadata: { videoId: string; title: string; channelName: string; durationSec: number; thumbnailUrl: string } }): Promise<DownloadRecord> {
  // Garde-fou : categoryId doit être une catégorie réelle de la base. Jamais
  // nul, jamais « all » / « Tous ».
  if (!input.categoryId || input.categoryId === 'all' || input.categoryId === 'tous') {
    throw new Error('Catégorie invalide pour le téléchargement.');
  }
  const cats = await db.listCategories();
  if (!cats.some((c) => c.id === input.categoryId)) {
    throw new Error('Catégorie inconnue pour le téléchargement.');
  }
  // Une seule ligne par vidéo et par catégorie (index unique v2). Le garde-fou
  // de l'interface n'est pas atomique : deux taps rapides peuvent arriver ici
  // avant que la première ligne n'existe.
  const existing =
    downloads.find(
      (d) => d.videoId === input.metadata.videoId && d.categoryId === input.categoryId,
    ) ?? (await db.findDownloadByVideo(input.metadata.videoId, input.categoryId));
  if (existing) {
    if (!downloads.some((d) => d.id === existing.id)) {
      downloads = [existing, ...downloads];
      emit();
    }
    return existing;
  }

  const now = Date.now();
  const id = `dl_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const rec: DownloadRecord = {
    id,
    videoId: input.metadata.videoId,
    sourceUrl: input.url,
    title: input.metadata.title,
    channelName: input.metadata.channelName,
    thumbnailLocalPath: null,
    filePath: null,
    durationSec: input.metadata.durationSec,
    sizeBytes: 0,
    format: input.format ?? 'video',
    quality: input.quality ?? '720p',
    categoryId: input.categoryId,
    status: 'queued',
    progress: 0,
    errorCode: null,
    errorMessage: null,
    lastPositionSec: 0,
    createdAt: now,
  };
  await ensureDir(input.categoryId);
  try {
    await db.insertDownload(rec);
  } catch (error) {
    // Course entre deux enqueues : l'index unique a tranché, on renvoie la
    // ligne déjà créée au lieu de propager une erreur SQLite.
    const duplicate = await db.findDownloadByVideo(input.metadata.videoId, input.categoryId);
    if (duplicate) return duplicate;
    throw error;
  }
  downloads = [rec, ...downloads];
  emit();
  // Un nouveau téléchargement est une tentative explicite : on lève la pause
  // réseau posée par le dernier échec.
  setQueuePaused(null);
  // La file démarre avant la miniature : yt-dlp doit lancer l'extraction le
  // plus tôt possible, la miniature n'est qu'un agrément visuel.
  void processQueue();
  void cacheThumbnail(rec, input.metadata.thumbnailUrl);
  return rec;
}

/**
 * Supprime les fichiers d'un téléchargement.
 *
 * On cible le nom de la tentative (`rec.id`) et, pour les fichiers créés avant
 * ce changement de nommage, l'ancien préfixe `videoId`. L'index unique
 * garantit qu'aucune autre ligne ne partage ce `videoId` dans la catégorie.
 */
function deleteDownloadFiles(rec: DownloadRecord) {
  try {
    const dir = downloadDir(rec.categoryId);
    const prefixes = [`${rec.id}.`, `${rec.videoId}.`];
    dir.list()?.forEach((f: any) => {
      if (prefixes.some((prefix) => f.name?.startsWith(prefix))) {
        try { new File(f.uri).delete(); } catch {}
      }
    });
  } catch {}
}

export async function cancelDownload(id: string): Promise<void> {
  const pid = processByDownload.get(id);
  if (pid && Ytdlp) {
    await Ytdlp.cancel(pid);
  }
  const rec = downloads.find((d) => d.id === id);
  if (rec) {
    rec.status = 'canceled';
    rec.progress = 0;
    emit();
    await db.updateDownload(id, { status: 'canceled', progress: 0 });
    // Delete partial files.
    deleteDownloadFiles(rec);
  }
  processByDownload.delete(id);
  resetAttemptState(id);
  void processQueue();
}

export async function retryDownload(id: string): Promise<void> {
  const rec = downloads.find((d) => d.id === id);
  if (!rec) return;
  rec.status = 'queued';
  rec.progress = 0;
  rec.errorCode = null;
  rec.errorMessage = null;
  await db.updateDownload(id, { status: 'queued', progress: 0, errorCode: null, errorMessage: null });
  emit();
  // Une nouvelle tentative explicite lève la pause réseau.
  setQueuePaused(null);
  void processQueue();
}

/**
 * Remet toutes les lignes en échec en file d'attente et relance.
 * Utilisé par le bandeau « Réessayer tout » quand la file est en pause.
 */
export async function retryAllFailed(): Promise<number> {
  const failed = downloads.filter((d) => d.status === 'failed');
  for (const rec of failed) {
    rec.status = 'queued';
    rec.progress = 0;
    rec.errorCode = null;
    rec.errorMessage = null;
    await db.updateDownload(rec.id, {
      status: 'queued',
      progress: 0,
      errorCode: null,
      errorMessage: null,
    });
  }
  if (failed.length > 0) emit();
  setQueuePaused(null);
  void processQueue();
  return failed.length;
}

export async function removeDownload(id: string): Promise<void> {
  const rec = downloads.find((d) => d.id === id);
  if (rec) {
    // delete video file
    if (rec.filePath) {
      try { new File(rec.filePath).delete(); } catch {}
    }
    // delete thumbnail
    if (rec.thumbnailLocalPath) {
      try { new File(rec.thumbnailLocalPath).delete(); } catch {}
    }
    // delete any leftover partials
    deleteDownloadFiles(rec);
  }
  await db.deleteDownloadRow(id);
  downloads = downloads.filter((d) => d.id !== id);
  emit();
  void processQueue();
}

export async function moveDownloadToCategory(id: string, newCategoryId: string): Promise<void> {
  const rec = downloads.find((d) => d.id === id);
  if (!rec || rec.categoryId === newCategoryId) return;
  await ensureDir(newCategoryId);
  const oldDir = downloadDir(rec.categoryId);
  const newDir = downloadDir(newCategoryId);
  // Move video file
  if (rec.filePath) {
    try {
      const file = new File(rec.filePath);
      if (file.exists) {
        const ext = rec.filePath.split('.').pop();
        const dest = new File(newDir, `${rec.id}.${ext}`);
        file.move(dest);
        rec.filePath = dest.uri;
      }
    } catch {}
  }
  // Move thumbnail
  if (rec.thumbnailLocalPath) {
    try {
      const file = new File(rec.thumbnailLocalPath);
      if (file.exists) {
        const dest = new File(newDir, `${rec.id}.jpg`);
        file.move(dest);
        rec.thumbnailLocalPath = dest.uri;
      }
    } catch {}
  }
  rec.categoryId = newCategoryId;
  await db.updateDownload(id, {
    categoryId: newCategoryId,
    filePath: rec.filePath,
    thumbnailLocalPath: rec.thumbnailLocalPath,
  });
  emit();
}

export async function updateLastPosition(id: string, seconds: number): Promise<void> {
  const rec = downloads.find((d) => d.id === id);
  if (rec) rec.lastPositionSec = seconds;
  await db.updateDownload(id, { lastPositionSec: seconds });
}

export function isPlatformSupported(): boolean {
  return Platform.OS === 'android' && isYtdlpAvailable();
}

export function getYtdlpVersion(): string | null {
  return null; // version is managed via hook
}
