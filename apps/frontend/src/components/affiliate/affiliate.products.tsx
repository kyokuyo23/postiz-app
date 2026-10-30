'use client';

import { FC, useCallback, useState } from 'react';
import dayjs from 'dayjs';
import copy from 'copy-to-clipboard';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { showMediaBox } from '@gitroom/frontend/components/media/media.component';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import {
  Card,
  EmptyState,
  PageShell,
  SmallButton,
  inputClass,
} from '@gitroom/frontend/components/engagement/engagement.ui';
import { readError } from '@gitroom/frontend/components/engagement/engagement.hooks';
import {
  AffiliateProduct,
  MARKETPLACES,
  Marketplace,
  affiliateCaption,
  affiliateVideoPrompt,
  marketplaceLabel,
  useAffiliateProducts,
  useIntegrationsForEditor,
  GalleryItem,
  parseGallery,
} from '@gitroom/frontend/components/affiliate/affiliate.hooks';
import { StoryboardEditor } from '@gitroom/frontend/components/affiliate/storyboard.editor';

type FormValues = {
  name: string;
  price: string;
  marketplace: Marketplace;
  link: string;
  notes: string;
  description: string;
  image: { id: string; path: string } | null;
  gallery: GalleryItem[];
};

const emptyForm: FormValues = {
  name: '',
  price: '',
  marketplace: 'shopee',
  link: '',
  notes: '',
  description: '',
  image: null,
  gallery: [],
};

