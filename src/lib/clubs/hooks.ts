import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { isDemoMode } from '@/lib/appMode';

import { createDemoClubBackend, type DemoClubBackend } from './demoClubs';
import type { ClubBackend } from './types';

let demo: DemoClubBackend | null = null;

/** Clubs run on-device in demo mode. With real accounts they arrive with the Supabase version. */
export function getClubBackend(): ClubBackend | null {
  if (!isDemoMode) return null;
  demo ??= createDemoClubBackend(typeof localStorage === 'undefined' ? null : localStorage);
  return demo;
}

export function resetDemoClubs() {
  if (isDemoMode) (getClubBackend() as DemoClubBackend).reset();
}

/** Go back, or to the club (or Clubs tab) when the screen was opened directly from a link. */
export function backToClub(clubId?: string) {
  if (router.canGoBack()) router.back();
  else if (clubId) router.replace({ pathname: '/clubs/[id]', params: { id: clubId } });
  else router.replace('/clubs');
}

export const clubKeys = {
  all: ['clubs'] as const,
  list: () => ['clubs', 'list'] as const,
  detail: (id: string) => ['clubs', 'detail', id] as const,
};

export function useClubs() {
  const backend = getClubBackend();
  return useQuery({ queryKey: clubKeys.list(), queryFn: () => backend!.listClubs(), enabled: Boolean(backend) });
}

export function useClub(clubId: string) {
  const backend = getClubBackend();
  return useQuery({ queryKey: clubKeys.detail(clubId), queryFn: () => backend!.getClub(clubId), enabled: Boolean(backend) });
}

/** Run a club change, then refresh every club view. */
export function useClubAction<TArgs, TResult>(run: (backend: ClubBackend, args: TArgs) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => {
      const backend = getClubBackend();
      if (!backend) throw new Error('Book clubs aren’t available yet with accounts.');
      return run(backend, args);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: clubKeys.all }),
  });
}
