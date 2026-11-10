import { digitsOnly, isValidPhone } from '@/features/auth/phone';
import { ownerRegisterFormSchema } from '@/features/auth/authValidation';

describe('phone', () => {
  it('accepts exactly ten digits', () => {
    expect(isValidPhone('9876543210')).toBe(true);
    for (const bad of ['', '987654321', '98765432101', '98765 43210', '+919876543210', 'abcdefghij', null, undefined]) {
      expect(isValidPhone(bad as string | null | undefined)).toBe(false);
    }
  });

  it('keeps only digits, at most ten, as the user types', () => {
    expect(digitsOnly('98765 43210')).toBe('9876543210');
    expect(digitsOnly('+91 98765-43210')).toBe('9198765432');
    expect(digitsOnly('abc')).toBe('');
  });

  it('makes the phone required on the register form', () => {
    const form = { full_name: 'Rahul Sharma', email: 'r@example.com', password: 'Passw0rd!', confirm_password: 'Passw0rd!', gender: 'male' as const };
    expect(ownerRegisterFormSchema.safeParse({ ...form, phone: '9876543210' }).success).toBe(true);
    expect(ownerRegisterFormSchema.safeParse({ ...form, phone: '' }).success).toBe(false);
    expect(ownerRegisterFormSchema.safeParse({ ...form, phone: '12345' }).success).toBe(false);
    expect(ownerRegisterFormSchema.safeParse(form).success).toBe(false);
  });
});
