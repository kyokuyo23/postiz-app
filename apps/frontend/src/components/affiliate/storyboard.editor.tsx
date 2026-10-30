'use client';

import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  Segmented,
  SmallButton,
  inputClass,
} from '@gitroom/frontend/components/engagement/engagement.ui';
import { readError } from '@gitroom/frontend/components/engagement/engagement.hooks';
import {
  AffiliateProduct,
  AffiliateVideo,
  GalleryItem,
  SceneKind,
  STORYBOARD_STYLES,
  Storyboard,
  StoryboardScene,
  StoryboardStyle,
  useAffiliateVideos,
  useVideoRendererStatus,
} from '@gitroom/frontend/components/affiliate/affiliate.hooks';

const KIND_LABEL: Record<SceneKind, string> = {
  hook: 'Hook (3 detik)',
  problem: 'Masalah',
  reveal: 'Produk',
  benefit: 'Manfaat',
  proof: 'Bukti sosial',
  price: 'Harga',
  cta: 'Ajakan (CTA)',
};

const KINDS = Object.keys(KIND_LABEL) as SceneKind[];

const STATUS_LABEL: Record<AffiliateVideo['status'], string> = {
  QUEUED: 'Antre',
  RENDERING: 'Sedang dibuat…',
  DONE: 'Selesai',
  ERROR: 'Gagal',
};

const total = (sb: Storyboard) =>
  Math.round(sb.scenes.reduce((s, sc) => s + sc.duration, 0) * 10) / 10;

