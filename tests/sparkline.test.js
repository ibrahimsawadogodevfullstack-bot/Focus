import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSparkline } from '../src/shared/utils/sparkline.ts';

test('buildSparkline returns empty geometry without values', () => {
  const empty = buildSparkline([], 100, 32);
  assert.equal(empty.line, '');
  assert.equal(empty.area, '');
  assert.deepEqual(empty.points, []);
  assert.equal(empty.max, 0);
});

test('buildSparkline draws a flat centred line when nothing happened', () => {
  const geometry = buildSparkline([0, 0, 0], 100, 32, 2);
  assert.equal(geometry.max, 0);
  assert.equal(geometry.points.length, 3);
  // hauteur 32, padding 2 → centre à 16
  assert.deepEqual(
    geometry.points.map((point) => point.y),
    [16, 16, 16],
  );
  assert.equal(geometry.line.startsWith('M '), true);
});

test('buildSparkline maps the peak to the top padding and zero to the bottom', () => {
  const geometry = buildSparkline([0, 10], 100, 32, 2);
  assert.equal(geometry.max, 10);
  assert.deepEqual(geometry.points[0], { x: 2, y: 30 });
  assert.deepEqual(geometry.points[1], { x: 98, y: 2 });
});

test('buildSparkline ignores negative and non-finite values', () => {
  const geometry = buildSparkline([-5, Number.NaN, 4, Number.POSITIVE_INFINITY], 100, 32);
  assert.equal(geometry.max, 4);
  assert.equal(geometry.points[2].y, 2);
  assert.equal(geometry.points[0].y, 30);
  assert.equal(geometry.points[1].y, 30);
});

test('buildSparkline centres a single value', () => {
  const geometry = buildSparkline([7], 100, 32);
  assert.equal(geometry.points.length, 1);
  assert.equal(geometry.points[0].x, 50);
});

test('buildSparkline closes the area on the baseline', () => {
  const geometry = buildSparkline([1, 2, 3], 100, 32, 2);
  assert.equal(geometry.area.endsWith('Z'), true);
  assert.equal(geometry.area.includes('L 98 32'), true);
  assert.equal(geometry.area.includes('L 2 32'), true);
});

test('buildSparkline rejects a degenerate canvas', () => {
  assert.equal(buildSparkline([1, 2], 0, 32).line, '');
  assert.equal(buildSparkline([1, 2], 100, -1).line, '');
  assert.equal(buildSparkline([1, 2], Number.NaN, 32).line, '');
});
