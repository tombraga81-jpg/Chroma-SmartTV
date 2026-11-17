import { useState } from 'react';
import {
  Check,
  Download,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { PlayerSettings, PlaylistSource } from '../types/iptv';
import { DEMO_PLAYLIST_ID } from '../data/demoCatalog';

interface SettingsViewProps {
  playlists: PlaylistSource[];
  activePlaylistId: string;
  settings: PlayerSettings;
  onUpdateSettings: (next: Partial<PlayerSettings>) => void;
  onSelectPlaylist: (id: string) => void;
  onSyncPlaylist: (id: string) => Promise<void>;
  onDeletePlaylist: (id: string) => void;
  onOpenAddPlaylist: () => void;
  onClearHistory: () => void;
  onClearFavorites: () => void;
}

const TIZEN_CONFIG_XML = `<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets" id="http://cromatv.app/player" version="1.0.0" viewmodes="maximized">
  <tizen:application id="cromatv001.CromaTVPlayer" package="cromatv001" required_version="5.5"/>
  <content src="index.html"/>
  <feature name="http://tizen.org/feature/screen.size.normal.1080.1920"/>
  <icon src="icon.png"/>
  <name>CromaTV</name>
  <tizen:privilege name="http://tizen.org/privilege/internet"/>
  <tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>
  <tizen:profile name="tv-samsung"/>
  <tizen:setting screen-orientation="landscape" context-menu="disable" background-support="disable" encryption="disable" install-location="auto" hwkey-event="enable"/>
</widget>
`;

export function SettingsView({
  playlists,
  activePlaylistId,
  settings,
  onUpdateSettings,
  onSelectPlaylist,
  onSyncPlaylist,
  onDeletePlaylist,
  onOpenAddPlaylist,
  onClearHistory,
  onClearFavorites,
}: SettingsViewProps) {
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSync = async (id: string) => {
    setSyncingId(id);
    setNotice(null);
    try {
      await onSyncPlaylist(id);
      setNotice('Lista sincronizada com sucesso.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Erro ao sincronizar lista.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDownloadTizenConfig = () => {
    const blob = new Blob([TIZEN_CONFIG_XML], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.xml';
    a.click();
    URL.revokeObjectURL(url);
    setNotice('Arquivo config.xml baixado para uso no Tizen Studio.');
  };

  return (
    <div className="max-w-4xl space-y-10 pb-12">
      {notice && (
        <div className="rounded-xl border border-white/15 bg-[#151922] px-4 py-3 text-sm text-zinc-200 flex items-center justify-between gap-4">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs text-zinc-400 hover:text-white"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Playlists Manager */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">
              Listas .M3U e Xtream Codes
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Gerencie suas fontes conectadas ou alterne rapidamente entre listas salvas.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAddPlaylist}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-sm font-medium text-white transition-colors tv-focusable"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Lista</span>
          </button>
        </div>

        <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#12141A] overflow-hidden">
          {playlists.map((pl) => {
            const isActive = pl.id === activePlaylistId;
            const isDemo = pl.id === DEMO_PLAYLIST_ID;
            const typeLabel =
              pl.type === 'xtream'
                ? 'Xtream Codes'
                : pl.type === 'm3u_url'
                  ? 'URL M3U'
                  : pl.type === 'm3u_file'
                    ? 'Arquivo M3U'
                    : 'Catálogo Aberto';

            return (
              <div
                key={pl.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2.5">
                    <p className="text-sm font-semibold text-white truncate">{pl.name}</p>
                    {isActive && (
                      <span className="text-xs font-medium text-rose-400">Em uso</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 font-mono tabular-nums truncate">
                    {typeLabel} · {pl.stats.channels} canais · {pl.stats.movies} filmes ·{' '}
                    {pl.stats.series} séries
                    {pl.expiresAt ? ` · Expira em ${pl.expiresAt}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => onSelectPlaylist(pl.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Ativar</span>
                    </button>
                  )}

                  {(pl.type === 'xtream' || pl.type === 'm3u_url') && (
                    <button
                      type="button"
                      disabled={syncingId === pl.id}
                      onClick={() => handleSync(pl.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-[#181C26] hover:bg-white/[0.08] text-xs font-medium text-zinc-200 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${syncingId === pl.id ? 'animate-spin' : ''}`}
                      />
                      <span>Sincronizar</span>
                    </button>
                  )}

                  {!isDemo && (
                    <button
                      type="button"
                      onClick={() => onDeletePlaylist(pl.id)}
                      aria-label={`Remover lista ${pl.name}`}
                      className="p-2 rounded-lg border border-white/[0.08] text-zinc-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Player & Network Preferences */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Reprodução e Rede
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Ajuste o comportamento do player de vídeo e compatibilidade com servidores externos.
          </p>
        </div>

        <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#12141A]">
          <label className="p-5 flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-white">Proxy CORS do Servidor</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Encaminha listas e streams pelo servidor integrado para evitar bloqueios de CORS do navegador.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.useCorsProxy}
              onChange={(e) => onUpdateSettings({ useCorsProxy: e.target.checked })}
              className="w-5 h-5 accent-rose-600 rounded cursor-pointer shrink-0"
            />
          </label>

          <label className="p-5 flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-white">Reprodução automática em séries</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Avança automaticamente para o próximo episódio ao concluir o episódio atual.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoPlayNext}
              onChange={(e) => onUpdateSettings({ autoPlayNext: e.target.checked })}
              className="w-5 h-5 accent-rose-600 rounded cursor-pointer shrink-0"
            />
          </label>

          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Qualidade padrão (HLS)</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Define a seleção inicial de taxa de bits em canais e filmes adaptativos.
              </p>
            </div>
            <select
              value={settings.preferredQuality}
              onChange={(e) =>
                onUpdateSettings({
                  preferredQuality: e.target.value as PlayerSettings['preferredQuality'],
                })
              }
              className="h-9 px-3 rounded-lg bg-[#0A0B0E] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-rose-500"
            >
              <option value="auto">Automática</option>
              <option value="high">Máxima disponível</option>
              <option value="medium">Economia de banda</option>
            </select>
          </div>
        </div>
      </section>

      {/* Smart TV / Tizen & Storage */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5 space-y-4">
          <div className="space-y-1.5">
            <h3 className="font-display text-base font-semibold text-white">
              Samsung Smart TV (Tizen Web App)
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Controle remoto Samsung suportado: use as setas direcionais (D-pad) para navegar, OK/Enter para reproduzir e Voltar/Return (tecla 10009) para retornar.
            </p>
            <p className="text-xs text-zinc-300 font-mono">
              Ambiente atual:{' '}
              {typeof window !== 'undefined' && 'tizen' in window
                ? 'Samsung Tizen TV'
                : 'Preview Web (pronto para empacotar em .wgt)'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadTizenConfig}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-xs font-medium text-white transition-colors tv-focusable"
            >
              <Download className="w-4 h-4 text-rose-500" />
              <span>Baixar config.xml (Tizen Studio)</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#12141A] p-5 space-y-4">
          <div>
            <h3 className="font-display text-base font-semibold text-white">
              Histórico Local
            </h3>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              Remova itens salvos em &ldquo;Continuar assistindo&rdquo; ou redefina seus favoritos armazenados neste navegador.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClearHistory();
                setNotice('Histórico de Continuar Assistindo limpo.');
              }}
              className="px-3.5 py-2 rounded-lg border border-white/[0.08] bg-[#181C26] hover:bg-white/[0.08] text-xs font-medium text-zinc-200 transition-colors"
            >
              Limpar histórico
            </button>
            <button
              type="button"
              onClick={() => {
                onClearFavorites();
                setNotice('Lista de favoritos redefinida.');
              }}
              className="px-3.5 py-2 rounded-lg border border-white/[0.08] bg-[#181C26] hover:bg-white/[0.08] text-xs font-medium text-zinc-200 transition-colors"
            >
              Limpar favoritos
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
