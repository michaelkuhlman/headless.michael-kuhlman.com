import type { Metadata } from 'next';
import { SuccessView } from '@/components/checkout/SuccessView';

export const metadata: Metadata = { title: 'Success Page', robots: { index: false, follow: false } };

export default function SuccessPage() {
  return (
    <div className="ts-container">
      <SuccessView />
    </div>
  );
}
