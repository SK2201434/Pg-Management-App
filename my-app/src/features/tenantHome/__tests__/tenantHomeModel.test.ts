import { firstNameOf, formatJoined, greetingFor } from '@/features/tenantHome/tenantHomeModel';

describe('tenant home model', () => {
  it('greets by local hour', () => {
    expect(greetingFor(6)).toBe('Good morning');
    expect(greetingFor(12)).toBe('Good afternoon');
    expect(greetingFor(17)).toBe('Good evening');
  });
  it('takes the first name or reports none', () => {
    expect(firstNameOf('  Satish Kumar ')).toBe('Satish');
    expect(firstNameOf('')).toBeNull();
    expect(firstNameOf(null)).toBeNull();
  });
  it('formats the join date or reports unknown', () => {
    expect(formatJoined(null)).toBeNull();
    expect(formatJoined(new Date(2024, 9, 15).getTime())).toMatch(/2024/);
  });
});
