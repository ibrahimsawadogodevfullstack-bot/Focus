import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { layout } from '../src/shared/theme/tokens';
import { DownloadIcon, FolderIcon, GridIcon, PersonIcon, PlusIcon } from '../src/shared/ui/Icons';
import { useTheme } from '../src/shared/theme/ThemeProvider';

const TABS = [
  { key: 'feed', label: 'feed', Icon: GridIcon },
  { key: 'offline', label: 'offline', Icon: DownloadIcon },
  { key: 'categories', label: 'categories', Icon: FolderIcon },
  { key: 'you', label: 'you', Icon: PersonIcon },
] as const;

type TabKey = (typeof TABS)[number]['key'];

interface TabBarProps {
  active: string;
  onChange: (name: TabKey) => void;
  onCenterPress?: () => void;
}

export default function TabBar({ active, onChange, onCenterPress }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
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
      {TABS.slice(0, 2).map(({ key, label, Icon }) => {
        const selected = active === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={t(`tabs:${label}`)}
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
              {t(`tabs:${label}`)}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={onCenterPress}
        accessibilityRole="button"
        accessibilityLabel={t('categories:createCategory')}
        style={({ pressed }) => [styles.centerButton, pressed && styles.tabPressed]}
      >
        <View style={[styles.plusWrap, { backgroundColor: colors.accentText }]}>
          <PlusIcon color={colors.onAccent} size={24} />
        </View>
      </Pressable>
      {TABS.slice(2).map(({ key, label, Icon }) => {
        const selected = active === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={t(`tabs:${label}`)}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
          >
            <View style={[styles.iconWrap, selected && { backgroundColor: colors.accentSoft }]}>
              <Icon color={selected ? colors.accentText : colors.textFaint} size={20} />
            </View>
            <Text
              style={[
                styles.label,
                { color: selected ? colors.accentText : colors.textFaint },
                selected && styles.labelActive,
              ]}
            >
              {t(`tabs:${label}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingHorizontal: 8,
    width: '100%',
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    height: layout.tabBar,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 12,
  },
  centerButton: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    height: layout.tabBar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
    letterSpacing: 0,
    maxWidth: '100%',
  },
  labelActive: {
    fontWeight: '700',
  },
});
