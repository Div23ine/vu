import { apiGet, apiPost, apiPatch, apiDelete, configureApi } from '@vunvault/lib';
import { env } from '../env';

let configured = false;

function configure(): void {
  if (configured) return;
  configured = true;
  configureApi({
    baseUrl: env.NEXT_PUBLIC_API_URL,
    onUnauthorized: () => {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    },
  });
}

configure();

export { apiGet, apiPost, apiPatch, apiDelete };

export async function ensureCsrf(): Promise<void> {
  if (typeof document === 'undefined') return;
  await apiGet('/api/v1/auth/csrf');
}