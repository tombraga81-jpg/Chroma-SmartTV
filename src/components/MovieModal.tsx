import { Play, Star, X } from 'lucide-react';
import type { ActivePlayback, ContinueWatchingItem, MovieItem } from '../types/iptv';
import { MediaImage } from './MediaImage';

interface MovieModalProps {
  movie: MovieItem;
  isFavorite: boolean;
  savedProgress?: ContinueWatchingItem;
  onToggleFavorite: () => void;
  onPlay: (playback: ActivePlayback) => void;
  onClose: () => void;
}

export function MovieModal({
  movie,
  isFavorite,
  savedProgress,
  onToggleFavorite,
  onPlay,
  onClose,
}: MovieModalProps) {
  const startPlayback = (resume: boolean) => {
    onPlay({
      mediaType: 'movie',
      itemId: movie.id,
      title: movie.title,
      subtitle: [movie.category, movie.year].filter(Boolean).join(' · '),
      streamUrl: movie.streamUrl,
      poster: movie.poster,
      backdrop: movie.backdrop || movie.poster,
      startAtSeconds: resume && savedProgress ? savedProgress.progressSeconds : 0,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={movie.title}
    >
      <div className="relative w-full max-w-2xl max-h-[92dvh] flex flex-col rounded-2xl overflow-hidden bg-[#12141A] border border-white/[0.1] shadow-2xl">
        <div className="relative h-36 sm:h-60 shrink-0 bg-[#0A0B0E]">
          <MediaImage
            src={movie.backdrop || movie.poster}
            alt={movie.title}
            fallbackTitle={movie.title}
            variant="backdrop"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#12141A] via-[#12141A]/55 to-black/25" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes do filme"
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-full bg-black/60 hover:bg-black/85 text-white border border-white/15 transition-colors tv-focusable"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
              <span>{movie.category}</span>
              {movie.year && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{movie.year}</span>
                </>
              )}
              {movie.duration && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{movie.duration}</span>
                </>
              )}
              {movie.rating && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">Nota {movie.rating}</span>
                </>
              )}
            </div>
            <h2 className="font-display text-xl sm:text-3xl font-bold text-white truncate">
              {movie.title}
            </h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {movie.synopsis && (
            <p className="text-sm text-zinc-300 leading-relaxed">{movie.synopsis}</p>
          )}

          {movie.director && (
            <p className="text-xs text-zinc-400">
              Direção: <span className="text-zinc-200">{movie.director}</span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {savedProgress && savedProgress.progressSeconds > 10 ? (
              <>
                <button
                  type="button"
                  onClick={() => startPlayback(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-sm font-semibold text-white transition-colors tv-focusable"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Continuar</span>
                </button>
                <button
                  type="button"
                  onClick={() => startPlayback(false)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium text-white transition-colors tv-focusable"
                >
                  <span>Assistir do início</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => startPlayback(false)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-sm font-semibold text-white transition-colors tv-focusable"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Assistir agora</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleFavorite}
              aria-label={isFavorite ? 'Remover dos favoritos' : 'Favoritar filme'}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors tv-focusable ${
                isFavorite
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-white/[0.06] border-white/10 text-zinc-300 hover:text-white'
              }`}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              <span>{isFavorite ? 'Favoritado' : 'Favoritar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
