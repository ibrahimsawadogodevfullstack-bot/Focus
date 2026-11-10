import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import type { ViewingPeriod } from '../../../domain/viewing';
import type { DayPoint } from '../../../../services/viewingSummary';
import { formatPercent, formatVariation, formatWatchTime } from '../../../../services/viewingSummary';
import { colors, fontSize, radius, spacing } from '../../theme/tokens';
import { useTheme, useThemeStyles } from '../../theme/ThemeProvider';
import { Chevron } from '../Icons';
import { Sparkline } from './Sparkline';

interface StatsCardProps {
  title?: string;
  subtitle?: string;
  onPress?: () => void;
  actionLabel?: string;
  right?: ReactNode;
  children: ReactNode;
}

/** Carte de statistiques ; le titre devient un bouton quand `onPress` existe. */
export function StatsCard({ title, subtitle, onPress, actionLabel, right, children }: StatsCardProps) {
  const themedStyles = useThemeStyles(styles);
  const { colors: theme } = useTheme();

  const header = title ? (
    <View style={themedStyles.cardHeader}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? actionLabel ?? title : undefined}
        style={({ pressed }) => [themedStyles.headerPress, pressed && onPress && themedStyles.pressed]}
      >
        <View style={themedStyles.headerCopy}>
          <Text style={themedStyles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={themedStyles.cardSubtitle}>{subtitle}</Text> : null}
        </View>
        {onPress ? <Chevron direction="right" color={theme.textFaint} size={8} thickness={2} /> : null}
      </Pressable>
      {right}
    </View>
  ) : null;

  return (
    <View style={themedStyles.card}>
      {header}
      <View style={themedStyles.cardBody}>{children}</View>
    </View>
  );
}

