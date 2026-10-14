import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchFallback, SearchView } from '@/components/pages/MiscViews';
import { getAttributeLabels } from '@/lib/magento/catalog';

export const metadata: Metadata = { title: 'Search results', robots: { index: false, follow: true } };
export default async function Page() {
  const labels = await getAttributeLabels();
  return (
    <div className="ts-container" style={{ paddingBottom: 20 }}>
      <Suspense fallback={<SearchFallback />}>
        <SearchView labels={labels} />
      </Suspense>
    </div>
  );
}
