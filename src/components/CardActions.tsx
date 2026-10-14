'use client';

import { useState } from 'react';
import { Icon } from './Icon';
import { saved } from '@/lib/client/lists';
import { addToCart, getCartState } from '@/lib/client/cart';
import { openQuickView, showToast } from '@/lib/client/ui';
import { mediaSrc } from '@/lib/format';
import type { ProductCard } from '@/lib/magento/types';

export function SaveButton({ urlKey, name, className = 'ts-card__save', label = false }: { urlKey: string; name: string; className?: string; label?: boolean }) {
  const list = saved.use();
  const on = list.includes(urlKey);
  const [pop, setPop] = useState(0);
  return (
    <button
      type="button"
      className={`${className}${on ? ' is-on' : ''}${pop ? ' is-pop' : ''}`}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from saved items` : `Save ${name}`}
      onClick={() => {
        const now = saved.toggle(urlKey);
        setPop((n) => n + 1);
        setTimeout(() => setPop(0), 420);
        showToast(now ? 'Saved for later.' : 'Removed from saved items.', now ? '/saved/' : undefined, 'View saved');
      }}
    >
      <Icon name={on ? 'heartFill' : 'heart'} />
      {label && <span>{on ? 'Saved' : 'Save for later'}</span>}
    </button>
  );
}

export function CardTools({ urlKey, name }: { urlKey: string; name: string }) {
  return (
    <div className="ts-card__tools">
      <SaveButton urlKey={urlKey} name={name} />
      <button type="button" className="ts-card__qv" aria-label={`Quick view: ${name}`} onClick={() => openQuickView(urlKey)}>
        <Icon name="eye" />
      </button>
    </div>
  );
}

export function CardAdd({ p }: { p: ProductCard }) {
  const [busy, setBusy] = useState(false);
  const simple = p.__typename === 'SimpleProduct' || p.__typename === 'VirtualProduct';
  const label = simple ? 'Add to bag' : 'Choose options';
  return (
    <button
      type="button"
      className={`ts-card__add${busy ? ' is-busy' : ''}`}
      aria-label={`${label}: ${p.name}`}
      disabled={busy}
      onClick={async () => {
        if (!simple) {
          openQuickView(p.url_key);
          return;
        }
        setBusy(true);
        const ok = await addToCart([{ sku: p.sku, quantity: 1 }], { name: p.name, image: mediaSrc(p.small_image?.url), qty: 1, url_key: p.url_key });
        setBusy(false);
        if (!ok) showToast(getCartState().error ?? 'Could not add to bag.');
      }}
    >
      {busy ? <span className="ts-spinner" /> : <Icon name={simple ? 'bagPlus' : 'plus'} />}
      <span className="ts-card__add-label">{busy ? 'Adding' : label}</span>
    </button>
  );
}
