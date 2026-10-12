import {
  Activity,
  Bug,
  Check,
  ClipboardCheck,
  Radar,
  ScanSearch,
  ShoppingCart,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ProductView } from '@vunvault/contracts';
import { formatUsdWhole } from '@vunvault/lib';
import '../_styles/products.css';

/**
 * Product card (Task 55) — presentational. The `action` slot is filled by the
 * catalogue section (login link, or the Buy Now mutation button, depending on
 * the session), keeping auth logic out of the card. Price is USD through
 * `formatUsdWhole`; a local currency never appears on this page.
 */

const CATEGORY_ICONS: Readonly<Record<string, LucideIcon>> = {
  Recon: Radar,
  Scanning: ScanSearch,
  'Human Risk': Users,
  Detection: Activity,
  'Exploit Dev': Bug,
  GRC: ClipboardCheck,
};

export interface ProductCardProps {
  product: ProductView;
  /** The Buy Now control (link or button), rendered in the card footer. */
  action: React.ReactNode;
}

export function ProductCard({ product, action }: ProductCardProps) {
  const Icon = CATEGORY_ICONS[product.category] ?? ShoppingCart;

  return (
    <article className="vv-prod-card">
      <div className="vv-prod-head">
        <div className="vv-prod-icon">
          <Icon size={22} aria-hidden="true" />
        </div>
        <span className="vv-prod-badge">{product.category}</span>
      </div>
      <div className="vv-prod-body">
        <h3 className="vv-prod-title">{product.name}</h3>
        <p className="vv-prod-desc">{product.description}</p>
        <ul className="vv-prod-features">
          {product.features.map((feature) => (
            <li key={feature}>
              <Check size={14} aria-hidden="true" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <div className="vv-prod-foot">
          <div className="vv-prod-price">
            {formatUsdWhole(product.priceUsdCents)}
            <span>/ {product.unitLabel}</span>
          </div>
          {action}
        </div>
      </div>
    </article>
  );
}
