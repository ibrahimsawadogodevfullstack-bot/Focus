// Classement des formats : une seule règle, partagée par le flux et le lecteur.
//
// `getVideoFormat` applique exactement la priorité demandée par la spécification :
//   1. un champ fourni par les données (`format`, `isShort`, ou `height > width`) ;
//   2. une URL d'origine contenant « /shorts/ » ;
//   3. dernier recours : durée ≤ 60 s ET vignette centrée.
//
// La règle 3 n'est volontairement pas implémentée : sans analyse d'image, le
// centrage d'une vignette n'est pas détectable de façon fiable. On renvoie donc
// « video » plutôt que d'inventer un classement. La durée seule ne suffit
// jamais : une capsule pédagogique de 60 s reste une vidéo longue.
//
// Le flux RSS transporte désormais le lien « alternate » de chaque entrée :
// YouTube y écrit /shorts/ pour un Short, /watch?v= pour une vidéo longue
// (services/rssParser.js). C'est la preuve principale. Le hashtag du titre et
// la sonde `oardefault` (services/formats.js) restent des secours pour les
// caches anciens et les données sans lien.

/**
 * @typedef {Object} Video
 * @property {string} [videoId]
 * @property {string} [title]
 * @property {string} [url]
 * @property {string} [videoUrl]
 * @property {string} [originalUrl]
 * @property {'feed'|'generated'} [urlSource]
 * @property {'short'|'video'} [format]
 * @property {boolean} [isShort]
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [duration]
 */

/** @typedef {'short'|'video'} VideoFormat */

const SHORTS_TITLE = /#shorts?\b|#shortvideo|#shortsvideo/i;
const SHORTS_URL = /\/shorts\//i;
const YOUTUBE_URL = /^https?:\/\/(?:www\.|m\.)?youtube\.com\//i;

export const FORMAT_SHORT = 'short';
export const FORMAT_VIDEO = 'video';

/** Seuil de la règle 3, conservé pour documenter le contrat. */
export const SHORT_MAX_DURATION_S = 60;

function isFormat(value) {
  return value === FORMAT_SHORT || value === FORMAT_VIDEO;
}

