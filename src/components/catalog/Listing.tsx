'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { ProductGrid } from '../ProductCard';
import { money } from '@/lib/format';
import { BRAND_SWATCHES } from '@/lib/site';
import type { Aggregation, ProductCard, ProductListResult } from '@/lib/magento/types';

/*
 * Instant layered navigation: the first page of products is in the static HTML; filters, price and sort fetch
 * /api/listing (cached server-side) and update the URL with history.replaceState, so pages stay static and shareable.
 */

type Sort = 'position' | 'name' | 'price' | 'relevance';
interface Q {
  filters: Record<string, string[]>;
  price: [number, number] | null;
  sort: Sort;
  dir: 'ASC' | 'DESC';
}

const COLOR_HEX: Record<string, string> = { ...BRAND_SWATCHES };


function readUrl(defaultSort: Sort): Q {
  const sp = new URLSearchParams(location.search);
  const filters: Record<string, string[]> = {};
  let price: [number, number] | null = null;
  let sort: Sort = defaultSort;
  let dir: 'ASC' | 'DESC' = defaultSort === 'relevance' ? 'DESC' : 'ASC';
  for (const [k, v] of sp.entries()) {
    if (k === 'q' || k === 'p') continue;
    if (k === 'product_list_order' || k === 'sort') {
      if (['position', 'name', 'price', 'relevance'].includes(v)) sort = v as Sort;
    } else if (k === 'product_list_dir' || k === 'dir') dir = v.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    else if (k === 'price') {
      const m = v.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
      if (m) price = [Number(m[1]), Number(m[2])];
    } else if (/^[a-z0-9_]+$/.test(k)) filters[k] = v.split(',').filter(Boolean);
  }
  return { filters, price, sort, dir };
}

function writeUrl(q: Q, defaultSort: Sort) {
  const sp = new URLSearchParams(location.search);
  for (const k of [...sp.keys()]) if (k !== 'q') sp.delete(k);
  for (const [k, v] of Object.entries(q.filters)) if (v.length) sp.set(k, v.join(','));
  if (q.price) sp.set('price', `${q.price[0]}-${q.price[1]}`);
  if (q.sort !== defaultSort) sp.set('product_list_order', q.sort);
  if (q.dir !== (q.sort === 'relevance' ? 'DESC' : 'ASC')) sp.set('product_list_dir', q.dir.toLowerCase());
  const s = sp.toString();
  history.replaceState(history.state, '', location.pathname + (s ? `?${s}` : ''));
}

function priceBounds(items: ProductCard[]): [number, number] {
  if (!items.length) return [0, 100];
  let lo = Infinity;
  let hi = 0;
  for (const p of items) {
    lo = Math.min(lo, p.price_range.minimum_price.final_price.value);
    hi = Math.max(hi, p.price_range.maximum_price.final_price.value);
  }
  return [Math.floor(lo), Math.ceil(hi)];
}

/** Stable key for a listing query (filter values sorted). */
function sigOf(q: Q): string {
  const f = Object.keys(q.filters)
    .sort()
    .filter((k) => q.filters[k].length)
    .map((k) => `${k}=${[...q.filters[k]].sort().join(',')}`);
  return `${q.sort}|${q.dir}|${q.price ? q.price.join('-') : ''}|${f.join('&')}`;
}

