'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push('/');
  };

  const handleSignup = async () => {
    if (!name.trim()) { setError('Full name is required.'); return; }
    setLoading(true);
    setError('');
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) { setError(error.message); setLoading(false); return; }

    await fetch('/api/auth/link-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authUserId: data.user!.id, email, fullName: name }),
    });

    router.push('/');
  };

  return (
    <main className="h-screen w-full bg-gray-900 flex items-center justify-center font-sans">
      <div className="w-full max-w-sm bg-white rounded-[2.5rem] border border-gray-200 shadow-xl p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter border-l-8 border-blue-600 pl-4">
            Elysian
          </h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-2 pl-5">Scheduler</p>
        </div>

        <div className="flex bg-gray-100 rounded-2xl p-1 mb-8">
          <button
            onClick={() => setTab('login')}
            className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${tab === 'login' ? 'bg-white shadow text-gray-900' : 'text-gray-400'}`}
          >
            Sign In
          </button>
          <button
            onClick={() => setTab('signup')}
            className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${tab === 'signup' ? 'bg-white shadow text-gray-900' : 'text-gray-400'}`}
          >
            Sign Up
          </button>
        </div>

        <div className="space-y-3">
          {tab === 'signup' && (
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full Name"
              className="w-full p-4 bg-gray-100 rounded-2xl font-black text-sm text-gray-900 placeholder:text-gray-400 focus:ring-4 focus:ring-blue-200 outline-none transition-all"
            />
          )}
          <input
            autoFocus={tab === 'login'}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full p-4 bg-gray-100 rounded-2xl font-black text-sm text-gray-900 placeholder:text-gray-400 focus:ring-4 focus:ring-blue-200 outline-none transition-all"
            onKeyDown={e => e.key === 'Enter' && (tab === 'login' ? handleLogin() : handleSignup())}
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full p-4 bg-gray-100 rounded-2xl font-black text-sm text-gray-900 placeholder:text-gray-400 focus:ring-4 focus:ring-blue-200 outline-none transition-all"
            onKeyDown={e => e.key === 'Enter' && (tab === 'login' ? handleLogin() : handleSignup())}
          />
        </div>

        {error && <p className="mt-4 text-red-500 text-xs font-black">{error}</p>}

        <button
          onClick={tab === 'login' ? handleLogin : handleSignup}
          disabled={loading}
          className="mt-6 w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-gray-800 active:scale-95 transition-all disabled:bg-gray-300"
        >
          {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </div>
    </main>
  );
}
