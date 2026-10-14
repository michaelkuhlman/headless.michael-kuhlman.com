'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Icon } from '../Icon';
import { lineImage, lineOptions } from '../BagDrawer';
import { Totals } from './CartSummary';
import type { Cart, ShippingMethod } from '@/lib/client/cart';
import { money } from '@/lib/format';

/** Checkout sidebar: totals and a collapsible item list, as on the classic checkout. */
export function OrderSummary({ cart, method }: { cart: Cart; method: ShippingMethod | null }) {
  const [open, setOpen] = useState(false);
  const n = cart.total_quantity;
  return (
    <section className="ts-osum" aria-labelledby="ts-osum-h">
      <h2 id="ts-osum-h">Order summary</h2>
      <Totals
        cart={cart}
        shipping={method ? { label: 'Shipping', note: `${method.carrier_title} - ${method.method_title}`, amount: method.amount.value } : null}
      />
      <div className="ts-osum__toggle-wrap">
        <button type="button" className="ts-osum__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          {n} {n === 1 ? 'item' : 'items'} in your bag
          <Icon name="chevD" />
        </button>
      </div>
      {open && (
        <ul className="ts-osum__items">
          {cart.items.map((it) => {
            const src = lineImage(it);
            const opts = lineOptions(it);
            return (
              <li key={it.uid}>
                <span className="ts-osum__img">{src && <Image src={src} alt="" fill sizes="64px" />}</span>
                <span className="ts-osum__info">
                  <span className="ts-osum__name">{it.product.name}</span>
                  <span className="ts-osum__meta">
                    Qty {it.quantity}
                    {opts.length > 0 && ` - ${opts.join(', ')}`}
                  </span>
                </span>
                <span className="ts-osum__price">{money(it.prices.row_total.value)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
