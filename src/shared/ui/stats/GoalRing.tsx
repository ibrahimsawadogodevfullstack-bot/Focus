import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { formatWatchTime } from '../../../../services/viewingSummary';
import { fontSize } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';

interface GoalRingProps {
  /** Secondes déjà regardées aujourd'hui. */
  current: number;
  /** Objectif du jour, en minutes (0 = pas d'objectif). */
  target: number;
  locale: string;
  currentLabel: string;
  goalLabel: string;
  reachedLabel: string;
  overLabel: string;
  /** Petit libellé au centre, sous le pourcentage. */
  centerLabel?: string;
  size?: number;
  strokeWidth?: number;
}

/**
 * Anneau de progression de l'objectif du jour.
 *
 * Équivalent circulaire de `GoalBar`, avec la même sémantique de couleurs
 * (accent → succès → dépassement) et le même libellé d'accessibilité.
 */
export function GoalRing({
  current,
  target,
  locale,
  currentLabel,
  goalLabel,
  reachedLabel,
  overLabel,
  centerLabel,
  size = 132,
  strokeWidth = 11,
}: GoalRingProps) {
  const { colors: theme } = useTheme();

  // `target` est en minutes, `current` en secondes.
  const goalSeconds = Math.max(0, target) * 60;
  const ratio = goalSeconds > 0 ? Math.max(0, current) / goalSeconds : 0;
  const over = ratio > 1.0001;
  const reached = !over && ratio >= 0.9999;
  const color = over ? theme.warn : reached ? theme.success : theme.accent;

  const center = size / 2;
  const radius = Math.max(0, (size - strokeWidth) / 2);
  const circumference = 2 * Math.PI * radius;
  const arc = circumference * Math.min(1, ratio);
  const percent = Math.round(ratio * 100);

  return (
    <View
      style={styles.wrapper}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.min(100, percent) }}
      accessibilityLabel={`${currentLabel} : ${formatWatchTime(current, locale)} ${goalLabel} ${formatWatchTime(goalSeconds, locale)}${over ? `, ${overLabel}` : reached ? `, ${reachedLabel}` : ''}`}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={theme.line}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <G rotation={-90} originX={center} originY={center}>
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference - arc}
              strokeLinecap="round"
            />
          </G>
        </Svg>

        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.percent, { color }]} numberOfLines={1}>
            {percent} %
          </Text>
          {centerLabel ? (
            <Text style={[styles.centerLabel, { color: theme.textMuted }]} numberOfLines={1}>
              {centerLabel}
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={[styles.time, { color: theme.text }]} numberOfLines={1}>
        {formatWatchTime(current, locale)} / {formatWatchTime(goalSeconds, locale)}
      </Text>
      {over || reached ? (
        <Text style={[styles.state, { color }]} numberOfLines={1}>
          {over ? overLabel : reachedLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 2,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  percent: {
    fontSize: fontSize.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  centerLabel: {
    fontSize: fontSize.micro,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  time: {
    marginTop: 6,
    fontSize: fontSize.label,
    fontWeight: '600',
  },
  state: {
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
});
