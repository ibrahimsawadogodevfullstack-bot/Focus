import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AppState, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { applyLanguage, i18nReady } from './i18n';
import ErrorBoundary, { CrashScreen } from './components/ErrorBoundary';
import TabBar from './components/TabBar';
import AddChannelSheet from './components/AddChannelSheet';
import { DEFAULT_SETTINGS, readSettings } from './services/settings';
import {
  SettingsProvider,
  useSetting,
  useSettings,
  useUpdateSettings,
} from './services/SettingsProvider';
import { ThemeProvider, useTheme } from './src/shared/theme/ThemeProvider';
import ActionSheet from './components/ActionSheet';
import CategoriesScreen from './screens/CategoriesScreen.tsx';
import CategoryDetailScreen from './screens/CategoryDetailScreen.tsx';
import CategoryEditor from './screens/CategoryEditor';
import OfflineScreen from './screens/OfflineScreen.tsx';
import OfflinePlayerScreen from './screens/OfflinePlayerScreen.tsx';
import ChannelsScreen from './screens/ChannelsScreen';
import FeedScreen from './screens/FeedScreen';
import PlayerScreen from './screens/PlayerScreen';
import SettingsScreen from './screens/SettingsScreen';
import StatsDetailScreen from './screens/StatsDetailScreen';
import StatsSettingsScreen from './screens/StatsSettingsScreen';
import YouScreen from './screens/YouScreen';
import { saveCrash } from './services/crashLog';
import {
  cancelDownload,
  getDownloadsSnapshot,
  initDownloadManager,
  moveDownloadToCategory,
  removeDownload,
} from './services/downloadManager';
import {
  deleteCategory as deleteDbCategory,
  listDownloads,
  upsertCategory,
} from './src/db';
import { loadFeed } from './services/feed';
import { resolveChannelAvatars } from './services/channelAvatars';
import { importChannels, splitChannelInput } from './services/channelImport';
import { resolveChannelInput } from './services/channelResolver';
import { FORMAT_SHORT, formatOf } from './src/domain/videoFormat';
import {
  getTracking,
  initTracking,
  subscribeTracking,
} from './services/tracking';
import {
  flushViewingStats,
  initViewingStats,
} from './services/viewingStats';
import {
  detectFormats,
  getFormats,
  initFormats,
  subscribeFormats,
} from './services/formats';
import {
  addSeenId,
  readCategories,
  readChannels,
  readSeenIds,
  writeCategories,
  writeChannels,
} from './services/storage';

const EMPTY_FEED = {
  videos: [],
  channels: [],
  savedAt: null,
  fromCache: false,
  failedChannels: [],
  error: null,
};

const TAB_ROUTES = new Set(['feed', 'channels', 'categories', 'offline', 'you']);

SplashScreen.preventAutoHideAsync().catch((error) => {
  console.warn('Could not keep the native splash screen visible.', error);
});

export default function App() {
  const [bootstrapSettings, setBootstrapSettings] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let completed = false;

    const showApp = async (settings) => {
      if (!active) return;
      try {
        await i18nReady;
        await applyLanguage(settings.language);
      } catch (error) {
        console.error('Unable to initialize the application language.', error);
      }
      try {
        // Les statistiques sont chargées avant le premier rendu : les écrans
        // n'ont jamais à attendre, et une lecture ouverte tout de suite est
        // comptée. Un échec ne bloque jamais le démarrage.
        await initViewingStats();
      } catch (error) {
        console.warn('Unable to initialize viewing statistics.', error);
      }
      if (!active) return;
      completed = true;
      setBootstrapSettings(settings);
      setReady(true);
    };

    const fallbackTimer = setTimeout(() => {
      if (!completed) showApp(DEFAULT_SETTINGS);
    }, 400);

    readSettings()
      .then((settings) => {
        clearTimeout(fallbackTimer);
        return showApp(settings);
      })
      .catch((error) => {
        console.error('Unable to load saved settings.', error);
        clearTimeout(fallbackTimer);
        return showApp(DEFAULT_SETTINGS);
      });

    return () => {
      active = false;
      clearTimeout(fallbackTimer);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch((error) => {
      console.warn('Could not hide the native splash screen.', error);
    });
  }, [ready]);

  if (!ready) return null;

  return (
    <SettingsProvider initialSettings={bootstrapSettings}>
      <SettingsThemeProvider>
        <SafeAreaProvider style={{ flex: 1 }}>
          <AppContent />
        </SafeAreaProvider>
      </SettingsThemeProvider>
    </SettingsProvider>
  );
}