const ProductForm: FC<{
  product?: AffiliateProduct;
  onSaved: () => void;
}> = ({ product, onSaved }) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const modals = useModals();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<FormValues>(
    product
      ? {
          name: product.name,
          price: product.price || '',
          marketplace: product.marketplace,
          link: product.link,
          notes: product.notes || '',
          description: product.description || '',
          gallery: parseGallery(product.gallery),
          image: product.imagePath
            ? { id: product.imageId || '', path: product.imagePath }
            : null,
        }
      : emptyForm
  );

  const set = useCallback(
    <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
      setValues((v) => ({ ...v, [key]: value })),
    []
  );

  const pickImage = useCallback(() => {
    showMediaBox((media: any) => {
      const picked = Array.isArray(media) ? media[0] : media;
      if (picked?.path) {
        set('image', { id: picked.id, path: picked.path });
      }
    });
  }, [set]);

  const addToGallery = useCallback(
    (source: GalleryItem['source']) => () => {
      showMediaBox((media: any) => {
        const picked = (Array.isArray(media) ? media : [media]).filter(
          (m: any) => m?.path
        );
        setValues((v) => ({
          ...v,
          gallery: [
            ...v.gallery,
            ...picked
              .filter((m: any) => !v.gallery.some((g) => g.path === m.path))
              .map(
                (m: any): GalleryItem => ({
                  id: m.id,
                  path: m.path,
                  type: /\.(mp4|mov|webm)(\?|$)/i.test(m.path) ? 'video' : 'image',
                  source,
                })
              ),
          ].slice(0, 30),
        }));
      });
    },
    []
  );

  const removeFromGallery = useCallback(
    (path: string) => () =>
      setValues((v) => ({ ...v, gallery: v.gallery.filter((g) => g.path !== path) })),
    []
  );

  const save = useCallback(async () => {
    if (!values.name.trim() || !/^https?:\/\//i.test(values.link.trim())) {
      toaster.show(
        t(
          'affiliate_required',
          'Isi nama produk dan link affiliate (diawali https://)'
        ),
        'warning'
      );
      return;
    }
    setSaving(true);
    const res = await fetch(
      product ? `/affiliate/products/${product.id}` : '/affiliate/products',
      {
        method: product ? 'PUT' : 'POST',
        body: JSON.stringify({
          name: values.name,
          price: values.price || undefined,
          marketplace: values.marketplace,
          link: values.link.trim(),
          notes: values.notes || undefined,
          description: values.description,
          gallery: values.gallery,
          imageId: values.image?.id || undefined,
          imagePath: values.image?.path || undefined,
        }),
      }
    );
    setSaving(false);
    if (!res.ok) {
      toaster.show(await readError(res, 'Gagal menyimpan produk'), 'warning');
      return;
    }
    toaster.show(t('affiliate_saved', 'Produk tersimpan'), 'success');
    onSaved();
    modals.closeCurrent();
  }, [values, product, fetch, toaster, t, onSaved, modals]);

  return (
    <div className="flex flex-col gap-[14px] min-w-[min(520px,85vw)]">
      <label className="flex flex-col gap-[6px] text-[14px]">
        {t('affiliate_name', 'Nama produk')}
        <input
          className={inputClass}
          value={values.name}
          maxLength={200}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Serum Vitamin C 30ml"
        />
      </label>
      <div className="flex gap-[12px] flex-wrap">
        <label className="flex flex-col gap-[6px] text-[14px] flex-1 min-w-[160px]">
          {t('affiliate_price', 'Harga')}
          <input
            className={inputClass}
            value={values.price}
            maxLength={50}
            onChange={(e) => set('price', e.target.value)}
            placeholder="Rp 89.000"
          />
        </label>
        <label className="flex flex-col gap-[6px] text-[14px] flex-1 min-w-[160px]">
          {t('affiliate_marketplace', 'Marketplace')}
          <select
            className={inputClass}
            value={values.marketplace}
            onChange={(e) => set('marketplace', e.target.value as Marketplace)}
          >
            {MARKETPLACES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-[6px] text-[14px]">
        {t('affiliate_link', 'Link affiliate')}
        <input
          className={inputClass}
          value={values.link}
          maxLength={2000}
          onChange={(e) => set('link', e.target.value)}
          placeholder="https://s.shopee.co.id/..."
        />
      </label>
      <label className="flex flex-col gap-[6px] text-[14px]">
        {t('affiliate_notes', 'Keunggulan / info promo (opsional)')}
        <textarea
          className={`${inputClass} h-[90px] py-[10px] resize-y`}
          value={values.notes}
          maxLength={2000}
          onChange={(e) => set('notes', e.target.value)}
          placeholder={'Bikin wajah glowing dalam 7 hari\nDiskon 50% hari ini'}
        />
      </label>
      <div className="flex flex-col gap-[6px] text-[14px]">
        {t('affiliate_photo', 'Foto produk')}
        <div className="flex items-center gap-[12px]">
          {values.image ? (
            <img
              src={values.image.path}
              alt=""
              className="w-[72px] h-[72px] rounded-[8px] object-cover border border-newTableBorder"
            />
          ) : (
            <div className="w-[72px] h-[72px] rounded-[8px] border border-dashed border-newTableBorder" />
          )}
          <SmallButton onClick={pickImage}>
            {values.image
              ? t('affiliate_change_photo', 'Ganti foto')
              : t('affiliate_pick_photo', 'Pilih foto')}
          </SmallButton>
          {values.image && (
            <SmallButton onClick={() => set('image', null)}>
              {t('remove', 'Hapus')}
            </SmallButton>
          )}
        </div>
      </div>
      <label className="flex flex-col gap-[6px] text-[14px]">
        {t('affiliate_description', 'Deskripsi produk (opsional)')}
        <textarea
          className={`${inputClass} h-[110px] py-[10px] resize-y`}
          value={values.description}
          maxLength={10000}
          onChange={(e) => set('description', e.target.value)}
          placeholder={t(
            'affiliate_description_hint',
            'Tempel deskripsi dari halaman produk. Dipakai untuk storyboard video dan caption.'
          )}
        />
      </label>
      <div className="flex flex-col gap-[8px] text-[14px]">
        {t('affiliate_gallery', 'Galeri foto & video')}
        {!!values.gallery.length && (
          <div className="flex flex-wrap gap-[8px]">
            {values.gallery.map((g) => (
              <div key={g.path} className="relative w-[72px] h-[72px]">
                {g.type === 'video' ? (
                  <video src={g.path} muted className="w-full h-full rounded-[8px] object-cover border border-newTableBorder" />
                ) : (
                  <img src={g.path} alt="" className="w-full h-full rounded-[8px] object-cover border border-newTableBorder" />
                )}
                {g.source === 'review' && (
                  <span className="absolute bottom-[2px] start-[2px] text-[10px] px-[4px] rounded bg-amber-500 text-black">
                    review
                  </span>
                )}
                <button
                  type="button"
                  onClick={removeFromGallery(g.path)}
                  className="absolute -top-[6px] -end-[6px] w-[20px] h-[20px] rounded-full bg-red-600 text-white text-[12px] leading-[20px]"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-[8px]">
          <SmallButton onClick={addToGallery('product')}>
            {t('affiliate_add_product_media', '+ Foto/video produk')}
          </SmallButton>
          <SmallButton onClick={addToGallery('review')}>
            {t('affiliate_add_review_media', '+ Foto review pembeli')}
          </SmallButton>
        </div>
        <div className="text-[12px] text-textItemBlur">
          {t(
            'affiliate_review_warning',
            'Foto review adalah milik pembeli: dipakai sebagai referensi dan tidak masuk video otomatis. Pakai di postingan hanya jika sudah ada izin.'
          )}
        </div>
      </div>
      <div className="flex justify-end gap-[8px] pt-[6px]">
        <SmallButton onClick={() => modals.closeCurrent()}>
          {t('cancel', 'Batal')}
        </SmallButton>
        <SmallButton variant="primary" onClick={save} disabled={saving}>
          {t('save', 'Simpan')}
        </SmallButton>
      </div>
    </div>
  );
};

export const useAffiliateTabs = () => {
  const t = useT();
  return [
    { label: t('affiliate_catalog', 'Katalog'), href: '/affiliate' },
    { label: t('affiliate_shopee_research', 'Riset Shopee'), href: '/affiliate/shopee' },
  ];
};

export const AffiliateProducts: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const modals = useModals();
  const [search, setSearch] = useState('');
  const { data, mutate, isLoading } = useAffiliateProducts(search);
  const { data: integrations } = useIntegrationsForEditor();
  const tabs = useAffiliateTabs();

  const openForm = useCallback(
    (product?: AffiliateProduct) => () => {
      modals.openModal({
        title: product
          ? t('affiliate_edit', 'Edit produk')
          : t('affiliate_add', 'Tambah produk affiliate'),
        withCloseButton: true,
        children: <ProductForm product={product} onSaved={() => mutate()} />,
      });
    },
    [modals, t, mutate]
  );

  const createPost = useCallback(
    (product: AffiliateProduct, media?: { id: string; path: string }[]) => async () => {
      if (!integrations?.length) {
        toaster.show(
          t('affiliate_no_channels', 'Sambungkan channel dulu di menu Launches'),
          'warning'
        );
        return;
      }
      const date = (await (await fetch('/posts/find-slot')).json()).date;
      const reopen = () => createPost(product, media)();
      modals.openModal({
        id: 'add-edit-modal',
        closeOnClickOutside: false,
        removeLayout: true,
        closeOnEscape: false,
        withCloseButton: false,
        askClose: true,
        fullScreen: true,
        classNames: { modal: 'w-[100%] max-w-[1400px] text-textColor' },
        size: '80%',
        title: '',
        children: (
          <AddEditModal
            allIntegrations={integrations.map((p: any) => ({ ...p }))}
            integrations={integrations}
            date={dayjs.utc(date).local()}
            reopenModal={reopen}
            mutate={() => undefined}
            onlyValues={[
              {
                content: affiliateCaption(product),
                image: media
                  ? media
                  : product.imagePath
                  ? [{ id: product.imageId || '', path: product.imagePath }]
                  : [],
              },
            ]}
          />
        ),
      });
    },
    [integrations, fetch, modals, toaster, t]
  );

  const openStoryboard = useCallback(
    (product: AffiliateProduct) => () => {
      modals.openModal({
        title: t('affiliate_video_title', 'Video promo: storyboard'),
        withCloseButton: true,
        size: '900px',
        children: (
          <StoryboardEditor
            product={product}
            onUseVideo={(video) => {
              modals.closeAll();
              createPost(product, [video])();
            }}
          />
        ),
      });
    },
    [modals, t, createPost]
  );

  const copyVideoPrompt = useCallback(
    (product: AffiliateProduct) => () => {
      copy(affiliateVideoPrompt(product));
      toaster.show(
        t(
          'affiliate_video_prompt_copied',
          'Prompt video disalin. Di editor postingan: Insert Media → Generate video → Veo3, tempel prompt & pilih foto produk.'
        ),
        'success'
      );
    },
    [toaster, t]
  );

  const remove = useCallback(
    (product: AffiliateProduct) => async () => {
      if (
        !(await deleteDialog(
          t('affiliate_delete_confirm', `Hapus produk "${product.name}"?`, {
            name: product.name,
          })
        ))
      ) {
        return;
      }
      await fetch(`/affiliate/products/${product.id}`, { method: 'DELETE' });
      mutate();
    },
    [fetch, t, mutate]
  );

  return (
    <PageShell
      title={t('affiliate', 'Affiliate')}
      description={t(
        'affiliate_description',
        'Simpan produk affiliate, lalu buat postingan promosi (caption, foto, link) atau video AI untuk semua channel.'
      )}
      tabs={tabs}
      actions={
        <SmallButton variant="primary" onClick={openForm()}>
          {t('affiliate_add', 'Tambah produk affiliate')}
        </SmallButton>
      }
    >
      <input
        className={`${inputClass} max-w-[360px]`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('affiliate_search', 'Cari produk…')}
      />
      {!isLoading && !data?.length ? (
        <Card>
          <EmptyState title={t('affiliate_empty', 'Belum ada produk')}>
            {t(
              'affiliate_empty_hint',
              'Tambahkan produk dengan nama, harga, link affiliate dan fotonya. Setelah itu klik "Buat postingan" untuk mempromosikannya.'
            )}
          </EmptyState>
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[16px]">
          {data?.map((product) => (
            <Card key={product.id} className="flex flex-col gap-[12px] !p-[14px]">
              {product.imagePath ? (
                <img
                  src={product.imagePath}
                  alt=""
                  className="w-full aspect-square rounded-[8px] object-cover"
                />
              ) : (
                <div className="w-full aspect-square rounded-[8px] bg-newBgColorInner flex items-center justify-center text-[13px] text-textItemBlur">
                  {t('affiliate_no_photo', 'Tanpa foto')}
                </div>
              )}
              <div className="flex flex-col gap-[4px]">
                <div className="text-[15px] font-[600] line-clamp-2">
                  {product.name}
                </div>
                <div className="flex items-center gap-[8px] text-[13px] text-textItemBlur">
                  <span className="px-[8px] py-[2px] rounded-[6px] bg-newBgColorInner">
                    {marketplaceLabel(product.marketplace)}
                  </span>
                  {product.price && <span>{product.price}</span>}
                </div>
                {product.commission && (
                  <div className="text-[12px] text-green-500">
                    {t('affiliate_commission', 'Komisi')}: {product.commission}
                  </div>
                )}
                <a
                  href={product.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-textItemBlur underline truncate"
                >
                  {product.link}
                </a>
              </div>
              <div className="flex flex-wrap gap-[6px] mt-auto">
                <SmallButton variant="primary" onClick={createPost(product)}>
                  {t('affiliate_create_post', 'Buat postingan')}
                </SmallButton>
                <SmallButton onClick={openStoryboard(product)}>
                  {t('affiliate_make_video', 'Buat video')}
                </SmallButton>
                <SmallButton onClick={copyVideoPrompt(product)}>
                  {t('affiliate_video_prompt', 'Prompt video')}
                </SmallButton>
                <SmallButton onClick={openForm(product)}>
                  {t('edit', 'Edit')}
                </SmallButton>
                <SmallButton onClick={remove(product)}>
                  {t('delete', 'Hapus')}
                </SmallButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
};
