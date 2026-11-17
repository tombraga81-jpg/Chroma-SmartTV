import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Info, Play, Tv, X } from 'lucide-react';
import type {
  ActivePlayback,
  ChannelItem,
  ContinueWatchingItem,
  MovieItem,
  NavSection,
  SeriesItem,
} from '../types/iptv';
import { MediaImage } from './MediaImage';

interface HomeViewProps {
  channels: ChannelItem[];
  movies: MovieItem[];
  series: SeriesItem[];
  continueWatching: ContinueWatchingItem[];
  onPlay: (playback: ActivePlayback) => void;
  onResumeItem: (item: ContinueWatchingItem) => void;
  onRemoveContinueWatching: (id: string) => void;
  onSelectSeries: (series: SeriesItem) => void;
  onSelectMovieDetails: (movie: MovieItem) => void;
  onNavigate: (section: NavSection) => void;
}

function formatProgressLabel(item: ContinueWatchingItem): string {
  if (item.mediaType === 'channel') return 'Ao vivo';
  if (item.subtitle) return item.subtitle;
  if (!item.durationSeconds || item.durationSeconds <= 0) return 'Continuar';
  const remainingMin = Math.max(1, Math.round((item.durationSeconds - item.progressSeconds) / 60));
  return `Continuar · ${remainingMin} min`;
}

