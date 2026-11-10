import { useState } from 'react';
import { View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { buildSparkline } from '../../utils/sparkline';

interface SparklineProps {
  values: number[];
  /** Couleur de la courbe, en général un jeton `chart1..chart4`. */
  color: string;
  height?: number;
  strokeWidth?: number;
  /** Remplit légèrement l'aire sous la courbe. */
  filled?: boolean;
  accessibilityLabel: string;
}

/**
 * Micro-courbe de tendance. La largeur vient du parent (`flex: 1`) : on la
 * mesure pour dessiner en pixels réels, ce qui évite la déformation du trait
 * qu'entraînerait un `viewBox` étiré.
 */
export function Sparkline({
  values,
  color,
  height = 34,
  strokeWidth = 2,
  filled = true,
  accessibilityLabel,
}: SparklineProps) {
  const [width, setWidth] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((previous) => (previous === next ? previous : next));
  };

  const geometry = width > 0 ? buildSparkline(values, width, height) : null;

  return (
    <View
      onLayout={handleLayout}
      style={{ width: '100%', height }}
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {geometry && geometry.line ? (
        <Svg width={width} height={height}>
          {filled && geometry.area ? (
            <Path d={geometry.area} fill={color} fillOpacity={0.14} stroke="none" />
          ) : null}
          <Path
            d={geometry.line}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}
