export function toDownloadedFeedVideos(downloads, activeCategoryId = null) {
  return (downloads ?? [])
    .filter(
      (download) =>
        download.status === 'completed' &&
        Boolean(download.filePath) &&
        (activeCategoryId == null || download.categoryId === activeCategoryId),
    )
    .map((download) => ({
      videoId: download.videoId,
      feedItemId: download.id,
      downloadId: download.id,
      categoryId: download.categoryId,
      title: download.title,
      channelId: download.channelName || download.videoId,
      channelTitle: download.channelName || '',
      duration: download.durationSec,
      thumbnail: download.thumbnailLocalPath,
      localUri: download.filePath,
      format: 'video',
      url: download.sourceUrl,
    }));
}