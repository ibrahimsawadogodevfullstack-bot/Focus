import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import EmptyState from '../src/shared/ui/EmptyState';
import ScreenHeader from '../src/shared/ui/ScreenHeader';
import { colors, radius, spacing } from '../src/shared/theme/tokens';
import { useTheme, useThemeStyles } from '../src/shared/theme/ThemeProvider';
import { useDownloads } from '../hooks/useDownloads';
import { formatBytes } from '../services/localVideos';
import type { Category } from '../src/db/categories';
import type { DownloadRecord } from '../src/db/downloads';

export default function CategoriesScreen({
  categories,
  ytdlpVersion,
  onCreate,
  onEdit,
  onOpenCategory,
}: {
  categories: { id: string; name: string }[];
  ytdlpVersion?: string | null;
  onCreate: () => void;
  onEdit: (c: any) => void;
  onOpenCategory: (id: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(baseStyles);
  const { t } = useTranslation(['categories', 'downloads', 'common']);
  const downloads = useDownloads();

  const statsFor = (id: string) => {
    const list = downloads.filter((d) => d.categoryId === id);
    const size = list.reduce((s, d) => s + (d.sizeBytes || 0), 0);
    return { count: list.length, size };
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title={t('categories:title')}
          subtitle={ytdlpVersion ? `yt-dlp ${ytdlpVersion}` : undefined}
          right={
            <Pressable onPress={onCreate} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+</Text>
            </Pressable>
          }
        />
        {categories.length === 0 ? (
          <EmptyState
            title={t('categories:emptyTitle', { defaultValue: 'Aucune catégorie' })}
            message={t('categories:emptyMessage', { defaultValue: 'Crée une catégorie pour pouvoir télécharger des vidéos.' })}
            actionLabel={t('categories:create', { defaultValue: 'Créer' })}
            onAction={onCreate}
          />
        ) : (
          categories.map((cat) => {
            const { count, size } = statsFor(cat.id);
            return (
              <Pressable
                key={cat.id}
                onPress={() => onOpenCategory(cat.id)}
                style={styles.card}
              >
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{cat.name}</Text>
                  <Text style={styles.cardMeta}>
                    {count} vidéo{count > 1 ? 's' : ''} · {formatBytes(size)}
                  </Text>
                </View>
                <Pressable onPress={() => onEdit(cat)} hitSlop={8} style={styles.editBtn}>
                  <Text style={styles.editText}>✎</Text>
                </Pressable>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 56 + 12 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: colors.onAccent, fontSize: 22, fontWeight: '700' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardBody: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  editBtn: { padding: spacing.sm },
  editText: { color: colors.textMuted, fontSize: 16 },
});
