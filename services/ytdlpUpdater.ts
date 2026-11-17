import AsyncStorage from '@react-native-async-storage/async-storage';

import { Ytdlp, isYtdlpAvailable } from '../modules/ytdlp';
import { nextCheckAtFor, shouldCheckForUpdate } from './ytdlpUpdatePolicy';

/**
 * Mise à jour automatique de yt-dlp.
 *
 * Le binaire livré dans l'APK vieillit vite : YouTube casse les versions
 * anciennes (avertissement au-delà de 90 jours, puis HTTP 403 sur les flux).
 * On vérifie donc une fois par jour s'il existe une release stable plus
 * récente et, le cas échéant, on la télécharge. Le nouveau binaire est stocké
 * dans le dossier privé de l'app : il survit aux redémarrages.
 *
 * Toutes les erreurs sont avalées : une mise à jour impossible (hors ligne,
 * GitHub inaccessible) ne doit jamais empêcher de télécharger avec la version
 * déjà installée.
 */

const NEXT_CHECK_KEY = 'ytdlp:nextUpdateCheck';

let running: Promise<void> | null = null;

export function maybeUpdateYtdlp(options: { force?: boolean } = {}): Promise<void> {
  if (running) return running;
  running = run(options).finally(() => {
    running = null;
  });
  return running;
}

async function run({ force = false }: { force?: boolean }): Promise<void> {
  if (!isYtdlpAvailable() || !Ytdlp) return;

  const now = Date.now();
  if (!force) {
    const raw = await AsyncStorage.getItem(NEXT_CHECK_KEY).catch(() => null);
    const nextCheckAt = raw ? Number(raw) : null;
    if (!shouldCheckForUpdate(nextCheckAt, now)) return;
  }

  try {
    const result = await Ytdlp.update();
    if (result.skipped) {
      // Un téléchargement tourne : on ne remplace pas le binaire en cours
      // d'utilisation et on ne planifie rien, pour retenter au prochain
      // déclencheur (retour au premier plan, nouvel ajout, réessai).
      await AsyncStorage.removeItem(NEXT_CHECK_KEY).catch(() => {});
      return;
    }
    // Succès : prochaine vérification demain. Le résultat peut aussi être
    // « déjà à jour » (ALREADY_UP_TO_DATE), même traitement.
    await AsyncStorage.setItem(NEXT_CHECK_KEY, String(nextCheckAtFor('ok', now))).catch(
      () => {},
    );
    if (result.updated) {
      console.log(`[ytdlp] mis à jour vers ${result.version}`);
    }
  } catch (error) {
    await AsyncStorage.setItem(
      NEXT_CHECK_KEY,
      String(nextCheckAtFor('failed', now)),
    ).catch(() => {});
    console.warn('[ytdlp] mise à jour impossible, version locale conservée', error);
  }
}
