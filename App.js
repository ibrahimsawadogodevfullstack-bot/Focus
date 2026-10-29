import * as DocumentPicker from 'expo-document-picker';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ErrorBoundary, { CrashScreen } from './components/ErrorBoundary';
import TabBar from './components/TabBar';
import { colors } from './constants/theme';
import CategoriesScreen from './screens/CategoriesScreen';
import CategoryEditor from './screens/CategoryEditor';
import CategoryStatsScreen from './screens/CategoryStatsScreen';
import ChannelsScreen from './screens/ChannelsScreen';
import FeedScreen from './screens/FeedScreen';
import LocalPlayerScreen from './screens/LocalPlayerScreen';
import OfflineScreen from './screens/OfflineScreen';
import PlayerScreen from './screens/PlayerScreen';
import StatsScreen from './screens/StatsScreen';
import {
  deleteDownload,
  readDownloads,
  saveDownload,
  writeDownloads,
} from './services/downloads';
import { saveCrash } from './services/crashLog';
import { loadFeed } from './services/feed';
import {
  deleteLocalVideo,
  importLocalVideos,
  readLocalVideos,
  updateLocalDuration,
} from './services/localVideos';
import {
  clearOffline,
  downloadOffline,
  readOffline,
  writeOffline,
} from './services/offline';
import { resolveChannelAvatars } from './services/channelAvatars';
import {
  getTracking,
  initTracking,
  subscribeTracking,
} from './services/tracking';
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

