import type { Metadata } from 'next';
import { LogoutView } from '@/components/account/AccountEdit';

export const metadata: Metadata = { title: 'You are signed out', robots: { index: false, follow: false } };
export default function Page() {
  return (
    <div className="ts-container">
      <LogoutView />
    </div>
  );
}
