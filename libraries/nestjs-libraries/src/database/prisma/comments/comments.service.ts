import { BadRequestException, Injectable } from '@nestjs/common';
import { Integration, SocialComment, SocialCommentStatus } from '@prisma/client';
import dayjs from 'dayjs';
import { TemporalService } from 'nestjs-temporal-core';
import { TypedSearchAttributes } from '@temporalio/common';
import { CommentsRepository } from '@gitroom/nestjs-libraries/database/prisma/comments/comments.repository';
import { CommentAutomationsService } from '@gitroom/nestjs-libraries/database/prisma/comments/comment.automations.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { RefreshIntegrationService } from '@gitroom/nestjs-libraries/integrations/refresh.integration.service';
import { RefreshToken } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { SocialProvider } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { decide } from '@gitroom/nestjs-libraries/comments/comment.rules';
import { CommentsListQueryDto } from '@gitroom/nestjs-libraries/dtos/comments/comments.dto';
import { organizationId } from '@gitroom/nestjs-libraries/temporal/temporal.search.attribute';
import { timer } from '@gitroom/helpers/utils/timer';

/** First sync looks back this far; automations never act on these. */
const INITIAL_LOOKBACK_DAYS = 7;
/** Re-read a small overlap to avoid missing comments at the boundary. */
const OVERLAP_MINUTES = 10;
/** Cap on automated actions per sync run, to stay within platform limits. */
const MAX_AUTOMATED_PER_RUN = 30;

const errorMessage = (e: unknown) =>
  (e as any)?.message || (typeof e === 'string' ? e : 'Unknown error');

@Injectable()
export class CommentsService {
  constructor(
    private _repository: CommentsRepository,
    private _automations: CommentAutomationsService,
    private _integrationService: IntegrationService,
    private _integrationManager: IntegrationManager,
    private _refreshIntegrationService: RefreshIntegrationService,
    private _temporalService: TemporalService
  ) {}

  private provider(identifier: string): SocialProvider | undefined {
    return this._integrationManager.getSocialIntegration(identifier);
  }

  private async withFreshToken<T>(
    integration: Integration,
    run: (integration: Integration) => Promise<T>,
    retried = false
  ): Promise<T> {
    let current = integration;
    if (
      retried ||
      (integration.tokenExpiration &&
        dayjs(integration.tokenExpiration).isBefore(dayjs()))
    ) {
      const refreshed = await this._refreshIntegrationService.refresh(
        integration
      );
      if (!refreshed || !refreshed.accessToken) {
        throw new BadRequestException(
          'This channel must be reconnected before comments can be used'
        );
      }
      current = { ...integration, token: refreshed.accessToken };
    }
    try {
      return await run(current);
    } catch (e) {
      if (e instanceof RefreshToken && !retried) {
        return this.withFreshToken(integration, run, true);
      }
      throw e;
    }
  }

  // ---------------------------------------------------------------- sources

  async sources(orgId: string) {
    const [integrations, syncs] = await Promise.all([
      this._integrationService.getIntegrationsList(orgId),
      this._repository.getSyncs(orgId),
    ]);
    // Make sure enabled channels have a running sync (no-op if already running,
    // recovers after a Temporal reset).
    for (const sync of syncs.filter((s) => s.enabled)) {
      this.startSyncWorkflow(orgId, sync.integrationId).catch(() => undefined);
    }
    return integrations
      .filter((i) => this.provider(i.providerIdentifier)?.fetchComments)
      .map((i) => {
        const sync = syncs.find((s) => s.integrationId === i.id);
        const provider = this.provider(i.providerIdentifier)!;
        return {
          id: i.id,
          name: i.name,
          picture: i.picture,
          providerIdentifier: i.providerIdentifier,
          disabled: i.disabled,
          refreshNeeded: i.refreshNeeded || i.inBetweenSteps,
          capabilities: provider.commentCapabilities,
          canResearch: !!provider.searchContent,
          enabled: !!sync?.enabled,
          lastSyncAt: sync?.lastSyncAt || null,
          lastError: sync?.lastError || null,
        };
      });
  }

  async setSource(orgId: string, integrationId: string, enabled: boolean) {
    const integration = await this._integrationService.getIntegrationById(
      orgId,
      integrationId
    );
    if (!integration || integration.deletedAt) {
      throw new BadRequestException('Channel not found');
    }
    if (!this.provider(integration.providerIdentifier)?.fetchComments) {
      throw new BadRequestException('This channel does not support comments');
    }
    const sync = await this._repository.upsertSync(orgId, integrationId, enabled);
    if (enabled) {
      await this.startSyncWorkflow(orgId, integrationId);
    }
    return sync;
  }

