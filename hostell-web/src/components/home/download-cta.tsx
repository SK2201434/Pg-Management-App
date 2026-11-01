import styles from "./home.module.css";

/** A real download link when a destination is configured; otherwise an honest, non-clickable state. */
export function DownloadCta({ url, label = "Download the app", onDark = false }: { url: string | null; label?: string; onDark?: boolean }) {
  if (!url) {
    return <span className={styles.comingSoon}>App coming soon</span>;
  }
  return (
    <a href={url} className={onDark ? `${styles.primaryCta} ${styles.onDark}` : styles.primaryCta} target="_blank" rel="noopener noreferrer">
      {label}
      <span className={styles.srOnly}> (opens in a new tab)</span>
    </a>
  );
}
