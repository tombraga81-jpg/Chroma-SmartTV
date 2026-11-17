import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Expand,
  Heart,
  Layers,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RectangleHorizontal,
  Search,
  Tv,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { ChannelItem, PlayerSettings } from '../types/iptv';
import { useTvClock } from '../utils/tizenTv';
import { MediaImage } from './MediaImage';

interface LiveTvViewProps {
  channels: ChannelItem[];
  favorites: string[];
  recentChannelIds: string[];
  settings: PlayerSettings;
  onToggleFavorite: (id: string) => void;
  onTrackChannelWatch: (channel: ChannelItem) => void;
  onEnableProxy: () => void;
  onBackHome: () => void;
  onOpenAddPlaylist: () => void;
}

type CategoryFilter =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'recent' }
  | { kind: 'group'; group: string };

const OVERLAY_TIMEOUT_MS = 6500;

export function LiveTvView({
  channels,
  favorites,
  recentChannelIds,
  settings,
  onToggleFavorite,
  onTrackChannelWatch,
  onEnableProxy,
  onBackHome,
  onOpenAddPlaylist,
}: LiveTvViewProps) {
  const clock = useTvClock();
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>({ kind: 'all' });
  const [showCategories, setShowCategories] = useState(() =>
    typeof window !== 'undefined'
      ? window.innerWidth >= 1024 && window.innerHeight >= 520
      : true,
  );
  const [categorySearch, setCategorySearch] = useState('');
  const [channelSearch, setChannelSearch] = useState('');
  const [activeChannelId, setActiveChannelId] = useState<string | null>(
    () => recentChannelIds[0] || channels[0]?.id || null,
  );

  // Auto-hiding overlay (channel sidebar + mini-player) visible on entry for ~6.5s
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Fullscreen background player states
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(settings.defaultVolume);
  const [videoFit, setVideoFit] = useState<'contain' | 'cover'>('cover');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const resetOverlayTimer = useCallback(() => {
    setOverlayVisible(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setOverlayVisible(false);
    }, OVERLAY_TIMEOUT_MS);
  }, []);

  // Trigger initial 6.5s timer on mount
  useEffect(() => {
    resetOverlayTimer();
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [resetOverlayTimer]);

  // Keep overlay visible while typing in search
  useEffect(() => {
    if (isInputFocused) {
      setOverlayVisible(true);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    } else {
      resetOverlayTimer();
    }
  }, [isInputFocused, resetOverlayTimer]);

  // Ensure valid active channel when playlist changes
  useEffect(() => {
    if (channels.length === 0) {
      setActiveChannelId(null);
      return;
    }
    if (!activeChannelId || !channels.some((c) => c.id === activeChannelId)) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);

  const groupStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ch of channels) {
      const grp = ch.group || 'Geral';
      counts.set(grp, (counts.get(grp) || 0) + 1);
    }
    const q = categorySearch.trim().toLowerCase();
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .filter((g) => !q || g.name.toLowerCase().includes(q));
  }, [channels, categorySearch]);

  const favoriteChannelCount = useMemo(
    () => channels.filter((c) => favorites.includes(c.id)).length,
    [channels, favorites],
  );

  const recentChannelsList = useMemo(() => {
    const byId = new Map(channels.map((c) => [c.id, c]));
    return recentChannelIds
      .map((id) => byId.get(id))
      .filter((c): c is ChannelItem => Boolean(c));
  }, [channels, recentChannelIds]);

  const filteredChannels = useMemo(() => {
    let baseList: ChannelItem[] = channels;
    if (categoryFilter.kind === 'favorites') {
      baseList = channels.filter((c) => favorites.includes(c.id));
    } else if (categoryFilter.kind === 'recent') {
      baseList = recentChannelsList;
    } else if (categoryFilter.kind === 'group') {
      baseList = channels.filter((c) => (c.group || 'Geral') === categoryFilter.group);
    }

    const q = channelSearch.trim().toLowerCase();
    if (!q) return baseList;
    return baseList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q) ||
        (c.channelNumber || '').includes(q),
    );
  }, [channels, categoryFilter, favorites, recentChannelsList, channelSearch]);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) || filteredChannels[0] || null,
    [channels, activeChannelId, filteredChannels],
  );

  const resolvedStreamUrl = useMemo(() => {
    if (!activeChannel) return '';
    if (!settings.useCorsProxy) return activeChannel.streamUrl;
    if (
      activeChannel.streamUrl.startsWith('/') ||
      activeChannel.streamUrl.includes('commondatastorage.googleapis.com') ||
      activeChannel.streamUrl.includes('test-streams.mux.dev') ||
      activeChannel.streamUrl.includes('devstreaming-cdn.apple.com')
    ) {
      return activeChannel.streamUrl;
    }
    return `/api/proxy/stream?url=${encodeURIComponent(activeChannel.streamUrl)}`;
  }, [activeChannel, settings.useCorsProxy]);

  // Load fullscreen background video stream immediately on entry or channel switch
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeChannel || !resolvedStreamUrl) return;

    setStreamError(null);
    setIsBuffering(true);
    onTrackChannelWatch(activeChannel);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls =
      activeChannel.streamUrl.split('?')[0].toLowerCase().endsWith('.m3u8') ||
      !/\.(mp4|mkv|webm|mov)$/i.test(activeChannel.streamUrl.split('?')[0]);

    const startPlayback = () => {
      video.volume = volume;
      video.muted = isMuted;
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    };

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;
      hls.loadSource(resolvedStreamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        startPlayback();
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          setIsBuffering(false);
          setStreamError(
            'Não foi possível carregar este canal. O servidor pode estar offline ou bloqueado por CORS.',
          );
        }
      });
    } else {
      video.src = resolvedStreamUrl;
      video.addEventListener('loadedmetadata', startPlayback, { once: true });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel?.id, resolvedStreamUrl]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const handleSelectChannel = useCallback(
    (ch: ChannelItem) => {
      setActiveChannelId(ch.id);
      resetOverlayTimer();
    },
    [resetOverlayTimer],
  );

  const stepChannel = useCallback(
    (delta: number) => {
      const list = filteredChannels.length > 0 ? filteredChannels : channels;
      if (list.length === 0) return;
      const idx = list.findIndex((c) => c.id === activeChannel?.id);
      const nextIdx =
        idx === -1 ? 0 : (idx + delta + list.length) % list.length;
      handleSelectChannel(list[nextIdx]);
    },
    [filteredChannels, channels, activeChannel?.id, handleSelectChannel],
  );

  // Wake overlay on remote/keyboard keys and support ChannelUp/ChannelDown
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      resetOverlayTimer();
      if (e.key === 'ChannelUp' || e.key === 'PageUp') {
        e.preventDefault();
        stepChannel(-1);
      } else if (e.key === 'ChannelDown' || e.key === 'PageDown') {
        e.preventDefault();
        stepChannel(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resetOverlayTimer, stepChannel]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
    resetOverlayTimer();
  };

  const toggleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
    resetOverlayTimer();
  };

  const togglePiP = () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => undefined);
    } else if (document.pictureInPictureEnabled) {
      v.requestPictureInPicture().catch(() => undefined);
    }
    resetOverlayTimer();
  };

  if (channels.length === 0) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-[#090A0D]">
        <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-10 text-center max-w-md space-y-4">
          <Tv className="w-10 h-10 text-zinc-500 mx-auto" />
          <h2 className="font-display text-xl font-semibold text-white">
            Nenhum canal de TV na lista ativa
          </h2>
          <p className="text-sm text-zinc-400">
            Conecte uma lista M3U ou conta Xtream Codes para assistir aos canais ao vivo.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onBackHome}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium text-white"
            >
              Voltar ao Início
            </button>
            <button
              type="button"
              onClick={onOpenAddPlaylist}
              className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-sm font-semibold text-white"
            >
              Conectar Lista
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isFavActive = activeChannel ? favorites.includes(activeChannel.id) : false;

  return (
    <div
      ref={rootRef}
      onMouseMove={resetOverlayTimer}
      onTouchStart={resetOverlayTimer}
      className="fixed inset-0 z-40 bg-black text-[#F4F5F7] overflow-hidden select-none"
      role="region"
      aria-label="Canais de TV ao vivo"
    >
      {/* FULLSCREEN BACKGROUND LIVE TV STREAM */}
      <video
        ref={videoRef}
        playsInline
        onClick={() => {
          if (!overlayVisible) {
            resetOverlayTimer();
          } else {
            setOverlayVisible(false);
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onError={() => {
          setIsBuffering(false);
          setStreamError('Falha ao reproduzir o stream deste canal.');
        }}
        className={`absolute inset-0 w-full h-full bg-black ${
          videoFit === 'cover' ? 'object-cover' : 'object-contain'
        }`}
      />

      {/* Buffering indicator */}
      {isBuffering && !streamError && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
          <div className="w-11 h-11 rounded-full border-2 border-white/20 border-t-rose-500 animate-spin" />
        </div>
      )}

      {/* Subtle edge scrim when overlay is visible for crisp contrast over bright TV footage */}
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-r from-black/75 via-black/25 to-transparent transition-opacity duration-300 ${
          overlayVisible ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/25 transition-opacity duration-300 ${
          overlayVisible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Stream Error Card */}
      {streamError && (
        <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/75 z-30">
          <div className="max-w-sm rounded-2xl bg-[#12141A] border border-white/15 p-6 text-center space-y-3 shadow-2xl">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-sm font-medium text-white">{streamError}</p>
            <div className="flex items-center justify-center gap-2 pt-1">
              {!settings.useCorsProxy && (
                <button
                  type="button"
                  onClick={onEnableProxy}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
                >
                  Ativar Proxy CORS
                </button>
              )}
              <button
                type="button"
                onClick={() => stepChannel(1)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white"
              >
                Próximo canal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESPONSIVE NON-OVERLAPPING HUD (Left Sidebar + Right Mini-Player) */}
      <div
        className={`pointer-events-none absolute inset-0 z-20 p-2.5 sm:p-4 lg:p-5 flex flex-col sm:flex-row gap-2.5 sm:gap-3.5 transition-all duration-300 ${
          overlayVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* LEFT SIDE: Categories + Channel List */}
        <div
          className={`flex gap-2 min-h-0 flex-1 sm:flex-none sm:h-full shrink-0 transition-transform duration-300 ${
            overlayVisible
              ? 'pointer-events-auto translate-x-0'
              : 'pointer-events-none -translate-x-6'
          }`}
        >
          {/* Categories Rail */}
          {showCategories && (
            <aside className="w-full sm:w-[215px] lg:w-[215px] xl:w-[235px] h-full rounded-2xl bg-[#0D0F14]/84 backdrop-blur-2xl border border-white/[0.12] shadow-2xl flex flex-col overflow-hidden">
              <div className="px-3.5 py-2.5 sm:py-3 border-b border-white/[0.08] flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  data-tv-focus="true"
                  onClick={onBackHome}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-white hover:text-zinc-200 tv-focusable rounded-lg px-2 py-1 -ml-1"
                >
                  <ArrowLeft className="w-4 h-4 text-zinc-300" />
                  <span>Início</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCategories(false);
                    resetOverlayTimer();
                  }}
                  className="lg:hidden text-[11px] font-medium text-zinc-300 hover:text-white px-2 py-1 rounded bg-white/10"
                >
                  Canais
                </button>
                <span className="hidden lg:inline text-[11px] font-medium text-zinc-400">
                  Categorias
                </span>
              </div>

              <div className="p-2 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={categorySearch}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Filtrar grupo"
                    aria-label="Filtrar grupo de canais"
                    className="w-full h-8 pl-8 pr-6 rounded-lg bg-white/[0.07] border border-white/[0.08] text-xs text-white placeholder:text-zinc-400 focus:outline-none focus:border-white/50 tv-focusable"
                  />
                  {categorySearch && (
                    <button
                      type="button"
                      onClick={() => setCategorySearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                      aria-label="Limpar busca de categoria"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 min-h-0">
                <button
                  type="button"
                  data-tv-focus="true"
                  onClick={() => {
                    setCategoryFilter({ kind: 'favorites' });
                    if (window.innerWidth < 1024) setShowCategories(false);
                    resetOverlayTimer();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors tv-focusable ${
                    categoryFilter.kind === 'favorites'
                      ? 'bg-rose-600/25 text-white border border-rose-500/40 font-semibold'
                      : 'text-zinc-300 hover:text-white hover:bg-white/[0.08] border border-transparent'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 truncate">
                    <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="truncate">Favoritos</span>
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-zinc-400">
                    {favoriteChannelCount}
                  </span>
                </button>

                <button
                  type="button"
                  data-tv-focus="true"
                  onClick={() => {
                    setCategoryFilter({ kind: 'recent' });
                    if (window.innerWidth < 1024) setShowCategories(false);
                    resetOverlayTimer();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors tv-focusable ${
                    categoryFilter.kind === 'recent'
                      ? 'bg-rose-600/25 text-white border border-rose-500/40 font-semibold'
                      : 'text-zinc-300 hover:text-white hover:bg-white/[0.08] border border-transparent'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 truncate">
                    <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">Recentes</span>
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-zinc-400">
                    {recentChannelsList.length}
                  </span>
                </button>

                <button
                  type="button"
                  data-tv-focus="true"
                  onClick={() => {
                    setCategoryFilter({ kind: 'all' });
                    if (window.innerWidth < 1024) setShowCategories(false);
                    resetOverlayTimer();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors tv-focusable ${
                    categoryFilter.kind === 'all'
                      ? 'bg-rose-600/25 text-white border border-rose-500/40 font-semibold'
                      : 'text-zinc-300 hover:text-white hover:bg-white/[0.08] border border-transparent'
                  }`}
                >
                  <span className="truncate">Todos os Canais</span>
                  <span className="font-mono tabular-nums text-[11px] text-zinc-400">
                    {channels.length}
                  </span>
                </button>

                <div className="my-1.5 border-t border-white/[0.08]" />

                {groupStats.map((grp) => {
                  const active =
                    categoryFilter.kind === 'group' && categoryFilter.group === grp.name;
                  return (
                    <button
                      key={grp.name}
                      type="button"
                      data-tv-focus="true"
                      onClick={() => {
                        setCategoryFilter({ kind: 'group', group: grp.name });
                        if (window.innerWidth < 1024) setShowCategories(false);
                        resetOverlayTimer();
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors tv-focusable ${
                        active
                          ? 'bg-rose-600/25 text-white border border-rose-500/40 font-semibold'
                          : 'text-zinc-300 hover:text-white hover:bg-white/[0.08] border border-transparent'
                      }`}
                    >
                      <span className="truncate text-left">{grp.name}</span>
                      <span className="font-mono tabular-nums text-[11px] text-zinc-400 shrink-0">
                        {grp.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>
          )}

          {/* Channel List Sidebar (on < lg hidden only while Categories picker is open) */}
          <section
            aria-label="Lista de canais"
            className={`${
              showCategories ? 'hidden lg:flex' : 'flex'
            } w-full sm:w-[235px] md:w-[255px] lg:w-[285px] h-full rounded-2xl bg-[#0D0F14]/84 backdrop-blur-2xl border border-white/[0.12] shadow-2xl flex-col overflow-hidden`}
          >
            <div className="px-3.5 py-2.5 sm:py-3 border-b border-white/[0.08] flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  data-tv-focus="true"
                  onClick={onBackHome}
                  className={`${
                    showCategories ? 'lg:hidden' : ''
                  } inline-flex items-center gap-1.5 text-xs font-semibold text-white hover:text-zinc-200 tv-focusable rounded-lg px-1.5 py-1 -ml-1`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Início</span>
                </button>
                <span className="text-xs font-semibold text-white truncate">
                  Canais de TV
                </span>
              </div>

              <button
                type="button"
                data-tv-focus="true"
                onClick={() => {
                  setShowCategories((v) => !v);
                  resetOverlayTimer();
                }}
                title={showCategories ? 'Ocultar categorias' : 'Mostrar categorias'}
                aria-label={showCategories ? 'Ocultar categorias' : 'Mostrar categorias'}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-[11px] font-medium text-zinc-200 tv-focusable shrink-0"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{showCategories ? 'Ocultar' : 'Grupos'}</span>
              </button>
            </div>

            {/* Search Channel */}
            <div className="p-2 border-b border-white/[0.07] shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={channelSearch}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="Buscar canal..."
                  aria-label="Buscar canal"
                  className="w-full h-8 pl-8 pr-6 rounded-lg bg-white/[0.07] border border-white/[0.08] text-xs text-white placeholder:text-zinc-400 focus:outline-none focus:border-white/50 tv-focusable"
                />
                {channelSearch && (
                  <button
                    type="button"
                    onClick={() => setChannelSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    aria-label="Limpar busca de canal"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Channel Rows */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
              {filteredChannels.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400">
                  Nenhum canal encontrado.
                </div>
              ) : (
                filteredChannels.slice(0, 300).map((ch, idx) => {
                  const isSelected = activeChannel?.id === ch.id;
                  const numLabel = ch.channelNumber || String(idx + 1).padStart(2, '0');

                  return (
                    <button
                      key={ch.id}
                      type="button"
                      data-tv-focus="true"
                      onClick={() => handleSelectChannel(ch)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors tv-focusable ${
                        isSelected
                          ? 'bg-rose-600/25 border border-rose-500/45 text-white'
                          : 'hover:bg-white/[0.08] border border-transparent text-zinc-200'
                      }`}
                    >
                      <span
                        className={`min-w-[26px] h-6 px-1 rounded-md flex items-center justify-center text-[11px] font-mono tabular-nums shrink-0 ${
                          isSelected
                            ? 'bg-rose-600 text-white font-semibold'
                            : 'text-zinc-400'
                        }`}
                      >
                        {numLabel}
                      </span>

                      <div className="w-8 h-8 rounded-lg bg-black/50 border border-white/[0.08] flex items-center justify-center overflow-hidden shrink-0">
                        {ch.logo ? (
                          <MediaImage
                            src={ch.logo}
                            alt={ch.name}
                            fallbackTitle={ch.name}
                            variant="logo"
                            className="w-full h-full object-contain p-0.5"
                          />
                        ) : (
                          <Tv className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-white truncate">{ch.name}</p>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {ch.currentProgram || ch.group}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* RIGHT SIDE: FLOATING MINI-PLAYER & CURRENT PROGRAM INFO HUD (never overlaps sidebar) */}
        {activeChannel && (
          <div className="shrink-0 sm:flex-1 min-w-0 max-h-[45dvh] sm:max-h-full flex flex-col justify-end">
            <div
              className={`max-h-full overflow-y-auto rounded-2xl bg-[#0D0F14]/86 backdrop-blur-2xl border border-white/[0.14] shadow-2xl p-3 sm:p-4 lg:p-5 space-y-2.5 sm:space-y-3 transition-transform duration-300 ${
                overlayVisible
                  ? 'pointer-events-auto translate-y-0'
                  : 'pointer-events-none translate-y-4'
              }`}
            >
              {/* Top row: Channel logo, Channel name, Program title, Clock, Favorite */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="hidden md:flex w-11 h-11 rounded-xl bg-black/50 border border-white/[0.1] items-center justify-center overflow-hidden shrink-0">
                    {activeChannel.logo ? (
                      <MediaImage
                        src={activeChannel.logo}
                        alt={activeChannel.name}
                        fallbackTitle={activeChannel.name}
                        variant="logo"
                        className="w-full h-full object-contain p-1.5"
                      />
                    ) : (
                      <Tv className="w-5 h-5 text-rose-400" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-0.5 sm:space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-zinc-300">
                      <span className="px-1.5 sm:px-2 py-0.5 rounded bg-rose-600 text-[10px] font-bold text-white tracking-wide">
                        AO VIVO
                      </span>
                      <span className="font-semibold text-white truncate max-w-[160px] sm:max-w-none">
                        {activeChannel.channelNumber ? `${activeChannel.channelNumber} · ` : ''}
                        {activeChannel.name}
                      </span>
                      <span className="hidden md:inline" aria-hidden="true">
                        ·
                      </span>
                      <span className="hidden md:inline text-zinc-400">{activeChannel.group}</span>
                    </div>

                    {/* Program Name */}
                    <h2 className="font-display text-sm sm:text-base lg:text-lg font-semibold text-white truncate">
                      {activeChannel.currentProgram || `Programação ao vivo · ${activeChannel.name}`}
                    </h2>

                    {/* Program Description */}
                    <p className="text-xs text-zinc-300 leading-snug line-clamp-1 sm:line-clamp-2">
                      {activeChannel.programDescription ||
                        (activeChannel.nextProgram
                          ? `A seguir: ${activeChannel.nextProgram}`
                          : `Exibindo transmissão contínua em ${activeChannel.group}.`)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <span className="hidden md:inline-block px-2 py-1 rounded-md bg-white/[0.07] text-xs font-mono tabular-nums text-zinc-200">
                    {clock}
                  </span>
                  <button
                    type="button"
                    data-tv-focus="true"
                    onClick={() => {
                      onToggleFavorite(activeChannel.id);
                      resetOverlayTimer();
                    }}
                    aria-label={isFavActive ? 'Remover dos favoritos' : 'Favoritar canal'}
                    className={`p-1.5 sm:p-2 rounded-lg border transition-colors tv-focusable ${
                      isFavActive
                        ? 'bg-rose-600/20 border-rose-500/45 text-rose-400'
                        : 'bg-white/[0.06] border-white/[0.1] text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isFavActive ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Live progress track */}
              <div className="h-1 rounded-full bg-white/15 overflow-hidden">
                <div className="h-full w-2/5 bg-rose-500 rounded-full" />
              </div>

              {/* Bottom Mini-Player Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    data-tv-focus="true"
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
                    className="p-2 rounded-full bg-white text-black hover:bg-zinc-200 transition-colors tv-focusable"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    data-tv-focus="true"
                    onClick={() => stepChannel(-1)}
                    aria-label="Canal anterior"
                    className="p-1.5 sm:p-2 rounded-lg bg-white/[0.07] hover:bg-white/[0.14] text-zinc-200 tv-focusable"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    data-tv-focus="true"
                    onClick={() => stepChannel(1)}
                    aria-label="Próximo canal"
                    className="p-1.5 sm:p-2 rounded-lg bg-white/[0.07] hover:bg-white/[0.14] text-zinc-200 tv-focusable"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="hidden md:flex items-center gap-2 ml-1">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isMuted;
                        setIsMuted(next);
                        if (videoRef.current) videoRef.current.muted = next;
                        resetOverlayTimer();
                      }}
                      aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
                      className="p-1.5 rounded-lg text-zinc-200 hover:text-white hover:bg-white/10"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setVolume(val);
                        setIsMuted(val === 0);
                        if (videoRef.current) {
                          videoRef.current.volume = val;
                          videoRef.current.muted = val === 0;
                        }
                        resetOverlayTimer();
                      }}
                      aria-label="Volume"
                      className="w-16 lg:w-20 h-1 accent-rose-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {activeChannel.nextProgram && (
                    <span className="hidden xl:inline text-xs text-zinc-400 mr-2 truncate max-w-[200px]">
                      A seguir: {activeChannel.nextProgram}
                    </span>
                  )}

                  <button
                    type="button"
                    data-tv-focus="true"
                    onClick={() => {
                      setVideoFit((f) => (f === 'cover' ? 'contain' : 'cover'));
                      resetOverlayTimer();
                    }}
                    title={videoFit === 'cover' ? 'Ajustar proporção' : 'Preencher tela'}
                    aria-label="Alternar ajuste de tela"
                    className="p-1.5 sm:p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-zinc-200 tv-focusable"
                  >
                    {videoFit === 'cover' ? (
                      <RectangleHorizontal className="w-4 h-4" />
                    ) : (
                      <Expand className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    data-tv-focus="true"
                    onClick={togglePiP}
                    aria-label="Picture in Picture"
                    className="hidden sm:inline-flex p-1.5 sm:p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-zinc-200 tv-focusable"
                  >
                    <PictureInPicture2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    data-tv-focus="true"
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                    className="p-1.5 sm:p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-zinc-200 tv-focusable"
                  >
                    {isFullscreen ? (
                      <Minimize className="w-4 h-4" />
                    ) : (
                      <Maximize className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    data-tv-focus="true"
                    onClick={() => setOverlayVisible(false)}
                    className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] text-xs font-medium text-zinc-200 tv-focusable whitespace-nowrap"
                  >
                    Ocultar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
