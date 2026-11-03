import {
  cleanProductUrl,
  fullSizeImage,
  marketplaceFromUrl,
  parsePageText,
  uniqueUrls,
} from '../page.import';

describe('marketplaceFromUrl', () => {
  it('detects marketplaces by host, not by substring', () => {
    expect(marketplaceFromUrl('https://shopee.co.id/Serum-i.1.2')).toBe('shopee');
    expect(marketplaceFromUrl('https://s.shopee.co.id/abc')).toBe('shopee');
    expect(marketplaceFromUrl('https://www.tokopedia.com/toko/produk')).toBe('tokopedia');
    expect(marketplaceFromUrl('https://evil.com/shopee.co.id')).toBe('other');
    expect(marketplaceFromUrl('https://shopee.co.id.evil.com/x')).toBe('other');
    expect(marketplaceFromUrl('not a url')).toBe('other');
  });
});

describe('cleanProductUrl', () => {
  it('drops tracking params and fragments, keeps the rest', () => {
    expect(
      cleanProductUrl('https://shopee.co.id/p-i.1.2?sp_atk=x&xptdk=y&utm_source=z&foo=1#d=abc')
    ).toBe('https://shopee.co.id/p-i.1.2?foo=1');
  });
});

describe('images', () => {
  it('turns Shopee thumbnails into full-size files', () => {
    expect(fullSizeImage('https://down-id.img.susercontent.com/file/abc_tn')).toBe(
      'https://down-id.img.susercontent.com/file/abc'
    );
    expect(fullSizeImage('https://down-id.img.susercontent.com/file/abc@resize_w450_nl.webp')).toBe(
      'https://down-id.img.susercontent.com/file/abc'
    );
  });

  it('dedupes, keeps https only and caps the count', () => {
    const out = uniqueUrls(
      [
        'https://x/file/a_tn',
        'https://x/file/a',
        'http://x/file/b',
        'javascript:alert(1)',
        ...Array.from({ length: 20 }, (_, i) => `https://x/file/c${i}`),
      ],
      5
    );
    expect(out[0]).toBe('https://x/file/a');
    expect(out).toHaveLength(5);
    expect(out.every((u) => u.startsWith('https://'))).toBe(true);
  });
});

describe('parsePageText', () => {
  const page = `Beranda
Shopee Mall
Serum Vitamin C 30ml Brightening Original
4.9
2,1RB Penilaian
10RB+ Terjual
Rp89.000 - Rp129.000
Deskripsi Produk
Serum vitamin C untuk mencerahkan kulit kusam.
Tekstur ringan cepat meresap.
Penilaian Produk
bagus`;

  it('reads name, price, sold, rating and description', () => {
    const p = parsePageText(page);
    expect(p.name).toBe('Serum Vitamin C 30ml Brightening Original');
    expect(p.price).toBe('Rp89.000 - Rp129.000');
    expect(p.sold).toBe('10RB+ terjual');
    expect(p.rating).toBe('4.9');
    expect(p.description).toBe(
      'Serum vitamin C untuk mencerahkan kulit kusam.\nTekstur ringan cepat meresap.'
    );
  });

  it('returns empty fields for unrelated text', () => {
    const p = parsePageText('hello');
    expect(p.price).toBeUndefined();
    expect(p.description).toBeUndefined();
  });
});
