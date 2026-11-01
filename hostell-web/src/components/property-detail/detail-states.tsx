import Link from "next/link";

import styles from "./detail.module.css";

export function DetailMessage({ title, children, retryHref }: { title: string; children: string; retryHref?: string }) {
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.message} role="status">
        <h1 className={styles.messageTitle}>{title}</h1>
        <p>{children}</p>
        <div className={styles.messageActions}>
          {retryHref && (
            <a href={retryHref} className={styles.buttonSecondary}>
              Try again
            </a>
          )}
          <Link href="/#explore" className={styles.buttonPrimary}>
            Explore properties
          </Link>
        </div>
      </div>
    </div>
  );
}

export const InvalidPropertyState = () => (
  <DetailMessage title="That link doesn’t look right">The property address is not valid. Browse properties to find the place you were looking for.</DetailMessage>
);

export const PropertyNotFoundState = () => (
  <DetailMessage title="Property not found">This property may have been removed or is no longer listed. You can keep exploring other places to stay.</DetailMessage>
);

export const PropertyUnavailableState = ({ retryHref }: { retryHref: string }) => (
  <DetailMessage title="We couldn’t load this property" retryHref={retryHref}>
    Listings are temporarily unavailable. Please try again in a moment.
  </DetailMessage>
);

export function PropertyDetailSkeleton() {
  return (
    <div className={`container ${styles.page}`} role="status" aria-live="polite">
      <span className={styles.srOnly}>Loading property…</span>
      <div className={styles.skWrap} aria-hidden="true">
        <div className={`${styles.skeleton} ${styles.skStage}`} />
        <div className={`${styles.skeleton} ${styles.skTitle}`} />
        <div className={`${styles.skeleton} ${styles.skLine}`} />
        <div className={`${styles.skeleton} ${styles.skLineShort}`} />
      </div>
    </div>
  );
}
