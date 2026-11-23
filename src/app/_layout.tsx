import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { SessionProvider, useSession } from '@/lib/auth/session';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <SplashScreenController />
          <RootNavigator />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

/** Keep the splash screen up until the stored session has been read. */
function SplashScreenController() {
  const { isLoading } = useSession();
  if (!isLoading) SplashScreen.hide();
  return null;
}

/**
 * Signed-in users see the tabs and book pages; signed-out users see only the
 * sign-in screen. Expo Router redirects automatically when the session changes.
 * https://docs.expo.dev/router/advanced/protected/
 */
function RootNavigator() {
  const { session } = useSession();
  const signedIn = Boolean(session);

  // Don't let one account's cached data show up for the next account.
  useEffect(() => {
    if (!signedIn) queryClient.clear();
  }, [signedIn]);

  return (
    <Stack>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="book/[workId]" options={{ title: '', headerBackTitle: 'Back' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
