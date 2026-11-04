import assert from 'node:assert/strict';
import test from 'node:test';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

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

test('React i18next résout les clés de namespace dans les deux langues', async () => {
  const instance = i18next.createInstance();
  await instance.use(initReactI18next).init({
    resources: { en, fr },
    lng: 'en',
    fallbackLng: 'fr',
    ns: Object.keys(en),
    defaultNS: 'common',
  });

  assert.equal(instance.t('tabs:feed'), 'Home');
  assert.equal(instance.t('crash:trace'), 'Stack trace');
  await instance.changeLanguage('fr');
  assert.equal(instance.t('tabs:feed'), 'Accueil');
  assert.equal(instance.t('crash:trace'), 'Trace');
});