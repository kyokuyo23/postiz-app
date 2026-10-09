/**
 * Secret redaction for logs, audit events and API-safe payloads.
 * Redacts by key name and by value shape (Bearer/JWT/token query params).
 */
const SENSITIVE_KEY =
  /(token|secret|password|passwd|authorization|cookie|api[-_]?key|private[-_]?key|verifier|code_challenge|^code$|auth(orization)?_?code|client_secret|credential|encryption)/i;

const VALUE_PATTERNS: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]'],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, '[REDACTED_JWT]'],
  [
    /([?&](?:access_token|refresh_token|code|client_secret|code_verifier|state)=)[^&\s]+/gi,
    '$1[REDACTED]',
  ],
];

export const REDACTED = '[REDACTED]';

export function redactString(value: string): string {
  return VALUE_PATTERNS.reduce((s, [re, rep]) => s.replace(re, rep), value);
}

export function redactSecrets<T = unknown>(input: T, maxDepth = 8): T {
  const seen = new WeakSet<object>();
  const walk = (v: any, depth: number): any => {
    if (typeof v === 'string') return redactString(v);
    if (v === null || typeof v !== 'object') return v;
    if (depth >= maxDepth || seen.has(v)) return '[TRUNCATED]';
    seen.add(v);
    if (v instanceof Date) return v;
    if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      out[k] = SENSITIVE_KEY.test(k) ? REDACTED : walk(val, depth + 1);
    }
    return out;
  };
  return walk(input, 0);
}
