import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { layout } from '../constants/theme';
import { FolderIcon, GridIcon, ListIcon, PersonIcon, StatsIcon } from './Icons';
import { useTheme } from '../services/ThemeProvider';

const TABS = [
  { key: 'feed', label: 'tabs:feed', Icon: GridIcon },
  { key: 'channels', label: 'tabs:channels', Icon: ListIcon },
  { key: 'categories', label: 'tabs:categories', Icon: FolderIcon },
  { key: 'stats', label: 'tabs:stats', Icon: StatsIcon },
  { key: 'you', label: 'tabs:you', Icon: PersonIcon },
] as const;

type TabKey = (typeof TABS)[number]['key'];

interface TabBarProps {
  active: string;
  onChange: (name: TabKey) => void;
}

export default function TabBar({ active, onChange }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('tabs');
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.bg,
          borderTopColor: colors.line,
          paddingBottom: Math.max(insets.bottom, 6),
        },
      ]}
    >
      {TABS.map(({ key, label, Icon }) => {
        const selected = active === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={t(label)}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
          >
            <View
              style={[
                styles.iconWrap,
                selected && { backgroundColor: colors.accentSoft },
              ]}
            >
              <Icon color={selected ? colors.accentText : colors.textFaint} size={20} />
            </View>
            <Text
              style={[
                styles.label,
                { color: selected ? colors.accentText : colors.textFaint },
                selected && styles.labelActive,
              ]}
            >
              {t(label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
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
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  labelActive: {
    fontWeight: '700',
  },
});
