/** Pure logic for the password-reset half of the Firebase action handler; Firebase calls are injected so it is testable. */

import type { ActionParams } from "@/lib/auth/email-action";

/** Same policy as the HOSTELL app's registration form (my-app/src/features/auth/authValidation.ts). */
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;

const MAX_CODE_LENGTH = 512;

/** Why a reset link cannot be used at all (the form is never shown). */
export type ResetLinkProblem = "expired" | "invalid" | "failed";

export type ResetCheck = { status: "ready" } | { status: ResetLinkProblem };

export interface PasswordFieldErrors {
  password?: string;
  confirm?: string;
}

/** Result of submitting the new password. `form` errors keep the form open so the user can retry. */
export type ResetSubmitResult =
  | { status: "success" }
  | { status: ResetLinkProblem }
  | { status: "rejected"; fields?: PasswordFieldErrors; form?: string };

function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
}

/** Checks a new password against the registration policy and that the confirmation matches. */
export function validateNewPassword(password: string, confirm: string): PasswordFieldErrors {
  const errors: PasswordFieldErrors = {};
  if (!password) errors.password = "Enter a new password.";
  else if (password.length < PASSWORD_MIN_LENGTH) errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  else if (password.length > PASSWORD_MAX_LENGTH) errors.password = `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  else if (!/[A-Z]/.test(password)) errors.password = "Password must include at least one capital letter.";
  else if (!/[^A-Za-z0-9\s]/.test(password)) errors.password = "Password must include at least one symbol.";

  if (!confirm) errors.confirm = "Please confirm your password.";
  else if (password !== confirm) errors.confirm = "Passwords do not match.";
  return errors;
}

/**
 * Validates the reset code with Firebase before any form is shown. `verify` is Firebase's
 * `verifyPasswordResetCode`; it does not consume the code. Unlike email verification, an
 * `auth/invalid-action-code` here simply means the link is not usable.
 */
export async function checkResetLink(params: ActionParams, verify: (oobCode: string) => Promise<void>): Promise<ResetCheck> {
  const { oobCode } = params;
  if (!oobCode || oobCode.length > MAX_CODE_LENGTH) return { status: "invalid" };
  try {
    await verify(oobCode);
    return { status: "ready" };
  } catch (error) {
    const code = errorCode(error);
    if (code === "auth/expired-action-code") return { status: "expired" };
    if (code === "auth/invalid-action-code") return { status: "invalid" };
    return { status: "failed" };
  }
}

/** Validates the passwords, then calls `confirm(oobCode, password)` (Firebase's `confirmPasswordReset`) once. */
export async function submitPasswordReset(
  oobCode: string,
  password: string,
  confirmPassword: string,
  confirm: (oobCode: string, password: string) => Promise<void>,
): Promise<ResetSubmitResult> {
  const fields = validateNewPassword(password, confirmPassword);
  if (fields.password || fields.confirm) return { status: "rejected", fields };
  try {
    await confirm(oobCode, password);
    return { status: "success" };
  } catch (error) {
    switch (errorCode(error)) {
      case "auth/expired-action-code":
        return { status: "expired" };
      case "auth/invalid-action-code":
        return { status: "invalid" };
      case "auth/weak-password":
        return { status: "rejected", fields: { password: "Choose a stronger password and try again." } };
      case "auth/too-many-requests":
        return { status: "rejected", form: "Too many attempts. Please wait a few minutes and try again." };
      case "auth/network-request-failed":
        return { status: "rejected", form: "We couldn’t reach HOSTELL. Check your connection and try again." };
      default:
        return { status: "rejected", form: "Something went wrong. Please try again in a moment." };
    }
  }
}