function SettingsThemeProvider({ children }) {
  const mode = useSetting('theme') ?? 'system';
  return <ThemeProvider mode={mode}>{children}</ThemeProvider>;
}

function AppContent() {
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const { colors, resolved } = useTheme();
  const { t } = useTranslation();
  const [feed, setFeed] = useState(EMPTY_FEED);
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [libraryReady, setLibraryReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seenIds, setSeenIds] = useState([]);
  const [formats, setFormatsState] = useState(() => getFormats());
  const [route, setRoute] = useState({ name: 'feed' });
  const [sync, setSync] = useState({ active: false, done: 0, total: 0, percent: 0 });
  const [avatars, setAvatars] = useState({});
  const [tracking, setTracking] = useState(getTracking());
  const [crash, setCrash] = useState(null);
  const [addChannelVisible, setAddChannelVisible] = useState(false);
  const [categoryDeletePrompt, setCategoryDeletePrompt] = useState(null);
  const routeRef = useRef(route);
  routeRef.current = route;

  const channelKey = useMemo(
    () => channels.map((channel) => channel.id).join(','),
    [channels],
  );

  // Erreurs JS : on les affiche au lieu de fermer l'application.
  useEffect(() => {
    const errorUtils = global.ErrorUtils;
    if (!errorUtils?.setGlobalHandler) return undefined;

    const previous = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error) => {
      saveCrash(error, 'global');
      setCrash({ error });
    });

    return () => {
      if (previous) errorUtils.setGlobalHandler(previous);
    };
  }, []);

  // Suivi de lecture : temps effectif, progression, révisions.
  useEffect(() => {
    let active = true;
    initTracking().then((value) => {
      if (active) setTracking(value);
    });
    const unsubscribe = subscribeTracking((value) => setTracking(value));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Statistiques de visionnage : écriture immédiate dès que l'application
  // passe en arrière-plan, pour ne rien perdre si elle est fermée ensuite.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flushViewingStats();
    });
    return () => subscription.remove();
  }, []);

  // Bibliothèque locale : chaînes et catégories personnalisées.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [
        storedChannels,
        storedCategories,
        seen,
      ] = await Promise.all([
        readChannels(),
        readCategories(),
        readSeenIds(),
      ]);
      if (cancelled) return;
      setChannels(storedChannels);
      setCategories(storedCategories);
      setSeenIds(seen);
      setLibraryReady(true);
      initDownloadManager(storedCategories.map((c) => ({ id: c.id, name: c.name }))).catch((e) =>
        console.warn('download manager init failed', e),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Avatars des chaînes : cache local d'abord, puis récupération progressive.
  // En économie de données, aucune requête d'avatar n'est lancée : les
  // initiales suffisent et le réglage change donc vraiment quelque chose.
  useEffect(() => {
    if (!libraryReady) return undefined;
    if (settings.dataSaver) {
      setAvatars({});
      return undefined;
    }
    const ids = channelKey ? channelKey.split(',') : [];
    if (ids.length === 0) {
      setAvatars({});
      return undefined;
    }

    let active = true;
    resolveChannelAvatars(ids, {
      onResolved: (found) => {
        if (active) setAvatars((current) => ({ ...current, ...found }));
      },
    });

    return () => {
      active = false;
    };
  }, [libraryReady, channelKey, settings.dataSaver]);

  // Formats réels (vertical / horizontal) : cache local, puis sondes réseau.
  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeFormats((next) => {
      if (active) setFormatsState(next);
    });

    initFormats().then((known) => {
      if (active) setFormatsState({ ...known });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Chaque flux chargé est passé à la sonde : les Shorts non tagués rejoignent
  // leur rangée dès que leur orientation est connue.
  useEffect(() => {
    if (feed.videos.length === 0) return;
    detectFormats(feed.videos);
  }, [feed.videos]);

  const applyFeed = useCallback((result) => {
    setFeed({
      videos: result.videos ?? [],
      channels: result.channels ?? [],
      savedAt: result.savedAt ?? null,
      fromCache: Boolean(result.fromCache),
      failedChannels: result.failedChannels ?? [],
      error: result.error ?? null,
    });

    // Les titres officiels remplacent les libellés provisoires.
    if (result.channels?.length) {
      setChannels((current) => {
        const titles = new Map(result.channels.map((channel) => [channel.id, channel.title]));
        let changed = false;
        const next = current.map((channel) => {
          const title = titles.get(channel.id);
          if (title && title !== channel.title) {
            changed = true;
            return { ...channel, title };
          }
          return channel;
        });
        if (!changed) return current;
        writeChannels(next);
        return next;
      });
    }
  }, []);

  const runLoad = useCallback(
    async ({ force = false } = {}) => {
      const ids = channelKey ? channelKey.split(',') : [];

      if (ids.length === 0) {
        setFeed({ ...EMPTY_FEED, savedAt: Date.now() });
        setLoading(false);
        setSync({ active: false, done: 0, total: 0, percent: 100 });
        return;
      }

      setSync({ active: true, done: 0, total: ids.length, percent: 0 });

      try {
        const result = await loadFeed({
          channelIds: ids,
          force,
          onCached: applyFeed,
          onProgress: ({ done, total, percent }) =>
            setSync({ active: true, done, total, percent }),
        });
        applyFeed(result);
        setSync({ active: false, done: ids.length, total: ids.length, percent: 100 });
      } catch (error) {
        setFeed((current) => ({
          ...current,
          error: error?.message ?? 'Impossible de charger le flux.',
        }));
        setSync((current) => ({ ...current, active: false, percent: 0 }));
      }
    },
    [applyFeed, channelKey],
  );

  useEffect(() => {
    if (!libraryReady) return;

    let cancelled = false;
    (async () => {
      await runLoad();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [libraryReady, runLoad]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const current = routeRef.current;
      if (current.name === 'player') {
        setRoute({ name: 'feed' });
        return true;
      }
      if (current.name === 'editor') {
        setRoute({ name: 'categories' });
        return true;
      }
      if (current.name === 'settings' || current.name === 'statsDetail') {
        setRoute({ name: 'you' });
        return true;
      }
      if (current.name === 'statsSettings') {
        setRoute(current.returnTo ?? { name: 'you' });
        return true;
      }
      if (current.name !== 'feed') {
        setRoute({ name: 'feed' });
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await runLoad({ force: true });
    setRefreshing(false);
  }, [runLoad]);

  const handleDownloadVideo = useCallback(
    async (video, categoryId = activeCategoryId) => {
      const videoId = video?.videoId;
      if (!videoId || !categoryId || categoryId === 'all') {
        Alert.alert(t('offline:downloadFailed'), t('offline:downloadFailedMessage'));
        return;
      }
      const existing = getDownloadsSnapshot().find(
        (download) => download.videoId === videoId && download.categoryId === categoryId,
      );
      if (existing) return;
      try {
        const { Ytdlp } = await import('./modules/ytdlp');
        if (!Ytdlp) throw new Error(t('downloads:errorPlatform'));
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const meta = await Ytdlp.getMetadata(url);
        await (await import('./services/downloadManager')).enqueueDownload({
          url,
          categoryId,
          format: 'video',
          quality: '720p',
          metadata: {
            videoId: meta.videoId || videoId,
            title: meta.title || video.title || 'Vidéo',
            channelName: meta.channelName || video.channelTitle || '',
            durationSec: meta.durationSec || 0,
            thumbnailUrl: meta.thumbnailUrl || '',
          },
        });
      } catch (error) {
        Alert.alert(
          t('offline:downloadFailed'),
          error?.message || t('downloads:downloadFailed'),
        );
      }
    },
    [t, activeCategoryId],
  );

  const handleOpenTab = useCallback((name) => {
    setCrash(null);
    setRoute({ name });
  }, []);

  const handleOpen = useCallback((video, queue) => {
    const index = Math.max(0, queue.findIndex((item) => item.videoId === video.videoId));
    setRoute({ name: 'player', queue, index });
  }, []);

  const handleOpenDownloaded = useCallback((video) => {
    const download = getDownloadsSnapshot().find((entry) => entry.id === video.downloadId);
    if (download) setRoute({ name: 'offlinePlayer', download });
  }, []);

  const handleVideoChange = useCallback((video) => {
    addSeenId(video.videoId).then((seen) => setSeenIds(seen));
  }, []);

  const feedVideos = settings.hideShorts
    ? feed.videos.filter((video) => formatOf(video, formats) !== FORMAT_SHORT)
    : feed.videos;

  const handleToggleAutoplay = useCallback(() => {
    updateSettings({ autoplayNext: !settings.autoplayNext });
  }, [settings.autoplayNext, updateSettings]);

  // Import groupé : une seule écriture pour tout le lot, même si l'utilisateur
  // colle vingt liens d'un coup. Les entrées déjà suivies sont classées comme
  // doublons au lieu de faire échouer tout l'import.
  const handleAddSources = useCallback(
    async (input, options = {}) => {
      const entries = splitChannelInput(input);
      const report = await importChannels(entries, {
        resolve: resolveChannelInput,
        existingIds: channels.map((channel) => channel.id),
        onProgress: options.onProgress,
        isCancelled: options.isCancelled,
      });

      if (report.added.length > 0) {
        const next = [...channels, ...report.added];
        setChannels(next);
        await writeChannels(next);
      }

      return report;
    },
    [channels],
  );

  const handleRemoveChannel = useCallback(
    async (channelId) => {
      const nextChannels = channels.filter((channel) => channel.id !== channelId);
      setChannels(nextChannels);
      await writeChannels(nextChannels);

      // La catégorie est conservée même si elle devient vide : elle a été créée
      // volontairement et peut être complétée plus tard. La supprimer en douce
      // faisait perdre du travail sans prévenir.
      const nextCategories = categories.map((category) => ({
        ...category,
        channelIds: category.channelIds.filter((id) => id !== channelId),
      }));

      const categoriesChanged = nextCategories.some(
        (category, index) => category.channelIds.length !== categories[index].channelIds.length,
      );

      if (categoriesChanged) {
        setCategories(nextCategories);
        await writeCategories(nextCategories);
      }

      if (
        activeCategoryId &&
        !nextCategories.some((category) => category.id === activeCategoryId)
      ) {
        setActiveCategoryId(null);
      }

    },
    [activeCategoryId, categories, channels],
  );

  const handleSaveCategory = useCallback(
    async ({ id, name, channelIds }) => {
      try {
        const category = {
          id: id ?? `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: String(name ?? '').trim(),
          channelIds: Array.isArray(channelIds) ? channelIds : [],
        };
        if (!category.name) throw new Error('Nom de catégorie vide');

        const next = id
          ? categories.map((entry) => (entry.id === id ? category : entry))
          : [...categories, category];

        setCategories(next);
        await writeCategories(next);
        await upsertCategory(category.id, category.name);

        if (!id) setActiveCategoryId(category.id);
        setRoute({ name: 'categories' });
      } catch (error) {
        console.error('handleSaveCategory failed', error);
        throw error;
      }
    },
    [categories],
  );

  const finalizeDeleteCategory = useCallback(
    async (categoryId) => {
      const next = categories.filter((category) => category.id !== categoryId);
      setCategories(next);
      await writeCategories(next);
      await deleteDbCategory(categoryId);
      if (activeCategoryId === categoryId) setActiveCategoryId(null);
      setRoute({ name: 'categories' });
    },
    [activeCategoryId, categories],
  );

  const handleDeleteCategory = useCallback(async (categoryId) => {
    const records = (await listDownloads()).filter((download) => download.categoryId === categoryId);
    if (records.length === 0) {
      await finalizeDeleteCategory(categoryId);
      return;
    }
    setCategoryDeletePrompt({ categoryId, records, mode: 'decision' });
  }, [finalizeDeleteCategory]);

  const resolveCategoryDelete = useCallback(async (targetCategoryId = null) => {
    if (!categoryDeletePrompt) return;
    const { categoryId, records } = categoryDeletePrompt;
    try {
      if (targetCategoryId) {
        for (const download of records) {
          if (download.status === 'queued' || download.status === 'downloading') {
            await cancelDownload(download.id);
          }
          await moveDownloadToCategory(download.id, targetCategoryId);
        }
      } else {
        for (const download of records) {
          if (download.status === 'queued' || download.status === 'downloading') {
            await cancelDownload(download.id);
          }
          await removeDownload(download.id);
        }
      }
      setCategoryDeletePrompt(null);
      await finalizeDeleteCategory(categoryId);
    } catch (error) {
      Alert.alert(t('categories:deleteError'), error?.message ?? '');
    }
  }, [categoryDeletePrompt, finalizeDeleteCategory, t]);

  const showTabBar = TAB_ROUTES.has(route.name);
  const activeTab = ['channels', 'categories', 'editor', 'categoryDetail'].includes(route.name)
    ? 'categories'
    : route.name;

  let screen = null;

  if (route.name === 'feed') {
    screen = (
      <FeedScreen
        videos={feedVideos}
        formats={formats}
        channels={channels}
        categories={categories}
        activeCategoryId={activeCategoryId}
        onSelectCategory={setActiveCategoryId}
        onOpenCategories={() => setRoute({ name: 'categories' })}
        onCreateCategory={() => setRoute({ name: 'editor', category: null })}
        onOpenChannels={() => setRoute({ name: 'channels' })}
        onOpenProfile={() => setRoute({ name: 'you' })}
        trackingVideos={tracking.videos}
        onRemoveChannel={handleRemoveChannel}
        seenIds={seenIds}
        avatars={avatars}
        loading={loading}
        refreshing={refreshing}
        sync={sync}
        error={feed.error}
        fromCache={feed.fromCache}
        savedAt={feed.savedAt}
        failedChannels={feed.failedChannels}
        shortsPosition={settings.shortsPosition}
        dataSaver={settings.dataSaver}
        onRefresh={handleRefresh}
        onOpen={handleOpen}
        onDownload={activeCategoryId && activeCategoryId !== 'all' ? handleDownloadVideo : undefined}
      />
    );
  } else if (route.name === 'channels') {
    screen = (
      <ChannelsScreen
        channels={channels}
        avatars={avatars}
        onAddSources={handleAddSources}
        onRemoveChannel={handleRemoveChannel}
      />
    );
  } else if (route.name === 'you') {
    screen = (
      <YouScreen
        categories={categories}
        onOpenSettings={() => setRoute({ name: 'settings' })}
        onOpenStats={(section) => setRoute({ name: 'statsDetail', section: section ?? null })}
        onOpenStatsSettings={() =>
          setRoute({ name: 'statsSettings', returnTo: { name: 'you' } })
        }
      />
    );
  } else if (route.name === 'settings') {
    screen = (
      <SettingsScreen
        backLabel={t('tabs:you')}
        onBack={() => setRoute({ name: 'you' })}
        onOpenStatsSettings={() =>
          setRoute({ name: 'statsSettings', returnTo: { name: 'settings' } })
        }
      />
    );
  } else if (route.name === 'statsDetail') {
    screen = (
      <StatsDetailScreen
        categories={categories}
        initialSection={route.section ?? null}
        onBack={() => setRoute({ name: 'you' })}
      />
    );
  } else if (route.name === 'statsSettings') {
    screen = (
      <StatsSettingsScreen
        backLabel={route.returnTo?.name === 'settings' ? t('settings:title') : t('tabs:you')}
        onBack={() => setRoute(route.returnTo ?? { name: 'you' })}
      />
    );
  } else if (route.name === 'offline') {
    screen = (
      <OfflineScreen
        categories={categories}
        onOpenCategories={() => setRoute({ name: 'categories' })}
        onOpenDownload={handleOpenDownloaded}
      />
    );
  } else if (route.name === 'categories') {
    screen = (
      <ErrorBoundary>
        <CategoriesScreen
          categories={categories ?? []}
          onCreate={() => setRoute({ name: 'editor', category: null })}
          onEdit={(category) => setRoute({ name: 'editor', category })}
          onDelete={(category) => {
            handleDeleteCategory(category.id);
          }}
          onOpenCategory={(id) => {
            const c = (categories ?? []).find((x) => x.id === id);
            setRoute({ name: 'categoryDetail', categoryId: id, categoryName: c?.name ?? '' });
          }}
        />
      </ErrorBoundary>
    );
  } else if (route.name === 'categoryDetail') {
    screen = (
      <CategoryDetailScreen
        categoryId={route.categoryId}
        categoryName={route.categoryName}
        categories={categories}
        videos={feedVideos}
        formats={formats}
        channels={channels}
        seenIds={seenIds}
        avatars={avatars}
        trackingVideos={tracking.videos}
        dataSaver={settings.dataSaver}
        onOpen={handleOpen}
        onDownload={handleDownloadVideo}
        onBack={() => setRoute({ name: 'categories' })}
      />
    );
  } else if (route.name === 'offlinePlayer') {
    screen = (
      <OfflinePlayerScreen
        download={route.download}
        categories={categories}
        onBack={() => setRoute({ name: 'offline' })}
      />
    );
  } else if (route.name === 'editor') {
    screen = (
      <ErrorBoundary>
        <CategoryEditor
          category={route.category}
          channels={channels}
          categories={categories}
          avatars={avatars}
          onSave={handleSaveCategory}
          onDelete={handleDeleteCategory}
          onClose={() => setRoute({ name: 'categories' })}
        />
      </ErrorBoundary>
    );
  } else {
    screen = (
      <PlayerScreen
        queue={route.queue}
        initialIndex={route.index}
        avatars={avatars}
        formats={formats}
        categories={categories}
        autoplayNext={settings.autoplayNext}
        playbackSpeed={settings.playbackSpeed}
        subtitles={settings.subtitles}
        dataSaver={settings.dataSaver}
        onToggleAutoplay={handleToggleAutoplay}
        backLabel={t('tabs:feed')}
        onBack={() => setRoute({ name: 'feed' })}
        onVideoChange={handleVideoChange}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.body}>
        {crash ? (
          <CrashScreen
            error={crash.error}
            onRetry={() => {
              setCrash(null);
              setRoute({ name: 'feed' });
            }}
          />
        ) : (
          <ErrorBoundary key={route.name} onReset={() => setRoute({ name: 'feed' })}>
            {screen}
          </ErrorBoundary>
        )}
      </View>
      {showTabBar ? (
        <TabBar
          active={activeTab}
          onChange={handleOpenTab}
          onCenterPress={() => {
            setCrash(null);
            setAddChannelVisible(true);
          }}
        />
      ) : null}
      {addChannelVisible ? (
        <AddChannelSheet
          onClose={() => setAddChannelVisible(false)}
          onSubmit={handleAddSources}
        />
      ) : null}
      <ActionSheet
        visible={categoryDeletePrompt?.mode === 'decision'}
        title={t('categories:deleteDownloadsTitle')}
        message={t('categories:deleteDownloadsMessage', {
          count: categoryDeletePrompt?.records.length ?? 0,
        })}
        actions={[
          ...(categories.some((category) => category.id !== categoryDeletePrompt?.categoryId)
            ? [{
                key: 'move-downloads',
                label: t('categories:moveDownloads'),
                hint: t('categories:moveDownloadsHint'),
                onPress: () => setCategoryDeletePrompt((current) => ({ ...current, mode: 'move' })),
              }]
            : []),
          {
            key: 'delete-downloads',
            label: t('categories:deleteDownloads'),
            hint: t('categories:deleteDownloadsHint'),
            destructive: true,
            onPress: () => resolveCategoryDelete(),
          },
        ]}
        onClose={() => setCategoryDeletePrompt(null)}
      />
      <ActionSheet
        visible={categoryDeletePrompt?.mode === 'move'}
        title={t('categories:moveDownloads')}
        message={t('categories:selectDestination')}
        actions={categories
          .filter((category) => category.id !== categoryDeletePrompt?.categoryId)
          .map((category) => ({
            key: category.id,
            label: category.name,
            onPress: () => resolveCategoryDelete(category.id),
          }))}
        onClose={() => setCategoryDeletePrompt((current) => ({ ...current, mode: 'decision' }))}
      />
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
});
