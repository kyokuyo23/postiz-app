/**
 * Decides whether a failed token refresh is worth retrying.
 *
 * A refresh that fails because the platform is briefly unreachable (timeout,
 * dropped connection, rate limit, 5xx) says nothing about the token itself, so
 * the channel must not be disconnected for it. Only an answer from the
 * platform that rejects the token (invalid_grant, 400/401/403, ...) means the
 * user really has to reconnect.
 */

const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
]);

const TRANSIENT_NAMES = new Set(['AbortError', 'TimeoutError', 'FetchError']);

const TRANSIENT_MESSAGE =
  /fetch failed|socket hang up|network ?error|timed? ?out|temporarily unavailable|service unavailable|backend ?error|internal ?error|rate ?limit|too many requests|econnreset|etimedout|eai_again/i;

const PERMANENT_MESSAGE =
  /invalid_grant|invalid_client|unauthorized_client|invalid_token|expired or revoked|revoked|access_denied/i;

const asNumber = (value: unknown) => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

const statusOf = (err: any): number | undefined =>
  asNumber(err?.response?.status) ??
  asNumber(err?.status) ??
  asNumber(err?.statusCode) ??
  // Gaxios (Google) puts the HTTP status in `code` as a string.
  (/^\d{3}$/.test(String(err?.code ?? '')) ? Number(err.code) : undefined);

const textOf = (err: any): string =>
  [
    err?.response?.data?.error,
    err?.response?.data?.error_description,
    err?.response?.data?.message,
    err?.message,
    typeof err === 'string' ? err : '',
  ]
    .filter((x) => typeof x === 'string')
    .join(' ');

export const isTransientRefreshError = (err: unknown): boolean => {
  if (!err) {
    return false;
  }
  const e = err as any;
  const text = textOf(e);

  // An explicit rejection of the token always wins.
  if (PERMANENT_MESSAGE.test(text)) {
    return false;
  }

  const status = statusOf(e);
  if (status !== undefined) {
    return status === 408 || status === 429 || status >= 500;
  }

  const code = String(e?.code ?? e?.cause?.code ?? '');
  if (TRANSIENT_CODES.has(code)) {
    return true;
  }
  if (TRANSIENT_NAMES.has(String(e?.name ?? '')) || TRANSIENT_NAMES.has(String(e?.cause?.name ?? ''))) {
    return true;
  }
  return TRANSIENT_MESSAGE.test(text) || TRANSIENT_MESSAGE.test(String(e?.cause?.message ?? ''));
};

/** Delays between refresh attempts for transient failures (ms). */
export const REFRESH_RETRY_DELAYS = [2000, 6000];
