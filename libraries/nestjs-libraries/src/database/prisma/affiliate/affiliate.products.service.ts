import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AffiliateProductsRepository } from '@gitroom/nestjs-libraries/database/prisma/affiliate/affiliate.products.repository';
import {
  AffiliateProductDto,
  PageImportDto,
} from '@gitroom/nestjs-libraries/dtos/affiliate/affiliate.product.dto';
import {
  cleanProductUrl,
  marketplaceFromUrl,
  uniqueUrls,
} from '@gitroom/nestjs-libraries/affiliate/page.import';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import {
  ShopeeAffiliateError,
  ShopeeOfferQuery,
  formatRupiah,
  searchShopeeOffers,
  shopeeConfigured,
  shopeeShortLink,
} from '@gitroom/nestjs-libraries/affiliate/shopee.affiliate.client';

const percent = (rate: number) =>
  `${(rate * 100).toFixed(rate * 100 < 10 ? 1 : 0).replace(/\.0$/, '')}%`;

@Injectable()
export class AffiliateProductsService {
  constructor(
    private _repository: AffiliateProductsRepository,
    private _mediaService: MediaService
  ) {}

  list(orgId: string, search?: string) {
    return this._repository.list(orgId, search?.trim() || undefined);
  }

  async get(orgId: string, id: string) {
    const product = await this._repository.get(orgId, id);
    if (!product) {
      throw new BadRequestException('Product not found');
    }
    return product;
  }

  create(orgId: string, body: AffiliateProductDto) {
    return this._repository.create(orgId, body);
  }

  async update(orgId: string, id: string, body: AffiliateProductDto) {
    await this.get(orgId, id);
    return this._repository.update(orgId, id, body);
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    return this._repository.remove(orgId, id);
  }

  // ------------------------------------------------- page import (bookmarklet)

  /**
   * Creates a catalog product from data captured on a marketplace page. Photos
   * and videos are copied into the media library (SSRF-safe downloader) so
   * they can be used in posts and storyboard videos.
   */
  async importPage(orgId: string, body: PageImportDto) {
    const images = uniqueUrls(body.images, 12);
    const videos = uniqueUrls(body.videos, 1);
    const gallery: { id: string; path: string; type: 'image' | 'video'; source: 'product' }[] = [];

    const copy = async (url: string, type: 'image' | 'video', i: number) => {
      try {
        const media = await this._mediaService.importFromUrl(
          orgId,
          url,
          `${body.name.slice(0, 60)} ${type === 'video' ? 'video' : i + 1}${type === 'video' ? '.mp4' : '.jpg'}`
        );
        return { id: media.id, path: media.path, type, source: 'product' as const };
      } catch (e) {
        Logger.warn(`Page import: could not copy ${type}: ${(e as Error).message}`);
        return null;
      }
    };

    // a few at a time: small VPS, and marketplace CDNs dislike bursts
    for (let i = 0; i < images.length; i += 3) {
      const batch = await Promise.all(
        images.slice(i, i + 3).map((url, j) => copy(url, 'image', i + j))
      );
      batch.forEach((g) => g && gallery.push(g));
    }
    for (const url of videos) {
      const g = await copy(url, 'video', 0);
      if (g) gallery.push(g);
    }

    const main = gallery.find((g) => g.type === 'image');
    const notes = [
      body.sold ? `Sudah ${body.sold.replace(/terjual/i, '').trim()} terjual` : '',
      body.rating ? `Rating ${body.rating}/5` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const pageUrl = cleanProductUrl(body.url);

    return this._repository.create(orgId, {
      name: body.name.trim().slice(0, 200),
      price: body.price?.trim() || undefined,
      marketplace: marketplaceFromUrl(pageUrl) as AffiliateProductDto['marketplace'],
      link: body.link?.trim() || pageUrl,
      imageId: main?.id,
      imagePath: main?.path,
      notes: notes || undefined,
      description: body.description?.trim() || undefined,
      gallery,
    });
  }

  // ------------------------------------------------------------ Shopee

  shopeeStatus() {
    return { configured: shopeeConfigured() };
  }

  async shopeeOffers(query: ShopeeOfferQuery) {
    try {
      return await searchShopeeOffers(query);
    } catch (e) {
      throw new BadRequestException(
        e instanceof ShopeeAffiliateError ? e.message : 'Shopee API tidak bisa dihubungi'
      );
    }
  }

  /**
   * Adds a Shopee offer to the catalog: affiliate link (short link when the
   * API allows it), price, commission info and the photo copied into the
   * media library so it can be attached to posts.
   */
  async importShopee(orgId: string, itemId: string) {
    const id = Number(itemId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException('Invalid Shopee item id');
    }
    const existing = await this._repository.findByExternal(
      orgId,
      'shopee',
      String(id)
    );
    if (existing) {
      return existing;
    }
    const { offers } = await this.shopeeOffers({ itemId: id, limit: 1 });
    const offer = offers.find((o) => o.itemId === String(id)) || offers[0];
    if (!offer || !offer.offerLink) {
      throw new BadRequestException('Produk tidak ditemukan di Shopee Affiliate');
    }

    let link = offer.offerLink;
    try {
      link = await shopeeShortLink(offer.offerLink, ['postiz']);
    } catch (e) {
      Logger.warn(`Shopee short link failed, using offer link: ${(e as Error).message}`);
    }

    let image: { id: string; path: string } | null = null;
    if (offer.imageUrl) {
      try {
        const media = await this._mediaService.importFromUrl(
          orgId,
          offer.imageUrl,
          `${offer.name.slice(0, 80)}.jpg`
        );
        image = { id: media.id, path: media.path };
      } catch (e) {
        Logger.warn(`Shopee image import failed: ${(e as Error).message}`);
      }
    }

    const price =
      offer.priceMin !== null &&
      offer.priceMax !== null &&
      offer.priceMax > offer.priceMin
        ? `${formatRupiah(offer.priceMin)} - ${formatRupiah(offer.priceMax)}`
        : formatRupiah(offer.priceMin);

    // Social proof only: this text can end up in public captions.
    const notes = [
      offer.sales ? `Sudah terjual ${offer.sales.toLocaleString('id-ID')}+` : '',
      offer.rating ? `Rating ${offer.rating.toFixed(1)}/5` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // Private: shown on the product card, never in captions.
    const commission = [
      percent(offer.commissionRate),
      offer.sellerCommissionRate > 0
        ? `XTRA ${percent(offer.sellerCommissionRate)}`
        : '',
      offer.commission ? `±${formatRupiah(offer.commission)}/penjualan` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    return this._repository.create(
      orgId,
      {
        name: offer.name.slice(0, 200),
      price: price || undefined,
      marketplace: 'shopee',
      link,
      imageId: image?.id,
      imagePath: image?.path,
        notes: notes || undefined,
      },
      { commission, source: 'shopee', externalId: String(id) }
    );
  }
}
