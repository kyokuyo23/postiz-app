jest.mock('@gitroom/helpers/auth/auth.service', () => ({
  AuthService: { fixedEncryption: (v: string) => v, fixedDecryption: (v: string) => v },
}));
jest.mock('@gitroom/nestjs-libraries/database/prisma/comments/comment.automations.service', () => ({
  CommentAutomationsService: class {},
}));
jest.mock('@gitroom/nestjs-libraries/database/prisma/integrations/integration.service', () => ({
  IntegrationService: class {},
}));
jest.mock('@gitroom/nestjs-libraries/integrations/refresh.integration.service', () => ({
  RefreshIntegrationService: class {},
}));
jest.mock('@gitroom/nestjs-libraries/database/prisma/live/live.repository', () => ({
  LiveRepository: class {},
}));
jest.mock('@gitroom/nestjs-libraries/affiliate/hyperframes.renderer', () => ({
  localUploadPath: () => null,
}));
jest.mock('@gitroom/nestjs-libraries/live/live.chat', () => {
  const actual = jest.requireActual('@gitroom/nestjs-libraries/live/live.chat');
  return {
    ...actual,
    youtubeChatId: jest.fn().mockResolvedValue('chat1'),
    youtubeChatMessages: jest.fn(),
    youtubeChatSend: jest.fn(),
    facebookLiveComments: jest.fn(),
    facebookReply: jest.fn(),
  };
});

import { ChatGuard, facebookLiveComments, facebookReply, youtubeChatMessages, youtubeChatSend } from '@gitroom/nestjs-libraries/live/live.chat';
import { LiveService } from '@gitroom/nestjs-libraries/database/prisma/live/live.service';

const rule = (over: any = {}) => ({
  id: 'r1',
  matchType: 'any',
  keywords: ['harga'],
  excludeKeywords: [],
  replies: ['Halo {name}, cek link di deskripsi ya 🙏'],
  hide: false,
  markAs: 'RESOLVED',
  integrations: [],
  ...over,
});

const msg = (id: string, text: string, author = 'u1', own = false) => ({ id, authorId: author, authorName: 'Budi', text, own });

const setup = (rules: any[]) => {
  const automations = { activeRules: jest.fn().mockResolvedValue(rules) };
  const integrations = {
    getIntegrationById: jest.fn().mockResolvedValue({ id: 'i1', internalId: 'page1', token: 't', name: 'X' }),
  };
  return new LiveService({} as any, integrations as any, {} as any, automations as any);
};

const session = (kind: 'youtube' | 'facebook') =>
  ({
    id: 's1',
    organizationId: 'org',
    destinations: [{ id: 'd1', kind, integrationId: 'i1', externalId: 'b1', status: 'LIVE' }],
  }) as any;

beforeEach(() => jest.clearAllMocks());

describe('ChatGuard', () => {
  it('limits per viewer, per gap and per live', () => {
    const g = new ChatGuard({ authorCooldownMs: 1000, gapMs: 100, maxPerLive: 2 });
    expect(g.allow('a', 0)).toBe(true);
    g.record('a', 0);
    expect(g.allow('b', 50)).toBe(false); // gap
    expect(g.allow('a', 500)).toBe(false); // same viewer cooldown
    expect(g.allow('b', 500)).toBe(true);
    g.record('b', 500);
    expect(g.allow('c', 5000)).toBe(false); // cap reached
  });
});

describe('live chat auto-reply', () => {
  it('skips the backlog, then answers matching YouTube chat messages once', async () => {
    const service = setup([rule()]);
    (youtubeChatMessages as jest.Mock)
      .mockResolvedValueOnce({ messages: [msg('old', 'harga berapa?')], pollMs: 0 })
      .mockResolvedValueOnce({ messages: [msg('m1', 'Harga berapa kak?'), msg('m2', 'mantap')], pollMs: 0 });
    const s = session('youtube');
    await service.pollChats(s);
    expect(youtubeChatSend).not.toHaveBeenCalled();
    (service as any).chats.get('d1').nextPollAt = 0;
    await service.pollChats(s);
    expect(youtubeChatSend).toHaveBeenCalledTimes(1);
    expect(youtubeChatSend).toHaveBeenCalledWith('t', 'chat1', 'Halo Budi, cek link di deskripsi ya 🙏');
  });

  it('replies to Facebook live comments but never to the page itself', async () => {
    const service = setup([rule()]);
    (facebookLiveComments as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([msg('c2', 'harga?', 'page1', true), msg('c1', 'harga?', 'u9')]);
    const s = session('facebook');
    await service.pollChats(s);
    (service as any).chats.get('d1').nextPollAt = 0;
    await service.pollChats(s);
    expect(facebookReply).toHaveBeenCalledTimes(1);
    expect(facebookReply).toHaveBeenCalledWith('t', 'c1', expect.stringContaining('Budi'));
  });

  it('ignores "every comment" rules in live chat', async () => {
    const service = setup([rule({ matchType: 'every', keywords: [] })]);
    await service.pollChats(session('youtube'));
    expect(youtubeChatMessages).not.toHaveBeenCalled();
  });
});
