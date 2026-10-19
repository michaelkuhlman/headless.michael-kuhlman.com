'use client';

import { useEffect, useRef, useState } from 'react';
import { openerFocus, trapTab } from '@/lib/client/focus';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { useQuickView, closeQuickView } from '@/lib/client/ui';
import dynamic from 'next/dynamic';
import type { Product } from '@/lib/magento/types';

// Gallery + BuyBox load on demand (prefetched once the page is idle), not with every page's first JavaScript.
const loadBody = () => import('./product/QuickViewBody');
const QuickViewBody = dynamic(loadBody, { ssr: false, loading: () => <Skeleton /> });

function Skeleton() {
  return (
    <div className="ts-qv" aria-busy="true">
      <div className="ts-skeleton" style={{ aspectRatio: '4 / 5' }} />
      <div>
        <div className="ts-skeleton" style={{ height: 36, width: '80%', marginBottom: 16 }} />
        <div className="ts-skeleton" style={{ height: 22, width: '40%', marginBottom: 28 }} />
        <div className="ts-skeleton" style={{ height: 80, marginBottom: 28 }} />
        <div className="ts-skeleton" style={{ height: 56, borderRadius: 999 }} />
      </div>
    </div>
  );
}

const cache = new Map<string, Product>();

export function QuickView() {
  const key = useQuickView();
  const path = usePathname();
  const [p, setP] = useState<Product | null>(null);
  const [failed, setFailed] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const prev = useRef<HTMLElement | null>(null);

  useEffect(() => {
    closeQuickView();
  }, [path]);

  // warm the quick view code after the page has loaded, so the first open does not wait for it
  useEffect(() => {
    let idle = 0;
    const warm = () => {
      idle = window.requestIdleCallback ? window.requestIdleCallback(() => void loadBody(), { timeout: 4000 }) : window.setTimeout(() => void loadBody(), 1500);
    };
    if (document.readyState === 'complete') warm();
    else window.addEventListener('load', warm, { once: true });
    return () => {
      window.removeEventListener('load', warm);
      if (idle) (window.cancelIdleCallback ?? window.clearTimeout)(idle);
    };
  }, []);

  useEffect(() => {
    if (!key) {
      setP(null);
      setFailed(false);
      document.documentElement.classList.remove('ts-locked');
      prev.current?.focus?.();
      return;
    }
    prev.current = openerFocus();
    document.documentElement.classList.add('ts-locked');
    const hit = cache.get(key);
    if (hit) setP(hit);
    else {
      setP(null);
      fetch(`/api/product?key=${encodeURIComponent(key)}`)
        .then((r) => r.json())
        .then((j: { product: Product | null }) => {
          if (j.product) {
            cache.set(key, j.product);
            setP(j.product);
          } else setFailed(true);
        })
        .catch(() => setFailed(true));
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeQuickView();
      trapTab(e, panel.current);
    };
    window.addEventListener('keydown', onKey);
    setTimeout(() => panel.current?.focus(), 30);
    return () => window.removeEventListener('keydown', onKey);
  }, [key]);

  if (!key) return null;
  return (
    <div className="ts-modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && closeQuickView()}>
      <div className="ts-modal" role="dialog" aria-modal="true" aria-label={p ? `Quick view: ${p.name}` : 'Quick view'} ref={panel} tabIndex={-1}>
        <button type="button" className="ts-icon-btn" aria-label="Close quick view" onClick={closeQuickView}>
          <Icon name="close" />
        </button>
        {p ? (
          <QuickViewBody p={p} onAdded={closeQuickView} />
        ) : failed ? (
          <p className="ts-msg ts-msg--error">Sorry, this product could not be loaded.</p>
        ) : (
          <Skeleton />
        )}
      </div>
    </div>
  );
}
