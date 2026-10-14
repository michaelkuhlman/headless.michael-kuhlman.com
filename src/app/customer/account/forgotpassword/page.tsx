import type { Metadata } from 'next';
import { ForgotView } from '@/components/account/EntryForms';

export const metadata: Metadata = { title: 'Forgot Your Password?', robots: { index: false, follow: false } };
export default function Page() {
  return (
    <div className="ts-container">
      <ForgotView />
    </div>
  );
}
