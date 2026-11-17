import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  AlertTriangle,
  ArrowLeft,
  ListVideo,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  ActivePlayback,
  ChannelItem,
  EpisodeItem,
  PlayerSettings,
} from '../types/iptv';

interface VideoPlayerModalProps {
  playback: ActivePlayback;
  settings: PlayerSettings;
  channels: ChannelItem[];
  onProgress: (playback: ActivePlayback, currentTime: number, duration: number) => void;
  onChangePlayback: (next: ActivePlayback) => void;
  onEnableProxyAndRetry: () => void;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function VideoPlayerModal({
  playback,
  settings,
  channels,
  onProgress,
  onChangePlayback,
  onEnableProxyAndRetry,
  onClose,
}: VideoPlayerModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(settings.defaultVolume);
  const [currentTime, setCurrentTime] = useState(playback.startAtSeconds || 0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showZapper, setShowZapper] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(true);
  const [levels, setLevels] = useState<Array<{ index: number; label: string }>>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);

  const resolvedStreamUrl = useMemo(() => {
    if (!settings.useCorsProxy) return playback.streamUrl;
    // Direct public CORS-enabled CDNs play faster directly; external IPTV streams benefit from proxy
    if (
      playback.streamUrl.startsWith('/') ||
      playback.streamUrl.includes('commondatastorage.googleapis.com') ||
      playback.streamUrl.includes('test-streams.mux.dev') ||
      playback.streamUrl.includes('devstreaming-cdn.apple.com')
    ) {
      return playback.streamUrl;
    }
    return `/api/proxy/stream?url=${encodeURIComponent(playback.streamUrl)}`;
  }, [playback.streamUrl, settings.useCorsProxy]);

  const nextEpisode: EpisodeItem | null = useMemo(() => {
    if (playback.mediaType !== 'series' || !playback.seriesItem || !playback.currentEpisode) {
      return null;
    }
    const seasons = playback.seriesItem.seasons;
    const currentSeason = playback.currentSeason || playback.currentEpisode.season;
    const epsInSeason = seasons[currentSeason] || [];
    const idx = epsInSeason.findIndex((e) => e.id === playback.currentEpisode?.id);
    if (idx !== -1 && epsInSeason[idx + 1]) {
      return epsInSeason[idx + 1];
    }
    const nextSeasonNum = Object.keys(seasons)
      .map(Number)
      .sort((a, b) => a - b)
      .find((s) => s > currentSeason);
    if (nextSeasonNum && seasons[nextSeasonNum]?.[0]) {
      return seasons[nextSeasonNum][0];
    }
    return null;
  }, [playback]);

