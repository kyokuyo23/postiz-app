import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

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
