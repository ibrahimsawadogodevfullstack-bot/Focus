import { View } from 'react-native';
import type { ViewStyle } from 'react-native';

// Icônes dessinées avec des vues : géométrie nette à toutes les densités,
// aucune police ni bibliothèque d'icônes à charger.

type IconProps = {
  color?: string;
  size?: number;
  thickness?: number;
};
type ChevronDirection = 'left' | 'right' | 'up' | 'down';
type Corners = Partial<Record<'top' | 'left' | 'right' | 'bottom', boolean>>;

export function GridIcon({ color, size = 20 }: IconProps) {
  const cell = (size - 4) / 2;
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {[0, 1, 2, 3].map((key) => (
        <View
          key={key}
          style={{ width: cell, height: cell, borderRadius: 3, backgroundColor: color }}
        />
      ))}
    </View>
  );
}

export function ListIcon({ color, size = 20 }: IconProps) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'space-between' }}>
      {[0, 1, 2].map((key) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
          <View
            style={{
              flex: 1,
              height: 2,
              borderRadius: 1,
              backgroundColor: color,
              opacity: key === 2 ? 0.55 : 1,
            }}
          />
        </View>
      ))}
    </View>
  );
}

export function FolderIcon({ color, size = 20 }: IconProps) {
  const bodyHeight = size * 0.76;
  return (
    <View style={{ width: size, height: size, justifyContent: 'flex-end' }}>
      <View
        style={{
          position: 'absolute',
          top: size * 0.12,
          left: 1,
          width: size * 0.46,
          height: size * 0.2,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: size,
          height: bodyHeight,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

const ROTATION: Record<ChevronDirection, `${number}deg`> = {
  left: '45deg',
  right: '-135deg',
  up: '135deg',
  down: '-45deg',
};

export function Chevron({
  direction = 'left',
  color,
  size = 10,
  thickness = 2,
}: IconProps & { direction?: ChevronDirection }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderLeftWidth: thickness,
        borderBottomWidth: thickness,
        borderColor: color,
        borderRadius: 1,
        transform: [{ rotate: ROTATION[direction] }],
      }}
    />
  );
}

export function PlusIcon({ color, size = 16, thickness = 2 }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: thickness,
          borderRadius: thickness,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: thickness,
          height: size,
          borderRadius: thickness,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function CloseIcon({ color, size = 12, thickness = 2 }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: thickness,
          borderRadius: thickness,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size,
          height: thickness,
          borderRadius: thickness,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </View>
  );
}

export function CheckIcon({ color = '#fff', size = 12 }: IconProps) {
  const thickness = Math.max(1.6, size * 0.15);
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.02,
          top: size * 0.56,
          width: size * 0.42,
          height: thickness,
          borderRadius: thickness,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.26,
          top: size * 0.48,
          width: size * 0.76,
          height: thickness,
          borderRadius: thickness,
          backgroundColor: color,
          transform: [{ rotate: '-48deg' }],
        }}
      />
    </View>
  );
}

export function LockIcon({ color, size = 12 }: IconProps) {
  const shackle = size * 0.6;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View
        style={{
          position: 'absolute',
          top: size * 0.02,
          width: shackle,
          height: shackle,
          borderRadius: shackle / 2,
          borderWidth: Math.max(1.2, size * 0.12),
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
      <View
        style={{
          width: size,
          height: size * 0.56,
          borderRadius: size * 0.16,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function PlayIcon({ color = '#fff', size = 16 }: IconProps) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        marginLeft: size * 0.18,
        borderTopWidth: size * 0.52,
        borderBottomWidth: size * 0.52,
        borderLeftWidth: size * 0.88,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: color,
      }}
    />
  );
}

export function PauseIcon({ color = '#fff', size = 15 }: IconProps) {
  return (
    <View style={{ flexDirection: 'row', gap: size * 0.32 }}>
      <View style={{ width: size * 0.27, height: size, backgroundColor: color, borderRadius: 1.5 }} />
      <View style={{ width: size * 0.27, height: size, backgroundColor: color, borderRadius: 1.5 }} />
    </View>
  );
}

export function SearchIcon({ color, size = 18, thickness = 2 }: IconProps) {
  const circle = Math.round(size * 0.66);
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: circle,
          height: circle,
          borderRadius: circle / 2,
          borderWidth: thickness,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: size * 0.42,
          height: thickness,
          borderRadius: thickness,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

export function MoreIcon({ color, size = 16 }: IconProps) {
  const dot = Math.max(2.5, size * 0.2);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'space-between' }}>
      {[0, 1, 2].map((key) => (
        <View
          key={key}
          style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }}
        />
      ))}
    </View>
  );
}

