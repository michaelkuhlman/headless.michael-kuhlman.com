import type { Metadata } from 'next';
import { getCmsPage } from '@/lib/magento/catalog';
import { CmsContent } from '@/components/CmsContent';
import { RecentStrip } from '@/components/product/RecentStrip';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage('home');
  return {
    title: { absolute: page?.meta_title || 'Third Shot Supply Co. | Gear for the patient player' },
    description: page?.meta_description || undefined,
    alternates: { canonical: '/' },
  };
}

export default async function Home() {
  const page = await getCmsPage('home');
  return (
    <div className="ts-container cms-home">
      {page && <CmsContent html={page.content} />}
      <RecentStrip />
    </div>
  );
}
