import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { AffiliateProductsService } from '@gitroom/nestjs-libraries/database/prisma/affiliate/affiliate.products.service';
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
}) => ({
  id: p.id,
  name: p.name,
  price: p.price,
  marketplace: p.marketplace,
  link: p.link,
  image: p.imagePath ? { id: p.imageId, path: p.imagePath } : null,
  notes: p.notes,
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

export const affiliateTools = [AffiliateProductsListTool, AffiliateProductCreateTool];
