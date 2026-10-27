import { BadRequestException, Injectable } from '@nestjs/common';
import { AffiliateProductsRepository } from '@gitroom/nestjs-libraries/database/prisma/affiliate/affiliate.products.repository';
import { AffiliateProductDto } from '@gitroom/nestjs-libraries/dtos/affiliate/affiliate.product.dto';

@Injectable()
export class AffiliateProductsService {
  constructor(private _repository: AffiliateProductsRepository) {}

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
}
