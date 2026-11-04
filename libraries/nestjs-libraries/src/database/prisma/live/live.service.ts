import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { LiveDestination, LiveSession } from '@prisma/client';
import { ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { randomBytes, timingSafeEqual } from 'crypto';
import dayjs from 'dayjs';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import {
  LiveRepository,
  NewDestination,
} from '@gitroom/nestjs-libraries/database/prisma/live/live.repository';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { RefreshIntegrationService } from '@gitroom/nestjs-libraries/integrations/refresh.integration.service';
import { LiveAuthDto, LiveSessionDto } from '@gitroom/nestjs-libraries/dtos/live/live.dto';
import { localUploadPath } from '@gitroom/nestjs-libraries/affiliate/hyperframes.renderer';
import {
  fileLiveArgs,
  isSafeRtmpUrl,
  probeHasAudio,
  relayArgs,
  startFfmpeg,
} from '@gitroom/nestjs-libraries/live/live.ffmpeg';
import {
  createFacebookLive,
  createYoutubeLive,
  endFacebookLive,
  endYoutubeLive,
  LiveApiError,
} from '@gitroom/nestjs-libraries/live/live.platforms';

type Session = LiveSession & { destinations: LiveDestination[] };

const TICK_MS = 5000;
/** RTMP: how long a dropped stream may reconnect before the live ends. */
const RECONNECT_GRACE_MIN = 3;
/** RTMP: give up when nobody starts streaming this long after the schedule. */
const NO_SHOW_HOURS = 3;
/** VIDEO: give up when the server stays busy this long after the schedule. */
const BUSY_GIVE_UP_MIN = 30;
const MAX_ACTIVE_PER_ORG = 3;
const MAX_RESTARTS = 5;

const secret = () => process.env.LIVE_RELAY_SECRET || '';
const mediamtxApi = () => process.env.LIVE_MEDIAMTX_API || 'http://mediamtx:9997';
const mediamtxRtmp = () => process.env.LIVE_MEDIAMTX_RTMP || 'rtmp://mediamtx:1935';
const maxVideoLives = () => Math.max(1, Number(process.env.LIVE_MAX_VIDEO) || 1);

export const ingestEnabled = () => secret().length >= 16;

/** Public server URL for OBS, e.g. rtmp://api.example.com:1935/live */
export const ingestUrl = () =>
  process.env.LIVE_RTMP_PUBLIC_URL ||
  (process.env.NEXT_PUBLIC_BACKEND_URL
    ? `rtmp://${new URL(process.env.NEXT_PUBLIC_BACKEND_URL).hostname}:1935/live`
    : '');

const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
};

/** TikTok forbids pre-recorded content in LIVE. */
export const looksLikeTiktok = (d: { name?: string; serverUrl?: string }) =>
  /tiktok/i.test(`${d.name || ''} ${d.serverUrl || ''}`);

export const joinRtmp = (server: string, key: string) =>
  `${server.trim().replace(/\/+$/, '')}/${key.trim().replace(/^\/+/, '')}`;

const errorText = (e: unknown) => (e as Error)?.message || String(e);

@Injectable()
export class LiveService {
  private processes = new Map<string, ChildProcess>();
  private exitLogs = new Map<string, string>();
  private restarts = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(
    private _repository: LiveRepository,
    private _integrations: IntegrationService,
    private _refresh: RefreshIntegrationService
  ) {}

  status() {
    return { ingest: ingestEnabled(), ingestUrl: ingestEnabled() ? ingestUrl() : null };
  }

  // ------------------------------------------------------------------ API

  async list(orgId: string) {
    return (await this._repository.list(orgId)).map((s) => this.publicView(s));
  }

  private publicView(s: Session) {
    return {
      ...s,
      streamKey: s.source === 'RTMP' ? s.streamKey : null,
      ingestUrl: s.source === 'RTMP' ? ingestUrl() : null,
      destinations: s.destinations.map(({ rtmpUrl: _hidden, ...d }) => d),
    };
  }

