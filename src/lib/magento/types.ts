export interface Money {
  value: number;
  currency?: string;
}

export interface PriceRange {
  minimum_price: {
    regular_price: Money;
    final_price: Money;
    discount?: { percent_off: number; amount_off: number } | null;
  };
  maximum_price: { regular_price: Money; final_price: Money };
}

export interface Img {
  url: string;
  label: string | null;
}

export interface GalleryImg extends Img {
  position: number | null;
  disabled: boolean | null;
}

export interface SwatchData {
  __typename: 'ColorSwatchData' | 'TextSwatchData' | 'ImageSwatchData';
  value: string;
  thumbnail?: string;
}

export interface ConfigurableOption {
  uid?: string;
  attribute_code: string;
  label: string;
  position?: number;
  values: { uid: string; label: string; swatch_data: SwatchData | null }[];
}

export type ProductType = 'SimpleProduct' | 'ConfigurableProduct' | 'BundleProduct' | 'GroupedProduct' | 'VirtualProduct' | 'DownloadableProduct';

export interface ProductCard {
  uid: string;
  sku: string;
  name: string;
  url_key: string;
  __typename: ProductType;
  stock_status: 'IN_STOCK' | 'OUT_OF_STOCK';
  rating_summary: number;
  review_count: number;
  small_image: Img | null;
  price_range: PriceRange;
  configurable_options?: ConfigurableOption[];
}

export interface Review {
  nickname: string;
  summary: string;
  text: string;
  created_at: string;
  average_rating: number;
  ratings_breakdown: { name: string; value: string }[];
}

export interface Variant {
  attributes: { code: string; uid: string; label: string }[];
  product: {
    uid: string;
    sku: string;
    name: string;
    stock_status: 'IN_STOCK' | 'OUT_OF_STOCK';
    only_x_left_in_stock: number | null;
    small_image: Img | null;
    media_gallery: GalleryImg[];
    price_range: PriceRange;
  };
}

export interface BundleOption {
  uid: string;
  id: number;
  label: string;
  quantity: number;
  can_change_quantity: boolean;
  is_default: boolean;
  price: number;
  price_type: string;
  position: number;
  product: { uid: string; sku: string; name: string; stock_status: string; price_range: PriceRange; small_image: Img | null } | null;
}

export interface BundleItem {
  uid: string;
  option_id: number;
  title: string;
  required: boolean;
  type: 'select' | 'radio' | 'checkbox' | 'multi';
  position: number;
  options: BundleOption[];
}

export interface GroupedItem {
  qty: number;
  position: number;
  product: {
    uid: string;
    sku: string;
    name: string;
    url_key: string;
    stock_status: string;
    small_image: Img | null;
    price_range: PriceRange;
  };
}

export interface CustomAttr {
  code: string;
  value?: string;
  selected_options?: { label: string; value: string }[];
}

export interface Product extends ProductCard {
  only_x_left_in_stock: number | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keyword: string | null;
  short_description: { html: string } | null;
  description: { html: string } | null;
  media_gallery: GalleryImg[];
  categories: { uid: string; name: string; url_path: string; level: number }[];
  custom_attributesV2: { items: CustomAttr[] } | null;
  related_products: ProductCard[];
  upsell_products: ProductCard[];
  crosssell_products: ProductCard[];
  reviews: { items: Review[] };
  variants?: Variant[];
  // bundle
  dynamic_price?: boolean;
  price_view?: string;
  // bundle and grouped `items` are aliased in the query so their shapes never collide
  bundle_items?: BundleItem[];
  grouped_items?: GroupedItem[];
}

export interface Category {
  uid: string;
  name: string;
  url_path: string;
  url_key: string;
  product_count: number;
  description: string | null;
  image: string | null;
  meta_title: string | null;
  meta_description: string | null;
}

export interface Aggregation {
  attribute_code: string;
  label: string;
  position: number | null;
  options: { label: string; value: string; count: number }[];
}

export interface ProductListResult {
  total_count: number;
  items: ProductCard[];
  aggregations: Aggregation[];
  page_info: { current_page: number; page_size: number; total_pages: number };
}

export interface CmsPage {
  identifier: string;
  url_key: string;
  title: string;
  content: string;
  content_heading: string | null;
  meta_title: string | null;
  meta_description: string | null;
  page_layout: string | null;
}

export interface CmsBlock {
  identifier: string;
  title: string;
  content: string;
}

export type RouteResult =
  | { kind: 'product'; urlKey: string; sku: string }
  | { kind: 'category'; urlPath: string; uid: string }
  | { kind: 'cms'; identifier: string }
  | { kind: 'redirect'; to: string; code: number }
  | null;
