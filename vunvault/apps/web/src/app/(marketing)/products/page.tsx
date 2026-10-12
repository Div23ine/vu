import type { Metadata } from 'next';
import { CustomBand } from './_components/custom-band';
import { FreeResources } from './_components/free-resources';
import { PremiumProducts } from './_components/premium-products';
import { ProductsHero } from './_components/products-hero';
import { ToolboxShell } from './_components/toolbox-shell';

/**
 * `/products` (Task 55) — hero → premium catalogue → free resources →
 * toolbox shell → custom-tooling band. The last three are null stubs until
 * Task 55b overwrites them; the route already renders them in their final
 * positions. Marketing layout supplies the chrome; the footer's `products`
 * variant is pathname-derived (Task 44).
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
      <ToolboxShell />
      <CustomBand />
    </>
  );
}
