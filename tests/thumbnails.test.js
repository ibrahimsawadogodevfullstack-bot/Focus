import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bestThumbnail,
  cacheThumbnail,
  clearThumbnailCache,
  clearCachedThumbnail,
  getCachedThumbnail,
  imageDimensionsFromBuffer,
  isThumbnailSharpEnough,
  isValidThumbnail,
  thumbnailCandidates,
  usefulThumbnailWidth,
} from '../services/thumbnails.js';

const videoId = 'short-video';

test('G — une réponse HTTP 404 invalide maxresdefault et sélectionne sddefault', () => {
  const maxres = {
    url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    status: 404,
    width: 120,
    height: 90,
    usefulWidth: 0,
  };
  const sd = {
    url: `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
    status: 200,
    width: 640,
    height: 480,
    usefulWidth: 270,
  };

  assert.equal(isValidThumbnail(maxres), false);
  assert.equal(bestThumbnail([maxres, sd], 200), sd);
});

test('H — le JPEG générique 120×90 est rejeté au profit de la variante suivante', () => {
  const generic = { status: 200, width: 120, height: 90, usefulWidth: 0 };
  const hq = { status: 200, width: 480, height: 360, usefulWidth: 202.5 };

  assert.equal(isValidThumbnail(generic), false);
  assert.equal(bestThumbnail([generic, hq], 180), hq);
});

test('I — aucune source valide laisse le composant sans image à afficher', () => {
  const unavailable = [
    { status: 404, width: 120, usefulWidth: 0 },
    { status: 403, width: 120, usefulWidth: 0 },
    { status: 200, width: 119, usefulWidth: 0 },
  ];

  assert.equal(bestThumbnail(unavailable, 200), null);
});

test('J — le recadrage 16:9 réduit 1280 px à environ 405 px utiles', () => {
  assert.ok(Math.abs(usefulThumbnailWidth('short', 1280, 720) - 405) < 1);
  assert.equal(
    isThumbnailSharpEnough({
      format: 'short',
      width: 1280,
      height: 720,
      displayWidth: 156,
      pixelRatio: 3,
    }),
    false,
  );
  assert.equal(
    bestThumbnail(
      [
        {
          status: 200,
          width: 1280,
          height: 720,
          usefulWidth: usefulThumbnailWidth('short', 1280, 720),
        },
      ],
      156 * 3,
    )?.width,
    1280,
  );
});

test('la chaîne construite suit les quatre résolutions demandées', () => {
  assert.deepEqual(
    thumbnailCandidates(videoId),
    ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault'].map(
      (variant) => `https://i.ytimg.com/vi/${videoId}/${variant}.jpg`,
    ),
  );
});

test('une miniature du flux est validée en premier, sans dépasser quatre URL', () => {
  const provided = 'https://cdn.example.test/video/thumbnail.jpg';
  const candidates = thumbnailCandidates(videoId, provided);

  assert.equal(candidates[0], provided);
  assert.equal(candidates.length, 4);
  assert.equal(candidates[1], `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
});

test('une URL hqdefault fournie par le flux ne supplante pas maxresdefault', () => {
  const candidates = thumbnailCandidates(
    videoId,
    `https://i2.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  );

  assert.equal(candidates[0], `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
});

test('l’économie de données limite les miniatures aux variantes hq et mq', () => {
  const provided = 'https://cdn.example.test/video/thumbnail.jpg';

  assert.deepEqual(thumbnailCandidates(videoId, provided, { dataSaver: true }), [
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
  ]);
});

test('les résultats valides sont mémorisés par identifiant', () => {
  const cached = {
    url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    status: 200,
    width: 480,
    height: 360,
  };
  clearThumbnailCache();

  cacheThumbnail(videoId, cached);
  assert.deepEqual(getCachedThumbnail(videoId), cached);

  clearCachedThumbnail(videoId);
  assert.equal(getCachedThumbnail(videoId), null);
});

test('les dimensions JPEG sont lues pour journaliser une erreur réseau', () => {
  const jpeg = Uint8Array.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x5a, 0x00, 0x78, 0x03,
    0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
  ]);
  assert.deepEqual(imageDimensionsFromBuffer(jpeg.buffer, 'image/jpeg'), {
    width: 120,
    height: 90,
  });
});
