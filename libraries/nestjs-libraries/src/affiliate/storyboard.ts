import { z } from 'zod';

/**
 * Storyboard for a short vertical affiliate video: a 3-second hook, then
 * problem -> product -> benefits -> proof -> price -> call to action.
 * Each scene picks an image from the product gallery by index.
 */

export const SCENE_KINDS = [
  'hook',
  'problem',
  'reveal',
  'benefit',
  'proof',
  'price',
  'cta',
] as const;
export type SceneKind = (typeof SCENE_KINDS)[number];

export const STORYBOARD_THEMES = ['dark', 'light'] as const;

/**
 * Content styles. 'promo' is the classic ad card; the others use a natural,
 * creator-style look (full-screen photo, subtitle captions).
 */
export const STORYBOARD_STYLES = [
  'promo',
  'pov',
  'story',
  'review',
  'tips',
  'problem',
] as const;
export type StoryboardStyle = (typeof STORYBOARD_STYLES)[number];

export const STYLE_LABELS: Record<StoryboardStyle, string> = {
  promo: 'Promo',
  pov: 'POV',
  story: 'Storytelling',
  review: 'Review jujur',
  tips: 'Tips / list',
  problem: 'Masalah → solusi',
};

export const sceneSchema = z.object({
  kind: z.enum(SCENE_KINDS),
  duration: z.number().min(1.5).max(6),
  headline: z.string().min(1).max(80),
  subtext: z.string().max(140).optional(),
  imageIndex: z.number().int().min(-1).max(49).optional(),
  voiceover: z.string().max(240).optional(),
});

export const storyboardSchema = z.object({
  title: z.string().min(1).max(120),
  theme: z.enum(STORYBOARD_THEMES).default('dark'),
  style: z.enum(STORYBOARD_STYLES).default('promo'),
  scenes: z.array(sceneSchema).min(3).max(10),
});

export type StoryboardScene = z.infer<typeof sceneSchema>;
export type Storyboard = z.infer<typeof storyboardSchema>;

export interface GalleryItem {
  id?: string | null;
  path: string;
  type: 'image' | 'video';
  /** 'review' = photo posted by a buyer; never used unless picked explicitly */
  source: 'product' | 'review';
}

export interface StoryboardProduct {
  name: string;
  price?: string | null;
  marketplace?: string | null;
  notes?: string | null;
  description?: string | null;
  gallery: GalleryItem[];
}

export const MAX_TOTAL_SECONDS = 40;

const clip = (text: string, max: number) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
};

/** Images usable by default: product photos only (not buyer review photos). */
export const productImageIndexes = (gallery: GalleryItem[]) =>
  gallery
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => g.type === 'image' && g.source === 'product')
    .map(({ i }) => i);

/** Lines of selling points from notes/description, without social proof. */
const sellingPoints = (p: StoryboardProduct) => {
  const lines = [p.notes || '', p.description || '']
    .join('\n')
    .split(/\n|•|·|;|(?<=\.)\s/)
    .map((l) => l.replace(/^[-*✓✔✅\d.)\s]+/, '').trim())
    .filter((l) => l.length >= 8 && l.length <= 120);
  const proof = lines.filter((l) => /terjual|rating|ulasan|review|⭐/i.test(l));
  const benefits = lines.filter((l) => !proof.includes(l));
  return { benefits: [...new Set(benefits)], proof: [...new Set(proof)] };
};

/** Short category-like label from the product name ("Serum Vitamin C 30ml" -> "serum"). */
const shortName = (name: string) => {
  const first = name.replace(/[\[\]()|/,-].*$/, '').trim().split(/\s+/).slice(0, 3).join(' ');
  return clip(first || name, 30);
};

type Theme = (typeof STORYBOARD_THEMES)[number];

