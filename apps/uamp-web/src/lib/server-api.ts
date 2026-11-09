import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '../env';

export interface PageResult<T> {
  data: T[];
  total: number;
}

export async function getUamp<T>(path: string): Promise<T> {
  const store = await cookies();
  const cookieHeader = store.getAll().map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    headers: { cookie: cookieHeader, accept: 'application/json' },
    cache: 'no-store',
  });
  if (response.status === 401) redirect('/login');
  if (response.status === 403) redirect('/access');
  if (!response.ok) throw new Error(`UAMP API request failed (${response.status})`);
  return (await response.json()) as T;
}

export function listPath(resource: string): string {
  return `/api/v1/uamp/${resource}?page=1&pageSize=50`;
}