import { formatMemberSince, initialsOf, validateProfile } from '@/features/profile/profileModel';

describe('validateProfile', () => {
  it('requires a real name and a ten-digit phone', () => {
    expect(validateProfile({ displayName: 'Satish Kumar', phone: '9876543210' })).toEqual({});
    expect(validateProfile({ displayName: ' ', phone: '9876543210' }).displayName).toBeDefined();
    expect(validateProfile({ displayName: 'S', phone: '9876543210' }).displayName).toBeDefined();
    expect(validateProfile({ displayName: 'x'.repeat(101), phone: '9876543210' }).displayName).toBeDefined();
    for (const bad of ['', '12345', '98765432101', '+91 98765 43210', '98765 43210', 'abcdefghij']) {
      expect(validateProfile({ displayName: 'Satish', phone: bad }).phone).toBeDefined();
    }
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
