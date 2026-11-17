import type { ChannelItem, EpisodeItem, MovieItem, PlaylistLibrary, SeriesItem } from '../types/iptv';

const ATTR_REGEX = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
const SERIES_EPISODE_REGEX = /^(.*?)\s*(?:[-–|]\s*)?(?:[Ss](\d{1,2})[\s._-]*[Ee](\d{1,3})|[Tt](\d{1,2})[\s._-]*[Ee](\d{1,3})|Temporada\s*(\d{1,2})\s*Epis[oó]dio\s*(\d{1,3}))(?:\s*[-–:]\s*(.*))?$/i;

const MOVIE_GROUP_KEYWORDS = [
  'filme',
  'filmes',
  'movie',
  'movies',
  'vod',
  'cinema',
  'lancamento',
  'lançamento',
  'lançamentos',
  '4k',
  'uhd',
  'dublado',
  'legendado',
  'documentario',
  'documentário',
  'animacao',
  'animação',
];

const SERIES_GROUP_KEYWORDS = [
  'serie',
  'séries',
  'series',
  'novela',
  'novelas',
  'anime',
  'animes',
  'temporada',
  'dorama',
  'doramas',
];

function extractYear(title: string): { cleanTitle: string; year?: string } {
  const match = title.match(/\s*\((\d{4})\)\s*$/);
  if (match) {
    return {
      cleanTitle: title.replace(match[0], '').trim(),
      year: match[1],
    };
  }
  return { cleanTitle: title.trim() };
}

function isVodExtension(url: string): boolean {
  const clean = url.split('?')[0].toLowerCase();
  return /\.(mp4|mkv|avi|mov|m4v|webm)$/.test(clean);
}

function classifyEntry(
  title: string,
  group: string,
  url: string,
): 'series' | 'movie' | 'channel' {
  const lowerUrl = url.toLowerCase();
  const lowerGroup = group.toLowerCase();

  if (SERIES_EPISODE_REGEX.test(title) || lowerUrl.includes('/series/')) {
    return 'series';
  }

  if (SERIES_GROUP_KEYWORDS.some((kw) => lowerGroup.includes(kw)) && isVodExtension(url)) {
    return 'series';
  }

  if (
    lowerUrl.includes('/movie/') ||
    isVodExtension(url) ||
    MOVIE_GROUP_KEYWORDS.some((kw) => lowerGroup.includes(kw))
  ) {
    return 'movie';
  }

  return 'channel';
}

export function parseM3UContent(content: string, playlistId: string): PlaylistLibrary {
  const lines = content.split(/\r?\n/);
  const channels: ChannelItem[] = [];
  const movies: MovieItem[] = [];
  const seriesMap = new Map<string, SeriesItem>();

  let pendingMeta: {
    name: string;
    logo?: string;
    group: string;
    epgId?: string;
    chno?: string;
  } | null = null;

  let indexCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const attrs: Record<string, string> = {};
      ATTR_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = ATTR_REGEX.exec(line)) !== null) {
        attrs[match[1].toLowerCase()] = match[2].trim();
      }

      const commaIdx = line.indexOf(',');
      const rawTitle = commaIdx !== -1 ? line.slice(commaIdx + 1).trim() : '';
      const name = rawTitle || attrs['tvg-name'] || `Canal ${channels.length + 1}`;
      const group = attrs['group-title'] || 'Geral';

      pendingMeta = {
        name,
        logo: attrs['tvg-logo'] || undefined,
        group,
        epgId: attrs['tvg-id'] || undefined,
        chno: attrs['tvg-chno'] || undefined,
      };
      continue;
    }

    if (line.startsWith('#EXTGRP:') && pendingMeta) {
      pendingMeta.group = line.slice(8).trim() || pendingMeta.group;
      continue;
    }

    if (line.startsWith('#')) {
      continue;
    }

    // Stream URL line
    if (/^https?:\/\//i.test(line) || line.startsWith('/')) {
      indexCounter += 1;
      const meta = pendingMeta || {
        name: `Stream ${indexCounter}`,
        group: 'Geral',
      };
      pendingMeta = null;

      const kind = classifyEntry(meta.name, meta.group, line);

      if (kind === 'series') {
        const epMatch = meta.name.match(SERIES_EPISODE_REGEX);
        let seriesTitle = meta.name;
        let seasonNum = 1;
        let episodeNum = 1;
        let episodeTitle = meta.name;

        if (epMatch) {
          seriesTitle = epMatch[1]?.trim() || meta.name;
          seasonNum = Number(epMatch[2] || epMatch[4] || epMatch[6] || 1);
          episodeNum = Number(epMatch[3] || epMatch[5] || epMatch[7] || 1);
          episodeTitle = epMatch[8]?.trim() || `Episódio ${episodeNum}`;
        }

        const { cleanTitle, year } = extractYear(seriesTitle);
        const seriesKey = cleanTitle.toLowerCase();

        let existing = seriesMap.get(seriesKey);
        if (!existing) {
          existing = {
            id: `${playlistId}-series-${seriesMap.size + 1}`,
            title: cleanTitle,
            poster: meta.logo,
            backdrop: meta.logo,
            category: meta.group,
            year,
            seasons: {},
            seasonsLoaded: true,
          };
          seriesMap.set(seriesKey, existing);
        }

        if (!existing.poster && meta.logo) {
          existing.poster = meta.logo;
          existing.backdrop = meta.logo;
        }

        if (!existing.seasons[seasonNum]) {
          existing.seasons[seasonNum] = [];
        }

        const episodeItem: EpisodeItem = {
          id: `${existing.id}-s${seasonNum}e${episodeNum}-${indexCounter}`,
          season: seasonNum,
          episode: episodeNum,
          title: episodeTitle,
          streamUrl: line,
          thumbnail: meta.logo,
        };
        existing.seasons[seasonNum].push(episodeItem);
      } else if (kind === 'movie') {
        const { cleanTitle, year } = extractYear(meta.name);
        movies.push({
          id: `${playlistId}-movie-${movies.length + 1}`,
          title: cleanTitle,
          poster: meta.logo,
          backdrop: meta.logo,
          category: meta.group,
          streamUrl: line,
          year,
        });
      } else {
        channels.push({
          id: `${playlistId}-ch-${channels.length + 1}`,
          name: meta.name,
          logo: meta.logo,
          group: meta.group,
          streamUrl: line,
          channelNumber: meta.chno || String(channels.length + 1).padStart(3, '0'),
          epgId: meta.epgId,
        });
      }
    }
  }

  // Sort episodes inside each season
  const series = Array.from(seriesMap.values()).map((s) => {
    const sortedSeasons: Record<number, EpisodeItem[]> = {};
    for (const key of Object.keys(s.seasons).map(Number).sort((a, b) => a - b)) {
      sortedSeasons[key] = [...s.seasons[key]].sort((a, b) => a.episode - b.episode);
    }
    return { ...s, seasons: sortedSeasons };
  });

  return {
    playlistId,
    channels,
    movies,
    series,
  };
}
