// Import groupé de chaînes YouTube.
//
// L'utilisateur colle une liste d'identifiants (`UC…`), de handles (`@…`) ou
// de liens, séparés par des virgules, des points-virgules ou des retours à la
// ligne. On découpe d'abord (sans réseau, donc testable), puis on résout chaque
// entrée avec `resolveChannelInput` en limitant le parallélisme pour ne pas se
// faire limiter par YouTube.

/** Séparateurs acceptés : virgule, point-virgule, retour à la ligne. */
const SEPARATORS = /[,;\r\n]+/;

/** Nombre de résolutions simultanées : assez rapide, sans déclencher de 429. */
export const IMPORT_CONCURRENCY = 3;

/**
 * Découpe une saisie libre en entrées uniques, dans l'ordre d'apparition.
 * Les doublons textuels (même valeur à la casse près) sont écartés : inutile
 * de résoudre deux fois exactement la même chose.
 *
 * @param {string} raw
 * @returns {string[]}
 */
export function splitChannelInput(raw) {
  const seen = new Set();
  const entries = [];

  String(raw ?? '')
    .split(SEPARATORS)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      entries.push(part);
    });

  return entries;
}

/**
 * Résout et classe un lot d'entrées.
 *
 * @param {string[]} entries
 * @param {object} options
 * @param {(input: string) => Promise<{id: string, title: string}>} options.resolve
 * @param {Iterable<string>} [options.existingIds] chaînes déjà suivies
 * @param {number} [options.concurrency]
 * @param {(done: number, total: number) => void} [options.onProgress]
 * @param {() => boolean} [options.isCancelled]
 * @returns {Promise<{
 *   total: number,
 *   added: {id: string, title: string}[],
 *   duplicates: {id: string, title: string}[],
 *   failed: {input: string, message: string}[],
 *   cancelled: boolean,
 * }>}
 */
export async function importChannels(
  entries,
  {
    resolve,
    existingIds = [],
    concurrency = IMPORT_CONCURRENCY,
    onProgress,
    isCancelled,
  } = {},
) {
  const list = Array.isArray(entries) ? entries : [];
  const total = list.length;
  const known = new Set(existingIds);
  const results = new Array(total);

  let cursor = 0;
  let done = 0;
  let cancelled = false;

  const worker = async () => {
    while (cursor < total) {
      if (isCancelled?.()) {
        cancelled = true;
        return;
      }

      const index = cursor;
      cursor += 1;

      try {
        const channel = await resolve(list[index]);
        if (known.has(channel.id)) {
          results[index] = { status: 'duplicate', channel };
        } else {
          // Ajouté à `known` immédiatement : deux entrées différentes qui
          // pointent vers la même chaîne comptent comme un doublon.
          known.add(channel.id);
          results[index] = { status: 'added', channel };
        }
      } catch (error) {
        results[index] = {
          status: 'failed',
          input: list[index],
          message: String(error?.message ?? '').trim(),
        };
      } finally {
        done += 1;
        onProgress?.(done, total);
      }
    }
  };

  const poolSize = Math.max(1, Math.min(concurrency, total || 1));
  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  const report = {
    total,
    added: [],
    duplicates: [],
    failed: [],
    cancelled,
  };

  // Reconstruction dans l'ordre de saisie, même si les réponses arrivent dans
  // un ordre différent à cause du parallélisme.
  results.forEach((result) => {
    if (!result) return;
    if (result.status === 'added') report.added.push(result.channel);
    else if (result.status === 'duplicate') report.duplicates.push(result.channel);
    else report.failed.push({ input: result.input, message: result.message });
  });

  return report;
}
