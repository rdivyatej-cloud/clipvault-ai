export interface YouTubeMetadata {
  video_id: string;
  url: string;
  title: string;
  channel_title: string;
  duration_seconds: number;
  duration_formatted: string;
  thumbnail_url: string;
  description: string;
  is_live: boolean;
  privacy_status: string;
  published_at?: string;
  source: 'youtube_api_v3' | 'oembed';
}

export function extractYouTubeVideoId(inputUrl: string): string | null {
  if (!inputUrl || typeof inputUrl !== 'string') return null;
  const trimmed = inputUrl.trim();

  // If already an 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const urlString = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();

    // Check youtu.be shortlinks
    if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
      const pathname = parsed.pathname.slice(1);
      const id = pathname.split('/')[0].split('?')[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    // Check youtube.com variants
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      const paths = parsed.pathname.split('/').filter(Boolean);
      if (['shorts', 'live', 'embed', 'v'].includes(paths[0]) && paths[1]) {
        const id = paths[1].split('?')[0];
        if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
      }
    }
  } catch {
    // URL parsing failed, fall through to regex
  }

  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([a-zA-Z0-9_-]{11})/);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

export function parseIsoDuration(isoDuration: string): number {
  if (!isoDuration || typeof isoDuration !== 'string') return 0;
  const match = isoDuration.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const days = parseInt(match[1] || '0', 10);
  const hours = parseInt(match[2] || '0', 10);
  const minutes = parseInt(match[3] || '0', 10);
  const seconds = parseInt(match[4] || '0', 10);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export async function fetchYouTubeMetadata(videoId: string): Promise<YouTubeMetadata> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();

  // 1. Try official YouTube Data API v3 if API key is provided
  if (apiKey) {
    try {
      const endpoint = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status,liveStreamingDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(endpoint);
      
      if (res.ok) {
        const data = await res.json() as any;
        if (data.items && data.items.length > 0) {
          const item = data.items[0];
          const snippet = item.snippet || {};
          const contentDetails = item.contentDetails || {};
          const status = item.status || {};

          const isLive = snippet.liveBroadcastContent === 'live' || !!item.liveStreamingDetails;
          const durationSeconds = parseIsoDuration(contentDetails.duration || '');
          const thumbnails = snippet.thumbnails || {};
          const thumbnailUrl = thumbnails.maxres?.url || 
            thumbnails.standard?.url || 
            thumbnails.high?.url || 
            thumbnails.medium?.url || 
            thumbnails.default?.url || 
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

          return {
            video_id: videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title: snippet.title || 'Untitled YouTube Video',
            channel_title: snippet.channelTitle || 'Unknown Channel',
            duration_seconds: durationSeconds,
            duration_formatted: formatDuration(durationSeconds),
            thumbnail_url: thumbnailUrl,
            description: snippet.description || '',
            is_live: isLive,
            privacy_status: status.privacyStatus || 'public',
            published_at: snippet.publishedAt,
            source: 'youtube_api_v3'
          };
        } else {
          // Empty items list indicates the video is deleted, private, or does not exist
          throw new Error('YouTube video not found, private, or unavailable.');
        }
      } else {
        const errorData = await res.json().catch(() => ({})) as any;
        const errorMsg = errorData?.error?.message || `YouTube API returned status ${res.status}`;
        console.warn(`YouTube Data API warning: ${errorMsg}. Falling back to public oEmbed.`);
      }
    } catch (err: any) {
      if (err.message && err.message.includes('not found, private, or unavailable')) {
        throw err;
      }
      console.warn(`YouTube API v3 lookup failed: ${err.message}. Trying oEmbed fallback.`);
    }
  }

  // 2. Public oEmbed service fallback (official, no API key required)
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`;
    const oembedRes = await fetch(oembedUrl);

    if (oembedRes.ok) {
      const oembed = await oembedRes.json() as any;
      const thumbnailUrl = oembed.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      return {
        video_id: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: oembed.title || 'Untitled YouTube Video',
        channel_title: oembed.author_name || 'Unknown Channel',
        duration_seconds: 0,
        duration_formatted: 'From Local File',
        thumbnail_url: thumbnailUrl,
        description: '',
        is_live: false,
        privacy_status: 'public',
        source: 'oembed'
      };
    } else if (oembedRes.status === 404 || oembedRes.status === 400 || oembedRes.status === 401 || oembedRes.status === 403) {
      throw new Error('YouTube video not found, private, or unavailable.');
    } else {
      throw new Error(`YouTube metadata service returned code ${oembedRes.status}`);
    }
  } catch (err: any) {
    if (err.message && err.message.includes('not found, private, or unavailable')) {
      throw err;
    }
    throw new Error(`Failed to verify YouTube video: ${err.message || 'Network error'}`);
  }
}

