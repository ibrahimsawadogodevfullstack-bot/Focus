// Extraction de l'identifiant d'une chaîne depuis le HTML de sa page.
// Module pur (aucune dépendance) : testable et réutilisable.

function collectMatches(html, pattern) {
  const counts = new Map();
  pattern.lastIndex = 0;
  let match = pattern.exec(html);
  while (match) {
    const id = match[1];
    counts.set(id, (counts.get(id) ?? 0) + 1);
    match = pattern.exec(html);
  }
  return counts;
}

const PATTERNS = [
  /"externalId":"(UC[A-Za-z0-9_-]{22})"/g,
  /externalId\\x22:\\x22(UC[A-Za-z0-9_-]{22})/g,
  /externalId\\":\\"(UC[A-Za-z0-9_-]{22})/g,
  /itemprop="channelId" content="(UC[A-Za-z0-9_-]{22})"/g,
  /channel\/(UC[A-Za-z0-9_-]{22})/g,
  /channel_id=(UC[A-Za-z0-9_-]{22})/g,
];

/**
 * La page d'une chaîne cite son identifiant plusieurs fois (et parfois ceux de
 * chaînes suggérées). On classe donc les candidats par nombre d'occurrences.
 */
export function extractCandidates(html) {
  const totals = new Map();

  for (const pattern of PATTERNS) {
    for (const [id, count] of collectMatches(html, pattern)) {
      totals.set(id, (totals.get(id) ?? 0) + count);
    }
  }

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}
