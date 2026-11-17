import { useEffect, useState } from 'react';

interface TizenTvInputDevice {
  registerKey?: (keyName: string) => void;
  registerKeyBatch?: (keys: string[]) => void;
}

interface TizenApplication {
  getCurrentApplication?: () => { exit: () => void };
}

interface TizenGlobal {
  tvinputdevice?: TizenTvInputDevice;
  application?: TizenApplication;
}

declare global {
  interface Window {
    tizen?: TizenGlobal;
  }
}

export function isTizenEnvironment(): boolean {
  return typeof window !== 'undefined' && Boolean(window.tizen);
}

export function registerTizenRemoteKeys(): void {
  const tvInput = window.tizen?.tvinputdevice;
  if (!tvInput) return;

  const keysToRegister = [
    'MediaPlayPause',
    'MediaPlay',
    'MediaPause',
    'MediaStop',
    'MediaRewind',
    'MediaFastForward',
    'ChannelUp',
    'ChannelDown',
    'ColorF0Red',
    'ColorF1Green',
    'ColorF2Yellow',
    'ColorF3Blue',
  ];

  try {
    if (typeof tvInput.registerKeyBatch === 'function') {
      tvInput.registerKeyBatch(keysToRegister);
    } else if (typeof tvInput.registerKey === 'function') {
      keysToRegister.forEach((k) => {
        try {
          tvInput.registerKey?.(k);
        } catch {
          // Ignore unsupported key on older TV models
        }
      });
    }
  } catch {
    // Ignore when running outside real Tizen TV
  }
}

export function exitTizenApp(): void {
  try {
    window.tizen?.application?.getCurrentApplication?.().exit();
  } catch {
    // No-op in browser preview
  }
}

export function useTvClock(): string {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setTime(
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      );
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  return time;
}

function getFocusableElements(): HTMLElement[] {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-tv-focus="true"]:not([disabled]), button.tv-focusable:not([disabled]), input.tv-focusable:not([disabled]), select.tv-focusable:not([disabled])',
    ),
  );
  return nodes.filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
  });
}

function findNextSpatialElement(
  current: HTMLElement,
  direction: 'up' | 'down' | 'left' | 'right',
): HTMLElement | null {
  const candidates = getFocusableElements().filter((el) => el !== current);
  if (candidates.length === 0) return null;

  const cur = current.getBoundingClientRect();
  const cx = cur.left + cur.width / 2;
  const cy = cur.top + cur.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    const tx = r.left + r.width / 2;
    const ty = r.top + r.height / 2;
    const dx = tx - cx;
    const dy = ty - cy;

    let isValid = false;
    let primary = 0;
    let secondary = 0;

    if (direction === 'right') {
      isValid = dx > 8;
      primary = dx;
      secondary = Math.abs(dy);
    } else if (direction === 'left') {
      isValid = dx < -8;
      primary = -dx;
      secondary = Math.abs(dy);
    } else if (direction === 'down') {
      isValid = dy > 8;
      primary = dy;
      secondary = Math.abs(dx);
    } else if (direction === 'up') {
      isValid = dy < -8;
      primary = -dy;
      secondary = Math.abs(dx);
    }

    if (!isValid) continue;

    // Weight secondary axis alignment heavily for clean row/column TV D-pad jumps
    const score = primary + secondary * 2.4;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best;
}

export function useTizenNavigation(options: {
  disabled: boolean;
  onBack: () => void;
}) {
  const { disabled, onBack } = options;

  useEffect(() => {
    registerTizenRemoteKeys();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Samsung Tizen Back key is 10009
      if (e.keyCode === 10009 || e.key === 'XF86Back' || e.key === 'Escape') {
        e.preventDefault();
        onBack();
        return;
      }

      if (disabled) return;

      const active = document.activeElement as HTMLElement | null;
      const isTyping =
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT');

      if (isTyping && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        return;
      }

      let dir: 'up' | 'down' | 'left' | 'right' | null = null;
      if (e.key === 'ArrowUp') dir = 'up';
      else if (e.key === 'ArrowDown') dir = 'down';
      else if (e.key === 'ArrowLeft') dir = 'left';
      else if (e.key === 'ArrowRight') dir = 'right';

      if (!dir) return;

      e.preventDefault();
      const focusables = getFocusableElements();
      if (focusables.length === 0) return;

      if (!active || !focusables.includes(active)) {
        focusables[0].focus();
        focusables[0].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        return;
      }

      const next = findNextSpatialElement(active, dir);
      if (next) {
        next.focus();
        next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, onBack]);
}
