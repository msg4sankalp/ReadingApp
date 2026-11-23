import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/supabase/client';

type Mode = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const { signIn, signUp } = useSession();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canSubmit = isSupabaseConfigured && email.includes('@') && password.length >= 8;

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'sign-in') {
        await signIn(email, password);
      } else {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          setNotice('Check your email to confirm your account, then sign in.');
          setMode('sign-in');
        }
      }
      // On success the session changes and the router moves to the app.
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="subtitle">ReadingApp</ThemedText>
          <ThemedText themeColor="textSecondary">
            Rank the books you read, genre by genre.
          </ThemedText>
        </View>

        {!isSupabaseConfigured && (
          <ThemedText type="small" themeColor="danger">
            The app isn&apos;t connected to a database yet. Add EXPO_PUBLIC_SUPABASE_URL and
            EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env (see README.md), then restart.
          </ThemedText>
        )}

        <View style={styles.form}>
          <TextField
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            accessibilityLabel="Email"
          />
          <TextField
            placeholder="Password (8+ characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
            accessibilityLabel="Password"
            onSubmitEditing={() => canSubmit && submit()}
          />
          {error ? <ErrorText error={error} /> : null}
          {notice ? <ThemedText type="small">{notice}</ThemedText> : null}
          <Button
            label={mode === 'sign-in' ? 'Sign in' : 'Create account'}
            onPress={submit}
            disabled={!canSubmit}
            loading={busy}
          />
          <Button
            variant="ghost"
            label={mode === 'sign-in' ? 'New here? Create an account' : 'Have an account? Sign in'}
            onPress={() => {
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
              setError(null);
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: Spacing.five },
  header: { gap: Spacing.two },
  form: { gap: Spacing.three },
});
