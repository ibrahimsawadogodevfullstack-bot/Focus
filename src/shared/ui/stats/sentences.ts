import type { TFunction } from 'i18next';

import type { SummarySentence } from '../../../../services/viewingSummary';
import { formatWatchTime } from '../../../../services/viewingSummary';

/**
 * Traduit une phrase de résumé, en localisant les durées.
 * Les clés viennent de `services/viewingSummary` et vivent dans `viewing`.
 */
export function summarySentenceText(
  t: TFunction,
  sentence: SummarySentence,
  locale: string,
): string {
  const params = sentence.params ?? {};
  const localized = { ...params };

  if (typeof params.duration === 'number') {
    localized.duration = formatWatchTime(params.duration, locale);
  }

  return t(`viewing:${sentence.key}`, localized);
}
