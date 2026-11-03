import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractPlayerResponse,
  extractPlayerJsUrl,
  listStreams,
  normalizeAdaptiveConfig,
  summarizePlayerResponse,
} from '../services/youtubeAdaptive/index.js';

const playerResponse = {
  playabilityStatus: { status: 'OK' },
  videoDetails: {
    videoId: 'abc123',
    title: 'Demo',
    lengthSeconds: '42',
  },
  streamingData: {
    formats: [
      {
        itag: 18,
        mimeType: 'video/mp4',
        audioQuality: 'AUDIO_QUALITY_MEDIUM',
        url: 'https://example.test/p',
      },
    ],
    adaptiveFormats: [
      {
        itag: 137,
        mimeType: 'video/mp4',
        qualityLabel: '1080p',
        signatureCipher: 'url=...&s=...',
      },
      {
        itag: 140,
        mimeType: 'audio/mp4',
        audioQuality: 'AUDIO_QUALITY_MEDIUM',
        url: 'https://example.test/a',
      },
    ],
  },
};

test('extracts ytInitialPlayerResponse from HTML', () => {
  const html = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script></html>`;
  assert.deepEqual(extractPlayerResponse(html), playerResponse);
});

test('resolves the relative player JavaScript URL from YouTube HTML', () => {
  assert.equal(
    extractPlayerJsUrl('"jsUrl":"/s/player/123/base.js"'),
    'https://www.youtube.com/s/player/123/base.js',
  );
});

test('normalizes formats and identifies signature-required streams', () => {
  const streams = listStreams(playerResponse);

  assert.equal(streams.length, 3);
  assert.equal(streams[0].hasAudio, true);
  assert.equal(streams[1].requiresSignature, true);
  assert.equal(streams[2].hasAudio, true);
  assert.equal(streams[2].hasVideo, false);
});

test('summarizes the player response', () => {
  assert.deepEqual(summarizePlayerResponse(playerResponse), {
    videoId: 'abc123',
    title: 'Demo',
    durationSeconds: 42,
    playability: 'OK',
    formatCount: 3,
    directUrlCount: 2,
    signatureCount: 1,
    streams: listStreams(playerResponse),
  });
});

test('keeps a safe default when remote config is incomplete', () => {
  const config = normalizeAdaptiveConfig({ htmlUrl: 'bad-url' });

  assert.equal(config.htmlUrl, 'https://www.youtube.com/watch?v=%s');
  assert.equal(config.jsonUrl.includes('%s'), true);
  assert.equal(config.ttlMs, 6 * 60 * 60 * 1000);
});
