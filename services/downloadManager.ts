import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { Ytdlp, isYtdlpAvailable, type YtdlpCompleteEvent, type YtdlpErrorEvent, type YtdlpProgressEvent } from '../modules/ytdlp';
import * as db from '../src/db';
import type { DownloadRecord, DownloadStatus } from '../src/db/downloads';
import { toFileUri, toNativePath } from './filePaths';

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

export async function initDownloadManager(categories: { id: string; name: string }[]): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await db.ensureCategories(categories);
    await db.startupReconcile();
    await refreshFromDb();
    // Wire native events.
    if (Ytdlp) {
      Ytdlp.addListener('onProgress', (e: YtdlpProgressEvent) => {
        const rec = downloads.find((d) => d.id === e.id);
        if (!rec) return;
        rec.progress = e.progress;
        rec.status = 'downloading';
        emit();
        const now = Date.now();
        if (!lastDbWrite.has(e.id) || now - (lastDbWrite.get(e.id) ?? 0) > 1000) {
          lastDbWrite.set(e.id, now);
          void db.updateDownload(e.id, { progress: e.progress, status: 'downloading' });
        }
      });
      Ytdlp.addListener('onComplete', async (e: YtdlpCompleteEvent) => {
        const rec = downloads.find((d) => d.id === e.id);
        if (!rec) return;
        // Le module renvoie déjà une URI, mais on normalise pour rester
        // robuste si un chemin brut arrive (ancienne version du module).
        const filePath = toFileUri(e.filePath);
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
        });
        // Download thumbnail locally for offline display.
        await downloadThumbnail(rec);
        await refreshFromDb();
        processByDownload.delete(e.id);
        void processQueue();
      });
      Ytdlp.addListener('onError', async (e: YtdlpErrorEvent) => {
        const rec = downloads.find((d) => d.id === e.id);
        if (!rec) return;
        if (e.code === 'ERR_YTDLP_CANCELED') {
          rec.status = 'canceled';
        } else {
          rec.status = 'failed';
        }
        rec.errorCode = e.code;
        rec.errorMessage = e.message;
        emit();
        await db.updateDownload(e.id, {
          status: rec.status,
          errorCode: e.code,
          errorMessage: e.message,
        });
        processByDownload.delete(e.id);
        void processQueue();
      });
    }
    initialized = true;
    await processQueue();
  })();
  return initPromise;
}

async function downloadThumbnail(rec: DownloadRecord): Promise<void> {
  if (!rec.thumbnailLocalPath && rec.sourceUrl) {
    // thumbnail URL is stored separately? We'll set it during enqueue; fall back.
  }
  // no-op here; caller sets thumbnailLocalPath before.
}

function downloadDir(categoryId: string): Directory {
  return new Directory(Paths.document, 'downloads', categoryId);
}

async function ensureDir(categoryId: string): Promise<Directory> {
  const dir = downloadDir(categoryId);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

let queueRunning = false;

async function processQueue(): Promise<void> {
  if (queueRunning) return;
  queueRunning = true;
  try {
    const active = downloads.find((d) => d.status === 'downloading');
    if (active) return;
    const next = downloads.find((d) => d.status === 'queued');
    if (!next) return;
    // Check storage.
    if (Paths.availableDiskSpace < 50 * 1024 * 1024) {
      await db.updateDownload(next.id, {
        status: 'failed',
        errorCode: 'ERR_YTDLP_STORAGE',
        errorMessage: 'Insufficient storage',
      });
      next.status = 'failed';
      next.errorCode = 'ERR_YTDLP_STORAGE';
      next.errorMessage = 'Insufficient storage';
      emit();
      return processQueue();
    }
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
        fileName: next.videoId,
        format: next.format,
        quality: (next.quality as any) ?? '720p',
      });
      processByDownload.set(next.id, pid);
    } catch (e: any) {
      next.status = 'failed';
      next.errorCode = e?.code ?? 'ERR_YTDLP_FAILED';
      next.errorMessage = e?.message ?? String(e);
      await db.updateDownload(next.id, {
        status: 'failed',
        errorCode: next.errorCode,
        errorMessage: next.errorMessage,
      });
      emit();
      await processQueue();
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
  const now = Date.now();
  const id = `dl_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const dir = downloadDir(input.categoryId);
  const thumbnailLocalPath = new File(dir, `${input.metadata.videoId}.jpg`).uri;
  const rec: DownloadRecord = {
    id,
    videoId: input.metadata.videoId,
    sourceUrl: input.url,
    title: input.metadata.title,
    channelName: input.metadata.channelName,
    thumbnailLocalPath,
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
  await db.insertDownload(rec);
  // Download thumbnail (best effort).
  if (input.metadata.thumbnailUrl) {
    try {
      const thumbFile = new File(dir, `${input.metadata.videoId}.jpg`);
      const downloaded = await File.downloadFileAsync(input.metadata.thumbnailUrl, thumbFile);
      rec.thumbnailLocalPath = downloaded.uri;
      await db.updateDownload(rec.id, { thumbnailLocalPath: downloaded.uri });
    } catch {
      rec.thumbnailLocalPath = null;
      await db.updateDownload(rec.id, { thumbnailLocalPath: null });
    }
  }
  downloads = [rec, ...downloads];
  emit();
  void processQueue();
  return rec;
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
    try {
      const dir = downloadDir(rec.categoryId);
      const base = rec.videoId;
      dir.list()?.forEach((f: any) => {
        if (f.name?.startsWith(`${base}.`)) {
          try { new File(f.uri).delete(); } catch {}
        }
      });
    } catch {}
  }
  processByDownload.delete(id);
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
  void processQueue();
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
    try {
      const dir = downloadDir(rec.categoryId);
      const base = rec.videoId;
      dir.list()?.forEach((f: any) => {
        if (f.name?.startsWith(`${base}.`)) {
          try { new File(f.uri).delete(); } catch {}
        }
      });
    } catch {}
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
        const dest = new File(newDir, `${rec.videoId}.${ext}`);
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
        const dest = new File(newDir, `${rec.videoId}.jpg`);
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
