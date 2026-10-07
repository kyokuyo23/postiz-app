import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * AES-256-GCM credential vault (opt-in, additive).
 *
 * Ciphertext format:  gcm.<keyVersion>.<iv>.<authTag>.<ciphertext>   (base64url parts)
 *
 * - Authenticated encryption: any tampering fails decryption.
 * - AAD binds a ciphertext to its workspace, account and purpose, so a value
 *   copied to another row/workspace cannot be decrypted.
 * - Key versioning enables key rotation: new writes use the current version,
 *   old versions stay decryptable until re-encrypted.
 * - Keys are provided via env and are never derived from JWT_SECRET:
 *     CREDENTIAL_ENCRYPTION_KEYS="v1:<base64 32 bytes>,v2:<base64 32 bytes>"
 *     CREDENTIAL_ENCRYPTION_CURRENT_VERSION="v2"   (optional, defaults to last listed)
 * - Fails closed: missing/invalid keys throw; errors never include secrets.
 */

export interface CredentialAad {
  workspaceId: string;
  accountId: string;
  purpose: string; // e.g. 'access_token' | 'refresh_token'
}

export interface KeyRing {
  current: string;
  keys: Record<string, Buffer>;
}

export class CredentialVaultError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'CredentialVaultError';
  }
}

const PREFIX = 'gcm';
const VERSION_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function parseKeyRing(
  keysEnv: string | undefined = process.env.CREDENTIAL_ENCRYPTION_KEYS,
  currentEnv: string | undefined = process.env
    .CREDENTIAL_ENCRYPTION_CURRENT_VERSION
): KeyRing {
  if (!keysEnv || !keysEnv.trim()) {
    throw new CredentialVaultError('VAULT_KEYS_MISSING');
  }
  const keys: Record<string, Buffer> = {};
  let last = '';
  for (const entry of keysEnv.split(',')) {
    const idx = entry.indexOf(':');
    if (idx < 1) {
      throw new CredentialVaultError('VAULT_KEYS_INVALID');
    }
    const version = entry.slice(0, idx).trim();
    const key = Buffer.from(entry.slice(idx + 1).trim(), 'base64');
    if (!VERSION_RE.test(version) || key.length !== 32 || keys[version]) {
      throw new CredentialVaultError('VAULT_KEYS_INVALID');
    }
    keys[version] = key;
    last = version;
  }
  const current = currentEnv?.trim() || last;
  if (!keys[current]) {
    throw new CredentialVaultError('VAULT_CURRENT_VERSION_UNKNOWN');
  }
  return { current, keys };
}

const b64 = (b: Buffer) => b.toString('base64url');

function aadBuffer(aad: CredentialAad) {
  if (!aad?.workspaceId || !aad?.accountId || !aad?.purpose) {
    throw new CredentialVaultError('VAULT_AAD_INVALID');
  }
  return Buffer.from(
    JSON.stringify(['sf1', aad.workspaceId, aad.accountId, aad.purpose]),
    'utf8'
  );
}

export function isVaultCiphertext(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(`${PREFIX}.`);
}

export function encryptCredential(
  plaintext: string,
  aad: CredentialAad,
  ring: KeyRing = parseKeyRing()
): string {
  const iv = randomBytes(12); // unique 96-bit nonce per encryption
  const cipher = createCipheriv('aes-256-gcm', ring.keys[ring.current], iv);
  cipher.setAAD(aadBuffer(aad));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [PREFIX, ring.current, b64(iv), b64(cipher.getAuthTag()), b64(ct)].join(
    '.'
  );
}

export function decryptCredential(
  token: string,
  aad: CredentialAad,
  ring: KeyRing = parseKeyRing()
): string {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 5 || parts[0] !== PREFIX) {
    throw new CredentialVaultError('VAULT_FORMAT_INVALID');
  }
  const [, version, ivS, tagS, ctS] = parts;
  const key = ring.keys[version];
  if (!key) {
    throw new CredentialVaultError('VAULT_KEY_VERSION_UNKNOWN');
  }
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivS, 'base64url')
    );
    decipher.setAAD(aadBuffer(aad));
    decipher.setAuthTag(Buffer.from(tagS, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ctS, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (e) {
    if (e instanceof CredentialVaultError) throw e;
    // Never leak details (tamper vs wrong AAD vs wrong key are indistinguishable).
    throw new CredentialVaultError('VAULT_DECRYPT_FAILED');
  }
}

export function needsReencryption(token: string, ring: KeyRing): boolean {
  if (!isVaultCiphertext(token)) return true;
  return token.split('.')[1] !== ring.current;
}

/** Re-encrypts under the current key version (key rotation step). */
export function reencryptCredential(
  token: string,
  aad: CredentialAad,
  ring: KeyRing
): string {
  return encryptCredential(decryptCredential(token, aad, ring), aad, ring);
}