/** Natural creator-style templates. Nothing claims personal use or results. */
const naturalTemplate = (
  p: StoryboardProduct,
  theme: Theme,
  style: Exclude<StoryboardStyle, 'promo'>
): Storyboard => {
  const images = productImageIndexes(p.gallery);
  const img = (n: number) => (images.length ? images[n % images.length] : -1);
  const { benefits, proof } = sellingPoints(p);
  const short = shortName(p.name);
  const b = (i: number, fallback: string) => clip(benefits[i] || fallback, 70);
  const proofLine = proof.length ? clip(proof.join(' · '), 70) : '';
  const priceLine = p.price ? `Harganya ${clip(p.price, 30)}` : '';
  const end: StoryboardScene = {
    kind: 'cta',
    duration: 2.5,
    headline: 'Link-nya di bio ya 🛒',
    subtext: 'Simpan dulu biar nggak lupa',
    imageIndex: img(0),
    voiceover: 'Link-nya aku taruh di bio, simpan dulu biar nggak lupa.',
  };
  const scenesByStyle: Record<typeof style, StoryboardScene[]> = {
    pov: [
      { kind: 'hook', duration: 3, headline: `POV: akhirnya nemu ${short} yang cocok`, imageIndex: img(0), voiceover: `POV: akhirnya nemu ${short} yang cocok.` },
      { kind: 'problem', duration: 2.5, headline: 'Udah coba macem-macem, hasilnya gitu-gitu aja', imageIndex: img(1) },
      { kind: 'reveal', duration: 2.5, headline: `Terus ketemu ini 👀`, subtext: clip(p.name, 70), imageIndex: img(2), voiceover: `Terus ketemu ${short} ini.` },
      { kind: 'benefit', duration: 2.5, headline: b(0, 'Yang dicari selama ini'), imageIndex: img(3) },
      ...(proofLine ? [{ kind: 'proof' as const, duration: 2.5, headline: proofLine, imageIndex: img(4) }] : []),
      ...(priceLine ? [{ kind: 'price' as const, duration: 2.5, headline: priceLine, imageIndex: img(5) }] : []),
      end,
    ],
    story: [
      { kind: 'hook', duration: 3, headline: `Cerita kenapa ${short} ini lagi rame`, imageIndex: img(0), voiceover: `Aku mau cerita kenapa ${short} ini lagi rame.` },
      { kind: 'problem', duration: 3, headline: 'Banyak yang punya masalah yang sama', subtext: b(0, 'dan bingung harus pilih yang mana'), imageIndex: img(1) },
      { kind: 'reveal', duration: 3, headline: 'Sampai mereka nemu ini', subtext: clip(p.name, 70), imageIndex: img(2) },
      { kind: 'benefit', duration: 3, headline: b(1, b(0, 'Dan ternyata cocok')), imageIndex: img(3) },
      ...(proofLine ? [{ kind: 'proof' as const, duration: 2.5, headline: proofLine, subtext: 'Pantes rame', imageIndex: img(4) }] : []),
      ...(priceLine ? [{ kind: 'price' as const, duration: 2.5, headline: priceLine, imageIndex: img(5) }] : []),
      end,
    ],
    review: [
      { kind: 'hook', duration: 3, headline: `Jujur, ${short} ini worth it nggak?`, imageIndex: img(0), voiceover: `Jujur, ${short} ini worth it nggak?` },
      { kind: 'reveal', duration: 2.5, headline: clip(p.name, 60), imageIndex: img(1) },
      { kind: 'benefit', duration: 2.5, headline: `👍 ${b(0, 'Kelebihan utamanya')}`, imageIndex: img(2) },
      ...(benefits[1] ? [{ kind: 'benefit' as const, duration: 2.5, headline: `👍 ${b(1, '')}`, imageIndex: img(3) }] : []),
      ...(proofLine ? [{ kind: 'proof' as const, duration: 2.5, headline: proofLine, subtext: 'Kata pembeli lain', imageIndex: img(4) }] : []),
      ...(priceLine ? [{ kind: 'price' as const, duration: 2.5, headline: priceLine, subtext: 'Menurut kamu worth it?', imageIndex: img(5) }] : []),
      { ...end, headline: 'Detailnya cek di bio 🛒' },
    ],
    tips: [
      { kind: 'hook', duration: 3, headline: `3 alasan ${short} ini laris`, imageIndex: img(0), voiceover: `Tiga alasan ${short} ini laris.` },
      { kind: 'benefit', duration: 2.5, headline: `1. ${b(0, 'Fungsinya jelas')}`, imageIndex: img(1) },
      { kind: 'benefit', duration: 2.5, headline: `2. ${b(1, 'Praktis dipakai')}`, imageIndex: img(2) },
      { kind: 'benefit', duration: 2.5, headline: `3. ${proofLine || (p.price ? `Harga ${clip(p.price, 30)}` : b(2, 'Banyak yang suka'))}`, imageIndex: img(3) },
      end,
    ],
    problem: [
      { kind: 'hook', duration: 3, headline: `Masih ribet soal ${short}?`, imageIndex: img(0), voiceover: `Masih ribet soal ${short}?` },
      { kind: 'problem', duration: 2.5, headline: b(0, 'Masalah yang sering kejadian'), subtext: 'Relate nggak?', imageIndex: img(1) },
      { kind: 'reveal', duration: 2.5, headline: 'Coba yang ini', subtext: clip(p.name, 70), imageIndex: img(2) },
      { kind: 'benefit', duration: 2.5, headline: b(1, b(0, 'Lebih praktis')), imageIndex: img(3) },
      ...(priceLine ? [{ kind: 'price' as const, duration: 2.5, headline: priceLine, imageIndex: img(4) }] : []),
      end,
    ],
  };
  return { title: clip(p.name, 120), theme, style, scenes: scenesByStyle[style] };
};

