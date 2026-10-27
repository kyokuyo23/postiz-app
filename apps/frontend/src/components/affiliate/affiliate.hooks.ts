'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export const MARKETPLACES = [
  { value: 'shopee', label: 'Shopee' },
  { value: 'tokopedia', label: 'Tokopedia' },
  { value: 'tiktok_shop', label: 'TikTok Shop' },
  { value: 'lazada', label: 'Lazada' },
  { value: 'blibli', label: 'Blibli' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'other', label: 'Lainnya' },
] as const;

export type Marketplace = (typeof MARKETPLACES)[number]['value'];

export interface AffiliateProduct {
  id: string;
  name: string;
  price: string | null;
  marketplace: Marketplace;
  link: string;
  imageId: string | null;
  imagePath: string | null;
  notes: string | null;
  commission: string | null;
  source: string | null;
  createdAt: string;
}

export interface ShopeeOffer {
  itemId: string;
  name: string;
  imageUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  sales: number;
  rating: number | null;
  commissionRate: number;
  sellerCommissionRate: number;
  shopeeCommissionRate: number;
  commission: number | null;
  offerLink: string;
  productLink: string | null;
  shopName: string | null;
}

export type ShopeeSort =
  | 'relevance'
  | 'sales'
  | 'commission'
  | 'price_asc'
  | 'price_desc';

export interface ShopeeFilter {
  keyword: string;
  sort: ShopeeSort;
  trending: boolean;
  extra: boolean;
  page: number;
}

export const useShopeeStatus = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await (
      await fetch('/affiliate/products/shopee/status')
    ).json()) as { configured: boolean };
  }, [fetch]);
  return useSWR('affiliate-shopee-status', load);
};

export const useShopeeOffers = (filter: ShopeeFilter, enabled: boolean) => {
  const fetch = useFetch();
  const params = new URLSearchParams();
  if (filter.keyword.trim()) params.set('keyword', filter.keyword.trim());
  params.set('sort', filter.sort);
  if (filter.trending) params.set('trending', 'true');
  if (filter.extra) params.set('extra', 'true');
  params.set('page', String(filter.page));
  const query = params.toString();
  const load = useCallback(async () => {
    const res = await fetch(`/affiliate/products/shopee/offers?${query}`);
    const body = await res.json();
    if (!res.ok) {
      throw new Error(
        (Array.isArray(body?.message) ? body.message.join(', ') : body?.message) ||
          'Shopee API error'
      );
    }
    return body as { offers: ShopeeOffer[]; hasNextPage: boolean; page: number };
  }, [fetch, query]);
  return useSWR(enabled ? `affiliate-shopee-${query}` : null, load, {
    revalidateOnFocus: false,
  });
};

export const rupiah = (value: number | null) =>
  value === null ? '' : `Rp ${Math.round(value).toLocaleString('id-ID')}`;

export const pct = (rate: number) =>
  `${(rate * 100).toFixed(rate * 100 < 10 ? 1 : 0).replace(/\.0$/, '')}%`;

export const marketplaceLabel = (value: string) =>
  MARKETPLACES.find((m) => m.value === value)?.label || 'Lainnya';

export const useAffiliateProducts = (search: string) => {
  const fetch = useFetch();
  const query = search.trim()
    ? `?search=${encodeURIComponent(search.trim())}`
    : '';
  const load = useCallback(async () => {
    return (await (
      await fetch(`/affiliate/products${query}`)
    ).json()) as AffiliateProduct[];
  }, [fetch, query]);
  return useSWR(`affiliate-products${query}`, load);
};

export const useIntegrationsForEditor = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await (await fetch('/integrations/list')).json()).integrations;
  }, [fetch]);
  return useSWR('/integrations/list', load, {
    revalidateOnFocus: false,
    fallbackData: [],
  });
};

const HASHTAGS: Record<string, string> = {
  shopee: '#shopeehaul #shopeefinds #rekomendasishopee',
  tokopedia: '#tokopedia #rekomendasitokopedia #belanjaonline',
  tiktok_shop: '#tiktokshop #racuntiktok #tiktokmademebuyit',
  lazada: '#lazada #lazadafinds #belanjaonline',
  blibli: '#blibli #belanjaonline #rekomendasi',
  amazon: '#amazonfinds #musthave #recommended',
  other: '#rekomendasi #belanjaonline #musthave',
};

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * Ready-to-edit promotion caption (editor HTML). Built for reach: a hook in
 * the first line, the benefit, price, a clear call to action that invites
 * comments and saves, the link, and a few focused hashtags.
 */
export const affiliateCaption = (p: AffiliateProduct) => {
  const lines = [
    `🔥 ${escapeHtml(p.name)}`,
    ...(p.notes
      ? p.notes
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map(escapeHtml)
      : []),
    ...(p.price ? [`💰 Harga: ${escapeHtml(p.price)}`] : []),
    `👉 Cek di ${marketplaceLabel(p.marketplace)}: ${escapeHtml(p.link)}`,
    `💬 Komen "MAU" kalau tertarik, simpan postingan ini & bagikan ke teman yang butuh!`,
    HASHTAGS[p.marketplace] || HASHTAGS.other,
  ];
  return lines.map((l) => `<p>${l}</p>`).join('');
};

/** Prompt for the Veo3 video generator (vertical product showcase). */
export const affiliateVideoPrompt = (p: AffiliateProduct) =>
  [
    `Vertical 9:16 short product showcase video for social media of "${p.name}".`,
    'Start with an eye-catching close-up in the first second, then smooth camera movement around the product, clean bright background, natural soft lighting, cinematic, realistic, no on-screen text.',
    p.notes ? `Highlight: ${p.notes.replace(/\s+/g, ' ').trim()}.` : '',
    `An enthusiastic Indonesian voice-over says: "Lagi cari ${p.name}? Ini rekomendasi terbaik${
      p.price ? `, cuma ${p.price}` : ''
    }! Cek link di bio atau komen MAU ya!"`,
  ]
    .filter(Boolean)
    .join(' ');
