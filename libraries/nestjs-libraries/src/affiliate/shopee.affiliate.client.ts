import { createHash } from 'crypto';

/**
 * Shopee Affiliate Open API (GraphQL), Indonesia by default.
 *
 * Auth: header `SHA256 Credential=<appId>, Timestamp=<unix>, Signature=<sig>`
 * with sig = sha256hex(appId + timestamp + body + secret), where body is the
 * exact JSON string sent.
 *
 * Env: SHOPEE_AFFILIATE_APP_ID, SHOPEE_AFFILIATE_SECRET,
 *      SHOPEE_AFFILIATE_HOST (default https://open-api.affiliate.shopee.co.id/graphql)
 */

export type ShopeeSort = 'relevance' | 'sales' | 'commission' | 'price_asc' | 'price_desc';

const SORT_TYPE: Record<ShopeeSort, number> = {
  relevance: 1,
  sales: 2,
  price_desc: 3,
  price_asc: 4,
  commission: 5,
};

export interface ShopeeOfferQuery {
  keyword?: string;
  sort?: ShopeeSort;
  /** Only Shopee's top performing products. */
  trending?: boolean;
  /** Only offers with seller (XTRA / AMS) commission. */
  extraOnly?: boolean;
  itemId?: number;
  page?: number;
  limit?: number;
}

export interface ShopeeOffer {
  itemId: string;
  name: string;
  imageUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  sales: number;
  rating: number | null;
  /** Fractions, e.g. 0.1 = 10%. */
  commissionRate: number;
  sellerCommissionRate: number;
  shopeeCommissionRate: number;
  /** Estimated commission amount per sale, in IDR. */
  commission: number | null;
  offerLink: string;
  productLink: string | null;
  shopName: string | null;
}

export class ShopeeAffiliateError extends Error {}

const DEFAULT_HOST = 'https://open-api.affiliate.shopee.co.id/graphql';

export const shopeeConfigured = () =>
  !!process.env.SHOPEE_AFFILIATE_APP_ID?.trim() &&
  !!process.env.SHOPEE_AFFILIATE_SECRET?.trim();

export const signShopee = (
  appId: string,
  secret: string,
  timestamp: number,
  body: string
) =>
  createHash('sha256')
    .update(`${appId}${timestamp}${body}${secret}`)
    .digest('hex');

const num = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const OFFER_FIELDS = `
  itemId
  productName
  imageUrl
  priceMin
  priceMax
  sales
  ratingStar
  commissionRate
  sellerCommissionRate
  shopeeCommissionRate
  commission
  offerLink
  productLink
  shopName
`;

const call = async <T>(query: string) => {
  if (!shopeeConfigured()) {
    throw new ShopeeAffiliateError(
      'Shopee Affiliate API belum diatur (SHOPEE_AFFILIATE_APP_ID / SHOPEE_AFFILIATE_SECRET)'
    );
  }
  const appId = process.env.SHOPEE_AFFILIATE_APP_ID!.trim();
  const secret = process.env.SHOPEE_AFFILIATE_SECRET!.trim();
  const body = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signShopee(appId, secret, timestamp, body);

  const response = await fetch(
    process.env.SHOPEE_AFFILIATE_HOST?.trim() || DEFAULT_HOST,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(20000),
    }
  );
  const json: any = await response.json().catch(() => null);
  if (!response.ok || !json) {
    throw new ShopeeAffiliateError(`Shopee API error (HTTP ${response.status})`);
  }
  if (json.errors?.length) {
    const first = json.errors[0];
    const code = first?.extensions?.code;
    throw new ShopeeAffiliateError(
      `Shopee API: ${first?.message || 'unknown error'}${code ? ` (${code})` : ''}`
    );
  }
  return json.data as T;
};

export const searchShopeeOffers = async (
  q: ShopeeOfferQuery
): Promise<{ offers: ShopeeOffer[]; hasNextPage: boolean; page: number }> => {
  const page = Math.max(1, q.page || 1);
  const limit = Math.min(50, Math.max(1, q.limit || 20));
  // Arguments are inlined (JSON-escaped) rather than sent as typed variables,
  // so the request does not depend on the schema's scalar type names.
  const args = [
    `page: ${page}`,
    `limit: ${limit}`,
    `sortType: ${SORT_TYPE[q.sort || (q.trending ? 'sales' : 'relevance')]}`,
    ...(q.keyword?.trim() ? [`keyword: ${JSON.stringify(q.keyword.trim())}`] : []),
    ...(q.trending ? ['listType: 2'] : []),
    ...(q.extraOnly ? ['isAMSOffer: true'] : []),
    ...(q.itemId && Number.isSafeInteger(q.itemId) ? [`itemId: ${q.itemId}`] : []),
  ].join(', ');

  const data = await call<{
    productOfferV2: { nodes: any[]; pageInfo?: { hasNextPage?: boolean } };
  }>(
    `{ productOfferV2(${args}) { nodes { ${OFFER_FIELDS} } pageInfo { page limit hasNextPage } } }`
  );

  const offers = (data?.productOfferV2?.nodes || []).map(
    (n): ShopeeOffer => ({
      itemId: String(n.itemId),
      name: n.productName || '',
      imageUrl: n.imageUrl || null,
      priceMin: num(n.priceMin),
      priceMax: num(n.priceMax),
      sales: num(n.sales) || 0,
      rating: num(n.ratingStar),
      commissionRate: num(n.commissionRate) || 0,
      sellerCommissionRate: num(n.sellerCommissionRate) || 0,
      shopeeCommissionRate: num(n.shopeeCommissionRate) || 0,
      commission: num(n.commission),
      offerLink: n.offerLink || n.productLink || '',
      productLink: n.productLink || null,
      shopName: n.shopName || null,
    })
  );

  return {
    offers: q.extraOnly
      ? offers.filter((o) => o.sellerCommissionRate > 0)
      : offers,
    hasNextPage: !!data?.productOfferV2?.pageInfo?.hasNextPage,
    page,
  };
};

export const shopeeShortLink = async (originUrl: string, subIds: string[] = []) => {
  const data = await call<{ generateShortLink: { shortLink: string } }>(
    `mutation { generateShortLink(input: { originUrl: ${JSON.stringify(
      originUrl
    )}, subIds: ${JSON.stringify(subIds.slice(0, 5))} }) { shortLink } }`
  );
  return data?.generateShortLink?.shortLink || originUrl;
};

export const formatRupiah = (value: number | null) =>
  value === null
    ? null
    : `Rp ${Math.round(value).toLocaleString('id-ID')}`;
