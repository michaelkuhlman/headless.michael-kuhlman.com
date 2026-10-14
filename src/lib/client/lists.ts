'use client';

import { useSyncExternalStore } from 'react';

/*
 * Guest-side lists kept in localStorage: the Saved list (hearts) and Recently viewed. Both store product url_keys;
 * the cards are fetched from /api/cards (cached server-side) when a list is shown.
 */

function makeList(key: string, max: number) {
  const listeners = new Set<() => void>();
  let cache: string[] | null = null;
  const EMPTY: string[] = [];

  const read = (): string[] => {
    if (typeof window === 'undefined') return EMPTY;
    if (cache) return cache;
    try {
      const v = JSON.parse(localStorage.getItem(key) || '[]');
      cache = Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, max) : [];
    } catch {
      cache = [];
    }
    return cache!;
  };
  const write = (list: string[]) => {
    cache = list.slice(0, max);
    try {
      localStorage.setItem(key, JSON.stringify(cache));
    } catch {}
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        cache = null;
        l();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener('storage', onStorage);
    };
  };
  return {
    read,
    use: () => useSyncExternalStore(subscribe, read, () => EMPTY),
    has: (k: string) => read().includes(k),
    add: (k: string) => write([k, ...read().filter((x) => x !== k)]),
    remove: (k: string) => write(read().filter((x) => x !== k)),
    toggle(k: string) {
      const on = read().includes(k);
      if (on) this.remove(k);
      else this.add(k);
      return !on;
    },
    clear: () => write([]),
  };
}

export const saved = makeList('hl_saved', 60);
export const recent = makeList('hl_recent', 12);
export const recentSearches = makeList('hl_searches', 6);
