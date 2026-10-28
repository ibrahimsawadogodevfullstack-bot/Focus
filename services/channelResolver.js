// Résolution d'une chaîne YouTube à partir de :
//   - un identifiant brut        UCxxxxxxxxxxxxxxxxxxxxxx
//   - un @handle                 @Fireship
//   - une URL de chaîne          youtube.com/@Fireship, /channel/UC…, /c/…, /user/…
//   - une URL de vidéo           youtube.com/watch?v=…, youtu.be/…
// La validation se fait sur le flux RSS public, qui donne aussi le titre.

import { feedUrl } from './feedUrl';
import { extractCandidates } from './channelCandidates';
import { netFetch } from './net';
import { parseFeed } from './rssParser';

const REQUEST_TIMEOUT_MS = 15000;
const CHANNEL_ID = /UC[A-Za-z0-9_-]{22}/;

const PAGE_HEADERS = {
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
  // Évite l'écran de consentement dans certaines régions.
  Cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+000; SOCS=CAI',
};

async function fetchWithTimeout(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await netFetch(url, { signal: controller.signal, headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Vérifie qu'un identifiant correspond à une vraie chaîne et renvoie son titre. */
export async function fetchChannelTitle(channelId) {
  const xml = await fetchWithTimeout(feedUrl(channelId), {
    Accept: 'application/atom+xml, application/xml, text/xml',
  });
  const { channelTitle } = parseFeed(xml, channelId);
  if (!channelTitle) throw new Error('Flux introuvable');
  return channelTitle;
}

async function resolveVideoAuthor(videoUrl) {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    videoUrl,
  )}&format=json`;
  const raw = await fetchWithTimeout(endpoint, { Accept: 'application/json' });
  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('Réponse YouTube illisible.');
  }
  const authorUrl = payload?.author_url;
  if (!authorUrl) throw new Error('Impossible de retrouver la chaîne de cette vidéo.');
  return authorUrl;
}

function toUrl(input) {
  if (input.startsWith('@')) return `https://www.youtube.com/${input}`;
  if (/^youtu\.be\//i.test(input)) return `https://${input}`;
  if (/^(www\.|m\.)?youtube\.com/i.test(input)) return `https://${input}`;
  if (/^https?:\/\//i.test(input)) return input;
  return null;
}

// Onglets de chaîne : on charge la page d'accueil, plus fiable et plus légère.
const SECTION = /\/(videos|shorts|streams|playlists|about|community|featured|podcasts|releases)\/?$/i;

const LINK_ERROR =
  'Chaîne introuvable. Vérifie le lien, ou colle l’identifiant UC… de la chaîne.';

/**
 * @returns {Promise<{ id: string, title: string }>}
 * @throws  {Error} message prêt à afficher dans l'interface
 */
export async function resolveChannelInput(raw) {
  const input = String(raw ?? '').trim().replace(/\s+/g, '');

  if (!input) {
    throw new Error('Colle un identifiant, un @handle ou une URL YouTube.');
  }

  // Identifiant collé directement.
  if (/^UC[A-Za-z0-9_-]{22}$/.test(input)) {
    try {
      const title = await fetchChannelTitle(input);
      return { id: input, title };
    } catch {
      throw new Error(
        'Aucune chaîne ne correspond à cet identifiant. Vérifie les 24 caractères (UC…).',
      );
    }
  }

  let url = toUrl(input);
  if (!url) {
    throw new Error(
      'Format non reconnu. Essaie UC…, @handle, youtube.com/@handle ou un lien de vidéo.',
    );
  }

  // Lien de vidéo : on passe par oEmbed pour retrouver la chaîne.
  let channelUrl = url;
  if (/[?&]v=|youtu\.be\//i.test(url)) {
    channelUrl = await resolveVideoAuthor(url);
  } else {
    channelUrl = url.replace(SECTION, '');
  }

  const direct = channelUrl.match(/channel\/(UC[A-Za-z0-9_-]{22})/);
  if (direct) {
    try {
      const title = await fetchChannelTitle(direct[1]);
      return { id: direct[1], title };
    } catch {
      throw new Error(LINK_ERROR);
    }
  }

  let html = '';
  try {
    html = await fetchWithTimeout(channelUrl, PAGE_HEADERS);
  } catch {
    throw new Error(LINK_ERROR);
  }

  const candidates = extractCandidates(html).slice(0, 5);

  for (const id of candidates) {
    if (!CHANNEL_ID.test(id)) continue;
    try {
      const title = await fetchChannelTitle(id);
      return { id, title };
    } catch {
      // Candidat suivant : la page peut lister d'autres chaînes.
    }
  }

  throw new Error(LINK_ERROR);
}