  async create(orgId: string, body: LiveSessionDto) {
    if ((await this._repository.countActive(orgId)) >= MAX_ACTIVE_PER_ORG) {
      throw new BadRequestException(
        `Maksimal ${MAX_ACTIVE_PER_ORG} live aktif/terjadwal sekaligus`
      );
    }
    const scheduledAt = new Date(body.scheduledAt);
    if (dayjs(scheduledAt).isBefore(dayjs().subtract(5, 'minute'))) {
      throw new BadRequestException('Jadwal live sudah lewat');
    }

    if (body.source === 'RTMP' && !ingestEnabled()) {
      throw new BadRequestException(
        'Server live (MediaMTX) belum diaktifkan: set LIVE_RELAY_SECRET di backend.env'
      );
    }
    if (body.source === 'VIDEO') {
      const file = body.mediaPath ? localUploadPath(body.mediaPath) : null;
      if (!file || !existsSync(file)) {
        throw new BadRequestException('Pilih video dari Media Library');
      }
      if (body.loop && !body.durationMinutes) {
        throw new BadRequestException('Isi durasi live untuk video yang diulang (loop)');
      }
      if (body.destinations.some((d) => d.kind === 'custom' && looksLikeTiktok(d))) {
        throw new BadRequestException(
          'TikTok melarang video rekaman di LIVE. Pakai mode live dari OBS/HP untuk TikTok.'
        );
      }
    }

    const destinations: NewDestination[] = [];
    for (const d of body.destinations) {
      if (d.kind === 'custom') {
        if (!d.serverUrl || !d.streamKey) {
          throw new BadRequestException('Isi server URL dan stream key untuk tujuan custom');
        }
        const url = joinRtmp(d.serverUrl, d.streamKey);
        if (!(await isSafeRtmpUrl(url))) {
          throw new BadRequestException('Server URL harus rtmp:// atau rtmps:// ke host publik');
        }
        destinations.push({
          kind: 'custom',
          name: (d.name || 'Custom RTMP').trim().slice(0, 60),
          rtmpUrl: AuthService.fixedEncryption(url),
        });
        continue;
      }
      const integration = d.integrationId
        ? await this._integrations.getIntegrationById(orgId, d.integrationId)
        : null;
      if (
        !integration ||
        integration.deletedAt ||
        integration.disabled ||
        integration.providerIdentifier !== d.kind
      ) {
        throw new BadRequestException(`Channel ${d.kind} tidak ditemukan`);
      }
      if (destinations.some((x) => x.integrationId === integration.id)) {
        continue;
      }
      destinations.push({ kind: d.kind, integrationId: integration.id, name: integration.name });
    }

    const session = await this._repository.create(
      orgId,
      {
        title: body.title.trim(),
        description: body.description?.trim() || null,
        source: body.source,
        streamKey: randomBytes(18).toString('hex'),
        mediaPath: body.source === 'VIDEO' ? body.mediaPath! : null,
        loop: body.source === 'VIDEO' && !!body.loop,
        durationMinutes: body.source === 'VIDEO' ? body.durationMinutes || null : null,
        privacy: body.privacy || 'public',
        scheduledAt,
      },
      destinations
    );

    // YouTube broadcasts are created right away: the live shows up as
    // "upcoming" on the channel, and live-permission problems surface now.
    try {
      for (const d of session.destinations.filter((x) => x.kind === 'youtube')) {
        await this.prepareYoutube(session, d);
      }
    } catch (e) {
      await this.finalize(session, 'ERROR', errorText(e));
      await this._repository.softDelete(session.id);
      throw new BadRequestException(errorText(e));
    }

    this.startWorker();
    return this.publicView((await this._repository.getById(session.id))!);
  }

