import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SessionUser as SessionUserSchema, type SessionUser } from '@vunvault/contracts';
import { env } from '../env';

export async function getServerSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const cookieHeader = store.getAll().map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  if (!cookieHeader) return null;

  try {
    const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/auth/session`, {
      headers: { cookie: cookieHeader, accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null) return null;
    const parsed = SessionUserSchema.safeParse((body as { data?: unknown }).data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function requireUampSession(): Promise<SessionUser> {
  const user = await getServerSession();
  if (user === null) redirect('/login');
  if (!user.permissions.includes('uamp:read')) redirect('/access');
  return user;
}