import { useMemo } from 'react';
import { Play, Search, Tv, X } from 'lucide-react';
import type { ActivePlayback, ChannelItem, MovieItem, SeriesItem } from '../types/iptv';
import { MediaImage } from './MediaImage';

interface SearchViewProps {
  query: string;
  onQueryChange: (q: string) => void;
  channels: ChannelItem[];
  movies: MovieItem[];
  series: SeriesItem[];
  onPlayChannel: (playback: ActivePlayback) => void;
  onSelectMovie: (movie: MovieItem) => void;
  onSelectSeries: (series: SeriesItem) => void;
}

export function SearchView({
  query,
  onQueryChange,
  channels,
  movies,
  series,
  onPlayChannel,
  onSelectMovie,
  onSelectSeries,
}: SearchViewProps) {
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        channels: channels.slice(0, 6),
        movies: movies.slice(0, 6),
        series: series.slice(0, 6),
        isFiltered: false,
      };
    }
    return {
      channels: channels.filter(
        (c) => c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
      ),
      movies: movies.filter(
        (m) => m.title.toLowerCase().includes(q) || m.category.toLowerCase().includes(q),
      ),
      series: series.filter(
        (s) => s.title.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
      ),
      isFiltered: true,
    };
  }, [query, channels, movies, series]);

  const noMatches =
    results.isFiltered &&
    results.channels.length === 0 &&
    results.movies.length === 0 &&
    results.series.length === 0;

  return (
    <div className="space-y-8 pb-16">
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-bold text-white tracking-tight">
          Buscar
        </h1>

        <div className="relative max-w-2xl">
          <Search className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Digite o nome de um canal, filme ou série..."
            aria-label="Buscar canais, filmes ou séries"
            className="w-full h-13 pl-12 pr-12 rounded-xl bg-white/[0.08] border border-white/15 text-base text-white placeholder:text-zinc-400 focus:outline-none focus:border-white focus:bg-white/[0.12] transition-colors tv-focusable"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Limpar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 tv-focusable"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {noMatches ? (
        <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-12 text-center">
          <p className="text-base text-zinc-300">
            Nenhum título ou canal encontrado para &ldquo;{query}&rdquo;.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {results.channels.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-display text-xl font-semibold text-white">
                {results.isFiltered ? `Canais (${results.channels.length})` : 'Canais em destaque'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {results.channels.slice(0, 18).map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() =>
                      onPlayChannel({
                        mediaType: 'channel',
                        itemId: ch.id,
                        title: ch.name,
                        subtitle: ch.currentProgram || ch.group,
                        streamUrl: ch.streamUrl,
                        poster: ch.logo,
                        channelItem: ch,
                      })
                    }
                    className="group flex items-center gap-4 p-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.08] hover:border-white/30 text-left transition-all duration-150 tv-focusable"
                  >
                    <div className="w-12 h-12 rounded-lg bg-black/40 border border-white/[0.08] flex items-center justify-center shrink-0 overflow-hidden">
                      {ch.logo ? (
                        <MediaImage
                          src={ch.logo}
                          alt={ch.name}
                          fallbackTitle={ch.name}
                          variant="logo"
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <Tv className="w-5 h-5 text-zinc-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{ch.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-400 truncate">
                        {ch.currentProgram || ch.group}
                      </p>
                    </div>
                    <Play className="w-4 h-4 text-zinc-400 group-hover:text-white shrink-0" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {results.movies.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-display text-xl font-semibold text-white">
                {results.isFiltered ? `Filmes (${results.movies.length})` : 'Filmes sugeridos'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-5">
                {results.movies.slice(0, 18).map((movie) => (
                  <button
                    key={movie.id}
                    type="button"
                    onClick={() => onSelectMovie(movie)}
                    className="group text-left tv-focusable rounded-xl p-1 -m-1"
                  >
                    <div className="aspect-[16/10] rounded-xl overflow-hidden bg-[#16181F] border border-white/[0.08] group-hover:border-white/50 group-hover:scale-[1.03] transition-all duration-150">
                      <MediaImage
                        src={movie.backdrop || movie.poster}
                        alt={movie.title}
                        fallbackTitle={movie.title}
                        variant="backdrop"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="mt-2.5 text-sm font-medium text-white truncate">{movie.title}</p>
                    <p className="text-xs text-zinc-400 truncate">{movie.category}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {results.series.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-display text-xl font-semibold text-white">
                {results.isFiltered ? `Séries (${results.series.length})` : 'Séries sugeridas'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-5">
                {results.series.slice(0, 18).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectSeries(item)}
                    className="group text-left tv-focusable rounded-xl p-1 -m-1"
                  >
                    <div className="aspect-[16/10] rounded-xl overflow-hidden bg-[#16181F] border border-white/[0.08] group-hover:border-white/50 group-hover:scale-[1.03] transition-all duration-150">
                      <MediaImage
                        src={item.backdrop || item.poster}
                        alt={item.title}
                        fallbackTitle={item.title}
                        variant="backdrop"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="mt-2.5 text-sm font-medium text-white truncate">{item.title}</p>
                    <p className="text-xs text-zinc-400 truncate">{item.category}</p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
