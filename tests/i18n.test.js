import assert from 'node:assert/strict';
import test from 'node:test';

import en from '../locales/en.json' with { type: 'json' };
import fr from '../locales/fr.json' with { type: 'json' };

function leafKeys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' ? leafKeys(child, path) : [path];
  });
}

test('les catalogues français et anglais exposent les mêmes clés', () => {
  const frenchKeys = leafKeys(fr).sort();
  const englishKeys = leafKeys(en).sort();

  assert.deepEqual(englishKeys, frenchKeys);
});