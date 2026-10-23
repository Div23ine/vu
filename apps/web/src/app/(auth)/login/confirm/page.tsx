'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthFlowHandle } from '@vunvault/contracts';
import { apiPost } from '../../../../lib/api';

/** The emailed link lands here: it exchanges the token for the code step. */
function ConfirmInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (token === '' || started.current) return;
    started.current = true;
    void (async () => {
      try {
        const result = await apiPost<unknown>('/api/v1/auth/login/confirm', { token });
        const parsed = AuthFlowHandle.safeParse(result);
        if (!parsed.success) throw new Error('bad response');
        const { handle, method } = parsed.data.data;
        router.replace(`/login?step=code&handle=${encodeURIComponent(handle)}&method=${method}`);
      } catch {
        setFailed(true);
      }
    })();
  }, [token, router]);

  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-extrabold text-neutral-900">
        {failed ? 'That sign-in link did not work' : 'Confirmed — one step left'}
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-neutral-600">
        {failed
          ? 'The link may have expired (they live 15 minutes) or already been used. Start again from the login page.'
          : 'We sent a six-digit code. Enter it on the login page to finish signing in.'}
      </p>
    </section>
  );
}

export default function LoginConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmInner />
    </Suspense>
  );
}
