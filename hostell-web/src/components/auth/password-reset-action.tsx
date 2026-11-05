"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Icon } from "@/components/icons";
import { CONTINUE_PATH, type ActionParams } from "@/lib/auth/email-action";
import { checkResetLink, PASSWORD_MIN_LENGTH, submitPasswordReset, type PasswordFieldErrors, type ResetLinkProblem } from "@/lib/auth/password-reset";
import styles from "./email-action.module.css";

type Stage = "checking" | "form" | "done" | ResetLinkProblem;

const PROBLEM_COPY: Record<ResetLinkProblem, { title: string; body: string }> = {
  expired: { title: "This link has expired", body: "Password reset links only work for a limited time. Open the HOSTELL app and request a new one." },
  invalid: { title: "This link is invalid", body: "The link is incomplete, damaged or has already been used. Request a new password reset email in the HOSTELL app." },
  failed: { title: "We couldn’t check this link", body: "Something went wrong on our side or with your connection. Please reload this page in a moment." },
};

export function PasswordResetAction({ params }: { params: ActionParams }) {
  const [stage, setStage] = useState<Stage>("checking");
  const started = useRef(false);

  useEffect(() => {
    // React Strict Mode runs effects twice in development; validate the code only once.
    if (started.current) return;
    started.current = true;
    void checkResetLink(params, async (oobCode) => {
      // Loaded on demand so Firebase stays out of the initial bundle and never runs during server rendering.
      const [{ verifyPasswordResetCode }, { getFirebaseClientAuth }] = await Promise.all([import("firebase/auth"), import("@/lib/firebase/client")]);
      await verifyPasswordResetCode(getFirebaseClientAuth(), oobCode);
    }).then((result) => setStage(result.status === "ready" ? "form" : result.status));
  }, [params]);

  if (stage === "checking") {
    return (
      <section className={styles.card} aria-busy="true">
        <div className={styles.spinner} aria-hidden="true" />
        <h1 className={styles.title}>Checking your link...</h1>
        <p className={styles.body} role="status">Please wait a moment.</p>
      </section>
    );
  }

  if (stage === "done") {
    return (
      <section className={styles.card}>
        <div className={styles.iconOk} aria-hidden="true">
          <Icon name="check" size={32} />
        </div>
        <h1 className={styles.title}>Your password has been reset</h1>
        <p className={styles.body} role="status">You can now sign in to HOSTELL with your new password.</p>
        <Link href={CONTINUE_PATH} className={styles.cta}>Continue to HOSTELL</Link>
      </section>
    );
  }

  if (stage !== "form") {
    const { title, body } = PROBLEM_COPY[stage];
    return (
      <section className={styles.card}>
        <div className={styles.iconError} aria-hidden="true">
          <Icon name="close" size={32} />
        </div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.body} role="alert">{body}</p>
        <Link href={CONTINUE_PATH} className={styles.link}>Return to HOSTELL</Link>
      </section>
    );
  }

  return <ResetForm oobCode={params.oobCode ?? ""} onStage={setStage} />;
}

function ResetForm({ oobCode, onStage }: { oobCode: string; onStage: (stage: Stage) => void }) {
  // Passwords live only in this component's state and are cleared once the reset succeeds.
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<PasswordFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setFieldErrors({});
    setFormError(null);

    const result = await submitPasswordReset(oobCode, password, confirm, async (code, newPassword) => {
      const [{ confirmPasswordReset }, { getFirebaseClientAuth }] = await Promise.all([import("firebase/auth"), import("@/lib/firebase/client")]);
      await confirmPasswordReset(getFirebaseClientAuth(), code, newPassword);
    });

    if (result.status === "success") {
      setPassword("");
      setConfirm("");
      onStage("done");
      return;
    }
    if (result.status === "rejected") {
      setFieldErrors(result.fields ?? {});
      setFormError(result.form ?? null);
      submitting.current = false;
      setBusy(false);
      return;
    }
    onStage(result.status);
  }

  const type = show ? "text" : "password";
  return (
    <section className={styles.card}>
      <div className={styles.iconOk} aria-hidden="true">
        <Icon name="lock" size={32} />
      </div>
      <h1 className={styles.title}>Set a new password</h1>
      <p className={styles.body}>Choose a new password for your HOSTELL account.</p>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="new-password" className={styles.label}>New password</label>
          <div className={styles.inputRow}>
            <input
              id="new-password"
              className={styles.input}
              type={type}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? "new-password-error" : "new-password-hint"}
              disabled={busy}
            />
            <button type="button" className={styles.toggle} onClick={() => setShow((v) => !v)} aria-pressed={show} disabled={busy}>
              {show ? "Hide" : "Show"}
            </button>
          </div>
          {fieldErrors.password ? (
            <p id="new-password-error" className={styles.error} role="alert">{fieldErrors.password}</p>
          ) : (
            <p id="new-password-hint" className={styles.hint}>At least {PASSWORD_MIN_LENGTH} characters, with a capital letter and a symbol.</p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="confirm-password" className={styles.label}>Confirm new password</label>
          <input
            id="confirm-password"
            className={styles.input}
            type={type}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={fieldErrors.confirm ? true : undefined}
            aria-describedby={fieldErrors.confirm ? "confirm-password-error" : undefined}
            disabled={busy}
          />
          {fieldErrors.confirm ? <p id="confirm-password-error" className={styles.error} role="alert">{fieldErrors.confirm}</p> : null}
        </div>

        {formError ? <p className={styles.error} role="alert">{formError}</p> : null}

        <button type="submit" className={styles.submit} disabled={busy}>
          {busy ? "Resetting..." : "Reset password"}
        </button>
      </form>
    </section>
  );
}
