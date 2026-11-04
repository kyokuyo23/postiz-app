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
jest.mock('@gitroom/nestjs-libraries/live/live.platforms', () => {
  const actual = jest.requireActual('@gitroom/nestjs-libraries/live/live.platforms');
  return { ...actual, youtubeLiveCheck: jest.fn(), facebookLiveCheck: jest.fn() };
});

import { LiveService } from '@gitroom/nestjs-libraries/database/prisma/live/live.service';
import { facebookLiveCheck, LiveApiError, youtubeLiveCheck } from '@gitroom/nestjs-libraries/live/live.platforms';

const integrations: Record<string, any> = {
  yt: { id: 'yt', name: 'Latih Ads', providerIdentifier: 'youtube', token: 't', internalId: 'c' },
  fb: { id: 'fb', name: 'Toko', providerIdentifier: 'facebook', token: 't', internalId: 'p' },
};
const service = () =>
  new LiveService(
    {} as any,
    { getIntegrationById: jest.fn(async (_o: string, id: string) => integrations[id]) } as any,
    {} as any,
    {} as any
  );

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.LIVE_RELAY_SECRET;
  process.env.FACEBOOK_LIVE = 'true';
});

describe('live preflight check', () => {
  it('reports the ingest server as not configured', async () => {
    const [ingest] = await service().check('org', []);
    expect(ingest).toMatchObject({ key: 'ingest', status: 'error' });
  });

  it('passes YouTube when the live API answers, explains when it does not', async () => {
    (youtubeLiveCheck as jest.Mock).mockResolvedValueOnce(undefined);
    expect((await service().check('org', ['yt']))[1]).toMatchObject({ status: 'ok' });
    (youtubeLiveCheck as jest.Mock).mockRejectedValueOnce(new LiveApiError('Live belum aktif di channel YouTube ini.'));
    expect((await service().check('org', ['yt']))[1]).toMatchObject({ status: 'error', message: expect.stringContaining('Live belum aktif') });
  });

  it('warns on Pages under 100 followers and fails without publish_video', async () => {
    (facebookLiveCheck as jest.Mock).mockResolvedValueOnce({ followers: 40, hasPublishVideo: true });
    expect((await service().check('org', ['fb']))[1]).toMatchObject({ status: 'warn', message: expect.stringContaining('40') });
    (facebookLiveCheck as jest.Mock).mockResolvedValueOnce({ followers: 500, hasPublishVideo: false });
    expect((await service().check('org', ['fb']))[1]).toMatchObject({ status: 'error', message: expect.stringContaining('reconnect') });
  });

  it('asks to enable FACEBOOK_LIVE first', async () => {
    delete process.env.FACEBOOK_LIVE;
    expect((await service().check('org', ['fb']))[1]).toMatchObject({ status: 'error', message: expect.stringContaining('FACEBOOK_LIVE') });
  });
});
