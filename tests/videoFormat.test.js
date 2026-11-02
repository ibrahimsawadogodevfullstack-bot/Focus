import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FORMAT_SHORT,
  FORMAT_VIDEO,
  formatOf,
  getVideoFormat,
  isFormatResolved,
} from '../services/filters.js';

// 1. Champ `format` fourni par les données : prioritaire sur tout le reste.
test('un champ format explicite gagne, même contre des dimensions inverses', () => {
  assert.equal(
    getVideoFormat({ format: 'short', width: 1920, height: 1080 }),
    FORMAT_SHORT,
  );
  assert.equal(
    getVideoFormat({ format: 'video', width: 1080, height: 1920 }),
    FORMAT_VIDEO,
  );
});

// 2. Booléen `isShort` fourni par une API future.
test('isShort booléen est respecté dans les deux sens', () => {
  assert.equal(getVideoFormat({ isShort: true }), FORMAT_SHORT);
  assert.equal(getVideoFormat({ isShort: false }), FORMAT_VIDEO);
});

// 3. Dimensions : hauteur > largeur → Short.
test('height > width classe en Short, width > height en vidéo', () => {
  assert.equal(getVideoFormat({ width: 1080, height: 1920 }), FORMAT_SHORT);
  assert.equal(getVideoFormat({ width: 1920, height: 1080 }), FORMAT_VIDEO);
});

// 4. Un carré n'est pas un Short : rien ne prouve qu'il est vertical.
test('une vignette carrée reste une vidéo', () => {
  assert.equal(getVideoFormat({ width: 1080, height: 1080 }), FORMAT_VIDEO);
});

// 5. URL /shorts/ quand aucune dimension n'est fournie.
test('une URL /shorts/ classe en Short sans dimensions', () => {
  assert.equal(getVideoFormat({ url: 'https://www.youtube.com/shorts/abc' }), FORMAT_SHORT);
  assert.equal(getVideoFormat({ videoUrl: 'https://youtube.com/shorts/abc?x=1' }), FORMAT_SHORT);
  assert.equal(getVideoFormat({ url: 'https://www.youtube.com/watch?v=abc' }), FORMAT_VIDEO);
});

// 6. La priorité 1 bat la priorité 2 (donnée explicite > URL).
test('un format déclaré bat une URL /shorts/', () => {
  assert.equal(
    getVideoFormat({ format: 'video', url: 'https://www.youtube.com/shorts/abc' }),
    FORMAT_VIDEO,
  );
  assert.equal(
    getVideoFormat({ width: 1920, height: 1080, url: 'https://youtube.com/shorts/abc' }),
    FORMAT_VIDEO,
  );
});

// 7. Règle 3 : la durée seule ne classe jamais (pas de règle inventée).
test('une durée ≤ 60 s ne suffit pas à classer en Short', () => {
  assert.equal(getVideoFormat({ duration: 42 }), FORMAT_VIDEO);
  assert.equal(getVideoFormat({ duration: 60, title: 'Capsule' }), FORMAT_VIDEO);
});

// 8. Entrées dégradées : la fonction reste totale.
test('null, undefined et objet vide renvoient video', () => {
  assert.equal(getVideoFormat(null), FORMAT_VIDEO);
  assert.equal(getVideoFormat(undefined), FORMAT_VIDEO);
  assert.equal(getVideoFormat({}), FORMAT_VIDEO);
});

// 9. Dimensions invalides : on ignore le champ et on continue la cascade.
test('des dimensions invalides ne bloquent pas la détection par URL', () => {
  assert.equal(
    getVideoFormat({
      width: 0,
      height: 0,
      url: 'https://www.youtube.com/shorts/abc',
    }),
    FORMAT_SHORT,
  );
  assert.equal(getVideoFormat({ width: 'abc', height: null }), FORMAT_VIDEO);
});

// 10. Résolution : une vidéo sans preuve ne doit pas afficher sa vignette.
test('une vidéo RSS sans signal n’est pas résolue', () => {
  assert.equal(isFormatResolved({ videoId: 'abc', title: 'Titre' }), false);
  assert.equal(isFormatResolved({ videoId: 'abc' }, {}), false);
  assert.equal(isFormatResolved(null), false);
});

// 11. Résolution : sonde, dimensions, URL, hashtag et isShort comptent.
test('chaque signal fiable rend le format résolu', () => {
  assert.equal(isFormatResolved({ videoId: 'abc' }, { abc: FORMAT_VIDEO }), true);
  assert.equal(isFormatResolved({ videoId: 'abc' }, { abc: FORMAT_SHORT }), true);
  assert.equal(isFormatResolved({ width: 1920, height: 1080 }), true);
  assert.equal(isFormatResolved({ url: 'https://youtube.com/shorts/x' }), true);
  assert.equal(isFormatResolved({ title: 'Astuce #shorts' }), true);
  assert.equal(isFormatResolved({ isShort: false }), true);
});

// 12. Un champ format fourni par les données est une preuve explicite.
test('un champ format explicite est considéré résolu', () => {
  assert.equal(isFormatResolved({ format: 'short' }), true);
  assert.equal(isFormatResolved({ format: 'video' }), true);
  assert.equal(isFormatResolved({ format: 'autre' }), false);
});

// 13. Le lien « alternate » du flux tranche avant la sonde oardefault :
// certains Shorts n'ont pas d'image oardefault (404), donc la sonde dirait
// « video » à tort. Le lien /shorts/ doit gagner.
test('le lien RSS /shorts/ bat une sonde qui dit video', () => {
  const video = {
    videoId: 'short1',
    url: 'https://www.youtube.com/shorts/short1',
    urlSource: 'feed',
  };
  assert.equal(formatOf(video, { short1: FORMAT_VIDEO }), FORMAT_SHORT);
  assert.equal(isFormatResolved(video, { short1: FORMAT_VIDEO }), true);
});

// 14. Symétriquement, un lien /watch du flux prouve une vidéo longue et bat
// un hashtag ou une sonde qui diraient « short ».
test('le lien RSS /watch prouve une vidéo longue', () => {
  const video = {
    videoId: 'long1',
    title: 'Une capsule #shorts',
    url: 'https://www.youtube.com/watch?v=long1',
    urlSource: 'feed',
  };
  assert.equal(formatOf(video, { long1: FORMAT_SHORT }), FORMAT_VIDEO);
  assert.equal(isFormatResolved(video, { long1: FORMAT_SHORT }), true);
});
