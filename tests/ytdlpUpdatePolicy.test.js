import assert from 'node:assert/strict';
import test from 'node:test';

import {
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_RETRY_INTERVAL_MS,
  nextCheckAtFor,
  shouldCheckForUpdate,
} from '../services/ytdlpUpdatePolicy.ts';

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);

test('shouldCheckForUpdate vérifie au premier lancement', () => {
  assert.equal(shouldCheckForUpdate(null, NOW), true);
  assert.equal(shouldCheckForUpdate(undefined, NOW), true);
});

test('shouldCheckForUpdate attend l’échéance planifiée', () => {
  assert.equal(shouldCheckForUpdate(NOW + 60_000, NOW), false);
  assert.equal(shouldCheckForUpdate(NOW, NOW), true);
  assert.equal(shouldCheckForUpdate(NOW - 60_000, NOW), true);
});

test('shouldCheckForUpdate ignore une date corrompue', () => {
  assert.equal(shouldCheckForUpdate(Number.NaN, NOW), true);
});

test('nextCheckAtFor replanifie à un jour après un succès', () => {
  assert.equal(nextCheckAtFor('ok', NOW), NOW + UPDATE_CHECK_INTERVAL_MS);
});

test('nextCheckAtFor retente après une heure en cas d’échec', () => {
  assert.equal(nextCheckAtFor('failed', NOW), NOW + UPDATE_RETRY_INTERVAL_MS);
});
