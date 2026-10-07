import { createHash } from 'crypto';
import {
  AttemptStore,
  codeChallengeS256,
  consumeAttempt,
  createAttempt,
  generateCodeVerifier,
  generateState,
} from '../oauth-attempt';

class MemStore implements AttemptStore {
  m = new Map<string, string>();
  async set(k: string, v: string) {
    this.m.set(k, v);
  }
  async getdel(k: string) {
    const v = this.m.get(k) ?? null;
    this.m.delete(k);
    return v;
  }
}

const binding = {
  userId: 'u1',
  workspaceId: 'w1',
  provider: 'facebook',
  redirectUri: 'https://app.example/cb',
  scope: ['pages_show_list', 'pages_manage_posts'],
};

describe('OAuth attempt', () => {
  it('state is 256-bit random and unique; verifier is RFC7636 length', () => {
    const s = new Set(Array.from({ length: 200 }, generateState));
    expect(s.size).toBe(200);
    expect(generateState().length).toBeGreaterThanOrEqual(43);
    const v = generateCodeVerifier();
    expect(v.length).toBe(43);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('PKCE S256 matches the RFC 7636 test vector', () => {
    expect(
      codeChallengeS256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')
    ).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('stores only a hash of state, never the raw state or verifier key', async () => {
    const store = new MemStore();
    const { state } = await createAttempt(store, binding);
    const keys = [...store.m.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain(state);
    expect(keys[0]).toContain(createHash('sha256').update(state).digest('hex'));
  });

  it('happy path returns the verifier matching the challenge', async () => {
    const store = new MemStore();
    const a = await createAttempt(store, binding);
    expect(a.codeChallengeMethod).toBe('S256');
    const r = await consumeAttempt(store, a.state, binding);
    expect(r.ok).toBe(true);
    if (r.ok) expect(codeChallengeS256(r.codeVerifier)).toBe(a.codeChallenge);
  });

  it('is single-use (replay rejected)', async () => {
    const store = new MemStore();
    const a = await createAttempt(store, binding);
    expect((await consumeAttempt(store, a.state, binding)).ok).toBe(true);
    expect(await consumeAttempt(store, a.state, binding)).toEqual({
      ok: false,
      reason: 'STATE_INVALID_OR_CONSUMED',
    });
  });

  it('concurrent callbacks: exactly one succeeds', async () => {
    const store = new MemStore();
    const a = await createAttempt(store, binding);
    const results = await Promise.all(
      Array.from({ length: 25 }, () => consumeAttempt(store, a.state, binding))
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it('expires', async () => {
    const store = new MemStore();
    let t = 1_000_000;
    const a = await createAttempt(store, binding, {
      ttlSeconds: 60,
      now: () => t,
    });
    t += 61_000;
    expect(await consumeAttempt(store, a.state, binding, { now: () => t })).toEqual({
      ok: false,
      reason: 'STATE_EXPIRED',
    });
  });

  it.each([
    ['user', { ...binding, userId: 'u2' }],
    ['workspace', { ...binding, workspaceId: 'w2' }],
    ['provider', { ...binding, provider: 'instagram' }],
    ['redirect', { ...binding, redirectUri: 'https://evil.example/cb' }],
    ['scope', { ...binding, scope: ['pages_show_list'] }],
  ])('rejects %s mismatch and burns the attempt', async (_n, other) => {
    const store = new MemStore();
    const a = await createAttempt(store, binding);
    expect(await consumeAttempt(store, a.state, other)).toEqual({
      ok: false,
      reason: 'BINDING_MISMATCH',
    });
    expect((await consumeAttempt(store, a.state, binding)).ok).toBe(false);
  });

  it('scope order does not matter', async () => {
    const store = new MemStore();
    const a = await createAttempt(store, binding);
    const r = await consumeAttempt(store, a.state, {
      ...binding,
      scope: [...binding.scope].reverse(),
    });
    expect(r.ok).toBe(true);
  });

  it('rejects malformed state without touching the store', async () => {
    const store = new MemStore();
    expect((await consumeAttempt(store, 'abc', binding)).ok).toBe(false);
    expect((await consumeAttempt(store, undefined as any, binding)).ok).toBe(false);
  });
});