  async stop(orgId: string, id: string) {
    const session = await this._repository.get(orgId, id);
    if (!session) throw new BadRequestException('Live tidak ditemukan');
    if (['ENDED', 'ERROR'].includes(session.status)) return this.publicView(session);
    await this.finalize(session, 'ENDED', null);
    return this.publicView((await this._repository.getById(id))!);
  }

  async remove(orgId: string, id: string) {
    const session = await this._repository.get(orgId, id);
    if (!session) throw new BadRequestException('Live tidak ditemukan');
    if (!['ENDED', 'ERROR'].includes(session.status)) {
      await this.finalize(session, 'ENDED', null);
    }
    await this._repository.softDelete(id);
    return { ok: true };
  }

  /**
   * MediaMTX HTTP auth hook. Publishing needs the stream key of an active
   * session; reading is only for the relay (internal credentials).
   */
  async authorize(querySecret: string, body: LiveAuthDto) {
    if (!ingestEnabled() || !sameSecret(querySecret || '', secret())) return false;
    if (body.action === 'publish') {
      const m = (body.path || '').match(/^live\/([a-f0-9]{36})$/);
      if (!m) return false;
      const session = await this._repository.byStreamKey(m[1]);
      return !!session && session.source === 'RTMP';
    }
    if (body.action === 'read') {
      return body.user === 'relay' && sameSecret(body.password || '', secret());
    }
    return false;
  }

  // --------------------------------------------------------------- worker

