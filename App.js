import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { applyLanguage, i18nReady } from './i18n';
import ErrorBoundary, { CrashScreen } from './components/ErrorBoundary';
import TabBar from './components/TabBar';
import { DEFAULT_SETTINGS, readSettings } from './services/settings';
import { SettingsProvider, useSettings, useUpdateSettings } from './services/SettingsProvider';
import { ThemeProvider, useTheme } from './services/ThemeProvider';
import CategoriesScreen from './screens/CategoriesScreen';
import CategoryEditor from './screens/CategoryEditor';
import CategoryStatsScreen from './screens/CategoryStatsScreen';
import ChannelsScreen from './screens/ChannelsScreen';
import FeedScreen from './screens/FeedScreen';
import PlayerScreen from './screens/PlayerScreen';
import StatsScreen from './screens/StatsScreen';
import YouScreen from './screens/YouScreen';
import { saveCrash } from './services/crashLog';
import { loadFeed } from './services/feed';
import { resolveChannelAvatars } from './services/channelAvatars';
import { FORMAT_SHORT, formatOf } from './services/filters';
import {
  getTracking,
  initTracking,
  resetTracking,
  subscribeTracking,
} from './services/tracking';
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

const TAB_ROUTES = new Set(['feed', 'channels', 'categories', 'stats', 'you']);

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
      <ThemeProvider>
        <SafeAreaProvider>
          <AppContent />
        </SafeAreaProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}

function AppContent() {
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const { colors, resolved } = useTheme();
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
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Avatars des chaînes : cache local d'abord, puis récupération progressive.
  useEffect(() => {
    if (!libraryReady) return undefined;
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
  }, [libraryReady, channelKey]);

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
      const current = routeRef.current.name;
      if (current === 'player') {
        setRoute({ name: 'feed' });
        return true;
      }
      if (current === 'editor') {
        setRoute({ name: 'categories' });
        return true;
      }
      if (current === 'categoryStats') {
        setRoute({ name: 'stats' });
        return true;
      }
      if (current !== 'feed') {
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

  const handleOpenTab = useCallback((name) => setRoute({ name }), []);

  const handleOpen = useCallback((video, queue) => {
    const index = Math.max(0, queue.findIndex((item) => item.videoId === video.videoId));
    setRoute({ name: 'player', queue, index });
  }, []);

  const handleVideoChange = useCallback((video) => {
    addSeenId(video.videoId).then((seen) => setSeenIds(seen));
  }, []);

  const feedVideos = settings.hideShorts
    ? feed.videos.filter((video) => formatOf(video, formats) !== FORMAT_SHORT)
    : feed.videos;

  const handleChangeGoal = useCallback(
    (goal) => {
      updateSettings({ weeklyGoal: goal });
    },
    [updateSettings],
  );

  const handleToggleAutoplay = useCallback(() => {
    updateSettings({ autoplayNext: !settings.autoplayNext });
  }, [settings.autoplayNext, updateSettings]);

  const handleResetData = useCallback(async () => {
    await resetTracking();
  }, []);

  const handleAddChannel = useCallback(
    async (channel) => {
      const next = [...channels, channel];
      setChannels(next);
      await writeChannels(next);
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
      const category = {
        id: id ?? `cat-${Date.now()}`,
        name,
        channelIds,
      };

      const next = id
        ? categories.map((entry) => (entry.id === id ? category : entry))
        : [...categories, category];

      setCategories(next);
      await writeCategories(next);

      if (!id) setActiveCategoryId(category.id);
      setRoute({ name: 'categories' });
    },
    [categories],
  );

  const handleDeleteCategory = useCallback(
    async (categoryId) => {
      const next = categories.filter((category) => category.id !== categoryId);
      setCategories(next);
      await writeCategories(next);

      if (activeCategoryId === categoryId) setActiveCategoryId(null);
      setRoute({ name: 'categories' });
    },
    [activeCategoryId, categories],
  );

  const showTabBar = TAB_ROUTES.has(route.name);

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
      />
    );
  } else if (route.name === 'channels') {
    screen = (
      <ChannelsScreen
        channels={channels}
        avatars={avatars}
        onAddChannel={handleAddChannel}
        onRemoveChannel={handleRemoveChannel}
      />
    );
  } else if (route.name === 'you') {
    screen = <YouScreen />;
  } else if (route.name === 'stats') {
    screen = (
      <StatsScreen
        tracking={tracking}
        categories={categories}
        videos={feedVideos}
        weeklyGoal={settings.weeklyGoal}
        onChangeGoal={handleChangeGoal}
        onResetData={handleResetData}
        onOpenCategory={(categoryId) =>
          setRoute({ name: 'categoryStats', categoryId })
        }
        onOpenCategories={() => setRoute({ name: 'categories' })}
      />
    );
  } else if (route.name === 'categoryStats') {
    const category = categories.find((item) => item.id === route.categoryId);
    screen = category ? (
      <CategoryStatsScreen
        category={category}
        tracking={tracking}
        categories={categories}
        videos={feedVideos}
        onBack={() => setRoute({ name: 'stats' })}
        onOpen={handleOpen}
      />
    ) : (
      <StatsScreen
        tracking={tracking}
        categories={categories}
        videos={feedVideos}
        weeklyGoal={settings.weeklyGoal}
        onChangeGoal={handleChangeGoal}
        onResetData={handleResetData}
        onOpenCategory={(categoryId) =>
          setRoute({ name: 'categoryStats', categoryId })
        }
        onOpenCategories={() => setRoute({ name: 'categories' })}
      />
    );
  } else if (route.name === 'categories') {
    screen = (
      <CategoriesScreen
        categories={categories}
        channels={channels}
        onCreate={() => setRoute({ name: 'editor', category: null })}
        onEdit={(category) => setRoute({ name: 'editor', category })}
      />
    );
  } else if (route.name === 'editor') {
    screen = (
      <CategoryEditor
        category={route.category}
        channels={channels}
        categories={categories}
        avatars={avatars}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
        onClose={() => setRoute({ name: 'categories' })}
      />
    );
  } else {
    screen = (
      <PlayerScreen
        queue={route.queue}
        initialIndex={route.index}
        avatars={avatars}
        formats={formats}
        autoplayNext={settings.autoplayNext}
        playbackSpeed={settings.playbackSpeed}
        subtitles={settings.subtitles}
        dataSaver={settings.dataSaver}
        onToggleAutoplay={handleToggleAutoplay}
        backLabel="Accueil"
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
          <ErrorBoundary onReset={() => setRoute({ name: 'feed' })}>
            {screen}
          </ErrorBoundary>
        )}
      </View>
      {showTabBar ? <TabBar active={route.name} onChange={handleOpenTab} /> : null}
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
  },
});
