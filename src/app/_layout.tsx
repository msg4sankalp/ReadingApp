import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { Colors, FontFamily } from '@/constants/theme';
import { SessionProvider, useSession } from '@/lib/auth/session';
import { BackendProvider } from '@/lib/library/backend';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Navigation chrome (headers, modal backgrounds) in the app's palette and fonts.
  const navigationTheme = useMemo(() => {
    const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
    const c = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: c.accent,
        background: c.background,
        card: c.background,
        text: c.text,
        border: c.border,
      },
      fonts: {
        regular: { fontFamily: FontFamily.sans[400], fontWeight: '400' as const },
        medium: { fontFamily: FontFamily.sans[500], fontWeight: '500' as const },
        bold: { fontFamily: FontFamily.sans[600], fontWeight: '600' as const },
        heavy: { fontFamily: FontFamily.sans[700], fontWeight: '700' as const },
      },
    };
  }, [colorScheme]);

  // If fonts fail to load, carry on with system fonts rather than a blank screen.
  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <BackendProvider>
          <ThemeProvider value={navigationTheme}>
            <SplashScreenController />
            <RootNavigator />
          </ThemeProvider>
        </BackendProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

/** Keep the splash screen up until fonts and the stored session are ready. */
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
  const { userId } = useSession();
  const signedIn = Boolean(userId);

  // Don't let one account's cached data show up for the next account.
  useEffect(() => {
    if (!signedIn) queryClient.clear();
  }, [signedIn]);

  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerBackTitle: 'Back' }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="for-you" options={{ title: 'Picked for you' }} />
        <Stack.Screen name="book/[workId]" options={{ title: '' }} />
        <Stack.Screen name="rank/[workId]" options={{ title: '', presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
