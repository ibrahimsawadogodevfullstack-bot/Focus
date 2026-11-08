import assert from 'node:assert/strict';
import test from 'node:test';

import { toFileUri, toNativePath } from '../services/filePaths.js';

test('convertit une URI document expo-file-system en chemin natif', () => {
  assert.equal(
    toNativePath('file:///data/user/0/com.bramslinux.youtubefilterv2/files/downloads/cat-1/'),
    '/data/user/0/com.bramslinux.youtubefilterv2/files/downloads/cat-1',
  );
});

test('décode les caractères échappés dans le chemin', () => {
  assert.equal(toNativePath('file:///data/user/0/app/files/My%20Videos'), '/data/user/0/app/files/My Videos');
});

test('laisse un chemin natif inchangé', () => {
  assert.equal(toNativePath('/data/user/0/app/files/downloads'), '/data/user/0/app/files/downloads');
});

test('accepte la variante file:/ sans double slash', () => {
  assert.equal(toNativePath('file:/data/user/0/app/files/'), '/data/user/0/app/files');
});

test('conserve les URI non-file telles quelles', () => {
  assert.equal(toNativePath('content://media/external/video/1'), 'content://media/external/video/1');
});

test('gère la racine', () => {
  assert.equal(toNativePath('file:///'), '/');
});

test('convertit un chemin natif en URI file://', () => {
  assert.equal(
    toFileUri('/data/user/0/com.bramslinux.youtubefilterv2/files/downloads/cat-1/video.mp4'),
    'file:///data/user/0/com.bramslinux.youtubefilterv2/files/downloads/cat-1/video.mp4',
  );
});

test('laisse une URI file:// inchangée', () => {
  assert.equal(toFileUri('file:///data/user/0/app/files/video.mp4'), 'file:///data/user/0/app/files/video.mp4');
});

test('laisse les autres URI inchangées', () => {
  assert.equal(toFileUri('content://media/external/video/1'), 'content://media/external/video/1');
});

test('aller-retour chemin natif ↔ URI', () => {
  const path = '/data/user/0/app/files/downloads/cat-1/video.mp4';
  assert.equal(toNativePath(toFileUri(path)), path);
});
