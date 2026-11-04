import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

export type LiveStatus = 'SCHEDULED' | 'LIVE' | 'RECONNECTING' | 'ENDED' | 'ERROR';
export const ACTIVE_LIVE: LiveStatus[] = ['SCHEDULED', 'LIVE', 'RECONNECTING'];

export interface NewDestination {
  kind: 'youtube' | 'facebook' | 'custom';
  integrationId?: string;
  name: string;
  rtmpUrl?: string;
}

const withDestinations = { destinations: { orderBy: { createdAt: 'asc' } } } as const;

@Injectable()
export class LiveRepository {
  constructor(
    private _live: PrismaRepository<'liveSession'>,
    private _destination: PrismaRepository<'liveDestination'>
  ) {}

  list(orgId: string) {
    return this._live.model.liveSession.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { scheduledAt: 'desc' },
      take: 50,
      include: withDestinations,
    });
  }

  get(orgId: string, id: string) {
    return this._live.model.liveSession.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: withDestinations,
    });
  }

  getById(id: string) {
    return this._live.model.liveSession.findFirst({
      where: { id, deletedAt: null },
      include: withDestinations,
    });
  }

  byStreamKey(streamKey: string) {
    return this._live.model.liveSession.findFirst({
      where: { streamKey, deletedAt: null, status: { in: ACTIVE_LIVE } },
    });
  }

  countActive(orgId: string) {
    return this._live.model.liveSession.count({
      where: { organizationId: orgId, deletedAt: null, status: { in: ACTIVE_LIVE } },
    });
  }

  /** Sessions the worker has to look at. */
  active() {
    return this._live.model.liveSession.findMany({
      where: { deletedAt: null, status: { in: ACTIVE_LIVE } },
      include: withDestinations,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  create(
    orgId: string,
    data: Omit<Prisma.LiveSessionUncheckedCreateInput, 'organizationId' | 'destinations'>,
    destinations: NewDestination[]
  ) {
    return this._live.model.liveSession.create({
      data: {
        ...data,
        organizationId: orgId,
        destinations: { create: destinations },
      },
      include: withDestinations,
    });
  }

  update(id: string, data: Prisma.LiveSessionUpdateInput) {
    return this._live.model.liveSession.update({ where: { id }, data });
  }

  updateDestination(id: string, data: Prisma.LiveDestinationUpdateInput) {
    return this._destination.model.liveDestination.update({ where: { id }, data });
  }

  softDelete(id: string) {
    return this._live.model.liveSession.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
