import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * OAuth authorization-attempt helpers (opt-in, additive).
 *
 * - state: 256-bit CSPRNG, opaque; only its SHA-256 hash is used as storage key.
 * - PKCE: S256 only (RFC 7636); verifier is 43 chars, kept server-side only.
 * - Attempt is bound to user, workspace, provider, redirect URI and scope.
 * - Single-use: consumption is an atomic get-and-delete, so concurrent
 *   callbacks cannot both succeed.
 * - Expiration enforced both by store TTL and an explicit expiresAt check.
 */

export interface AttemptStore {
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Atomic get-and-delete. Must return null if the key is absent. */
  getdel(key: string): Promise<string | null>;
}

export interface AttemptBinding {
  userId: string;
  workspaceId: string;
  provider: string;
  redirectUri: string;
  scope: string[];
}

export type ConsumeFailure =
  | 'STATE_INVALID_OR_CONSUMED'
  | 'STATE_EXPIRED'
  | 'BINDING_MISMATCH';

export type ConsumeResult =
  | { ok: true; codeVerifier: string }
  | { ok: false; reason: ConsumeFailure };

const KEY_PREFIX = 'oauth-attempt:';
export const DEFAULT_ATTEMPT_TTL_SECONDS = 600;

export const generateState = () => randomBytes(32).toString('base64url');
export const generateCodeVerifier = () => randomBytes(32).toString('base64url'); // 43 chars
export const hashState = (state: string) =>
  createHash('sha256').update(state).digest('hex');
export const codeChallengeS256 = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');

const eq = (a: string, b: string) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

const normScope = (s: string[]) => [...new Set(s)].sort().join(',');

export async function createAttempt(
  store: AttemptStore,
  binding: AttemptBinding,
  opts: { ttlSeconds?: number; now?: () => number } = {}
) {
  const ttl = opts.ttlSeconds ?? DEFAULT_ATTEMPT_TTL_SECONDS;
  const now = (opts.now ?? Date.now)();
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  await store.set(
    KEY_PREFIX + hashState(state),
    JSON.stringify({
      b: { ...binding, scope: normScope(binding.scope) },
      v: codeVerifier,
      e: now + ttl * 1000,
    }),
    ttl
  );
  return {
    state,
    codeChallenge: codeChallengeS256(codeVerifier),
    codeChallengeMethod: 'S256' as const,
  };
}

export async function consumeAttempt(
  store: AttemptStore,
  state: string,
  expected: AttemptBinding,
  opts: { now?: () => number } = {}
): Promise<ConsumeResult> {
  if (typeof state !== 'string' || state.length < 32 || state.length > 128) {
    return { ok: false, reason: 'STATE_INVALID_OR_CONSUMED' };
  }
  // Atomic: the first caller gets the value, every other caller gets null.
  const raw = await store.getdel(KEY_PREFIX + hashState(state));
  if (!raw) {
    return { ok: false, reason: 'STATE_INVALID_OR_CONSUMED' };
  }
  let rec: { b: any; v: string; e: number };
  try {
    rec = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'STATE_INVALID_OR_CONSUMED' };
  }
  if ((opts.now ?? Date.now)() > rec.e) {
    return { ok: false, reason: 'STATE_EXPIRED' };
  }
  const b = rec.b;
  const matches =
    eq(b.userId, expected.userId) &&
    eq(b.workspaceId, expected.workspaceId) &&
    eq(b.provider, expected.provider) &&
    eq(b.redirectUri, expected.redirectUri) &&
    eq(b.scope, normScope(expected.scope));
  if (!matches) {
    // Attempt is already burned (consumed above): a mismatch cannot be retried.
    return { ok: false, reason: 'BINDING_MISMATCH' };
  }
  return { ok: true, codeVerifier: rec.v };
}

/** Adapter for ioredis (or the repo's MockRedis, which implements getdel). */
export function redisAttemptStore(redis: {
  set: (...args: any[]) => Promise<any>;
  getdel: (key: string) => Promise<string | null>;
}): AttemptStore {
  return {
    set: async (k, v, ttl) => {
      await redis.set(k, v, 'EX', ttl);
    },
    getdel: (k) => redis.getdel(k),
  };
}
