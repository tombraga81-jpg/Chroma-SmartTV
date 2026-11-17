import { useMemo, useState } from 'react';
import { Film, Play, Star } from 'lucide-react';
import type { MovieItem } from '../types/iptv';
import { MediaImage } from './MediaImage';

interface MoviesViewProps {
  movies: MovieItem[];
  searchQuery: string;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onSelectMovie: (movie: MovieItem) => void;
  onOpenAddPlaylist: () => void;
}

export function MoviesView({
  movies,
  searchQuery,
  favorites,
  onToggleFavorite,
  onSelectMovie,
  onOpenAddPlaylist,
}: MoviesViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [sortBy, setSortBy] = useState<'default' | 'az' | 'favorites'>('default');

  const categories = useMemo(() => {
    const cats = Array.from(new Set(movies.map((m) => m.category || 'Filmes')));
    return ['Todos', ...cats];
  }, [movies]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = movies.filter((m) => {
      if (sortBy === 'favorites' && !favorites.includes(m.id)) return false;
      if (selectedCategory !== 'Todos' && (m.category || 'Filmes') !== selectedCategory) return false;
      if (q && !m.title.toLowerCase().includes(q) && !m.category.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    if (sortBy === 'az') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    }
    return list;
  }, [movies, searchQuery, selectedCategory, sortBy, favorites]);

  if (movies.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-12 text-center max-w-xl mx-auto mt-8">
        <Film className="w-10 h-10 text-zinc-500 mx-auto" />
        <h2 className="mt-4 font-display text-xl font-semibold text-white">
          Nenhum filme disponível nesta lista
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Conecte uma lista M3U com filmes ou uma conta Xtream Codes para navegar pelo catálogo de filmes.
        </p>
        <button
          type="button"
          onClick={onOpenAddPlaylist}
          className="mt-6 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-sm font-medium text-white transition-colors"
        >
          Conectar Lista
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Filter & Sort Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.slice(0, 24).map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 tv-focusable ${
                  active
                    ? 'bg-rose-600 text-white'
                    : 'bg-[#14171F] text-zinc-400 hover:text-white border border-white/[0.06]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#14171F] border border-white/[0.06]">
            <button
              type="button"
              onClick={() => setSortBy('default')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                sortBy === 'default' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Destaques
            </button>
            <button
              type="button"
              onClick={() => setSortBy('az')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                sortBy === 'az' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              A–Z
            </button>
            <button
              type="button"
              onClick={() => setSortBy('favorites')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                sortBy === 'favorites' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Favoritos
            </button>
          </div>

          <span className="text-xs text-zinc-400 font-mono tabular-nums whitespace-nowrap">
            {filtered.length} filmes
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.07] bg-[#12141A] p-10 text-center">
          <p className="text-sm text-zinc-400">Nenhum filme corresponde à busca atual.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filtered.slice(0, 180).map((movie) => {
            const isFav = favorites.includes(movie.id);
            return (
              <div key={movie.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelectMovie(movie)}
                  className="w-full text-left tv-focusable rounded-xl"
                >
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[#13161E] border border-white/[0.07] group-hover:border-white/25 transition-colors">
                    <MediaImage
                      src={movie.poster}
                      alt={movie.title}
                      fallbackTitle={movie.title}
                      variant="poster"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-90 transition-opacity" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-rose-600 text-white">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </span>
                    </div>
                  </div>
                  <p className="mt-2.5 text-sm font-medium text-zinc-100 truncate">
                    {movie.title}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400 truncate">
                    {[movie.year, movie.category, movie.rating ? `Nota ${movie.rating}` : undefined]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(movie.id);
                  }}
                  aria-label={isFav ? `Remover ${movie.title} dos favoritos` : `Favoritar ${movie.title}`}
                  className={`absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/65 backdrop-blur-xs transition-opacity ${
                    isFav
                      ? 'text-amber-400 opacity-100'
                      : 'text-zinc-300 opacity-0 group-hover:opacity-100 hover:text-white'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