  const handlePlayNextEpisode = useCallback(() => {
    if (!nextEpisode || !playback.seriesItem) return;
    onChangePlayback({
      mediaType: 'series',
      itemId: playback.seriesItem.id,
      title: playback.seriesItem.title,
      subtitle: `T${nextEpisode.season} · E${nextEpisode.episode} — ${nextEpisode.title}`,
      streamUrl: nextEpisode.streamUrl,
      poster: playback.seriesItem.poster,
      backdrop: nextEpisode.thumbnail || playback.seriesItem.backdrop || playback.seriesItem.poster,
      startAtSeconds: 0,
      seriesItem: playback.seriesItem,
      currentSeason: nextEpisode.season,
      currentEpisode: nextEpisode,
    });
  }, [nextEpisode, playback.seriesItem, onChangePlayback]);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 3500);
  }, []);

  // Load media source via hls.js or native video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setErrorMsg(null);
    setIsBuffering(true);
    setLevels([]);
    setCurrentLevel(-1);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHlsUrl =
      playback.streamUrl.split('?')[0].toLowerCase().endsWith('.m3u8') ||
      playback.mediaType === 'channel';

    const seekStart = () => {
      if (playback.startAtSeconds && playback.startAtSeconds > 2 && playback.mediaType !== 'channel') {
        video.currentTime = playback.startAtSeconds;
      }
      video.volume = volume;
      video.muted = isMuted;
      video.play().catch(() => {
        setIsPlaying(false);
      });
    };

    if (isHlsUrl && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: playback.mediaType === 'channel',
      });
      hlsRef.current = hls;
      hls.loadSource(resolvedStreamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
        const mappedLevels = data.levels.map((lvl, index) => ({
          index,
          label: lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)} kbps`,
        }));
        setLevels(mappedLevels);

        if (settings.preferredQuality === 'high' && mappedLevels.length > 0) {
          hls.currentLevel = mappedLevels.length - 1;
          setCurrentLevel(mappedLevels.length - 1);
        } else if (settings.preferredQuality === 'medium' && mappedLevels.length > 1) {
          const mid = Math.floor(mappedLevels.length / 2);
          hls.currentLevel = mid;
          setCurrentLevel(mid);
        }
        seekStart();
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setErrorMsg(
              'Não foi possível carregar este stream. O servidor pode estar offline ou bloqueado por CORS.',
            );
          } else {
            setErrorMsg('Formato de vídeo não suportado ou fluxo interrompido.');
          }
          setIsBuffering(false);
        }
      });
    } else {
      video.src = resolvedStreamUrl;
      const onLoaded = () => seekStart();
      video.addEventListener('loadedmetadata', onLoaded, { once: true });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedStreamUrl, playback.itemId, playback.currentEpisode?.id]);

  // Progress reporter every 3 seconds & on close
  useEffect(() => {
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      onProgress(playback, video.currentTime, video.duration || 0);
    }, 3000);

    return () => {
      window.clearInterval(interval);
      const video = videoRef.current;
      if (video && video.currentTime > 2) {
        onProgress(playback, video.currentTime, video.duration || 0);
      }
    };
  }, [playback, onProgress]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
    resetHideTimer();
  }, [resetHideTimer]);

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video || playback.mediaType === 'channel') return;
      video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
      resetHideTimer();
    },
    [playback.mediaType, resetHideTimer],
  );

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  const togglePiP = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => undefined);
    } else if (document.pictureInPictureEnabled) {
      video.requestPictureInPicture().catch(() => undefined);
    }
  }, []);

  // Keyboard & TV remote shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekBy(-10);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekBy(10);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setIsMuted((prev) => {
          if (videoRef.current) videoRef.current.muted = !prev;
          return !prev;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, togglePlay, seekBy, toggleFullscreen]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleQualityChange = (idx: number) => {
    setCurrentLevel(idx);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = idx;
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onClick={resetHideTimer}
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none"
      role="dialog"
      aria-modal="true"
      aria-label={`Player: ${playback.title}`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        playsInline
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => {
          if (settings.autoPlayNext && nextEpisode) {
            handlePlayNextEpisode();
          }
        }}
        onError={() => {
          setIsBuffering(false);
          setErrorMsg(
            'Não foi possível reproduzir este vídeo diretamente no navegador.',
          );
        }}
        className="w-full h-full object-contain bg-black"
      />

      {/* Buffering indicator */}
      {isBuffering && !errorMsg && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-11 h-11 rounded-full border-2 border-white/20 border-t-rose-500 animate-spin" />
        </div>
      )}

      {/* Error State */}
      {errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6 bg-black/85">
          <div className="max-w-md w-full max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#12141A] border border-white/10 p-5 sm:p-6 space-y-4 text-center">
            <AlertTriangle className="w-9 h-9 text-amber-400 mx-auto" />
            <h3 className="font-display text-lg font-semibold text-white">
              Falha ao reproduzir stream
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">{errorMsg}</p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {!settings.useCorsProxy && (
                <button
                  type="button"
                  onClick={onEnableProxyAndRetry}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
                >
                  Ativar Proxy CORS e tentar
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white"
              >
                Voltar ao catálogo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Overlay Bar */}
      <div
        className={`absolute inset-x-0 top-0 p-4 sm:p-6 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between gap-4 transition-opacity duration-200 ${
          showControls || showZapper ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar player"
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors tv-focusable"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-lg font-semibold text-white truncate">
              {playback.title}
            </h2>
            {playback.subtitle && (
              <p className="text-xs text-zinc-300 truncate">{playback.subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {playback.mediaType === 'channel' && channels.length > 1 && (
            <button
              type="button"
              onClick={() => setShowZapper((v) => !v)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors"
            >
              <ListVideo className="w-4 h-4" />
              <span>Canais</span>
            </button>
          )}
        </div>
      </div>

      {/* Live TV Quick Channel Zapper Drawer */}
      {showZapper && playback.mediaType === 'channel' && (
        <div className="absolute top-14 right-3 bottom-16 sm:top-20 sm:right-4 sm:bottom-24 w-64 sm:w-80 rounded-2xl bg-[#101218]/95 backdrop-blur-md border border-white/10 overflow-hidden flex flex-col z-20">
          <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
            <span className="text-xs font-semibold text-white">Troca rápida de canal</span>
            <button
              type="button"
              onClick={() => setShowZapper(false)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Fechar
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.05]">
            {channels.slice(0, 80).map((ch) => {
              const active = ch.id === playback.itemId;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    onChangePlayback({
                      mediaType: 'channel',
                      itemId: ch.id,
                      title: ch.name,
                      subtitle: ch.currentProgram || ch.group,
                      streamUrl: ch.streamUrl,
                      poster: ch.logo,
                      channelItem: ch,
                    });
                  }}
                  className={`w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left text-xs transition-colors ${
                    active ? 'bg-rose-600/20 text-white' : 'text-zinc-300 hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="truncate font-medium">
                    {ch.channelNumber ? `${ch.channelNumber} · ` : ''}
                    {ch.name}
                  </span>
                  {active && <span className="text-rose-400 shrink-0">No ar</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div
        className={`absolute inset-x-0 bottom-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/55 to-transparent space-y-3 transition-opacity duration-200 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Seek Bar for VOD/Series */}
        {playback.mediaType !== 'channel' && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono tabular-nums text-zinc-200 w-14">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={Math.min(currentTime, duration || 100)}
              onChange={(e) => {
                const t = Number(e.target.value);
                if (videoRef.current) videoRef.current.currentTime = t;
                setCurrentTime(t);
              }}
              aria-label="Progresso do vídeo"
              className="flex-1 h-1.5 accent-rose-500 cursor-pointer"
            />
            <span className="text-xs font-mono tabular-nums text-zinc-400 w-14 text-right">
              {formatTime(duration)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
              className="p-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white transition-colors tv-focusable"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {playback.mediaType !== 'channel' ? (
              <>
                <button
                  type="button"
                  onClick={() => seekBy(-10)}
                  aria-label="Voltar 10 segundos"
                  className="p-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => seekBy(10)}
                  aria-label="Avançar 10 segundos"
                  className="p-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <RotateCw className="w-5 h-5" />
                </button>
              </>
            ) : (
              <span className="text-xs font-medium text-rose-400 px-2">
                Transmissão ao vivo
              </span>
            )}

            {/* Volume */}
            <div className="hidden sm:flex items-center gap-2 ml-2">
              <button
                type="button"
                onClick={() => {
                  const nextMuted = !isMuted;
                  setIsMuted(nextMuted);
                  if (videoRef.current) videoRef.current.muted = nextMuted;
                }}
                aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
                className="p-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/10"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  setIsMuted(v === 0);
                  if (videoRef.current) {
                    videoRef.current.volume = v;
                    videoRef.current.muted = v === 0;
                  }
                }}
                aria-label="Volume"
                className="w-20 h-1 accent-white cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {nextEpisode && (
              <button
                type="button"
                onClick={handlePlayNextEpisode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-medium text-white transition-colors whitespace-nowrap"
              >
                <SkipForward className="w-4 h-4" />
                <span>Próximo ep.</span>
              </button>
            )}

            {levels.length > 0 && (
              <select
                value={currentLevel}
                onChange={(e) => handleQualityChange(Number(e.target.value))}
                aria-label="Qualidade de vídeo"
                className="h-8 px-2.5 rounded-lg bg-white/10 border border-white/15 text-xs text-white focus:outline-none"
              >
                <option value={-1} className="bg-[#12141A]">
                  Auto
                </option>
                {levels.map((l) => (
                  <option key={l.index} value={l.index} className="bg-[#12141A]">
                    {l.label}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={togglePiP}
              aria-label="Picture in Picture"
              className="hidden sm:inline-flex p-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/10"
            >
              <PictureInPicture2 className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              className="p-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/10"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
