import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AffiliateProduct } from '@prisma/client';
import { AffiliateProductsRepository } from '@gitroom/nestjs-libraries/database/prisma/affiliate/affiliate.products.repository';
import { AffiliateVideosRepository } from '@gitroom/nestjs-libraries/database/prisma/affiliate/affiliate.videos.repository';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import {
  GalleryItem,
  Storyboard,
  StoryboardProduct,
  normalizeStoryboard,
  storyboardPrompt,
  storyboardSchema,
  templateStoryboard,
} from '@gitroom/nestjs-libraries/affiliate/storyboard';
import { buildComposition } from '@gitroom/nestjs-libraries/affiliate/storyboard.html';
import {
  renderComposition,
  rendererAvailable,
} from '@gitroom/nestjs-libraries/affiliate/hyperframes.renderer';
import {
  aiProvider,
  langchainChatModel,
} from '@gitroom/nestjs-libraries/ai/ai.provider';

const MAX_PENDING_PER_ORG = 3;

const MARKETPLACE_LABEL: Record<string, string> = {
  shopee: 'Shopee',
  tokopedia: 'Tokopedia',
  tiktok_shop: 'TikTok Shop',
  lazada: 'Lazada',
  blibli: 'Blibli',
  amazon: 'Amazon',
};

/** Main photo first, then the saved gallery (same order everywhere). */
export const productGallery = (
  p: Pick<AffiliateProduct, 'imageId' | 'imagePath' | 'gallery'>
): GalleryItem[] => {
  let saved: GalleryItem[] = [];
  try {
    const parsed = JSON.parse(p.gallery || '[]');
    saved = Array.isArray(parsed) ? parsed : [];
  } catch {
    saved = [];
  }
  saved = saved.filter(
    (g) =>
      g &&
      typeof g.path === 'string' &&
      (g.type === 'image' || g.type === 'video') &&
      (g.source === 'product' || g.source === 'review')
  );
  if (p.imagePath && !saved.some((g) => g.path === p.imagePath)) {
    saved.unshift({ id: p.imageId, path: p.imagePath, type: 'image', source: 'product' });
  }
  return saved;
};

const toStoryboardProduct = (p: AffiliateProduct): StoryboardProduct => ({
  name: p.name,
  price: p.price,
  marketplace: MARKETPLACE_LABEL[p.marketplace] || null,
  notes: p.notes,
  description: p.description,
  gallery: productGallery(p),
});

@Injectable()
export class AffiliateVideosService {
  private running = false;
  private booted = false;

  constructor(
    private _products: AffiliateProductsRepository,
    private _videos: AffiliateVideosRepository,
    private _media: MediaService
  ) {}

  status() {
    return { available: rendererAvailable(), ai: aiProvider() };
  }

  private async product(orgId: string, productId: string) {
    const product = await this._products.get(orgId, productId);
    if (!product) {
      throw new BadRequestException('Product not found');
    }
    return product;
  }

  /** Storyboard draft: AI when a key is configured, otherwise the template. */
  async storyboard(orgId: string, productId: string, theme: 'dark' | 'light' = 'dark') {
    const product = await this.product(orgId, productId);
    const input = toStoryboardProduct(product);
    let storyboard: Storyboard | null = null;
    let source: 'ai' | 'template' = 'template';
    if (aiProvider()) {
      try {
        const model = langchainChatModel('gpt-4.1', { temperature: 0.8 });
        const draft = await model
          .withStructuredOutput(storyboardSchema, { name: 'storyboard' })
          .invoke(storyboardPrompt(input));
        storyboard = normalizeStoryboard({ ...draft, theme }, input.gallery.length);
        source = 'ai';
      } catch (e) {
        Logger.warn(`AI storyboard failed, using template: ${(e as Error).message}`);
      }
    }
    if (!storyboard) {
      storyboard = normalizeStoryboard(templateStoryboard(input, theme), input.gallery.length);
    }
    return { storyboard, gallery: input.gallery, source };
  }

  async render(orgId: string, productId: string, storyboardInput: unknown) {
    if (!rendererAvailable()) {
      throw new BadRequestException(
        'Video renderer is not installed on this server. Rebuild the backend image.'
      );
    }
    const product = await this.product(orgId, productId);
    let storyboard: Storyboard;
    try {
      storyboard = normalizeStoryboard(storyboardInput, productGallery(product).length);
    } catch (e) {
      throw new BadRequestException(`Invalid storyboard: ${(e as Error).message}`);
    }
    if ((await this._videos.countPending(orgId)) >= MAX_PENDING_PER_ORG) {
      throw new BadRequestException(
        'Too many videos in progress. Wait for the current ones to finish.'
      );
    }
    const job = await this._videos.create(orgId, productId, JSON.stringify(storyboard));
    this.kick();
    return job;
  }

  async list(orgId: string, productId: string) {
    this.boot();
    return this._videos.listByProduct(orgId, productId);
  }

  async get(orgId: string, id: string) {
    this.boot();
    const video = await this._videos.get(orgId, id);
    if (!video) {
      throw new BadRequestException('Video not found');
    }
    return video;
  }

  /** First use in this process: fail renders cut off by a restart, resume the queue. */
  private boot() {
    if (this.booted) return;
    this.booted = true;
    this._videos
      .failInterrupted()
      .then(() => this.kick())
      .catch((e) => Logger.warn(`Affiliate video boot failed: ${(e as Error).message}`));
  }

  /** Single in-process worker: one render at a time keeps a small VPS alive. */
  private kick() {
    if (!this.booted) {
      this.boot();
      return;
    }
    if (this.running) return;
    this.running = true;
    this.drain()
      .catch((e) => Logger.error(`Affiliate video worker: ${(e as Error).message}`))
      .finally(() => {
        this.running = false;
      });
  }

  private async drain() {
    for (;;) {
      const job = await this._videos.nextQueued();
      if (!job) return;
      if (!(await this._videos.claim(job.id))) continue;
      try {
        const storyboard = storyboardSchema.parse(JSON.parse(job.storyboard));
        const gallery = productGallery(job.product);
        const urls: Record<number, string> = {};
        storyboard.scenes.forEach((s) => {
          const g = s.imageIndex !== undefined && s.imageIndex >= 0 ? gallery[s.imageIndex] : undefined;
          if (g && g.type === 'image') urls[s.imageIndex!] = g.path;
        });
        const brand = MARKETPLACE_LABEL[job.product.marketplace]
          ? `🛍️ Rekomendasi ${MARKETPLACE_LABEL[job.product.marketplace]}`
          : '';
        const mp4 = await renderComposition('', urls, (files) =>
          buildComposition(storyboard, files, { brand })
        );
        const media = await this._media.saveBuffer(
          job.organizationId,
          mp4,
          `${job.product.name.slice(0, 60)} - video.mp4`
        );
        await this._videos.markDone(job.id, media.id, media.path);
      } catch (e) {
        Logger.warn(`Affiliate video ${job.id} failed: ${(e as Error).message}`);
        await this._videos.markError(job.id, (e as Error).message || 'Render failed');
      }
    }
  }
}
