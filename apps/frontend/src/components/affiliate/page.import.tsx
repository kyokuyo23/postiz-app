'use client';

import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  Card,
  PageShell,
  SmallButton,
  inputClass,
} from '@gitroom/frontend/components/engagement/engagement.ui';
import { readError } from '@gitroom/frontend/components/engagement/engagement.hooks';
import {
  CapturedProduct,
  bookmarkletHref,
  readCapturedFromHash,
} from '@gitroom/frontend/components/affiliate/bookmarklet';
import { parsePageText } from '@gitroom/nestjs-libraries/affiliate/page.import';

/**
 * Draggable "Kirim ke Postiz" bookmark. React blocks javascript: URLs in
 * href, so the link is set on the DOM node after mount.
 */
export const BookmarkletInstall: FC = () => {
  const t = useT();
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    ref.current?.setAttribute('href', bookmarkletHref(window.location.origin));
  }, []);
  return (
    <Card className="flex flex-col gap-[10px]">
      <div className="text-[15px] font-[600]">
        {t('affiliate_bm_title', 'Tombol "Kirim ke Postiz" (tanpa ekstensi)')}
      </div>
      <ol className="list-decimal ps-[20px] text-[14px] flex flex-col gap-[4px]">
        <li>
          {t(
            'affiliate_bm_step1',
            'Tampilkan bookmark bar Chrome (Ctrl+Shift+B).'
          )}
        </li>
        <li>
          {t('affiliate_bm_step2', 'Seret tombol ungu di bawah ke bookmark bar.')}
        </li>
        <li>
          {t(
            'affiliate_bm_step3',
            'Buka halaman produk Shopee/Tokopedia, scroll sampai "Deskripsi Produk", lalu klik bookmark "Kirim ke Postiz".'
          )}
        </li>
      </ol>
      <div>
        <a
          ref={ref}
          onClick={(e) => e.preventDefault()}
          className="inline-block px-[16px] py-[10px] rounded-[8px] bg-btnPrimary text-white font-[600] text-[14px] cursor-grab"
        >
          ⬆ Kirim ke Postiz
        </a>
      </div>
      <div className="text-[12px] text-textItemBlur">
        {t(
          'affiliate_bm_privacy',
          'Bookmark ini hanya membaca halaman yang sedang kamu buka saat diklik dan mengirimnya ke Postiz milikmu. Tidak ada permintaan otomatis ke marketplace.'
        )}
      </div>
    </Card>
  );
};

