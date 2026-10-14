import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { magento } from './client';
import { CARD_FIELDS, PRODUCT_FIELDS } from './fragments';
import type { Aggregation, Category, CmsBlock, CmsPage, Product, ProductCard, ProductListResult, RouteResult } from './types';

/*
 * Every catalogue read is a cached function: the result is part of the prerendered static shell and is refreshed
 * by tag when Magento tells us something changed (POST /api/revalidate), with an hourly safety net.
 */

export interface StoreConfig {
  default_title: string;
  title_suffix: string | null;
  default_description: string | null;
  copyright: string | null;
  welcome: string | null;
  grid_per_page: number;
  catalog_default_sort_by: string;
}

export async function getStoreConfig(): Promise<StoreConfig> {
  'use cache';
  cacheLife('hours');
  cacheTag('catalog', 'config');
  const d = await magento<{ storeConfig: StoreConfig }>(`{ storeConfig { default_title title_suffix default_description copyright welcome grid_per_page catalog_default_sort_by } }`);
  return d.storeConfig;
}

export async function getCategories(): Promise<Category[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('catalog', 'categories');
  const d = await magento<{ categoryList: { children: (Category & { include_in_menu: number; position: number })[] }[] }>(`{
    categoryList(filters: {}) {
      children { uid name url_path url_key product_count description image meta_title meta_description include_in_menu position }
    }
  }`);
  const kids = d.categoryList[0]?.children ?? [];
  return kids.filter((c) => c.include_in_menu !== 0).sort((a, b) => a.position - b.position);
}

export async function getCategory(urlPath: string): Promise<Category | null> {
  const all = await getCategories();
  return all.find((c) => c.url_path === urlPath) ?? null;
}

export type SortKey = 'position' | 'name' | 'price';
export interface ListArgs {
  categoryUid?: string;
  search?: string;
  filters?: Record<string, string[]>;
  price?: { from?: number; to?: number } | null;
  sort?: SortKey;
  dir?: 'ASC' | 'DESC';
  page?: number;
  pageSize?: number;
}

function buildFilter(a: ListArgs): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (a.categoryUid) f.category_uid = { eq: a.categoryUid };
  for (const [code, values] of Object.entries(a.filters ?? {})) {
    if (!values.length || code === 'price' || code === 'category_uid') continue;
    f[code] = values.length === 1 ? { eq: values[0] } : { in: values };
  }
  if (a.price && (a.price.from != null || a.price.to != null)) {
    const p: Record<string, string> = {};
    if (a.price.from != null) p.from = String(a.price.from);
    if (a.price.to != null) p.to = String(a.price.to);
    f.price = p;
  }
  return f;
}

/** Product listing for category, search and filter pages. Cached per argument set. */
export async function listProducts(args: ListArgs): Promise<ProductListResult> {
  'use cache';
  cacheLife('hours');
  cacheTag('catalog');
  const sortKey = args.sort ?? (args.search ? 'relevance' : 'position');
  const dir = args.dir ?? (sortKey === 'price' || sortKey === 'position' || sortKey === 'name' ? 'ASC' : 'DESC');
  const sort = { [sortKey]: dir };
  const d = await magento<{ products: ProductListResult }>(
    `query List($filter: ProductAttributeFilterInput, $search: String, $sort: ProductAttributeSortInput, $page: Int, $size: Int) {
      products(filter: $filter, search: $search, sort: $sort, currentPage: $page, pageSize: $size) {
        total_count
        page_info { current_page page_size total_pages }
        aggregations { attribute_code label position options { label value count } }
        items { ${CARD_FIELDS} }
      }
    }`,
    {
      filter: buildFilter(args),
      ...(args.search ? { search: args.search } : {}),
      sort,
      page: args.page ?? 1,
      size: args.pageSize ?? 60,
    },
  );
  // Mage-OS GraphQL ignores the direction of a `position` sort and returns the category in reverse admin order
  // (the classic storefront shows it top-down). Listings fit on one page, so flip it here to match m2 exactly.
  if (sortKey === 'position' && dir === 'ASC' && d.products.total_count <= (args.pageSize ?? 60)) {
    return { ...d.products, items: [...d.products.items].reverse() };
  }
  return d.products;
}

export async function getProduct(urlKey: string): Promise<Product | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('catalog', `p:${urlKey}`);
  const d = await magento<{ products: { items: Product[] } }>(
    `query P($k: String) { products(filter: { url_key: { eq: $k } }) { items { ${PRODUCT_FIELDS} } } }`,
    { k: urlKey },
  );
  // an url_key eq filter also returns bundles/groups that contain the product: take the exact match only
  return d.products.items.find((p) => p.url_key === urlKey) ?? null;
}

