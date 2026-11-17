export type NavSection = 'search' | 'home' | 'live' | 'movies' | 'series' | 'settings';

export type MediaType = 'channel' | 'movie' | 'series';

export interface PlaylistSource {
  id: string;
  name: string;
  type: 'demo' | 'm3u_url' | 'm3u_file' | 'xtream';
  url?: string;
  serverUrl?: string;
  username?: string;
  password?: string;
  addedAt: string;
  lastSyncedAt?: string;
  expiresAt?: string;
  status?: string;
  stats: {
    channels: number;
    movies: number;
    series: number;
  };
}

export interface ChannelItem {
  id: string;
  name: string;
  logo?: string;
  group: string;
  streamUrl: string;
  channelNumber?: string;
  epgId?: string;
  currentProgram?: string;
  programDescription?: string;
  nextProgram?: string;
}

export interface MovieItem {
  id: string;
  title: string;
  poster?: string;
  backdrop?: string;
  category: string;
  streamUrl: string;
  year?: string;
  duration?: string;
  durationSeconds?: number;
  rating?: string;
  synopsis?: string;
  director?: string;
  containerExt?: string;
}

export interface EpisodeItem {
  id: string;
  season: number;
  episode: number;
  title: string;
  streamUrl: string;
  duration?: string;
  durationSeconds?: number;
  synopsis?: string;
  thumbnail?: string;
  containerExt?: string;
}

export interface SeriesItem {
  id: string;
  title: string;
  poster?: string;
  backdrop?: string;
  category: string;
  year?: string;
  rating?: string;
  synopsis?: string;
  seasons: Record<number, EpisodeItem[]>;
  xtreamSeriesId?: string;
  seasonsLoaded?: boolean;
}

export interface PlaylistLibrary {
  playlistId: string;
  channels: ChannelItem[];
  movies: MovieItem[];
  series: SeriesItem[];
}

export interface ContinueWatchingItem {
  id: string;
  mediaType: MediaType;
  itemId: string;
  title: string;
  subtitle?: string;
  poster?: string;
  backdrop?: string;
  streamUrl: string;
  progressSeconds: number;
  durationSeconds: number;
  season?: number;
  episode?: number;
  episodeId?: string;
  updatedAt: number;
}

export interface PlayerSettings {
  useCorsProxy: boolean;
  autoPlayNext: boolean;
  defaultVolume: number;
  preferredQuality: 'auto' | 'high' | 'medium';
}

export interface ActivePlayback {
  mediaType: MediaType;
  itemId: string;
  title: string;
  subtitle?: string;
  streamUrl: string;
  poster?: string;
  backdrop?: string;
  startAtSeconds?: number;
  // Series context for Next Episode button
  seriesItem?: SeriesItem;
  currentSeason?: number;
  currentEpisode?: EpisodeItem;
  // Channel context for fast zapping
  channelItem?: ChannelItem;
}
