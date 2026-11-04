jest.mock('@gitroom/helpers/auth/auth.service', () => ({
  AuthService: { fixedEncryption: (v: string) => `enc:${v}`, fixedDecryption: (v: string) => v.slice(4) },
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
const spawned: string[][] = [];
jest.mock('@gitroom/nestjs-libraries/live/live.ffmpeg', () => ({
  relayArgs: (input: string, outputs: string[]) => [input, ...outputs],
  fileLiveArgs: () => [],
  probeHasAudio: async () => true,
  isSafeRtmpUrl: async () => true,
  startFfmpeg: (args: string[]) => {
    spawned.push(args);
    return { kill: jest.fn() };
  },
}));
jest.mock('@gitroom/nestjs-libraries/live/live.platforms', () => ({
  createFacebookLive: jest.fn().mockResolvedValue({ externalId: 'fb1', rtmpUrl: 'rtmps://fb/key', watchUrl: null }),
  createYoutubeLive: jest.fn(),
  endFacebookLive: jest.fn(),
  endYoutubeLive: jest.fn(),
  LiveApiError: class extends Error {},
}));

import { LiveService } from '@gitroom/nestjs-libraries/database/prisma/live/live.service';
import { endFacebookLive } from '@gitroom/nestjs-libraries/live/live.platforms';

const KEY = 'ab'.repeat(18);

const session = (over: any = {}) => ({
  id: 's1',
  organizationId: 'org',
  title: 'Live',
  description: null,
  source: 'RTMP',
  streamKey: KEY,
  status: 'SCHEDULED',
  scheduledAt: new Date(),
  startedAt: null,
  droppedAt: null,
  endsAt: null,
  loop: false,
  updatedAt: new Date(),
  destinations: [
    { id: 'd1', kind: 'facebook', integrationId: 'i1', rtmpUrl: null, status: 'PENDING', externalId: null },
    { id: 'd2', kind: 'custom', rtmpUrl: 'enc:rtmp://tiktok/key', status: 'PENDING' },
  ],
  ...over,
});

const setup = (sessions: any[], ready: string[]) => {
  process.env.LIVE_RELAY_SECRET = 'relay-secret-0123456789';
  const repo = {
    active: jest.fn().mockResolvedValue(sessions),
    update: jest.fn(),
    updateDestination: jest.fn(),
  };
  const integrations = {
    getIntegrationById: jest.fn().mockResolvedValue({ id: 'i1', internalId: 'page', token: 't', name: 'Page' }),
  };
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ items: ready.map((name) => ({ name, ready: true })) }),
  }) as any;
  return { service: new LiveService(repo as any, integrations as any, {} as any), repo };
};

beforeEach(() => {
  spawned.length = 0;
  jest.clearAllMocks();
});

describe('live worker (RTMP)', () => {
  it('starts the relay to every target when OBS starts streaming', async () => {
    const { service, repo } = setup([session()], [`live/${KEY}`]);
    await service.tick();
    expect(spawned).toHaveLength(1);
    expect(spawned[0].slice(1)).toEqual(['rtmps://fb/key', 'rtmp://tiktok/key']);
    expect(repo.update).toHaveBeenCalledWith('s1', expect.objectContaining({ status: 'LIVE' }));
  });

  it('waits while nobody streams', async () => {
    const { service, repo } = setup([session()], []);
    await service.tick();
    expect(spawned).toHaveLength(0);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('marks a dropped stream as reconnecting, then ends it after the grace period', async () => {
    const live = setup([session({ status: 'LIVE', startedAt: new Date() })], []);
    await live.service.tick();
    expect(live.repo.update).toHaveBeenCalledWith('s1', expect.objectContaining({ status: 'RECONNECTING' }));

    const dropped = setup(
      [
        session({
          status: 'RECONNECTING',
          startedAt: new Date(),
          droppedAt: new Date(Date.now() - 5 * 60 * 1000),
          destinations: [{ id: 'd1', kind: 'facebook', integrationId: 'i1', externalId: 'fb1', status: 'LIVE' }],
        }),
      ],
      []
    );
    await dropped.service.tick();
    expect(endFacebookLive).toHaveBeenCalledWith('t', 'fb1');
    expect(dropped.repo.update).toHaveBeenCalledWith('s1', expect.objectContaining({ status: 'ENDED' }));
  });

  it('gives up when nobody streams for hours after the schedule', async () => {
    const { service, repo } = setup([session({ scheduledAt: new Date(Date.now() - 4 * 3600 * 1000) })], []);
    await service.tick();
    expect(repo.update).toHaveBeenCalledWith('s1', expect.objectContaining({ status: 'ENDED' }));
  });
});
