import {
  Clapperboard,
  Film,
  Home,
  Plus,
  Search,
  Settings,
  Tv,
  User,
  X,
} from 'lucide-react';
import type { NavSection, PlaylistSource } from '../types/iptv';
import { useTvClock } from '../utils/tizenTv';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  playlists: PlaylistSource[];
  activePlaylist: PlaylistSource;
  onSelectPlaylist: (id: string) => void;
  onOpenAddPlaylist: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: typeof Home;
}> = [
  { id: 'search', label: 'Buscar', icon: Search },
  { id: 'home', label: 'Início', icon: Home },
  { id: 'live', label: 'Canais de TV', icon: Tv },
  { id: 'movies', label: 'Filmes', icon: Film },
  { id: 'series', label: 'Séries', icon: Clapperboard },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  playlists,
  activePlaylist,
  onSelectPlaylist,
  onOpenAddPlaylist,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const clock = useTvClock();

  const panelContent = (
    <div className="flex flex-col h-full w-[240px] rounded-[22px] bg-[#141418]/78 backdrop-blur-2xl border border-white/[0.14] shadow-[0_24px_64px_rgba(0,0,0,0.7)] overflow-hidden">
      {/* Profile & Live TV Clock (tvOS / Tizen style) */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/15 text-white shrink-0">
            <User className="w-3.5 h-3.5" />
          </span>
          <span className="font-display text-sm font-semibold text-white truncate">
            CromaTV
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono tabular-nums text-zinc-300">
            {clock}
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1 rounded-md text-zinc-400 hover:text-white"
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Navigation + Connected Playlists (landscape mobile safe) */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col justify-between">
        <nav
          className="px-2.5 py-2.5 space-y-1 shrink-0"
          aria-label="Menu principal"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-tv-focus="true"
                onClick={() => {
                  onSelectSection(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 tv-focusable whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-black font-semibold shadow-md'
                    : 'text-zinc-200/85 hover:text-white hover:bg-white/[0.12]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-black' : 'text-zinc-300'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Connected Playlists Section */}
        <div className="px-2.5 pt-2 pb-3 border-t border-white/[0.08] flex flex-col gap-3 shrink-0">
          <div className="space-y-1">
            <p className="px-3 pt-1 pb-1 text-xs font-medium text-zinc-400">
              Listas &amp; Fontes
            </p>
            {playlists.slice(0, 4).map((pl, idx) => {
              const isSelected = pl.id === activePlaylist.id;
              const badgeColors = [
                'bg-rose-600',
                'bg-sky-600',
                'bg-amber-600',
                'bg-emerald-600',
              ];
              return (
                <button
                  key={pl.id}
                  type="button"
                  data-tv-focus="true"
                  onClick={() => {
                    onSelectPlaylist(pl.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors duration-150 tv-focusable ${
                    isSelected
                      ? 'bg-white/[0.16] text-white'
                      : 'text-zinc-300 hover:bg-white/[0.09] hover:text-white'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-md ${badgeColors[idx % badgeColors.length]} flex items-center justify-center text-[11px] font-bold text-white shrink-0`}
                  >
                    {pl.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{pl.name}</p>
                    <p className="text-[11px] text-zinc-400 font-mono tabular-nums truncate">
                      {pl.stats.channels} TV · {pl.stats.movies + pl.stats.series} VOD
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            data-tv-focus="true"
            onClick={() => {
              onOpenAddPlaylist();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.1] hover:bg-white/[0.18] border border-white/[0.12] text-xs font-medium text-white transition-colors tv-focusable whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Conectar M3U / Xtream</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop / Samsung Tizen TV Floating Glass Rail */}
      <aside
        className="hidden lg:block fixed left-5 top-5 bottom-5 z-30"
        aria-label="Barra lateral de navegação"
      >
        {panelContent}
      </aside>

      {/* Mobile/Tablet Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex p-3">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{panelContent}</div>
        </div>
      )}
    </>
  );
}
