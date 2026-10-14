import Link from 'next/link';
import Image, { getImageProps } from 'next/image';
import parse, { domToReact, Element, type DOMNode, type HTMLReactParserOptions } from 'html-react-parser';
import { MAGENTO_ORIGIN } from '@/lib/magento/client';
import { getProductsByUrlKeys } from '@/lib/magento/catalog';
import { ProductGrid } from './ProductCard';

/*
 * Renders Magento CMS HTML (pages and blocks) as React: store links become prefetching <Link>s, images go through
 * next/image (AVIF/WebP, responsive), product-list widgets become our own product grid, scripts and styles are dropped.
 */

const ORIGIN = MAGENTO_ORIGIN.replace(/\/$/, '');

function localPath(href: string | undefined): string | null {
  if (!href) return null;
  if (href.startsWith(ORIGIN)) {
    const p = href.slice(ORIGIN.length) || '/';
    if (p.startsWith('/media/') || p.startsWith('/static/')) return null;
    return p.startsWith('/') ? p : `/${p}`;
  }
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  return null;
}

function hasClass(el: Element, c: string) {
  return (el.attribs.class ?? '').split(/\s+/).includes(c);
}
function ancestorHas(el: Element, c: string): boolean {
  let n = el.parent as Element | null;
  while (n && n.type === 'tag') {
    if (hasClass(n, c)) return true;
    n = n.parent as Element | null;
  }
  return false;
}

function sizesFor(el: Element): string {
  if (ancestorHas(el, 'ts-cat')) return hasClass(el.parent as Element, 'ts-cat--wide') ? '(max-width: 767px) 92vw, 60vw' : '(max-width: 767px) 46vw, 30vw';
  if (ancestorHas(el, 'ts-spotlight') || ancestorHas(el, 'ts-story')) return '(max-width: 1023px) 100vw, 50vw';
  if (ancestorHas(el, 'ts-wide-figure')) return '(max-width: 1320px) 100vw, 1320px';
  return '(max-width: 767px) 100vw, 50vw';
}

function collectHrefs(el: Element, out: string[]) {
  for (const c of el.children as DOMNode[]) {
    if (c.type !== 'tag') continue;
    const e = c as Element;
    if (e.name === 'a' && hasClass(e, 'product-item-link') && e.attribs.href) out.push(e.attribs.href);
    collectHrefs(e, out);
  }
}

async function WidgetGrid({ keys }: { keys: string[] }) {
  const items = await getProductsByUrlKeys(keys);
  if (!items.length) return null;
  return <ProductGrid items={items} cols={4} home />;
}

function heroPicture(el: Element) {
  const source = (el.children as DOMNode[]).find((c) => c.type === 'tag' && (c as Element).name === 'source') as Element | undefined;
  const img = (el.children as DOMNode[]).find((c) => c.type === 'tag' && (c as Element).name === 'img') as Element | undefined;
  if (!img) return null;
  const alt = img.attribs.alt ?? '';
  const common = { alt, quality: 75, priority: true } as const;
  const desk = getImageProps({ ...common, src: img.attribs.src, width: Number(img.attribs.width) || 1920, height: Number(img.attribs.height) || 960, sizes: '100vw' }).props;
  const mob = source
    ? getImageProps({ ...common, src: source.attribs.srcset, width: Number(source.attribs.width) || 1080, height: Number(source.attribs.height) || 1350, sizes: '100vw' }).props
    : null;
  return (
    <picture>
      {mob && <source media={source!.attribs.media || '(max-width: 767px)'} srcSet={mob.srcSet} sizes="100vw" width={mob.width} height={mob.height} />}
      <img {...desk} className={img.attribs.class} alt={alt} fetchPriority="high" />
    </picture>
  );
}

export function CmsContent({ html }: { html: string }) {
  const options: HTMLReactParserOptions = {
    replace(node) {
      if (node.type === 'script' || node.type === 'style') return <></>;
      if (!(node instanceof Element)) return;
      const el = node;
      if (el.name === 'script' || el.name === 'style' || el.name === 'form' || el.name === 'noscript') return <></>;

      if (el.name === 'div' && hasClass(el, 'block-products-list')) {
        const hrefs: string[] = [];
        collectHrefs(el, hrefs);
        const keys = hrefs.map((h) => h.split('/').pop()!.replace(/\.html$/, '')).filter(Boolean);
        return <WidgetGrid keys={keys} />;
      }

      if (el.name === 'picture') return heroPicture(el) ?? undefined;

      if (el.name === 'img') {
        const src = el.attribs.src;
        if (!src?.startsWith(ORIGIN + '/media/')) return;
        const w = Number(el.attribs.width) || 1200;
        const h = Number(el.attribs.height) || 900;
        return <Image src={src} alt={el.attribs.alt ?? ''} width={w} height={h} sizes={sizesFor(el)} className={el.attribs.class} quality={75} />;
      }

      if (el.name === 'a') {
        const path = localPath(el.attribs.href);
        if (!path) return;
        const internalAnchor = path.includes('#') && path.split('#')[0] === '';
        if (internalAnchor) return;
        return (
          <Link href={path} className={el.attribs.class} prefetch={false} title={el.attribs.title} aria-label={el.attribs['aria-label']}>
            {domToReact(el.children as DOMNode[], options)}
          </Link>
        );
      }
      return;
    },
  };
  return <>{parse(html, options)}</>;
}
