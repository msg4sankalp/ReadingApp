/** Shared UI building blocks for the "Warm paper" design. */

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
import { FontFamily, MaxContentWidth, Radius, Spacing, TopTabInset } from '@/constants/theme';
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
      <SafeAreaView
        edges={edges}
        style={[styles.screenInner, edges.includes('top') && { paddingTop: TopTabInset }, style]}>
        {children}
      </SafeAreaView>
    </ThemedView>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

/**
 * primary: charcoal pill for the main action.
 * secondary: card-colored pill with a hairline border.
 * ghost: accent-colored text.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  selected,
  size = 'regular',
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Secondary buttons can show a selected state, e.g. the current shelf. */
  selected?: boolean;
  size?: 'regular' | 'large';
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const look =
    variant === 'primary'
      ? { bg: theme.cta, fg: theme.onCta, border: theme.cta }
      : variant === 'secondary'
        ? selected
          ? { bg: theme.accentSoft, fg: theme.accent, border: theme.accentSoft }
          : { bg: theme.backgroundElement, fg: theme.text, border: theme.border }
        : { bg: 'transparent', fg: theme.accent, border: 'transparent' };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, selected }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        size === 'large' && styles.buttonLarge,
        {
          backgroundColor: look.bg,
          borderColor: look.border,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        <ThemedText type={size === 'large' ? 'defaultBold' : 'smallBold'} style={{ color: look.fg }}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.accentSoft : theme.backgroundElement,
          borderColor: selected ? theme.accentSoft : theme.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      <ThemedText type="small" style={{ color: selected ? theme.accent : theme.text, fontWeight: 500 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>;
}

/** Serif section heading with an optional link on the right. */
export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="heading" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {action && onAction ? (
        <Pressable accessibilityRole="link" onPress={onAction} hitSlop={8}>
          <ThemedText type="link">{action}</ThemedText>
        </Pressable>
      ) : null}
    </View>
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
        {
          color: theme.text,
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          fontFamily: FontFamily.sans[400],
        },
        props.style,
      ]}
    />
  );
}

export function BookCover({ uri, width = 56 }: { uri: string | null; width?: number }) {
  const theme = useTheme();
  const size = { width, height: Math.round(width * 1.5), borderRadius: width > 80 ? 8 : Radius.cover };
  if (!uri) {
    return (
      <View style={[size, styles.coverPlaceholder, styles.coverShadow, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="small" themeColor="textSecondary">
          📖
        </ThemedText>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[size, styles.coverShadow, { backgroundColor: theme.backgroundSelected }]}
      contentFit="cover"
      transition={150}
      accessibilityIgnoresInvertColors
    />
  );
}

/** A round crop of a book cover, used for genre bubbles. */
export function CoverBubble({ uri, size = 72 }: { uri: string | null; size?: number }) {
  const theme = useTheme();
  const style = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 3,
    borderColor: theme.backgroundElement,
    backgroundColor: theme.backgroundSelected,
  };
  return uri ? (
    <Image source={{ uri }} style={style} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
  ) : (
    <View style={[style, styles.coverPlaceholder]}>
      <ThemedText>📖</ThemedText>
    </View>
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
      <BookCover uri={coverUrl} width={52} />
      <View style={styles.bookRowText}>
        <ThemedText type="defaultBold" numberOfLines={2}>
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
    paddingHorizontal: Spacing.four - 4,
  },
  button: {
    minHeight: 46,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLarge: { minHeight: 56 },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: { borderRadius: Radius.card, padding: Spacing.three },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing.four,
    marginBottom: Spacing.three - 4,
  },
  sectionTitle: { flexShrink: 1 },
  input: {
    minHeight: 50,
    paddingHorizontal: Spacing.three + 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  coverShadow: {
    boxShadow: '0px 2px 6px rgba(34, 30, 26, 0.18)',
  },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bookRowText: { flex: 1, gap: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
});
