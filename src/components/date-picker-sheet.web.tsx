/**
 * Web version of DatePickerSheet: a small sheet with the browser's own date
 * input (the native date picker package doesn't support web).
 */

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

import type { DatePickerSheetProps } from './date-picker-sheet';

export function DatePickerSheet({ visible, ...rest }: DatePickerSheetProps) {
  if (!visible) return null;
  return <Sheet {...rest} />;
}

function Sheet({ title, value, mode = 'date', maxDate, minDate, onCancel, onSave }: Omit<DatePickerSheetProps, 'visible'>) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const [date, setDate] = useState(value);
  const c = Colors[dark ? 'dark' : 'light'];

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onCancel} />
      <View style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.bar}>
          <Pressable accessibilityRole="button" onPress={onCancel}>
            <ThemedText themeColor="textSecondary">Cancel</ThemedText>
          </Pressable>
          <ThemedText type="defaultBold">{title}</ThemedText>
          <Pressable accessibilityRole="button" disabled={!date} onPress={() => onSave(date)}>
            <ThemedText type="defaultBold" themeColor="accent">
              Save
            </ThemedText>
          </Pressable>
        </View>
        <input
          type={mode}
          aria-label={title}
          value={date}
          max={mode === 'date' ? maxDate : undefined}
          min={mode === 'date' ? minDate : undefined}
          onChange={(e) => setDate(e.target.value)}
          style={{
            fontFamily: FontFamily.sans[500],
            fontSize: 18,
            padding: '12px 16px',
            borderRadius: 14,
            border: `1px solid ${c.border}`,
            background: c.background,
            color: c.text,
            colorScheme: dark ? 'dark' : 'light',
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.five,
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: Radius.card + 4,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
