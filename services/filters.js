// Filtres de concentration : on retire du flux les formats conçus pour
// retenir l'attention (Shorts), pas le contenu pédagogique court.
const SHORTS_PATTERN = /#shorts?\b|#shortvideo|#shortsvideo/i;

export function isShort(video) {
  return SHORTS_PATTERN.test(video?.title ?? '');
}

export function withoutShorts(videos) {
  return videos.filter((video) => !isShort(video));
}
