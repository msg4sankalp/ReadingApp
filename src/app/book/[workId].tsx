import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BookCover, Button, Centered, ErrorText, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getCategory } from '@/lib/catalog/categories';
import { describeReadingDates } from '@/lib/library/readingDates';
import type { ReadingStatus } from '@/lib/library/types';
import { useBook, useLibrary, useLibraryEntry, useSetShelf, useWorkDetails, workKeyFromId } from '@/lib/library/hooks';
import { formatScore, isProvisional } from '@/lib/ranking';

/** Shelf buttons in reading order: an action until chosen, then the current state. */
const BOOK_ACTIONS: { status: ReadingStatus; action: string; active: string }[] = [
  { status: 'want_to_read', action: 'Want to Read', active: 'Want to Read' },
  { status: 'reading', action: 'Start Reading', active: 'Reading' },
  { status: 'read', action: 'Mark Finished', active: 'Finished' },
];

export default function BookScreen() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const workKey = workKeyFromId(workId);

  const book = useBook(workKey);
  const details = useWorkDetails(workKey);
  const entry = useLibraryEntry(workKey);
  const library = useLibrary();
  const setShelf = useSetShelf();
  const [expanded, setExpanded] = useState(false);
  const openRanking = () => router.push({ pathname: '/rank/[workId]', params: { workId } });

  if (book.isPending) {
    return (
      <Screen edges={['left', 'right']}>
        <Centered>
          <ActivityIndicator />
        </Centered>
      </Screen>
    );
  }
  if (book.isError || !book.data) {
    return (
      <Screen edges={['left', 'right']}>
        <Centered>
          {book.isError ? (
            <ErrorText error={book.error} />
          ) : (
            <ThemedText themeColor="textSecondary">We couldn&apos;t find this book. Try searching for it.</ThemedText>
          )}
        </Centered>
      </Screen>
    );
  }

  const b = book.data;
  const currentStatus = entry.data?.status ?? null;
  const ranked = entry.data && entry.data.score !== null ? entry.data : null;
  const rankedInGenre = ranked
    ? (library.data ?? []).filter((e) => e.category === ranked.category && e.score !== null).length
    : 0;
  const chipLabels =
    ranked?.category
      ? getCategory(ranked.category)
          .chips.filter((c) => ranked.chips.includes(c.slug))
          .map((c) => c.label)
      : [];
  const description = details.data?.description;

  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: b.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <BookCover uri={b.coverUrl?.replace('-M.jpg', '-L.jpg') ?? null} width={140} />
          <View style={styles.heroText}>
            <ThemedText type="heading" style={styles.title}>
              {b.title}
            </ThemedText>
            {b.subtitle ? <ThemedText themeColor="textSecondary">{b.subtitle}</ThemedText> : null}
            <ThemedText themeColor="textSecondary">{b.authors.join(', ')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[b.firstPublishYear, b.pageCount ? `${b.pageCount} pages` : null].filter(Boolean).join(' · ')}
            </ThemedText>
            {b.suggestedCategory ? (
              <ThemedText type="smallBold">{getCategory(b.suggestedCategory).name}</ThemedText>
            ) : null}
          </View>
        </View>

        <View style={styles.shelves}>
          {BOOK_ACTIONS.map((shelf) => (
            <Button
              key={shelf.status}
              variant="secondary"
              label={currentStatus === shelf.status ? shelf.active : shelf.action}
              selected={currentStatus === shelf.status}
              loading={setShelf.isPending && setShelf.variables?.status === shelf.status}
              disabled={setShelf.isPending || entry.isPending}
              style={styles.shelfButton}
              onPress={() =>
                setShelf.mutate(
                  { book: b, status: shelf.status },
                  {
                    onSuccess: () => {
                      entry.refetch();
                      // Finishing a book goes straight into ranking it.
                      if (shelf.status === 'read' && currentStatus !== 'read') openRanking();
                    },
                  },
                )
              }
            />
          ))}
        </View>
        {setShelf.isError ? <ErrorText error={setShelf.error} /> : null}
        {entry.data && describeReadingDates(entry.data) ? (
          <ThemedText type="small" themeColor="textSecondary">
            {describeReadingDates(entry.data)}
          </ThemedText>
        ) : null}
        {ranked && ranked.category ? (
          <View style={styles.rankedBox}>
            <View style={styles.flex}>
              <ThemedText type="display" style={styles.score}>{formatScore(ranked.score!, isProvisional(rankedInGenre))}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                #{ranked.rankPosition! + 1} in {getCategory(ranked.category).name} ·{' '}
                {{ liked: 'Liked', fine: 'Fine', disliked: "Didn't like" }[ranked.bucket!]}
              </ThemedText>
              {chipLabels.length > 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {chipLabels.join(' · ')}
                </ThemedText>
              ) : null}
            </View>
            <Button variant="secondary" label="Re-rank" onPress={openRanking} />
          </View>
        ) : currentStatus === 'read' ? (
          <Button label="Rank this book" onPress={openRanking} />
        ) : null}

        {description ? (
          <View style={styles.description}>
            <ThemedText numberOfLines={expanded ? undefined : 6}>{description}</ThemedText>
            <Button
              variant="ghost"
              label={expanded ? 'Show less' : 'Show more'}
              onPress={() => setExpanded(!expanded)}
              style={styles.more}
            />
          </View>
        ) : details.isPending ? (
          <ActivityIndicator />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four, paddingVertical: Spacing.four },
  hero: { flexDirection: 'row', gap: Spacing.three },
  heroText: { flex: 1, gap: Spacing.one },
  title: { fontSize: 30, lineHeight: 34 },
  shelves: { flexDirection: 'row', gap: Spacing.two },
  shelfButton: { flex: 1, paddingHorizontal: Spacing.one, minHeight: 42 },
  description: { gap: Spacing.one },
  more: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  rankedBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  score: { fontSize: 56, lineHeight: 60 },
  flex: { flex: 1 },
});
