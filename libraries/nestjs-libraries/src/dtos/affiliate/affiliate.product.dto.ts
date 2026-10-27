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
