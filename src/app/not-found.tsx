import { getCmsPage } from '@/lib/magento/catalog';
import { CmsContent } from '@/components/CmsContent';

export const metadata = { title: 'Page not found' };

export default async function NotFound() {
  const page = await getCmsPage('no-route');
  return <div className="ts-container">{page ? <CmsContent html={page.content} /> : <div className="ts-404"><h1>Page not found</h1></div>}</div>;
}
