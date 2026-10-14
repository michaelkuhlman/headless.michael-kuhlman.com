'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/client/auth';

/** Order confirmation (the order number comes from the checkout via sessionStorage, like Luma's checkout session). */
export function SuccessView() {
  const router = useRouter();
  const auth = useAuth();
  const [order, setOrder] = useState<{ number: string; email?: string; guest: boolean } | null | undefined>(undefined);

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
        <p>We&apos;ll email you an order confirmation with details and tracking info.</p>
        <Link className="ts-button ts-success__continue" href="/">
          Continue Shopping
        </Link>
      </div>
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
