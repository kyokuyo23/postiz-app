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

/**
 * Deterministic storyboard used when no AI key is configured (and as a
 * fallback when the AI call fails).
 */
export const templateStoryboard = (
  p: StoryboardProduct,
  theme: (typeof STORYBOARD_THEMES)[number] = 'dark'
): Storyboard => {
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
  return { title: clip(p.name, 120), theme, scenes };
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
export const storyboardPrompt = (p: StoryboardProduct) => {
  const images = p.gallery
    .map((g, i) => (g.type === 'image' && g.source === 'product' ? i : null))
    .filter((i) => i !== null);
  return [
    'Kamu adalah kreator konten affiliate TikTok/Reels Indonesia yang ahli membuat video pendek yang viral dan menjual.',
    'Buat storyboard video vertikal 15-30 detik untuk produk berikut.',
    'Aturan:',
    '- Adegan pertama WAJIB kind "hook", durasi maksimal 3 detik, kalimat yang bikin orang berhenti scroll (pertanyaan/masalah/fakta mengejutkan), maksimal 8 kata.',
    '- Urutan setelahnya: problem (opsional) -> reveal (nama produk) -> 1-3 benefit -> proof (jika ada data rating/terjual) -> price (jika ada harga) -> cta.',
    '- headline singkat (maks 8 kata) karena tampil besar di layar; subtext opsional maks 12 kata.',
    '- voiceover: kalimat santai bahasa Indonesia sehari-hari untuk diucapkan di adegan itu.',
    '- Jangan mengarang klaim yang tidak ada di data produk (manfaat, harga, rating). Jangan klaim medis.',
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
