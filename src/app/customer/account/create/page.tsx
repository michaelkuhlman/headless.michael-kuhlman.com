import type { Metadata } from 'next';
import { CreateView } from '@/components/account/EntryForms';

export const metadata: Metadata = { title: 'Create New Customer Account', robots: { index: false, follow: false } };
export default function Page() {
  return (
    <div className="ts-container">
      <CreateView />
    </div>
  );
}
