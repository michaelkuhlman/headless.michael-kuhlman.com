import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { getAllProductKeys, getCategories, getCategory, getCmsPage, getProduct, resolveRoute } from '@/lib/magento/catalog';
import { CategoryPage } from '@/components/pages/CategoryPage';
import { ProductPage } from '@/components/pages/ProductPage';
import { CmsPageView } from '@/components/pages/CmsPageView';
import { mediaSrc, stripTags } from '@/lib/format';

/*
 * One catch-all for every Magento URL (product .html, category .html, CMS identifiers), resolved through the GraphQL
 * `route` query, so the headless store keeps exactly the same URLs as the classic one. All of them are prerendered.
 */

type Props = { params: Promise<{ slug: string[] }> };

const CMS_PAGES = ['about', 'faq', 'shipping-returns', 'privacy-policy-cookie-restriction-mode'];

export async function generateStaticParams() {
  const [keys, cats] = await Promise.all([getAllProductKeys(), getCategories()]);
  return [
    ...keys.map((k) => ({ slug: [`${k}.html`] })),
    ...cats.map((c) => ({ slug: `${c.url_path}.html`.split('/') })),
    ...CMS_PAGES.map((id) => ({ slug: [id] })),
  ];
}

async function resolve(slug: string[]) {
  const url = slug.map(decodeURIComponent).join('/');
  if (!/^[a-z0-9\-_./]{1,200}$/i.test(url)) return null;
  const r = await resolveRoute(url);
  if (!r) return null;
  if (r.kind === 'product') {
    const p = await getProduct(r.urlKey);
    return p ? ({ kind: 'product', p } as const) : null;
  }
  if (r.kind === 'category') {
    const c = await getCategory(r.urlPath);
    return c ? ({ kind: 'category', c } as const) : null;
  }
  if (r.kind === 'cms') {
    if (r.identifier === 'home') return { kind: 'redirect', to: '/', code: 301 } as const;
    const page = await getCmsPage(r.identifier);
    return page ? ({ kind: 'cms', page } as const) : null;
  }
  if (r.kind === 'redirect') return r;
  return null;
}

const abs = (t: string | null | undefined, fallback: string) => {
  const s = (t || fallback).trim();
  return /\|\s*Third Shot Supply Co\.$/.test(s) ? { absolute: s } : s;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await resolve(slug);
  const path = '/' + slug.join('/');
  if (!r) return { title: 'Page not found' };
  if (r.kind === 'product') {
    const img = mediaSrc(r.p.small_image?.url);
    return {
      title: abs(r.p.meta_title, r.p.name),
      description: r.p.meta_description || stripTags(r.p.short_description?.html).slice(0, 160),
      alternates: { canonical: path },
      openGraph: { type: 'website', title: r.p.name, images: img ? [{ url: img }] : undefined },
    };
  }
  if (r.kind === 'category')
    return {
      title: abs(r.c.meta_title, r.c.name),
      description: r.c.meta_description || stripTags(r.c.description).slice(0, 160),
      alternates: { canonical: path },
      openGraph: { images: r.c.image ? [{ url: r.c.image }] : undefined },
    };
  if (r.kind === 'cms') return { title: abs(r.page.meta_title, r.page.title), description: r.page.meta_description || undefined, alternates: { canonical: path } };
  return {};
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r) notFound();
  if (r.kind === 'redirect') {
    if (r.code === 301) permanentRedirect(r.to);
    redirect(r.to);
  }
  if (r.kind === 'product') return <ProductPage p={r.p} />;
  if (r.kind === 'category') return <CategoryPage cat={r.c} />;
  return <CmsPageView page={r.page} />;
}
