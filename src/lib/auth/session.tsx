/**
 * Auth session context, following the Expo Router authentication guide
 * (https://docs.expo.dev/router/advanced/authentication/) with Supabase Auth
 * as the provider.
 */

import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';

interface SessionContextValue {
  session: Session | null;
  /** True until the stored session has been read on startup. */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns true when the account needs email confirmation before signing in. */
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

/** The signed-in user's id. Only call inside screens that require sign-in. */
export function useUserId(): string {
  const { session } = useSession();
  if (!session) throw new Error('useUserId called while signed out');
  return session.user.id;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      isLoading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      },
      async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        return { needsConfirmation: !data.session };
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, isLoading],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