  private async startSyncWorkflow(orgId: string, integrationId: string) {
    try {
      await this._temporalService.client
        .getRawClient()
        ?.workflow.start('commentSyncWorkflow', {
          workflowId: `comments-sync-${integrationId}`,
          taskQueue: 'main',
          args: [{ integrationId }],
          workflowIdConflictPolicy: 'USE_EXISTING',
          typedSearchAttributes: new TypedSearchAttributes([
            { key: organizationId, value: orgId },
          ]),
        });
    } catch (err) {
      // The workflow may already be running; syncing can also be triggered manually.
    }
  }

  // ------------------------------------------------------------------- sync

  /**
   * Pulls new comments for one channel and runs automations on them.
   * Returns stop=true when the channel no longer needs syncing.
   */
  async syncIntegration(integrationId: string): Promise<{ stop: boolean; added: number }> {
    const sync = await this._repository.getSync(integrationId);
    if (!sync || !sync.enabled || sync.integration.deletedAt) {
      return { stop: true, added: 0 };
    }
    const integration = sync.integration;
    const provider = this.provider(integration.providerIdentifier);
    if (!provider?.fetchComments) {
      return { stop: true, added: 0 };
    }
    if (integration.disabled || integration.refreshNeeded || integration.inBetweenSteps) {
      await this._repository.markSynced(
        integrationId,
        new Date(),
        'Channel is disabled or must be reconnected'
      );
      return { stop: false, added: 0 };
    }

    const startedAt = new Date();
    const since = sync.lastSyncAt
      ? dayjs(sync.lastSyncAt).subtract(OVERLAP_MINUTES, 'minute').toDate()
      : dayjs().subtract(INITIAL_LOOKBACK_DAYS, 'day').toDate();

    try {
      const fetched = await this.withFreshToken(integration, (i) =>
        provider.fetchComments!(i, since)
      );
      const added = await this._repository.insertNew(
        integration.organizationId,
        integrationId,
        fetched
      );
      await this.runAutomations(integration, provider, added, sync.createdAt);
      await this._repository.markSynced(integrationId, startedAt, null);
      return { stop: false, added: added.length };
    } catch (e) {
      await this._repository.markSynced(integrationId, startedAt, errorMessage(e));
      return { stop: false, added: 0 };
    }
  }

  async syncNow(orgId: string, integrationId: string) {
    const sync = await this._repository.getSync(integrationId);
    if (!sync || sync.organizationId !== orgId) {
      throw new BadRequestException('Enable comments for this channel first');
    }
    return this.syncIntegration(integrationId);
  }

  private async runAutomations(
    integration: Integration,
    provider: SocialProvider,
    comments: SocialComment[],
    enabledAt: Date
  ) {
    // Never act on comments that existed before the inbox was switched on.
    const eligible = comments
      .filter((c) => c.publishedAt >= enabledAt)
      .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime())
      .slice(0, MAX_AUTOMATED_PER_RUN);
    if (!eligible.length) {
      return;
    }
    const rules = await this._automations.activeRules(integration.organizationId);
    if (!rules.length) {
      return;
    }