/**
 * Deterministic storyboard used when no AI key is configured (and as a
 * fallback when the AI call fails).
 */
export const templateStoryboard = (
  p: StoryboardProduct,
  theme: Theme = 'dark',
  style: StoryboardStyle = 'promo'
): Storyboard => {
  if (style !== 'promo') {
    return naturalTemplate(p, theme, style);
  }
  const images = productImageIndexes(p.gallery);
  const img = (n: number) => (images.length ? images[n % images.length] : -1);
  const { benefits, proof } = sellingPoints(p);
  const name = clip(p.name, 60);
  const scenes: StoryboardScene[] = [
    {
      kind: 'hook',
      duration: 3,
      headline: 'Jangan scroll dulu! 👀',
      subtext: clip(`Ini yang lagi dicari banyak orang`, 80),
      imageIndex: img(0),
      voiceover: `Jangan scroll dulu, ini yang lagi dicari banyak orang!`,
    },
    {
      kind: 'reveal',
      duration: 3,
      headline: name,
      subtext: benefits[0] ? clip(benefits[0], 90) : undefined,
      imageIndex: img(1),
      voiceover: `Kenalin, ${name}.`,
    },
    ...benefits.slice(1, 3).map(
      (b, i): StoryboardScene => ({
        kind: 'benefit',
        duration: 2.5,
        headline: `✓ ${clip(b, 70)}`,
        imageIndex: img(2 + i),
      })
    ),
    ...(proof.length
      ? [
          {
            kind: 'proof' as const,
            duration: 2.5,
            headline: clip(proof.join(' · '), 70),
            subtext: 'Banyak yang sudah buktiin',
            imageIndex: img(4),
          },
        ]
      : []),
    ...(p.price
      ? [
          {
            kind: 'price' as const,
            duration: 3,
            headline: clip(p.price, 40),
            subtext: 'Harga bisa berubah, cek sekarang',
            imageIndex: img(5),
            voiceover: `Harganya cuma ${p.price}!`,
          },
        ]
      : []),
    {
      kind: 'cta',
      duration: 3,
      headline: '👉 Cek link di bio',
      subtext: 'Komen "MAU" & simpan video ini!',
      imageIndex: img(0),
      voiceover: 'Cek link di bio, dan komen mau ya!',
    },
  ];
  return { title: clip(p.name, 120), theme, style: 'promo', scenes };
};

/**
 * Makes an untrusted storyboard (from the UI, an AI model or MCP) safe to
 * render: valid schema, hook first and at most 3s, image indexes in range,
 * total length capped.
 */
export const normalizeStoryboard = (
  input: unknown,
  galleryLength: number
): Storyboard => {
  const parsed = storyboardSchema.parse(input);
  const scenes = parsed.scenes.map((s) => ({
    ...s,
    imageIndex:
      s.imageIndex !== undefined && s.imageIndex >= 0 && s.imageIndex < galleryLength
        ? s.imageIndex
        : -1,
  }));
  if (scenes[0].kind !== 'hook') {
    throw new Error('The first scene must be the hook');
  }
  scenes[0] = { ...scenes[0], duration: Math.min(scenes[0].duration, 3) };
  let total = 0;
  const capped: StoryboardScene[] = [];
  for (const s of scenes) {
    if (total + s.duration > MAX_TOTAL_SECONDS) break;
    total += s.duration;
    capped.push(s);
  }
  return { ...parsed, scenes: capped };
};

