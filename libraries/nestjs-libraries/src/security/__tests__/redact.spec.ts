import { REDACTED, redactSecrets, redactString } from '../redact';
import { canMutateProviderAccounts } from '../role-policy';

describe('redactSecrets', () => {
  it('redacts sensitive keys deeply', () => {
    const out: any = redactSecrets({
      user: 'a',
      accessToken: 'AAA',
      nested: { refresh_token: 'BBB', client_secret: 'CCC', ok: 1 },
      list: [{ password: 'p' }],
      code_verifier: 'V',
      code: 'C',
    });
    expect(out.user).toBe('a');
    expect(out.accessToken).toBe(REDACTED);
    expect(out.nested.refresh_token).toBe(REDACTED);
    expect(out.nested.client_secret).toBe(REDACTED);
    expect(out.nested.ok).toBe(1);
    expect(out.list[0].password).toBe(REDACTED);
    expect(out.code_verifier).toBe(REDACTED);
    expect(out.code).toBe(REDACTED);
  });

  it('redacts token-shaped values in free text', () => {
    const s = redactString(
      'GET /cb?code=abc123&state=xyz Authorization: Bearer abc.def.ghi eyJhbGciOiJI.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2QT4'
    );
    expect(s).not.toContain('abc123');
    expect(s).not.toContain('xyz');
    expect(s).not.toContain('abc.def.ghi');
    expect(s).not.toContain('eyJhbGciOiJI');
  });

  it('handles cycles and does not mutate input', () => {
    const a: any = { token: 't' };
    a.self = a;
    const out: any = redactSecrets(a);
    expect(a.token).toBe('t');
    expect(out.token).toBe(REDACTED);
    expect(out.self).toBeDefined();
  });
});

describe('canMutateProviderAccounts', () => {
  it('is unchanged (allow) when the flag is unset', () => {
    expect(canMutateProviderAccounts('USER', {})).toBe(true);
  });
  it('restricts to ADMIN/SUPERADMIN when enabled, fails closed otherwise', () => {
    const env = { RESTRICT_PROVIDER_ACCOUNT_MUTATIONS: 'true' };
    expect(canMutateProviderAccounts('ADMIN', env)).toBe(true);
    expect(canMutateProviderAccounts('SUPERADMIN', env)).toBe(true);
    expect(canMutateProviderAccounts('USER', env)).toBe(false);
    expect(canMutateProviderAccounts(undefined, env)).toBe(false);
    expect(canMutateProviderAccounts('weird', env)).toBe(false);
  });
});
