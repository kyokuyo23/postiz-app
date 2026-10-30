import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { AffiliateProductsService } from '@gitroom/nestjs-libraries/database/prisma/affiliate/affiliate.products.service';
import { AffiliateVideosService } from '@gitroom/nestjs-libraries/database/prisma/affiliate/affiliate.videos.service';
import { storyboardSchema } from '@gitroom/nestjs-libraries/affiliate/storyboard';
import { productGallery } from '@gitroom/nestjs-libraries/database/prisma/affiliate/affiliate.videos.service';
import { AFFILIATE_MARKETPLACES } from '@gitroom/nestjs-libraries/dtos/affiliate/affiliate.product.dto';

/**
 * Affiliate product catalog as MCP tools, so an agent can write and
 * schedule promotion posts (with the product photo and affiliate link).
 */

const orgIdFrom = (inputData: unknown, context: any): string => {
  checkAuth(inputData, context);
  return JSON.parse(
    (context?.requestContext as any)?.get('organization') as string
  ).id;
};

const view = (p: {
  id: string;
  name: string;
  price: string | null;
  marketplace: string;
  link: string;
  imageId: string | null;
  imagePath: string | null;
  notes: string | null;
  commission?: string | null;
  description?: string | null;
  gallery?: string;
}) => ({
  id: p.id,
  name: p.name,
  price: p.price,
  marketplace: p.marketplace,
  link: p.link,
  image: p.imagePath ? { id: p.imageId, path: p.imagePath } : null,
  notes: p.notes,
  commission: p.commission || null,
  description: p.description || null,
  // index = imageIndex used by storyboards; source "review" = buyer photo
  gallery: productGallery(p as any),
});

@Injectable()
export class AffiliateProductsListTool implements AgentToolInterface {
  constructor(private _products: AffiliateProductsService) {}
  name = 'affiliateProductsList';

