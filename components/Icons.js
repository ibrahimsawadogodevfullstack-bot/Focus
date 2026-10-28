import { View } from 'react-native';

// Icônes dessinées avec des vues : géométrie nette à toutes les densités,
// aucune police ni bibliothèque d'icônes à charger.

export function GridIcon({ color, size = 20 }) {
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

export function ListIcon({ color, size = 20 }) {
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

export function FolderIcon({ color, size = 20 }) {
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

const ROTATION = {
  left: '45deg',
  right: '-135deg',
  up: '135deg',
  down: '-45deg',
};

export function Chevron({ direction = 'left', color, size = 10, thickness = 2 }) {
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

export function PlusIcon({ color, size = 16, thickness = 2 }) {
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

export function CloseIcon({ color, size = 12, thickness = 2 }) {
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

export function CheckIcon({ color = '#fff', size = 12 }) {
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

export function LockIcon({ color, size = 12 }) {
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

export function PlayIcon({ color = '#fff', size = 16 }) {  return (
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

export function PauseIcon({ color = '#fff', size = 15 }) {
  return (
    <View style={{ flexDirection: 'row', gap: size * 0.32 }}>
      <View style={{ width: size * 0.27, height: size, backgroundColor: color, borderRadius: 1.5 }} />
      <View style={{ width: size * 0.27, height: size, backgroundColor: color, borderRadius: 1.5 }} />
    </View>
  );
}
