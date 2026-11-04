jest.mock('@gitroom/helpers/auth/auth.service', () => ({
  AuthService: { fixedEncryption: (v: string) => `enc:${v}`, fixedDecryption: (v: string) => v.slice(4) },
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
  ACTIVE_LIVE: ['SCHEDULED', 'LIVE', 'RECONNECTING'],
}));
jest.mock('@gitroom/nestjs-libraries/affiliate/hyperframes.renderer', () => ({
  localUploadPath: () => null,
}));

import {
  fileLiveArgs,
  isSafeRtmpUrl,
  relayArgs,
  teeTargets,
} from '@gitroom/nestjs-libraries/live/live.ffmpeg';
import {
  LiveService,
  joinRtmp,
  looksLikeTiktok,
} from '@gitroom/nestjs-libraries/database/prisma/live/live.service';

const KEY = 'ab'.repeat(18);
const SECRET = 'relay-secret-0123456789';

describe('ffmpeg arguments', () => {
  it('escapes tee separators so a key cannot add targets', () => {
    expect(teeTargets(['rtmp://a/x|y', 'rtmp://b/[k]'])).toBe(
      '[f=flv:onfail=ignore]rtmp://a/x\\|y|[f=flv:onfail=ignore]rtmp://b/\\[k\\]'
    );
  });

  it('relays without re-encoding', () => {
    const args = relayArgs('rtmp://in/live/k', ['rtmp://out/1']);
    expect(args.join(' ')).toContain('-c copy -f tee');
  });

  it('loops a file for the requested time and adds silence when there is no audio', () => {
    const args = fileLiveArgs({
      file: '/v.mp4',
      outputs: ['rtmp://out/1'],
      loop: true,
      durationSec: 600,
      hasAudio: false,
    }).join(' ');
    expect(args).toContain('-stream_loop -1 -i /v.mp4');
    expect(args).toContain('anullsrc');
    expect(args).toContain('-t 600');
    expect(args).toContain('-g 60');
  });

  it('plays once without a duration when not looping', () => {
    const args = fileLiveArgs({ file: '/v.mp4', outputs: ['rtmp://o/1'], loop: false, hasAudio: true });
    expect(args).not.toContain('-stream_loop');
    expect(args).not.toContain('-t');
  });
});

describe('custom RTMP targets', () => {
  it('joins server and key', () => {
    expect(joinRtmp('rtmp://push.example.com/live/', '/abc')).toBe('rtmp://push.example.com/live/abc');
  });

  it('only allows rtmp(s) to public hosts', async () => {
    expect(await isSafeRtmpUrl('https://example.com/live')).toBe(false);
    expect(await isSafeRtmpUrl('rtmp://127.0.0.1/live/k')).toBe(false);
    expect(await isSafeRtmpUrl('rtmp://postgres:5432/x')).toBe(false);
    expect(await isSafeRtmpUrl('rtmp://10.0.0.5/live/k')).toBe(false);
    expect(await isSafeRtmpUrl('rtmps://8.8.8.8:443/rtmp/k')).toBe(true);
  });

  it('recognises TikTok targets', () => {
    expect(looksLikeTiktok({ name: 'TikTok' })).toBe(true);
    expect(looksLikeTiktok({ serverUrl: 'rtmp://push-rtmp-l11-sg01.tiktokcdn.com/stage' })).toBe(true);
    expect(looksLikeTiktok({ name: 'Shopee Live' })).toBe(false);
  });
});

describe('MediaMTX auth hook', () => {
  const setup = (session: any) => {
    const repo = { byStreamKey: jest.fn().mockResolvedValue(session) };
    return { service: new LiveService(repo as any, {} as any, {} as any, {} as any), repo };
  };
  beforeEach(() => {
    process.env.LIVE_RELAY_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.LIVE_RELAY_SECRET;
  });

  it('lets OBS publish with the key of an active RTMP session', async () => {
    const { service, repo } = setup({ source: 'RTMP' });
    expect(await service.authorize(SECRET, { action: 'publish', path: `live/${KEY}` })).toBe(true);
    expect(repo.byStreamKey).toHaveBeenCalledWith(KEY);
  });

  it('rejects unknown keys, video sessions and other paths', async () => {
    expect(await setup(null).service.authorize(SECRET, { action: 'publish', path: `live/${KEY}` })).toBe(false);
    expect(await setup({ source: 'VIDEO' }).service.authorize(SECRET, { action: 'publish', path: `live/${KEY}` })).toBe(false);
    expect(await setup({ source: 'RTMP' }).service.authorize(SECRET, { action: 'publish', path: 'other/x' })).toBe(false);
  });

  it('rejects calls without the hook secret', async () => {
    const { service } = setup({ source: 'RTMP' });
    expect(await service.authorize('wrong', { action: 'publish', path: `live/${KEY}` })).toBe(false);
  });

  it('only lets the relay read', async () => {
    const { service } = setup({ source: 'RTMP' });
    expect(await service.authorize(SECRET, { action: 'read', path: `live/${KEY}` })).toBe(false);
    expect(
      await service.authorize(SECRET, { action: 'read', path: `live/${KEY}`, user: 'relay', password: SECRET })
    ).toBe(true);
    expect(await service.authorize(SECRET, { action: 'playback', user: 'relay', password: SECRET })).toBe(false);
  });

  it('is off when no secret is configured', async () => {
    delete process.env.LIVE_RELAY_SECRET;
    const { service } = setup({ source: 'RTMP' });
    expect(await service.authorize('', { action: 'publish', path: `live/${KEY}` })).toBe(false);
  });
});
