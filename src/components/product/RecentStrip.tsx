'use client';

import { useEffect, useState } from 'react';
import { recent } from '@/lib/client/lists';
import { ProductCard } from '../ProductCard';
import type { ProductCard as Card } from '@/lib/magento/types';

/** Records this product as viewed and shows the others (like the classic store's Recently viewed strip). */
export function RecentStrip({ current }: { current?: string }) {
  const keys = recent.use();
  const [items, setItems] = useState<Card[]>([]);
  const others = keys.filter((k) => k !== current).slice(0, 8);
  const sig = others.join(',');

  useEffect(() => {
    if (current) recent.add(current);
  }, [current]);

  useEffect(() => {
    if (!sig) {
      setItems([]);
      return;
    }
    let live = true;
    fetch(`/api/cards?keys=${encodeURIComponent(sig)}`)
      .then((r) => r.json())
      .then((j: { items: Card[] }) => live && setItems(j.items))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [sig]);

  if (!items.length) return null;
  return (
    <section className="ts-strip" aria-labelledby="ts-recent-h">
      <div className="ts-strip__head">
        <div>
          <span className="ts-eyebrow">Picking up where you left off</span>
          <h2 id="ts-recent-h">Recently viewed</h2>
        </div>
        <button type="button" className="ts-strip__clear" onClick={() => recent.clear()}>
          Clear history
        </button>
      </div>
      <ul className={`ts-strip__row${items.length < 4 ? ' ts-strip__row--few' : ''}`}>
        {items.map((p) => (
          <li key={p.uid}>
            <ProductCard p={p} sizes="(max-width: 767px) 44vw, (max-width: 1023px) 31vw, 310px" />
          </li>
        ))}
      </ul>
    </section>
  );
}
