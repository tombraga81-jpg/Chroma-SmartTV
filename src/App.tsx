/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu, Plus } from 'lucide-react';
import {
  DEMO_LIBRARY,
  DEMO_PLAYLIST_ID,
  DEMO_PLAYLIST_SOURCE,
  INITIAL_CONTINUE_WATCHING,
} from './data/demoCatalog';
import type {
  ActivePlayback,
  ContinueWatchingItem,
  MovieItem,
  NavSection,
  PlayerSettings,
  PlaylistLibrary,
  PlaylistSource,
  SeriesItem,
} from './types/iptv';
import { parseM3UContent } from './utils/m3uParser';
import { connectXtreamPlaylist, fetchXtreamSeriesDetails } from './utils/xtreamClient';
import { exitTizenApp, isTizenEnvironment, useTizenNavigation } from './utils/tizenTv';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { SearchView } from './components/SearchView';
import { LiveTvView } from './components/LiveTvView';
import { MoviesView } from './components/MoviesView';
import { SeriesView } from './components/SeriesView';
import { SettingsView } from './components/SettingsView';
import { SeriesModal } from './components/SeriesModal';
import { MovieModal } from './components/MovieModal';
import { AddPlaylistModal } from './components/AddPlaylistModal';
import { VideoPlayerModal } from './components/VideoPlayerModal';

const STORAGE_KEYS = {
  playlists: 'cromatv_playlists_v1',
  activeId: 'cromatv_active_playlist_v1',
  libraries: 'cromatv_libraries_v1',
  continueWatching: 'cromatv_cw_v1',
  favorites: 'cromatv_favorites_v1',
  recentChannels: 'cromatv_recent_channels_v1',
  settings: 'cromatv_settings_v1',
};

const DEFAULT_SETTINGS: PlayerSettings = {
  useCorsProxy: !isTizenEnvironment(),
  autoPlayNext: true,
  defaultVolume: 0.9,
  preferredQuality: 'auto',
};

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors for very large playlists
  }
}

