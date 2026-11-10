import assert from 'node:assert/strict';
import test from 'node:test';

import { importChannels, splitChannelInput } from '../services/channelImport.js';

test('splitChannelInput découpe virgules, points-virgules et retours à la ligne', () => {
  const entries = splitChannelInput(
    ' UCabc, https://youtube.com/@Fireship ;\nhttps://youtube.com/channel/UCxyz\r\n',
  );

  assert.deepEqual(entries, [
    'UCabc',
    'https://youtube.com/@Fireship',
    'https://youtube.com/channel/UCxyz',
  ]);
});

test('splitChannelInput ignore les vides et les doublons textuels', () => {
  const entries = splitChannelInput('UCabc,, UCABC ,\n\n@handle, @Handle');

  assert.deepEqual(entries, ['UCabc', '@handle']);
});

test('splitChannelInput renvoie un tableau vide sans saisie', () => {
  assert.deepEqual(splitChannelInput(''), []);
  assert.deepEqual(splitChannelInput('  ,  ;\n '), []);
  assert.deepEqual(splitChannelInput(null), []);
});

test('importChannels classe ajouts, doublons et échecs dans l’ordre de saisie', async () => {
  const resolved = {
    a: { id: 'UCa', title: 'A' },
    b: { id: 'UCb', title: 'B' },
    c: { id: 'UCc', title: 'C' },
  };

  const report = await importChannels(['a', 'bad', 'b', 'a'], {
    resolve: async (input) => {
      if (input === 'bad') throw new Error('lien invalide');
      // Résolution volontairement inversée pour vérifier le réordonnancement.
      if (input === 'a') await new Promise((done) => setTimeout(done, 15));
      return resolved[input];
    },
    existingIds: ['UCc'],
  });

  assert.equal(report.total, 4);
  assert.deepEqual(report.added, [resolved.a, resolved.b]);
  // Le second « a » retombe sur la chaîne déjà ajoutée dans ce même lot.
  assert.deepEqual(report.duplicates, [resolved.a]);
  assert.deepEqual(report.failed, [{ input: 'bad', message: 'lien invalide' }]);
  assert.equal(report.cancelled, false);
});

test('importChannels considère les chaînes existantes comme des doublons', async () => {
  const report = await importChannels(['UCa'], {
    resolve: async () => ({ id: 'UCa', title: 'A' }),
    existingIds: ['UCa'],
  });

  assert.equal(report.added.length, 0);
  assert.deepEqual(report.duplicates, [{ id: 'UCa', title: 'A' }]);
});

test('importChannels limite le parallélisme et signale la progression', async () => {
  let running = 0;
  let peak = 0;
  const progress = [];

  const report = await importChannels(['a', 'b', 'c', 'd', 'e', 'f'], {
    concurrency: 2,
    resolve: async (input) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((done) => setTimeout(done, 5));
      running -= 1;
      return { id: `UC${input}`, title: input };
    },
    onProgress: (done, total) => progress.push([done, total]),
  });

  assert.equal(report.added.length, 6);
  assert.ok(peak <= 2, `parallélisme excessif : ${peak}`);
  assert.equal(progress.length, 6);
  assert.deepEqual(progress.at(-1), [6, 6]);
});

test('importChannels s’arrête quand l’import est annulé', async () => {
  const visited = [];
  let stop = false;

  const report = await importChannels(['a', 'b', 'c', 'd'], {
    concurrency: 1,
    isCancelled: () => stop,
    resolve: async (input) => {
      visited.push(input);
      stop = true;
      return { id: `UC${input}`, title: input };
    },
  });

  assert.deepEqual(visited, ['a']);
  assert.equal(report.added.length, 1);
  assert.equal(report.cancelled, true);
});
