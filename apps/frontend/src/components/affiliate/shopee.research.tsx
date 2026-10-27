'use client';

import { FC, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  Card,
  EmptyState,
  PageShell,
  Segmented,
  SmallButton,
  inputClass,
} from '@gitroom/frontend/components/engagement/engagement.ui';
import { readError } from '@gitroom/frontend/components/engagement/engagement.hooks';
import { useAffiliateTabs } from '@gitroom/frontend/components/affiliate/affiliate.products';
import {
  ShopeeFilter,
  ShopeeOffer,
  ShopeeSort,
  pct,
  rupiah,
  useAffiliateProducts,
  useShopeeOffers,
  useShopeeStatus,
} from '@gitroom/frontend/components/affiliate/affiliate.hooks';

const priceText = (o: ShopeeOffer) =>
  o.priceMax !== null && o.priceMin !== null && o.priceMax > o.priceMin
    ? `${rupiah(o.priceMin)} - ${rupiah(o.priceMax)}`
    : rupiah(o.priceMin);

export const ShopeeResearch: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const router = useRouter();
  const tabs = useAffiliateTabs();
  const { data: status } = useShopeeStatus();
  const { mutate: reloadCatalog } = useAffiliateProducts('');

  const [keywordInput, setKeywordInput] = useState('');
  const [filter, setFilter] = useState<ShopeeFilter>({
    keyword: '',
    sort: 'sales',
    trending: true,
    extra: false,
    page: 1,
  });
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<Record<string, boolean>>({});

  const configured = !!status?.configured;
  const { data, error, isLoading } = useShopeeOffers(filter, configured);

  const update = useCallback(
    (patch: Partial<ShopeeFilter>) =>
      setFilter((f) => ({ ...f, page: 1, ...patch })),
    []
  );

  const search = useCallback(() => {
    update({ keyword: keywordInput, trending: !keywordInput.trim() });
  }, [keywordInput, update]);

  const importOffer = useCallback(
    (offer: ShopeeOffer) => async () => {
      setImporting(offer.itemId);
      const res = await fetch('/affiliate/products/shopee/import', {
        method: 'POST',
        body: JSON.stringify({ itemId: offer.itemId }),
      });
      setImporting(null);
      if (!res.ok) {
        toaster.show(await readError(res, 'Gagal menambahkan produk'), 'warning');
        return;
      }
      setImported((m) => ({ ...m, [offer.itemId]: true }));
      reloadCatalog();
      toaster.show(
        t('affiliate_imported', 'Ditambahkan ke katalog. Buka tab Katalog untuk membuat postingan.'),
        'success'
      );
    },
    [fetch, toaster, t, reloadCatalog]
  );

  return (
    <PageShell
      title={t('affiliate', 'Affiliate')}
      description={t(
        'affiliate_shopee_description',
        'Cari produk Shopee Affiliate yang sedang laris, komisi tertinggi, atau ada Komisi XTRA, lalu tambahkan ke katalog dengan link affiliate dan fotonya.'
      )}
      tabs={tabs}
    >
      {status && !configured ? (
        <Card>
          <EmptyState
            title={t('affiliate_shopee_not_configured', 'Shopee Affiliate API belum diatur')}
          >
            {t(
              'affiliate_shopee_setup',
              'Masukkan AppID dan Secret Shopee Affiliate Open API di server (script set-credentials, bagian Shopee Affiliate), lalu muat ulang halaman ini.'
            )}
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-[10px]">
            <form
              className="flex gap-[8px] flex-1 min-w-[260px] max-w-[480px]"
              onSubmit={(e) => {
                e.preventDefault();
                search();
              }}
            >
              <input
                className={inputClass}
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                placeholder={t('affiliate_shopee_keyword', 'Kata kunci, mis. serum wajah')}
              />
              <SmallButton type="submit" variant="primary">
                {t('search', 'Cari')}
              </SmallButton>
            </form>
            <Segmented<ShopeeSort>
              value={filter.sort}
              onChange={(sort) => update({ sort })}
              options={[
                { label: t('affiliate_sort_sales', 'Terlaris'), value: 'sales' },
                { label: t('affiliate_sort_commission', 'Komisi'), value: 'commission' },
                { label: t('affiliate_sort_relevance', 'Relevan'), value: 'relevance' },
                { label: t('affiliate_sort_price', 'Termurah'), value: 'price_asc' },
              ]}
            />
            <label className="flex items-center gap-[6px] text-[14px] cursor-pointer">
              <input
                type="checkbox"
                checked={filter.trending}
                onChange={(e) => update({ trending: e.target.checked })}
              />
              {t('affiliate_trending', 'Trending')}
            </label>
            <label className="flex items-center gap-[6px] text-[14px] cursor-pointer">
              <input
                type="checkbox"
                checked={filter.extra}
                onChange={(e) => update({ extra: e.target.checked })}
              />
              {t('affiliate_extra', 'Hanya Komisi XTRA')}
            </label>
          </div>

          {error ? (
            <Card>
              <EmptyState title={t('affiliate_shopee_error', 'Shopee API menolak permintaan')}>
                {(error as Error).message}
              </EmptyState>
            </Card>
          ) : isLoading || !status ? (
            <div className="text-[14px] text-textItemBlur">{t('loading', 'Memuat…')}</div>
          ) : !data?.offers.length ? (
            <Card>
              <EmptyState title={t('affiliate_shopee_empty', 'Tidak ada produk')}>
                {t('affiliate_shopee_empty_hint', 'Coba kata kunci lain atau matikan filter.')}
              </EmptyState>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[16px]">
                {data.offers.map((offer) => (
                  <Card key={offer.itemId} className="flex flex-col gap-[10px] !p-[12px]">
                    {offer.imageUrl ? (
                      <img
                        src={offer.imageUrl}
                        alt=""
                        className="w-full aspect-square rounded-[8px] object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full aspect-square rounded-[8px] bg-newBgColorInner" />
                    )}
                    <div className="text-[14px] font-[600] line-clamp-2">{offer.name}</div>
                    <div className="text-[14px]">{priceText(offer)}</div>
                    <div className="flex flex-wrap gap-[6px] text-[12px]">
                      <span className="px-[8px] py-[2px] rounded-[6px] bg-green-600/20 text-green-500">
                        {t('affiliate_commission', 'Komisi')} {pct(offer.commissionRate)}
                      </span>
                      {offer.sellerCommissionRate > 0 && (
                        <span className="px-[8px] py-[2px] rounded-[6px] bg-orange-500/20 text-orange-400">
                          XTRA {pct(offer.sellerCommissionRate)}
                        </span>
                      )}
                      {offer.commission !== null && offer.commission > 0 && (
                        <span className="px-[8px] py-[2px] rounded-[6px] bg-newBgColorInner text-textItemBlur">
                          ±{rupiah(offer.commission)}
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-textItemBlur">
                      {offer.sales.toLocaleString('id-ID')} {t('affiliate_sold', 'terjual')}
                      {offer.rating ? ` · ★ ${offer.rating.toFixed(1)}` : ''}
                      {offer.shopName ? ` · ${offer.shopName}` : ''}
                    </div>
                    <div className="mt-auto">
                      <SmallButton
                        variant={imported[offer.itemId] ? 'simple' : 'primary'}
                        disabled={importing === offer.itemId || imported[offer.itemId]}
                        onClick={importOffer(offer)}
                      >
                        {imported[offer.itemId]
                          ? t('affiliate_in_catalog', 'Sudah di katalog')
                          : importing === offer.itemId
                          ? t('affiliate_importing', 'Menambahkan…')
                          : t('affiliate_add_to_catalog', 'Tambah ke katalog')}
                      </SmallButton>
                    </div>
                  </Card>
                ))}
              </div>
              <div className={clsx('flex items-center gap-[8px] justify-center')}>
                <SmallButton
                  disabled={filter.page <= 1}
                  onClick={() => setFilter((f) => ({ ...f, page: f.page - 1 }))}
                >
                  {t('previous', 'Sebelumnya')}
                </SmallButton>
                <span className="text-[13px] text-textItemBlur">
                  {t('page', 'Halaman')} {filter.page}
                </span>
                <SmallButton
                  disabled={!data.hasNextPage || filter.page >= 50}
                  onClick={() => setFilter((f) => ({ ...f, page: f.page + 1 }))}
                >
                  {t('next', 'Berikutnya')}
                </SmallButton>
                <SmallButton onClick={() => router.push('/affiliate')}>
                  {t('affiliate_open_catalog', 'Buka katalog')}
                </SmallButton>
              </div>
            </>
          )}
        </>
      )}
    </PageShell>
  );
};
