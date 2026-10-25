import { useSyncExternalStore } from 'react';

// The tenant's property-search state, shared by the top bar (the input) and the discovery screen
// (the results). It is plain UI state: no data lives here, and it is cleared when search closes.
type SearchState = { active: boolean; query: string };

let state: SearchState = { active: false, query: '' };
const listeners = new Set<() => void>();

function set(next: SearchState) {
  state = next;
  listeners.forEach((l) => l());
}

export const openSearch = () => set({ ...state, active: true });
export const closeSearch = () => set({ active: false, query: '' });
export const setSearchQuery = (query: string) => set({ ...state, query });

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const useSearchState = (): SearchState => useSyncExternalStore(subscribe, () => state, () => state);
