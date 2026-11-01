import styles from "./properties.module.css";

export function PropertyCardSkeleton() {
  return (
    <div className={styles.card}>
      <div className={`${styles.media} ${styles.skeleton}`} />
      <div className={styles.body}>
        <div className={`${styles.skeleton} ${styles.skLineWide}`} />
        <div className={`${styles.skeleton} ${styles.skLine}`} />
        <div className={`${styles.skeleton} ${styles.skLineShort}`} />
      </div>
    </div>
  );
}

export function PropertyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className={styles.srOnly}>Loading properties…</span>
      <ul className={styles.grid} aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className={styles.gridItem}>
            <PropertyCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}
