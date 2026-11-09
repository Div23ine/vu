'use client';

import { useEffect } from 'react';
import { ensureCsrf } from '../lib/api';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void ensureCsrf().catch(() => {
      // The API rejects mutations without a valid CSRF token; keep the read-only
      // dashboard available and let a failed mutation display its own error.
    });
  }, []);
  return <>{children}</>;
}