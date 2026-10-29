import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const KEY = 'focus.localvideos.v1';

// Sur le web, les fichiers choisis sont des URL `blob:` valables le temps de
// l'onglet : on les garde en mémoire et on ne les persiste pas.
let webList = [];

export function formatBytes(bytes = 0) {
  if (!bytes) return '—';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${units[unit]}`;
}

function cleanTitle(name) {
  if (!name) return 'Vidéo';
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim() || 'Vidéo';
}

export async function readLocalVideos() {
  if (Platform.OS === 'web') return webList;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((video) => video?.uri);
  } catch {
    return [];
  }
}

async function save(list) {
  if (Platform.OS === 'web') {
    webList = list;
    return;
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

/**
 * Enregistre les fichiers choisis dans le dossier de l'application pour qu'ils
 * restent lisibles hors réseau, même après un redémarrage.
 */
export async function importLocalVideos(assets) {
  const current = await readLocalVideos();
  const added = [];

  for (const asset of assets ?? []) {
    if (!asset?.uri) continue;
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const match = asset.name?.match(/\.[a-z0-9]+$/i);
    const extension = (match ? match[0] : '.mp4').toLowerCase();
    let uri = asset.uri;
    let size = asset.size ?? 0;

    if (Platform.OS !== 'web') {
      try {
        const directory = new Directory(Paths.document, 'videos');
        if (!directory.exists) {
          directory.create({ intermediates: true, idempotent: true });
        }
        const destination = new File(directory, `${id}${extension}`);
        new File(asset.uri).copy(destination);
        uri = destination.uri;
        size = destination.size ?? size;
      } catch {
        // On garde l'URI d'origine (cache du sélecteur) plutôt que d'échouer.
      }
    }

    added.push({
      id,
      title: cleanTitle(asset.name),
      uri,
      size,
      duration: 0,
      mimeType: asset.mimeType ?? 'video/mp4',
      addedAt: Date.now(),
    });
  }

  const next = [...added, ...current];
  await save(next);
  return next;
}

export async function deleteLocalVideo(entry) {
  if (Platform.OS !== 'web' && entry?.uri) {
    try {
      new File(entry.uri).delete();
    } catch {
      // Le fichier a peut-être déjà été supprimé : on retire la fiche quand même.
    }
  }
  const next = (await readLocalVideos()).filter((video) => video.id !== entry?.id);
  await save(next);
  return next;
}

export async function updateLocalDuration(id, duration) {
  const current = await readLocalVideos();
  const next = current.map((video) =>
    video.id === id ? { ...video, duration } : video,
  );
  await save(next);
  return next;
}
