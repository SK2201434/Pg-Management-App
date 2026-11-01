"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Discovery = {
  /** What the user has typed in the hero search box. */
  draft: string;
  setDraft: (v: string) => void;
  /** Property type chosen in the hero search ("" for any). */
  typeDraft: string;
  setTypeDraft: (v: string) => void;
  /** Sharing chosen in the hero search ("" for any, "1"-"5", or "more" for six and above). */
  sharingDraft: string;
  setSharingDraft: (v: string) => void;
  /** The location filter currently applied to the property section. */
  query: string;
  /** The sharing filter currently applied to the property section. */
  sharing: string;
  /** The property type currently applied to the property section ("" for any). */
  type: string;
  applySearch: () => void;
  clearSearch: () => void;
  /** Re-applies a search remembered from an earlier visit to the homepage. */
  restoreSearch: (query: string) => void;
};

const DiscoveryContext = createContext<Discovery | null>(null);

/** Shares the hero search with the property section. */
export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState("");
  const [typeDraft, setTypeDraft] = useState("");
  const [sharingDraft, setSharingDraft] = useState("");
  const [query, setQuery] = useState("");
  const [sharing, setSharing] = useState("");
  const [type, setType] = useState("");

  const applySearch = useCallback(() => {
    setQuery(draft.trim());
    setSharing(sharingDraft);
    setType(typeDraft);
  }, [draft, sharingDraft, typeDraft]);
  const clearSearch = useCallback(() => {
    setDraft("");
    setQuery("");
    setSharingDraft("");
    setSharing("");
    setTypeDraft("");
    setType("");
  }, []);

  const restoreSearch = useCallback((q: string) => {
    setDraft(q);
    setQuery(q);
  }, []);

  const value = useMemo(
    () => ({ draft, setDraft, typeDraft, setTypeDraft, sharingDraft, setSharingDraft, query, sharing, type, applySearch, clearSearch, restoreSearch }),
    [draft, typeDraft, sharingDraft, query, sharing, type, applySearch, clearSearch, restoreSearch],
  );
  return <DiscoveryContext.Provider value={value}>{children}</DiscoveryContext.Provider>;
}

export function useDiscovery(): Discovery {
  const ctx = useContext(DiscoveryContext);
  if (!ctx) throw new Error("useDiscovery must be used inside DiscoveryProvider.");
  return ctx;
}
