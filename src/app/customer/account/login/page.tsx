import type { Metadata } from 'next';
import { LoginView } from '@/components/account/EntryForms';

export const metadata: Metadata = { title: 'Customer Login', robots: { index: false, follow: false } };
export default function Page() {
  return (
    <div className="ts-container">
      <LoginView />
    </div>
  );
}