export function PeriodSelector({
  value,
  onChange,
}: {
  value: ViewingPeriod;
  onChange: (value: ViewingPeriod) => void;
}) {
  const { t } = useTranslation('viewing');
  const themedStyles = useThemeStyles(styles);
  const options: ViewingPeriod[] = ['today', '7d', '30d'];
  const labels: Record<ViewingPeriod, string> = {
    today: t('periodToday'),
    '7d': t('period7'),
    '30d': t('period30'),
  };

  return (
    <View style={themedStyles.period} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={({ pressed }) => [
              themedStyles.periodOption,
              selected && themedStyles.periodSelected,
              pressed && themedStyles.pressed,
            ]}
          >
            <Text style={[themedStyles.periodLabel, selected && themedStyles.periodLabelSelected]}>
              {labels[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

export function StatTile({
  label,
  value,
  comparison,
  series,
  color,
}: {
  label: string;
  value: string;
  comparison?: number | null;
  /** Série quotidienne de la métrique ; affiche une sparkline si fournie. */
  series?: number[];
  color?: string;
}) {
  const { t, i18n } = useTranslation('viewing');
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'fr';
  const themedStyles = useThemeStyles(styles);
  const variation = comparison ?? null;
  const comparisonText = formatVariation(variation, locale);
  const comparisonLabel =
    variation === null
      ? ''
      : variation > 0
        ? t('comparisonMore', { value: Math.abs(variation) })
        : variation < 0
          ? t('comparisonLess', { value: Math.abs(variation) })
          : t('comparisonSame');

  return (
    <View
      style={themedStyles.tile}
      accessible
      accessibilityLabel={`${label}, ${value}${comparisonLabel ? `, ${comparisonLabel}` : ''}`}
    >
      <Text style={themedStyles.tileValue} numberOfLines={1}>{value}</Text>
      <Text style={themedStyles.tileLabel} numberOfLines={2}>{label}</Text>
      <Text style={themedStyles.tileComparison} numberOfLines={1}>
        {comparisonText || '\u00A0'}
      </Text>
      {series && color ? (
        <View style={themedStyles.tileSparkline}>
          <Sparkline
            values={series}
            color={color}
            height={28}
            strokeWidth={1.8}
            accessibilityLabel={label}
          />
        </View>
      ) : null}
    </View>
  );
}

export interface ShareSegment {
  key: string;
  label: string;
  seconds: number;
  share: number;
  color: string;
}

export function ShareBar({
  segments,
  accessibilityLabel,
  locale,
}: {
  segments: ShareSegment[];
  accessibilityLabel: string;
  locale: string;
}) {
  const themedStyles = useThemeStyles(styles);
  const visible = segments.filter((segment) => segment.share > 0);

  return (
    <View style={themedStyles.shareBlock}>
      <View
        style={themedStyles.shareTrack}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      >
        {visible.map((segment) => (
          <View
            key={segment.key}
            style={{ width: `${Math.max(2, segment.share * 100)}%`, backgroundColor: segment.color }}
          />
        ))}
      </View>
      <View style={themedStyles.legend}>
        {segments.map((segment) => (
          <View key={segment.key} style={themedStyles.legendRow}>
            <View style={[themedStyles.swatch, { backgroundColor: segment.color }]} />
            <Text style={themedStyles.legendLabel} numberOfLines={1}>{segment.label}</Text>
            <Text style={themedStyles.legendValue}>
              {formatWatchTime(segment.seconds, locale)} · {formatPercent(segment.share, locale)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ShareRow({
  name,
  seconds,
  share,
  locale,
  color,
  badge,
}: {
  name: string;
  seconds: number;
  share: number;
  locale: string;
  color: string;
  badge?: string;
}) {
  const themedStyles = useThemeStyles(styles);
  return (
    <View style={themedStyles.shareRow}>
      <View style={themedStyles.shareRowTop}>
        <View style={themedStyles.shareNameWrap}>
          <Text style={themedStyles.shareName} numberOfLines={1}>{name}</Text>
          {badge ? <Text style={themedStyles.badge}>{badge}</Text> : null}
        </View>
        <Text style={themedStyles.shareValue}>
          {formatWatchTime(seconds, locale)} · {formatPercent(share, locale)}
        </Text>
      </View>
      <View style={themedStyles.shareMiniTrack}>
        <View
          style={{
            width: `${Math.max(share > 0 ? 2 : 0, share * 100)}%`,
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

export function DailyBars({
  days,
  locale,
  dense = false,
  accessibilityLabel,
  height = 84,
}: {
  days: DayPoint[];
  locale: string;
  dense?: boolean;
  accessibilityLabel: string;
  height?: number;
}) {
  const themedStyles = useThemeStyles(styles);
  const { colors: theme } = useTheme();
  const max = days.reduce((peak, day) => Math.max(peak, day.seconds), 0);
  const labelFormatter = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  const dayFormatter = new Intl.DateTimeFormat(locale, { day: 'numeric' });
  const fullFormatter = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <View>
      <View
        style={[themedStyles.bars, { height }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      >
        {days.map((day, index) => {
          const ratio = max > 0 ? day.seconds / max : 0;
          const showLabel = !dense || index === 0 || index === days.length - 1 || index % 5 === 0;
          const date = new Date(day.timestamp);
          return (
            <View key={day.key} style={themedStyles.barColumn}>
              <View style={themedStyles.barWrap}>
                <View
                  style={[
                    themedStyles.bar,
                    {
                      height: day.seconds > 0 ? Math.max(4, ratio * (height - 22)) : 2,
                      backgroundColor: day.isToday
                        ? theme.accent
                        : day.seconds > 0
                          ? theme.accentLine
                          : theme.line,
                    },
                  ]}
                />
              </View>
              <Text style={[themedStyles.barLabel, day.isToday && themedStyles.barLabelToday]}>
                {showLabel ? dayFormatter.format(date) : ' '}
              </Text>
              {!dense ? (
                <Text style={themedStyles.barWeekday}>{labelFormatter.format(date)}</Text>
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={themedStyles.barsCaption}>
        <Text style={themedStyles.captionText} numberOfLines={1}>
          {fullFormatter.format(new Date(days[0]?.timestamp ?? Date.now()))}
        </Text>
        <Text style={themedStyles.captionText} numberOfLines={1}>
          {fullFormatter.format(new Date(days[days.length - 1]?.timestamp ?? Date.now()))}
        </Text>
      </View>
    </View>
  );
}

export function GoalBar({
  current,
  target,
  locale,
  currentLabel,
  goalLabel,
  reachedLabel,
  overLabel,
}: {
  current: number;
  target: number;
  locale: string;
  currentLabel: string;
  goalLabel: string;
  reachedLabel: string;
  overLabel: string;
}) {
  const themedStyles = useThemeStyles(styles);
  const { colors: theme } = useTheme();
  // `current` est en secondes, `target` en minutes : sans le ×60, la barre
  // atteignait l'objectif 60 fois trop tôt.
  const ratio = target > 0 ? current / (target * 60) : 0;
  const over = ratio > 1.0001;
  const reached = !over && ratio >= 0.9999;
  const fillColor = over ? theme.warn : reached ? theme.success : theme.accent;

  return (
    <View
      style={themedStyles.goalBlock}
      accessible
      accessibilityLabel={`${currentLabel} : ${formatWatchTime(current, locale)} ${goalLabel} ${formatWatchTime(target * 60, locale)}${over ? `, ${overLabel}` : reached ? `, ${reachedLabel}` : ''}`}
    >
      <View style={themedStyles.goalLabels}>
        <Text style={themedStyles.goalValue}>
          {formatWatchTime(current, locale)} / {formatWatchTime(target * 60, locale)}
        </Text>
        <Text style={[themedStyles.goalState, { color: fillColor }]}>
          {over ? overLabel : reached ? reachedLabel : ''}
        </Text>
      </View>
      <View style={themedStyles.goalTrack}>
        <View
          style={{
            width: `${Math.min(100, ratio * 100)}%`,
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: fillColor,
          }}
        />
      </View>
    </View>
  );
}

export function LinkButton({
  label,
  onPress,
  accessibilityLabel,
  tone = 'accent',
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  tone?: 'accent' | 'quiet';
}) {
  const themedStyles = useThemeStyles(styles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        themedStyles.linkButton,
        tone === 'quiet' && themedStyles.linkButtonQuiet,
        pressed && themedStyles.pressed,
      ]}
    >
      <Text style={[themedStyles.linkButtonText, tone === 'quiet' && themedStyles.linkButtonTextQuiet]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EmptyNote({ text }: { text: string }) {
  const themedStyles = useThemeStyles(styles);
  return <Text style={themedStyles.emptyNote}>{text}</Text>;
}

export function PrivacyNote({ text }: { text: string }) {
  const themedStyles = useThemeStyles(styles);
  return <Text style={themedStyles.privacyNote}>{text}</Text>;
}

export function LoadingBlock({ label, height = 88 }: { label: string; height?: number }) {
  const themedStyles = useThemeStyles(styles);
  return (
    <View
      style={[themedStyles.skeleton, { height }]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  headerPress: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    color: colors.textFaint,
    fontSize: fontSize.meta,
    lineHeight: 16,
  },
  cardBody: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  period: {
    flexDirection: 'row',
    padding: 3,
    gap: 3,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  periodOption: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  periodSelected: {
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentLine,
  },
  periodLabel: {
    color: colors.textMuted,
    fontSize: fontSize.meta,
    fontWeight: '600',
    textAlign: 'center',
  },
  periodLabelSelected: {
    color: colors.accentText,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 92,
    padding: spacing.md,
    gap: 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    justifyContent: 'center',
  },
  tileSparkline: {
    marginTop: spacing.xs,
  },
  tileValue: {
    color: colors.text,
    fontSize: fontSize.display,
    fontWeight: '800',
    letterSpacing: -0.7,
    fontVariant: ['tabular-nums'],
  },
  tileLabel: {
    color: colors.textMuted,
    fontSize: fontSize.meta,
    fontWeight: '600',
    lineHeight: 16,
  },
  tileComparison: {
    minHeight: 15,
    color: colors.textFaint,
    fontSize: fontSize.caption,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  shareBlock: {
    gap: spacing.md,
  },
  shareTrack: {
    height: 12,
    borderRadius: radius.pill,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
  },
  legend: {
    gap: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  legendLabel: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.label,
    fontWeight: '600',
  },
  legendValue: {
    color: colors.textMuted,
    fontSize: fontSize.meta,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  shareRow: {
    gap: 6,
  },
  shareRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shareNameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shareName: {
    flexShrink: 1,
    color: colors.text,
    fontSize: fontSize.label,
    fontWeight: '600',
  },
  shareValue: {
    color: colors.textMuted,
    fontSize: fontSize.meta,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  badge: {
    color: colors.textFaint,
    fontSize: fontSize.micro,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  shareMiniTrack: {
    height: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  barWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '78%',
    maxWidth: 26,
    borderRadius: radius.xs,
  },
  barLabel: {
    color: colors.textFaint,
    fontSize: fontSize.micro,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  barLabelToday: {
    color: colors.accentText,
    fontWeight: '800',
  },
  barWeekday: {
    color: colors.textFaint,
    fontSize: fontSize.micro,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  barsCaption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  captionText: {
    color: colors.textFaint,
    fontSize: fontSize.micro,
    fontWeight: '500',
  },
  goalBlock: {
    gap: spacing.sm,
  },
  goalLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  goalValue: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  goalState: {
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  goalTrack: {
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  linkButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  linkButtonQuiet: {
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentLine,
  },
  linkButtonText: {
    color: colors.onAccent,
    fontSize: fontSize.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  linkButtonTextQuiet: {
    color: colors.accentText,
  },
  emptyNote: {
    color: colors.textMuted,
    fontSize: fontSize.label,
    lineHeight: 18,
  },
  privacyNote: {
    color: colors.textFaint,
    fontSize: fontSize.caption,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  skeleton: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
});
