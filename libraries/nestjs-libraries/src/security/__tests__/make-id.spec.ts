import { makeId } from '../../services/make.is';

describe('makeId (CSPRNG)', () => {
  it('keeps the same alphabet and length contract', () => {
    for (const n of [0, 1, 6, 32, 500]) {
      const id = makeId(n);
      expect(id).toHaveLength(n);
      expect(id).toMatch(/^[A-Za-z0-9]*$/);
    }
  });

  it('does not use Math.random', () => {
    const spy = jest.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used');
    });
    expect(() => makeId(32)).not.toThrow();
    spy.mockRestore();
  });

  it('is effectively collision-free and roughly uniform', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => makeId(12)));
    expect(ids.size).toBe(5000);
    const counts: Record<string, number> = {};
    for (const c of makeId(62 * 2000)) counts[c] = (counts[c] || 0) + 1;
    expect(Object.keys(counts)).toHaveLength(62);
    for (const v of Object.values(counts)) {
      expect(v).toBeGreaterThan(2000 * 0.7);
      expect(v).toBeLessThan(2000 * 1.3);
    }
  });
});
