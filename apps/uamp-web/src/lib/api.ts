import { ApiError, apiPost, configureApi } from '@vunvault/lib';
import { env } from '../env';

configureApi({
  baseUrl: env.NEXT_PUBLIC_API_URL,
  onUnauthorized: () => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  }
});

export { ApiError, apiPost };
