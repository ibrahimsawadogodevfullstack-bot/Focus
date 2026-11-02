import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEmbedUrl, PLAYER_BRIDGE_SCRIPT } from '../services/playerEmbed.js';

test('les sous-titres ne sont activés que sur demande', () => {
  const enabled = new URL(buildEmbedUrl({ videoId: 'video-id', subtitles: true }));
  const disabled = new URL(buildEmbedUrl({ videoId: 'video-id' }));

  assert.equal(enabled.searchParams.get('cc_load_policy'), '1');
  assert.equal(disabled.searchParams.get('cc_load_policy'), '0');
});

test('le pont expose le réglage de vitesse au lecteur YouTube', () => {
  assert.match(PLAYER_BRIDGE_SCRIPT, /setPlaybackRate/);
});
