import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AffiliateProductDto } from '@gitroom/nestjs-libraries/dtos/affiliate/affiliate.product.dto';

const fields = (body: AffiliateProductDto) => ({
  name: body.name.trim(),
  price: body.price?.trim() || null,
  marketplace: body.marketplace,
  link: body.link.trim(),
  imageId: body.imageId || null,
  imagePath: body.imagePath || null,
  notes: body.notes?.trim() || null,
  ...(body.description !== undefined
    ? { description: body.description.trim() || null }
    : {}),
  ...(body.gallery !== undefined
    ? {
        gallery: JSON.stringify(
          body.gallery.map((g) => ({
            id: g.id || null,
            path: g.path,
            type: g.type,
            source: g.source,
          }))
        ),
      }
    : {}),
});

@Injectable()
export class AffiliateProductsRepository {
  constructor(private _product: PrismaRepository<'affiliateProduct'>) {}

  list(orgId: string, search?: string) {
    return this._product.model.affiliateProduct.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        ...(search
          ? { name: { contains: search, mode: 'insensitive' as const } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  get(orgId: string, id: string) {
    return this._product.model.affiliateProduct.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });
  }

  create(
    orgId: string,
    body: AffiliateProductDto,
    extra: { commission?: string; source?: string; externalId?: string } = {}
  ) {
    return this._product.model.affiliateProduct.create({
      data: {
        organizationId: orgId,
        ...fields(body),
        commission: extra.commission || null,
        source: extra.source || null,
        externalId: extra.externalId || null,
      },
    });
  }

  findByExternal(orgId: string, source: string, externalId: string) {
    return this._product.model.affiliateProduct.findFirst({
      where: { organizationId: orgId, source, externalId, deletedAt: null },
    });
  }

  update(orgId: string, id: string, body: AffiliateProductDto) {
    return this._product.model.affiliateProduct.update({
      where: { id, organizationId: orgId, deletedAt: null },
      data: fields(body),
    });
  }

  remove(orgId: string, id: string) {
    return this._product.model.affiliateProduct.update({
      where: { id, organizationId: orgId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}
