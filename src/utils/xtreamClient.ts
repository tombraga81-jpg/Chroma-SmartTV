import type {
  ChannelItem,
  EpisodeItem,
  MovieItem,
  PlaylistLibrary,
  SeriesItem,
} from '../types/iptv';

interface XtreamAuthResponse {
  user_info?: {
    username?: string;
    status?: string;
    exp_date?: string | null;
    auth?: number;
  };
  server_info?: {
    url?: string;
    port?: string;
    https_port?: string;
    server_protocol?: string;
  };
}

interface XtreamCategory {
  category_id: string;
  category_name: string;
}

interface XtreamLiveStream {
  num?: number;
  name: string;
  stream_id: number;
  stream_icon?: string;
  epg_channel_id?: string;
  category_id?: string;
}

interface XtreamVodStream {
  stream_id: number;
  name: string;
  stream_icon?: string;
  rating?: string | number;
  category_id?: string;
  container_extension?: string;
  added?: string;
}

interface XtreamSeriesRaw {
  series_id: number;
  name: string;
  cover?: string;
  plot?: string;
  rating?: string | number;
  releaseDate?: string;
  category_id?: string;
  backdrop_path?: string[];
}

interface XtreamSeriesInfoResponse {
  info?: {
    name?: string;
    cover?: string;
    plot?: string;
    releaseDate?: string;
    rating?: string | number;
    backdrop_path?: string[];
  };
  episodes?: Record<
    string,
    Array<{
      id: string | number;
      episode_num: number | string;
      title?: string;
      container_extension?: string;
      info?: {
        duration?: string;
        duration_secs?: number;
        plot?: string;
        movie_image?: string;
      };
    }>
  >;
}

async function callXtreamApi<T>(
  serverUrl: string,
  username: string,
  password: string,
  action: string | undefined,
  useCorsProxy: boolean,
  extraParams?: Record<string, string | number>,
): Promise<T> {
  const normalizedBase = serverUrl.trim().replace(/\/+$/, '');

  if (useCorsProxy) {
    const res = await fetch('/api/proxy/xtream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverUrl: normalizedBase,
        username,
        password,
        action,
        extraParams,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || `Erro HTTP ${res.status}`);
    }
    return data as T;
  }

  const url = new URL(`${normalizedBase}/player_api.php`);
  url.searchParams.set('username', username);
  url.searchParams.set('password', password);
  if (action) url.searchParams.set('action', action);
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Erro HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function connectXtreamPlaylist(params: {
  playlistId: string;
  serverUrl: string;
  username: string;
  password: string;
  useCorsProxy: boolean;
}): Promise<{
  library: PlaylistLibrary;
  status: string;
  expiresAt?: string;
}> {
  const { playlistId, serverUrl, username, password, useCorsProxy } = params;
  const base = serverUrl.trim().replace(/\/+$/, '');

  const authData = await callXtreamApi<XtreamAuthResponse>(
    base,
    username,
    password,
    undefined,
    useCorsProxy,
  );

  if (!authData?.user_info || authData.user_info.auth === 0) {
    throw new Error('Credenciais Xtream inválidas ou conta inativa.');
  }

  const [
    liveCats,
    liveStreams,
    vodCats,
    vodStreams,
    seriesCats,
    seriesList,
  ] = await Promise.all([
    callXtreamApi<XtreamCategory[]>(base, username, password, 'get_live_categories', useCorsProxy).catch(() => []),
    callXtreamApi<XtreamLiveStream[]>(base, username, password, 'get_live_streams', useCorsProxy).catch(() => []),
    callXtreamApi<XtreamCategory[]>(base, username, password, 'get_vod_categories', useCorsProxy).catch(() => []),
    callXtreamApi<XtreamVodStream[]>(base, username, password, 'get_vod_streams', useCorsProxy).catch(() => []),
    callXtreamApi<XtreamCategory[]>(base, username, password, 'get_series_categories', useCorsProxy).catch(() => []),
    callXtreamApi<XtreamSeriesRaw[]>(base, username, password, 'get_series', useCorsProxy).catch(() => []),
  ]);

  const liveCatMap = new Map(
    (Array.isArray(liveCats) ? liveCats : []).map((c) => [String(c.category_id), c.category_name]),
  );
  const vodCatMap = new Map(
    (Array.isArray(vodCats) ? vodCats : []).map((c) => [String(c.category_id), c.category_name]),
  );
  const seriesCatMap = new Map(
    (Array.isArray(seriesCats) ? seriesCats : []).map((c) => [String(c.category_id), c.category_name]),
  );

  const channels: ChannelItem[] = (Array.isArray(liveStreams) ? liveStreams : []).map((ch, idx) => ({
    id: `${playlistId}-xt-ch-${ch.stream_id}`,
    name: ch.name || `Canal ${idx + 1}`,
    logo: ch.stream_icon || undefined,
    group: liveCatMap.get(String(ch.category_id || '')) || 'TV ao Vivo',
    streamUrl: `${base}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${ch.stream_id}.m3u8`,
    channelNumber: String(ch.num || idx + 1).padStart(3, '0'),
    epgId: ch.epg_channel_id || undefined,
  }));

  const movies: MovieItem[] = (Array.isArray(vodStreams) ? vodStreams : []).map((m) => {
    const ext = m.container_extension || 'mp4';
    return {
      id: `${playlistId}-xt-vod-${m.stream_id}`,
      title: m.name,
      poster: m.stream_icon || undefined,
      backdrop: m.stream_icon || undefined,
      category: vodCatMap.get(String(m.category_id || '')) || 'Filmes',
      streamUrl: `${base}/movie/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${m.stream_id}.${ext}`,
      rating: m.rating ? String(m.rating) : undefined,
      containerExt: ext,
    };
  });

  const series: SeriesItem[] = (Array.isArray(seriesList) ? seriesList : []).map((s) => ({
    id: `${playlistId}-xt-series-${s.series_id}`,
    title: s.name,
    poster: s.cover || undefined,
    backdrop: Array.isArray(s.backdrop_path) && s.backdrop_path[0] ? s.backdrop_path[0] : s.cover || undefined,
    category: seriesCatMap.get(String(s.category_id || '')) || 'Séries',
    year: s.releaseDate ? s.releaseDate.slice(0, 4) : undefined,
    rating: s.rating ? String(s.rating) : undefined,
    synopsis: s.plot || undefined,
    seasons: {},
    xtreamSeriesId: String(s.series_id),
    seasonsLoaded: false,
  }));

  let expiresAt: string | undefined;
  if (authData.user_info.exp_date && Number(authData.user_info.exp_date) > 0) {
    expiresAt = new Date(Number(authData.user_info.exp_date) * 1000).toLocaleDateString('pt-BR');
  }

  return {
    library: { playlistId, channels, movies, series },
    status: authData.user_info.status || 'Active',
    expiresAt,
  };
}