export const storyboardDuration = (s: Storyboard) =>
  Math.round(s.scenes.reduce((sum, sc) => sum + sc.duration, 0) * 100) / 100;

/** Prompt for an AI model that writes the storyboard (Indonesian). */
const STYLE_GUIDE: Record<StoryboardStyle, string> = {
  promo:
    'Gaya PROMO: iklan singkat yang jelas, energik, fokus manfaat dan harga.',
  pov:
    'Gaya POV: hook diawali "POV:" dan menggambarkan situasi relatable dari sudut pandang penonton (misal "POV: kamu akhirnya nemu ..."). Bahasa santai seperti ngobrol, bukan iklan. Produk muncul sebagai jawaban alami dari situasi itu.',
  story:
    'Gaya STORYTELLING: alur cerita singkat awal (situasi/masalah) -> titik balik (menemukan produk) -> hasil/manfaat yang realistis -> ajakan. Kalimat mengalir seperti bercerita ke teman. Tokohnya boleh "banyak orang"/"temanku"/penonton, jangan mengarang testimoni pribadi.',
  review:
    'Gaya REVIEW JUJUR: hook berupa pertanyaan "worth it nggak?", lalu kelebihan yang ada di data produk, bukti sosial (rating/terjual) sebagai "kata pembeli lain", harga, dan ajakan menilai sendiri. Jangan menulis seolah kreator sudah memakai produk dan jangan mengarang hasil pemakaian.',
  tips:
    'Gaya TIPS/LIST: hook "3 alasan ..."/"3 hal ..." lalu tiap adegan satu poin bernomor (1., 2., 3.) yang diambil dari data produk, ditutup ajakan.',
  problem:
    'Gaya MASALAH -> SOLUSI: hook menyebut masalah yang dirasakan penonton, adegan berikut memperjelas masalah ("relate nggak?"), lalu produk sebagai solusi, manfaat, harga, ajakan.',
};

export const storyboardPrompt = (
  p: StoryboardProduct,
  style: StoryboardStyle = 'promo'
) => {
  const images = p.gallery
    .map((g, i) => (g.type === 'image' && g.source === 'product' ? i : null))
    .filter((i) => i !== null);
  return [
    'Kamu adalah kreator konten affiliate TikTok/Reels Indonesia yang ahli membuat video pendek yang viral dan menjual.',
    'Buat storyboard video vertikal 15-30 detik untuk produk berikut.',
    STYLE_GUIDE[style],
    `Isi field style dengan "${style}".`,
    'Aturan:',
    '- Adegan pertama WAJIB kind "hook", durasi maksimal 3 detik, kalimat yang bikin orang berhenti scroll (pertanyaan/masalah/fakta mengejutkan), maksimal 8 kata.',
    '- Pakai jenis adegan (kind): problem, reveal (produk muncul), benefit, proof (rating/terjual), price, cta. Susun sesuai gaya di atas; adegan terakhir cta.',
    '- headline singkat (maks 8 kata) karena tampil besar di layar; subtext opsional maks 12 kata.',
    '- voiceover: kalimat santai bahasa Indonesia sehari-hari untuk diucapkan di adegan itu.',
    '- Jangan mengarang klaim yang tidak ada di data produk (manfaat, harga, rating). Jangan klaim medis. Jangan membuat testimoni palsu atau mengaku sudah memakai produk.',
    '- Bahasa natural seperti kreator TikTok Indonesia (boleh "aku", "kamu", "jujur", "relate"), hindari bahasa iklan kaku.',
    `- imageIndex: pilih dari indeks foto produk yang tersedia: [${images.join(', ')}] (pakai -1 jika tidak ada). Variasikan fotonya.`,
    '- cta mengajak cek link di bio, komen, dan simpan video.',
    '',
    `Nama produk: ${p.name}`,
    p.price ? `Harga: ${p.price}` : '',
    p.marketplace ? `Marketplace: ${p.marketplace}` : '',
    p.notes ? `Info: ${p.notes}` : '',
    p.description ? `Deskripsi: ${clip(p.description, 2500)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
};
