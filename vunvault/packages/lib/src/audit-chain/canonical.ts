/**
 * Canonical JSON.
 *
 * The audit hash is computed over a serialisation that must be reproducible years
 * later, on another machine, from another language: keys sorted lexicographically
 * at every depth, no insignificant whitespace, `undefined` dropped, `Date` as
 * ISO-8601 UTC with milliseconds, numbers exactly as `JSON.stringify` renders them.
 *
 * Anything that cannot be represented deterministically — `NaN`, `Infinity`, a
 * cycle, a `BigInt` — throws instead of silently changing the hash input.
 */

export class CanonicalJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonicalJsonError';
  }
}

function encodeString(value: string): string {
  return JSON.stringify(value);
}

function encodeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new CanonicalJsonError(`cannot canonically encode ${String(value)}`);
  }
  return JSON.stringify(value);
}

export function canonicalJson(value: unknown): string {
  const seen = new WeakSet<object>();

  const encode = (input: unknown): string => {
    if (input === null) return 'null';

    if (typeof input === 'string') return encodeString(input);
    if (typeof input === 'number') return encodeNumber(input);
    if (typeof input === 'boolean') return input ? 'true' : 'false';
    if (typeof input === 'bigint') {
      throw new CanonicalJsonError('cannot canonically encode a BigInt');
    }
    if (typeof input === 'function' || typeof input === 'symbol') {
      throw new CanonicalJsonError(`cannot canonically encode a ${typeof input}`);
    }
    if (input === undefined) return 'null';

    if (input instanceof Date) {
      if (Number.isNaN(input.getTime()))
        throw new CanonicalJsonError('cannot encode an Invalid Date');
      return encodeString(input.toISOString());
    }

    if (typeof input !== 'object') throw new CanonicalJsonError('unsupported value');

    if (seen.has(input)) throw new CanonicalJsonError('cannot canonically encode a cycle');
    seen.add(input);

    try {
      if (Array.isArray(input)) {
        return `[${input.map((item) => (item === undefined ? 'null' : encode(item))).join(',')}]`;
      }

      const record = input as Record<string, unknown>;
      const entries = Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort();
      return `{${entries.map((key) => `${encodeString(key)}:${encode(record[key])}`).join(',')}}`;
    } finally {
      seen.delete(input);
    }
  };

  return encode(value);
}
