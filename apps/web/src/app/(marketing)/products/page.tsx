import type { Metadata } from 'next';
import { FreeResources } from './_components/free-resources';
import { PremiumProducts } from './_components/premium-products';
import { ProductsHero } from './_components/products-hero';

/**
 * `/products` — hero → premium catalog → open tooling (fetched live from
 * the API). Marketing layout supplies the chrome.
 */

// The root layout's template renders this as "Products — VUNVAULT".
export const metadata: Metadata = {
  title: 'Products',
};

export default function ProductsPage() {
  return (
    <>
      <ProductsHero />
      <PremiumProducts />
      <FreeResources />
    </>
  );
}
