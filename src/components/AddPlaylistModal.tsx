import { useState, type ChangeEvent, type FormEvent } from 'react';
import { FileUp, Link2, Loader2, Server, X } from 'lucide-react';

interface AddPlaylistModalProps {
  onClose: () => void;
  onAddM3uUrl: (name: string, url: string) => Promise<void>;
  onAddM3uContent: (name: string, content: string) => Promise<void>;
  onAddXtream: (params: {
    name: string;
    serverUrl: string;
    username: string;
    password: string;
  }) => Promise<void>;
}

type TabType = 'xtream' | 'm3u_url' | 'm3u_file';

export function AddPlaylistModal({
  onClose,
  onAddM3uUrl,
  onAddM3uContent,
  onAddXtream,
}: AddPlaylistModalProps) {
  const [tab, setTab] = useState<TabType>('xtream');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Xtream form
  const [xtName, setXtName] = useState('');
  const [xtServer, setXtServer] = useState('');
  const [xtUser, setXtUser] = useState('');
  const [xtPass, setXtPass] = useState('');

  // M3U URL form
  const [m3uName, setM3uName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');

  // M3U File / Text form
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!fileName) {
      setFileName(file.name.replace(/\.(m3u8?|txt)$/i, ''));
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileContent(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === 'xtream') {
        if (!xtServer.trim() || !xtUser.trim() || !xtPass.trim()) {
          throw new Error('Preencha servidor, usuário e senha.');
        }
        await onAddXtream({
          name: xtName.trim() || 'Lista Xtream',
          serverUrl: xtServer.trim(),
          username: xtUser.trim(),
          password: xtPass.trim(),
        });
      } else if (tab === 'm3u_url') {
        if (!m3uUrl.trim()) {
          throw new Error('Informe a URL da lista .m3u ou .m3u8.');
        }
        await onAddM3uUrl(m3uName.trim() || 'Minha Lista M3U', m3uUrl.trim());
      } else {
        if (!fileContent.trim()) {
          throw new Error('Selecione um arquivo .m3u/.m3u8 ou cole o conteúdo da lista.');
        }
        await onAddM3uContent(fileName.trim() || 'Lista Local M3U', fileContent);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível importar a lista.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Conectar lista M3U ou Xtream"
    >
      <div className="w-full max-w-lg max-h-[92dvh] flex flex-col rounded-2xl bg-[#12141A] border border-white/[0.1] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-white/[0.07] shrink-0">
          <h2 className="font-display text-base sm:text-lg font-semibold text-white">
            Conectar Lista M3U ou Xtream
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="px-5 sm:px-6 pt-4 shrink-0">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0A0B0E] border border-white/[0.06]">
            <button
              type="button"
              onClick={() => {
                setTab('xtream');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                tab === 'xtream' ? 'bg-rose-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Server className="w-3.5 h-3.5 shrink-0" />
              <span>Xtream Codes</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('m3u_url');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                tab === 'm3u_url' ? 'bg-rose-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Link2 className="w-3.5 h-3.5 shrink-0" />
              <span>URL .M3U</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('m3u_file');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                tab === 'm3u_file' ? 'bg-rose-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FileUp className="w-3.5 h-3.5 shrink-0" />
              <span>Arquivo .M3U</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {tab === 'xtream' && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Nome da lista (opcional)
                </label>
                <input
                  type="text"
                  value={xtName}
                  onChange={(e) => setXtName(e.target.value)}
                  placeholder="Ex: Sala Principal"
                  className="w-full h-10 px-3.5 rounded-lg bg-[#0A0B0E] border border-white/[0.1] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  URL do servidor
                </label>
                <input
                  type="url"
                  required
                  value={xtServer}
                  onChange={(e) => setXtServer(e.target.value)}
                  placeholder="http://servidor.exemplo.com:8080"
                  className="w-full h-10 px-3.5 rounded-lg bg-[#0A0B0E] border border-white/[0.1] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Usuário
                  </label>
                  <input
                    type="text"
                    required
                    value={xtUser}
                    onChange={(e) => setXtUser(e.target.value)}
                    placeholder="usuario"
                    className="w-full h-10 px-3.5 rounded-lg bg-[#0A0B0E] border border-white/[0.1] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Senha
                  </label>
                  <input
                    type="password"
                    required
                    value={xtPass}
                    onChange={(e) => setXtPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 px-3.5 rounded-lg bg-[#0A0B0E] border border-white/[0.1] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            </>
          )}

          {tab === 'm3u_url' && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Nome da lista (opcional)
                </label>
                <input
                  type="text"
                  value={m3uName}
                  onChange={(e) => setM3uName(e.target.value)}
                  placeholder="Ex: Canais Abertos"
                  className="w-full h-10 px-3.5 rounded-lg bg-[#0A0B0E] border border-white/[0.1] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Link da lista (.m3u ou .m3u8)
                </label>
                <input
                  type="url"
                  required
                  value={m3uUrl}
                  onChange={(e) => setM3uUrl(e.target.value)}
                  placeholder="https://exemplo.com/lista.m3u"
                  className="w-full h-10 px-3.5 rounded-lg bg-[#0A0B0E] border border-white/[0.1] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>
            </>
          )}

          {tab === 'm3u_file' && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Nome da lista (opcional)
                </label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Ex: Minha Lista Local"
                  className="w-full h-10 px-3.5 rounded-lg bg-[#0A0B0E] border border-white/[0.1] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Selecionar arquivo .m3u / .m3u8
                </label>
                <input
                  type="file"
                  accept=".m3u,.m3u8,.txt"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-white/10 file:text-white hover:file:bg-white/15 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Ou cole o conteúdo #EXTM3U
                </label>
                <textarea
                  rows={4}
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  placeholder="#EXTM3U&#10;#EXTINF:-1 group-title=&quot;Canais&quot;,Canal Exemplo&#10;https://..."
                  className="w-full p-3 rounded-lg bg-[#0A0B0E] border border-white/[0.1] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>
            </>
          )}

          {error && (
            <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-sm font-semibold text-white transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? 'Conectando...' : 'Importar Lista'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
