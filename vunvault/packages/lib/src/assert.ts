/**
 * Exhaustiveness guard for discriminated unions. Placing this in the `default`
 * branch of a `switch` makes TypeScript fail the build when a new union member
 * is added but not handled.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
