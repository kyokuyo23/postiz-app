import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

export type AffiliateVideoStatus = 'QUEUED' | 'RENDERING' | 'DONE' | 'ERROR';

@Injectable()
export class AffiliateVideosRepository {
  constructor(private _video: PrismaRepository<'affiliateVideo'>) {}

  create(orgId: string, productId: string, storyboard: string) {
    return this._video.model.affiliateVideo.create({
      data: { organizationId: orgId, productId, storyboard, status: 'QUEUED' },
    });
  }

  get(orgId: string, id: string) {
    return this._video.model.affiliateVideo.findFirst({
      where: { id, organizationId: orgId },
    });
  }

  listByProduct(orgId: string, productId: string) {
    return this._video.model.affiliateVideo.findMany({
      where: { organizationId: orgId, productId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  countPending(orgId: string) {
    return this._video.model.affiliateVideo.count({
      where: { organizationId: orgId, status: { in: ['QUEUED', 'RENDERING'] } },
    });
  }

  nextQueued() {
    return this._video.model.affiliateVideo.findFirst({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
      include: { product: true },
    });
  }

  /** Claims a queued job; false when another worker already took it. */
  async claim(id: string) {
    const { count } = await this._video.model.affiliateVideo.updateMany({
      where: { id, status: 'QUEUED' },
      data: { status: 'RENDERING' },
    });
    return count === 1;
  }

  markDone(id: string, mediaId: string, mediaPath: string) {
    return this._video.model.affiliateVideo.update({
      where: { id },
      data: { status: 'DONE', mediaId, mediaPath, error: null },
    });
  }

  markError(id: string, error: string) {
    return this._video.model.affiliateVideo.update({
      where: { id },
      data: { status: 'ERROR', error: error.slice(0, 500) },
    });
  }

  /** Jobs cut off by a restart are reported as failed instead of hanging. */
  failInterrupted() {
    return this._video.model.affiliateVideo.updateMany({
      where: { status: 'RENDERING' },
      data: { status: 'ERROR', error: 'Render was interrupted (server restarted). Try again.' },
    });
  }
}
