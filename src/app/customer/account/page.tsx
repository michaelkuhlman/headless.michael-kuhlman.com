import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Dashboard } from '@/components/account/AccountOrders';

export const metadata: Metadata = { title: 'My Account', robots: { index: false, follow: false } };
export default function Page() {
  return (
    <div className="ts-container">
      <Suspense>
        <Dashboard />
      </Suspense>
    </div>
  );
}
