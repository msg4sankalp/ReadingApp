/**
 * Auth session context, following the Expo Router authentication guide
 * (https://docs.expo.dev/router/advanced/authentication/) with Supabase Auth
 * as the provider. In demo mode there is no sign-in: a fixed demo user is
 * always signed in.
 */

import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { isDemoMode } from '@/lib/appMode';
import { supabase } from '@/lib/supabase/client';

export const DEMO_USER_ID = 'demo-user';

interface SessionContextValue {
  /** The signed-in user's id, or null when signed out. */
  userId: string | null;
  email: string | null;
  /** True until the stored session has been read on startup. */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns needsConfirmation: true when the account must confirm its email first. */
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
  const { userId } = useSession();
  if (!userId) throw new Error('useUserId called while signed out');
  return userId;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(!isDemoMode);

  useEffect(() => {
    if (isDemoMode) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      userId: isDemoMode ? DEMO_USER_ID : (session?.user.id ?? null),
      email: isDemoMode ? null : (session?.user.email ?? null),
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
        if (isDemoMode) return;
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, isLoading],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
