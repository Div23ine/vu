import { z } from 'zod';

/**
 * Wire envelopes shared by every endpoint.
 *
 *   2xx       → `{ data: T }`            (lists: `{ data: T[]; total: number }`)
 *   4xx / 5xx → `{ error, message?, details? }`
 */

export const ErrorEnvelope = z.object({
  error: z.string(),
  message: z.string().optional(),
  details: z.array(z.unknown()).optional(),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

/** `{ data: T[]; total: number }` — the list envelope every paginated route returns. */
export function paginated<TSchema extends z.ZodTypeAny>(item: TSchema) {
  return z.object({
    data: z.array(item),
    total: z.number().int().nonnegative(),
  });
}

/** `{ data: T }` — the single-resource envelope. */
export function envelope<TSchema extends z.ZodTypeAny>(data: TSchema) {
  return z.object({ data });
}

/** Query string pagination. Coerced because query parameters arrive as strings. */
export const PageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().trim().max(200).optional(),
});
export type PageQuery = z.infer<typeof PageQuery>;

export const Uuid = z.string().uuid();
export type Uuid = z.infer<typeof Uuid>;

export const IsoDateTime = z.string().datetime();
export type IsoDateTime = z.infer<typeof IsoDateTime>;

/** Integer USD cents. USD is the only settlement currency. */
export const UsdCents = z.number().int().nonnegative();
export type UsdCents = z.infer<typeof UsdCents>;
