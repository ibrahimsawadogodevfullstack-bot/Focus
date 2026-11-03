// Sources de miniatures YouTube.
//
// `oardefault` reste utilisé par la détection du format, mais n'est pas une
// source d'image fiable : une URL absente peut renvoyer un JPEG générique 120×90.

import { visibleSourceWidthFraction } from '../src/shared/media/thumbnailLayout.ts';

const BASE = 'https://i.ytimg.com/vi';
const VARIANTS = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault'];
const MAX_CANDIDATES = 4;
const validThumbnailByVideo = new Map();

/** Miniature verticale, utilisée uniquement comme signal de format. */
export function verticalThumb(videoId) {
  return `${BASE}/${videoId}/oardefault.jpg`;
}

/** Miniatures 16:9, de la meilleure à la plus petite. */
export function wideThumbs(videoId, { dataSaver = false } = {}) {
  const variants = dataSaver ? ['hqdefault', 'mqdefault'] : VARIANTS;
  return variants.map((variant) => `${BASE}/${videoId}/${variant}.jpg`);
}

/** Les Shorts utilisent la même chaîne : le cadre 9:16 recadre le centre. */
export function shortThumbs(videoId) {
  return wideThumbs(videoId);
}

/** Première miniature 16:9 disponible. */
export function wideThumb(videoId) {
  return wideThumbs(videoId)[0];
}

function isKnownGeneratedUrl(uri, videoId) {
  if (!uri || !videoId) return false;
  const escapedId = videoId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `^https?://i\\d?\\.ytimg\\.com/vi/${escapedId}/(?:${VARIANTS.join('|')})\\.jpg(?:\\?.*)?$`,
    'i',
  ).test(uri);
}

/**
 * Une URL explicite du flux est testée en premier si elle n'est pas déjà une
 * variante construite pour cet identifiant. Quatre sources au maximum.
 */
export function thumbnailCandidates(videoId, providedUrl, options) {
  const built = videoId ? wideThumbs(videoId, options) : [];
  const supplied =
    !options?.dataSaver && typeof providedUrl === 'string'
      ? providedUrl.trim()
      : '';
  const urls = [
    ...(supplied && !isKnownGeneratedUrl(supplied, videoId) ? [supplied] : []),
    ...built,
  ];
  return [...new Set(urls)].slice(0, MAX_CANDIDATES);
}

export function getCachedThumbnail(videoId) {
  return validThumbnailByVideo.get(videoId) ?? null;
}

export function cacheThumbnail(videoId, thumbnail) {
  if (
    videoId &&
    thumbnail?.url &&
    isValidThumbnail({ status: thumbnail.status, width: thumbnail.width })
  ) {
    validThumbnailByVideo.set(videoId, thumbnail);
  }
}

export function clearCachedThumbnail(videoId) {
  if (videoId) validThumbnailByVideo.delete(videoId);
}

export function clearThumbnailCache() {
  validThumbnailByVideo.clear();
}

export const MIN_THUMBNAIL_WIDTH = 320;

/** Rejette les réponses HTTP en erreur et les petites images génériques. */
export function isValidThumbnail({ status, width } = {}) {
  return status === 200 && Number(width) >= MIN_THUMBNAIL_WIDTH;
}

/** Bande réellement visible après le recadrage `cover` dans le cadre cible. */
export function usefulThumbnailWidth(format, width, height) {
  const sourceWidth = Number(width);
  const sourceHeight = Number(height);
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) return 0;
  const sourceRatio = sourceWidth / sourceHeight;
  return sourceWidth * visibleSourceWidthFraction(format, sourceRatio);
}

export function isThumbnailSharpEnough({
  format,
  width,
  height,
  displayWidth,
  pixelRatio,
}) {
  const requiredWidth = Number(displayWidth) * Number(pixelRatio);
  return (
    Number.isFinite(requiredWidth) &&
    requiredWidth > 0 &&
    usefulThumbnailWidth(format, width, height) >= requiredWidth
  );
}

/** Sélectionne une image assez nette, sinon la meilleure image valide testée. */
export function bestThumbnail(candidates, requiredWidth = 0) {
  const valid = (candidates ?? []).filter((item) =>
    isValidThumbnail({ status: item.status, width: item.width }),
  );
  if (valid.length === 0) return null;

  const sharp = valid.find((item) => item.usefulWidth >= requiredWidth);
  if (sharp) return sharp;
  return valid.reduce((best, item) =>
    item.usefulWidth > best.usefulWidth ? item : best,
  );
}

/** Dimensions JPEG/PNG/WebP sans dépendance, utiles si Image.onError survient. */
export function imageDimensionsFromBuffer(buffer, contentType = '') {
  const bytes = new Uint8Array(buffer);

  if (
    (contentType.includes('png') || (bytes[0] === 0x89 && bytes[1] === 0x50)) &&
    bytes.length >= 24
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (
    (contentType.includes('webp') ||
      (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46)) &&
    bytes.length >= 30 &&
    bytes[12] === 0x56 &&
    bytes[13] === 0x50 &&
    bytes[14] === 0x38 &&
    bytes[15] === 0x58
  ) {
    const width =
      1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height =
      1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return { width, height };
  }

  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  const frameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (frameMarkers.has(marker) && offset + 7 < bytes.length) {
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    if (segmentLength < 2) return null;
    offset += segmentLength;
  }

  return null;
}
