import { useState } from 'react';
import { Film, Tv } from 'lucide-react';

interface MediaImageProps {
  src?: string;
  alt: string;
  fallbackTitle?: string;
  variant?: 'poster' | 'backdrop' | 'logo';
  className?: string;
}

export function MediaImage({
  src,
  alt,
  fallbackTitle,
  variant = 'poster',
  className = '',
}: MediaImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    const initials = (fallbackTitle || alt)
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('');

    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#1A1D26] via-[#13161E] to-[#0D0F14] text-zinc-400 select-none ${className}`}
        aria-label={alt}
      >
        {variant === 'logo' ? (
          <div className="flex flex-col items-center gap-1.5 px-2 text-center">
            <Tv className="w-5 h-5 text-zinc-500" />
            <span className="text-[11px] font-medium text-zinc-300 line-clamp-1">
              {initials || 'TV'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <Film className="w-6 h-6 text-zinc-600" />
            <span className="text-xs font-medium text-zinc-400 line-clamp-2 max-w-[14ch]">
              {fallbackTitle || alt}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
