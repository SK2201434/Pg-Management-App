"use client";

import { useEffect, useState } from "react";

import { imageCandidates } from "@/lib/listings/format";
import type { PublicProperty } from "@/lib/listings/types";
import styles from "./detail.module.css";

const AUTOPLAY_MS = 4000;
const MAX_TILES = 4;

/** Photo slider: advances by itself, pauses while hovered or focused, and has arrow and dot controls. */
export function PropertyGallery({ property }: { property: Pick<PublicProperty, "name" | "coverUrl" | "photoUrls"> }) {
  const [broken, setBroken] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const photos = imageCandidates(property).filter((u) => !broken.includes(u));
  const count = photos.length;
  const index = Math.min(selected, Math.max(count - 1, 0));
  const current = photos[index];
  const tiles = photos.slice(1, MAX_TILES + 1);

  const go = (to: number) => setSelected((to + count) % count);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => setSelected((index + 1) % count), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [count, index, paused]);

  if (!current) {
    return (
      <div className={styles.noPhoto} role="img" aria-label={`No photos available for ${property.name}`}>
        <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 38V14M6 30h36v8M42 30v-6a6 6 0 0 0-6-6H20v12" />
          <circle cx="12" cy="23" r="3" />
        </svg>
        <p>No photos available for this property yet.</p>
      </div>
    );
  }

  return (
    <div
      className={styles.gallery}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${property.name} photos`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className={tiles.length > 0 ? `${styles.mosaic} ${styles.mosaicTiles}` : styles.mosaic}>
      <div className={styles.stage}>
        <div className={styles.track} style={{ transform: `translateX(-${index * 100}%)` }}>
          {photos.map((url, i) => (
            <div key={url} className={styles.slide} role="group" aria-roledescription="slide" aria-label={`Photo ${i + 1} of ${count}`} aria-hidden={i !== index}>
              {/* Listing photos come from arbitrary https hosts, so next/image's host allowlist doesn't apply. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.stageImage}
                src={url}
                alt={`${property.name}, photo ${i + 1} of ${count}`}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : undefined}
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setBroken((b) => [...b, url])}
              />
            </div>
          ))}
        </div>
        {count > 1 && (
          <>
            <button type="button" className={`${styles.arrow} ${styles.arrowPrev}`} aria-label="Previous photo" onClick={() => go(index - 1)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <button type="button" className={`${styles.arrow} ${styles.arrowNext}`} aria-label="Next photo" onClick={() => go(index + 1)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className={styles.dots}>
              {photos.map((url, i) => (
                <button key={url} type="button" className={styles.dot} aria-label={`Show photo ${i + 1} of ${count}`} aria-current={i === index} onClick={() => go(i)} />
              ))}
            </div>
          </>
        )}
      </div>
      {tiles.length > 0 && (
        <ul className={styles.tiles} aria-label="More photos">
          {tiles.map((url, t) => {
            const i = t + 1;
            return (
              <li key={url} className={styles.tileItem}>
                <button
                  type="button"
                  className={styles.tile}
                  aria-label={`Show photo ${i + 1} of ${count}`}
                  aria-current={i === index}
                  onClick={() => go(i)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken((b) => [...b, url])} />
                  {i === MAX_TILES && count > MAX_TILES + 1 && <span className={styles.tileMore}>+{count - MAX_TILES - 1} more</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </div>
  );
}
