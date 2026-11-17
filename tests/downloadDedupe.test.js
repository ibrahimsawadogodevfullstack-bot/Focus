import assert from 'node:assert/strict';
import test from 'node:test';

import { duplicateDownloadIds } from '../src/db/downloadDedupe';

function row(overrides) {
  return {
    id: 'dl_1',
    videoId: 'abc123',
    categoryId: 'trading',
    status: 'failed',
    progress: 0,
    createdAt: 1,
    filePath: null,
    ...overrides,
  };
}

test('dedupe keeps the completed row over a newer failed duplicate', () => {
  const rows = [
    row({ id: 'failed', status: 'failed', progress: 0, createdAt: 20 }),
    row({
      id: 'done',
      status: 'completed',
      progress: 1,
      createdAt: 10,
      filePath: 'file:///done.mp4',
    }),
  ];

  assert.deepEqual(duplicateDownloadIds(rows), ['failed']);
});

test('dedupe prefers a completed row that still has its file', () => {
  const rows = [
    row({ id: 'without-file', status: 'completed', progress: 1, filePath: null }),
    row({ id: 'with-file', status: 'completed', progress: 1, filePath: 'file:///v.mp4' }),
  ];

  assert.deepEqual(duplicateDownloadIds(rows), ['without-file']);
});

test('dedupe keeps the most advanced attempt when statuses are equal', () => {
  const rows = [
    row({ id: 'low', status: 'failed', progress: 0.16 }),
    row({ id: 'high', status: 'failed', progress: 1 }),
  ];

  assert.deepEqual(duplicateDownloadIds(rows), ['low']);
});

test('dedupe isolates videos and categories from each other', () => {
  const rows = [
    row({ id: 'a', videoId: 'v1', categoryId: 'english' }),
    row({ id: 'b', videoId: 'v1', categoryId: 'trading' }),
    row({ id: 'c', videoId: 'v2', categoryId: 'english' }),
  ];

  assert.deepEqual(duplicateDownloadIds(rows), []);
});

test('dedupe removes only the extra duplicates', () => {
  const rows = [
    row({ id: 'done', status: 'completed', progress: 1, filePath: 'file:///v.mp4' }),
    row({ id: 'dup-1', status: 'failed', createdAt: 30 }),
    row({ id: 'dup-2', status: 'queued', createdAt: 40 }),
    row({ id: 'other', videoId: 'other', categoryId: 'trading' }),
  ];

  assert.deepEqual(duplicateDownloadIds(rows), ['dup-1', 'dup-2']);
});
