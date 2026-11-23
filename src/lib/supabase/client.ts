/**
 * Supabase client for the app.
 *
 * Configure with a `.env` file in the project root (see `.env.example`).
 * EXPO_PUBLIC_ variables are bundled into the app. That's fine for these two:
 * the publishable key is designed to be public, and Row Level Security
 * protects the data. Never put a secret key or the database password in the app.
 *
 * Setup follows https://docs.expo.dev/guides/using-supabase/ (SDK 58).
 */

import './storage';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);

export const supabase = createClient(url ?? 'http://localhost:54321', publishableKey ?? 'not-configured', {
  auth: {
    // expo-sqlite provides localStorage on Android and iOS (see storage.native.ts),
    // so sessions survive app restarts. On web this is the browser's
    // localStorage; during web server rendering there is none.
    storage: typeof localStorage === 'undefined' ? undefined : localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh the session while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
