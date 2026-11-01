import type { ReactNode } from "react";

import styles from "./properties.module.css";

function Panel({ title, children, role }: { title: string; children: ReactNode; role: "alert" | "status" }) {
  return (
    <div className={styles.panel} role={role}>
      <h3 className={styles.panelTitle}>{title}</h3>
      <div className={styles.panelBody}>{children}</div>
    </div>
  );
}

type EmptyProps = { query: string; filtered: boolean; onClear: () => void };

export function PropertyEmptyState({ query, filtered, onClear }: EmptyProps) {
  if (!query && !filtered) {
    return (
      <Panel title="No properties to show yet" role="status">
        <p>There are no listings available right now. Please check back soon.</p>
      </Panel>
    );
  }
  return (
    <Panel title={query ? `No properties match “${query}”` : "No properties match your search"} role="status">
      <p>Try another property name, city, state or filter, or clear the search to browse every listing.</p>
      <div className={styles.panelActions}>
        <button type="button" className={styles.buttonSecondary} onClick={onClear}>
          Clear search
        </button>
      </div>
    </Panel>
  );
}

export function PropertyErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Panel title="We couldn’t load properties" role="alert">
      <p>Something went wrong while fetching listings. Check your connection and try again.</p>
      <div className={styles.panelActions}>
        <button type="button" className={styles.buttonPrimary} onClick={onRetry}>
          Try again
        </button>
      </div>
    </Panel>
  );
}
