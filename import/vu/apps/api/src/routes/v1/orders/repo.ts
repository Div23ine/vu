import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';

/**
 * Guest-order persistence. Every fulfilment path (verify route, Paystack
 * webhook) goes through `fulfillGuestOrder`, whose UPDATE is guarded by
 * `status = 'pending'` — two concurrent successes race, exactly one wins the
 * transition, and only the winner sends the receipt.
 */

export interface GuestOrderRow {
  reference: string;
  plan_code: string;
  email: string;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  usd_cents: number;
  display_currency: string;
  rate_local_per_usd: string | null;
  display_minor: number | null;
  paid_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

export interface NewGuestOrder {
  reference: string;
  planCode: string;
  email: string;
  usdCents: number;
  displayCurrency: string;
  rateLocalPerUsd: string | null;
  displayMinor: number | null;
}

export interface PlanRow {
  code: string;
  name: string;
  description: string | null;
  unit: string;
  monthly_usd_cents: number;
}

export interface OrdersRepo {
  listActivePlans(): Promise<PlanRow[]>;
  createGuestOrder(input: NewGuestOrder): Promise<void>;
  findGuestOrder(reference: string): Promise<GuestOrderRow | null>;
  /** True only for the caller that flipped pending -> paid. */
  fulfillGuestOrder(reference: string, paidAt: Date): Promise<boolean>;
  failGuestOrder(reference: string, reason: string): Promise<void>;
}

export class SqlOrdersRepo implements OrdersRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async listActivePlans(): Promise<PlanRow[]> {
    return this.executor.unsafe<PlanRow[]>(
      `select code, name, description, unit, monthly_usd_cents
         from plans
        where active = true
        order by monthly_usd_cents asc`,
    );
  }

  async createGuestOrder(input: NewGuestOrder): Promise<void> {
    await this.executor.unsafe(
      `insert into guest_orders
         (reference, plan_code, email, usd_cents, display_currency, rate_local_per_usd, display_minor)
       values ($1, $2, $3::citext, $4, $5::display_currency, $6, $7)
       on conflict (reference) do nothing`,
      [
        input.reference,
        input.planCode,
        input.email,
        input.usdCents,
        input.displayCurrency,
        input.rateLocalPerUsd,
        input.displayMinor,
      ],
    );
  }

  async findGuestOrder(reference: string): Promise<GuestOrderRow | null> {
    const rows = await this.executor.unsafe<GuestOrderRow[]>(
      `select reference, plan_code, email::text as email, status, usd_cents,
              display_currency::text as display_currency, rate_local_per_usd,
              display_minor, paid_at::text as paid_at, failure_reason,
              created_at::text as created_at
         from guest_orders
        where reference = $1`,
      [reference],
    );
    return rows[0] ?? null;
  }

  async fulfillGuestOrder(reference: string, paidAt: Date): Promise<boolean> {
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `update guest_orders
          set status = 'paid', paid_at = $2, updated_at = now()
        where reference = $1 and status = 'pending'
        returning id::text as id`,
      [reference, paidAt],
    );
    return rows.length > 0;
  }

  async failGuestOrder(reference: string, reason: string): Promise<void> {
    await this.executor.unsafe(
      `update guest_orders
          set status = 'failed', failure_reason = $2, updated_at = now()
        where reference = $1 and status = 'pending'`,
      [reference, reason],
    );
  }
}
