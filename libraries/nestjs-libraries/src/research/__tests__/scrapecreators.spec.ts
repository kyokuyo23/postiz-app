import {
  isScrapeCreatorsPlatform,
  mapFacebook,
  mapInstagram,
  mapThreads,
  mapTiktok,
  mapYoutube,
  scrapeCreatorsEnabled,
  searchScrapeCreators,
} from '@gitroom/nestjs-libraries/research/scrapecreators.client';

// Shapes taken from real ScrapeCreators responses (trimmed).
describe('ScrapeCreators mappers', () => {
  it('maps TikTok trimmed and full results', () => {
    const trimmed = {
      search_item_list: [
        {
          aweme_id: '7611294568302251271',
          desc: 'obat herbal',
          url: 'https://www.tiktok.com/@tukuenshop_id/video/7611294568302251271',
          create_time: 1772148600,
          statistics: { play_count: 4513821, digg_count: 10137, comment_count: 88 },
          author: { unique_id: 'tukuenshop_id', nickname: 'TUKUEN SHOP' },
          video: { cover: { url_list: ['https://cdn/cover.jpg'] } },
        },
      ],
    };
    const full = { search_item_list: [{ aweme_info: { ...trimmed.search_item_list[0], url: undefined } }] };

    const [a] = mapTiktok(trimmed);
    expect(a).toMatchObject({
      id: '7611294568302251271',
      author: '@tukuenshop_id',
      thumbnail: 'https://cdn/cover.jpg',
      views: 4513821,
      likes: 10137,
      comments: 88,
      publishedAt: new Date(1772148600 * 1000).toISOString(),
    });
    expect(mapTiktok(full)[0].url).toBe(
      'https://www.tiktok.com/@tukuenshop_id/video/7611294568302251271'
    );
  });

  it('maps YouTube videos and shorts', () => {
    const items = mapYoutube({
      videos: [
        {
          id: 'PUmiU0QGFls',
          url: 'https://www.youtube.com/watch?v=PUmiU0QGFls',
          title: 'Obat Herbal',
          thumbnail: 'https://i.ytimg.com/x.jpg',
          channel: { title: 'Santo Sapi', handle: 'SantoSapi' },
          viewCountText: '7,844 views',
          viewCountInt: 7844,
          publishedTime: '2026-11-27T08:06:03.133Z',
        },
      ],
      shorts: [{ id: 'abc', viewCountText: '1,200 views' }],
    });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: 'Obat Herbal', author: 'Santo Sapi', views: 7844 });
    expect(items[1]).toMatchObject({ url: 'https://www.youtube.com/watch?v=abc', views: 1200 });
  });

  it('maps Instagram reels', () => {
    const [r] = mapInstagram({
      reels: [
        {
          id: '3948303105930507420',
          shortcode: 'DbLMMF-jzSc',
          url: 'https://www.instagram.com/reel/DbLMMF-jzSc/',
          caption: 'Pasien kanker boleh minum obat herbal?',
          thumbnail_src: 'https://cdn/ig.jpg',
          taken_at: '2026-07-24T12:01:08.000Z',
          owner: { username: 'ikhwanoncologist' },
          like_count: 326,
          comment_count: 10,
          video_view_count: 1250,
          video_play_count: null,
        },
      ],
    });
    expect(r).toMatchObject({
      author: '@ikhwanoncologist',
      views: 1250,
      likes: 326,
      comments: 10,
      publishedAt: '2026-07-24T12:01:08.000Z',
    });
  });

  it('maps Threads posts', () => {
    const [p] = mapThreads({
      posts: [
        {
          id: '3878468068927272570_63275428211',
          caption: { text: 'Obat batuk herbal' },
          like_count: 92,
          taken_at: 1776569444,
          user: { username: 'hanaanns' },
          url: 'https://www.threads.com/@hanaanns/post/DXTFijhGvZ6',
        },
      ],
    });
    expect(p).toMatchObject({ text: 'Obat batuk herbal', author: '@hanaanns', likes: 92 });
    expect(p.views).toBeUndefined();
  });

  it('maps Facebook videos and reads views from the text', () => {
    const items = mapFacebook({
      videos: [
        {
          id: '4184344675157800',
          url: 'https://www.facebook.com/reel/4184344675157800/',
          title: 'obat herbal saat sakit',
          author: { name: 'Titik Umi' },
          relative_time_text: 'Dec 7, 2025 · 71K views',
          publish_time: null,
        },
        { id: '2', relative_time_text: 'Jun 20 · 1.5K views' },
        { id: '3', relative_time_text: 'Aug 13 · 742 views' },
        { id: '4', relative_time_text: 'Aug 13' },
      ],
    });
    expect(items.map((i) => i.views)).toEqual([71000, 1500, 742, undefined]);
    expect(items[0]).toMatchObject({ author: 'Titik Umi', publishedAt: '' });
  });

  it('returns an empty list for unexpected bodies', () => {
    expect(mapTiktok(null)).toEqual([]);
    expect(mapYoutube({})).toEqual([]);
    expect(mapInstagram({ reels: 'x' as any })).toEqual([]);
  });
});

describe('searchScrapeCreators', () => {
  const realFetch = global.fetch;
  const realKey = process.env.SCRAPECREATORS_API_KEY;

  afterEach(() => {
    global.fetch = realFetch;
    if (realKey === undefined) delete process.env.SCRAPECREATORS_API_KEY;
    else process.env.SCRAPECREATORS_API_KEY = realKey;
  });

  it('is disabled without a key', async () => {
    delete process.env.SCRAPECREATORS_API_KEY;
    expect(scrapeCreatorsEnabled()).toBe(false);
    await expect(searchScrapeCreators('tiktok', 'herbal')).rejects.toThrow('SCRAPECREATORS_API_KEY');
  });

  it('sends the key as a header, never in the URL', async () => {
    process.env.SCRAPECREATORS_API_KEY = 'test-key';
    const calls: [string, any][] = [];
    global.fetch = jest.fn(async (url: string, init: any) => {
      calls.push([url, init]);
      return { ok: true, status: 200, json: async () => ({ success: true, posts: [] }) } as any;
    }) as any;

    await searchScrapeCreators('threads', 'obat herbal');
    expect(calls[0][0]).toBe(
      'https://api.scrapecreators.com/v1/threads/search?query=obat+herbal&trim=true'
    );
    expect(calls[0][0]).not.toContain('test-key');
    expect(calls[0][1].headers['x-api-key']).toBe('test-key');
  });

  it('reports the API error message', async () => {
    process.env.SCRAPECREATORS_API_KEY = 'test-key';
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 402,
      json: async () => ({ success: false, message: 'Out of credits' }),
    })) as any;
    await expect(searchScrapeCreators('youtube', 'herbal')).rejects.toThrow(
      'ScrapeCreators: Out of credits'
    );
  });

  it('validates platform names', () => {
    expect(isScrapeCreatorsPlatform('tiktok')).toBe(true);
    expect(isScrapeCreatorsPlatform('linkedin')).toBe(false);
  });
});
