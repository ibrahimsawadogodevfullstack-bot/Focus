import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareChannels,
  normalizeChannelTitle,
  sortChannelsByTitle,
} from '../services/channelSort';

test('normalizeChannelTitle ignores case, accents and outer spaces', () => {
  assert.equal(normalizeChannelTitle('  Élise  '), 'elise');
  assert.equal(normalizeChannelTitle('PRÉCEPTEUR'), 'precepteur');
  assert.equal(normalizeChannelTitle(null), '');
  assert.equal(normalizeChannelTitle(undefined), '');
});

test('sortChannelsByTitle orders titles alphabetically', () => {
  const channels = [
    { id: 'UC3', title: 'TOUKIWANTI' },
    { id: 'UC1', title: 'bmn-maths' },
    { id: 'UC2', title: 'Intel Devs' },
  ];

  assert.deepEqual(
    sortChannelsByTitle(channels).map((channel) => channel.title),
    ['bmn-maths', 'Intel Devs', 'TOUKIWANTI'],
  );
});

test('sortChannelsByTitle puts accented titles next to their plain form', () => {
  const channels = [
    { id: 'UC3', title: 'Zoé' },
    { id: 'UC1', title: 'Elise' },
    { id: 'UC2', title: 'Élise' },
  ];

  assert.deepEqual(
    sortChannelsByTitle(channels).map((channel) => channel.id),
    ['UC1', 'UC2', 'UC3'],
  );
});

test('sortChannelsByTitle keeps untitled channels at the end', () => {
  const channels = [
    { id: 'UC1', title: '' },
    { id: 'UC2', title: 'Majorant' },
    { id: 'UC3', title: null },
    { id: 'UC4', title: 'Bmn-maths' },
  ];

  assert.deepEqual(
    sortChannelsByTitle(channels).map((channel) => channel.id),
    ['UC4', 'UC2', 'UC1', 'UC3'],
  );
});

test('sortChannelsByTitle is stable for identical titles', () => {
  const channels = [
    { id: 'UCB', title: 'Maths' },
    { id: 'UCA', title: 'Maths' },
  ];

  assert.deepEqual(
    sortChannelsByTitle(channels).map((channel) => channel.id),
    ['UCA', 'UCB'],
  );
  assert.equal(compareChannels(channels[0], channels[1]), 1);
});

test('sortChannelsByTitle compares numbers as numbers', () => {
  const channels = [
    { id: 'UC10', title: 'Cours 10' },
    { id: 'UC2', title: 'Cours 2' },
  ];

  assert.deepEqual(
    sortChannelsByTitle(channels).map((channel) => channel.title),
    ['Cours 2', 'Cours 10'],
  );
});

test('sortChannelsByTitle does not mutate its input', () => {
  const channels = [
    { id: 'UC2', title: 'Zeta' },
    { id: 'UC1', title: 'Alpha' },
  ];
  const copy = [...channels];

  sortChannelsByTitle(channels);

  assert.deepEqual(channels, copy);
  assert.deepEqual(sortChannelsByTitle([]), []);
});
