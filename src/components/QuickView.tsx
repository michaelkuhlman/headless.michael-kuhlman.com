'use client';

import { useEffect, useRef, useState } from 'react';
import { openerFocus, trapTab } from '@/lib/client/focus';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { useQuickView, closeQuickView } from '@/lib/client/ui';
import { Gallery, galleryImages } from './product/Gallery';
import { BuyBox } from './product/BuyBox';
import type { Product } from '@/lib/magento/types';

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
          <div className="ts-qv">
            <Gallery images={galleryImages(p.media_gallery, p.name)} name={p.name} compact />
            <BuyBox p={p} compact headingLevel={2} onAdded={closeQuickView} />
          </div>
        ) : failed ? (
          <p className="ts-msg ts-msg--error">Sorry, this product could not be loaded.</p>
        ) : (
          <div className="ts-qv" aria-busy="true">
            <div className="ts-skeleton" style={{ aspectRatio: '4 / 5' }} />
            <div>
              <div className="ts-skeleton" style={{ height: 36, width: '80%', marginBottom: 16 }} />
              <div className="ts-skeleton" style={{ height: 22, width: '40%', marginBottom: 28 }} />
              <div className="ts-skeleton" style={{ height: 80, marginBottom: 28 }} />
              <div className="ts-skeleton" style={{ height: 56, borderRadius: 999 }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
