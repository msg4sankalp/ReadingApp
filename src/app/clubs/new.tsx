/** Start a club: name, first book, weekly reading schedule. */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DatePickerSheet } from '@/components/date-picker-sheet';
import { ThemedText } from '@/components/themed-text';
import { BookCover, BookRow, Button, Card, Chip, ErrorText, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { BookSearchResult } from '@/lib/books/openLibrary';
import { makeSchedule } from '@/lib/clubs/logic';
import { useClubAction } from '@/lib/clubs/hooks';
import type { NewClubInput } from '@/lib/clubs/types';
import { useBackend } from '@/lib/library/backend';
import { useBookSearch, useDebouncedValue, useLibrary } from '@/lib/library/hooks';
import { formatReadingDate, localDateString } from '@/lib/library/readingDates';

const WEEKS = [2, 3, 4, 6];

export default function NewClubScreen() {
  const theme = useTheme();
  const library = useLibrary();
  const backend = useBackend();
  const create = useClubAction((b, input: NewClubInput) => b.createClub(input));
  const [name, setName] = useState('');
  const [book, setBook] = useState<BookSearchResult | null>(null);
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 350);
  const search = useBookSearch(debounced);
  const [weeks, setWeeks] = useState(4);
  const [startDate, setStartDate] = useState(localDateString());
  const [picking, setPicking] = useState(false);

  // Suggestions from the reader's own shelves (books they're reading or want to read).
  const suggestions = useMemo(
    () =>
      (library.data ?? [])
        .filter((e) => e.status !== 'read' && e.book.openLibraryKey)
        .slice(0, 6)
        .map<BookSearchResult>((e) => ({
          openLibraryKey: e.book.openLibraryKey!,
          title: e.book.title,
          subtitle: null,
          authors: e.book.authors,
          coverUrl: e.book.coverUrl,
          firstPublishYear: null,
          pageCount: null,
          isbn13: null,
          subjects: e.book.subjects,
          suggestedCategory: e.category,
        })),
    [library.data],
  );
  const preview = book ? makeSchedule({ startDate, weeks, pageCount: book.pageCount }) : [];

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="label" themeColor="textSecondary">
          Name
        </ThemedText>
        <TextField value={name} onChangeText={setName} placeholder="e.g. Sunday Novels" maxLength={60} accessibilityLabel="Club name" />

        <ThemedText type="label" themeColor="textSecondary">
          First book
        </ThemedText>
        {book ? (
          <Card style={styles.picked}>
            <BookCover uri={book.coverUrl} width={44} />
            <View style={styles.flex}>
              <ThemedText type="defaultBold" numberOfLines={2}>
                {book.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[book.authors[0], book.pageCount ? `${book.pageCount} pages` : null].filter(Boolean).join(' · ')}
              </ThemedText>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setBook(null)} hitSlop={10}>
              <ThemedText type="smallBold" themeColor="accent">
                Change
              </ThemedText>
            </Pressable>
          </Card>
        ) : (
          <View style={styles.pickBook}>
            {suggestions.length > 0 && !query ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  From your shelves
                </ThemedText>
                {suggestions.map((s) => (
                  <BookRow
                    key={s.openLibraryKey}
                    title={s.title}
                    authors={s.authors}
                    coverUrl={s.coverUrl}
                    onPress={() => {
                      setBook(s);
                      // The shelf entry has no page count; the catalog record does.
                      backend
                        .fetchCatalogBookByWork(s.openLibraryKey)
                        .then((full) => full && setBook((cur) => (cur?.openLibraryKey === full.openLibraryKey ? full : cur)))
                        .catch(() => {});
                    }}
                  />
                ))}
              </>
            ) : null}
            <TextField value={query} onChangeText={setQuery} placeholder="Or search for a book" autoCorrect={false} accessibilityLabel="Search for a book" />
            {query.trim().length >= 2 ? (
              search.isPending ? (
                <ActivityIndicator />
              ) : search.isError ? (
                <ErrorText error={search.error} />
              ) : (
                search.data.slice(0, 6).map((b) => (
                  <BookRow
                    key={b.openLibraryKey}
                    title={b.title}
                    authors={b.authors}
                    coverUrl={b.coverUrl}
                    detail={b.pageCount ? `${b.pageCount} pages` : null}
                    onPress={() => {
                      setBook(b);
                      setQuery('');
                    }}
                  />
                ))
              )
            ) : null}
          </View>
        )}

        <ThemedText type="label" themeColor="textSecondary">
          Reading schedule
        </ThemedText>
        <View style={styles.chips}>
          {WEEKS.map((w) => (
            <Chip key={w} label={`${w} weeks`} selected={weeks === w} onPress={() => setWeeks(w)} />
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={() => setPicking(true)} style={[styles.start, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText>Starts</ThemedText>
          <ThemedText type="smallBold" themeColor="accent">
            {startDate === localDateString() ? 'Today' : formatReadingDate(startDate)} ›
          </ThemedText>
        </Pressable>
        {preview.length > 0 ? (
          <Card style={styles.preview}>
            {preview.map((c, i) => (
              <View key={c.id} style={styles.previewRow}>
                <ThemedText type="small">
                  Week {i + 1} · by {formatReadingDate(c.dueDate)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {c.label}
                </ThemedText>
              </View>
            ))}
          </Card>
        ) : null}

        {create.isError ? <ErrorText error={create.error} /> : null}
        <Button
          size="large"
          label="Create club"
          loading={create.isPending}
          disabled={!name.trim() || !book}
          onPress={() =>
            create.mutate(
              { name, book: book!, weeks, startDate },
              { onSuccess: (club) => router.replace({ pathname: '/clubs/[id]', params: { id: club.id, invite: '1' } }) },
            )
          }
        />
      </ScrollView>
      {picking ? (
        <DatePickerSheet
          visible
          title="Club starts"
          value={startDate}
          minDate={localDateString()}
          onCancel={() => setPicking(false)}
          onSave={(v) => {
            setStartDate(v);
            setPicking(false);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.three - 4, paddingVertical: Spacing.three, paddingBottom: Spacing.six },
  picked: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  pickBook: { gap: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  start: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.three, borderRadius: 16 },
  preview: { gap: Spacing.one },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
