/**
 * Library: Reading, Want to Read and Read. The Read shelf is your rankings,
 * filtered by genre with chips. The selected shelf and genre live in the URL
 * (/library?shelf=read&genre=sff), so other screens can link straight to them.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BookCover, BookRow, Button, Centered, Chip, ErrorText, Screen, SegmentedControl } from '@/components/ui';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCategory, isCategorySlug } from '@/lib/catalog/categories';
import { useLibrary, workIdFromKey } from '@/lib/library/hooks';
import { daysToRead, formatReadingDate, localDateString } from '@/lib/library/readingDates';
import type { LibraryEntry, ReadingStatus } from '@/lib/library/types';
import {
  BUCKET_LABELS,
  rankedGenres,
  rankedItems,
  shelfCounts,
  shelfEntries,
  unrankedEntries,
  type GenreFilter,
  type RankedItem,
} from '@/lib/library/views';
import { formatScore, PROVISIONAL_THRESHOLD } from '@/lib/ranking';

const SHELF_ORDER: { value: ReadingStatus; label: string }[] = [
  { value: 'reading', label: 'Reading' },
  { value: 'want_to_read', label: 'Want to Read' },
  { value: 'read', label: 'Read' },
];

type Row = RankedItem | { kind: 'shelf'; entry: LibraryEntry };

const openBook = (e: LibraryEntry) =>
  e.book.openLibraryKey &&
  router.push({ pathname: '/book/[workId]', params: { workId: workIdFromKey(e.book.openLibraryKey) } });
const openRanking = (e: LibraryEntry) =>
  e.book.openLibraryKey &&
  router.push({ pathname: '/rank/[workId]', params: { workId: workIdFromKey(e.book.openLibraryKey) } });

export default function LibraryScreen() {
  const params = useLocalSearchParams<{ shelf?: string; genre?: string }>();
  const shelf: ReadingStatus =
    params.shelf === 'reading' || params.shelf === 'want_to_read' ? params.shelf : 'read';
  const library = useLibrary();
  const theme = useTheme();

  const view = useMemo(() => {
    const entries = library.data ?? [];
    const genres = rankedGenres(entries);
    const genre: GenreFilter =
      params.genre && isCategorySlug(params.genre) && genres.some((g) => g.category.slug === params.genre)
        ? params.genre
        : 'all';
    const rows: Row[] =
      shelf === 'read'
        ? rankedItems(entries, genre)
        : shelfEntries(entries, shelf).map((entry) => ({ kind: 'shelf' as const, entry }));
    return {
      counts: shelfCounts(entries),
      genres,
      genre,
      genreCount: genres.find((g) => g.category.slug === genre)?.count ?? 0,
      unranked: unrankedEntries(entries),
      rows,
    };
  }, [library.data, shelf, params.genre]);

  if (library.isPending) {
    return (
      <Screen>
        <Centered>
          <ActivityIndicator />
        </Centered>
      </Screen>
    );
  }
  if (library.isError) {
    return (
      <Screen>
        <Centered>
          <ErrorText error={library.error} />
          <Button variant="secondary" label="Try again" onPress={() => library.refetch()} />
        </Centered>
      </Screen>
    );
  }

  const today = localDateString();

  const header = (
    <View style={styles.header}>
      <ThemedText type="title">Library</ThemedText>
      <SegmentedControl
        options={SHELF_ORDER.map((s) => ({ value: s.value, label: `${s.label} · ${view.counts[s.value]}` }))}
        value={shelf}
        onChange={(value) => router.setParams({ shelf: value, genre: undefined })}
      />

      {shelf === 'read' && view.genres.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All" selected={view.genre === 'all'} onPress={() => router.setParams({ genre: undefined })} />
          {view.genres.map((g) => (
            <Chip
              key={g.category.slug}
              label={`${g.category.shortName} · ${g.count}`}
              selected={view.genre === g.category.slug}
              onPress={() => router.setParams({ genre: g.category.slug })}
            />
          ))}
        </ScrollView>
      ) : null}

      {shelf === 'read' && view.genre !== 'all' ? (
        <ThemedText type="small" themeColor="textSecondary">
          {getCategory(view.genre).name} · {view.genreCount} ranked
          {view.genreCount < PROVISIONAL_THRESHOLD
            ? ` · scores are provisional until you rank ${PROVISIONAL_THRESHOLD}`
            : ''}
        </ThemedText>
      ) : null}

      {shelf === 'read' && view.unranked.length > 0 ? (
        <Pressable onPress={() => openRanking(view.unranked[0])} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
          <View style={[styles.prompt, { backgroundColor: theme.accentSoft }]}>
            <BookCover uri={view.unranked[0].book.coverUrl} width={30} />
            <ThemedText type="defaultBold" style={styles.flex}>
              {view.unranked.length === 1 ? '1 finished book to rank' : `${view.unranked.length} finished books to rank`}
            </ThemedText>
            <ThemedText type="smallBold" themeColor="accent">
              Rank ›
            </ThemedText>
          </View>
        </Pressable>
      ) : null}
    </View>
  );

  const empty = (
    <Centered>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        {shelf === 'read'
          ? 'Nothing ranked yet. Finish a book and you’ll rank it here.'
          : shelf === 'reading'
            ? 'You’re not reading anything right now.'
            : 'Nothing on your list yet.'}
      </ThemedText>
      <Button variant="secondary" label="Find a book" onPress={() => router.navigate('/search')} />
    </Centered>
  );

  return (
    <Screen>
      <FlatList<Row>
        data={view.rows}
        keyExtractor={(row, i) => (row.kind === 'divider' ? `divider-${row.bucket}` : `${row.entry.bookId}-${i}`)}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.six, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={library.isRefetching}
            onRefresh={() => {
              library.refetch();
            }}
          />
        }
        renderItem={({ item }) => {
          if (item.kind === 'divider') {
            return (
              <View style={styles.divider}>
                <ThemedText type="label" themeColor="textSecondary">
                  {BUCKET_LABELS[item.bucket]}
                </ThemedText>
                <View style={[styles.rule, { backgroundColor: theme.border }]} />
              </View>
            );
          }
          if (item.kind === 'book') {
            const e = item.entry;
            return (
              <View style={styles.rankedRow}>
                <ThemedText type="heading" themeColor="textSecondary" style={styles.rank}>
                  {item.rank}
                </ThemedText>
                <View style={styles.flex}>
                  <BookRow
                    title={e.book.title}
                    authors={view.genre === 'all' ? [] : e.book.authors}
                    detail={view.genre === 'all' && e.category ? getCategory(e.category).shortName : null}
                    coverUrl={e.book.coverUrl}
                    trailing={
                      <ThemedText type="heading" style={styles.score}>
                        {formatScore(e.score!, item.provisional)}
                      </ThemedText>
                    }
                    onPress={() => openBook(e)}
                  />
                </View>
              </View>
            );
          }
          const e = item.entry;
          const detail =
            e.status === 'reading' && e.startedAt
              ? `Started ${formatReadingDate(e.startedAt)} · day ${(daysToRead({ startedAt: e.startedAt, finishedAt: today }) ?? 0) + 1}`
              : e.status === 'want_to_read'
                ? `Added ${formatReadingDate(localDateString(new Date(e.updatedAt)))}`
                : null;
          return (
            <BookRow title={e.book.title} authors={e.book.authors} coverUrl={e.book.coverUrl} detail={detail} onPress={() => openBook(e)} />
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  header: { gap: Spacing.three - 4, paddingTop: Spacing.three, paddingBottom: Spacing.two },
  chips: { gap: Spacing.two, paddingRight: Spacing.three },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three - 4,
    borderRadius: Radius.card - 4,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.three, marginBottom: Spacing.one },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  rankedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rank: { width: 30, textAlign: 'right', fontSize: 22 },
  score: { fontSize: 28, lineHeight: 32 },
});
