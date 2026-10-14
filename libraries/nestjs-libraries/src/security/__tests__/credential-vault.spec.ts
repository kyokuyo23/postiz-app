import { randomBytes } from 'crypto';
import {
  decryptCredential,
  encryptCredential,
  isVaultCiphertext,
  needsReencryption,
  parseKeyRing,
  reencryptCredential,
} from '../credential-vault';

const k = () => randomBytes(32).toString('base64');
const aad = { workspaceId: 'ws1', accountId: 'acc1', purpose: 'access_token' };

describe('credential vault (AES-256-GCM)', () => {
  const ring = parseKeyRing(`v1:${k()}`);

  it('round-trips and uses a unique nonce per encryption', () => {
    const a = encryptCredential('secret-token', aad, ring);
    const b = encryptCredential('secret-token', aad, ring);
    expect(a).not.toEqual(b);
    expect(isVaultCiphertext(a)).toBe(true);
    expect(a).not.toContain('secret-token');
    expect(decryptCredential(a, aad, ring)).toBe('secret-token');
  });

  it('detects tampering', () => {
    const parts = encryptCredential('x', aad, ring).split('.');
    parts[4] = Buffer.from('tampered').toString('base64url');
    expect(() => decryptCredential(parts.join('.'), aad, ring)).toThrow(
      'VAULT_DECRYPT_FAILED'
    );
  });

  it.each([
    ['workspace', { ...aad, workspaceId: 'ws2' }],
    ['account', { ...aad, accountId: 'acc2' }],
    ['purpose', { ...aad, purpose: 'refresh_token' }],
  ])('rejects a different %s (AAD binding)', (_n, other) => {
    const c = encryptCredential('x', aad, ring);
    expect(() => decryptCredential(c, other, ring)).toThrow(
      'VAULT_DECRYPT_FAILED'
    );
  });

  it('rotates keys: old versions decrypt, new writes use current', () => {
    const k1 = k();
    const k2 = k();
    const oldRing = parseKeyRing(`v1:${k1}`);
    const c1 = encryptCredential('tok', aad, oldRing);
    const newRing = parseKeyRing(`v1:${k1},v2:${k2}`);
    expect(newRing.current).toBe('v2');
    expect(decryptCredential(c1, aad, newRing)).toBe('tok');
    expect(needsReencryption(c1, newRing)).toBe(true);
    const c2 = reencryptCredential(c1, aad, newRing);
    expect(c2.split('.')[1]).toBe('v2');
    expect(needsReencryption(c2, newRing)).toBe(false);
    expect(decryptCredential(c2, aad, newRing)).toBe('tok');
    expect(() => decryptCredential(c2, aad, oldRing)).toThrow(
      'VAULT_KEY_VERSION_UNKNOWN'
    );
  });

  it('fails closed on missing/invalid configuration', () => {
    expect(() => parseKeyRing(undefined)).toThrow('VAULT_KEYS_MISSING');
    expect(() => parseKeyRing('v1:AAAA')).toThrow('VAULT_KEYS_INVALID');
    expect(() => parseKeyRing(`v1:${k()},v1:${k()}`)).toThrow(
      'VAULT_KEYS_INVALID'
    );
    expect(() => parseKeyRing(`v1:${k()}`, 'v9')).toThrow(
      'VAULT_CURRENT_VERSION_UNKNOWN'
    );
    expect(() =>
      encryptCredential('x', { workspaceId: '', accountId: 'a', purpose: 'p' }, ring)
    ).toThrow('VAULT_AAD_INVALID');
  });

  it('errors never contain plaintext', () => {
    const c = encryptCredential('super-secret-value', aad, ring);
    try {
      decryptCredential(c, { ...aad, accountId: 'zzz' }, ring);
    } catch (e: any) {
      expect(String(e.message)).not.toContain('super-secret-value');
    }
  });
});
