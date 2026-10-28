import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

import { CHANNEL_IDS } from './constants/channels';
import { colors } from './constants/theme';
import FeedScreen from './screens/FeedScreen';
import PlayerScreen from './screens/PlayerScreen';
import { loadFeed } from './services/feed';
import { addSeenId, readSeenIds } from './services/storage';

export default function App() {
  const [feed, setFeed] = useState({
    videos: [],
    channels: [],
    savedAt: null,
    fromCache: false,
    failedChannels: [],
    error: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seenIds, setSeenIds] = useState([]);
  const [route, setRoute] = useState({ name: 'feed' });
  const routeRef = useRef(route);
  routeRef.current = route;

  const applyFeed = useCallback((result) => {
    setFeed({
      videos: result.videos ?? [],
      channels: result.channels ?? [],
      savedAt: result.savedAt ?? null,
      fromCache: Boolean(result.fromCache),
      failedChannels: result.failedChannels ?? [],
      error: result.error ?? null,
    });
  }, []);

  const runLoad = useCallback(
    async ({ force = false } = {}) => {
      try {
        const result = await loadFeed({ force });
        applyFeed(result);
      } catch (error) {
        setFeed((current) => ({
          ...current,
          error: error?.message ?? 'Impossible de charger le flux.',
        }));
      }
    },
    [applyFeed],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const seen = await readSeenIds();
      if (!cancelled) setSeenIds(seen);
      await runLoad();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [runLoad]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (routeRef.current.name === 'player') {
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

  const channels = feed.channels.length
    ? feed.channels
    : CHANNEL_IDS.map((id) => ({ id, title: '' }));

  return (
    <>
      {route.name === 'feed' ? (
        <FeedScreen
          videos={feed.videos}
          channels={channels}
          seenIds={seenIds}
          loading={loading}
          refreshing={refreshing}
          error={feed.error}
          fromCache={feed.fromCache}
          savedAt={feed.savedAt}
          onRefresh={handleRefresh}
          onOpen={handleOpen}
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
