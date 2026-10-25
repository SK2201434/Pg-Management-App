import { cleanRules, MAX_RULES, parseRules, RULE_MAX, sameRules } from '@/features/properties/houseRulesModel';

describe('house rules', () => {
  it('trims, drops empty lines and keeps the order', () => {
    expect(cleanRules(['  No smoking ', '', '   ', 'Quiet  after   10 PM'])).toEqual(['No smoking', 'Quiet after 10 PM']);
  });
  it('caps the number and length of rules', () => {
    expect(cleanRules(Array.from({ length: 40 }, (_, i) => `r${i}`))).toHaveLength(MAX_RULES);
    expect(cleanRules(['x'.repeat(500)])[0]).toHaveLength(RULE_MAX);
  });
  it('reads a stored value defensively', () => {
    expect(parseRules(['a', 3, ' ', 'b'])).toEqual(['a', 'b']);
    expect(parseRules(undefined)).toEqual([]);
    expect(parseRules('nope')).toEqual([]);
  });
  it('compares lists', () => {
    expect(sameRules(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameRules(['a'], ['a', 'b'])).toBe(false);
    expect(sameRules(['b', 'a'], ['a', 'b'])).toBe(false);
  });
});
