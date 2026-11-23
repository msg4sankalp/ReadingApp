/** Small shared UI building blocks. */

import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Screen({
  children,
  edges = ['top', 'left', 'right'],
  style,
}: {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={edges} style={[styles.screenInner, style]}>
        {children}
      </SafeAreaView>
    </ThemedView>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  selected,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Secondary buttons can show a selected state, e.g. the current shelf. */
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const filled = variant === 'primary' || selected;
  const background = filled ? theme.accent : variant === 'secondary' ? theme.backgroundElement : 'transparent';
  const color = filled ? theme.onAccent : variant === 'ghost' ? theme.accent : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, selected }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <ThemedText type="smallBold" style={{ color }}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function TextField(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[
        styles.input,
        { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
        props.style,
      ]}
    />
  );
}

export function BookCover({ uri, width = 56 }: { uri: string | null; width?: number }) {
  const theme = useTheme();
  const size = { width, height: Math.round(width * 1.5), borderRadius: width > 80 ? 8 : 4 };
  if (!uri) {
    return (
      <View style={[size, styles.coverPlaceholder, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="small" themeColor="textSecondary">
          📖
        </ThemedText>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[size, { backgroundColor: theme.backgroundSelected }]}
      contentFit="cover"
      transition={150}
      accessibilityIgnoresInvertColors
    />
  );
}

export function BookRow({
  title,
  authors,
  coverUrl,
  detail,
  trailing,
  onPress,
}: {
  title: string;
  authors: string[];
  coverUrl: string | null;
  detail?: string | null;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.bookRow, { opacity: pressed ? 0.7 : 1 }]}>
      <BookCover uri={coverUrl} />
      <View style={styles.bookRowText}>
        <ThemedText type="default" numberOfLines={2}>
          {title}
        </ThemedText>
        {authors.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {authors.slice(0, 2).join(', ')}
          </ThemedText>
        )}
        {detail ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

export function ErrorText({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <ThemedText type="small" themeColor="danger">
      {message}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' },
  screenInner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
  },
  button: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bookRowText: { flex: 1, gap: Spacing.half },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
});
