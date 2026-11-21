import type { YouTubeMetadata } from '../types';

function parseTimestampToSeconds(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().toLowerCase().replace(/^t=/, '');
  if (!cleaned) return undefined;

  if (/^\d+$/.test(cleaned)) {
    const val = Number.parseInt(cleaned, 10);
    return Number.isFinite(val) && val > 0 ? val : undefined;
  }

  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(cleaned);
  if (!match) return undefined;
  const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
  const mins = match[2] ? Number.parseInt(match[2], 10) : 0;
  const secs = match[3] ? Number.parseInt(match[3], 10) : 0;
  const total = hours * 3600 + mins * 60 + secs;
  return total > 0 ? total : undefined;
}

export function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function normalizeUrl(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function parseYouTubeUrl(rawUrl: string): YouTubeMetadata | undefined {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return undefined;

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return undefined;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  let videoId: string | null = null;

  if (host === 'youtu.be') {
    const seg = url.pathname.split('/').filter(Boolean)[0];
    if (seg && /^[a-zA-Z0-9_-]{11}$/.test(seg)) {
      videoId = seg;
    }
  } else if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.pathname === '/watch') {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
        videoId = v;
      }
    } else if (
      parts.length >= 2 &&
      (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live' || parts[0] === 'v')
    ) {
      if (/^[a-zA-Z0-9_-]{11}$/.test(parts[1])) {
        videoId = parts[1];
      }
    }
  }

  if (!videoId) return undefined;

  const tParam = url.searchParams.get('t') ?? url.searchParams.get('start') ?? (url.hash ? url.hash.slice(1) : null);
  const timestampSeconds = parseTimestampToSeconds(tParam);
  const canonicalUrl = timestampSeconds
    ? `https://www.youtube.com/watch?v=${videoId}&t=${timestampSeconds}s`
    : `https://www.youtube.com/watch?v=${videoId}`;

  return {
    videoId,
    timestampSeconds,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    canonicalUrl,
  };
}

export function getDomainLabel(urlString: string): string {
  try {
    const u = new URL(urlString);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return urlString;
  }
}
