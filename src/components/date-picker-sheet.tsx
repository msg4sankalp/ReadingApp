/**
 * Pick a date. iOS: a bottom sheet with the system calendar. Android: the
 * system date dialog. (Web uses date-picker-sheet.web.tsx.)
 * Values are local calendar days, "YYYY-MM-DD", or times "HH:MM" with mode="time".
 */

import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { localDateString, parseLocalDate } from '@/lib/library/readingDates';

export interface DatePickerSheetProps {
  visible: boolean;
  title: string;
  /** Starting value: "YYYY-MM-DD", or "HH:MM" when mode is "time". */
  value: string;
  mode?: 'date' | 'time';
  /** Latest selectable day, "YYYY-MM-DD" (dates only). */
  maxDate?: string;
  /** Earliest selectable day, "YYYY-MM-DD" (dates only). */
  minDate?: string;
  onCancel: () => void;
  onSave: (value: string) => void;
}

const toDate = (value: string, mode: 'date' | 'time') => {
  if (mode === 'date') return parseLocalDate(value);
  const [h, m] = value.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};
const fromDate = (d: Date, mode: 'date' | 'time') =>
  mode === 'date'
    ? localDateString(d)
    : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function DatePickerSheet(props: DatePickerSheetProps) {
  if (!props.visible) return null;
  return Platform.OS === 'android' ? <AndroidDialog {...props} /> : <IosSheet {...props} />;
}

function AndroidDialog({ value, mode = 'date', maxDate, minDate, onCancel, onSave }: DatePickerSheetProps) {
  // Rendering the component opens the system dialog; it reports back once.
  return (
    <DateTimePicker
      value={toDate(value, mode)}
      mode={mode}
      maximumDate={maxDate ? parseLocalDate(maxDate) : undefined}
      minimumDate={minDate ? parseLocalDate(minDate) : undefined}
      onChange={(event: DateTimePickerEvent, date?: Date) => {
        if (event.type === 'set' && date) onSave(fromDate(date, mode));
        else onCancel();
      }}
    />
  );
}

function IosSheet({ title, value, mode = 'date', maxDate, minDate, onCancel, onSave }: DatePickerSheetProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(() => toDate(value, mode));

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onCancel} />
      <View style={[styles.sheet, { backgroundColor: theme.backgroundElement, paddingBottom: insets.bottom + Spacing.three }]}>
        <View style={styles.bar}>
          <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={10}>
            <ThemedText themeColor="textSecondary">Cancel</ThemedText>
          </Pressable>
          <ThemedText type="defaultBold">{title}</ThemedText>
          <Pressable accessibilityRole="button" onPress={() => onSave(fromDate(date, mode))} hitSlop={10}>
            <ThemedText type="defaultBold" themeColor="accent">
              Save
            </ThemedText>
          </Pressable>
        </View>
        <DateTimePicker
          value={date}
          mode={mode}
          display={mode === 'date' ? 'inline' : 'spinner'}
          maximumDate={maxDate ? parseLocalDate(maxDate) : undefined}
          minimumDate={minDate ? parseLocalDate(minDate) : undefined}
          accentColor={theme.accent}
          themeVariant={scheme === 'dark' ? 'dark' : 'light'}
          onChange={(_e, d) => d && setDate(d)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: Spacing.two },
});
