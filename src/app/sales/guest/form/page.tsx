import type { Metadata } from 'next';
import { GuestOrderView } from '@/components/pages/MiscViews';

export const metadata: Metadata = { title: 'Orders and Returns', robots: { index: false, follow: false } };
export default function Page() {
  return (
    <div className="ts-container">
      <GuestOrderView />
    </div>
  );
}
