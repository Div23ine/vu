'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import type { ProductView } from '@vunvault/contracts';
import { isApiError } from '@vunvault/lib';
import { Skeleton, toast } from '@vunvault/ui';
import { isStaffRole } from '../../../../lib/permissions';
import { useSession } from '../../../../lib/session';
import { useProducts, usePurchaseProduct } from '../_hooks/use-products';
import { ProductCard } from './product-card';
import '../_styles/products.css';

/**
 * Premium products catalogue (Task 55) — API-driven, six licensed tools.
 *
 * Buy Now replaces the prototype's `payment.html?product=…` anchor:
 *  - anonymous (or session still resolving): a link to `/login?next=/products`;
 *  - authenticated client: `POST /api/v1/products/:id/purchase`, then
 *    `/portal/billing?invoice=<invoiceId>` where Task 66's FX quote + USD
 *    checkout pays it;
 *  - staff: the catalogue's warn toast — licences belong to client accounts.
 *
 * Prices are USD only (`formatUsdWhole`); the header chip shows the API's
 * `total`.
 */

export function PremiumProducts() {
  const router = useRouter();
  const { data, isLoading } = useProducts();
  const { user, isLoading: sessionLoading } = useSession();
  const purchase = usePurchaseProduct();

  const products = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleBuy = (product: ProductView) => {
    if (user !== null && isStaffRole(user.role)) {
      toast({
        kind: 'warn',
        title: 'Client accounts only',
        message: 'Sign in with a client account to purchase licences.',
      });
      return;
    }
    purchase.mutate(product.id, {
      onSuccess: (result) => {
        router.push(`/portal/billing?invoice=${result.invoiceId}`);
      },
      onError: (error) => {
        // Surface the API's own words; the global 401 redirect already ran.
        toast({
          kind: 'crit',
          title: isApiError(error) ? (error.message ?? error.code) : 'purchase_failed',
        });
      },
    });
  };

  const renderAction = (product: ProductView) => {
    if (!sessionLoading && user !== null) {
      return (
        <button
          type="button"
          className="vv-prod-buy"
          onClick={() => handleBuy(product)}
          disabled={purchase.isPending}
        >
          <span>Buy Now</span>
          <ShoppingCart size={14} aria-hidden="true" />
        </button>
      );
    }
    return (
      <Link href="/login?next=/products" className="vv-prod-buy">
        <span>Buy Now</span>
        <ShoppingCart size={14} aria-hidden="true" />
      </Link>
    );
  };

  return (
    <>
      <span id="catalog" className="anchor-offset" aria-hidden="true" />
      <section
        id="paid-products"
        className="py-14 md:py-20 bg-paper border-t border-neutral-200/80"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="vv-sec-head">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-[2px] w-6 bg-cyan-600 rounded-full" />
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
                  Premium Products
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">
                Licensed tooling for professional engagements
              </h2>
              <p className="text-neutral-500 text-sm md:text-base max-w-2xl leading-relaxed">
                Commercial licences include encrypted delivery, twelve months of updates and a named
                support contact. Purchase routes directly to our secure checkout.
              </p>
            </div>
            {isLoading ? null : <span className="vv-prod-badge">{total} Products</span>}
          </div>

          <div className="vv-prod-grid">
            {isLoading
              ? [0, 1, 2, 3, 4, 5].map((slot) => (
                  <Skeleton key={slot} className="h-[420px] rounded-[20px]" />
                ))
              : products.map((product) => (
                  <ProductCard key={product.id} product={product} action={renderAction(product)} />
                ))}
          </div>
        </div>
      </section>
    </>
  );
}
