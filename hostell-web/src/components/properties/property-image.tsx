"use client";

import { useState } from "react";

import { imageCandidates } from "@/lib/listings/format";
import type { PublicProperty } from "@/lib/listings/types";
import styles from "./properties.module.css";

/** Cover photo, falling back through the other photos and finally to a placeholder. */
export function PropertyImage({ property, alt }: { property: PublicProperty; alt: string }) {
  const candidates = imageCandidates(property);
  const [failed, setFailed] = useState(0);
  const src = candidates[failed];

  if (!src) {
    return (
      <div className={styles.placeholder} role="img" aria-label={`No photo available for ${property.name}`}>
        <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 38V14M6 30h36v8M42 30v-6a6 6 0 0 0-6-6H20v12" />
          <circle cx="12" cy="23" r="3" />
        </svg>
      </div>
    );
  }

  return (
    // Listing photos come from arbitrary https hosts, so next/image's host allowlist doesn't apply.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={styles.photo}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed((n) => n + 1)}
    />
  );
}
