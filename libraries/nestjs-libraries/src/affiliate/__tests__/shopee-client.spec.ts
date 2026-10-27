import { createHash } from 'crypto';
import {
  formatRupiah,
  searchShopeeOffers,
  signShopee,
} from '../shopee.affiliate.client';

describe('shopee affiliate client', () => {
  const saved = { ...process.env };
  const realFetch = global.fetch;
  afterEach(() => {
    process.env = { ...saved };
    global.fetch = realFetch;
  });

  it('signs appId + timestamp + body + secret with sha256 hex', () => {
    const expected = createHash('sha256')
      .update('123' + '1700000000' + '{"query":"{}"}' + 'sec')
      .digest('hex');
    expect(signShopee('123', 'sec', 1700000000, '{"query":"{}"}')).toBe(expected);
  });

  it('formats rupiah', () => {
    expect(formatRupiah(89000)).toBe('Rp 89.000');
    expect(formatRupiah(null)).toBeNull();
  });

  it('fails clearly without credentials', async () => {
    delete process.env.SHOPEE_AFFILIATE_APP_ID;
    delete process.env.SHOPEE_AFFILIATE_SECRET;
    await expect(searchShopeeOffers({ keyword: 'x' })).rejects.toThrow(
      /belum diatur/
    );
  });

  it('sends a signed request with escaped inline args and maps offers', async () => {
    process.env.SHOPEE_AFFILIATE_APP_ID = 'app1';
    process.env.SHOPEE_AFFILIATE_SECRET = 'sec1';
    const calls: any[] = [];
    global.fetch = jest.fn(async (url: any, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            productOfferV2: {
              nodes: [
                {
                  itemId: 25512345678,
                  productName: 'Serum',
                  imageUrl: 'https://cf.shopee.co.id/file/a',
                  priceMin: '89000',
                  priceMax: '89000',
                  sales: 1200,
                  ratingStar: '4.9',
                  commissionRate: '0.1',
                  sellerCommissionRate: '0.05',
                  shopeeCommissionRate: '0.05',
                  commission: '8900',
                  offerLink: 'https://s.shopee.co.id/abc',
                  productLink: 'https://shopee.co.id/p',
                  shopName: 'Toko',
                },
                {
                  itemId: 2,
                  productName: 'No xtra',
                  commissionRate: '0.03',
                  sellerCommissionRate: '0',
                  offerLink: 'https://s.shopee.co.id/x',
                },
              ],
              pageInfo: { hasNextPage: true },
            },
          },
        }),
      } as any;
    }) as any;

    const result = await searchShopeeOffers({
      keyword: 'serum "wajah"',
      sort: 'commission',
      extraOnly: true,
    });

    expect(calls[0].url).toBe('https://open-api.affiliate.shopee.co.id/graphql');
    const body = calls[0].init.body as string;
    const query = JSON.parse(body).query as string;
    expect(query).toContain('keyword: "serum \\"wajah\\""');
    expect(query).toContain('sortType: 5');
    expect(query).toContain('isAMSOffer: true');
    const auth = calls[0].init.headers.Authorization as string;
    const ts = Number(/Timestamp=(\d+)/.exec(auth)![1]);
    expect(auth).toBe(
      `SHA256 Credential=app1, Timestamp=${ts}, Signature=${signShopee('app1', 'sec1', ts, body)}`
    );

    expect(result.hasNextPage).toBe(true);
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]).toMatchObject({
      itemId: '25512345678',
      priceMin: 89000,
      commissionRate: 0.1,
      sellerCommissionRate: 0.05,
      rating: 4.9,
      offerLink: 'https://s.shopee.co.id/abc',
    });
  });

  it('surfaces GraphQL errors', async () => {
    process.env.SHOPEE_AFFILIATE_APP_ID = 'app1';
    process.env.SHOPEE_AFFILIATE_SECRET = 'sec1';
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        errors: [{ message: 'no access', extensions: { code: 10035 } }],
      }),
    })) as any;
    await expect(searchShopeeOffers({})).rejects.toThrow('Shopee API: no access (10035)');
  });
});
