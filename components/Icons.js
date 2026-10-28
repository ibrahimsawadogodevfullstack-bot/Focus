import { View } from 'react-native';

/**
 * Petites icônes dessinées avec des vues : aucune police externe, rendu net
 * à toutes les densités.
 */
export function SlidersIcon({ color, size = 18 }) {
  const line = { height: 1.5, backgroundColor: color, borderRadius: 1 };
  const dot = {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: color,
  };

  return (
    <View style={{ width: size, height: size, justifyContent: 'space-between', paddingVertical: 2 }}>
      <View style={{ justifyContent: 'center' }}>
        <View style={[line, { width: size }]} />
        <View style={[dot, { left: size * 0.18 }]} />
      </View>
      <View style={{ justifyContent: 'center' }}>
        <View style={[line, { width: size }]} />
        <View style={[dot, { left: size * 0.58 }]} />
      </View>
      <View style={{ justifyContent: 'center' }}>
        <View style={[line, { width: size }]} />
        <View style={[dot, { left: size * 0.36 }]} />
      </View>
    </View>
  );
}

export function PlayIcon({ color = '#fff', size = 16 }) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        marginLeft: size * 0.16,
        borderTopWidth: size * 0.52,
        borderBottomWidth: size * 0.52,
        borderLeftWidth: size * 0.86,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: color,
      }}
    />
  );
}

export function PauseIcon({ color = '#fff', size = 15 }) {
  return (
    <View style={{ flexDirection: 'row', gap: size * 0.34 }}>
      <View style={{ width: size * 0.28, height: size, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: size * 0.28, height: size, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}
