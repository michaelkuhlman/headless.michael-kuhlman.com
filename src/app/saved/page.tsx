import type { Metadata } from 'next';
import { SavedView } from '@/components/pages/MiscViews';

export const metadata: Metadata = { title: 'Saved items', robots: { index: false, follow: true } };
export default function Page() {
  return (
    <div className="ts-container">
      <SavedView />
    </div>
  );
}
