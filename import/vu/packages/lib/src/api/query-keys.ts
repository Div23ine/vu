/**
 * Canonical TanStack Query key factory. Every screen and hook in `apps/web`
 * reads its keys from here so that invalidation is exact and never guessed.
 */
export const queryKeys = {
  session: () => ['session'] as const,
  profile: () => ['profile'] as const,
  users: {
    all: () => ['users'] as const,
    list: (f: object) => ['users', 'list', f] as const,
    invitations: () => ['users', 'invitations'] as const,
  },
  scans: {
    all: () => ['scans'] as const,
    list: (f: object) => ['scans', 'list', f] as const,
    detail: (id: string) => ['scans', 'detail', id] as const,
    adminQueue: (f: object) => ['scans', 'admin-queue', f] as const,
    summary: () => ['scans', 'summary'] as const,
  },
  billing: {
    subscription: () => ['billing', 'subscription'] as const,
    invoices: (f: object) => ['billing', 'invoices', f] as const,
    paymentMethod: () => ['billing', 'payment-method'] as const,
    fxQuote: (invoiceId: string, currency: string) =>
      ['billing', 'fx-quote', invoiceId, currency] as const,
  },
  content: {
    all: () => ['content'] as const,
    moderation: (f: object) => ['content', 'moderation', f] as const,
    published: (f: object) => ['content', 'published', f] as const,
  },
  audit: {
    all: () => ['audit'] as const,
    list: (f: object) => ['audit', 'list', f] as const,
    chain: () => ['audit', 'chain'] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
