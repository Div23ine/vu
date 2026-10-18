import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Db = PostgresJsDatabase<typeof schema>;

export interface CreateDbOptions {
  max?: number;
}

export function createDb(
  url: string | undefined = process.env.DATABASE_URL,
  options: CreateDbOptions = {},
): Db {
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL is not set. App traffic must use the Supavisor transaction pooler on port 6543.',
    );
  }

  const rawClient = postgres(url, {
    prepare: false,
    max: options.max ?? 10,
    ssl: 'require',
  });

  const client = new Proxy(rawClient, {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig === 'function') {
        return function (...args: unknown[]) {
          if (args.length >= 2 && Array.isArray(args[1])) {
            args[1] = args[1].map((p: unknown) => {
              if (p instanceof Date) return p.toISOString();
              if (Array.isArray(p)) {
                return p.map((item: unknown) => (item instanceof Date ? item.toISOString() : item));
              }
              return p;
            });
          }
          return orig.apply(this, args);
        };
      }
      return orig;
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return drizzle(client as any, { schema });
}
