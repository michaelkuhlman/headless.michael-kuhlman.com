import type { Metadata } from 'next';
import { OrderHistory } from '@/components/account/AccountOrders';

export const metadata: Metadata = { title: 'My Orders', robots: { index: false, follow: false } };
export default function Page() {
  return (
    <div className="ts-container">
      <OrderHistory />
    </div>
  );
}