  startWorker() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((e) => Logger.error(`Live worker: ${errorText(e)}`));
    }, TICK_MS);
    this.timer.unref?.();
  }

  stopWorker() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const p of this.processes.values()) p.kill('SIGTERM');
  }

  private async readyPaths(): Promise<Set<string>> {
    if (!ingestEnabled()) return new Set();
    try {
      const res = await fetch(`${mediamtxApi()}/v3/paths/list?itemsPerPage=1000`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return new Set();
      const body = (await res.json()) as { items?: { name: string; ready: boolean }[] };
      return new Set((body.items || []).filter((i) => i.ready).map((i) => i.name));
    } catch {
      return new Set();
    }
  }

  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const sessions = await this._repository.active();
      if (!sessions.length) return;
      const ready = sessions.some((s) => s.source === 'RTMP')
        ? await this.readyPaths()
        : new Set<string>();
      for (const s of sessions) {
        try {
          if (s.source === 'RTMP') await this.tickRtmp(s, ready.has(`live/${s.streamKey}`));
          else await this.tickVideo(s);
        } catch (e) {
          Logger.error(`Live ${s.id}: ${errorText(e)}`);
          await this.finalize(s, 'ERROR', errorText(e));
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  private async tickRtmp(s: Session, ingestReady: boolean) {
    const running = this.processes.has(s.id);
    if (running) return;

    if (ingestReady) {
      const restarts = this.restarts.get(s.id) || 0;
      if (restarts >= MAX_RESTARTS) {
        await this.finalize(
          s,
          'ERROR',
          `Gagal meneruskan stream: ${this.exitLogs.get(s.id) || 'semua tujuan menolak'}`
        );
        return;
      }
      const outputs = await this.prepareTargets(s);
      if (!outputs.length) {
        await this.finalize(s, 'ERROR', 'Tidak ada tujuan live yang siap');
        return;
      }
      const input = `${mediamtxRtmp()}/live/${s.streamKey}?user=relay&pass=${encodeURIComponent(secret())}`;
      this.restarts.set(s.id, restarts + 1);
      this.spawn(s.id, relayArgs(input, outputs));
      await this.markLive(s);
      return;
    }

    if (s.status === 'LIVE') {
      await this._repository.update(s.id, { status: 'RECONNECTING', droppedAt: new Date() });
      return;
    }
    if (
      s.status === 'RECONNECTING' &&
      dayjs().diff(dayjs(s.droppedAt || s.updatedAt), 'minute', true) > RECONNECT_GRACE_MIN
    ) {
      await this.finalize(s, 'ENDED', null);
      return;
    }
    if (s.status === 'SCHEDULED' && dayjs().diff(dayjs(s.scheduledAt), 'hour', true) > NO_SHOW_HOURS) {
      await this.finalize(s, 'ENDED', 'Tidak ada stream masuk dari OBS/HP');
    }
  }

  private async tickVideo(s: Session) {
    if (this.processes.has(s.id)) return;

    if (s.status === 'LIVE' || s.status === 'RECONNECTING') {
      // Process gone: it finished, crashed, or the server restarted.
      const remaining = s.endsAt ? dayjs(s.endsAt).diff(dayjs(), 'second') : 0;
      if (s.loop && remaining > 60 && (this.restarts.get(s.id) || 0) < MAX_RESTARTS) {
        await this.startVideo(s, remaining);
        return;
      }
      const log = this.exitLogs.get(s.id);
      await this.finalize(s, log && !s.loop && !s.endsAt ? 'ERROR' : 'ENDED', log || null);
      return;
    }

    if (dayjs().isBefore(dayjs(s.scheduledAt))) return;
    if (this.runningVideos() >= maxVideoLives()) {
      if (dayjs().diff(dayjs(s.scheduledAt), 'minute', true) > BUSY_GIVE_UP_MIN) {
        await this.finalize(s, 'ERROR', 'Server sedang menjalankan live video lain');
      }
      return;
    }
    const duration = s.durationMinutes ? s.durationMinutes * 60 : undefined;
    await this.startVideo(s, duration);
  }

  private runningVideos() {
    let n = 0;
    for (const id of this.processes.keys()) if (id.startsWith('video:')) n++;
    return n;
  }

  private async startVideo(s: Session, durationSec?: number) {
    const file = s.mediaPath ? localUploadPath(s.mediaPath) : null;
    if (!file || !existsSync(file)) {
      await this.finalize(s, 'ERROR', 'File video tidak ditemukan');
      return;
    }
    const outputs = await this.prepareTargets(s);
    if (!outputs.length) {
      await this.finalize(s, 'ERROR', 'Tidak ada tujuan live yang siap');
      return;
    }
    const hasAudio = await probeHasAudio(file);
    this.restarts.set(s.id, (this.restarts.get(s.id) || 0) + 1);
    this.spawn(
      s.id,
      fileLiveArgs({ file, outputs, loop: s.loop, durationSec, hasAudio }),
      'video:'
    );
    await this.markLive(s, durationSec);
  }

  private spawn(sessionId: string, args: string[], prefix = '') {
    this.exitLogs.delete(sessionId);
    const key = `${prefix}${sessionId}`;
    const child = startFfmpeg(args, (code, log) => {
      this.processes.delete(key);
      if (code !== 0 && log) this.exitLogs.set(sessionId, log.split('\n').slice(-3).join(' ').slice(0, 500));
      Logger.log(`Live ${sessionId}: ffmpeg exited (${code})`);
    });
    this.processes.set(key, child);
  }

  private findProcess(sessionId: string) {
    return this.processes.get(sessionId) || this.processes.get(`video:${sessionId}`);
  }

  private async markLive(s: Session, durationSec?: number) {
    await this._repository.update(s.id, {
      status: 'LIVE',
      startedAt: s.startedAt || new Date(),
      droppedAt: null,
      ...(durationSec && !s.endsAt
        ? { endsAt: dayjs().add(durationSec, 'second').toDate() }
        : {}),
    });
    for (const d of s.destinations) {
      if (d.status === 'READY') {
        await this._repository.updateDestination(d.id, { status: 'LIVE' });
      }
    }
  }

  // ------------------------------------------------------------- targets

  private async freshIntegration(orgId: string, integrationId: string) {
    const integration = await this._integrations.getIntegrationById(orgId, integrationId);
    if (!integration || integration.deletedAt) {
      throw new LiveApiError('Channel sudah dihapus');
    }
    if (
      integration.tokenExpiration &&
      dayjs(integration.tokenExpiration).isBefore(dayjs().add(2, 'minute'))
    ) {
      const refreshed = await this._refresh.refresh(integration);
      if (!refreshed || !refreshed.accessToken) {
        throw new LiveApiError(`Channel ${integration.name} harus di-reconnect`);
      }
      return { ...integration, token: refreshed.accessToken };
    }
    return integration;
  }

  private async prepareYoutube(s: Session, d: LiveDestination) {
    const integration = await this.freshIntegration(s.organizationId, d.integrationId!);
    const target = await createYoutubeLive(integration.token, {
      title: s.title,
      description: s.description,
      startAt: dayjs(s.scheduledAt).isBefore(dayjs()) ? new Date() : s.scheduledAt,
      privacy: s.privacy,
    });
    await this._repository.updateDestination(d.id, {
      externalId: target.externalId,
      watchUrl: target.watchUrl,
      rtmpUrl: AuthService.fixedEncryption(target.rtmpUrl),
      status: 'READY',
      error: null,
    });
    d.externalId = target.externalId;
    d.rtmpUrl = AuthService.fixedEncryption(target.rtmpUrl);
    d.status = 'READY';
  }

  /** RTMP URLs to push to; prepares Facebook (and missing YouTube) lives. */
  private async prepareTargets(s: Session): Promise<string[]> {
    const urls: string[] = [];
    for (const d of s.destinations) {
      if (d.status === 'ERROR' || d.status === 'ENDED') continue;
      try {
        if (d.kind === 'youtube' && !d.rtmpUrl) {
          await this.prepareYoutube(s, d);
        }
        if (d.kind === 'facebook' && !d.rtmpUrl) {
          const integration = await this.freshIntegration(s.organizationId, d.integrationId!);
          const target = await createFacebookLive(integration.internalId, integration.token, {
            title: s.title,
            description: s.description,
          });
          d.rtmpUrl = AuthService.fixedEncryption(target.rtmpUrl);
          d.status = 'READY';
          await this._repository.updateDestination(d.id, {
            externalId: target.externalId,
            watchUrl: target.watchUrl,
            rtmpUrl: d.rtmpUrl,
            status: 'READY',
            error: null,
          });
        }
        if (d.kind === 'custom' && d.status === 'PENDING') {
          d.status = 'READY';
          await this._repository.updateDestination(d.id, { status: 'READY' });
        }
        if (d.rtmpUrl) urls.push(AuthService.fixedDecryption(d.rtmpUrl));
      } catch (e) {
        d.status = 'ERROR';
        await this._repository.updateDestination(d.id, {
          status: 'ERROR',
          error: errorText(e).slice(0, 500),
        });
      }
    }
    return urls;
  }

  /** Stops the process and ends every platform broadcast. */
  private async finalize(s: Session, status: 'ENDED' | 'ERROR', error: string | null) {
    const proc = this.findProcess(s.id);
    if (proc) proc.kill('SIGTERM');
    this.restarts.delete(s.id);
    this.exitLogs.delete(s.id);

    for (const d of s.destinations) {
      if (d.status === 'ENDED') continue;
      try {
        if (d.kind === 'youtube' && d.externalId && d.integrationId) {
          const integration = await this.freshIntegration(s.organizationId, d.integrationId);
          await endYoutubeLive(integration.token, d.externalId, !!s.startedAt);
        }
        if (d.kind === 'facebook' && d.externalId && d.integrationId) {
          const integration = await this.freshIntegration(s.organizationId, d.integrationId);
          await endFacebookLive(integration.token, d.externalId);
        }
      } catch (e) {
        Logger.warn(`Live ${s.id}: could not end ${d.kind}: ${errorText(e)}`);
      }
      await this._repository.updateDestination(d.id, {
        status: d.status === 'ERROR' ? 'ERROR' : 'ENDED',
      });
    }
    await this._repository.update(s.id, {
      status,
      error: error ? error.slice(0, 1000) : null,
      endedAt: new Date(),
    });
  }
}
