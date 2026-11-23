import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BookRow, Button, Centered, ErrorText, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatReadingDate } from '@/lib/library/readingDates';
import { SHELVES, type LibraryEntry } from '@/lib/library/types';
import { useLibrary, workIdFromKey } from '@/lib/library/hooks';
import { formatScore } from '@/lib/ranking';

export default function LibraryScreen() {
  const library = useLibrary();

  const sections = useMemo(() => {
    const entries = library.data ?? [];
    return SHELVES.map((shelf) => ({
      title: shelf.label,
      data: entries.filter((e) => e.status === shelf.status),
    })).filter((s) => s.data.length > 0);
  }, [library.data]);

  if (library.isPending) {
    return (
      <Screen edges={['left', 'right']}>
        <Centered>
          <ActivityIndicator />
        </Centered>
      </Screen>
    );
  }

  if (library.isError) {
    return (
      <Screen edges={['left', 'right']}>
        <Centered>
          <ErrorText error={library.error} />
          <Button variant="secondary" label="Try again" onPress={() => library.refetch()} />
        </Centered>
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right']}>
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.bookId}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={library.isRefetching} onRefresh={() => { library.refetch(); }} />}
        contentContainerStyle={{ paddingBottom: Spacing.six, flexGrow: 1 }}
        ListEmptyComponent={
          <Centered>
            <ThemedText themeColor="textSecondary">Your library is empty.</ThemedText>
            <Button label="Find a book" onPress={() => router.navigate('/search')} />
          </Centered>
        }
        renderSectionHeader={({ section }) => (
          <ThemedText type="label" themeColor="textSecondary" style={styles.sectionHeader}>
            {section.title} · {section.data.length}
          </ThemedText>
        )}
        renderItem={({ item }) => <LibraryRow entry={item} />}
      />
    </Screen>
  );
}

function libraryDetail(entry: LibraryEntry): string | null {
  if (entry.status === 'reading' && entry.startedAt) return `Started ${formatReadingDate(entry.startedAt)}`;
  if (entry.status !== 'read') return null;
  const parts = [
    entry.finishedAt ? `Finished ${formatReadingDate(entry.finishedAt)}` : null,
    entry.score === null ? 'Not ranked yet: tap to rank' : null,
  ];
  return parts.filter(Boolean).join(' · ') || null;
}

function LibraryRow({ entry }: { entry: LibraryEntry }) {
  const { book } = entry;
  return (
    <BookRow
      title={book.title}
      authors={book.authors}
      coverUrl={book.coverUrl}
      detail={libraryDetail(entry)}
      trailing={
        entry.score !== null ? <ThemedText type="heading">{formatScore(entry.score)}</ThemedText> : null
      }
      onPress={() => {
        if (!book.openLibraryKey) return;
        const workId = workIdFromKey(book.openLibraryKey);
        if (entry.status === 'read' && entry.score === null) router.push({ pathname: '/rank/[workId]', params: { workId } });
        else router.push({ pathname: '/book/[workId]', params: { workId } });
      }}
    />
  );
}

const styles = StyleSheet.create({
  sectionHeader: { paddingTop: Spacing.four, paddingBottom: Spacing.one },
});