export function DownloadIcon({ color, size = 20, thickness = 2 }: IconProps) {
  const t = thickness;
  const apexY = size * 0.58;
  const length = size * 0.36;
  const offset = length * 0.354;

  const stroke = (left: number, top: number, rotate: string): ViewStyle => ({
    position: 'absolute',
    left,
    top,
    width: length,
    height: t,
    borderRadius: t,
    backgroundColor: color,
    transform: [{ rotate }],
  });

  return (
    <View style={{ width: size, height: size }}>
      {/* hampe */}
      <View
        style={{
          position: 'absolute',
          left: size / 2 - t / 2,
          top: size * 0.08,
          width: t,
          height: apexY - size * 0.08,
          borderRadius: t,
          backgroundColor: color,
        }}
      />
      {/* pointe de la flèche */}
      <View
        style={stroke(
          size / 2 - offset - length / 2,
          apexY - offset - t / 2,
          '45deg',
        )}
      />
      <View
        style={stroke(
          size / 2 + offset - length / 2,
          apexY - offset - t / 2,
          '-45deg',
        )}
      />
      {/* socle */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.1,
          bottom: size * 0.1,
          width: size * 0.8,
          height: t,
          borderRadius: t,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function TrashIcon({ color, size = 16, thickness = 2 }: IconProps) {
  const bodyWidth = size * 0.62;
  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          width: size * 0.34,
          height: thickness,
          borderRadius: thickness,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.16,
          width: size * 0.9,
          height: thickness,
          borderRadius: thickness,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.26,
          width: bodyWidth,
          height: size * 0.7,
          borderWidth: thickness,
          borderTopWidth: 0,
          borderColor: color,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
        }}
      />
    </View>
  );
}

export function ShortsIcon({ color, size = 18 }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.62,
          height: size * 0.88,
          borderRadius: size * 0.18,
          borderWidth: Math.max(1.4, size * 0.1),
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          marginLeft: size * 0.06,
          borderTopWidth: size * 0.14,
          borderBottomWidth: size * 0.14,
          borderLeftWidth: size * 0.22,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
        }}
      />
    </View>
  );
}

export function FullscreenIcon({ color, size = 16, thickness = 2 }: IconProps) {
  const corner = size * 0.34;
  const style = (
    top: number | undefined,
    left: number | undefined,
    right: number | undefined,
    bottom: number | undefined,
    turns: Corners,
  ): ViewStyle => ({
    position: 'absolute',
    top,
    left,
    right,
    bottom,
    width: corner,
    height: corner,
    borderColor: color,
    borderTopWidth: turns.top ? thickness : 0,
    borderLeftWidth: turns.left ? thickness : 0,
    borderRightWidth: turns.right ? thickness : 0,
    borderBottomWidth: turns.bottom ? thickness : 0,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  });

  return (
    <View style={{ width: size, height: size }}>
      <View style={style(0, 0, undefined, undefined, { top: true, left: true })} />
      <View style={style(0, undefined, 0, undefined, { top: true, right: true })} />
      <View style={style(undefined, 0, undefined, 0, { bottom: true, left: true })} />
      <View style={style(undefined, undefined, 0, 0, { bottom: true, right: true })} />
    </View>
  );
}

export function MinimizeIcon({ color, size = 16, thickness = 2 }: IconProps) {
  const arm = size * 0.34;
  const style = (
    top: number | undefined,
    left: number | undefined,
    right: number | undefined,
    bottom: number | undefined,
    turns: Corners,
  ): ViewStyle => ({
    position: 'absolute',
    top,
    left,
    right,
    bottom,
    width: arm,
    height: arm,
    borderColor: color,
    borderTopWidth: turns.top ? thickness : 0,
    borderLeftWidth: turns.left ? thickness : 0,
    borderRightWidth: turns.right ? thickness : 0,
    borderBottomWidth: turns.bottom ? thickness : 0,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  });

  return (
    <View style={{ width: size, height: size }}>
      <View style={style(0, 0, undefined, undefined, { bottom: true, right: true })} />
      <View style={style(0, undefined, 0, undefined, { bottom: true, left: true })} />
      <View style={style(undefined, 0, undefined, 0, { top: true, right: true })} />
      <View style={style(undefined, undefined, 0, 0, { top: true, left: true })} />
    </View>
  );
}

export function StatsIcon({ color, size = 20, thickness = 2.5 }: IconProps) {
  const bars = [
    { height: 0.42, offset: 0 },
    { height: 0.68, offset: 0.29 },
    { height: 1, offset: 0.58 },
  ];
  return (
    <View
      style={{
        width: size,
        height: size,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: 1,
        paddingBottom: size * 0.06,
      }}
    >
      {bars.map((bar, index) => (
        <View
          key={index}
          style={{
            width: size * 0.18,
            height: size * 0.82 * bar.height,
            borderRadius: thickness / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

export function PersonIcon({ color, size = 20 }: IconProps) {
  const stroke = Math.max(1.6, size * 0.1);
  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      <View
        style={{
          width: size * 0.34,
          height: size * 0.34,
          borderRadius: size * 0.17,
          borderWidth: stroke,
          borderColor: color,
          marginTop: size * 0.08,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.05,
          width: size * 0.72,
          height: size * 0.35,
          borderTopLeftRadius: size * 0.4,
          borderTopRightRadius: size * 0.4,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
    </View>
  );
}

/** Roue crantée : dessinée avec des vues, sans police ni image. */
export function SettingsIcon({ color, size = 20 }: IconProps) {
  const teeth = 8;
  const toothWidth = Math.max(2, size * 0.16);
  const toothHeight = Math.max(3, size * 0.3);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: teeth }).map((_, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            width: toothWidth,
            height: toothHeight,
            borderRadius: toothWidth / 3,
            backgroundColor: color,
            transform: [{ rotate: `${index * (360 / teeth)}deg` }, { translateY: -size * 0.34 }],
          }}
        />
      ))}
      <View
        style={{
          width: size * 0.62,
          height: size * 0.62,
          borderRadius: size * 0.31,
          borderWidth: Math.max(2, size * 0.13),
          borderColor: color,
          backgroundColor: 'transparent',
        }}
      />
    </View>
  );
}
