import {
  BUILT_IN_TEMPLATES,
  CommentRule,
  containsKeyword,
  decide,
  parseList,
  renderReply,
  ruleMatches,
} from '../comment.rules';

const rule = (over: Partial<CommentRule> = {}): CommentRule => ({
  id: 'r1',
  matchType: 'any',
  keywords: ['harga'],
  excludeKeywords: [],
  replies: ['Halo {name}'],
  hide: false,
  markAs: 'RESOLVED',
  integrations: [],
  ...over,
});

const comment = (text: string, over = {}) => ({
  id: 'c1',
  integrationId: 'i1',
  authorName: 'budi',
  text,
  ...over,
});

describe('comment rules', () => {
  it('matches whole words, case and accent insensitive', () => {
    expect(containsKeyword('Berapa HARGA-nya kak?', 'harga')).toBe(true);
    expect(containsKeyword('aku menghargai', 'harga')).toBe(false);
    expect(containsKeyword('Café', 'cafe')).toBe(true);
    expect(containsKeyword('cek wa.me/628123', 'wa.me')).toBe(true);
    expect(containsKeyword('anything', '   ')).toBe(false);
  });

  it('supports any / all / every', () => {
    expect(ruleMatches(rule(), comment('harga?'))).toBe(true);
    expect(
      ruleMatches(rule({ matchType: 'all', keywords: ['harga', 'ongkir'] }), comment('harga?'))
    ).toBe(false);
    expect(
      ruleMatches(rule({ matchType: 'all', keywords: ['harga', 'ongkir'] }), comment('harga + ongkir'))
    ).toBe(true);
    expect(ruleMatches(rule({ matchType: 'all', keywords: [] }), comment('x'))).toBe(false);
    expect(ruleMatches(rule({ matchType: 'every', keywords: [] }), comment('x'))).toBe(true);
  });

  it('honours exclude keywords and integration scope', () => {
    expect(ruleMatches(rule({ excludeKeywords: ['ongkir'] }), comment('harga ongkir'))).toBe(false);
    expect(ruleMatches(rule({ integrations: ['other'] }), comment('harga'))).toBe(false);
    expect(ruleMatches(rule({ integrations: ['i1'] }), comment('harga'))).toBe(true);
  });

  it('first matching rule wins and replies are rendered', () => {
    const d = decide(
      [rule({ id: 'a', keywords: ['nope'] }), rule({ id: 'b', replies: ['Hi {username}, {name}!'] })],
      comment('harga')
    );
    expect(d).toEqual({ ruleId: 'b', reply: 'Hi @budi, budi!', hide: false, markAs: 'RESOLVED' });
    expect(decide([rule({ keywords: ['zzz'] })], comment('harga'))).toBeNull();
  });

  it('rotates reply variations deterministically and caps length', () => {
    const r = rule({ replies: ['A', 'B', 'C'] });
    const first = decide([r], comment('harga', { id: 'x1' }))!.reply;
    expect(decide([r], comment('harga', { id: 'x1' }))!.reply).toBe(first);
    expect(renderReply('x'.repeat(900), comment('')).length).toBe(500);
  });

  it('a rule without replies only hides/marks', () => {
    expect(decide([rule({ replies: ['  '], hide: true, markAs: 'IGNORED' })], comment('harga'))).toEqual({
      ruleId: 'r1',
      reply: undefined,
      hide: true,
      markAs: 'IGNORED',
    });
  });

  it('parses stored JSON lists defensively', () => {
    expect(parseList('["a"," ",2]')).toEqual(['a', '2']);
    expect(parseList('not json')).toEqual([]);
    expect(parseList(null)).toEqual([]);
  });

  it('built-in spam template catches gambling promos', () => {
    const spam = BUILT_IN_TEMPLATES.find((t) => t.id === 'preset-spam')!;
    const r = rule({ ...spam, id: spam.id });
    expect(ruleMatches(r, comment('slot gacor maxwin hari ini'))).toBe(true);
    expect(ruleMatches(r, comment('produk bagus'))).toBe(false);
  });
});
