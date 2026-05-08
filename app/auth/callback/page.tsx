'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Suspense } from 'react';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type') as 'invite' | 'recovery' | null;

    if (tokenHash && type) {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
        if (!error) router.push('/');
        else router.push('/login');
      });
    } else {
      router.push('/');
    }
  }, [router, searchParams]);

  return (
    <div className="h-screen flex items-center justify-center font-black uppercase text-2xl tracking-tighter">
      Verifying...
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center font-black uppercase text-2xl tracking-tighter">Loading...</div>}>
      <CallbackHandler />
    </Suspense>
  );
}
