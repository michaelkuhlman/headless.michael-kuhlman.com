/** Shared GraphQL selections. Kept as plain strings (compacted before sending). */

export const MONEY = `value currency`;

export const PRICE_RANGE = `
  price_range {
    minimum_price { regular_price { value } final_price { value } discount { percent_off amount_off } }
    maximum_price { regular_price { value } final_price { value } }
  }
`;

export const CARD_FIELDS = `
  uid sku name url_key __typename stock_status rating_summary review_count
  small_image { url label }
  ${PRICE_RANGE}
  ... on ConfigurableProduct {
    configurable_options {
      attribute_code label
      values { uid label swatch_data { __typename value } }
    }
  }
`;

export const PRODUCT_FIELDS = `
  uid sku name url_key __typename stock_status only_x_left_in_stock
  meta_title meta_description meta_keyword
  rating_summary review_count
  short_description { html }
  description { html }
  small_image { url label }
  media_gallery { url label position disabled }
  ${PRICE_RANGE}
  categories { uid name url_path level }
  custom_attributesV2(filters: { is_visible_on_front: true }) {
    items {
      code
      ... on AttributeValue { value }
      ... on AttributeSelectedOptions { selected_options { label value } }
    }
  }
  related_products { ${CARD_FIELDS} }
  upsell_products { ${CARD_FIELDS} }
  crosssell_products { ${CARD_FIELDS} }
  reviews(pageSize: 20) {
    items { nickname summary text created_at average_rating ratings_breakdown { name value } }
  }
  ... on ConfigurableProduct {
    configurable_options {
      uid attribute_code label position
      values { uid label swatch_data { __typename value ... on ImageSwatchData { thumbnail } } }
    }
    variants {
      attributes { code uid label }
      product {
        uid sku name stock_status only_x_left_in_stock
        small_image { url label }
        media_gallery { url label position disabled }
        ${PRICE_RANGE}
      }
    }
  }
  ... on BundleProduct {
    dynamic_price price_view ship_bundle_items
    bundle_items: items {
      uid option_id title required type position
      options { uid id label quantity can_change_quantity is_default price price_type position
        product { uid sku name stock_status ${PRICE_RANGE} small_image { url label } } }
    }
  }
  ... on GroupedProduct {
    grouped_items: items { qty position product { uid sku name url_key stock_status small_image { url label } ${PRICE_RANGE} } }
  }
`;