const TAB_ROUTES = new Set(['feed', 'channels', 'categories', 'offline', 'stats']);

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
  const [sync, setSync] = useState({ active: false, done: 0, total: 0, percent: 0 });
  const [downloads, setDownloads] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [localVideos, setLocalVideos] = useState([]);
  const [importingLocal, setImportingLocal] = useState(false);
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
        shorts,
        storedOffline,
        storedDownloads,
        storedLocalVideos,
      ] = await Promise.all([
        readChannels(),
        readCategories(),
        readSeenIds(),
        readShortIds(),
        readOffline(),
        readDownloads(),
        readLocalVideos(),
      ]);
      if (cancelled) return;
      setChannels(storedChannels);
      setCategories(storedCategories);
      setSeenIds(seen);
      setShortIds(shorts);
      setOffline(storedOffline);
      setDownloads(storedDownloads);
      setLocalVideos(storedLocalVideos);
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

  const applyFeed = useCallback((result) => {    setFeed({
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
        setSync({ active: false, done: 0, total: 0, percent: 100 });
        return;
      }

      setSync({ active: true, done: 0, total: ids.length, percent: 0 });

      try {
        const result = await loadFeed({
          channelIds: ids,
          force,
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
      if (current === 'localPlayer') {
        setRoute({ name: 'offline' });
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

  // Même geste que YouTube : menu « … » d'une carte puis « Télécharger ».
  // La fiche part tout de suite, la miniature suit : le pourcentage avance
  // pendant ce temps puis reste affiché un instant (comme YouTube).
  const handleToggleDownload = useCallback(
    async (video) => {
      const exists = downloads.some((item) => item.videoId === video.videoId);
      if (exists) {
        const next = await deleteDownload(video.videoId);
        setDownloads(next);
        return;
      }

      if (downloadProgress[video.videoId] !== undefined) return;

      setDownloadProgress((prev) => ({ ...prev, [video.videoId]: 3 }));
      const timer = setInterval(() => {
        setDownloadProgress((prev) => {
          const current = prev[video.videoId];
          if (current === undefined || current >= 88) return prev;
          const step = current < 30 ? 7 : current < 60 ? 5 : 3;
          return { ...prev, [video.videoId]: Math.min(88, current + step) };
        });
      }, 110);

      const startedAt = Date.now();
      let next = downloads;
      try {
        next = await saveDownload(video);
        // Le téléchargement d'une fiche est instantané : on garde un temps
        // visible pour que la progression soit lisible.
        const elapsed = Date.now() - startedAt;
        if (elapsed < 1000) {
          await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
        }
        setDownloads(next);
      } finally {
        clearInterval(timer);
      }

      setDownloadProgress((prev) => ({ ...prev, [video.videoId]: 100 }));
      setTimeout(() => {
        setDownloadProgress((prev) => {
          const done = { ...prev };
          delete done[video.videoId];
          return done;
        });
      }, 700);
    },
    [downloadProgress, downloads],
  );

  // Lecture hors ligne : fichiers vidéo de l'appareil (aucun téléchargement
  // YouTube : le lecteur local ne lit que ce que l'utilisateur fournit).
  const handleImportLocal = useCallback(async () => {
    if (importingLocal) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      setImportingLocal(true);
      const next = await importLocalVideos(result.assets);
      setLocalVideos(next);
    } catch {
      // Sélecteur indisponible : la liste reste inchangée.
    } finally {
      setImportingLocal(false);
    }
  }, [importingLocal]);

  const handleDeleteLocal = useCallback(async (video) => {
    const next = await deleteLocalVideo(video);
    setLocalVideos(next);
  }, []);

  const handleLocalDuration = useCallback(async (id, duration) => {
    if (!id || !duration) return;
    const next = await updateLocalDuration(id, duration);
    setLocalVideos(next);
  }, []);

  const handleOpenDownload = useCallback(
    (video) => {
      const queue = downloads.length > 0 ? downloads : [video];
      const index = Math.max(
        0,
        queue.findIndex((item) => item.videoId === video.videoId),
      );
      setRoute({ name: 'player', queue, index, from: 'offline' });
    },
    [downloads],
  );

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

      // Les téléchargements et le cache ne gardent pas la chaîne retirée.
      if (downloads.some((video) => video.channelId === channelId)) {
        const remaining = downloads.filter((video) => video.channelId !== channelId);
        setDownloads(remaining);
        await writeDownloads(remaining);
      }

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
    [activeCategoryId, categories, channels, downloads, offline],
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
        downloads={downloads}
        downloadProgress={downloadProgress}
        onToggleDownload={handleToggleDownload}
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
        hiddenShorts={feed.hiddenShorts}
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
  } else if (route.name === 'stats') {
    screen = (
      <StatsScreen
        tracking={tracking}
        categories={categories}
        videos={feedVideos}
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
        onOpenCategory={(categoryId) => setRoute({ name: 'categoryStats', categoryId })}
        onOpenCategories={() => setRoute({ name: 'categories' })}
      />
    );
  } else if (route.name === 'offline') {
    screen = (
      <OfflineScreen
        offline={offline}
        downloads={downloads}
        downloading={offlineDownloading}
        progress={offlineProgress}
        feedCount={feedVideos.length}
        onDownload={handleDownloadOffline}
        onClear={handleClearOffline}
        onOpen={handleOpen}
        onOpenDownload={handleOpenDownload}
        onRemoveDownload={handleToggleDownload}
        localVideos={localVideos}
        importing={importingLocal}
        onImportLocal={handleImportLocal}
        onOpenLocal={(video) => setRoute({ name: 'localPlayer', entry: video })}
        onDeleteLocal={handleDeleteLocal}
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
        avatars={avatars}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
        onClose={() => setRoute({ name: 'categories' })}
      />
    );
  } else if (route.name === 'localPlayer') {
    screen = (
      <LocalPlayerScreen
        entry={route.entry}
        onBack={() => setRoute({ name: 'offline' })}
        onDuration={handleLocalDuration}
      />
    );
  } else {
    screen = (
      <PlayerScreen
        queue={route.queue}
        initialIndex={route.index}
        downloads={downloads}
        avatars={avatars}
        backLabel={route.from === 'offline' ? 'Hors ligne' : 'Accueil'}
        onBack={() => setRoute({ name: route.from === 'offline' ? 'offline' : 'feed' })}
        onVideoChange={handleVideoChange}
        onToggleDownload={handleToggleDownload}
        onShortDetected={handleShortDetected}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
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