/** Dimensions exploitables (positives et finies). */
function hasDimensions(video) {
  const width = Number(video?.width);
  const height = Number(video?.height);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

/**
 * Priorité 1 : tout ce que les données déclarent explicitement.
 * Renvoie null si aucun champ exploitable n'est présent.
 * @param {Video|null|undefined} video
 * @returns {VideoFormat|null}
 */
function declaredFormat(video) {
  if (!video || typeof video !== 'object') return null;

  if (isFormat(video.format)) return video.format;

  if (typeof video.isShort === 'boolean') {
    return video.isShort ? FORMAT_SHORT : FORMAT_VIDEO;
  }

  if (hasDimensions(video)) {
    return Number(video.height) > Number(video.width) ? FORMAT_SHORT : FORMAT_VIDEO;
  }

  return null;
}

/** Priorité 2 : l'URL d'origine pointe vers /shorts/. */
function hasShortsUrl(video) {
  const urls = [video?.url, video?.videoUrl, video?.originalUrl];
  return urls.some((value) => typeof value === 'string' && SHORTS_URL.test(value));
}

/**
 * Lien « alternate » du flux RSS (services/rssParser.js) : YouTube y écrit
 * /shorts/ pour un Short et /watch?v= pour une vidéo longue. Un lien /watch
 * fourni par le flux est donc une preuve positive de vidéo longue, plus fiable
 * que la sonde `oardefault` (qui renvoie 404 pour certains Shorts).
 */
function hasFeedUrl(video) {
  return (
    video?.urlSource === 'feed' &&
    typeof video.url === 'string' &&
    YOUTUBE_URL.test(video.url)
  );
}

/**
 * Format d'une vidéo, selon la priorité de la spécification.
 * Fonction pure et testable : aucune dépendance au réseau ni au stockage.
 * @param {Video|null|undefined} video
 * @returns {VideoFormat}
 */
export function getVideoFormat(video) {
  const declared = declaredFormat(video);
  if (declared) return declared;

  if (hasShortsUrl(video)) return FORMAT_SHORT;

  // Règle 3 : durée ≤ 60 s + vignette centrée. Le centrage n'est pas
  // détectable sans analyse d'image → on ne classe pas en Short.
  return FORMAT_VIDEO;
}

/**
 * Vrai si le format est réellement connu, c'est-à-dire si afficher la vignette
 * ne risque pas de dessiner un Short dans un cadre 16:9.
 *
 * Le défaut de `getVideoFormat` (« video ») n'est **pas** une preuve : tant
 * qu'aucune sonde ni aucun signal local n'a répondu, la carte doit rester un
 * placeholder neutre. Le champ `format` n'est fiable que s'il vient des données
 * (API / cache) : `withFormat` n'est plus appliqué au flux brut.
 *
 * @param {Video|null|undefined} video
 * @param {Record<string, VideoFormat>} [formats] Résultats des sondes réseau.
 * @returns {boolean}
 */
export function isFormatResolved(video, formats = {}) {
  if (!video || typeof video !== 'object') return false;

  if (isFormat(formats?.[video.videoId])) return true;
  if (isFormat(video.format)) return true;
  if (typeof video.isShort === 'boolean') return true;
  if (hasDimensions(video)) return true;
  if (hasShortsUrl(video)) return true;
  if (hasFeedUrl(video)) return true;

  return SHORTS_TITLE.test(video.title ?? '');
}

/**
 * Classement applicatif : données déclarées, URL /shorts/ ou /watch du flux,
 * puis hashtag du titre. Le hashtag ne peut jamais contredire ces preuves.
 * @param {Video|null|undefined} video
 * @returns {VideoFormat}
 */
export function classifyFormat(video) {
  const declared = declaredFormat(video);
  if (declared) return declared;
  if (hasShortsUrl(video)) return FORMAT_SHORT;
  // Un lien /watch venu du flux est une preuve de vidéo longue : il bat le
  // hashtag et la sonde. Sans ce garde-fou, un Short dont `oardefault` renvoie
  // 404 serait reclassé « short » puis rejeté en « video » par la sonde.
  if (hasFeedUrl(video)) return FORMAT_VIDEO;

  return SHORTS_TITLE.test(video?.title ?? '') ? FORMAT_SHORT : FORMAT_VIDEO;
}

/** Ajoute (ou corrige) le champ `format` d'une vidéo. */
export function withFormat(video) {
  return { ...video, format: classifyFormat(video) };
}

export function isShort(video) {
  return classifyFormat(video) === FORMAT_SHORT;
}

/**
 * Format effectif d'une vidéo.
 *
 * `formats` est le résultat des sondes réseau (services/formats.js). Il ne
 * passe qu'après les preuves portées par les données (lien RSS, dimensions,
 * champ explicite), car une sonde peut se tromper sur un Short sans
 * `oardefault`. Il sert de secours pour les caches anciens.
 */
export function formatOf(video, formats = {}) {
  // Les preuves portées par les données passent avant la sonde : le lien RSS
  // /shorts/ ou /watch est définitif, alors que `oardefault` peut manquer pour
  // un vrai Short (404) et le faire passer pour une vidéo longue.
  const declared = declaredFormat(video);
  if (declared) return declared;
  if (hasShortsUrl(video)) return FORMAT_SHORT;
  if (hasFeedUrl(video)) return FORMAT_VIDEO;

  const probed = formats?.[video?.videoId];
  if (isFormat(probed)) return probed;
  return classifyFormat(video);
}

/** Applique le format effectif à toute une liste. */
export function resolveFormats(videos = [], formats = {}) {
  return videos.map((video) => ({ ...video, format: formatOf(video, formats) }));
}

/** Sépare un flux en deux listes, sans jamais perdre de vidéo. */
export function splitByFormat(videos = []) {
  const shorts = [];
  const long = [];

  for (const video of videos) {
    if (isShort(video)) shorts.push(video);
    else long.push(video);
  }

  return { shorts, long };
}