export const PageImport: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const router = useRouter();
  const [data, setData] = useState<CapturedProduct | null>(null);
  const [link, setLink] = useState('');
  const [pasted, setPasted] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const captured = readCapturedFromHash(window.location.hash);
    if (captured) {
      setData(captured);
      // keep the data out of history/bookmarks once read
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const parsePasted = useCallback(() => {
    if (!/^https:\/\//i.test(pageUrl.trim())) {
      toaster.show(t('affiliate_paste_url', 'Isi link halaman produk (https://…)'), 'warning');
      return;
    }
    const parsed = parsePageText(pasted);
    if (!parsed.name) {
      toaster.show(t('affiliate_paste_fail', 'Nama produk tidak terbaca, isi manual di bawah'), 'warning');
    }
    setData({
      v: 1,
      url: pageUrl.trim(),
      name: parsed.name || '',
      price: parsed.price || '',
      description: parsed.description || '',
      sold: parsed.sold?.replace(/\s*terjual/i, '') || '',
      rating: parsed.rating || '',
      images: [],
      videos: [],
    });
  }, [pasted, pageUrl, toaster, t]);

  const update = useCallback(
    (patch: Partial<CapturedProduct>) => setData((d) => (d ? { ...d, ...patch } : d)),
    []
  );

  const save = useCallback(async () => {
    if (!data || !data.name.trim()) {
      toaster.show(t('affiliate_required_name', 'Nama produk wajib diisi'), 'warning');
      return;
    }
    if (link.trim() && !/^https:\/\//i.test(link.trim())) {
      toaster.show(t('affiliate_link_https', 'Link affiliate harus diawali https://'), 'warning');
      return;
    }
    setSaving(true);
    const res = await fetch('/affiliate/products/import-page', {
      method: 'POST',
      body: JSON.stringify({
        url: data.url,
        link: link.trim() || undefined,
        name: data.name.trim(),
        price: data.price || undefined,
        description: data.description || undefined,
        images: (data.images || []).filter((u) => /^https:\/\//.test(u)),
        videos: (data.videos || []).filter((u) => /^https:\/\//.test(u)),
        rating: data.rating || undefined,
        sold: data.sold || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toaster.show(await readError(res, 'Gagal menyimpan produk'), 'warning');
      return;
    }
    toaster.show(
      t('affiliate_imported', 'Produk masuk katalog. Klik "Buat video" untuk membuat video UGC.'),
      'success'
    );
    router.push('/affiliate');
  }, [data, link, fetch, toaster, t, router]);

  return (
    <PageShell
      title={t('affiliate_import_title', 'Impor produk dari halaman')}
      description={t(
        'affiliate_import_description',
        'Data dari tombol "Kirim ke Postiz" atau dari teks halaman produk yang kamu tempel.'
      )}
    >
      {!data ? (
        <>
          <BookmarkletInstall />
          <Card className="flex flex-col gap-[10px]">
            <div className="text-[15px] font-[600]">
              {t('affiliate_paste_title', 'Atau tempel teks halaman produk')}
            </div>
            <div className="text-[13px] text-textItemBlur">
              {t(
                'affiliate_paste_hint',
                'Di halaman produk tekan Ctrl+A lalu Ctrl+C, tempel di bawah. Foto ditambahkan manual setelah disimpan (Edit produk).'
              )}
            </div>
            <input
              className={inputClass}
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
              placeholder="https://shopee.co.id/…"
            />
            <textarea
              className={`${inputClass} h-[160px] py-[10px]`}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={t('affiliate_paste_placeholder', 'Tempel teks halaman di sini…')}
            />
            <div>
              <SmallButton variant="primary" onClick={parsePasted} disabled={!pasted.trim()}>
                {t('affiliate_parse', 'Baca teks')}
              </SmallButton>
            </div>
          </Card>
        </>
      ) : (
        <Card className="flex flex-col gap-[12px]">
          {!!data.images?.length && (
            <div className="flex flex-wrap gap-[8px]">
              {data.images.map((src) => (
                <div key={src} className="relative w-[96px] h-[96px]">
                  <img src={src} alt="" className="w-full h-full rounded-[8px] object-cover border border-newTableBorder" />
                  <button
                    type="button"
                    onClick={() => update({ images: data.images!.filter((i) => i !== src) })}
                    className="absolute -top-[6px] -end-[6px] w-[20px] h-[20px] rounded-full bg-red-600 text-white text-[12px] leading-[20px]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {!!data.videos?.length && (
            <div className="text-[13px] text-textItemBlur">
              🎬 {t('affiliate_videos_found', 'Video ditemukan')}: {data.videos.length}
            </div>
          )}
          <label className="flex flex-col gap-[6px] text-[14px]">
            {t('affiliate_name', 'Nama produk')}
            <input className={inputClass} value={data.name} maxLength={200} onChange={(e) => update({ name: e.target.value })} />
          </label>
          <div className="flex gap-[12px] flex-wrap">
            <label className="flex flex-col gap-[6px] text-[14px] flex-1 min-w-[150px]">
              {t('affiliate_price', 'Harga')}
              <input className={inputClass} value={data.price || ''} maxLength={50} onChange={(e) => update({ price: e.target.value })} />
            </label>
            <label className="flex flex-col gap-[6px] text-[14px] flex-1 min-w-[120px]">
              {t('affiliate_sold', 'Terjual')}
              <input className={inputClass} value={data.sold || ''} maxLength={30} onChange={(e) => update({ sold: e.target.value })} />
            </label>
            <label className="flex flex-col gap-[6px] text-[14px] flex-1 min-w-[100px]">
              {t('affiliate_rating', 'Rating')}
              <input className={inputClass} value={data.rating || ''} maxLength={20} onChange={(e) => update({ rating: e.target.value })} />
            </label>
          </div>
          <label className="flex flex-col gap-[6px] text-[14px]">
            {t('affiliate_link_optional', 'Link affiliate (opsional, dari tombol "Dapatkan link" di Shopee Affiliate)')}
            <input
              className={inputClass}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://s.shopee.co.id/…"
            />
            <span className="text-[12px] text-textItemBlur">
              {t('affiliate_link_fallback', 'Kosongkan untuk memakai link halaman produk.')}
            </span>
          </label>
          <label className="flex flex-col gap-[6px] text-[14px]">
            {t('affiliate_description', 'Deskripsi produk')}
            <textarea
              className={`${inputClass} h-[160px] py-[10px]`}
              value={data.description || ''}
              maxLength={10000}
              onChange={(e) => update({ description: e.target.value })}
            />
          </label>
          <div className="flex justify-between gap-[8px] flex-wrap">
            <SmallButton onClick={() => setData(null)}>{t('cancel', 'Batal')}</SmallButton>
            <SmallButton variant="primary" onClick={save} disabled={saving}>
              {saving
                ? t('affiliate_importing', 'Menyimpan & mengunduh foto…')
                : t('affiliate_import_save', 'Simpan ke katalog')}
            </SmallButton>
          </div>
        </Card>
      )}
    </PageShell>
  );
};
