import assert from 'node:assert/strict';
import test from 'node:test';

import { toDownloadedFeedVideos } from '../services/downloadFeed.js';

const downloads = [
  {
    id: 'download-english',
    videoId: 'video-1',
    title: 'English video',
    channelName: 'English channel',
    thumbnailLocalPath: 'file:///english.jpg',
    filePath: 'file:///english.mp4',
    durationSec: 120,
    categoryId: 'english',
    status: 'completed',
  },
  {
    id: 'download-trading',
    videoId: 'video-2',
    title: 'Trading video',
    channelName: 'Trading channel',
    thumbnailLocalPath: 'file:///trading.jpg',
    filePath: 'file:///trading.mp4',
    durationSec: 240,
    categoryId: 'trading',
    status: 'completed',
  },
  {
    id: 'download-pending',
    videoId: 'video-3',
    categoryId: 'english',
    status: 'downloading',
  },
  {
    id: 'download-missing',
    videoId: 'video-4',
    categoryId: 'english',
    status: 'completed',
    filePath: null,
  },
];

test('downloaded feed maps playable completed records and keeps all categories in Tous', () => {
  const videos = toDownloadedFeedVideos(downloads);

  assert.deepEqual(videos.map((video) => video.downloadId), [
    'download-english',
    'download-trading',
  ]);
  assert.equal(videos[0].localUri, 'file:///english.mp4');
  assert.equal(videos[0].thumbnail, 'file:///english.jpg');
  assert.equal(videos[0].categoryId, 'english');
});

test('downloaded feed scopes completed records to the selected category', () => {
  const videos = toDownloadedFeedVideos(downloads, 'trading');

  assert.deepEqual(videos.map((video) => video.downloadId), ['download-trading']);
});