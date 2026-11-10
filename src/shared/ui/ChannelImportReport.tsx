import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fontSize, radius, spacing } from '../theme/tokens';
import { useThemeStyles } from '../theme/ThemeProvider';
import ChannelAvatar from './ChannelAvatar';
import { CheckIcon, CloseIcon } from './Icons';

export type ImportedChannel = { id: string; title: string };
export type ImportFailure = { input: string; message: string };

export type ChannelImportReport = {
  total: number;
  added: ImportedChannel[];
  duplicates: ImportedChannel[];
  failed: ImportFailure[];
  cancelled?: boolean;
};

/**
 * Compte rendu d'un import groupé : ce qui est entré, ce qui existait déjà et
 * ce qui a échoué. Partagé par le panneau d'ajout et l'onglet Chaînes, pour
 * que le résultat s'affiche au même endroit dans les deux cas.
 */
export default function ChannelImportReportView({
  report,
  avatars = {},
  maxListed = 6,
}: {
  report: ChannelImportReport;
  avatars?: Record<string, string>;
  maxListed?: number;
}) {
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation('channels');

  const summary = [
    report.added.length > 0 ? t('importAdded', { count: report.added.length }) : null,
    report.duplicates.length > 0
      ? t('importDuplicates', { count: report.duplicates.length })
      : null,
    report.failed.length > 0 ? t('importFailed', { count: report.failed.length }) : null,
    report.cancelled ? t('importCancelled') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (!summary) return null;

  const added = report.added.slice(0, maxListed);
  const duplicates = report.duplicates.slice(0, maxListed);
  const failed = report.failed.slice(0, maxListed);
  const hiddenCount =
    report.added.length -
    added.length +
    (report.duplicates.length - duplicates.length) +
    (report.failed.length - failed.length);

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <Text style={styles.summary}>{summary}</Text>

      {added.map((channel) => (
        <View key={`added-${channel.id}`} style={styles.row}>
          <View style={[styles.badge, styles.badgeSuccess]}>
            <CheckIcon color={colors.success} size={10} />
          </View>
          <ChannelAvatar
            uri={avatars[channel.id]}
            name={channel.title || channel.id}
            size={26}
          />
          <Text style={styles.title} numberOfLines={1}>
            {channel.title || t('untitled')}
          </Text>
        </View>
      ))}

      {duplicates.map((channel) => (
        <View key={`duplicate-${channel.id}`} style={styles.row}>
          <View style={[styles.badge, styles.badgeMuted]}>
            <Text style={styles.badgeMark}>—</Text>
          </View>
          <Text style={styles.mutedTitle} numberOfLines={1}>
            {channel.title || channel.id}
          </Text>
          <Text style={styles.tag}>{t('alreadyAddedShort')}</Text>
        </View>
      ))}

      {failed.map((failure) => (
        <View key={`failed-${failure.input}`} style={styles.failedRow}>
          <View style={[styles.badge, styles.badgeDanger]}>
            <CloseIcon color={colors.danger} size={8} />
          </View>
          <View style={styles.failedTexts}>
            <Text style={styles.failedInput} numberOfLines={1}>
              {failure.input}
            </Text>
            {failure.message ? (
              <Text style={styles.failedMessage} numberOfLines={2}>
                {failure.message}
              </Text>
            ) : null}
          </View>
        </View>
      ))}

      {hiddenCount > 0 ? (
        <Text style={styles.more}>{t('importMore', { count: hiddenCount })}</Text>
      ) : null}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  summary: {
    color: colors.text,
    fontSize: fontSize.meta,
    fontWeight: '700',
    marginBottom: 2,
  },
  row: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  failedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSuccess: {
    backgroundColor: colors.successSoft,
  },
  badgeMuted: {
    backgroundColor: colors.raised,
  },
  badgeDanger: {
    backgroundColor: colors.dangerSoft,
  },
  badgeMark: {
    color: colors.textFaint,
    fontSize: fontSize.micro,
    fontWeight: '700',
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.label,
    fontWeight: '600',
  },
  mutedTitle: {
    flex: 1,
    color: colors.textMuted,
    fontSize: fontSize.label,
  },
  tag: {
    color: colors.textFaint,
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
  failedTexts: {
    flex: 1,
    gap: 1,
  },
  failedInput: {
    color: colors.textMuted,
    fontSize: fontSize.meta,
    fontWeight: '600',
  },
  failedMessage: {
    color: colors.danger,
    fontSize: fontSize.caption,
    lineHeight: 15,
  },
  more: {
    marginTop: 2,
    color: colors.textFaint,
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
});
