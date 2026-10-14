// Heavy runtime dependencies are replaced so the service logic can be tested
// in isolation (no database, Temporal or social network calls).
jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class {},
}));
jest.mock('@gitroom/nestjs-libraries/integrations/refresh.integration.service', () => ({
  RefreshIntegrationService: class {},
}));
jest.mock('@gitroom/nestjs-libraries/database/prisma/integrations/integration.service', () => ({
  IntegrationService: class {},
}));
jest.mock('@gitroom/nestjs-libraries/integrations/social.abstract', () => ({
  RefreshToken: class RefreshToken extends Error {},
}));
jest.mock('@gitroom/nestjs-libraries/database/prisma/comments/comments.repository', () => ({
  CommentsRepository: class {},
}));
jest.mock('@gitroom/nestjs-libraries/database/prisma/comments/comment.automations.service', () => ({
  CommentAutomationsService: class {},
}));
jest.mock('nestjs-temporal-core', () => ({ TemporalService: class {} }));
jest.mock('@gitroom/nestjs-libraries/temporal/temporal.search.attribute', () => ({
  organizationId: 'organizationId',
}));
jest.mock('@gitroom/helpers/utils/timer', () => ({ timer: () => Promise.resolve() }));

import { CommentsService } from '@gitroom/nestjs-libraries/database/prisma/comments/comments.service';
import { RefreshToken } from '@gitroom/nestjs-libraries/integrations/social.abstract';

const enabledAt = new Date('2026-10-01T00:00:00Z');

const integration = {
  id: 'int1',
  organizationId: 'org1',
  providerIdentifier: 'threads',
  token: 'tok',
  tokenExpiration: new Date(Date.now() + 3600_000),
  deletedAt: null,
  disabled: false,
  refreshNeeded: false,
  inBetweenSteps: false,
};

const row = (id: string, text: string, publishedAt: string) => ({
  id,
  integrationId: 'int1',
  internalId: `ext-${id}`,
  postInternalId: 'post1',
  parentInternalId: null,
  authorName: 'budi',
  text,
  hidden: false,
  publishedAt: new Date(publishedAt),
});

function setup(overrides: { fetched?: any[]; inserted?: any[]; replyFails?: boolean; sync?: any } = {}) {
  const provider = {
    commentCapabilities: { reply: true, hide: true, directMessage: false },
    fetchComments: jest.fn().mockResolvedValue(overrides.fetched || []),
    replyToComment: overrides.replyFails
      ? jest.fn().mockRejectedValue(new Error('rate limited'))
      : jest.fn().mockResolvedValue({ id: 'r1' }),
    hideComment: jest.fn().mockResolvedValue(undefined),
  };
  const repository = {
    getSync: jest.fn().mockResolvedValue(
      'sync' in overrides
        ? overrides.sync
        : { enabled: true, createdAt: enabledAt, lastSyncAt: null, integration }
    ),
    insertNew: jest.fn().mockResolvedValue(overrides.inserted || []),
    markSynced: jest.fn().mockResolvedValue(undefined),
    updateComment: jest.fn().mockResolvedValue(undefined),
    log: jest.fn().mockResolvedValue(undefined),
  };
  const automations = {
    activeRules: jest.fn().mockResolvedValue([
      {
        id: 'spam',
        matchType: 'any',
        keywords: ['slot'],
        excludeKeywords: [],
        replies: [],
        hide: true,
        markAs: 'IGNORED',
        integrations: [],
      },
      {
        id: 'price',
        matchType: 'any',
        keywords: ['harga'],
        excludeKeywords: [],
        replies: ['Halo {name}'],
        hide: false,
        markAs: 'RESOLVED',
        integrations: [],
      },
    ]),
    incrementRuns: jest.fn().mockResolvedValue(undefined),
  };
  const manager = { getSocialIntegration: () => provider };
  const refresh = { refresh: jest.fn() };
  const service = new CommentsService(
    repository as any,
    automations as any,
    {} as any,
    manager as any,
    refresh as any,
    {} as any
  );
  return { service, provider, repository, automations, refresh };
}

