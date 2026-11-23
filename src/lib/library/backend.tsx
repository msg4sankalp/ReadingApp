import { createContext, use, useMemo, type PropsWithChildren } from 'react';

import { isDemoMode } from '@/lib/appMode';
import { useSession } from '@/lib/auth/session';
import { createDemoBackend, type DemoBackend } from '@/lib/demo/demoBackend';

import { createSupabaseBackend } from './supabaseBackend';
import type { LibraryBackend } from './types';

let demoBackend: DemoBackend | null = null;

/** One demo store per app run, persisted in localStorage when available. */
export function getDemoBackend(): DemoBackend {
  demoBackend ??= createDemoBackend(typeof localStorage === 'undefined' ? null : localStorage);
  return demoBackend;
}

const BackendContext = createContext<LibraryBackend | null>(null);

export function BackendProvider({ children }: PropsWithChildren) {
  const { userId } = useSession();
  const backend = useMemo(() => {
    if (!userId) return null;
    return isDemoMode ? getDemoBackend() : createSupabaseBackend(userId);
  }, [userId]);
  return <BackendContext value={backend}>{children}</BackendContext>;
}

/** The library backend. Only call inside screens that require sign-in. */
export function useBackend(): LibraryBackend {
  const backend = use(BackendContext);
  if (!backend) throw new Error('useBackend called while signed out');
  return backend;
}
