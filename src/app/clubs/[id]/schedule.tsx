/** Schedule a live catch-up: when, where (video link or a place), and what to discuss. */

import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DatePickerSheet } from '@/components/date-picker-sheet';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Centered, Chip, ErrorText, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { normalizeMeetingUrl } from '@/lib/clubs/logic';
import { backToClub, useClub, useClubAction } from '@/lib/clubs/hooks';
import type { NewMeetingInput } from '@/lib/clubs/types';
import { formatReadingDate, localDateString, parseLocalDate } from '@/lib/library/readingDates';

const DURATIONS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 90, label: '1.5 hours' },
  { minutes: 120, label: '2 hours' },
];

const formatTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

export default function ScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const club = useClub(id);
  const schedule = useClubAction((b, input: NewMeetingInput) => b.scheduleMeeting(input));
  const today = localDateString();

  const checkpoints = club.data?.club.current?.checkpoints ?? [];
  const reached = club.data?.reached ?? 0;
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return localDateString(d);
  });
  const [time, setTime] = useState('19:00');
  const [minutes, setMinutes] = useState(60);
  const [kind, setKind] = useState<'video' | 'place'>('video');
  const [link, setLink] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!club.data) {
    return (
      <Screen edges={['left', 'right']}>
        <Centered>{club.isError ? <ErrorText error={club.error} /> : null}</Centered>
      </Screen>
    );
  }

  // Default to discussing the part the reader is on.
  const discuss = checkpointId ?? checkpoints[reached]?.id ?? null;

  function save() {
    const [h, m] = time.split(':').map(Number);
    const start = parseLocalDate(date);
    start.setHours(h, m, 0, 0);
    if (start.getTime() < Date.now()) return setError('Pick a time in the future.');
    const url = kind === 'video' ? normalizeMeetingUrl(link) : null;
    if (kind === 'video' && !url) return setError('Paste the video call link (Zoom, Google Meet, FaceTime…).');
    if (kind === 'place' && !placeName.trim()) return setError('Say where you’re meeting.');
    setError(null);
    schedule.mutate(
      {
        clubId: id,
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
        place: kind === 'video' ? { kind: 'video', url: url! } : { kind: 'place', name: placeName.trim().slice(0, 80) },
        checkpointId: discuss,
      },
      { onSuccess: () => backToClub(id) },
    );
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="label" themeColor="textSecondary">
          When
        </ThemedText>
        <Card style={styles.fields}>
          <Field label="Date" value={formatReadingDate(date)} onPress={() => setPicker('date')} />
          <View style={[styles.rule, { backgroundColor: theme.border }]} />
          <Field label="Starts" value={formatTime(time)} onPress={() => setPicker('time')} />
        </Card>
        <View style={styles.chips}>
          {DURATIONS.map((d) => (
            <Chip key={d.minutes} label={d.label} selected={minutes === d.minutes} onPress={() => setMinutes(d.minutes)} />
          ))}
        </View>

        <ThemedText type="label" themeColor="textSecondary">
          Where
        </ThemedText>
        <View style={styles.row}>
          <Button variant="secondary" label="Video call" selected={kind === 'video'} onPress={() => setKind('video')} style={styles.flex} />
          <Button variant="secondary" label="In person" selected={kind === 'place'} onPress={() => setKind('place')} style={styles.flex} />
        </View>
        {kind === 'video' ? (
          <TextField
            value={link}
            onChangeText={setLink}
            placeholder="Paste a Zoom, Meet or FaceTime link"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Video call link"
          />
        ) : (
          <TextField value={placeName} onChangeText={setPlaceName} placeholder="e.g. Maya’s place, or a café" accessibilityLabel="Place" />
        )}

        {checkpoints.length > 0 ? (
          <>
            <ThemedText type="label" themeColor="textSecondary">
              Discuss
            </ThemedText>
            <View style={styles.chips}>
              {checkpoints.map((c) => (
                <Chip key={c.id} label={c.label} selected={discuss === c.id} onPress={() => setCheckpointId(c.id)} />
              ))}
            </View>
          </>
        ) : null}

        <ThemedText type="small" themeColor="textSecondary">
          Everyone in the club can RSVP and add it to their calendar. You’re marked as going.
        </ThemedText>
        {error ? <ErrorText error={error} /> : null}
        {schedule.isError ? <ErrorText error={schedule.error} /> : null}
        <Button size="large" label="Schedule catch-up" loading={schedule.isPending} onPress={save} />
      </ScrollView>

      {picker ? (
        <DatePickerSheet
          visible
          mode={picker}
          title={picker === 'date' ? 'Catch-up date' : 'Start time'}
          value={picker === 'date' ? date : time}
          minDate={picker === 'date' ? today : undefined}
          onCancel={() => setPicker(null)}
          onSave={(v) => {
            if (picker === 'date') setDate(v);
            else setTime(v);
            setPicker(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

function Field({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Change`} onPress={onPress} style={styles.field}>
      <ThemedText>{label}</ThemedText>
      <ThemedText type="smallBold" themeColor="accent">
        {value} ›
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.three - 4, paddingVertical: Spacing.three, paddingBottom: Spacing.six },
  fields: { paddingVertical: 0 },
  field: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  rule: { height: StyleSheet.hairlineWidth },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
});
