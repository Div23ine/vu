/**
 * A provider failure. `retryable` tells the queue whether another attempt can
 * possibly succeed: a rejected recipient cannot, an unreachable API can.
 */
export class ProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message?: string, options: { retryable?: boolean } = {}) {
    super(message ?? code);
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = options.retryable ?? false;
  }
}

export function isProviderError(value: unknown): value is ProviderError {
  return value instanceof ProviderError;
}
