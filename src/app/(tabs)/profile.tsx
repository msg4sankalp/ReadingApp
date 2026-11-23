import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/auth/session';
import { useLibrary } from '@/lib/library/hooks';

export default function ProfileScreen() {
  const { session, signOut } = useSession();
  const library = useLibrary();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const entries = library.data ?? [];
  const count = (status: string) => entries.filter((e) => e.status === status).length;
  const ranked = entries.filter((e) => e.score !== null).length;

  return (
    <Screen>
      <View style={styles.container}>
        <ThemedText type="subtitle">Profile</ThemedText>
        <ThemedText themeColor="textSecondary">{session?.user.email}</ThemedText>

        <View style={styles.stats}>
          <Stat label="Read" value={count('read')} />
          <Stat label="Ranked" value={ranked} />
          <Stat label="Reading" value={count('reading')} />
          <Stat label="Want to Read" value={count('want_to_read')} />
        </View>

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
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, paddingVertical: Spacing.three },
  stat: { minWidth: 72 },
});
