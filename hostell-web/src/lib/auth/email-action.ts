/** Pure logic for the Firebase email action handler (/auth/action); the Firebase call is injected so it is testable. */

export type ActionOutcome = "success" | "expired" | "invalid" | "used" | "unsupported" | "failed";

export interface ActionParams {
  mode: string | null;
  oobCode: string | null;
}

/** The only destination the "Continue" button may use; never taken from the URL. */
export const CONTINUE_PATH = "/";

const SUPPORTED_MODE = "verifyEmail";
const MAX_CODE_LENGTH = 512;

const first = (value: string | string[] | undefined): string | null => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));

/** Reads only the parameters we use out of the raw query; everything else (apiKey, lang, continueUrl) is ignored. */
export function readActionParams(query: Record<string, string | string[] | undefined>): ActionParams {
  return { mode: first(query.mode), oobCode: first(query.oobCode) };
}

/** True when the link is a Firebase password-reset link, which is handled by `password-reset.ts`. */
export const isPasswordResetMode = (mode: string | null): boolean => mode === "resetPassword";

/** Maps a Firebase Auth error code to a user-facing outcome. Raw codes and messages are never shown. */
export function outcomeForError(error: unknown): ActionOutcome {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code === "auth/expired-action-code") return "expired";
  // Firebase uses this one code for malformed, revoked and already-consumed links.
  if (code === "auth/invalid-action-code") return "used";
  // invalid-api-key, invalid/unauthorized-continue-uri, network errors and anything else are not the user's fault.
  return "failed";
}

/**
 * Validates the parameters and, for a supported mode, calls `apply(oobCode)` exactly once.
 * The code is passed straight through to Firebase, unmodified, and is never logged.
 */
export async function runEmailAction(params: ActionParams, apply: (oobCode: string) => Promise<void>): Promise<ActionOutcome> {
  const { mode, oobCode } = params;
  if (!mode || !oobCode) return "invalid";
  if (mode !== SUPPORTED_MODE) return "unsupported";
  if (oobCode.length > MAX_CODE_LENGTH) return "invalid";
  try {
    await apply(oobCode);
    return "success";
  } catch (error) {
    return outcomeForError(error);
  }
}