const SECTION_TITLES: Record<NavSection, string> = {
  search: 'Buscar',
  home: 'Início',
  live: 'Canais de TV',
  movies: 'Filmes',
  series: 'Séries',
  settings: 'Configurações',
};

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [playlists, setPlaylists] = useState<PlaylistSource[]>(() => {
    const saved = safeReadJson<PlaylistSource[]>(STORAGE_KEYS.playlists, []);
    if (saved.length === 0) return [DEMO_PLAYLIST_SOURCE];
    const hasDemo = saved.some((p) => p.id === DEMO_PLAYLIST_ID);
    return hasDemo ? saved : [DEMO_PLAYLIST_SOURCE, ...saved];
  });

  const [activePlaylistId, setActivePlaylistId] = useState<string>(() =>
    safeReadJson<string>(STORAGE_KEYS.activeId, DEMO_PLAYLIST_ID),
  );

  const [libraries, setLibraries] = useState<Record<string, PlaylistLibrary>>(() => {
    const saved = safeReadJson<Record<string, PlaylistLibrary>>(STORAGE_KEYS.libraries, {});
    return {
      [DEMO_PLAYLIST_ID]: DEMO_LIBRARY,
      ...saved,
    };
  });

  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>(() =>
    safeReadJson<ContinueWatchingItem[]>(
      STORAGE_KEYS.continueWatching,
      INITIAL_CONTINUE_WATCHING,
    ),
  );

  const [favorites, setFavorites] = useState<string[]>(() =>
    safeReadJson<string[]>(STORAGE_KEYS.favorites, []),
  );

  const [recentChannelIds, setRecentChannelIds] = useState<string[]>(() =>
    safeReadJson<string[]>(STORAGE_KEYS.recentChannels, []),
  );

  const [settings, setSettings] = useState<PlayerSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...safeReadJson<Partial<PlayerSettings>>(STORAGE_KEYS.settings, {}),
  }));

  const [showAddPlaylistModal, setShowAddPlaylistModal] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<MovieItem | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<SeriesItem | null>(null);
  const [loadingSeriesDetails, setLoadingSeriesDetails] = useState(false);
  const [seriesDetailError, setSeriesDetailError] = useState<string | null>(null);
  const [activePlayback, setActivePlayback] = useState<ActivePlayback | null>(null);

  useEffect(() => {
    safeWriteJson(STORAGE_KEYS.playlists, playlists);
  }, [playlists]);

  useEffect(() => {
    safeWriteJson(STORAGE_KEYS.activeId, activePlaylistId);
  }, [activePlaylistId]);

  useEffect(() => {
    safeWriteJson(STORAGE_KEYS.libraries, libraries);
  }, [libraries]);

  useEffect(() => {
    safeWriteJson(STORAGE_KEYS.continueWatching, continueWatching);
  }, [continueWatching]);

  useEffect(() => {
    safeWriteJson(STORAGE_KEYS.favorites, favorites);
  }, [favorites]);

  useEffect(() => {
    safeWriteJson(STORAGE_KEYS.recentChannels, recentChannelIds);
  }, [recentChannelIds]);

  useEffect(() => {
    safeWriteJson(STORAGE_KEYS.settings, settings);
  }, [settings]);

  // Tizen TV Remote D-Pad spatial navigation & Back button (10009 / Esc)
  const handleBackNavigation = useCallback(() => {
    if (activePlayback) {
      setActivePlayback(null);
      return;
    }
    if (selectedSeries) {
      setSelectedSeries(null);
      return;
    }
    if (selectedMovie) {
      setSelectedMovie(null);
      return;
    }
    if (showAddPlaylistModal) {
      setShowAddPlaylistModal(false);
      return;
    }
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
      return;
    }
    if (activeSection !== 'home') {
      setActiveSection('home');
      return;
    }
    if (isTizenEnvironment()) {
      exitTizenApp();
    }
  }, [
    activePlayback,
    selectedSeries,
    selectedMovie,
    showAddPlaylistModal,
    mobileMenuOpen,
    activeSection,
  ]);

  useTizenNavigation({
    disabled: Boolean(activePlayback),
    onBack: handleBackNavigation,
  });

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === activePlaylistId) || playlists[0] || DEMO_PLAYLIST_SOURCE,
    [playlists, activePlaylistId],
  );

  const activeLibrary = useMemo(
    () => libraries[activePlaylist.id] || DEMO_LIBRARY,
    [libraries, activePlaylist.id],
  );

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev],
    );
  }, []);

  const handleOpenSeries = useCallback(
    async (series: SeriesItem) => {
      setSelectedSeries(series);
      setSeriesDetailError(null);

      if (
        !series.seasonsLoaded &&
        series.xtreamSeriesId &&
        activePlaylist.type === 'xtream' &&
        activePlaylist.serverUrl &&
        activePlaylist.username &&
        activePlaylist.password
      ) {
        setLoadingSeriesDetails(true);
        try {
          const updated = await fetchXtreamSeriesDetails({
            serverUrl: activePlaylist.serverUrl,
            username: activePlaylist.username,
            password: activePlaylist.password,
            seriesItem: series,
            useCorsProxy: settings.useCorsProxy,
          });
          setSelectedSeries(updated);
          setLibraries((prev) => {
            const lib = prev[activePlaylist.id];
            if (!lib) return prev;
            return {
              ...prev,
              [activePlaylist.id]: {
                ...lib,
                series: lib.series.map((s) => (s.id === updated.id ? updated : s)),
              },
            };
          });
        } catch (err) {
          setSeriesDetailError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar os episódios desta série.',
          );
        } finally {
          setLoadingSeriesDetails(false);
        }
      }
    },
    [activePlaylist, settings.useCorsProxy],
  );

  const trackChannelWatch = useCallback((channelId: string) => {
    setRecentChannelIds((prev) => [channelId, ...prev.filter((id) => id !== channelId)].slice(0, 30));
  }, []);

  const handlePlay = useCallback(
    (playback: ActivePlayback) => {
      setSelectedMovie(null);
      setSelectedSeries(null);
      if (playback.mediaType === 'channel') {
        trackChannelWatch(playback.itemId);
      }
      setActivePlayback(playback);
    },
    [trackChannelWatch],
  );

  const handleProgress = useCallback(
    (playback: ActivePlayback, currentTime: number, duration: number) => {
      if (playback.mediaType === 'channel') return;
      if (currentTime < 3) return;

      const cwId = `cw-${playback.itemId}`;
      setContinueWatching((prev) => {
        const entry: ContinueWatchingItem = {
          id: cwId,
          mediaType: playback.mediaType,
          itemId: playback.itemId,
          title: playback.title,
          subtitle: playback.subtitle,
          poster: playback.poster,
          backdrop: playback.backdrop || playback.poster,
          streamUrl: playback.streamUrl,
          progressSeconds: Math.floor(currentTime),
          durationSeconds: Math.floor(duration || 0),
          season: playback.currentSeason,
          episode: playback.currentEpisode?.episode,
          episodeId: playback.currentEpisode?.id,
          updatedAt: Date.now(),
        };
        const rest = prev.filter((item) => item.id !== cwId);
        return [entry, ...rest].slice(0, 12);
      });
    },
    [],
  );

  const handleResumeContinueWatching = useCallback(
    (item: ContinueWatchingItem) => {
      const matchedSeries =
        item.mediaType === 'series'
          ? activeLibrary.series.find((s) => s.id === item.itemId)
          : undefined;
      const matchedEpisode =
        matchedSeries && item.season && item.episodeId
          ? matchedSeries.seasons[item.season]?.find((e) => e.id === item.episodeId)
          : undefined;

      handlePlay({
        mediaType: item.mediaType,
        itemId: item.itemId,
        title: item.title,
        subtitle: item.subtitle,
        streamUrl: item.streamUrl,
        poster: item.poster,
        backdrop: item.backdrop,
        startAtSeconds: item.progressSeconds,
        seriesItem: matchedSeries,
        currentSeason: item.season,
        currentEpisode: matchedEpisode,
      });
    },
    [activeLibrary.series, handlePlay],
  );

  const handleAddM3uUrl = useCallback(
    async (name: string, url: string) => {
      let content = '';
      if (settings.useCorsProxy) {
        const res = await fetch('/api/proxy/m3u', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Falha ao baixar lista M3U.');
        content = data.content || '';
      } else {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Servidor retornou HTTP ${res.status}`);
        content = await res.text();
      }

      if (!content.includes('#EXTINF') && !content.includes('#EXTM3U')) {
        throw new Error('O conteúdo retornado não parece ser uma lista M3U válida.');
      }

      const id = `m3u-${Date.now()}`;
      const lib = parseM3UContent(content, id);
      const source: PlaylistSource = {
        id,
        name,
        type: 'm3u_url',
        url,
        addedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        status: 'Ativo',
        stats: {
          channels: lib.channels.length,
          movies: lib.movies.length,
          series: lib.series.length,
        },
      };

      setLibraries((prev) => ({ ...prev, [id]: lib }));
      setPlaylists((prev) => [...prev, source]);
      setActivePlaylistId(id);
      setActiveSection('home');
    },
    [settings.useCorsProxy],
  );

  const handleAddM3uContent = useCallback(async (name: string, content: string) => {
    if (!content.includes('#EXTINF') && !content.includes('#EXTM3U')) {
      throw new Error('Conteúdo M3U inválido. Verifique se possui tags #EXTM3U / #EXTINF.');
    }
    const id = `m3u-file-${Date.now()}`;
    const lib = parseM3UContent(content, id);
    const source: PlaylistSource = {
      id,
      name,
      type: 'm3u_file',
      addedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      status: 'Local',
      stats: {
        channels: lib.channels.length,
        movies: lib.movies.length,
        series: lib.series.length,
      },
    };
    setLibraries((prev) => ({ ...prev, [id]: lib }));
    setPlaylists((prev) => [...prev, source]);
    setActivePlaylistId(id);
    setActiveSection('home');
  }, []);

  const handleAddXtream = useCallback(
    async (params: {
      name: string;
      serverUrl: string;
      username: string;
      password: string;
    }) => {
      const id = `xtream-${Date.now()}`;
      const result = await connectXtreamPlaylist({
        playlistId: id,
        serverUrl: params.serverUrl,
        username: params.username,
        password: params.password,
        useCorsProxy: settings.useCorsProxy,
      });

      const source: PlaylistSource = {
        id,
        name: params.name,
        type: 'xtream',
        serverUrl: params.serverUrl,
        username: params.username,
        password: params.password,
        addedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        expiresAt: result.expiresAt,
        status: result.status,
        stats: {
          channels: result.library.channels.length,
          movies: result.library.movies.length,
          series: result.library.series.length,
        },
      };

      setLibraries((prev) => ({ ...prev, [id]: result.library }));
      setPlaylists((prev) => [...prev, source]);
      setActivePlaylistId(id);
      setActiveSection('home');
    },
    [settings.useCorsProxy],
  );

  const handleSyncPlaylist = useCallback(
    async (id: string) => {
      const target = playlists.find((p) => p.id === id);
      if (!target) return;

      if (target.type === 'm3u_url' && target.url) {
        const res = settings.useCorsProxy
          ? await fetch('/api/proxy/m3u', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: target.url }),
            })
          : await fetch(target.url);

        const content = settings.useCorsProxy
          ? ((await res.json()) as { content?: string; error?: string }).content || ''
          : await res.text();

        const lib = parseM3UContent(content, target.id);
        setLibraries((prev) => ({ ...prev, [target.id]: lib }));
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === target.id
              ? {
                  ...p,
                  lastSyncedAt: new Date().toISOString(),
                  stats: {
                    channels: lib.channels.length,
                    movies: lib.movies.length,
                    series: lib.series.length,
                  },
                }
              : p,
          ),
        );
      } else if (
        target.type === 'xtream' &&
        target.serverUrl &&
        target.username &&
        target.password
      ) {
        const result = await connectXtreamPlaylist({
          playlistId: target.id,
          serverUrl: target.serverUrl,
          username: target.username,
          password: target.password,
          useCorsProxy: settings.useCorsProxy,
        });
        setLibraries((prev) => ({ ...prev, [target.id]: result.library }));
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === target.id
              ? {
                  ...p,
                  lastSyncedAt: new Date().toISOString(),
                  expiresAt: result.expiresAt,
                  status: result.status,
                  stats: {
                    channels: result.library.channels.length,
                    movies: result.library.movies.length,
                    series: result.library.series.length,
                  },
                }
              : p,
          ),
        );
      }
    },
    [playlists, settings.useCorsProxy],
  );

  const handleDeletePlaylist = useCallback(
    (id: string) => {
      if (id === DEMO_PLAYLIST_ID) return;
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
      setLibraries((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (activePlaylistId === id) {
        setActivePlaylistId(DEMO_PLAYLIST_ID);
      }
    },
    [activePlaylistId],
  );

  return (
    <div className="min-h-dvh bg-[#090A0D] text-[#F4F5F7] relative overflow-x-hidden">
      {/* Floating Translucent Sidebar on Home / Search / VOD / Settings */}
      {activeSection !== 'live' && (
        <Sidebar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          playlists={playlists}
          activePlaylist={activePlaylist}
          onSelectPlaylist={(id) => setActivePlaylistId(id)}
          onOpenAddPlaylist={() => setShowAddPlaylistModal(true)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile / Narrow Tablet Header Only (hidden on Live TV 3-pane view) */}
      {activeSection !== 'live' && (
        <header className="lg:hidden fixed top-0 inset-x-0 z-20 h-14 px-4 flex items-center justify-between bg-[#090A0D]/80 backdrop-blur-md border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-lg text-zinc-200 hover:bg-white/10"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-display text-base font-semibold text-white">
              {SECTION_TITLES[activeSection]}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAddPlaylistModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Lista</span>
          </button>
        </header>
      )}

      {/* Main TV Viewport */}
      <main className="min-h-dvh w-full">
        {activeSection === 'home' && (
          <HomeView
            channels={activeLibrary.channels}
            movies={activeLibrary.movies}
            series={activeLibrary.series}
            continueWatching={continueWatching}
            onPlay={handlePlay}
            onResumeItem={handleResumeContinueWatching}
            onRemoveContinueWatching={(id) =>
              setContinueWatching((prev) => prev.filter((i) => i.id !== id))
            }
            onSelectSeries={handleOpenSeries}
            onSelectMovieDetails={(movie) => setSelectedMovie(movie)}
            onNavigate={setActiveSection}
          />
        )}

        {activeSection === 'live' && (
          <LiveTvView
            channels={activeLibrary.channels}
            favorites={favorites}
            recentChannelIds={recentChannelIds}
            settings={settings}
            onToggleFavorite={toggleFavorite}
            onTrackChannelWatch={(ch) => trackChannelWatch(ch.id)}
            onEnableProxy={() => setSettings((prev) => ({ ...prev, useCorsProxy: true }))}
            onBackHome={() => setActiveSection('home')}
            onOpenAddPlaylist={() => setShowAddPlaylistModal(true)}
          />
        )}

        {activeSection !== 'home' && activeSection !== 'live' && (
          <div className="px-5 sm:px-8 lg:pl-[284px] lg:pr-10 pt-20 lg:pt-8 max-w-[1700px]">
            {activeSection !== 'search' && (
              <div className="mb-6 hidden lg:flex items-baseline justify-between gap-4">
                <h1 className="font-display text-3xl font-bold text-white tracking-tight">
                  {SECTION_TITLES[activeSection]}
                </h1>
                <span className="text-xs text-zinc-400">
                  Lista ativa: <span className="text-zinc-200">{activePlaylist.name}</span>
                </span>
              </div>
            )}

            {activeSection === 'search' && (
              <SearchView
                query={searchQuery}
                onQueryChange={setSearchQuery}
                channels={activeLibrary.channels}
                movies={activeLibrary.movies}
                series={activeLibrary.series}
                onPlayChannel={handlePlay}
                onSelectMovie={(m) => setSelectedMovie(m)}
                onSelectSeries={handleOpenSeries}
              />
            )}

            {activeSection === 'movies' && (
              <MoviesView
                movies={activeLibrary.movies}
                searchQuery={searchQuery}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                onSelectMovie={(movie) => setSelectedMovie(movie)}
                onOpenAddPlaylist={() => setShowAddPlaylistModal(true)}
              />
            )}

            {activeSection === 'series' && (
              <SeriesView
                series={activeLibrary.series}
                searchQuery={searchQuery}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                onSelectSeries={handleOpenSeries}
                onOpenAddPlaylist={() => setShowAddPlaylistModal(true)}
              />
            )}

            {activeSection === 'settings' && (
              <SettingsView
                playlists={playlists}
                activePlaylistId={activePlaylist.id}
                settings={settings}
                onUpdateSettings={(next) => setSettings((prev) => ({ ...prev, ...next }))}
                onSelectPlaylist={(id) => setActivePlaylistId(id)}
                onSyncPlaylist={handleSyncPlaylist}
                onDeletePlaylist={handleDeletePlaylist}
                onOpenAddPlaylist={() => setShowAddPlaylistModal(true)}
                onClearHistory={() => setContinueWatching([])}
                onClearFavorites={() => setFavorites([])}
              />
            )}
          </div>
        )}
      </main>

      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          isFavorite={favorites.includes(selectedMovie.id)}
          savedProgress={continueWatching.find((c) => c.itemId === selectedMovie.id)}
          onToggleFavorite={() => toggleFavorite(selectedMovie.id)}
          onPlay={handlePlay}
          onClose={() => setSelectedMovie(null)}
        />
      )}

      {selectedSeries && (
        <SeriesModal
          series={selectedSeries}
          loadingDetails={loadingSeriesDetails}
          errorDetails={seriesDetailError}
          isFavorite={favorites.includes(selectedSeries.id)}
          continueWatching={continueWatching}
          onToggleFavorite={() => toggleFavorite(selectedSeries.id)}
          onPlayEpisode={handlePlay}
          onClose={() => setSelectedSeries(null)}
        />
      )}

      {showAddPlaylistModal && (
        <AddPlaylistModal
          onClose={() => setShowAddPlaylistModal(false)}
          onAddM3uUrl={handleAddM3uUrl}
          onAddM3uContent={handleAddM3uContent}
          onAddXtream={handleAddXtream}
        />
      )}

      {activePlayback && (
        <VideoPlayerModal
          playback={activePlayback}
          settings={settings}
          channels={activeLibrary.channels}
          onProgress={handleProgress}
          onChangePlayback={setActivePlayback}
          onEnableProxyAndRetry={() => {
            setSettings((prev) => ({ ...prev, useCorsProxy: true }));
          }}
          onClose={() => setActivePlayback(null)}
        />
      )}
    </div>
  );
}
