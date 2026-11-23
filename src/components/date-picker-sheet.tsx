/**
 * Pick a date. iOS: a bottom sheet with the system calendar. Android: the
 * system date dialog. (Web uses date-picker-sheet.web.tsx.)
 * Values are local calendar days, "YYYY-MM-DD".
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
  /** Starting value, "YYYY-MM-DD". */
  value: string;
  /** Latest selectable day, "YYYY-MM-DD". */
  maxDate: string;
  onCancel: () => void;
  onSave: (value: string) => void;
}

export function DatePickerSheet(props: DatePickerSheetProps) {
  if (!props.visible) return null;
  return Platform.OS === 'android' ? <AndroidDialog {...props} /> : <IosSheet {...props} />;
}

function AndroidDialog({ value, maxDate, onCancel, onSave }: DatePickerSheetProps) {
  // Rendering the component opens the system dialog; it reports back once.
  return (
    <DateTimePicker
      value={parseLocalDate(value)}
      mode="date"
      maximumDate={parseLocalDate(maxDate)}
      onChange={(event: DateTimePickerEvent, date?: Date) => {
        if (event.type === 'set' && date) onSave(localDateString(date));
        else onCancel();
      }}
    />
  );
}

function IosSheet({ title, value, maxDate, onCancel, onSave }: DatePickerSheetProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(() => parseLocalDate(value));

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onCancel} />
      <View style={[styles.sheet, { backgroundColor: theme.backgroundElement, paddingBottom: insets.bottom + Spacing.three }]}>
        <View style={styles.bar}>
          <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={10}>
            <ThemedText themeColor="textSecondary">Cancel</ThemedText>
          </Pressable>
          <ThemedText type="defaultBold">{title}</ThemedText>
          <Pressable accessibilityRole="button" onPress={() => onSave(localDateString(date))} hitSlop={10}>
            <ThemedText type="defaultBold" themeColor="accent">
              Save
            </ThemedText>
          </Pressable>
        </View>
        <DateTimePicker
          value={date}
          mode="date"
          display="inline"
          maximumDate={parseLocalDate(maxDate)}
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
