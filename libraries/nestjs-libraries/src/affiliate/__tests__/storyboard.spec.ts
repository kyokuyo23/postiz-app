import {
  STORYBOARD_STYLES,
  normalizeStoryboard,
  storyboardDuration,
  templateStoryboard,
  StoryboardProduct,
} from '../storyboard';
import { buildComposition } from '../storyboard.html';
import { localUploadPath } from '../hyperframes.renderer';

const product: StoryboardProduct = {
  name: 'Serum Vitamin C 30ml',
  price: 'Rp 89.000',
  marketplace: 'Shopee',
  notes: 'Sudah terjual 10.000+\nRating 4.9/5',
  description:
    'Mencerahkan kulit kusam dalam 7 hari. Tekstur ringan cepat meresap. Aman untuk kulit sensitif.',
  gallery: [
    { path: 'https://x/uploads/a.jpg', type: 'image', source: 'product' },
    { path: 'https://x/uploads/review.jpg', type: 'image', source: 'review' },
    { path: 'https://x/uploads/b.jpg', type: 'image', source: 'product' },
  ],
};

describe('templateStoryboard', () => {
  it('starts with a hook of at most 3 seconds and ends with a CTA', () => {
    const sb = templateStoryboard(product);
    expect(sb.scenes[0].kind).toBe('hook');
    expect(sb.scenes[0].duration).toBeLessThanOrEqual(3);
    expect(sb.scenes[sb.scenes.length - 1].kind).toBe('cta');
  });

  it('includes price and social proof from the product data', () => {
    const sb = templateStoryboard(product);
    expect(sb.scenes.find((s) => s.kind === 'price')?.headline).toBe('Rp 89.000');
    expect(sb.scenes.find((s) => s.kind === 'proof')?.headline).toMatch(/terjual/i);
  });

  it('never uses buyer review photos by default', () => {
    const sb = templateStoryboard(product);
    expect(sb.scenes.every((s) => s.imageIndex !== 1)).toBe(true);
  });

  it('works without photos, price or description', () => {
    const sb = normalizeStoryboard(
      templateStoryboard({ name: 'Produk', gallery: [] }),
      0
    );
    expect(sb.scenes.length).toBeGreaterThanOrEqual(3);
    expect(sb.scenes.every((s) => s.imageIndex === -1)).toBe(true);
  });
});

describe('normalizeStoryboard', () => {
  const base = templateStoryboard(product);

  it('rejects a storyboard that does not start with the hook', () => {
    expect(() =>
      normalizeStoryboard({ ...base, scenes: base.scenes.slice(1) }, 3)
    ).toThrow();
  });

  it('clamps the hook to 3s, drops out-of-range images and caps length', () => {
    const scenes = [
      { ...base.scenes[0], duration: 5, imageIndex: 9 },
      ...Array.from({ length: 9 }, () => ({
        kind: 'benefit' as const,
        duration: 6,
        headline: 'x',
      })),
    ];
    const sb = normalizeStoryboard({ ...base, scenes }, 3);
    expect(sb.scenes[0].duration).toBe(3);
    expect(sb.scenes[0].imageIndex).toBe(-1);
    expect(storyboardDuration(sb)).toBeLessThanOrEqual(40);
  });
});

describe('buildComposition', () => {
  it('escapes text so storyboard content cannot inject markup or script', () => {
    const sb = normalizeStoryboard(
      {
        title: 't',
        theme: 'light',
        scenes: [
          { kind: 'hook', duration: 3, headline: '<script>alert(1)</script>' },
          { kind: 'reveal', duration: 3, headline: "a'b\"c" },
          { kind: 'cta', duration: 3, headline: 'Cek link' },
        ],
      },
      0
    );
    const html = buildComposition(sb, {});
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('data-duration="9"');
    expect(html.match(/class="clip scene/g)?.length).toBe(3);
  });

  it('references images by local file name only', () => {
    const sb = templateStoryboard(product);
    const html = buildComposition(sb, { 0: 'img0.jpg' });
    expect(html).toContain('src="img0.jpg"');
    expect(html).not.toContain('https://x/uploads');
  });
});

describe('localUploadPath', () => {
  it('maps upload URLs into the upload directory', () => {
    expect(
      localUploadPath('https://app.example.com/uploads/2026/10/30/a.jpg', '/uploads')
    ).toBe('/uploads/2026/10/30/a.jpg');
  });

  it('refuses paths that escape the upload directory', () => {
    expect(
      localUploadPath('https://app.example.com/uploads/../../etc/passwd', '/uploads')
    ).toBeNull();
    expect(
      localUploadPath('https://app.example.com/uploads/%2e%2e/%2e%2e/etc/passwd', '/uploads')
    ).toBeNull();
    expect(localUploadPath('https://evil.example.com/a.jpg', '/uploads')).toBeNull();
  });
});

describe('content styles', () => {
  it.each(STORYBOARD_STYLES)('%s: valid, hook first (<=3s), ends with CTA', (style) => {
    const sb = normalizeStoryboard(templateStoryboard(product, 'dark', style), 3);
    expect(sb.style).toBe(style);
    expect(sb.scenes[0].kind).toBe('hook');
    expect(sb.scenes[0].duration).toBeLessThanOrEqual(3);
    expect(sb.scenes[sb.scenes.length - 1].kind).toBe('cta');
    expect(sb.scenes.every((s) => s.imageIndex !== 1)).toBe(true);
  });

  it('POV hook starts with "POV:"', () => {
    expect(templateStoryboard(product, 'dark', 'pov').scenes[0].headline).toMatch(/^POV:/);
  });

  it('review style never claims personal use', () => {
    const text = JSON.stringify(templateStoryboard(product, 'dark', 'review'));
    expect(text).not.toMatch(/aku (udah|sudah) (pakai|pake|coba)/i);
  });

  it('natural styles render full-screen captions without the ad card', () => {
    const html = buildComposition(templateStoryboard(product, 'dark', 'pov'), { 0: 'img0.jpg' }, { brand: 'X' });
    expect(html).toContain('class="clip nscene');
    expect(html).not.toContain('class="photo');
    expect(html).not.toContain('id="brand"');
    expect(html).not.toContain("'#bar'");
  });

  it('defaults old storyboards without style to promo', () => {
    const { style, ...rest } = templateStoryboard(product);
    expect(normalizeStoryboard(rest, 3).style).toBe('promo');
  });
});
