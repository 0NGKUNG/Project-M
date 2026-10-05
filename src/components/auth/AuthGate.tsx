import React, { useState } from 'react';
import { Lock, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../../db/supabaseClient';

interface AuthGateProps {
  children: React.ReactNode;
}

const AUTHORIZED_EMAIL = (import.meta.env.VITE_AUTHORIZED_EMAIL || '').toLowerCase().trim();

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  React.useEffect(() => {
    // Check initial active session
    const client = supabase;
    if (client) {
      client.auth.getSession().then((res: any) => {
        const session = res?.data?.session;
        if (session && session.user?.email?.toLowerCase() === AUTHORIZED_EMAIL.toLowerCase()) {
          setSession(session);
        } else if (session) {
          // Logged in with unauthorized email
          client.auth.signOut();
          setSession(null);
          setErrorMsg('Access Denied: This account is not authorized.');
        }
        setIsLoading(false);
      });

      const { data: { subscription } } = client.auth.onAuthStateChange((_event: any, session: any) => {
        if (session && session.user?.email?.toLowerCase() === AUTHORIZED_EMAIL.toLowerCase()) {
          setSession(session);
          setErrorMsg(null);
        } else if (session) {
          client.auth.signOut();
          setSession(null);
          setErrorMsg('Access Denied: You are not authorized to view this Vault.');
        } else {
          setSession(null);
        }
        setIsLoading(false);
      });

      return () => subscription.unsubscribe();
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setErrorMsg('Supabase is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Vercel environment variables.');
      return;
    }
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (AUTHORIZED_EMAIL && cleanEmail !== AUTHORIZED_EMAIL) {
      setErrorMsg('Access Denied: You are not authorized to access this Vault.');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: password,
        });
        if (error) throw error;
        if (data.session) {
          setSession(data.session);
        } else {
          setInfoMsg('Check your email inbox or Supabase console to confirm your account, then log in!');
          setMode('login');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password,
        });
        if (error) {
          // If user doesn't exist yet, offer easy signup
          if (error.message.toLowerCase().includes('invalid login credentials')) {
            throw new Error('Invalid password or account not created yet. If first time, switch to "Create Vault Password" below.');
          }
          throw error;
        }
        setSession(data.session);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#060608] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#101014] flex items-center justify-center text-zinc-400 border border-zinc-800 animate-pulse">
            <Lock size={20} />
          </div>
          <span className="text-xs font-mono text-zinc-500 tracking-wider">VERIFYING VAULT ACCESS...</span>
        </div>
      </div>
    );
  }

  // If user is authenticated and matches authorized owner
  if (session && (!AUTHORIZED_EMAIL || session.user?.email?.toLowerCase() === AUTHORIZED_EMAIL)) {
    return <>{children}</>;
  }

  // Otherwise, lock screen for anyone else
  return (
    <div className="min-h-screen bg-[#060608] flex flex-col justify-center items-center p-4 selection:bg-white selection:text-black">
      <div className="w-full max-w-sm bg-[#101014] rounded-2xl p-7 border border-zinc-900 shadow-2xl relative overflow-hidden animate-fade-in">
        {/* Subtle radial glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-extrabold text-white leading-tight font-display tracking-wider">XERØ</h1>
            <span className="text-[10px] text-zinc-500 font-mono">v1.0</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 text-[10px] font-mono text-zinc-400">
            <Lock size={12} className="text-emerald-400" />
            <span>ENCRYPTED</span>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-lg font-bold text-white tracking-tight">Personal Vault Access</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Private financial repository. Restricted strictly to authorized owner.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
            {infoMsg}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="text-[10px] font-mono uppercase font-bold text-zinc-400 block mb-1.5">
              Owner Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@domain.com"
              className="w-full bg-[#16161d] rounded-2xl px-4 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-white transition-all font-mono"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase font-bold text-zinc-400 block mb-1.5">
              Vault Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#16161d] rounded-2xl px-4 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-white transition-all font-mono"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-zinc-200 active:scale-98 text-black text-xs font-bold flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(255,255,255,0.15)] transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin text-black" />
            ) : (
              <>
                <span>{mode === 'login' ? 'Unlock Vault' : 'Create Vault Password'}</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-zinc-900/80 flex items-center justify-between text-[11px]">
          {mode === 'login' ? (
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
              }}
              className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              First time? Set your password
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Already have password? Log In
            </button>
          )}
          <span className="text-zinc-600 font-mono text-[10px]">ongkung.me</span>
        </div>
      </div>
    </div>
  );
};
