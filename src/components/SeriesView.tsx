import { useMemo, useState } from 'react';
import { Clapperboard, Play, Star } from 'lucide-react';
import type { SeriesItem } from '../types/iptv';
import { MediaImage } from './MediaImage';

interface SeriesViewProps {
  series: SeriesItem[];
  searchQuery: string;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onSelectSeries: (series: SeriesItem) => void;
  onOpenAddPlaylist: () => void;
}

export function SeriesView({
  series,
  searchQuery,
  favorites,
  onToggleFavorite,
  onSelectSeries,
  onOpenAddPlaylist,
}: SeriesViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(series.map((s) => s.category || 'Séries')));
    return ['Todos', ...cats];
  }, [series]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return series.filter((s) => {
      if (onlyFavorites && !favorites.includes(s.id)) return false;
      if (selectedCategory !== 'Todos' && (s.category || 'Séries') !== selectedCategory) return false;
      if (q && !s.title.toLowerCase().includes(q) && !s.category.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [series, searchQuery, selectedCategory, onlyFavorites, favorites]);

  if (series.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-12 text-center max-w-xl mx-auto mt-8">
        <Clapperboard className="w-10 h-10 text-zinc-500 mx-auto" />
        <h2 className="mt-4 font-display text-xl font-semibold text-white">
          Nenhuma série disponível nesta lista
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Conecte uma lista M3U ou conta Xtream Codes com séries para explorar temporadas e episódios.
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
          <button
            type="button"
            onClick={() => setOnlyFavorites((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
              onlyFavorites
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-[#14171F] border-white/[0.07] text-zinc-400 hover:text-white'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-current' : ''}`} />
            <span>Favoritas</span>
          </button>

          <span className="text-xs text-zinc-400 font-mono tabular-nums whitespace-nowrap">
            {filtered.length} séries
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.07] bg-[#12141A] p-10 text-center">
          <p className="text-sm text-zinc-400">Nenhuma série corresponde ao filtro atual.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filtered.slice(0, 180).map((item) => {
            const isFav = favorites.includes(item.id);
            const seasonCount = Object.keys(item.seasons).length;
            return (
              <div key={item.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelectSeries(item)}
                  className="w-full text-left tv-focusable rounded-xl"
                >
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[#13161E] border border-white/[0.07] group-hover:border-white/25 transition-colors">
                    <MediaImage
                      src={item.poster}
                      alt={item.title}
                      fallbackTitle={item.title}
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
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400 truncate">
                    {[
                      seasonCount > 0
                        ? `${seasonCount} ${seasonCount === 1 ? 'temporada' : 'temporadas'}`
                        : undefined,
                      item.category,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(item.id);
                  }}
                  aria-label={isFav ? `Remover ${item.title} das favoritas` : `Favoritar ${item.title}`}
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