  run() {
    return createTool({
      id: 'affiliateProductsList',
      description: `Lists the user's affiliate products (name, price, marketplace, affiliate link, photo, notes). To promote a product, write a post that includes its affiliate link and attach its photo (image.id and image.path) when scheduling the post.
The goal is reach and engagement (followers, views, likes), so write promotion posts that: open with a scroll-stopping hook in the first line, give one concrete benefit, show the price, end with a call to action that invites comments, saves and shares, use 3-5 relevant hashtags, match each platform's style and length, and avoid repeating the exact same text across channels. Spread posts across the day at active hours instead of posting everything at once.`,
      inputSchema: z.object({
        search: z.string().max(100).optional().describe('Filter by product name'),
      }),
      mcp: {
        annotations: {
          title: 'List Affiliate Products',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({ output: z.any() }),
      execute: async (inputData, context) => {
        const orgId = orgIdFrom(inputData, context);
        const products = await this._products.list(orgId, inputData.search);
        return { output: products.map(view) };
      },
    });
  }
}

@Injectable()
export class AffiliateProductCreateTool implements AgentToolInterface {
  constructor(private _products: AffiliateProductsService) {}
  name = 'affiliateProductCreate';

  run() {
    return createTool({
      id: 'affiliateProductCreate',
      description: `Adds a product to the user's affiliate catalog. Use when the user gives a product name and affiliate link. A photo can be added later in Postiz.`,
      inputSchema: z.object({
        name: z.string().min(1).max(200),
        link: z.string().url().max(2000).describe('Affiliate link (https)'),
        marketplace: z.enum(AFFILIATE_MARKETPLACES).default('other'),
        price: z.string().max(50).optional().describe('Display price, e.g. Rp 89.000'),
        notes: z.string().max(2000).optional().describe('Selling points, promo info'),
      }),
      mcp: {
        annotations: {
          title: 'Add Affiliate Product',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({ output: z.any() }),
      execute: async (inputData, context) => {
        const orgId = orgIdFrom(inputData, context);
        const created = await this._products.create(orgId, {
          name: inputData.name,
          link: inputData.link,
          marketplace: inputData.marketplace,
          price: inputData.price,
          notes: inputData.notes,
        });
        return { output: view(created) };
      },
    });
  }
}

@Injectable()
export class ShopeeOffersSearchTool implements AgentToolInterface {
  constructor(private _products: AffiliateProductsService) {}
  name = 'shopeeOffersSearch';

  run() {
    return createTool({
      id: 'shopeeOffersSearch',
      description: `Researches Shopee Affiliate products (Indonesia) through the user's Shopee Affiliate Open API: search by keyword, list trending (top performing) products, sort by sales or commission, or keep only offers with extra seller commission (XTRA). Returns name, price, sales, rating, commission rates (fractions, 0.1 = 10%) and itemId. Use shopeeOfferImport to add a product to the catalog before posting it.`,
      inputSchema: z.object({
        keyword: z.string().max(100).optional(),
        trending: z.boolean().optional().describe('Only top performing products'),
        sort: z
          .enum(['relevance', 'sales', 'commission', 'price_asc', 'price_desc'])
          .optional(),
        extraOnly: z
          .boolean()
          .optional()
          .describe('Only offers with extra seller commission (XTRA)'),
        page: z.number().int().min(1).max(50).optional(),
      }),
      mcp: {
        annotations: {
          title: 'Search Shopee Affiliate Products',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      outputSchema: z.object({ output: z.any() }),
      execute: async (inputData, context) => {
        orgIdFrom(inputData, context);
        const result = await this._products.shopeeOffers({
          keyword: inputData.keyword,
          trending: inputData.trending,
          sort: inputData.sort,
          extraOnly: inputData.extraOnly,
          page: inputData.page,
          limit: 20,
        });
        return { output: result };
      },
    });
  }
}

@Injectable()
export class ShopeeOfferImportTool implements AgentToolInterface {
  constructor(private _products: AffiliateProductsService) {}
  name = 'shopeeOfferImport';

  run() {
    return createTool({
      id: 'shopeeOfferImport',
      description: `Adds a Shopee Affiliate product (by itemId from shopeeOffersSearch) to the user's affiliate catalog with its affiliate short link, price and photo copied into the media library. Returns the catalog product, including image { id, path } to attach to posts. Importing the same item twice returns the existing product.`,
      inputSchema: z.object({
        itemId: z.string().regex(/^\d{1,19}$/),
      }),
      mcp: {
        annotations: {
          title: 'Import Shopee Product',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      outputSchema: z.object({ output: z.any() }),
      execute: async (inputData, context) => {
        const orgId = orgIdFrom(inputData, context);
        const product = await this._products.importShopee(orgId, inputData.itemId);
        return { output: view(product) };
      },
    });
  }
}

@Injectable()
export class AffiliateStoryboardTool implements AgentToolInterface {
  constructor(private _videos: AffiliateVideosService) {}
  name = 'affiliateStoryboard';

  run() {
    return createTool({
      id: 'affiliateStoryboard',
      description: `Creates a storyboard draft for a short vertical promo video of an affiliate product: a 3-second hook first, then problem/product/benefits/proof/price/CTA scenes, each with on-screen headline, optional subtext, duration and a photo (imageIndex into the returned gallery). Review the draft, improve the hook and wording (Indonesian, short, no invented claims), then pass it to affiliateVideoRender. Gallery items with source "review" are buyer photos: only use them if the user explicitly asks.`,
      inputSchema: z.object({
        productId: z.string().describe('Product id from affiliateProductsList'),
        theme: z.enum(['dark', 'light']).optional(),
      }),
      mcp: {
        annotations: {
          title: 'Affiliate Video Storyboard',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({ output: z.any() }),
      execute: async (inputData, context) => {
        const orgId = orgIdFrom(inputData, context);
        return {
          output: await this._videos.storyboard(
            orgId,
            inputData.productId,
            inputData.theme || 'dark'
          ),
        };
      },
    });
  }
}

@Injectable()
export class AffiliateVideoRenderTool implements AgentToolInterface {
  constructor(private _videos: AffiliateVideosService) {}
  name = 'affiliateVideoRender';

  run() {
    return createTool({
      id: 'affiliateVideoRender',
      description: `Renders a storyboard into a 9:16 MP4 video (free, on the user's server) and saves it to the media library. Rendering takes about 1-3 minutes; check progress with affiliateVideoStatus. The first scene must be the hook (max 3 seconds); total max 40 seconds.`,
      inputSchema: z.object({
        productId: z.string(),
        storyboard: storyboardSchema,
      }),
      mcp: {
        annotations: {
          title: 'Render Affiliate Video',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({ output: z.any() }),
      execute: async (inputData, context) => {
        const orgId = orgIdFrom(inputData, context);
        const job = await this._videos.render(
          orgId,
          inputData.productId,
          inputData.storyboard
        );
        return { output: { videoId: job.id, status: job.status } };
      },
    });
  }
}

@Injectable()
export class AffiliateVideoStatusTool implements AgentToolInterface {
  constructor(private _videos: AffiliateVideosService) {}
  name = 'affiliateVideoStatus';

  run() {
    return createTool({
      id: 'affiliateVideoStatus',
      description: `Lists the rendered videos of an affiliate product with status QUEUED, RENDERING, DONE or ERROR. A DONE video has mediaId and mediaPath: attach it to a post as {id: mediaId, path: mediaPath} when scheduling.`,
      inputSchema: z.object({ productId: z.string() }),
      mcp: {
        annotations: {
          title: 'Affiliate Video Status',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({ output: z.any() }),
      execute: async (inputData, context) => {
        const orgId = orgIdFrom(inputData, context);
        const videos = await this._videos.list(orgId, inputData.productId);
        return {
          output: videos.map((v) => ({
            videoId: v.id,
            status: v.status,
            mediaId: v.mediaId,
            mediaPath: v.mediaPath,
            error: v.error,
            createdAt: v.createdAt,
          })),
        };
      },
    });
  }
}

export const affiliateTools = [
  AffiliateProductsListTool,
  AffiliateProductCreateTool,
  ShopeeOffersSearchTool,
  ShopeeOfferImportTool,
  AffiliateStoryboardTool,
  AffiliateVideoRenderTool,
  AffiliateVideoStatusTool,
];
