import { formatMemberSince, initialsOf, validateProfile } from '@/features/profile/profileModel';

describe('validateProfile', () => {
  it('requires a real name and an optional well-formed phone', () => {
    expect(validateProfile({ displayName: 'Satish Kumar', phone: '' })).toEqual({});
    expect(validateProfile({ displayName: 'Satish Kumar', phone: '+91 98765 43210' })).toEqual({});
    expect(validateProfile({ displayName: ' ', phone: '' }).displayName).toBeDefined();
    expect(validateProfile({ displayName: 'S', phone: '' }).displayName).toBeDefined();
    expect(validateProfile({ displayName: 'x'.repeat(101), phone: '' }).displayName).toBeDefined();
    expect(validateProfile({ displayName: 'Satish', phone: 'abc' }).phone).toBeDefined();
  });
});

describe('initialsOf / formatMemberSince', () => {
  it('derives initials from the real name', () => {
    expect(initialsOf('Satish Kumar')).toBe('SK');
    expect(initialsOf('priya')).toBe('P');
    expect(initialsOf(null)).toBe('?');
  });
  it('formats the join month or reports unknown', () => {
    expect(formatMemberSince(null)).toBeNull();
    expect(formatMemberSince(new Date(2024, 9, 15).getTime())).toMatch(/2024/);
  });
});
