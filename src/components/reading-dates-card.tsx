/** Start and finish dates on the book page; tap a row to change it. */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DatePickerSheet } from '@/components/date-picker-sheet';
import { ThemedText } from '@/components/themed-text';
import { Card, ErrorText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSetDates } from '@/lib/library/hooks';
import { daysToRead, formatReadingDate, localDateString, validateReadingDates } from '@/lib/library/readingDates';
import type { LibraryEntry } from '@/lib/library/types';

type Field = 'startedAt' | 'finishedAt';

export function ReadingDatesCard({ entry }: { entry: LibraryEntry }) {
  const theme = useTheme();
  const setDates = useSetDates();
  const [editing, setEditing] = useState<Field | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = localDateString();

  // Dates only make sense once you've started (start) or finished (both).
  const fields: { field: Field; label: string }[] =
    entry.status === 'read'
      ? [
          { field: 'startedAt', label: 'Started' },
          { field: 'finishedAt', label: 'Finished' },
        ]
      : entry.status === 'reading'
        ? [{ field: 'startedAt', label: 'Started' }]
        : [];
  if (fields.length === 0) return null;

  const days = daysToRead(entry);

  async function save(field: Field, value: string) {
    const next = { startedAt: entry.startedAt, finishedAt: entry.finishedAt, [field]: value };
    const problem = validateReadingDates(next, today);
    setEditing(null);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    await setDates.mutateAsync({ bookId: entry.bookId, ...next }).catch((e) => setError(String(e?.message ?? e)));
  }

  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        {fields.map(({ field, label }, i) => {
          const value = entry[field];
          return (
            <Pressable
              key={field}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${value ? formatReadingDate(value) : 'not set'}. Change date`}
              onPress={() => setEditing(field)}
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                { opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText>{label}</ThemedText>
              <ThemedText type="smallBold" themeColor={value ? 'accent' : 'textSecondary'}>
                {value ? formatReadingDate(value) : 'Add date'} ›
              </ThemedText>
            </Pressable>
          );
        })}
      </Card>
      {days !== null ? (
        <ThemedText type="small" themeColor="textSecondary">
          {days === 0 ? 'Read in a day' : `Read in ${days} ${days === 1 ? 'day' : 'days'}`}
        </ThemedText>
      ) : null}
      {error ? <ErrorText error={error} /> : null}

      {editing ? (
        <DatePickerSheet
          visible
          title={editing === 'startedAt' ? 'Started reading' : 'Finished reading'}
          value={entry[editing] ?? (editing === 'finishedAt' ? today : (entry.finishedAt ?? today))}
          maxDate={today}
          onCancel={() => setEditing(null)}
          onSave={(value) => save(editing, value)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  card: { paddingVertical: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
});
