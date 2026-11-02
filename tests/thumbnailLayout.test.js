import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SHORT_ASPECT,
  VIDEO_ASPECT,
  cropZoomFor,
  isVerticalSource,
  thumbnailRatio,
  visibleSourceWidthFraction,
} from '../services/thumbnailLayout.js';

const WIDE = 16 / 9;
const VERTICAL = 9 / 16;

// Cas A/C/D : le ratio du conteneur dépend uniquement du format.
test('cadre 9:16 pour un Short, 16:9 pour une vidéo et pour un format inconnu', () => {
  assert.equal(thumbnailRatio('short'), SHORT_ASPECT);
  assert.equal(thumbnailRatio('video'), VIDEO_ASPECT);
  assert.equal(thumbnailRatio('autre'), VIDEO_ASPECT);
});

// Cas A/B : un Short 16:9 ne montre que la bande centrale (≈ 31,6 %).
test('une source 16:9 dans un cadre 9:16 ne montre que 31,6 % de la largeur', () => {
  assert.ok(Math.abs(visibleSourceWidthFraction('short', WIDE) - 0.3164) < 0.001);
});

// Cas C : une source déjà verticale est affichée entière.
test('une source 9:16 remplit toute la largeur du cadre', () => {
  assert.equal(visibleSourceWidthFraction('short', VERTICAL), 1);
  assert.equal(isVerticalSource(VERTICAL), true);
});

// Cas D/E : une vidéo longue n'est jamais recadrée en bande centrale.
test('une vidéo longue garde toute la largeur, même en 4:3', () => {
  assert.equal(visibleSourceWidthFraction('video', WIDE), 1);
  assert.equal(visibleSourceWidthFraction('video', 4 / 3), 1);
});

// Aucun zoom logiciel n'est ajouté au recadrage cover.
test('aucun zoom supplémentaire quelle que soit la source', () => {
  assert.equal(cropZoomFor('short', WIDE), 1);
  assert.equal(cropZoomFor('short', 4 / 3), 1);
  assert.equal(cropZoomFor('short', VERTICAL), 1);
  assert.equal(cropZoomFor('video', WIDE), 1);
  assert.equal(cropZoomFor('video', VERTICAL), 1);
});

// Une source inconnue ne déclenche pas non plus de zoom.
test('ratio inconnu : aucun zoom pour les deux formats', () => {
  assert.equal(cropZoomFor('short', null), 1);
  assert.equal(cropZoomFor('short', undefined), 1);
  assert.equal(cropZoomFor('video', null), 1);
});
