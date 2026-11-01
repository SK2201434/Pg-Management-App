"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { CONTINUE_PATH, runEmailAction, type ActionOutcome, type ActionParams } from "@/lib/auth/email-action";
import styles from "./email-action.module.css";

type State = "loading" | ActionOutcome;

const COPY: Record<ActionOutcome, { title: string; body: string }> = {
  success: { title: "Your email has been verified!", body: "Thanks for confirming. You can now continue to HOSTELL and sign in on the app." },
  expired: { title: "This link has expired", body: "Verification links only work for a limited time. Open the HOSTELL app and request a new verification email." },
  invalid: { title: "This link is invalid", body: "The link is incomplete or damaged. Please use the link exactly as it appears in your email, or request a new one in the app." },
  used: { title: "This link can’t be used", body: "It may have already been used, in which case your email is verified already. Otherwise, request a new verification email in the app." },
  unsupported: { title: "This action isn’t supported", body: "This page can only confirm email verification links. Please go back to HOSTELL and try again." },
  failed: { title: "We couldn’t verify your email", body: "Something went wrong on our side or with your connection. Please try again in a moment." },
};

export function EmailAction({ params }: { params: ActionParams }) {
  const [state, setState] = useState<State>("loading");
  const started = useRef(false);

  useEffect(() => {
    // React Strict Mode runs effects twice in development; a verification code is single-use, so run once.
    if (started.current) return;
    started.current = true;
    void runEmailAction(params, async (oobCode) => {
      // Loaded on demand so Firebase stays out of the initial bundle and never runs during server rendering.
      const [{ applyActionCode }, { getFirebaseClientAuth }] = await Promise.all([import("firebase/auth"), import("@/lib/firebase/client")]);
      await applyActionCode(getFirebaseClientAuth(), oobCode);
    }).then(setState);
  }, [params]);

  if (state === "loading") {
    return (
      <section className={styles.card} aria-busy="true">
        <div className={styles.spinner} aria-hidden="true" />
        <h1 className={styles.title}>Verifying your email...</h1>
        <p className={styles.body} role="status">Please wait a moment.</p>
      </section>
    );
  }

  const ok = state === "success";
  const { title, body } = COPY[state];
  return (
    <section className={styles.card}>
      <div className={ok ? styles.iconOk : styles.iconError} aria-hidden="true">
        <Icon name={ok ? "check" : "close"} size={32} />
      </div>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.body} role={ok ? "status" : "alert"}>{body}</p>
      {ok ? (
        <Link href={CONTINUE_PATH} className={styles.cta}>Continue to HOSTELL</Link>
      ) : (
        <Link href={CONTINUE_PATH} className={styles.link}>Return to HOSTELL</Link>
      )}
    </section>
  );
}
