import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FORMAT_SHORT,
  FORMAT_VIDEO,
  classifyFormat,
  isShort,
  splitByFormat,
  withFormat,
} from '../src/domain/videoFormat.ts';

test('un format déjà calculé est conservé tel quel', () => {
  assert.equal(classifyFormat({ format: 'short' }), FORMAT_SHORT);
  assert.equal(classifyFormat({ format: 'video', width: 1080, height: 1920 }), FORMAT_VIDEO);
});

test('les dimensions priment sur les autres signaux', () => {
  assert.equal(classifyFormat({ width: 1080, height: 1920 }), FORMAT_SHORT);
  assert.equal(classifyFormat({ width: 1920, height: 1080 }), FORMAT_VIDEO);
  assert.equal(classifyFormat({ width: 1080, height: 1080 }), FORMAT_VIDEO);
});

test('une URL /shorts/ suffit à classer en Short', () => {
  assert.equal(classifyFormat({ url: 'https://www.youtube.com/shorts/abc' }), FORMAT_SHORT);
  assert.equal(classifyFormat({ url: 'https://www.youtube.com/watch?v=abc' }), FORMAT_VIDEO);
});

test('un hashtag explicite classe en Short, sans jamais supprimer la vidéo', () => {
  assert.equal(classifyFormat({ title: 'Astuce de calcul #Shorts' }), FORMAT_SHORT);
  assert.equal(classifyFormat({ title: 'Cours complet de mathématiques' }), FORMAT_VIDEO);
});

test('la durée seule ne classe pas en Short', () => {
  const capsule = { title: 'Capsule de 60 s', duration: 60 };
  assert.equal(classifyFormat(capsule), FORMAT_VIDEO);
  assert.equal(isShort(capsule), false);
});

test('une vidéo nulle ne casse pas le classement', () => {
  assert.equal(classifyFormat(null), FORMAT_VIDEO);
  assert.equal(classifyFormat(undefined), FORMAT_VIDEO);
});

test('withFormat ajoute le champ sans muter l’original', () => {
  const original = { videoId: 'a', title: 'x #shorts' };
  const next = withFormat(original);
  assert.equal(next.format, FORMAT_SHORT);
  assert.equal(original.format, undefined);
});

test('splitByFormat ne perd aucune vidéo et conserve l’ordre', () => {
  const videos = [
    { videoId: 'v1', title: 'Longue' },
    { videoId: 's1', title: 'Courte #shorts' },
    { videoId: 'v2', title: 'Autre longue' },
  ];

  const { shorts, long } = splitByFormat(videos);

  assert.deepEqual(
    long.map((video) => video.videoId),
    ['v1', 'v2'],
  );
  assert.deepEqual(
    shorts.map((video) => video.videoId),
    ['s1'],
  );
  assert.equal(long.length + shorts.length, videos.length);
});

test('splitByFormat accepte une liste vide', () => {
  assert.deepEqual(splitByFormat(), { shorts: [], long: [] });
});
