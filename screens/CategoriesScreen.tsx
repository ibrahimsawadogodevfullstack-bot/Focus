import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import ActionSheet from '../components/ActionSheet';
import ConfirmSheet from '../src/shared/ui/ConfirmSheet';
import EmptyState from '../src/shared/ui/EmptyState';
import ScreenShell from '../src/shared/ui/ScreenShell';
import SectionLabel from '../src/shared/ui/SectionLabel';
import {
  CloseIcon,
  FolderIcon,
  MoreIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from '../src/shared/ui/Icons';
import { colors, fontSize, icon, radius, spacing } from '../src/shared/theme/tokens';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';
import { useDownloads } from '../hooks/useDownloads';
import { formatBytes } from '../services/localVideos';

/** Au-delà de ce nombre de catégories, la recherche devient utile. */
const SEARCH_THRESHOLD = 5;

type CategoryRef = { id: string; name: string };

export default function CategoriesScreen({
  categories,
  onCreate,
  onEdit,
  onOpenCategory,
  onDelete,
}: {
  categories: CategoryRef[];
  onCreate: () => void;
  onEdit: (c: any) => void;
  onOpenCategory: (id: string) => void;
  onDelete: (category: CategoryRef) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation(['categories', 'downloads', 'common']);
  const downloads = useDownloads();

  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState<{ id: string; name: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const showSearch = categories.length > SEARCH_THRESHOLD || query.length > 0;
  const term = query.trim().toLowerCase();

  const visible = useMemo(() => {
    if (!term) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(term));
  }, [categories, term]);

  const totalSize = useMemo(
    () => downloads.reduce((sum, download) => sum + (download.sizeBytes || 0), 0),
    [downloads],
  );
  const summary = categories.length > 0
    ? [
        t('categories:summaryCount', { count: categories.length }),
        totalSize > 0 ? formatBytes(totalSize) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  const statsFor = (id: string) => {
    const list = downloads.filter((d) => d.categoryId === id);
    const size = list.reduce((s, d) => s + (d.sizeBytes || 0), 0);
    return { count: list.length, size };
  };

  const closeMenu = () => setMenuFor(null);

  const actions = menuFor
    ? [
        {
          key: 'rename',
          label: t('categories:rename'),
          hint: t('categories:renameHint', { name: menuFor.name }),
          icon: <PencilIcon color={colors.text} size={16} />,
          onPress: () => {
            const target = menuFor;
            closeMenu();
            onEdit(target);
          },
        },
        {
          key: 'delete',
          label: t('categories:delete'),
          hint: t('categories:deleteHint'),
          destructive: true,
          icon: <TrashIcon color={colors.danger} size={16} />,
          onPress: () => {
            const target = menuFor;
            closeMenu();
            setPendingDelete(target);
          },
        },
      ]
    : [];

  return (
    <>
      <ScreenShell
        title={t('categories:title')}
        meta={summary}
        right={
          <Pressable
            onPress={onCreate}
            accessibilityRole="button"
            accessibilityLabel={t('categories:createCategory')}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <PlusIcon color={colors.onAccent} size={icon.md} thickness={2.2} />
          </Pressable>
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >

        {showSearch ? (
          <View style={styles.search}>
            <SearchIcon color={colors.textFaint} size={icon.sm} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('categories:searchPlaceholder')}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel={t('categories:searchPlaceholder')}
              style={styles.searchInput}
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('common:clearSearch')}
                style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
              >
                <CloseIcon color={colors.textMuted} size={icon.xs} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {categories.length === 0 ? (
          <EmptyState
            title={t('categories:emptyTitle')}
            message={t('categories:emptyMessage')}
            actionLabel={t('categories:createFirst')}
            onAction={onCreate}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title={t('categories:searchEmpty')}
            message={t('categories:searchEmptyHint')}
          />
        ) : (
          <>
            <SectionLabel style={styles.sectionTitle}>{t('categories:sectionTitle')}</SectionLabel>
            <View style={styles.group}>
              {visible.map((category, index) => {
                const { count, size } = statsFor(category.id);
                return (
                  <View key={category.id}>
                    {index > 0 ? <View style={styles.separator} /> : null}
                    <Pressable
                      onPress={() => onOpenCategory(category.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${category.name}, ${t('categories:videoCount', { count })}, ${formatBytes(size)}`}
                      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    >
                      <View style={styles.rowIcon}>
                        <FolderIcon color={colors.accent} size={20} />
                      </View>
                      <View style={styles.rowBody}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {category.name}
                        </Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {t('categories:videoCount', { count })} · {formatBytes(size)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setMenuFor({ id: category.id, name: category.name })}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('categories:menuAccessibility', { name: category.name })}
                        style={({ pressed }) => [styles.menuBtn, pressed && styles.pressed]}
                      >
                        <MoreIcon color={colors.textMuted} size={15} />
                      </Pressable>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScreenShell>

      <ActionSheet
        visible={menuFor !== null}
        title={menuFor?.name}
        message={t('categories:menuMessage')}
        actions={actions}
        onClose={closeMenu}
      />

      <ConfirmSheet
        visible={pendingDelete !== null}
        title={t('categories:deleteConfirmTitle')}
        message={t('categories:deleteConfirmMessage', { name: pendingDelete?.name ?? '' })}
        confirmLabel={t('categories:deleteCategoryButton')}
        destructive
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (target) onDelete(target);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

const baseStyles = StyleSheet.create({
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.body,
    padding: 0,
  },
  clear: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  sectionTitle: {
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  group: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
    backgroundColor: colors.line,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontSize: fontSize.body, fontWeight: '700' },
  rowMeta: { color: colors.textMuted, fontSize: fontSize.meta },
  menuBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
