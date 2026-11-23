import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, ErrorText, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { isDemoMode } from '@/lib/appMode';
import { useSession } from '@/lib/auth/session';
import { getDemoBackend } from '@/lib/library/backend';
import { queryKeys, useLibrary } from '@/lib/library/hooks';

export default function ProfileScreen() {
  const { email, signOut } = useSession();
  const library = useLibrary();
  const client = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const entries = library.data ?? [];
  const count = (status: string) => entries.filter((e) => e.status === status).length;
  const ranked = entries.filter((e) => e.score !== null).length;
  const genres = new Set(entries.filter((e) => e.score !== null).map((e) => e.category)).size;

  function resetDemo() {
    const reset = () => {
      getDemoBackend().reset();
      client.invalidateQueries({ queryKey: queryKeys.library });
    };
    const message = 'This replaces your demo library with the starting books and rankings.';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) reset();
    } else {
      Alert.alert('Reset demo data?', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: reset },
      ]);
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        <ThemedText type="subtitle">Profile</ThemedText>
        {email ? <ThemedText themeColor="textSecondary">{email}</ThemedText> : null}

        <View style={styles.stats}>
          <Stat label="Ranked" value={ranked} />
          <Stat label="Genres" value={genres} />
          <Stat label="Read" value={count('read')} />
          <Stat label="Reading" value={count('reading')} />
          <Stat label="Want to Read" value={count('want_to_read')} />
        </View>

        {isDemoMode ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Demo mode</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Your library is stored on this device only, starting from a sample library. Connect a Supabase
              project to use real accounts (see README.md).
            </ThemedText>
            <Button variant="secondary" label="Reset demo data" onPress={resetDemo} />
          </ThemedView>
        ) : (
          <>
            {error ? <ErrorText error={error} /> : null}
            <Button
              variant="secondary"
              label="Sign out"
              loading={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await signOut();
                } catch (e) {
                  setError(e);
                  setBusy(false);
                }
              }}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three, paddingTop: Spacing.three },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four, paddingVertical: Spacing.three },
  stat: { minWidth: 64 },
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: 12 },
});
