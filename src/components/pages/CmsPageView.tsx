import { CmsContent } from '../CmsContent';
import type { CmsPage } from '@/lib/magento/types';

export function CmsPageView({ page }: { page: CmsPage }) {
  return (
    <div className={`ts-container cms-${page.identifier}`} style={{ paddingBottom: 20 }}>
      <CmsContent html={page.content} />
    </div>
  );
}
