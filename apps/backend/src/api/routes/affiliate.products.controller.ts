import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { AffiliateProductsService } from '@gitroom/nestjs-libraries/database/prisma/affiliate/affiliate.products.service';
import { AffiliateVideosService } from '@gitroom/nestjs-libraries/database/prisma/affiliate/affiliate.videos.service';
import {
  AffiliateProductDto,
  ShopeeImportDto,
  ShopeeOffersQueryDto,
  StoryboardRequestDto,
  RenderVideoDto,
} from '@gitroom/nestjs-libraries/dtos/affiliate/affiliate.product.dto';

@ApiTags('Affiliate')
@Controller('/affiliate/products')
export class AffiliateProductsController {
  constructor(
    private _productsService: AffiliateProductsService,
    private _videosService: AffiliateVideosService
  ) {}

  @Get('/video/status')
  videoStatus() {
    return this._videosService.status();
  }

  @Post('/:id/storyboard')
  storyboard(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: StoryboardRequestDto
  ) {
    return this._videosService.storyboard(org.id, id, body.theme || 'dark');
  }

  @Post('/:id/videos')
  renderVideo(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: RenderVideoDto
  ) {
    return this._videosService.render(org.id, id, body.storyboard);
  }

  @Get('/:id/videos')
  videos(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._videosService.list(org.id, id);
  }

  @Get('/')
  list(
    @GetOrgFromRequest() org: Organization,
    @Query('search') search?: string
  ) {
    return this._productsService.list(org.id, search);
  }

  @Get('/shopee/status')
  shopeeStatus() {
    return this._productsService.shopeeStatus();
  }

  @Get('/shopee/offers')
  shopeeOffers(@Query() query: ShopeeOffersQueryDto) {
    return this._productsService.shopeeOffers({
      keyword: query.keyword,
      sort: query.sort,
      trending: query.trending === 'true',
      extraOnly: query.extra === 'true',
      page: query.page,
    });
  }

  @Post('/shopee/import')
  shopeeImport(
    @GetOrgFromRequest() org: Organization,
    @Body() body: ShopeeImportDto
  ) {
    return this._productsService.importShopee(org.id, body.itemId);
  }

  @Post('/')
  create(
    @GetOrgFromRequest() org: Organization,
    @Body() body: AffiliateProductDto
  ) {
    return this._productsService.create(org.id, body);
  }

  @Put('/:id')
  update(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: AffiliateProductDto
  ) {
    return this._productsService.update(org.id, id, body);
  }

  @Delete('/:id')
  remove(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._productsService.remove(org.id, id);
  }
}
