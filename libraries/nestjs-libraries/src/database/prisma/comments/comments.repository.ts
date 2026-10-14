import { Injectable } from '@nestjs/common';
import { Prisma, SocialCommentStatus } from '@prisma/client';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { FetchedComment } from '@gitroom/nestjs-libraries/integrations/social/comments.interface';

export const COMMENTS_PAGE_SIZE = 20;

@Injectable()
export class CommentsRepository {
  constructor(
    private _comment: PrismaRepository<'socialComment'>,
    private _sync: PrismaRepository<'commentSync'>,
    private _log: PrismaRepository<'commentAutomationLog'>
  ) {}

  async list(
    orgId: string,
    filters: {
      status?: SocialCommentStatus;
      integrationId?: string;
      search?: string;
      page?: number;
    }
  ) {
    const page = Math.max(0, Number(filters.page) || 0);
    const where: Prisma.SocialCommentWhereInput = {
      organizationId: orgId,
      integration: { deletedAt: null },
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.integrationId ? { integrationId: filters.integrationId } : {}),
      ...(filters.search
        ? {
            OR: [
              { text: { contains: filters.search, mode: 'insensitive' } },
              { authorName: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, comments] = await Promise.all([
      this._comment.model.socialComment.count({ where }),
      this._comment.model.socialComment.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: page * COMMENTS_PAGE_SIZE,
        take: COMMENTS_PAGE_SIZE,
        include: {
          integration: {
            select: {
              id: true,
              name: true,
              picture: true,
              providerIdentifier: true,
            },
          },
        },
      }),
    ]);
    return { total, pages: Math.ceil(total / COMMENTS_PAGE_SIZE), comments };
  }

  getComment(orgId: string, id: string) {
    return this._comment.model.socialComment.findFirst({
      where: { id, organizationId: orgId },
      include: { integration: true },
    });
  }

  statusCounts(orgId: string, from: Date) {
    return this._comment.model.socialComment.groupBy({
      by: ['status'],
      where: {
        organizationId: orgId,
        publishedAt: { gte: from },
        integration: { deletedAt: null },
      },
      _count: { _all: true },
    });
  }

  commentsSince(orgId: string, from: Date) {
    return this._comment.model.socialComment.findMany({
      where: {
        organizationId: orgId,
        publishedAt: { gte: from },
        integration: { deletedAt: null },
      },
      select: { status: true, publishedAt: true },
    });
  }

  /** Inserts only comments not seen before and returns the new rows. */
  insertNew(orgId: string, integrationId: string, items: FetchedComment[]) {
    if (!items.length) {
      return Promise.resolve([]);
    }
    return this._comment.model.socialComment.createManyAndReturn({
      skipDuplicates: true,
      data: items.map((c) => ({
        organizationId: orgId,
        integrationId,
        internalId: c.id,
        postInternalId: c.postId,
        postUrl: c.postUrl,
        postText: c.postText?.slice(0, 1000),
        parentInternalId: c.parentId,
        authorName: c.authorName.slice(0, 200),
        authorId: c.authorId,
        authorPicture: c.authorPicture,
        text: c.text.slice(0, 5000),
        hidden: !!c.hidden,
        publishedAt: new Date(c.publishedAt),
      })),
    });
  }

  updateComment(
    orgId: string,
    id: string,
    data: Prisma.SocialCommentUpdateInput
  ) {
    return this._comment.model.socialComment.update({
      where: { id, organizationId: orgId },
      data,
    });
  }

  getSync(integrationId: string) {
    return this._sync.model.commentSync.findUnique({
      where: { integrationId },
      include: { integration: true },
    });
  }

  getSyncs(orgId: string) {
    return this._sync.model.commentSync.findMany({
      where: { organizationId: orgId },
    });
  }

  upsertSync(orgId: string, integrationId: string, enabled: boolean) {
    return this._sync.model.commentSync.upsert({
      where: { integrationId },
      create: { organizationId: orgId, integrationId, enabled },
      update: { enabled },
    });
  }

  markSynced(integrationId: string, at: Date, lastError: string | null) {
    return this._sync.model.commentSync.update({
      where: { integrationId },
      data: lastError ? { lastError } : { lastSyncAt: at, lastError: null },
    });
  }

  log(data: {
    organizationId: string;
    automationId?: string;
    commentId: string;
    action: string;
    success: boolean;
    error?: string;
  }) {
    return this._log.model.commentAutomationLog.create({
      data: { ...data, error: data.error?.slice(0, 1000) },
    });
  }
}