describe('CommentsService.syncIntegration', () => {
  it('stops when the sync was disabled or removed', async () => {
    const { service } = setup({ sync: null });
    expect(await service.syncIntegration('int1')).toEqual({ stop: true, added: 0 });
  });

  it('looks back 7 days on the first sync', async () => {
    const { service, provider } = setup();
    await service.syncIntegration('int1');
    const since: Date = provider.fetchComments.mock.calls[0][1];
    const days = (Date.now() - since.getTime()) / 86400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it('applies the first matching rule only to comments after the inbox was enabled', async () => {
    const old = row('c0', 'harga?', '2026-09-30T10:00:00Z');
    const price = row('c1', 'Berapa harga?', '2026-10-02T10:00:00Z');
    const spam = row('c2', 'slot gacor', '2026-10-02T11:00:00Z');
    const other = row('c3', 'nice', '2026-10-02T12:00:00Z');
    const { service, provider, repository, automations } = setup({
      inserted: [old, price, spam, other],
    });

    const result = await service.syncIntegration('int1');

    expect(result).toEqual({ stop: false, added: 4 });
    // old comment untouched, unmatched comment untouched
    expect(provider.replyToComment).toHaveBeenCalledTimes(1);
    expect(provider.replyToComment).toHaveBeenCalledWith(
      integration,
      { id: 'ext-c1', postId: 'post1', parentId: null },
      'Halo budi'
    );
    expect(provider.hideComment).toHaveBeenCalledWith(integration, 'ext-c2', true);
    expect(repository.updateComment).toHaveBeenCalledWith('org1', 'c1', expect.objectContaining({ status: 'RESOLVED', repliedText: 'Halo budi', resolvedBy: 'automation:price' }));
    expect(repository.updateComment).toHaveBeenCalledWith('org1', 'c2', expect.objectContaining({ status: 'IGNORED', hidden: true }));
    expect(repository.updateComment).toHaveBeenCalledTimes(2);
    expect(automations.incrementRuns).toHaveBeenCalledTimes(2);
    expect(repository.markSynced).toHaveBeenCalledWith('int1', expect.any(Date), null);
  });

  it('keeps the comment pending and logs the error when the reply fails', async () => {
    const { service, repository } = setup({
      inserted: [row('c1', 'harga?', '2026-10-02T10:00:00Z')],
      replyFails: true,
    });
    await service.syncIntegration('int1');
    expect(repository.updateComment).not.toHaveBeenCalled();
    expect(repository.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reply', success: false, error: 'rate limited' })
    );
  });

  it('records the error and keeps polling when fetching fails', async () => {
    const { service, provider, repository } = setup();
    provider.fetchComments.mockRejectedValue(new Error('boom'));
    expect(await service.syncIntegration('int1')).toEqual({ stop: false, added: 0 });
    expect(repository.markSynced).toHaveBeenCalledWith('int1', expect.any(Date), 'boom');
  });

  it('refreshes the token once and retries on RefreshToken', async () => {
    const { service, provider, refresh } = setup();
    provider.fetchComments
      .mockRejectedValueOnce(new (RefreshToken as any)('expired'))
      .mockResolvedValueOnce([]);
    refresh.refresh.mockResolvedValue({ accessToken: 'new' });
    expect(await service.syncIntegration('int1')).toEqual({ stop: false, added: 0 });
    expect(provider.fetchComments.mock.calls[1][0].token).toBe('new');
  });

  it('skips disabled channels without calling the API', async () => {
    const { service, provider, repository } = setup({
      sync: { enabled: true, createdAt: enabledAt, lastSyncAt: null, integration: { ...integration, refreshNeeded: true } },
    });
    expect(await service.syncIntegration('int1')).toEqual({ stop: false, added: 0 });
    expect(provider.fetchComments).not.toHaveBeenCalled();
    expect(repository.markSynced).toHaveBeenCalledWith('int1', expect.any(Date), expect.stringContaining('reconnected'));
  });
});
