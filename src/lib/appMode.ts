import { isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * Demo mode: no account or database; data lives on the device and starts with
 * a pre-filled library (src/lib/demo). On when EXPO_PUBLIC_DEMO_MODE=1, or
 * automatically when Supabase isn't configured.
 */
export const isDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === '1' || !isSupabaseConfigured;
