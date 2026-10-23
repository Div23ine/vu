'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthFlowHandle } from '@vunvault/contracts';
import { apiPost } from '../../../../lib/api';

/** The signup confirmation link: token in, code step out. */
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
        const result = await apiPost<unknown>('/api/v1/auth/signup/confirm', { token });
        const parsed = AuthFlowHandle.safeParse(result);
        if (!parsed.success) throw new Error('bad response');
        router.replace(`/signup?step=code&handle=${encodeURIComponent(parsed.data.data.handle)}`);
      } catch {
        setFailed(true);
      }
    })();
  }, [token, router]);

  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-extrabold text-neutral-900">
        {failed ? 'That confirmation link did not work' : 'Address confirmed — last step'}
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-neutral-600">
        {failed
          ? 'Links expire after 15 minutes and work once. Start the signup again if this one is spent.'
          : 'We emailed a six-digit code. Enter it to create your account — nothing exists until then.'}
      </p>
    </section>
  );
}

export default function SignupConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmInner />
    </Suspense>
  );
}
