"use client";

import { useDiscovery } from "@/components/home/discovery-context";
import { normalizeSearchText } from "@/lib/listings/filter";
import type { PublicPropertiesPage } from "@/lib/listings/types";
import { PropertyGrid } from "./property-grid";
import { PropertyGridSkeleton } from "./property-card-skeleton";
import { PropertyEmptyState, PropertyErrorState } from "./property-states";
import { useProperties } from "./use-properties";
import styles from "./properties.module.css";

const MAX_CHIPS = 6;

/** The cities that appear most among the loaded properties, so the chips always reflect real listings. */
function topCities(items: { city: string | null }[]): string[] {
  const counts = new Map<string, number>();
  for (const { city } of items) if (city) counts.set(city, (counts.get(city) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_CHIPS)
    .map(([city]) => city);
}

export function PropertySection({ initialPage }: { initialPage?: PublicPropertiesPage }) {
  const { query, sharing, type, clearSearch, restoreSearch } = useDiscovery();
  const { items, status, hasMore, loadingMore, loadMoreFailed, browseItems, browseStatus, searching, retry, loadMore } = useProperties({
    query,
    sharing,
    type,
    restoreQuery: restoreSearch,
    initialPage,
  });
  const cities = topCities(browseItems);
  const activeCity = normalizeSearchText(query);

  return (
    <section id="explore" className={styles.section} aria-labelledby="explore-heading">
      <div className="container">
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>Explore Properties</p>
          <h2 id="explore-heading" className={styles.sectionTitle}>
            Your next stay starts here.
          </h2>
          <p className={styles.sectionLead}>Browse accommodation listed on HOSTELL, with rent and sharing options at a glance.</p>
        </div>

        {browseStatus === "ready" && cities.length > 1 && (
          <div className={styles.chipBar} role="group" aria-label="Filter by city">
            <button type="button" className={activeCity === "" ? styles.filterChipActive : styles.filterChip} aria-pressed={activeCity === ""} onClick={clearSearch}>
              All
            </button>
            {cities.map((city) => {
              const active = activeCity === normalizeSearchText(city);
              return (
                <button key={city} type="button" className={active ? styles.filterChipActive : styles.filterChip} aria-pressed={active} onClick={() => restoreSearch(city)}>
                  {city}
                </button>
              );
            })}
          </div>
        )}

        {searching && status === "ready" && items.length > 0 && (
          <div className={styles.filterBar} role="status">
            <p>
              Showing {items.length}
              {hasMore ? "+" : ""} {items.length === 1 && !hasMore ? "property" : "properties"} matching{" "}
              {[query && `“${query}”`, type, sharing && (sharing === "more" ? "6 & more sharing" : `${sharing} sharing`)].filter(Boolean).join(" · ")}.
            </p>
            <button type="button" className={styles.linkButton} onClick={clearSearch}>
              Clear search
            </button>
          </div>
        )}

        {status === "loading" && <PropertyGridSkeleton />}
        {status === "error" && <PropertyErrorState onRetry={retry} />}
        {status === "ready" && items.length === 0 && !hasMore && <PropertyEmptyState query={query} filtered={Boolean(sharing || type)} onClear={clearSearch} />}
        {status === "ready" && items.length > 0 && <PropertyGrid properties={items} />}

        {status === "ready" && (items.length > 0 || hasMore) && (
          <div className={styles.more}>
            {loadMoreFailed && (
              <p className={styles.moreError} role="alert">
                Couldn’t load more properties. Please try again.
              </p>
            )}
            {hasMore ? (
              <button type="button" className={styles.buttonSecondary} onClick={loadMore} disabled={loadingMore} aria-busy={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            ) : (
              <p className={styles.end}>You’ve reached the end of the listings.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
