/**
 * Official live APIs: YouTube Data API (liveBroadcasts/liveStreams) and the
 * Facebook Graph API (Page live_videos). TikTok has no public live API, so
 * TikTok is a custom RTMP target with the key from TikTok LIVE Studio/Center.
 */

export class LiveApiError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

export interface PreparedTarget {
  externalId: string;
  rtmpUrl: string;
  watchUrl: string | null;
}

const YT = 'https://www.googleapis.com/youtube/v3';
const FB = 'https://graph.facebook.com/v21.0';

const YT_HINTS: Record<string, string> = {
  liveStreamingNotEnabled:
    'Live belum aktif di channel YouTube ini. Aktifkan di YouTube Studio → Go live (verifikasi nomor HP, butuh hingga 24 jam).',
  insufficientLivePermissions:
    'Channel YouTube ini belum punya izin live. Aktifkan di YouTube Studio → Go live.',
  livePermissionBlocked:
    'Fitur live di channel YouTube ini sedang diblokir oleh YouTube.',
};

const json = async (res: Response) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text.slice(0, 300) };
  }
};

const ytError = (body: any, status: number) => {
  const reason = body?.error?.errors?.[0]?.reason as string | undefined;
  return new LiveApiError(
    (reason && YT_HINTS[reason]) ||
      body?.error?.message ||
      `YouTube error ${status}`,
    status
  );
};

const yt = async (token: string, path: string, init: RequestInit = {}) => {
  const res = await fetch(`${YT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  const body = await json(res);
  if (!res.ok) throw ytError(body, res.status);
  return body;
};

export const createYoutubeLive = async (
  token: string,
  o: { title: string; description?: string | null; startAt: Date; privacy: string }
): Promise<PreparedTarget> => {
  const broadcast = await yt(token, '/liveBroadcasts?part=snippet,status,contentDetails', {
    method: 'POST',
    body: JSON.stringify({
      snippet: {
        title: o.title.slice(0, 100),
        description: (o.description || '').slice(0, 5000),
        scheduledStartTime: o.startAt.toISOString(),
      },
      status: {
        privacyStatus: o.privacy === 'unlisted' ? 'unlisted' : 'public',
        selfDeclaredMadeForKids: false,
      },
      contentDetails: {
        enableAutoStart: true,
        enableAutoStop: true,
        latencyPreference: 'normal',
      },
    }),
  });
  const stream = await yt(token, '/liveStreams?part=snippet,cdn,contentDetails', {
    method: 'POST',
    body: JSON.stringify({
      snippet: { title: `${o.title.slice(0, 80)} (Postiz)` },
      cdn: { ingestionType: 'rtmp', resolution: 'variable', frameRate: 'variable' },
      contentDetails: { isReusable: false },
    }),
  });
  await yt(
    token,
    `/liveBroadcasts/bind?part=id,contentDetails&id=${encodeURIComponent(
      broadcast.id
    )}&streamId=${encodeURIComponent(stream.id)}`,
    { method: 'POST' }
  );
  const ingest = stream.cdn?.ingestionInfo;
  if (!ingest?.ingestionAddress || !ingest?.streamName) {
    throw new LiveApiError('YouTube did not return an ingest address');
  }
  return {
    externalId: broadcast.id,
    rtmpUrl: `${ingest.ingestionAddress}/${ingest.streamName}`,
    watchUrl: `https://www.youtube.com/watch?v=${broadcast.id}`,
  };
};

/** Ends a broadcast that went live, deletes one that never started. */
export const endYoutubeLive = async (token: string, broadcastId: string, wentLive: boolean) => {
  const id = encodeURIComponent(broadcastId);
  if (wentLive) {
    try {
      await yt(token, `/liveBroadcasts/transition?part=status&broadcastStatus=complete&id=${id}`, {
        method: 'POST',
      });
      return;
    } catch {
      // auto-stop may already have ended it
      return;
    }
  }
  await fetch(`${YT}/liveBroadcasts?id=${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  }).catch(() => undefined);
};

const fb = async (path: string, params: Record<string, string>) => {
  const res = await fetch(`${FB}${path}`, {
    method: 'POST',
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(20000),
  });
  const body = await json(res);
  if (!res.ok || body?.error) {
    const msg: string = body?.error?.message || `Facebook error ${res.status}`;
    throw new LiveApiError(
      /publish_video|permission/i.test(msg)
        ? `${msg} — tambahkan izin publish_video di Meta app, set FACEBOOK_LIVE=true, lalu reconnect Page ini.`
        : msg,
      res.status
    );
  }
  return body;
};

export const createFacebookLive = async (
  pageId: string,
  pageToken: string,
  o: { title: string; description?: string | null }
): Promise<PreparedTarget> => {
  const live = await fb(`/${encodeURIComponent(pageId)}/live_videos`, {
    status: 'LIVE_NOW',
    title: o.title.slice(0, 250),
    description: o.description || '',
    access_token: pageToken,
  });
  const rtmpUrl: string | undefined = live.secure_stream_url || live.stream_url;
  if (!live.id || !rtmpUrl) {
    throw new LiveApiError('Facebook did not return a stream URL');
  }
  let watchUrl: string | null = null;
  try {
    const res = await fetch(
      `${FB}/${encodeURIComponent(live.id)}?fields=permalink_url&access_token=${encodeURIComponent(pageToken)}`,
      { signal: AbortSignal.timeout(15000) }
    );
    const body = await json(res);
    if (body?.permalink_url) {
      watchUrl = String(body.permalink_url).startsWith('http')
        ? body.permalink_url
        : `https://www.facebook.com${body.permalink_url}`;
    }
  } catch {
    watchUrl = null;
  }
  return { externalId: live.id, rtmpUrl, watchUrl };
};

export const endFacebookLive = async (pageToken: string, liveId: string) => {
  await fb(`/${encodeURIComponent(liveId)}`, {
    end_live_video: 'true',
    access_token: pageToken,
  }).catch(() => undefined);
};
