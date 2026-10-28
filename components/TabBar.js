import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout } from '../constants/theme';
import { FolderIcon, GridIcon, ListIcon } from './Icons';

const TABS = [
  { key: 'feed', label: 'Flux', Icon: GridIcon },
  { key: 'channels', label: 'Chaînes', Icon: ListIcon },
  { key: 'categories', label: 'Catégories', Icon: FolderIcon },
];

export default function TabBar({ active, onChange }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {TABS.map(({ key, label, Icon }) => {
        const selected = active === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
          >
            <View style={[styles.iconWrap, selected && styles.iconWrapActive]}>
              <Icon color={selected ? colors.accentText : colors.textFaint} size={20} />
            </View>
            <Text style={[styles.label, selected && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 6,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    height: layout.tabBar,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 12,
  },
  tabPressed: {
    opacity: 0.65,
  },
  iconWrap: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.accentSoft,
  },
  label: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  labelActive: {
    color: colors.accentText,
    fontWeight: '700',
  },
});
