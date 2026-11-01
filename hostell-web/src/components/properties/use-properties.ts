"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchPropertiesPage, normalizeProperty } from "@/lib/listings/client";
import { mergeUnique } from "@/lib/listings/filter";
import type { PublicPropertiesPage, PublicProperty } from "@/lib/listings/types";

type State = {
  items: PublicProperty[];
  nextCursor: string | null;
  hasMore: boolean;
  status: "loading" | "ready" | "error";
  loadingMore: boolean;
  loadMoreFailed: boolean;
};

const initial: State = { items: [], nextCursor: null, hasMore: false, status: "loading", loadingMore: false, loadMoreFailed: false };

const SNAPSHOT_KEY = "hostell:home-listings";
const SNAPSHOT_MAX_AGE_MS = 30 * 60 * 1000;

type Snapshot = { savedAt: number; query: string; items: PublicProperty[]; nextCursor: string | null; hasMore: boolean };

/** Remembers loaded pages and the search for this tab, so coming back from a detail page restores them. */
function saveSnapshot(s: Omit<Snapshot, "savedAt">) {
  try {
    sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ ...s, savedAt: Date.now() } satisfies Snapshot));
  } catch {
    /* storage unavailable or full: restoring is a convenience only */
  }
}

function readSnapshot(): Snapshot | null {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Snapshot>;
    if (typeof s.savedAt !== "number" || Date.now() - s.savedAt > SNAPSHOT_MAX_AGE_MS) return null;
    if (!Array.isArray(s.items) || s.items.length === 0 || typeof s.query !== "string") return null;
    const items = s.items.flatMap((i) => normalizeProperty(i) ?? []);
    if (items.length === 0) return null;
    const nextCursor = typeof s.nextCursor === "string" ? s.nextCursor : null;
    return { savedAt: s.savedAt, query: s.query, items, nextCursor, hasMore: s.hasMore === true && nextCursor !== null };
  } catch {
    return null;
  }
}

/** The state after loading page one (or restoring the snapshot), or null when the request was aborted. */
async function loadFirstPage(signal: AbortSignal, restore?: (query: string) => void): Promise<State | null> {
  const snap = restore ? readSnapshot() : null;
  if (snap) {
    restore?.(snap.query);
    return { ...initial, status: "ready", items: snap.items, nextCursor: snap.nextCursor, hasMore: snap.hasMore };
  }
  try {
    const page = await fetchPropertiesPage({ signal });
    return { ...initial, status: "ready", items: mergeUnique([], page.items), nextCursor: page.nextCursor, hasMore: page.hasMore };
  } catch {
    return signal.aborted ? null : { ...initial, status: "error" };
  }
}

/**
 * Loads the first page on mount (or starts from `initialPage` when the server already rendered it) and
 * further pages on demand, de-duplicating by property id.
 */
export function useProperties(search: { query: string; sharing: string; type: string; restoreQuery: (query: string) => void; initialPage?: PublicPropertiesPage }) {
  const { query, sharing, type, restoreQuery, initialPage } = search;
  const searching = query !== "" || sharing !== "" || type !== "";
  const [state, setState] = useState<State>(() =>
    initialPage
      ? { ...initial, status: "ready", items: mergeUnique([], initialPage.items), nextCursor: initialPage.nextCursor, hasMore: initialPage.hasMore }
      : initial,
  );
  const lifetime = useRef<AbortController | null>(null);
  const loadingMore = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    // Server-rendered listings are already showing; only a remembered search or scroll position needs restoring.
    if (!initialPage || readSnapshot()) {
      void loadFirstPage(controller.signal, restoreQuery).then((next) => next && setState(next));
    }
    return () => controller.abort();
  }, [restoreQuery, initialPage]);

  const { status, items, nextCursor, hasMore } = state;
  useEffect(() => {
    if (status === "ready") saveSnapshot({ query, items, nextCursor, hasMore });
  }, [status, query, items, nextCursor, hasMore]);

  // Search results come from the backend, so they live apart from the browsing list. A result is tied to
  // the search that produced it (`key`), so a stale one is never shown for a newer search.
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([query, sharing, type, attempt]);
  const [found, setFound] = useState<State & { key: string }>({ ...initial, key: "" });

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    fetchPropertiesPage({ q: query, sharing, type, signal: controller.signal })
      .then((page) => setFound({ ...initial, key, status: "ready", items: mergeUnique([], page.items), nextCursor: page.nextCursor, hasMore: page.hasMore }))
      .catch(() => {
        if (!controller.signal.aborted) setFound({ ...initial, key, status: "error" });
      });
    return () => controller.abort();
  }, [searching, query, sharing, type, key]);

  const active: State = !searching ? state : found.key === key ? found : initial;

  const retry = useCallback(() => {
    if (searching) return setAttempt((n) => n + 1);
    if (!lifetime.current) return;
    setState(initial);
    void loadFirstPage(lifetime.current.signal).then((next) => next && setState(next));
  }, [searching]);

  const loadMore = useCallback(async () => {
    const signal = lifetime.current?.signal;
    if (!signal || loadingMore.current || active.status !== "ready" || !active.hasMore || !active.nextCursor) return;
    loadingMore.current = true;
    const update = (fn: (s: State) => State) => (searching ? setFound((s) => (s.key === key ? { ...fn(s), key } : s)) : setState(fn));
    update((s) => ({ ...s, loadingMore: true, loadMoreFailed: false }));
    try {
      const page = await fetchPropertiesPage({ cursor: active.nextCursor, q: query, sharing, type, signal });
      update((s) => ({ ...s, items: mergeUnique(s.items, page.items), nextCursor: page.nextCursor, hasMore: page.hasMore, loadingMore: false }));
    } catch {
      if (!signal.aborted) update((s) => ({ ...s, loadingMore: false, loadMoreFailed: true }));
    } finally {
      loadingMore.current = false;
    }
  }, [searching, key, query, sharing, type, active.status, active.hasMore, active.nextCursor]);

  return { ...active, browseItems: state.items, browseStatus: state.status, searching, retry, loadMore };
}
