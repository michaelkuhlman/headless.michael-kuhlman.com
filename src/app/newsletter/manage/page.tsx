import type { Metadata } from 'next';
import { Newsletter } from '@/components/account/AccountEdit';

export const metadata: Metadata = { title: 'Newsletter Subscription', robots: { index: false, follow: false } };
export default function Page() {
  return (
    <div className="ts-container">
      <Newsletter />
    </div>
  );
}