export function HomeView({
  channels,
  movies,
  series,
  continueWatching,
  onPlay,
  onResumeItem,
  onRemoveContinueWatching,
  onSelectSeries,
  onSelectMovieDetails,
  onNavigate,
}: HomeViewProps) {
  const heroCandidates = useMemo(() => {
    const picks: Array<
      | { kind: 'movie'; data: MovieItem }
      | { kind: 'series'; data: SeriesItem }
    > = [];
    if (movies[0]) picks.push({ kind: 'movie', data: movies[0] });
    if (series[0]) picks.push({ kind: 'series', data: series[0] });
    if (movies[1]) picks.push({ kind: 'movie', data: movies[1] });
    if (series[1]) picks.push({ kind: 'series', data: series[1] });
    return picks;
  }, [movies, series]);

  const [heroIndex, setHeroIndex] = useState(0);
  const currentHero = heroCandidates[heroIndex % Math.max(1, heroCandidates.length)];

  const recommendedMovies = useMemo(() => movies.slice(0, 6), [movies]);
  const recommendedSeries = useMemo(() => series.slice(0, 6), [series]);
  const featuredChannels = useMemo(() => channels.slice(0, 6), [channels]);

  const handlePlayHero = () => {
    if (!currentHero) return;
    if (currentHero.kind === 'movie') {
      const m = currentHero.data;
      onPlay({
        mediaType: 'movie',
        itemId: m.id,
        title: m.title,
        subtitle: [m.category, m.year].filter(Boolean).join(' · '),
        streamUrl: m.streamUrl,
        poster: m.poster,
        backdrop: m.backdrop || m.poster,
      });
    } else {
      onSelectSeries(currentHero.data);
    }
  };

  return (
    <div className="pb-16">
      {/* Full-Bleed Edge-to-Edge Hero Canvas (underneath floating sidebar) */}
      <section className="relative w-full min-h-[340px] sm:min-h-[380px] lg:min-h-[88vh] flex flex-col justify-end overflow-hidden">
        {currentHero && (
          <>
            <MediaImage
              src={currentHero.data.backdrop || currentHero.data.poster}
              alt={currentHero.data.title}
              fallbackTitle={currentHero.data.title}
              variant="backdrop"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            {/* Measured cinematic scrims for crisp readability */}
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#090A0D] via-[#090A0D]/55 to-black/20"
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-[#090A0D]/80 via-[#090A0D]/35 to-transparent"
              aria-hidden="true"
            />
          </>
        )}

        {/* Foreground Content shifted right of the floating sidebar */}
        <div className="relative z-10 w-full px-4 sm:px-8 lg:pl-[284px] lg:pr-10 pt-16 sm:pt-20 pb-6 sm:pb-8 space-y-5 sm:space-y-8">
          {/* Hero Typography & Actions */}
          {currentHero && (
            <div className="max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-zinc-200/90">
                <span className="font-semibold text-white">
                  {currentHero.kind === 'movie' ? 'Indicação de Filme' : 'Indicação de Série'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{currentHero.data.category}</span>
                {currentHero.data.year && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{currentHero.data.year}</span>
                  </>
                )}
                {currentHero.data.rating && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">Nota {currentHero.data.rating}</span>
                  </>
                )}
              </div>

              <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white text-balance drop-shadow-sm">
                {currentHero.data.title}
              </h1>

              {currentHero.data.synopsis && (
                <p className="text-sm sm:text-base text-zinc-200 leading-relaxed line-clamp-2 sm:line-clamp-3 max-w-xl">
                  {currentHero.data.synopsis}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  data-tv-focus="true"
                  onClick={handlePlayHero}
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white hover:bg-zinc-200 text-sm font-semibold text-black transition-all duration-150 tv-focusable whitespace-nowrap shadow-lg"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{currentHero.kind === 'movie' ? 'Assistir agora' : 'Ver episódios'}</span>
                </button>

                {currentHero.kind === 'movie' && (
                  <button
                    type="button"
                    data-tv-focus="true"
                    onClick={() => onSelectMovieDetails(currentHero.data)}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/15 text-sm font-medium text-white transition-all duration-150 tv-focusable whitespace-nowrap"
                  >
                    <Info className="w-4 h-4" />
                    <span>Detalhes</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Centered Hero Carousel Indicators */}
          {heroCandidates.length > 1 && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                data-tv-focus="true"
                onClick={() =>
                  setHeroIndex((prev) => (prev - 1 + heroCandidates.length) % heroCandidates.length)
                }
                aria-label="Destaque anterior"
                className="p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-zinc-300 hover:text-white tv-focusable"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/35 backdrop-blur-md">
                {heroCandidates.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setHeroIndex(idx)}
                    aria-label={`Destaque ${idx + 1}`}
                    className={`h-1.5 rounded-full transition-all duration-150 ${
                      idx === heroIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                data-tv-focus="true"
                onClick={() => setHeroIndex((prev) => (prev + 1) % heroCandidates.length)}
                aria-label="Próximo destaque"
                className="p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-zinc-300 hover:text-white tv-focusable"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Continuar Assistindo Shelf resting inside the lower Hero gradient (Apple TV style) */}
          {continueWatching.length > 0 && (
            <div aria-labelledby="heading-continue-watching" className="space-y-3 pt-2">
              <h2
                id="heading-continue-watching"
                className="font-display text-lg sm:text-xl font-semibold text-white tracking-tight"
              >
                Continuar assistindo
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {continueWatching.slice(0, 4).map((item) => {
                  const pct =
                    item.durationSeconds > 0
                      ? Math.min(
                          96,
                          Math.max(6, Math.round((item.progressSeconds / item.durationSeconds) * 100)),
                        )
                      : 35;

                  return (
                    <div key={item.id} className="group relative">
                      <button
                        type="button"
                        data-tv-focus="true"
                        onClick={() => onResumeItem(item)}
                        className="w-full text-left tv-focusable rounded-xl block"
                      >
                        <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-[#151821] border border-white/[0.12] group-hover:border-white/60 group-hover:scale-[1.03] transition-all duration-150 shadow-lg">
                          <MediaImage
                            src={item.backdrop || item.poster}
                            alt={item.title}
                            fallbackTitle={item.title}
                            variant="backdrop"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />

                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white text-black shadow-lg">
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            </span>
                          </div>

                          {/* Floating rounded white progress bar inside bottom edge (matching reference) */}
                          <div className="absolute left-3 right-3 bottom-2.5 h-1 rounded-full bg-white/30 overflow-hidden">
                            <div
                              className="h-full bg-white rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <p className="mt-2.5 text-sm font-semibold text-white truncate">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-400 truncate">
                          {formatProgressLabel(item)}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveContinueWatching(item.id);
                        }}
                        aria-label={`Remover ${item.title}`}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-zinc-300 hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Below-the-fold Recommendations Shelves */}
      <div className="px-5 sm:px-8 lg:pl-[284px] lg:pr-10 space-y-12 pt-8">
        {/* Indicações de Filmes */}
        <section aria-labelledby="heading-rec-movies" className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2
              id="heading-rec-movies"
              className="font-display text-xl font-semibold text-white tracking-tight"
            >
              Indicações de filmes
            </h2>
            <button
              type="button"
              data-tv-focus="true"
              onClick={() => onNavigate('movies')}
              className="text-xs sm:text-sm font-medium text-zinc-400 hover:text-white transition-colors whitespace-nowrap tv-focusable rounded-md px-2 py-1"
            >
              Ver todos ({movies.length})
            </button>
          </div>

          {recommendedMovies.length === 0 ? (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
              <p className="text-sm text-zinc-400">
                Nenhum filme disponível nesta lista.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
              {recommendedMovies.map((movie) => (
                <button
                  key={movie.id}
                  type="button"
                  data-tv-focus="true"
                  onClick={() => onSelectMovieDetails(movie)}
                  className="group text-left tv-focusable rounded-xl"
                >
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[#151821] border border-white/[0.08] group-hover:border-white/60 group-hover:scale-[1.03] transition-all duration-150">
                    <MediaImage
                      src={movie.poster}
                      alt={movie.title}
                      fallbackTitle={movie.title}
                      variant="poster"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-60 group-hover:opacity-90 transition-opacity" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white text-black shadow-lg">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </span>
                    </div>
                  </div>
                  <p className="mt-2.5 text-sm font-medium text-zinc-100 truncate">
                    {movie.title}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400 truncate">
                    {[movie.year, movie.category].filter(Boolean).join(' · ') || 'Filme'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Indicações de Séries */}
        <section aria-labelledby="heading-rec-series" className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2
              id="heading-rec-series"
              className="font-display text-xl font-semibold text-white tracking-tight"
            >
              Indicações de séries
            </h2>
            <button
              type="button"
              data-tv-focus="true"
              onClick={() => onNavigate('series')}
              className="text-xs sm:text-sm font-medium text-zinc-400 hover:text-white transition-colors whitespace-nowrap tv-focusable rounded-md px-2 py-1"
            >
              Ver todas ({series.length})
            </button>
          </div>

          {recommendedSeries.length === 0 ? (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
              <p className="text-sm text-zinc-400">
                Nenhuma série disponível nesta lista.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
              {recommendedSeries.map((item) => {
                const seasonCount = Object.keys(item.seasons).length;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-tv-focus="true"
                    onClick={() => onSelectSeries(item)}
                    className="group text-left tv-focusable rounded-xl"
                  >
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[#151821] border border-white/[0.08] group-hover:border-white/60 group-hover:scale-[1.03] transition-all duration-150">
                      <MediaImage
                        src={item.poster}
                        alt={item.title}
                        fallbackTitle={item.title}
                        variant="poster"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-60 group-hover:opacity-90 transition-opacity" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white text-black shadow-lg">
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </span>
                      </div>
                    </div>
                    <p className="mt-2.5 text-sm font-medium text-zinc-100 truncate">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400 truncate">
                      {seasonCount > 0
                        ? `${seasonCount} ${seasonCount === 1 ? 'temporada' : 'temporadas'} · ${item.category}`
                        : item.category}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Canais de TV ao Vivo */}
        <section aria-labelledby="heading-home-channels" className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2
              id="heading-home-channels"
              className="font-display text-xl font-semibold text-white tracking-tight"
            >
              Canais de TV ao vivo
            </h2>
            <button
              type="button"
              data-tv-focus="true"
              onClick={() => onNavigate('live')}
              className="text-xs sm:text-sm font-medium text-zinc-400 hover:text-white transition-colors whitespace-nowrap tv-focusable rounded-md px-2 py-1"
            >
              Ver guia completo ({channels.length})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredChannels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                data-tv-focus="true"
                onClick={() =>
                  onPlay({
                    mediaType: 'channel',
                    itemId: ch.id,
                    title: ch.name,
                    subtitle: ch.currentProgram || ch.group,
                    streamUrl: ch.streamUrl,
                    poster: ch.logo,
                    channelItem: ch,
                  })
                }
                className="group flex items-center gap-4 p-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] hover:border-white/40 text-left transition-all duration-150 tv-focusable"
              >
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-black/40 border border-white/[0.08] shrink-0 flex items-center justify-center">
                  {ch.logo ? (
                    <MediaImage
                      src={ch.logo}
                      alt={ch.name}
                      fallbackTitle={ch.name}
                      variant="logo"
                      className="w-full h-full object-contain p-1.5"
                    />
                  ) : (
                    <Tv className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {ch.channelNumber && (
                      <span className="text-xs font-mono tabular-nums text-zinc-400">
                        {ch.channelNumber}
                      </span>
                    )}
                    <p className="text-sm font-medium text-white truncate">{ch.name}</p>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400 truncate">
                    {ch.currentProgram || ch.group}
                  </p>
                </div>

                <Play className="w-4 h-4 text-zinc-400 group-hover:text-white shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
