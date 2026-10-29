// Classement des formats : une seule règle, partagée par le flux et le lecteur.
//
// Priorité (identique côté API quand les métadonnées seront disponibles) :
//   1. `format` déjà calculé (champ fourni par une API / un backfill) ;
//   2. dimensions : height > width → Short ;
//   3. URL d'origine contenant « /shorts/ » → Short ;
//   4. à défaut, hashtag explicite dans le titre (seul signal du flux RSS).
//
// La durée ne sert jamais de critère unique : une capsule pédagogique de 60 s
// reste une vidéo longue si rien d'autre ne la classe en Short.

const SHORTS_TITLE = /#shorts?\b|#shortvideo|#shortsvideo/i;
const SHORTS_URL = /\/shorts\//i;

export const FORMAT_SHORT = 'short';
export const FORMAT_VIDEO = 'video';

export function classifyFormat(video) {
  if (!video) return FORMAT_VIDEO;

  const declared = video.format;
  if (declared === FORMAT_SHORT || declared === FORMAT_VIDEO) return declared;

  const width = Number(video.width);
  const height = Number(video.height);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return height > width ? FORMAT_SHORT : FORMAT_VIDEO;
  }

  const urls = [video.url, video.videoUrl, video.originalUrl];
  if (urls.some((value) => typeof value === 'string' && SHORTS_URL.test(value))) {
    return FORMAT_SHORT;
  }
  if (SHORTS_TITLE.test(video.title ?? '')) return FORMAT_SHORT;

  return FORMAT_VIDEO;
}

/** Ajoute (ou corrige) le champ `format` d'une vidéo. */
export function withFormat(video) {
  return { ...video, format: classifyFormat(video) };
}

export function isShort(video) {
  return classifyFormat(video) === FORMAT_SHORT;
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
