import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

import { colors } from './constants/theme';
import FeedScreen from './screens/FeedScreen';
import ManageScreen from './screens/ManageScreen';
import PlayerScreen from './screens/PlayerScreen';
import { loadFeed } from './services/feed';
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

export default function App() {
  const [feed, setFeed] = useState(EMPTY_FEED);
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [libraryReady, setLibraryReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seenIds, setSeenIds] = useState([]);
  const [route, setRoute] = useState({ name: 'feed' });
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
      const [storedChannels, storedCategories, seen] = await Promise.all([
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
      if (routeRef.current.name !== 'feed') {
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

  const handleOpen = useCallback((video, queue) => {
    const index = Math.max(0, queue.findIndex((item) => item.videoId === video.videoId));
    setRoute({ name: 'player', queue, index });
  }, []);

  const handleVideoChange = useCallback((video) => {
    addSeenId(video.videoId).then((seen) => setSeenIds(seen));
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
    },
    [categories],
  );

  const handleDeleteCategory = useCallback(
    async (categoryId) => {
      const next = categories.filter((category) => category.id !== categoryId);
      setCategories(next);
      await writeCategories(next);

      if (activeCategoryId === categoryId) setActiveCategoryId(null);
    },
    [activeCategoryId, categories],
  );

  return (
    <>
      {route.name === 'feed' ? (
        <FeedScreen
          videos={feed.videos}
          channels={channels}
          categories={categories}
          activeCategoryId={activeCategoryId}
          onSelectCategory={setActiveCategoryId}
          onManage={() => setRoute({ name: 'manage' })}
          seenIds={seenIds}
          loading={loading}
          refreshing={refreshing}
          error={feed.error}
          fromCache={feed.fromCache}
          savedAt={feed.savedAt}
          failedChannels={feed.failedChannels}
          onRefresh={handleRefresh}
          onOpen={handleOpen}
        />
      ) : route.name === 'manage' ? (
        <ManageScreen
          channels={channels}
          categories={categories}
          onBack={() => setRoute({ name: 'feed' })}
          onAddChannel={handleAddChannel}
          onRemoveChannel={handleRemoveChannel}
          onSaveCategory={handleSaveCategory}
          onDeleteCategory={handleDeleteCategory}
        />
      ) : (
        <PlayerScreen
          queue={route.queue}
          initialIndex={route.index}
          onBack={() => setRoute({ name: 'feed' })}
          onVideoChange={handleVideoChange}
        />
      )}
      <StatusBar style="light" backgroundColor={colors.background} />
    </>
  );
}
