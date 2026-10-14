import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EditInfo } from '@/components/account/AccountEdit';

export const metadata: Metadata = { title: 'Account Information', robots: { index: false, follow: false } };
export default function Page() {
  return (
    <div className="ts-container">
      <Suspense>
        <EditInfo />
      </Suspense>
    </div>
  );
}
