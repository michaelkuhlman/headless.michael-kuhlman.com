'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/client/auth';
import { money } from '@/lib/format';
import type { OrderSummaryData } from './placedOrder';

/** Order confirmation (the order number comes from the checkout via sessionStorage, like Luma's checkout session). */
export function SuccessView() {
  const router = useRouter();
  const auth = useAuth();
  const [order, setOrder] = useState<{ number: string; email?: string; guest: boolean; summary?: OrderSummaryData | null } | null | undefined>(undefined);

  useEffect(() => {
    let o = null;
    try {
      o = JSON.parse(sessionStorage.getItem('hl_last_order') ?? 'null');
    } catch {}
    if (!o) router.replace('/checkout/cart/');
    setOrder(o);
  }, [router]);

  if (!order) return <div className="ts-success" aria-busy="true" />;
  return (
    <div className="ts-success">
      <h1>Thank you for your purchase!</h1>
      <div className="ts-success__box">
        <p>
          {auth.loggedIn && !order.guest ? (
            <>
              Your order number is:{' '}
              <Link href={`/sales/order/view/?number=${encodeURIComponent(order.number)}`}>
                <strong>{order.number}</strong>
              </Link>
              .
            </>
          ) : (
            <>
              Your order # is: <strong>{order.number}</strong>.
            </>
          )}
        </p>
        <p>Keep your order number handy: it is all you need to check the order status.</p>
        <Link className="ts-button ts-success__continue" href="/">
          Continue shopping
        </Link>
      </div>
      {order.summary && <PlacedSummary s={order.summary} />}
      <p className="ts-demo-note">
        <strong>Demo store.</strong> This order exists only to show the flow: no email is sent, nothing is charged and nothing ships.
      </p>
      {order.guest && !auth.loggedIn && (
        <p className="ts-success__reg">
          Want to track it later? <Link className="ts-textlink" href="/sales/guest/form/">Find your order</Link> with the order number, email and last name.
        </p>
      )}
    </div>
  );
}

/** What was ordered: same block as the classic store's success page (ShopperUx order-summary.phtml). */
function PlacedSummary({ s }: { s: OrderSummaryData }) {
  return (
    <section className="ts-order-summary" aria-labelledby="ts-order-summary-title">
      <h2 id="ts-order-summary-title" className="ts-order-summary__title">Order summary</h2>
      <ul className="ts-order-summary__items">
        {s.items.map((it, i) => (
          <li className="ts-order-summary__item" key={i}>
            <div className="ts-order-summary__name">
              <strong>{it.name}</strong>
              {it.options.map(([l, v]) => (
                <span className="ts-order-summary__opt" key={l}>
                  {l}: {v}
                </span>
              ))}
              <span className="ts-order-summary__qty">Qty {it.qty}</span>
            </div>
            <span className="ts-order-summary__price">{money(it.total)}</span>
          </li>
        ))}
      </ul>
      <dl className="ts-order-summary__totals">
        <dt>Subtotal</dt>
        <dd>{money(s.subtotal)}</dd>
        {s.discount !== 0 && (
          <>
            <dt>Discount</dt>
            <dd>{money(-Math.abs(s.discount))}</dd>
          </>
        )}
        <dt>Shipping</dt>
        <dd>{s.shipping > 0 ? money(s.shipping) : 'Free'}</dd>
        {s.tax > 0 && (
          <>
            <dt>Tax</dt>
            <dd>{money(s.tax)}</dd>
          </>
        )}
        <dt className="ts-order-summary__grand">Order total</dt>
        <dd className="ts-order-summary__grand">{money(s.grandTotal)}</dd>
      </dl>
      {s.shipTo && (
        <div className="ts-order-summary__ship">
          <h3>Ships to</h3>
          <address>
            {s.shipTo.map((line, i) => (
              <span key={i}>
                {line}
                <br />
              </span>
            ))}
          </address>
          {s.shippingLabel && <p className="ts-order-summary__method">{s.shippingLabel}</p>}
        </div>
      )}
    </section>
  );
}
