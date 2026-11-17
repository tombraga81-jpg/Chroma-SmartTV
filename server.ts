import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

function isValidHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function rewriteM3u8Manifest(manifestText: string, baseUrl: string): string {
  const base = new URL(baseUrl);
  return manifestText
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        // Rewrite URI="..." attributes inside #EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA, etc.
        return line.replace(/URI="([^"]+)"/g, (_match, uriValue: string) => {
          try {
            const resolved = new URL(uriValue, base).toString();
            return `URI="/api/proxy/stream?url=${encodeURIComponent(resolved)}"`;
          } catch {
            return `URI="${uriValue}"`;
          }
        });
      }
      try {
        const resolved = new URL(trimmed, base).toString();
        return `/api/proxy/stream?url=${encodeURIComponent(resolved)}`;
      } catch {
        return line;
      }
    })
    .join('\n');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Proxy M3U playlist download to bypass browser CORS restrictions
  app.post('/api/proxy/m3u', async (req, res) => {
    const { url } = req.body as { url?: string };
    if (!url || !isValidHttpUrl(url)) {
      res.status(400).json({ error: 'URL da lista M3U inválida. Use http:// ou https://.' });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
          Accept: '*/*',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        res.status(response.status).json({
          error: `Servidor retornou erro HTTP ${response.status}`,
        });
        return;
      }

      const content = await response.text();
      res.json({ content, finalUrl: response.url });
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'Tempo limite excedido ao baixar a lista M3U.'
          : err instanceof Error
            ? err.message
            : 'Falha ao buscar lista M3U.';
      res.status(502).json({ error: message });
    } finally {
      clearTimeout(timeout);
    }
  });

  // Proxy Xtream Codes player_api.php calls
  app.post('/api/proxy/xtream', async (req, res) => {
    const { serverUrl, username, password, action, extraParams } = req.body as {
      serverUrl?: string;
      username?: string;
      password?: string;
      action?: string;
      extraParams?: Record<string, string | number>;
    };

    if (!serverUrl || !username || !password) {
      res.status(400).json({ error: 'Informe servidor, usuário e senha do Xtream Codes.' });
      return;
    }

    const normalizedBase = serverUrl.trim().replace(/\/+$/, '');
    if (!isValidHttpUrl(normalizedBase)) {
      res.status(400).json({ error: 'URL do servidor Xtream inválida.' });
      return;
    }

    const targetUrl = new URL(`${normalizedBase}/player_api.php`);
    targetUrl.searchParams.set('username', username);
    targetUrl.searchParams.set('password', password);
    if (action) {
      targetUrl.searchParams.set('action', action);
    }
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        targetUrl.searchParams.set(k, String(v));
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(targetUrl.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'IPTVSmartersPro',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        res.status(response.status).json({
          error: `Servidor Xtream retornou HTTP ${response.status}`,
        });
        return;
      }

      const text = await response.text();
      try {
        const data = JSON.parse(text);
        res.json(data);
      } catch {
        res.status(502).json({ error: 'Resposta do servidor Xtream não é um JSON válido.' });
      }
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'Tempo limite excedido ao conectar ao servidor Xtream.'
          : err instanceof Error
            ? err.message
            : 'Falha de conexão com servidor Xtream.';
      res.status(502).json({ error: message });
    } finally {
      clearTimeout(timeout);
    }
  });

  // Stream / HLS proxy with Range forwarding and M3U8 manifest URL rewriting
  app.get('/api/proxy/stream', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    if (!rawUrl || !isValidHttpUrl(rawUrl)) {
      res.status(400).send('Invalid stream URL');
      return;
    }

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    try {
      const forwardHeaders: Record<string, string> = {
        'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
        Accept: '*/*',
      };
      if (typeof req.headers.range === 'string') {
        forwardHeaders.Range = req.headers.range;
      }

      const upstream = await fetch(rawUrl, {
        signal: controller.signal,
        headers: forwardHeaders,
        redirect: 'follow',
      });

      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).send(`Upstream error ${upstream.status}`);
        return;
      }

      const contentType = upstream.headers.get('content-type') || '';
      const finalUrl = upstream.url || rawUrl;
      const looksLikeM3u8 =
        contentType.includes('mpegurl') ||
        contentType.includes('x-mpegurl') ||
        finalUrl.split('?')[0].toLowerCase().endsWith('.m3u8');

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Range');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

      if (looksLikeM3u8) {
        const text = await upstream.text();
        const rewritten = rewriteM3u8Manifest(text, finalUrl);
        res.status(200);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(rewritten);
        return;
      }

      res.status(upstream.status);
      const copyHeaders = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'cache-control',
      ];
      for (const h of copyHeaders) {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      }

      if (!upstream.body) {
        res.end();
        return;
      }

      const nodeStream = Readable.fromWeb(upstream.body as unknown as import('stream/web').ReadableStream);
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(502);
        res.end();
      });
      nodeStream.pipe(res);
    } catch {
      if (!res.headersSent) {
        res.status(502).send('Stream proxy error');
      }
    }
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CromaTV server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