    for (const comment of eligible) {
      const decision = decide(rules, {
        id: comment.id,
        integrationId: comment.integrationId,
        authorName: comment.authorName,
        text: comment.text,
      });
      if (!decision) {
        continue;
      }
      let ok = true;
      let repliedText: string | undefined;

      if (decision.reply && provider.replyToComment && provider.commentCapabilities?.reply) {
        try {
          await this.withFreshToken(integration, (i) =>
            provider.replyToComment!(
              i,
              { id: comment.internalId, postId: comment.postInternalId, parentId: comment.parentInternalId },
              decision.reply!
            )
          );
          repliedText = decision.reply;
          await this._repository.log({
            organizationId: integration.organizationId,
            automationId: decision.ruleId,
            commentId: comment.id,
            action: 'reply',
            success: true,
          });
          await timer(1500);
        } catch (e) {
          ok = false;
          await this._repository.log({
            organizationId: integration.organizationId,
            automationId: decision.ruleId,
            commentId: comment.id,
            action: 'reply',
            success: false,
            error: errorMessage(e),
          });
        }
      }

      if (decision.hide && provider.hideComment && provider.commentCapabilities?.hide) {
        try {
          await this.withFreshToken(integration, (i) =>
            provider.hideComment!(i, comment.internalId, true)
          );
          await this._repository.log({
            organizationId: integration.organizationId,
            automationId: decision.ruleId,
            commentId: comment.id,
            action: 'hide',
            success: true,
          });
        } catch (e) {
          ok = false;
          await this._repository.log({
            organizationId: integration.organizationId,
            automationId: decision.ruleId,
            commentId: comment.id,
            action: 'hide',
            success: false,
            error: errorMessage(e),
          });
        }
      }

      if (ok) {
        await this._repository.updateComment(integration.organizationId, comment.id, {
          status: decision.markAs,
          hidden: decision.hide || comment.hidden,
          resolvedBy: `automation:${decision.ruleId}`,
          ...(repliedText ? { repliedText, repliedAt: new Date() } : {}),
        });
        await this._automations.incrementRuns(decision.ruleId);
      }
    }
  }

  // ------------------------------------------------------------ inbox & stats

  list(orgId: string, query: CommentsListQueryDto) {
    return this._repository.list(orgId, {
      status: query.status as SocialCommentStatus | undefined,
      integrationId: query.integrationId,
      search: query.search?.trim() || undefined,
      page: query.page,
    });
  }

  async stats(orgId: string, days = 3) {
    const from = dayjs().startOf('day').subtract(days - 1, 'day');
    const [counts, rows] = await Promise.all([
      this._repository.statusCounts(orgId, from.toDate()),
      this._repository.commentsSince(orgId, from.toDate()),
    ]);
    const total = (status: SocialCommentStatus) =>
      counts.find((c) => c.status === status)?._count._all || 0;

    const perDay = Array.from({ length: days }).map((_, index) => {
      const day = from.add(index, 'day');
      const sameDay = rows.filter((r) => dayjs(r.publishedAt).isSame(day, 'day'));
      return {
        date: day.format('YYYY-MM-DD'),
        resolved: sameDay.filter((r) => r.status === 'RESOLVED').length,
        pending: sameDay.filter((r) => r.status === 'PENDING').length,
        ignored: sameDay.filter((r) => r.status === 'IGNORED').length,
      };
    });

    return {
      days,
      all: total('PENDING') + total('RESOLVED') + total('IGNORED'),
      resolved: total('RESOLVED'),
      pending: total('PENDING'),
      ignored: total('IGNORED'),
      perDay,
    };
  }

  async setStatus(orgId: string, id: string, status: SocialCommentStatus, userId: string) {
    const comment = await this._repository.getComment(orgId, id);
    if (!comment) {
      throw new BadRequestException('Comment not found');
    }
    return this._repository.updateComment(orgId, id, {
      status,
      resolvedBy: status === 'PENDING' ? null : `user:${userId}`,
    });
  }

  async reply(orgId: string, id: string, text: string, userId: string) {
    const comment = await this._repository.getComment(orgId, id);
    if (!comment || comment.integration.deletedAt) {
      throw new BadRequestException('Comment not found');
    }
    const provider = this.provider(comment.integration.providerIdentifier);
    if (!provider?.replyToComment || !provider.commentCapabilities?.reply) {
      throw new BadRequestException('Replying is not supported for this channel');
    }
    try {
      await this.withFreshToken(comment.integration, (i) =>
        provider.replyToComment!(
          i,
          { id: comment.internalId, postId: comment.postInternalId, parentId: comment.parentInternalId },
          text.trim()
        )
      );
    } catch (e) {
      if (e instanceof BadRequestException) {
        throw e;
      }
      throw new BadRequestException(`Could not reply: ${errorMessage(e)}`);
    }
    return this._repository.updateComment(orgId, id, {
      status: 'RESOLVED',
      repliedText: text.trim(),
      repliedAt: new Date(),
      resolvedBy: `user:${userId}`,
    });
  }

  async hide(orgId: string, id: string, hide: boolean) {
    const comment = await this._repository.getComment(orgId, id);
    if (!comment || comment.integration.deletedAt) {
      throw new BadRequestException('Comment not found');
    }
    const provider = this.provider(comment.integration.providerIdentifier);
    if (!provider?.hideComment || !provider.commentCapabilities?.hide) {
      throw new BadRequestException('Hiding is not supported for this channel');
    }
    try {
      await this.withFreshToken(comment.integration, (i) =>
        provider.hideComment!(i, comment.internalId, hide)
      );
    } catch (e) {
      if (e instanceof BadRequestException) {
        throw e;
      }
      throw new BadRequestException(`Could not update the comment: ${errorMessage(e)}`);
    }
    return this._repository.updateComment(orgId, id, { hidden: hide });
  }

  // --------------------------------------------------------------- research

  async research(orgId: string, integrationId: string, query: string) {
    const integration = await this._integrationService.getIntegrationById(
      orgId,
      integrationId
    );
    if (!integration || integration.deletedAt) {
      throw new BadRequestException('Channel not found');
    }
    const provider = this.provider(integration.providerIdentifier);
    if (!provider?.searchContent) {
      throw new BadRequestException('Research is not supported for this channel');
    }
    try {
      return await this.withFreshToken(integration, (i) =>
        provider.searchContent!(i, query.trim())
      );
    } catch (e) {
      if (e instanceof BadRequestException) {
        throw e;
      }
      throw new BadRequestException(`Search failed: ${errorMessage(e)}`);
    }
  }
}
