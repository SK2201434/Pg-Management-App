/** Seconds before the verification email can be requested again. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Seconds left of the cooldown that started at `lastSentAt`; 0 when resending is allowed. */
export function getResendCooldownRemaining(
  lastSentAt: number | null,
  now: number = Date.now(),
): number {
  if (lastSentAt === null) return 0;
  return Math.max(0, Math.ceil((lastSentAt + RESEND_COOLDOWN_SECONDS * 1000 - now) / 1000));
}
