/**
 * Helpers for product data captured from a marketplace page by the
 * "Kirim ke Postiz" bookmarklet or from pasted page text.
 */

export const marketplaceFromUrl = (url: string) => {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  const is = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (is('shopee.co.id') || is('shope.ee') || is('shopee.com')) return 'shopee';
  if (is('tokopedia.com') || is('tokopedia.link')) return 'tokopedia';
  if (is('tiktok.com')) return 'tiktok_shop';
  if (is('lazada.co.id') || is('lazada.com')) return 'lazada';
  if (is('blibli.com')) return 'blibli';
  if (is('amazon.com') || is('amazon.co.id')) return 'amazon';
  return 'other';
};

/** Strips tracking query params so the stored product link stays clean. */
export const cleanProductUrl = (url: string) => {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|sp_atk|xptdk|uls_trackid|af_|mmp_|gclid|fbclid)/i.test(key)) {
        u.searchParams.delete(key);
      }
    }
    return u.toString();
  } catch {
    return url;
  }
};

/** Shopee CDN images: drop thumbnail suffixes to get the full-size file. */
export const fullSizeImage = (url: string) =>
  url
    .replace(/_tn(\.webp)?(\?.*)?$/i, '')
    .replace(/@resize_w\d+_nl(\.webp)?/i, '');

export const uniqueUrls = (urls: string[] = [], max = 15) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = fullSizeImage(String(raw || '').trim());
    if (!/^https:\/\//i.test(url)) continue;
    const key = url.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
    if (out.length >= max) break;
  }
  return out;
};

export interface ParsedPageText {
  name?: string;
  price?: string;
  sold?: string;
  rating?: string;
  description?: string;
}

/**
 * Best-effort parser for text copied from a product page (Ctrl+A, Ctrl+C).
 * Works on Indonesian marketplace pages; everything is optional.
 */
export const parsePageText = (raw: string): ParsedPageText => {
  const text = raw.replace(/\r/g, '').slice(0, 60000);
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const out: ParsedPageText = {};

  const price = text.match(/Rp\s?\d{1,3}(?:[.,]\d{3})+(?:\s?[-–]\s?Rp\s?\d{1,3}(?:[.,]\d{3})+)?/);
  if (price) out.price = price[0].replace(/\s+/g, ' ').trim();

  const sold = text.match(/([\d.,]+\s?(?:rb|RB|jt|JT|K|k)?\+?)\s*(?:Terjual|terjual)/);
  if (sold) out.sold = `${sold[1].replace(/\s+/g, '')} terjual`;

  const rating =
    text.match(/\b([1-5][.,]\d)\s*(?:dari 5|\/\s?5)/i) ||
    lines.map((l) => l.match(/^([1-5][.,]\d)$/)).find(Boolean);
  if (rating) out.rating = rating[1].replace(',', '.');

  // name: the first long line that is not navigation/price/rating noise
  const noise = /^(rp|beranda|home|shopee|tokopedia|masuk|daftar|keranjang|cari|kategori|penilaian|terjual|bagikan|favorit|\d)/i;
  out.name = lines.find((l) => l.length >= 12 && l.length <= 200 && !noise.test(l));

  const descStart = lines.findIndex((l) => /^deskripsi( produk)?$/i.test(l));
  if (descStart !== -1) {
    const stop = lines.findIndex(
      (l, i) => i > descStart && /^(penilaian produk|ulasan|produk lainnya|rekomendasi|toko lain)/i.test(l)
    );
    out.description = lines
      .slice(descStart + 1, stop === -1 ? descStart + 80 : stop)
      .join('\n')
      .slice(0, 10000);
  }
  return out;
};
