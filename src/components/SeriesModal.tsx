import { useEffect, useState } from 'react';
import { Loader2, Play, Star, X } from 'lucide-react';
import type {
  ActivePlayback,
  ContinueWatchingItem,
  EpisodeItem,
  SeriesItem,
} from '../types/iptv';
import { MediaImage } from './MediaImage';

interface SeriesModalProps {
  series: SeriesItem;
  loadingDetails?: boolean;
  errorDetails?: string | null;
  isFavorite: boolean;
  continueWatching: ContinueWatchingItem[];
  onToggleFavorite: () => void;
  onPlayEpisode: (playback: ActivePlayback) => void;
  onClose: () => void;
}

export function SeriesModal({
  series,
  loadingDetails,
  errorDetails,
  isFavorite,
  continueWatching,
  onToggleFavorite,
  onPlayEpisode,
  onClose,
}: SeriesModalProps) {
  const seasonNumbers = Object.keys(series.seasons)
    .map(Number)
    .sort((a, b) => a - b);

  const [activeSeason, setActiveSeason] = useState<number>(seasonNumbers[0] || 1);

  useEffect(() => {
    if (seasonNumbers.length > 0 && !seasonNumbers.includes(activeSeason)) {
      setActiveSeason(seasonNumbers[0]);
    }
  }, [seasonNumbers, activeSeason]);

  const episodes: EpisodeItem[] = series.seasons[activeSeason] || [];

  const handlePlayEp = (ep: EpisodeItem) => {
    const saved = continueWatching.find((cw) => cw.episodeId === ep.id);
    onPlayEpisode({
      mediaType: 'series',
      itemId: series.id,
      title: series.title,
      subtitle: `T${ep.season} · E${ep.episode} — ${ep.title}`,
      streamUrl: ep.streamUrl,
      poster: series.poster,
      backdrop: ep.thumbnail || series.backdrop || series.poster,
      startAtSeconds: saved?.progressSeconds,
      seriesItem: series,
      currentSeason: ep.season,
      currentEpisode: ep,
    });
  };

  const firstEpisode = episodes[0] || (seasonNumbers[0] ? series.seasons[seasonNumbers[0]]?.[0] : undefined);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={series.title}
    >
      <div className="relative w-full max-w-4xl max-h-[92dvh] overflow-y-auto flex flex-col rounded-2xl bg-[#12141A] border border-white/[0.1] shadow-2xl">
        {/* Hero Backdrop */}
        <div className="relative h-40 sm:h-56 md:h-64 shrink-0 bg-[#0A0B0E]">
          <MediaImage
            src={series.backdrop || series.poster}
            alt={series.title}
            fallbackTitle={series.title}
            variant="backdrop"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#12141A] via-[#12141A]/60 to-black/30" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes da série"
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-full bg-black/60 hover:bg-black/85 text-white border border-white/15 transition-colors tv-focusable"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                <span>{series.category}</span>
                {series.year && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{series.year}</span>
                  </>
                )}
                {series.rating && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">Nota {series.rating}</span>
                  </>
                )}
              </div>
              <h2 className="font-display text-xl sm:text-3xl font-bold text-white truncate">
                {series.title}
              </h2>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {firstEpisode && (
                <button
                  type="button"
                  onClick={() => handlePlayEp(firstEpisode)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap tv-focusable"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Assistir T{firstEpisode.season}·E{firstEpisode.episode}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onToggleFavorite}
                aria-label={isFavorite ? 'Remover das favoritas' : 'Adicionar às favoritas'}
                className={`p-2 sm:p-2.5 rounded-lg border transition-colors tv-focusable ${
                  isFavorite
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                    : 'bg-white/[0.08] border-white/10 text-zinc-300 hover:text-white'
                }`}
              >
                <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-5">
          {series.synopsis && (
            <p className="text-sm text-zinc-300 leading-relaxed">{series.synopsis}</p>
          )}

          {loadingDetails ? (
            <div className="flex items-center justify-center gap-3 py-12 text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
              <span className="text-sm">Carregando temporadas e episódios...</span>
            </div>
          ) : errorDetails ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {errorDetails}
            </div>
          ) : seasonNumbers.length === 0 ? (
            <div className="rounded-xl border border-white/[0.07] bg-[#0E1015] p-8 text-center text-sm text-zinc-400">
              Nenhum episódio encontrado para esta série.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Season Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {seasonNumbers.map((sNum) => (
                  <button
                    key={sNum}
                    type="button"
                    onClick={() => setActiveSeason(sNum)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 tv-focusable ${
                      activeSeason === sNum
                        ? 'bg-white text-black'
                        : 'bg-[#181C26] text-zinc-300 hover:text-white border border-white/[0.06]'
                    }`}
                  >
                    Temporada {sNum}
                  </button>
                ))}
              </div>

              {/* Episodes */}
              <div className="divide-y divide-white/[0.06] border border-white/[0.07] rounded-xl overflow-hidden bg-[#0E1015]">
                {episodes.map((ep) => {
                  const cw = continueWatching.find((c) => c.episodeId === ep.id);
                  const pct =
                    cw && cw.durationSeconds > 0
                      ? Math.min(100, Math.round((cw.progressSeconds / cw.durationSeconds) * 100))
                      : 0;

                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => handlePlayEp(ep)}
                      className="w-full flex items-center gap-4 p-3.5 hover:bg-white/[0.04] text-left transition-colors group tv-focusable"
                    >
                      <div className="relative w-28 sm:w-36 aspect-video rounded-lg overflow-hidden bg-[#14171F] shrink-0">
                        <MediaImage
                          src={ep.thumbnail || series.backdrop || series.poster}
                          alt={ep.title}
                          fallbackTitle={`E${ep.episode}`}
                          variant="backdrop"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-5 h-5 text-white fill-current" />
                        </div>
                        {pct > 0 && (
                          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                            <div className="h-full bg-rose-500" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white truncate">
                            <span className="font-mono tabular-nums text-zinc-400 mr-2">
                              {String(ep.episode).padStart(2, '0')}.
                            </span>
                            {ep.title}
                          </p>
                          {ep.duration && (
                            <span className="text-xs text-zinc-400 font-mono tabular-nums shrink-0">
                              {ep.duration}
                            </span>
                          )}
                        </div>
                        {ep.synopsis && (
                          <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{ep.synopsis}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