function PriceRange({ bounds, value, onCommit }: { bounds: [number, number]; value: [number, number] | null; onCommit: (v: [number, number] | null) => void }) {
  const [v, setV] = useState<[number, number]>(value ?? bounds);
  useEffect(() => setV(value ?? bounds), [value, bounds]);
  const [lo, hi] = bounds;
  const span = Math.max(1, hi - lo);
  const commit = (n: [number, number]) => {
    clearTimeout(keyT.current);
    onCommit(n[0] <= lo && n[1] >= hi ? null : n);
  };
  // arrow keys: one request after the visitor stops pressing, not one per step
  const keyT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const commitSoon = (n: [number, number]) => {
    clearTimeout(keyT.current);
    keyT.current = setTimeout(() => onCommit(n[0] <= lo && n[1] >= hi ? null : n), 450);
  };
  useEffect(() => () => clearTimeout(keyT.current), []);
  return (
    <div className="ts-range">
      <div className="ts-range__track">
        <div className="ts-range__fill" style={{ left: `${((v[0] - lo) / span) * 100}%`, right: `${100 - ((v[1] - lo) / span) * 100}%` }} />
        <input
          type="range"
          min={lo}
          max={hi}
          step={1}
          value={v[0]}
          aria-label="Minimum price"
          onChange={(e) => setV([Math.min(Number(e.target.value), v[1] - 1), v[1]])}
          onPointerUp={() => commit(v)}
          onKeyUp={() => commitSoon(v)}
        />
        <input
          type="range"
          min={lo}
          max={hi}
          step={1}
          value={v[1]}
          aria-label="Maximum price"
          onChange={(e) => setV([v[0], Math.max(Number(e.target.value), v[0] + 1)])}
          onPointerUp={() => commit(v)}
          onKeyUp={() => commitSoon(v)}
        />
      </div>
      <div className="ts-range__vals">
        <span>{money(v[0]).replace('.00', '')}</span>
        <span>{money(v[1]).replace('.00', '')}</span>
      </div>
    </div>
  );
}

