import type { ResearchItem } from '@gitroom/nestjs-libraries/integrations/social/comments.interface';

/**
 * Keyword research through the ScrapeCreators API (public posts only).
 *
 * Env: SCRAPECREATORS_API_KEY (required to enable),
 *      SCRAPECREATORS_REGION (optional two-letter proxy country for TikTok, e.g. ID).
 *
 * Each search costs ScrapeCreators credits, so callers should cache results.
 */

export const SCRAPECREATORS_PLATFORMS = [
  'tiktok',
  'youtube',
  'instagram',
  'threads',
  'facebook',
] as const;

export type ScrapeCreatorsPlatform = (typeof SCRAPECREATORS_PLATFORMS)[number];

const BASE = 'https://api.scrapecreators.com';
const TIMEOUT_MS = 45000;
const MAX_ITEMS = 30;

export const scrapeCreatorsKey = () => (process.env.SCRAPECREATORS_API_KEY || '').trim();
export const scrapeCreatorsEnabled = () => scrapeCreatorsKey().length > 0;

const num = (value: unknown): number | undefined => {
  const n = typeof value === 'string' ? Number(value.replace(/[^\d.]/g, '')) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

const str = (value: unknown) => (typeof value === 'string' ? value : '');

const fromUnix = (value: unknown) => {
  const n = num(value);
  return n ? new Date(n * 1000).toISOString() : '';
};

const list = (value: unknown): any[] => (Array.isArray(value) ? value : []);

const firstUrl = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value?.url_list)) return value.url_list[0];
  return undefined;
};

// ---------------------------------------------------------------- mappers

export const mapTiktok = (body: any): ResearchItem[] =>
  list(body?.search_item_list)
    .map((entry: any) => entry?.aweme_info || entry)
    .filter((v: any) => v?.aweme_id)
    .map((v: any) => {
      const handle = str(v.author?.unique_id);
      return {
        id: String(v.aweme_id),
        url:
          str(v.url) ||
          str(v.share_url) ||
          (handle ? `https://www.tiktok.com/@${handle}/video/${v.aweme_id}` : ''),
        text: str(v.desc),
        author: handle ? `@${handle}` : str(v.author?.nickname),
        thumbnail: firstUrl(v.video?.cover) || firstUrl(v.video?.origin_cover),
        publishedAt: fromUnix(v.create_time),
        views: num(v.statistics?.play_count),
        likes: num(v.statistics?.digg_count),
        comments: num(v.statistics?.comment_count),
      };
    });

export const mapYoutube = (body: any): ResearchItem[] =>
  [...list(body?.videos), ...list(body?.shorts)]
    .filter((v: any) => v?.id)
    .map((v: any) => ({
      id: String(v.id),
      url: str(v.url) || `https://www.youtube.com/watch?v=${v.id}`,
      title: str(v.title),
      text: str(v.description),
      author: str(v.channel?.title) || str(v.channel?.handle),
      thumbnail: str(v.thumbnail) || undefined,
      publishedAt: str(v.publishedTime),
      views: num(v.viewCountInt) ?? num(v.viewCountText),
      likes: num(v.likeCountInt),
      comments: num(v.commentCountInt),
    }));

export const mapInstagram = (body: any): ResearchItem[] =>
  list(body?.reels)
    .filter((r: any) => r?.id || r?.shortcode)
    .map((r: any) => ({
      id: String(r.id || r.shortcode),
      url: str(r.url) || `https://www.instagram.com/reel/${r.shortcode}/`,
      text: str(r.caption),
      author: r.owner?.username ? `@${r.owner.username}` : str(r.owner?.full_name),
      thumbnail: str(r.thumbnail_src) || str(r.display_url) || undefined,
      publishedAt: str(r.taken_at) || fromUnix(r.taken_at_timestamp),
      views: num(r.video_play_count) ?? num(r.video_view_count),
      likes: num(r.like_count),
      comments: num(r.comment_count),
    }));

export const mapThreads = (body: any): ResearchItem[] =>
  list(body?.posts)
    .filter((p: any) => p?.id)
    .map((p: any) => ({
      id: String(p.id),
      url: str(p.url),
      text: str(p.caption?.text),
      author: p.user?.username ? `@${p.user.username}` : '',
      thumbnail: firstUrl(p.image_versions2?.candidates?.[0]?.url) || undefined,
      publishedAt: fromUnix(p.taken_at),
      likes: num(p.like_count),
      comments: num(p.direct_reply_count ?? p.text_post_app_info?.direct_reply_count),
    }));

export const mapFacebook = (body: any): ResearchItem[] =>
  list(body?.videos)
    .filter((v: any) => v?.id)
    .map((v: any) => {
      // Facebook only gives text like "Dec 7, 2025 · 71K views".
      const views = /([\d.,]+)\s*([KMB])?\s*views?/i.exec(str(v.relative_time_text));
      const mult = { K: 1e3, M: 1e6, B: 1e9 }[(views?.[2] || '').toUpperCase() as 'K'] || 1;
      return {
        id: String(v.id),
        url: str(v.url),
        title: str(v.title),
        text: str(v.description),
        author: str(v.author?.name),
        thumbnail: str(v.thumbnail_url) || undefined,
        publishedAt: v.publish_time ? fromUnix(v.publish_time) : '',
        views: views ? Math.round(Number(views[1].replace(/,/g, '')) * mult) : undefined,
      };
    });

const ROUTES: Record<
  ScrapeCreatorsPlatform,
  { path: string; params: (q: string) => Record<string, string>; map: (body: any) => ResearchItem[] }
> = {
  tiktok: {
    path: '/v1/tiktok/search/keyword',
    params: (query) => ({
      query,
      trim: 'true',
      ...(process.env.SCRAPECREATORS_REGION ? { region: process.env.SCRAPECREATORS_REGION } : {}),
    }),
    map: mapTiktok,
  },
  youtube: { path: '/v1/youtube/search', params: (query) => ({ query }), map: mapYoutube },
  instagram: { path: '/v2/instagram/reels/search', params: (query) => ({ query }), map: mapInstagram },
  threads: { path: '/v1/threads/search', params: (query) => ({ query, trim: 'true' }), map: mapThreads },
  facebook: { path: '/v1/facebook/search/videos', params: (query) => ({ query }), map: mapFacebook },
};

export const isScrapeCreatorsPlatform = (value: string): value is ScrapeCreatorsPlatform =>
  (SCRAPECREATORS_PLATFORMS as readonly string[]).includes(value);

export async function searchScrapeCreators(
  platform: ScrapeCreatorsPlatform,
  query: string
): Promise<ResearchItem[]> {
  const key = scrapeCreatorsKey();
  if (!key) {
    throw new Error('ScrapeCreators is not configured (set SCRAPECREATORS_API_KEY)');
  }
  const route = ROUTES[platform];
  const url = `${BASE}${route.path}?${new URLSearchParams(route.params(query))}`;
  const res = await fetch(url, {
    headers: { 'x-api-key': key, accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body: any = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) {
    const reason = str(body?.message) || str(body?.error) || `HTTP ${res.status}`;
    throw new Error(`ScrapeCreators: ${reason.slice(0, 200)}`);
  }
  return route.map(body).slice(0, MAX_ITEMS);
}
