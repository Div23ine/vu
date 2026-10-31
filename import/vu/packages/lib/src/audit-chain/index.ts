/**
 * The audit hash chain, shared by the API (which APPENDS) and the maintenance
 * worker (which VERIFIES — Task 92). One implementation of the chain rules,
 * two callers; see `verify.ts` for why that matters.
 */
export * from './canonical';
export * from './crypto';
export * from './verify';
