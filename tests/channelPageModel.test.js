import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeChannelVideos, toChannelVideos } from '../services/channelPageModel';

const channel = { id: 'UC1234567890123456789012', title: 'Fireship' };

const page = [
  {
    videoId: 'abc123',
    title: 'Première vidéo',
    durationSec: 347,
    viewCount: 1900000,
    thumbnailUrl: 'https://i.ytimg.com/vi/abc123/hq720.jpg?sqp=signed',
  },
  {
    videoId: 'def456',
    title: '   ',
    durationSec: 0,
    viewCount: 0,
    thumbnailUrl: '',
  },
  {
    videoId: '',
    title: 'Entrée sans identifiant',
    durationSec: 90,
    viewCount: 10,
    thumbnailUrl: '',
  },
  {
    videoId: 'abc123',
    title: 'Doublon dans la même page',
    durationSec: 10,
    viewCount: 1,
    thumbnailUrl: '',
  },
];

test('channel page maps flat yt-dlp entries to feed videos', () => {
  const videos = toChannelVideos(page, channel);

  assert.deepEqual(videos.map((video) => video.videoId), ['abc123', 'def456']);
  assert.equal(videos[0].channelId, channel.id);
  assert.equal(videos[0].channelTitle, 'Fireship');
  assert.equal(videos[0].title, 'Première vidéo');
  assert.equal(videos[0].duration, 347);
  assert.equal(videos[0].viewCount, 1900000);
  assert.equal(videos[0].format, 'video');
  assert.equal(videos[0].isShort, false);
  // Pas de date dans une extraction aplatie : la carte laisse la place vide.
  assert.equal(videos[0].publishedAt, 0);
  assert.equal(videos[0].url, 'https://www.youtube.com/watch?v=abc123');
  // Un compteur absent ou nul est omis : la carte n'affiche pas « 0 vue ».
  assert.equal(videos[1].viewCount, undefined);
});

test('channel page keeps stable thumbnails and falls back to hqdefault', () => {
  const videos = toChannelVideos(page, channel);

  // Une URL signée i.ytimg.com reste utilisable telle quelle…
  assert.equal(
    videos[0].thumbnail,
    'https://i.ytimg.com/vi/abc123/hq720.jpg?sqp=signed',
  );
  // …sinon on reconstruit la miniature stable, comme le flux RSS.
  assert.equal(videos[1].thumbnail, 'https://i.ytimg.com/vi/def456/hqdefault.jpg');
});

test('channel page tolerates missing titles and invalid counts', () => {
  const videos = toChannelVideos(
    [
      {
        videoId: 'ghi789',
        title: '',
        durationSec: Number.NaN,
        viewCount: Number.NaN,
        thumbnailUrl: 'https://example.com/thumb.jpg',
      },
    ],
    channel,
  );

  assert.equal(videos[0].title, 'Vidéo');
  assert.equal(videos[0].duration, 0);
  assert.equal(videos[0].viewCount, undefined);
  assert.equal(videos[0].thumbnail, 'https://i.ytimg.com/vi/ghi789/hqdefault.jpg');
});

test('channel page merge keeps RSS videos first and removes overlaps', () => {
  const rss = [
    { videoId: 'abc123', title: 'RSS 1' },
    { videoId: 'rss2', title: 'RSS 2' },
  ];
  const loaded = [
    { videoId: 'abc123', title: 'Version yt-dlp du même identifiant' },
    { videoId: 'older1', title: 'Plus ancienne' },
    { videoId: 'rss2', title: 'Doublon' },
    { videoId: '', title: 'Sans identifiant' },
  ];

  const merged = mergeChannelVideos(rss, loaded);

  assert.deepEqual(merged.map((video) => video.videoId), [
    'abc123',
    'rss2',
    'older1',
  ]);
  // L'entrée du RSS gagne : elle porte la date de publication.
  assert.equal(merged[0].title, 'RSS 1');
});

test('channel page merge accepts empty inputs', () => {
  assert.deepEqual(mergeChannelVideos(undefined, undefined), []);
  assert.deepEqual(mergeChannelVideos([], []), []);
});
