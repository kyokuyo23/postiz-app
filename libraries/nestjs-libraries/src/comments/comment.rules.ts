/**
 * Pure comment-automation rule engine (no I/O), shared by backend and
 * orchestrator. Kept dependency-free so it can be unit tested in isolation.
 */

export type MatchType = 'any' | 'all' | 'every';
export type MarkAs = 'PENDING' | 'RESOLVED' | 'IGNORED';

export interface CommentRule {
  id: string;
  matchType: MatchType;
  keywords: string[];
  excludeKeywords: string[];
  replies: string[];
  hide: boolean;
  markAs: MarkAs;
  /** Integration ids this rule applies to; empty = all comment sources */
  integrations: string[];
}

export interface RuleComment {
  id: string;
  integrationId: string;
  authorName: string;
  text: string;
}

export interface RuleDecision {
  ruleId: string;
  reply?: string;
  hide: boolean;
  markAs: MarkAs;
}

export const MAX_REPLY_LENGTH = 500;

export function normalize(text: string): string {
  return (text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-word (or whole-phrase) match, so "harga" does not match "hargai".
 * Keywords that start/end with a non-word character (e.g. "wa.me", "http")
 * are matched as plain substrings on that side.
 */
export function containsKeyword(text: string, keyword: string): boolean {
  const kw = normalize(keyword);
  if (!kw) {
    return false;
  }
  const t = normalize(text);
  const word = /[\p{L}\p{N}]/u;
  const left = word.test(kw[0]) ? '(?:^|[^\\p{L}\\p{N}])' : '';
  const right = word.test(kw[kw.length - 1]) ? '(?:$|[^\\p{L}\\p{N}])' : '';
  return new RegExp(`${left}${escapeRegExp(kw)}${right}`, 'u').test(t);
}

export function ruleMatches(rule: CommentRule, comment: RuleComment): boolean {
  if (
    rule.integrations.length &&
    !rule.integrations.includes(comment.integrationId)
  ) {
    return false;
  }
  if (rule.excludeKeywords.some((k) => containsKeyword(comment.text, k))) {
    return false;
  }
  const keywords = rule.keywords.filter((k) => normalize(k));
  switch (rule.matchType) {
    case 'every':
      return true;
    case 'all':
      return (
        keywords.length > 0 &&
        keywords.every((k) => containsKeyword(comment.text, k))
      );
    case 'any':
    default:
      return keywords.some((k) => containsKeyword(comment.text, k));
  }
}

/** Stable, non-cryptographic hash used to rotate reply variations. */
export function stableIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % length;
}

export function renderReply(template: string, comment: RuleComment): string {
  const name = (comment.authorName || '').replace(/^@/, '');
  return template
    .replace(/\{name\}/gi, name)
    .replace(/\{username\}/gi, name ? `@${name}` : '')
    .trim()
    .slice(0, MAX_REPLY_LENGTH);
}

/**
 * Returns the decision of the first matching rule (rules are evaluated in the
 * given order), or null when no rule matches.
 */
export function decide(
  rules: CommentRule[],
  comment: RuleComment
): RuleDecision | null {
  for (const rule of rules) {
    if (!ruleMatches(rule, comment)) {
      continue;
    }
    const replies = rule.replies.map((r) => r.trim()).filter(Boolean);
    const reply = replies.length
      ? renderReply(replies[stableIndex(comment.id, replies.length)], comment)
      : undefined;
    return {
      ruleId: rule.id,
      reply: reply || undefined,
      hide: rule.hide,
      markAs: rule.markAs,
    };
  }
  return null;
}

export function parseList(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed)
      ? parsed.map((v) => String(v)).filter((v) => v.trim())
      : [];
  } catch {
    return [];
  }
}

export interface TemplatePreset {
  id: string;
  name: string;
  description: string;
  matchType: MatchType;
  keywords: string[];
  excludeKeywords: string[];
  replies: string[];
  hide: boolean;
  markAs: MarkAs;
}

/** Built-in templates, available to every organization. */
export const BUILT_IN_TEMPLATES: TemplatePreset[] = [
  {
    id: 'preset-spam',
    name: 'Filter spam & judi online',
    description:
      'Sembunyikan komentar berisi link mencurigakan atau promosi judi, lalu tandai Ignored.',
    matchType: 'any',
    keywords: ['slot', 'gacor', 'judi', 'togel', 'maxwin', 'wa.me', 'bit.ly', 't.me/'],
    excludeKeywords: [],
    replies: [],
    hide: true,
    markAs: 'IGNORED',
  },
  {
    id: 'preset-price',
    name: 'Tanya harga',
    description: 'Balas otomatis komentar yang menanyakan harga.',
    matchType: 'any',
    keywords: ['harga', 'berapa', 'price', 'pricelist', 'hrg'],
    excludeKeywords: [],
    replies: [
      'Halo {name}, terima kasih sudah bertanya! Info harga lengkap ada di link bio kami ya.',
      'Hai {name}! Untuk harga terbaru silakan cek link di bio, atau kirim pesan ke kami.',
    ],
    hide: false,
    markAs: 'RESOLVED',
  },
  {
    id: 'preset-order',
    name: 'Cara order',
    description: 'Balas pertanyaan cara pemesanan.',
    matchType: 'any',
    keywords: ['order', 'pesan', 'beli', 'cara beli', 'checkout'],
    excludeKeywords: [],
    replies: [
      'Halo {name}! Pemesanan bisa langsung lewat link di bio kami ya. Terima kasih!',
    ],
    hide: false,
    markAs: 'RESOLVED',
  },
  {
    id: 'preset-thanks',
    name: 'Ucapan terima kasih',
    description: 'Balas komentar pujian.',
    matchType: 'any',
    keywords: ['keren', 'mantap', 'bagus', 'suka', 'love', 'nice', 'great'],
    excludeKeywords: ['harga', 'berapa'],
    replies: [
      'Terima kasih banyak {name}! 🙏',
      'Makasih {name}, senang kamu suka!',
    ],
    hide: false,
    markAs: 'RESOLVED',
  },
];
