export const SITE_URL = 'https://headless.michael-kuhlman.com';
export const CLASSIC_URL = 'https://m2.michael-kuhlman.com';
export const FREE_SHIP = 75;

/**
 * Colour swatch hex per option label: the same palette as the m2 seeder (ThirdShot\DemoData\Model\AttributeSetup::COLOURS).
 * Filter dots use it for colours no configurable in the current result carries (a bundle's cover colours, say),
 * which otherwise showed as grey.
 */
export const BRAND_SWATCHES: Record<string, string> = {
  Volt: '#D9F24F', Optic: '#D9F24F', Coral: '#EC7A5C', Glacier: '#9ED2E4', Forest: '#1F4A3C', Sand: '#D9CDB4',
  Clay: '#C9603A', Chalk: '#EFEADF', Charcoal: '#2E3434', Navy: '#1F3550',
};