export async function getProductsByUrlKeys(keys: string[]): Promise<ProductCard[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('catalog');
  if (!keys.length) return [];
  const d = await magento<{ products: { items: ProductCard[] } }>(
    `query K($k: [String], $n: Int) { products(filter: { url_key: { in: $k } }, pageSize: $n) { items { ${CARD_FIELDS} } } }`,
    { k: keys, n: keys.length + 24 }, // a url_key IN filter also returns bundles/groups containing them
  );
  const by = new Map(d.products.items.map((p) => [p.url_key, p]));
  return keys.map((k) => by.get(k)).filter((p): p is ProductCard => !!p);
}

export async function getProductsBySkus(skus: string[]): Promise<ProductCard[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('catalog');
  if (!skus.length) return [];
  const d = await magento<{ products: { items: ProductCard[] } }>(
    `query S($s: [String], $n: Int) { products(filter: { sku: { in: $s } }, pageSize: $n) { items { ${CARD_FIELDS} } } }`,
    { s: skus, n: skus.length + 24 },
  );
  const by = new Map(d.products.items.map((p) => [p.sku, p]));
  return skus.map((s) => by.get(s)).filter((p): p is ProductCard => !!p);
}

/** Every visible product url_key (for generateStaticParams and the sitemap). */
export async function getAllProductKeys(): Promise<string[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('catalog');
  const d = await magento<{ products: { items: { url_key: string }[] } }>(
    `{ products(filter: { price: { from: "0" } }, pageSize: 300) { items { url_key } } }`,
  );
  return d.products.items.map((p) => p.url_key);
}

/** Attribute code -> storefront label (for the "More information" table). */
export async function getAttributeLabels(): Promise<Record<string, string>> {
  'use cache';
  cacheLife('days');
  cacheTag('catalog', 'attributes');
  const d = await magento<{ attributesList: { items: { code: string; label: string }[] } }>(
    `{ attributesList(entityType: CATALOG_PRODUCT) { items { code label } } }`,
  );
  return Object.fromEntries(d.attributesList.items.map((a) => [a.code, a.label]));
}

export async function resolveRoute(url: string): Promise<RouteResult> {
  'use cache';
  cacheLife('hours');
  cacheTag('catalog', 'cms', 'routes');
  const d = await magento<{
    route: null | {
      __typename: string;
      type: string;
      relative_url: string | null;
      redirect_code: number;
      url_key?: string;
      sku?: string;
      url_path?: string;
      uid?: string;
      identifier?: string;
    };
  }>(
    `query R($u: String!) { route(url: $u) {
      __typename type relative_url redirect_code
      ... on ProductInterface { url_key sku }
      ... on CategoryInterface { url_path uid }
      ... on CmsPage { identifier }
    } }`,
    { u: url },
  );
  const r = d.route;
  if (!r) return null;
  if (r.redirect_code && r.redirect_code >= 300 && r.relative_url) return { kind: 'redirect', to: `/${r.relative_url.replace(/^\//, '')}`, code: r.redirect_code };
  if (r.type === 'PRODUCT' && r.url_key && r.sku) return { kind: 'product', urlKey: r.url_key, sku: r.sku };
  if (r.type === 'CATEGORY' && r.url_path && r.uid) return { kind: 'category', urlPath: r.url_path, uid: r.uid };
  if (r.type === 'CMS_PAGE' && r.identifier) return { kind: 'cms', identifier: r.identifier };
  return null;
}

export async function getCmsPage(identifier: string): Promise<CmsPage | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('cms', `cms:${identifier}`);
  try {
    const d = await magento<{ cmsPage: CmsPage | null }>(
      `query C($id: String) { cmsPage(identifier: $id) { identifier url_key title content content_heading meta_title meta_description page_layout } }`,
      { id: identifier },
    );
    return d.cmsPage;
  } catch {
    return null;
  }
}

export async function getCmsBlocks(ids: string[]): Promise<Record<string, CmsBlock>> {
  'use cache';
  cacheLife('hours');
  cacheTag('cms');
  const d = await magento<{ cmsBlocks: { items: CmsBlock[] } }>(
    `query B($ids: [String]) { cmsBlocks(identifiers: $ids) { items { identifier title content } } }`,
    { ids },
  );
  return Object.fromEntries(d.cmsBlocks.items.map((b) => [b.identifier, b]));
}

export function sortAggregations(aggs: Aggregation[]): Aggregation[] {
  return aggs.filter((a) => a.attribute_code !== 'category_uid' && a.options.length > 0);
}

export interface Region {
  id: number;
  code: string;
  name: string;
}

/** States for the address forms (the store ships to the US only). */
export async function getRegions(country = 'US'): Promise<Region[]> {
  'use cache';
  cacheLife('days');
  cacheTag('config');
  const d = await magento<{ country: { available_regions: Region[] | null } | null }>(
    `query C($id: String) { country(id: $id) { available_regions { id code name } } }`,
    { id: country },
  );
  return (d.country?.available_regions ?? []).sort((a, b) => a.name.localeCompare(b.name));
}
