/**
 * Live chat for auto-replies: YouTube liveChatMessages and Facebook live
 * video comments. TikTok has no public API for LIVE comments.
 */
import { LiveApiError } from '@gitroom/nestjs-libraries/live/live.platforms';

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  /** Message from the channel/page itself (never answered). */
  own: boolean;
}

const YT = 'https://www.googleapis.com/youtube/v3';
const FB = 'https://graph.facebook.com/v21.0';

const readJson = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return {};
  }
};

export const youtubeChatId = async (token: string, broadcastId: string) => {
  const res = await fetch(
    `${YT}/liveBroadcasts?part=snippet&id=${encodeURIComponent(broadcastId)}`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) }
  );
  const body = await readJson(res);
  if (!res.ok) throw new LiveApiError(body?.error?.message || `YouTube error ${res.status}`, res.status);
  return (body?.items?.[0]?.snippet?.liveChatId as string) || null;
};

export const youtubeChatMessages = async (token: string, chatId: string, pageToken?: string) => {
  const params = new URLSearchParams({
    liveChatId: chatId,
    part: 'snippet,authorDetails',
    maxResults: '200',
  });
  if (pageToken) params.set('pageToken', pageToken);
  const res = await fetch(`${YT}/liveChat/messages?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  const body = await readJson(res);
  if (!res.ok) throw new LiveApiError(body?.error?.message || `YouTube error ${res.status}`, res.status);
  const messages: ChatMessage[] = (body.items || [])
    .filter((m: any) => m?.snippet?.type === 'textMessageEvent')
    .map((m: any) => ({
      id: m.id,
      authorId: m.authorDetails?.channelId || '',
      authorName: m.authorDetails?.displayName || '',
      text: m.snippet?.textMessageDetails?.messageText || m.snippet?.displayMessage || '',
      own: !!m.authorDetails?.isChatOwner,
    }));
  return {
    messages,
    nextPageToken: body.nextPageToken as string | undefined,
    pollMs: Number(body.pollingIntervalMillis) || 10000,
  };
};

export const youtubeChatSend = async (token: string, chatId: string, text: string) => {
  const res = await fetch(`${YT}/liveChat/messages?part=snippet`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snippet: {
        liveChatId: chatId,
        type: 'textMessageEvent',
        textMessageDetails: { messageText: text.slice(0, 200) },
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await readJson(res);
    throw new LiveApiError(body?.error?.message || `YouTube error ${res.status}`, res.status);
  }
};

/** Comments on a Facebook live video, newest first. */
export const facebookLiveComments = async (pageId: string, token: string, liveId: string) => {
  const params = new URLSearchParams({
    filter: 'stream',
    order: 'reverse_chronological',
    fields: 'id,message,from{id,name}',
    limit: '50',
    access_token: token,
  });
  const res = await fetch(`${FB}/${encodeURIComponent(liveId)}/comments?${params}`, {
    signal: AbortSignal.timeout(15000),
  });
  const body = await readJson(res);
  if (!res.ok || body?.error) {
    throw new LiveApiError(body?.error?.message || `Facebook error ${res.status}`, res.status);
  }
  return (body.data || []).map(
    (c: any): ChatMessage => ({
      id: c.id,
      authorId: c.from?.id || '',
      authorName: c.from?.name || '',
      text: c.message || '',
      own: c.from?.id === pageId,
    })
  ) as ChatMessage[];
};

export const facebookReply = async (token: string, commentId: string, text: string) => {
  const res = await fetch(`${FB}/${encodeURIComponent(commentId)}/comments`, {
    method: 'POST',
    body: new URLSearchParams({ message: text, access_token: token }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await readJson(res);
  if (!res.ok || body?.error) {
    throw new LiveApiError(body?.error?.message || `Facebook error ${res.status}`, res.status);
  }
};

/**
 * Keeps auto-replies from flooding the chat (and from looking like spam to
 * the platforms): one reply per viewer per cooldown, a minimum gap between
 * replies and a cap per live.
 */
export class ChatGuard {
  private lastByAuthor = new Map<string, number>();
  private lastReply = Number.NEGATIVE_INFINITY;
  sent = 0;

  constructor(
    private opts = { authorCooldownMs: 5 * 60_000, gapMs: 20_000, maxPerLive: 60 }
  ) {}

  allow(authorId: string, now = Date.now()) {
    if (this.sent >= this.opts.maxPerLive) return false;
    if (now - this.lastReply < this.opts.gapMs) return false;
    const last = this.lastByAuthor.get(authorId);
    if (last !== undefined && now - last < this.opts.authorCooldownMs) return false;
    return true;
  }

  record(authorId: string, now = Date.now()) {
    this.sent++;
    this.lastReply = now;
    this.lastByAuthor.set(authorId, now);
  }
}
