import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsObject, ValidateNested } from 'class-validator';

export const AFFILIATE_MARKETPLACES = [
  'shopee',
  'tokopedia',
  'tiktok_shop',
  'lazada',
  'blibli',
  'amazon',
  'other',
] as const;
export type AffiliateMarketplace = (typeof AFFILIATE_MARKETPLACES)[number];

export class AffiliateGalleryItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  id?: string;

  @IsString()
  @MaxLength(2000)
  path: string;

  @IsIn(['image', 'video'])
  type: 'image' | 'video';

  @IsIn(['product', 'review'])
  source: 'product' | 'review';
}

export class AffiliateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  price?: string;

  @IsIn(AFFILIATE_MARKETPLACES)
  marketplace: AffiliateMarketplace;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2000)
  link: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  imageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imagePath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  /** Omit to keep the current gallery. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => AffiliateGalleryItemDto)
  gallery?: AffiliateGalleryItemDto[];
}

export class StoryboardRequestDto {
  @IsOptional()
  @IsIn(['dark', 'light'])
  theme?: 'dark' | 'light';

  @IsOptional()
  @IsIn(['promo', 'pov', 'story', 'review', 'tips', 'problem'])
  style?: 'promo' | 'pov' | 'story' | 'review' | 'tips' | 'problem';
}

export class RenderVideoDto {
  /** Validated with the zod storyboard schema in the service. */
  @IsObject()
  storyboard: Record<string, unknown>;
}

export const SHOPEE_SORTS = [
  'relevance',
  'sales',
  'commission',
  'price_asc',
  'price_desc',
] as const;

export class ShopeeOffersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @IsIn(SHOPEE_SORTS)
  sort?: (typeof SHOPEE_SORTS)[number];

  @IsOptional()
  @IsIn(['true', 'false'])
  trending?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  extra?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  page?: number;
}

export class ShopeeImportDto {
  @IsString()
  @Matches(/^\d{1,19}$/)
  itemId: string;
}
