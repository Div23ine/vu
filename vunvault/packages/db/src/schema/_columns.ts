import { bigint, customType, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Shared column helpers.
 *
 * Row-level security: every table in this schema calls `.enableRLS()` and defines
 * NO permissive policies, so Supabase's PostgREST roles (`anon`, `authenticated`)
 * get zero access to any table. All access goes through the API, which connects
 * with a server-side role. RLS is defence in depth here, not the primary
 * authorisation layer — the API's permission checks are.
 *
 * Money: every amount is integer USD cents (`usdCents`). USD is the only
 * settlement currency; local currencies are display-only and live in `fx_quotes`.
 */

/** `uuid` primary key with a server-side default. */
export function idCol() {
  return uuid('id').primaryKey().defaultRandom();
}

/** Insert timestamp, set by the database. */
export function createdAtCol() {
  return timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
}

/**
 * Update timestamp. Drizzle's `defaultNow()` seeds it on insert; the API owns the
 * `updated_at` write on every mutation, so a stale value can never be trusted.
 */
export function updatedAtCol() {
  return timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
}

/** Spread into a table definition: `...timestamps`. */
export const timestamps = {
  createdAt: createdAtCol(),
  updatedAt: updatedAtCol(),
};

/** Integer USD cents. Never a float, never a `numeric` with implicit scale. */
export function usdCents(name: string) {
  return bigint(name, { mode: 'number' });
}

/** Timezone-aware timestamp column. */
export function tz(name: string) {
  return timestamp(name, { withTimezone: true });
}

/**
 * `citext` — case-insensitive text, provided by the extension in
 * `sql/0000_extensions.sql`. Drizzle's `pg-core` does not ship a builder for it.
 * Emails are stored lower-cased by the API *and* compared case-insensitively here,
 * so a unique index on an email column cannot be defeated by capitalisation.
 */
export const citext = customType<{ data: string }>({
  dataType() {
    return 'citext';
  },
});

/**
 * `bytea` — raw bytes. Used for WebAuthn public keys and for the sealed
 * (AES-256-GCM) audit fields, neither of which is ever rendered as text.
 */
export const bytea = customType<{ data: Uint8Array }>({
  dataType() {
    return 'bytea';
  },
});