const VideoList: FC<{
  productId: string;
  onUseVideo: (media: { id: string; path: string }) => void;
}> = ({ productId, onUseVideo }) => {
  const t = useT();
  const { data } = useAffiliateVideos(productId);
  if (!data?.length) return null;
  return (
    <div className="flex flex-col gap-[10px]">
      <div className="text-[14px] font-[600]">{t('affiliate_videos', 'Video')}</div>
      <div className="flex flex-wrap gap-[12px]">
        {data.map((v) => (
          <div
            key={v.id}
            className="w-[150px] flex flex-col gap-[6px] bg-newBgColorInner rounded-[8px] p-[8px]"
          >
            {v.status === 'DONE' && v.mediaPath ? (
              <video
                src={v.mediaPath}
                controls
                className="w-full aspect-[9/16] rounded-[6px] bg-black"
              />
            ) : (
              <div className="w-full aspect-[9/16] rounded-[6px] bg-newBgColor flex items-center justify-center text-center text-[12px] text-textItemBlur p-[8px]">
                {v.status === 'ERROR' ? v.error || 'Error' : STATUS_LABEL[v.status]}
              </div>
            )}
            <div
              className={clsx(
                'text-[12px] font-[600]',
                v.status === 'DONE' && 'text-green-500',
                v.status === 'ERROR' && 'text-red-500'
              )}
            >
              {STATUS_LABEL[v.status]}
            </div>
            {v.status === 'DONE' && v.mediaId && v.mediaPath && (
              <SmallButton
                variant="primary"
                onClick={() => onUseVideo({ id: v.mediaId!, path: v.mediaPath! })}
              >
                {t('affiliate_use_video', 'Buat postingan')}
              </SmallButton>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const StoryboardEditor: FC<{
  product: AffiliateProduct;
  onUseVideo: (media: { id: string; path: string }) => void;
}> = ({ product, onUseVideo }) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { data: renderer } = useVideoRendererStatus();
  const { mutate: reloadVideos } = useAffiliateVideos(product.id);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [style, setStyle] = useState<StoryboardStyle>('pov');
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [source, setSource] = useState<'ai' | 'template' | null>(null);
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);

  const generate = useCallback(
    async (nextTheme: 'dark' | 'light', nextStyle: StoryboardStyle) => {
      setLoading(true);
      const res = await fetch(`/affiliate/products/${product.id}/storyboard`, {
        method: 'POST',
        body: JSON.stringify({ theme: nextTheme, style: nextStyle }),
      });
      setLoading(false);
      if (!res.ok) {
        toaster.show(await readError(res, 'Gagal membuat storyboard'), 'warning');
        return;
      }
      const body = await res.json();
      setStoryboard(body.storyboard);
      setGallery(body.gallery || []);
      setSource(body.source);
    },
    [fetch, product.id, toaster]
  );

  useEffect(() => {
    generate('dark', 'pov');
  }, []);

  const images = useMemo(
    () =>
      gallery
        .map((g, index) => ({ ...g, index }))
        .filter((g) => g.type === 'image'),
    [gallery]
  );

  const updateScene = useCallback(
    (index: number, patch: Partial<StoryboardScene>) =>
      setStoryboard((sb) =>
        sb
          ? {
              ...sb,
              scenes: sb.scenes.map((s, i) => (i === index ? { ...s, ...patch } : s)),
            }
          : sb
      ),
    []
  );

  const moveScene = useCallback(
    (index: number, delta: number) => () =>
      setStoryboard((sb) => {
        if (!sb) return sb;
        const target = index + delta;
        // the hook stays first
        if (index === 0 || target <= 0 || target >= sb.scenes.length) return sb;
        const scenes = [...sb.scenes];
        [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
        return { ...sb, scenes };
      }),
    []
  );

  const removeScene = useCallback(
    (index: number) => () =>
      setStoryboard((sb) =>
        sb && index > 0 && sb.scenes.length > 3
          ? { ...sb, scenes: sb.scenes.filter((_, i) => i !== index) }
          : sb
      ),
    []
  );

  const addScene = useCallback(
    () =>
      setStoryboard((sb) => {
        if (!sb || sb.scenes.length >= 10) return sb;
        const scenes = [...sb.scenes];
        const ctaAt = scenes.findIndex((s) => s.kind === 'cta');
        const scene: StoryboardScene = {
          kind: 'benefit',
          duration: 2.5,
          headline: '✓ ',
          imageIndex: images[0]?.index ?? -1,
        };
        scenes.splice(ctaAt === -1 ? scenes.length : ctaAt, 0, scene);
        return { ...sb, scenes };
      }),
    [images]
  );

  const render = useCallback(async () => {
    if (!storyboard) return;
    if (storyboard.scenes.some((s) => !s.headline.trim())) {
      toaster.show(t('affiliate_scene_empty', 'Setiap adegan butuh teks utama'), 'warning');
      return;
    }
    const usesReview = storyboard.scenes.some(
      (s) => s.imageIndex !== undefined && gallery[s.imageIndex]?.source === 'review'
    );
    if (
      usesReview &&
      !window.confirm(
        'Video ini memakai foto review pembeli. Lanjutkan hanya jika kamu sudah punya izin dari pemilik foto.'
      )
    ) {
      return;
    }
    setRendering(true);
    const res = await fetch(`/affiliate/products/${product.id}/videos`, {
      method: 'POST',
      body: JSON.stringify({
        storyboard: {
          ...storyboard,
          theme,
          style,
          scenes: storyboard.scenes.map((s) => ({
            ...s,
            subtext: s.subtext?.trim() ? s.subtext.trim() : undefined,
          })),
        },
      }),
    });
    setRendering(false);
    if (!res.ok) {
      toaster.show(await readError(res, 'Gagal membuat video'), 'warning');
      return;
    }
    toaster.show(
      t('affiliate_render_started', 'Video sedang dibuat (1-3 menit). Hasilnya muncul di bawah.'),
      'success'
    );
    reloadVideos();
  }, [storyboard, gallery, theme, style, fetch, product.id, toaster, t, reloadVideos]);

  return (
    <div className="flex flex-col gap-[16px] w-[min(860px,90vw)] max-h-[80vh] overflow-auto pe-[4px]">
      {renderer && !renderer.available && (
        <div className="text-[13px] bg-amber-500/15 border border-amber-500/40 rounded-[8px] p-[10px]">
          {t(
            'affiliate_renderer_missing',
            'Pembuat video belum terpasang di server. Build ulang backend di VPS (git pull + docker build) lalu coba lagi.'
          )}
        </div>
      )}
      <div className="flex flex-col gap-[8px]">
        <div className="text-[13px] font-[600]">{t('affiliate_style', 'Gaya video')}</div>
        <div className="flex flex-wrap gap-[8px]">
          {STORYBOARD_STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              disabled={loading}
              onClick={() => {
                setStyle(s.value);
                generate(theme, s.value);
              }}
              className={clsx(
                'px-[12px] py-[8px] rounded-[8px] text-[13px] text-start border transition-colors max-w-[200px]',
                style === s.value
                  ? 'border-btnPrimary bg-btnPrimary/10'
                  : 'border-newTableBorder hover:border-textItemBlur'
              )}
            >
              <div className="font-[600]">{s.label}</div>
              <div className="text-[11px] text-textItemBlur leading-[1.3]">{s.hint}</div>
            </button>
          ))}
        </div>
        {style === 'review' && (
          <div className="text-[12px] text-amber-500">
            {t(
              'affiliate_review_style_note',
              'Gaya review tidak mengaku sudah memakai produk. Kalau kamu memang sudah mencobanya, tambahkan pengalamanmu sendiri di teks adegan.'
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-[10px]">
        <Segmented
          value={theme}
          options={[
            { label: 'Gelap', value: 'dark' },
            { label: 'Terang', value: 'light' },
          ]}
          onChange={(v) => {
            setTheme(v);
            setStoryboard((sb) => (sb ? { ...sb, theme: v } : sb));
          }}
        />
        <SmallButton onClick={() => generate(theme, style)} disabled={loading}>
          {loading
            ? t('loading', 'Memuat…')
            : t('affiliate_regenerate', 'Buat ulang storyboard')}
        </SmallButton>
        {source && (
          <span className="text-[12px] text-textItemBlur">
            {source === 'ai'
              ? t('affiliate_sb_ai', 'Ditulis AI')
              : t('affiliate_sb_template', 'Template otomatis (isi key AI untuk storyboard AI)')}
          </span>
        )}
        {storyboard && (
          <span className="text-[12px] text-textItemBlur ms-auto">
            {t('affiliate_total', 'Total')}: {total(storyboard)}s / 40s
          </span>
        )}
      </div>

      {storyboard?.scenes.map((scene, i) => (
        <div
          key={i}
          className="flex gap-[12px] bg-newBgColorInner rounded-[10px] p-[12px] flex-wrap"
        >
          <div className="flex flex-col gap-[6px] w-[96px]">
            <div className="text-[12px] font-[600]">
              {i + 1}. {KIND_LABEL[scene.kind]}
            </div>
            {scene.imageIndex !== undefined && scene.imageIndex >= 0 && gallery[scene.imageIndex] ? (
              <img
                src={gallery[scene.imageIndex].path}
                alt=""
                className="w-[96px] h-[96px] rounded-[6px] object-cover"
              />
            ) : (
              <div className="w-[96px] h-[96px] rounded-[6px] border border-dashed border-newTableBorder" />
            )}
          </div>
          <div className="flex-1 min-w-[260px] flex flex-col gap-[8px]">
            <div className="flex gap-[8px] flex-wrap">
              {i > 0 && (
                <select
                  className={`${inputClass} !h-[34px] !w-auto`}
                  value={scene.kind}
                  onChange={(e) => updateScene(i, { kind: e.target.value as SceneKind })}
                >
                  {KINDS.filter((k) => k !== 'hook').map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              )}
              <label className="flex items-center gap-[6px] text-[12px]">
                {t('affiliate_seconds', 'Detik')}
                <input
                  type="number"
                  min={1.5}
                  max={i === 0 ? 3 : 6}
                  step={0.5}
                  className={`${inputClass} !h-[34px] !w-[72px]`}
                  value={scene.duration}
                  onChange={(e) =>
                    updateScene(i, {
                      duration: Math.min(
                        i === 0 ? 3 : 6,
                        Math.max(1.5, Number(e.target.value) || 1.5)
                      ),
                    })
                  }
                />
              </label>
              <select
                className={`${inputClass} !h-[34px] !w-auto`}
                value={scene.imageIndex ?? -1}
                onChange={(e) => updateScene(i, { imageIndex: Number(e.target.value) })}
              >
                <option value={-1}>{t('affiliate_no_photo', 'Tanpa foto')}</option>
                {images.map((img, n) => (
                  <option key={img.index} value={img.index}>
                    {img.source === 'review'
                      ? `Foto review ${n + 1} (milik pembeli)`
                      : `Foto produk ${n + 1}`}
                  </option>
                ))}
              </select>
            </div>
            <input
              className={inputClass}
              value={scene.headline}
              maxLength={80}
              onChange={(e) => updateScene(i, { headline: e.target.value })}
              placeholder={t('affiliate_headline', 'Teks utama di layar')}
            />
            <input
              className={inputClass}
              value={scene.subtext || ''}
              maxLength={140}
              onChange={(e) => updateScene(i, { subtext: e.target.value })}
              placeholder={t('affiliate_subtext', 'Teks kecil (opsional)')}
            />
            {scene.voiceover && (
              <div className="text-[12px] text-textItemBlur">🎙️ {scene.voiceover}</div>
            )}
          </div>
          {i > 0 && (
            <div className="flex flex-col gap-[6px]">
              <SmallButton onClick={moveScene(i, -1)} disabled={i <= 1}>
                ↑
              </SmallButton>
              <SmallButton onClick={moveScene(i, 1)} disabled={i >= storyboard.scenes.length - 1}>
                ↓
              </SmallButton>
              <SmallButton onClick={removeScene(i)} disabled={storyboard.scenes.length <= 3}>
                ✕
              </SmallButton>
            </div>
          )}
        </div>
      ))}

      {storyboard && (
        <div className="flex flex-wrap gap-[8px] justify-between">
          <SmallButton onClick={addScene} disabled={storyboard.scenes.length >= 10}>
            {t('affiliate_add_scene', '+ Tambah adegan')}
          </SmallButton>
          <SmallButton
            variant="primary"
            onClick={render}
            disabled={rendering || total(storyboard) > 40 || renderer?.available === false}
          >
            {rendering ? t('loading', 'Memuat…') : t('affiliate_render', 'Buat video')}
          </SmallButton>
        </div>
      )}

      <VideoList productId={product.id} onUseVideo={onUseVideo} />
    </div>
  );
};