export async function fetchXtreamSeriesDetails(params: {
  serverUrl: string;
  username: string;
  password: string;
  seriesItem: SeriesItem;
  useCorsProxy: boolean;
}): Promise<SeriesItem> {
  const { serverUrl, username, password, seriesItem, useCorsProxy } = params;
  if (!seriesItem.xtreamSeriesId) return seriesItem;

  const base = serverUrl.trim().replace(/\/+$/, '');
  const detail = await callXtreamApi<XtreamSeriesInfoResponse>(
    base,
    username,
    password,
    'get_series_info',
    useCorsProxy,
    { series_id: seriesItem.xtreamSeriesId },
  );

  const seasons: Record<number, EpisodeItem[]> = {};
  const rawEpisodes = detail.episodes || {};

  for (const [seasonKey, epArray] of Object.entries(rawEpisodes)) {
    const seasonNum = Number(seasonKey) || 1;
    if (!Array.isArray(epArray)) continue;

    seasons[seasonNum] = epArray
      .map((ep) => {
        const ext = ep.container_extension || 'mp4';
        const epNum = Number(ep.episode_num) || 1;
        return {
          id: `${seriesItem.id}-ep-${ep.id}`,
          season: seasonNum,
          episode: epNum,
          title: ep.title || `Episódio ${epNum}`,
          streamUrl: `${base}/series/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${ep.id}.${ext}`,
          duration: ep.info?.duration,
          durationSeconds: ep.info?.duration_secs,
          synopsis: ep.info?.plot,
          thumbnail: ep.info?.movie_image || seriesItem.backdrop || seriesItem.poster,
          containerExt: ext,
        };
      })
      .sort((a, b) => a.episode - b.episode);
  }

  return {
    ...seriesItem,
    synopsis: detail.info?.plot || seriesItem.synopsis,
    year: detail.info?.releaseDate ? detail.info.releaseDate.slice(0, 4) : seriesItem.year,
    rating: detail.info?.rating ? String(detail.info.rating) : seriesItem.rating,
    backdrop:
      (Array.isArray(detail.info?.backdrop_path) && detail.info?.backdrop_path[0]) ||
      seriesItem.backdrop,
    seasons,
    seasonsLoaded: true,
  };
}
