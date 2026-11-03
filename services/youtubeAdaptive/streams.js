function hasAudio(format) {
  return Boolean(format?.audioQuality || format?.audioChannels || format?.mimeType?.startsWith('audio/'));
}

function hasVideo(format) {
  return Boolean(format?.qualityLabel || format?.width || format?.height || format?.mimeType?.startsWith('video/'));
}

export function listStreams(playerResponse) {
  const streamingData = playerResponse?.streamingData;
  if (!streamingData) return [];

  const formats = [
    ...(Array.isArray(streamingData.formats) ? streamingData.formats : []),
    ...(Array.isArray(streamingData.adaptiveFormats)
      ? streamingData.adaptiveFormats
      : []),
  ];

  return formats.map((format) => ({
    itag: format.itag ?? null,
    mimeType: format.mimeType ?? null,
    qualityLabel: format.qualityLabel ?? null,
    audioQuality: format.audioQuality ?? null,
    contentLength: Number(format.contentLength ?? 0) || 0,
    url: format.url ?? null,
    signatureCipher: format.signatureCipher ?? format.cipher ?? null,
    hasAudio: hasAudio(format),
    hasVideo: hasVideo(format),
    requiresSignature: !format.url && Boolean(format.signatureCipher || format.cipher),
  }));
}

export function summarizePlayerResponse(playerResponse) {
  const streams = listStreams(playerResponse);
  return {
    videoId: playerResponse?.videoDetails?.videoId ?? null,
    title: playerResponse?.videoDetails?.title ?? null,
    durationSeconds: Number(playerResponse?.videoDetails?.lengthSeconds ?? 0) || 0,
    playability: playerResponse?.playabilityStatus?.status ?? null,
    formatCount: streams.length,
    directUrlCount: streams.filter((stream) => stream.url).length,
    signatureCount: streams.filter((stream) => stream.requiresSignature).length,
    streams,
  };
}
