import { z } from 'zod';

// Mirrors the backend constraints in backend/app/schemas/auth.py.

// Emails are trimmed and lowercased before validation, for registration and login alike, so the
// same address is always submitted the same way. Dots and plus-addressing are left untouched.
const email = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required.')
  .pipe(z.email('Enter a valid email address.'));

export const ownerRegisterSchema = z.object({
  full_name: z
    .string({ error: 'Full name is required.' })
    .min(2, 'Full name must be at least 2 characters.')
    .max(100, 'Full name must be at most 100 characters.'),
  email,
  password: z
    .string({ error: 'Password is required.' })
    .min(6, 'Password must be at least 6 characters.')
    .max(128, 'Password must be at most 128 characters.')
    .regex(/[A-Z]/, 'Password must include at least one capital letter.')
    .regex(/[^A-Za-z0-9\s]/, 'Password must include at least one symbol.'),
});

export const ownerLoginSchema = z.object({
  email,
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.'),
});

export type OwnerRegisterFormValues = z.infer<typeof ownerRegisterSchema>;
export type OwnerLoginFormValues = z.infer<typeof ownerLoginSchema>;

// Optional: the phone number is collected by the form but not sent anywhere yet (Firebase email
// registration has no phone field). When filled in it must look like a phone number.
const phone = z
  .string()
  .trim()
  .refine((value) => value === '' || /^\+?[0-9\s()-]{7,20}$/.test(value), {
    message: 'Enter a valid phone number.',
  });

// Form-only schema: `confirm_password` is validated on the client and never sent to the API.
export const ownerRegisterFormSchema = ownerRegisterSchema
  .extend({
    phone,
    confirm_password: z
      .string({ error: 'Please confirm your password.' })
      .min(1, 'Please confirm your password.'),
  })
  .refine((values) => values.password === values.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match.',
  });

export type OwnerRegisterFormInput = z.infer<typeof ownerRegisterFormSchema>;
