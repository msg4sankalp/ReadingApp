import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BookRow, Button, Centered, ErrorText, Screen } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { CATEGORIES, getCategory } from '@/lib/catalog/categories';
import { useLibrary, workIdFromKey } from '@/lib/library/hooks';
import type { LibraryEntry } from '@/lib/library/types';
import { BUCKETS, formatScore, isProvisional } from '@/lib/ranking';

type View_ = 'genre' | 'all';

interface Section {
  key: string;
  title: string;
  note: string | null;
  data: LibraryEntry[];
}

const BUCKET_ORDER = new Map(BUCKETS.map((b, i) => [b, i]));

export default function RankingsScreen() {
  const library = useLibrary();
  const [view, setView] = useState<View_>('genre');

  const { sections, unrankedCount } = useMemo((): { sections: Section[]; unrankedCount: number } => {
    const ranked = (library.data ?? []).filter((e) => e.score !== null && e.category && e.bucket);
    const unranked = (library.data ?? []).filter((e) => e.status === 'read' && e.score === null).length;

    if (view === 'all') {
      const all = [...ranked].sort((a, b) => b.score! - a.score! || a.book.title.localeCompare(b.book.title));
      return { sections: all.length ? [{ key: 'all', title: `All books · ${all.length}`, note: null, data: all }] : [], unrankedCount: unranked };
    }

    const byGenre = CATEGORIES.map((c) => {
      const data = ranked
        .filter((e) => e.category === c.slug)
        .sort((a, b) => BUCKET_ORDER.get(a.bucket!)! - BUCKET_ORDER.get(b.bucket!)! || a.rankPosition! - b.rankPosition!);
      return {
        key: c.slug,
        title: `${c.name} · ${data.length}`,
        note: isProvisional(data.length) ? 'Provisional: rank 5 books in this genre for reliable scores' : null,
        data,
      };
    }).filter((s) => s.data.length > 0);
    return { sections: byGenre, unrankedCount: unranked };
  }, [library.data, view]);

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
        </Centered>
      </Screen>
    );
  }

  const countsByCategory = new Map<string, number>();
  for (const e of library.data) {
    if (e.score !== null && e.category) countsByCategory.set(e.category, (countsByCategory.get(e.category) ?? 0) + 1);
  }

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.bookId}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={library.isRefetching}
            onRefresh={() => {
              library.refetch();
            }}
          />
        }
        contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.three, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="subtitle">Rankings</ThemedText>
            <View style={styles.toggle}>
              <Button
                variant="secondary"
                label="By genre"
                selected={view === 'genre'}
                onPress={() => setView('genre')}
                style={styles.flex}
              />
              <Button
                variant="secondary"
                label="All books"
                selected={view === 'all'}
                onPress={() => setView('all')}
                style={styles.flex}
              />
            </View>
            {unrankedCount > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {unrankedCount} read {unrankedCount === 1 ? 'book is' : 'books are'} waiting to be ranked. Find{' '}
                {unrankedCount === 1 ? 'it' : 'them'} in your Library.
              </ThemedText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Centered>
            <ThemedText themeColor="textSecondary">Nothing ranked yet.</ThemedText>
            <Button label="Find a book" onPress={() => router.navigate('/search')} />
          </Centered>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {section.title.toUpperCase()}
            </ThemedText>
            {section.note ? (
              <ThemedText type="small" themeColor="textSecondary">
                {section.note}
              </ThemedText>
            ) : null}
          </View>
        )}
        renderItem={({ item, index }) => (
          <RankedRow
            entry={item}
            rank={index + 1}
            showGenre={view === 'all'}
            provisional={isProvisional(countsByCategory.get(item.category!) ?? 0)}
          />
        )}
      />
    </Screen>
  );
}

function RankedRow({
  entry,
  rank,
  showGenre,
  provisional,
}: {
  entry: LibraryEntry;
  rank: number;
  showGenre: boolean;
  provisional: boolean;
}) {
  const { book } = entry;
  return (
    <View style={styles.rankedRow}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rank}>
        {rank}
      </ThemedText>
      <View style={styles.flex}>
        <BookRow
          title={book.title}
          authors={book.authors}
          coverUrl={book.coverUrl}
          detail={showGenre && entry.category ? getCategory(entry.category).name : null}
          trailing={<ThemedText style={styles.score}>{formatScore(entry.score!, provisional)}</ThemedText>}
          onPress={() =>
            book.openLibraryKey &&
            router.push({ pathname: '/book/[workId]', params: { workId: workIdFromKey(book.openLibraryKey) } })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.two },
  toggle: { flexDirection: 'row', gap: Spacing.two },
  sectionHeader: { paddingTop: Spacing.four, paddingBottom: Spacing.one, gap: Spacing.half },
  rankedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rank: { width: 24, textAlign: 'right' },
  score: { fontSize: 18, fontWeight: 700 },
  flex: { flex: 1 },
});
