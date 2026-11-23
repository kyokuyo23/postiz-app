import { isTransientRefreshError } from '@gitroom/nestjs-libraries/integrations/refresh.errors';

const gaxios = (status: number, error?: string) =>
  Object.assign(new Error(error || `Request failed with status code ${status}`), {
    code: String(status),
    response: { status, data: error ? { error } : {} },
  });

describe('isTransientRefreshError', () => {
  it('treats a revoked or expired Google token as permanent', () => {
    expect(isTransientRefreshError(gaxios(400, 'invalid_grant'))).toBe(false);
    expect(
      isTransientRefreshError(new Error('invalid_grant: Token has been expired or revoked.'))
    ).toBe(false);
  });

  it('treats other 4xx answers as permanent', () => {
    expect(isTransientRefreshError(gaxios(400))).toBe(false);
    expect(isTransientRefreshError(gaxios(401))).toBe(false);
    expect(isTransientRefreshError(gaxios(403))).toBe(false);
  });

  it('retries server errors, rate limits and timeouts from the platform', () => {
    expect(isTransientRefreshError(gaxios(500))).toBe(true);
    expect(isTransientRefreshError(gaxios(503))).toBe(true);
    expect(isTransientRefreshError(gaxios(429))).toBe(true);
    expect(isTransientRefreshError(gaxios(408))).toBe(true);
  });

  it('a permanent message wins over a 5xx status', () => {
    expect(isTransientRefreshError(gaxios(500, 'invalid_grant'))).toBe(false);
  });

  it('retries network failures', () => {
    expect(isTransientRefreshError(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }))).toBe(true);
    expect(isTransientRefreshError(Object.assign(new Error('getaddrinfo EAI_AGAIN'), { code: 'EAI_AGAIN' }))).toBe(true);
    expect(
      isTransientRefreshError(
        Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } })
      )
    ).toBe(true);
    expect(isTransientRefreshError(Object.assign(new Error('aborted'), { name: 'TimeoutError' }))).toBe(true);
  });

  it('does not retry unknown errors or nothing at all', () => {
    expect(isTransientRefreshError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isTransientRefreshError(undefined)).toBe(false);
  });
});
