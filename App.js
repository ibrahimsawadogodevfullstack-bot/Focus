import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import TabBar from './components/TabBar';
import { colors } from './constants/theme';
import CategoriesScreen from './screens/CategoriesScreen';
import CategoryEditor from './screens/CategoryEditor';
import ChannelsScreen from './screens/ChannelsScreen';
import FeedScreen from './screens/FeedScreen';
import OfflineScreen from './screens/OfflineScreen';
import PlayerScreen from './screens/PlayerScreen';
import { loadFeed } from './services/feed';
import {
  clearOffline,
  downloadOffline,
  readOffline,
  writeOffline,
} from './services/offline';
import {
  addSeenId,
  addShortId,
  readCategories,
  readChannels,
  readSeenIds,
  readShortIds,
  writeCategories,
  writeChannels,
} from './services/storage';

const EMPTY_FEED = {
  videos: [],
  channels: [],
  savedAt: null,
  fromCache: false,
  failedChannels: [],
  hiddenShorts: 0,
  error: null,
};

const TAB_ROUTES = new Set(['feed', 'channels', 'categories', 'offline']);

export default function App() {
  const [feed, setFeed] = useState(EMPTY_FEED);
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [libraryReady, setLibraryReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seenIds, setSeenIds] = useState([]);
  const [shortIds, setShortIds] = useState([]);
  const [route, setRoute] = useState({ name: 'feed' });
  const [offline, setOffline] = useState(null);
  const [offlineDownloading, setOfflineDownloading] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState(null);
  const routeRef = useRef(route);
  routeRef.current = route;

  const channelKey = useMemo(
    () => channels.map((channel) => channel.id).join(','),
    [channels],
  );

  // Bibliothèque locale : chaînes et catégories personnalisées.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [storedChannels, storedCategories, seen, shorts, storedOffline] =
        await Promise.all([
          readChannels(),
          readCategories(),
          readSeenIds(),
          readShortIds(),
          readOffline(),
        ]);
      if (cancelled) return;
      setChannels(storedChannels);
      setCategories(storedCategories);
      setSeenIds(seen);
      setShortIds(shorts);
      setOffline(storedOffline);
      setLibraryReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const applyFeed = useCallback((result) => {
    setFeed({
      videos: result.videos ?? [],
      channels: result.channels ?? [],
      savedAt: result.savedAt ?? null,
      fromCache: Boolean(result.fromCache),
      failedChannels: result.failedChannels ?? [],
      hiddenShorts: result.hiddenShorts ?? 0,
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
        return;
      }

      try {
        const result = await loadFeed({ channelIds: ids, force });
        applyFeed(result);
      } catch (error) {
        setFeed((current) => ({
          ...current,
          error: error?.message ?? 'Impossible de charger le flux.',
        }));
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

  const handleShortDetected = useCallback((videoId) => {
    addShortId(videoId).then((ids) => setShortIds(ids));
  }, []);

  // Les formats courts déjà repérés ne réapparaissent pas dans le flux.
  const feedVideos = useMemo(() => {
    if (shortIds.length === 0) return feed.videos;
    const hidden = new Set(shortIds);
    return feed.videos.filter((video) => !hidden.has(video.videoId));
  }, [feed.videos, shortIds]);

  const handleDownloadOffline = useCallback(async () => {
    if (offlineDownloading || feedVideos.length === 0) return;

    setOfflineDownloading(true);
    setOfflineProgress({ done: 0, total: feedVideos.length, failed: 0 });
    // La liste apparaît tout de suite ; les miniatures arrivent au fil de l'eau.
    setOffline({ savedAt: Date.now(), videos: feedVideos, thumbs: 0, failed: 0 });
    try {
      const snapshot = await downloadOffline(feedVideos, setOfflineProgress);
      setOffline(snapshot);
    } catch {
      // L'écran garde l'état précédent : rien n'est perdu.
    } finally {
      setOfflineDownloading(false);
      setOfflineProgress(null);
    }
  }, [feedVideos, offlineDownloading]);

  const handleClearOffline = useCallback(async () => {
    setOffline(null);
    await clearOffline();
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

      const nextCategories = categories
        .map((category) => ({
          ...category,
          channelIds: category.channelIds.filter((id) => id !== channelId),
        }))
        .filter((category) => category.channelIds.length > 0);

      if (nextCategories.length !== categories.length) {
        setCategories(nextCategories);
        await writeCategories(nextCategories);
      }

      if (
        activeCategoryId &&
        !nextCategories.some((category) => category.id === activeCategoryId)
      ) {
        setActiveCategoryId(null);
      }

      // Le cache hors ligne ne garde pas les vidéos de la chaîne retirée.
      if (offline?.videos?.length) {
        const remaining = offline.videos.filter((video) => video.channelId !== channelId);
        if (remaining.length !== offline.videos.length) {
          const snapshot = {
            ...offline,
            videos: remaining,
            thumbs: Math.min(offline.thumbs ?? 0, remaining.length),
          };
          setOffline(snapshot);
          await writeOffline(snapshot);
        }
      }
    },
    [activeCategoryId, categories, channels, offline],
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
        channels={channels}
        categories={categories}
        activeCategoryId={activeCategoryId}
        onSelectCategory={setActiveCategoryId}
        onOpenCategories={() => setRoute({ name: 'categories' })}
        onOpenLibrary={() => setRoute({ name: 'channels' })}
        onRemoveChannel={handleRemoveChannel}
        seenIds={seenIds}
        loading={loading}
        refreshing={refreshing}
        error={feed.error}
        fromCache={feed.fromCache}
        savedAt={feed.savedAt}
        failedChannels={feed.failedChannels}
        hiddenShorts={feed.hiddenShorts}
        onRefresh={handleRefresh}
        onOpen={handleOpen}
      />
    );
  } else if (route.name === 'channels') {
    screen = (
      <ChannelsScreen
        channels={channels}
        onAddChannel={handleAddChannel}
        onRemoveChannel={handleRemoveChannel}
      />
    );
  } else if (route.name === 'offline') {
    screen = (
      <OfflineScreen
        offline={offline}
        downloading={offlineDownloading}
        progress={offlineProgress}
        feedCount={feedVideos.length}
        onDownload={handleDownloadOffline}
        onClear={handleClearOffline}
        onOpen={handleOpen}
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
        onBack={() => setRoute({ name: 'feed' })}
        onVideoChange={handleVideoChange}
        onShortDetected={handleShortDetected}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <View style={styles.body}>{screen}</View>
        {showTabBar ? <TabBar active={route.name} onChange={handleOpenTab} /> : null}
        <StatusBar style="light" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
  },
});
