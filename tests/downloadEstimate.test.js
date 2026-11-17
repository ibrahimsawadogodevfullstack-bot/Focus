import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MIN_FREE_BYTES,
  estimateDownloadBytes,
  formatBytes,
  requiredFreeBytes,
} from '../services/downloadEstimate';

test('estimateDownloadBytes scales with duration and quality', () => {
  // 1 h en 720p ≈ 2,5 Mbit/s + 8 % de conteneur.
  assert.equal(estimateDownloadBytes(3600, '720p'), 1_215_000_000);
  assert.ok(estimateDownloadBytes(3600, '1080p') > estimateDownloadBytes(3600, '720p'));
  assert.ok(estimateDownloadBytes(3600, '720p') > estimateDownloadBytes(3600, '480p'));
});

test('estimateDownloadBytes returns null without a duration', () => {
  assert.equal(estimateDownloadBytes(0, '720p'), null);
  assert.equal(estimateDownloadBytes(Number.NaN, '720p'), null);
  assert.equal(estimateDownloadBytes(null, '720p'), null);
});

test('requiredFreeBytes keeps room for the ffmpeg merge', () => {
  const estimate = estimateDownloadBytes(3600, '720p');
  assert.equal(requiredFreeBytes(3600, '720p'), Math.round(estimate * 2.2));
  assert.ok(requiredFreeBytes(3600, '720p') > estimate);
});

test('requiredFreeBytes falls back to a floor when the duration is unknown', () => {
  assert.equal(requiredFreeBytes(0, '720p'), MIN_FREE_BYTES);
  assert.equal(requiredFreeBytes(undefined, undefined), MIN_FREE_BYTES);
});

test('formatBytes produces short human readable sizes', () => {
  assert.equal(formatBytes(0), '0 Mo');
  assert.equal(formatBytes(500 * 1024 * 1024), '500 Mo');
  assert.equal(formatBytes(1215000000), '1,1 Go');
});
