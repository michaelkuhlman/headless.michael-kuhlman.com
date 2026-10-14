import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OrderView } from '@/components/account/AccountOrders';

export const metadata: Metadata = { title: 'Order', robots: { index: false, follow: false } };
export default function Page() {
  return (
    <div className="ts-container">
      <Suspense>
        <OrderView />
      </Suspense>
    </div>
  );
}
