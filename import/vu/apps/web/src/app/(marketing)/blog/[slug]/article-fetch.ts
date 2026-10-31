import { notFound } from 'next/navigation';
import {
  PublicContentDetail as PublicContentDetailSchema,
  type PublicContentDetail,
} from '@vunvault/contracts';
import { env } from '../../../../env';

export async function fetchArticle(slug: string): Promise<PublicContentDetail> {
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/content/${slug}`, {
    next: { revalidate: 60 },
  });
  if (!response.ok) notFound();
  const body: unknown = await response.json();
  const data = typeof body === 'object' && body !== null ? (body as { data?: unknown }).data : null;
  const parsed = PublicContentDetailSchema.safeParse(data);
  if (!parsed.success) notFound();
  return parsed.data;
}