export function Listing({
  initial,
  categoryUid,
  search,
  swatches,
  labels,
}: {
  initial: ProductListResult;
  categoryUid?: string;
  search?: string;
  swatches: Record<string, string>; // option label -> hex (colour filter dots)
  labels: Record<string, string>;
}) {
  const defaultSort: Sort = search ? 'relevance' : 'position';
  const [q, setQ] = useState<Q>({ filters: {}, price: null, sort: defaultSort, dir: defaultSort === 'relevance' ? 'DESC' : 'ASC' });
  const [res, setRes] = useState<ProductListResult>(initial);
  const [loading, setLoading] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const base = useRef(initial);
  const bounds = useMemo(() => priceBounds(initial.items), [initial]);
  const shown = useRef('');
  const reqId = useRef(0);
  Object.assign(COLOR_HEX, swatches);

  useEffect(() => {
    base.current = initial;
    setRes(initial);
    const fromUrl = readUrl(defaultSort);
    // the server-rendered first page is the default query: only a different query needs a fetch
    shown.current = sigOf({ filters: {}, price: null, sort: defaultSort, dir: defaultSort === 'relevance' ? 'DESC' : 'ASC' });
    setQ(fromUrl);
    // groups start closed (like the classic store) unless something in them is picked
    const o: Record<string, boolean> = {};
    initial.aggregations.filter((a) => a.attribute_code !== 'category_uid').forEach((a) => (o[a.attribute_code] = !!fromUrl.filters[a.attribute_code]?.length || (a.attribute_code === 'price' && !!fromUrl.price)));
    setOpen(o);
  }, [initial, defaultSort]);

  useEffect(() => {
    const sig = sigOf(q);
    if (sig === shown.current) return;
    shown.current = sig;
    writeUrl(q, defaultSort);
    const sp = new URLSearchParams();
    if (categoryUid) sp.set('cat', categoryUid);
    if (search) sp.set('q', search);
    sp.set('sort', q.sort);
    sp.set('dir', q.dir);
    if (q.price) sp.set('price', `${q.price[0]}-${q.price[1]}`);
    for (const [k, v] of Object.entries(q.filters)) if (v.length) sp.set(k, [...v].sort().join(','));
    const id = ++reqId.current;
    setLoading(true);
    const ctl = new AbortController();
    fetch(`/api/listing?${sp}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((j: ProductListResult) => {
        if (id === reqId.current && j.items) setRes(j);
      })
      .catch(() => {})
      .finally(() => id === reqId.current && setLoading(false));
    return () => ctl.abort();
  }, [q, categoryUid, search, defaultSort]);

  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.documentElement.classList.toggle('ts-locked', drawer);
    if (!drawer) return;
    // Escape closes; Tab stays inside the drawer (it is a modal dialog) instead of wandering into the page behind
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setDrawer(false);
      const box = drawerRef.current;
      if (e.key !== 'Tab' || !box) return;
      const f = Array.from(box.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select, [tabindex]:not([tabindex="-1"])')).filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || !box.contains(a))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (a === last || !box.contains(a))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  const toggle = useCallback((code: string, value: string) => {
    setQ((s) => {
      const cur = s.filters[code] ?? [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      const filters = { ...s.filters, [code]: next };
      if (!next.length) delete filters[code];
      return { ...s, filters };
    });
  }, []);

  const clearAll = () => setQ((s) => ({ ...s, filters: {}, price: null }));

  const aggs: Aggregation[] = base.current.aggregations.filter((a) => a.attribute_code !== 'category_uid' && a.options.length > 0);
  const curAgg = new Map(res.aggregations.map((a) => [a.attribute_code, a]));
  const activeCount = Object.values(q.filters).reduce((n, v) => n + v.length, 0) + (q.price ? 1 : 0);

  const chips: { label: string; clear: () => void }[] = [];
  for (const [code, vals] of Object.entries(q.filters)) {
    const agg = aggs.find((a) => a.attribute_code === code);
    for (const v of vals) chips.push({ label: `${agg?.label ?? labels[code] ?? code}: ${agg?.options.find((o) => o.value === v)?.label ?? v}`, clear: () => toggle(code, v) });
  }
  if (q.price) chips.push({ label: `Price: ${money(q.price[0])} to ${money(q.price[1])}`, clear: () => setQ((s) => ({ ...s, price: null })) });

  const filters = (
    <>
      {aggs.map((a) => {
        const code = a.attribute_code;
        const isOpen = !!open[code];
        const picked = q.filters[code] ?? [];
        const isPrice = code === 'price';
        const isColor = a.options.some((o) => COLOR_HEX[o.label]);
        const counts = new Map((picked.length ? a : (curAgg.get(code) ?? a)).options.map((o) => [o.value, o.count]));
        const n = isPrice ? (q.price ? 1 : 0) : picked.length;
        return (
          <div className="ts-filter__group" key={code}>
            <button type="button" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [code]: !isOpen }))}>
              {a.label}
              {n > 0 && <span className="ts-filter__badge">{n}</span>}
              <Icon name="chevD" />
            </button>
            {isOpen &&
              (isPrice ? (
                bounds[1] - bounds[0] > 1 && <PriceRange bounds={bounds} value={q.price} onCommit={(v) => setQ((s) => ({ ...s, price: v }))} />
              ) : (
                <ul className="ts-filter__opts">
                  {a.options.map((o) => {
                    const on = picked.includes(o.value);
                    const c = counts.get(o.value) ?? 0;
                    return (
                      <li key={o.value}>
                        <button type="button" className={`ts-filter__opt${on ? ' is-on' : ''}`} aria-pressed={on} disabled={!on && c === 0 && !picked.length} onClick={() => toggle(code, o.value)}>
                          {isColor ? <span className="ts-dot" style={{ background: COLOR_HEX[o.label] ?? '#ccc' }} /> : <input type="checkbox" checked={on} readOnly tabIndex={-1} aria-hidden="true" />}
                          <span>{o.label}</span>
                          <span className="ts-filter__n">{c}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ))}
          </div>
        );
      })}
    </>
  );

  return (
    <div className={`ts-listing${aggs.length ? '' : ' ts-listing--nofilter'}${loading ? ' is-loading' : ''}`}>
      {aggs.length > 0 && (
        <aside className="ts-listing__side" aria-label="Filters">
          <span className="ts-filter__title">Filter by</span>
          {activeCount > 0 && (
            <button type="button" className="ts-filter__clear" onClick={clearAll}>
              Clear all
            </button>
          )}
          {filters}
        </aside>
      )}
      <div className="ts-listing__main">
        <div className="ts-toolbar">
          {aggs.length > 0 && (
            <button type="button" className="ts-filter-pill" onClick={() => setDrawer(true)}>
              <Icon name="filter" /> Filter
              {activeCount > 0 && <span className="ts-filter__badge">{activeCount}</span>}
            </button>
          )}
          <p className="ts-toolbar__amount" aria-live="polite">
            {res.total_count} {res.total_count === 1 ? 'item' : 'items'}
          </p>
          <div className="ts-sorter">
            <label htmlFor="ts-sort">Sort by</label>
            {/* price both ways ("price~desc"), so phones, which hide the direction arrow, can sort high to low too */}
            <select
              id="ts-sort"
              value={q.sort === 'price' ? `price~${q.dir.toLowerCase()}` : q.sort}
              onChange={(e) => {
                const [sort, d] = e.target.value.split('~') as [Sort, string | undefined];
                setQ((s) => ({ ...s, sort, dir: d === 'desc' || (!d && sort === 'relevance') ? 'DESC' : 'ASC' }));
              }}
            >
              {search && <option value="relevance">Relevance</option>}
              {!search && <option value="position">Featured</option>}
              <option value="name">Name</option>
              <option value="price~asc">Price: low to high</option>
              <option value="price~desc">Price: high to low</option>
            </select>
            <button
              type="button"
              className={`ts-sorter__dir${q.dir === 'DESC' ? ' is-desc' : ''}`}
              aria-label={q.dir === 'DESC' ? 'Sorted descending. Switch to ascending' : 'Sorted ascending. Switch to descending'}
              onClick={() => setQ((s) => ({ ...s, dir: s.dir === 'ASC' ? 'DESC' : 'ASC' }))}
            >
              <Icon name="arrowUp" />
            </button>
          </div>
        </div>
        {chips.length > 0 && (
          <div className="ts-active-chips">
            {chips.map((c) => (
              <button key={c.label} type="button" className="ts-chip" onClick={c.clear} aria-label={`Remove filter ${c.label}`}>
                {c.label} <Icon name="close" />
              </button>
            ))}
            <button type="button" className="ts-textlink" onClick={clearAll}>
              Clear all
            </button>
          </div>
        )}
        {res.items.length ? (
          <>
            {/* the cards are h3s: name the grid so the outline runs h1 > h2 > h3 */}
            <h2 className="sr-only">{search ? 'Search results' : 'Products'}</h2>
            <ProductGrid items={res.items} priorityCount={search ? 3 : 0} />
            <p className="ts-listing__end">
              You&rsquo;ve seen all {res.total_count} {res.total_count === 1 ? 'item' : 'items'}
            </p>
          </>
        ) : (
          <div className="ts-listing__empty">
            <p>No products match these filters.</p>
            <button type="button" className="ts-button ts-button--ghost" onClick={clearAll}>
              Clear filters
            </button>
          </div>
        )}
      </div>
      {drawer && (
        <div className="ts-fdrawer" role="dialog" aria-modal="true" aria-label="Filter" ref={drawerRef}>
          <div className="ts-fdrawer__head">
            <h2>Filter</h2>
            <button type="button" className="ts-icon-btn" aria-label="Close filters" onClick={() => setDrawer(false)} autoFocus>
              <Icon name="close" />
            </button>
          </div>
          <div className="ts-fdrawer__body">{filters}</div>
          <div className="ts-fdrawer__foot">
            <button type="button" className="ts-button ts-button--ghost" onClick={clearAll} disabled={!activeCount}>
              Clear all
            </button>
            <button type="button" className="ts-button" onClick={() => setDrawer(false)}>
              Show {res.total_count} {res.total_count === 1 ? 'item' : 'items'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
