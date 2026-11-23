import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BookCover, Button, Centered, ErrorText, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getCategory } from '@/lib/catalog/categories';
import { SHELVES } from '@/lib/library/api';
import { useBook, useLibraryEntry, useSetShelf, useWorkDetails, workKeyFromId } from '@/lib/library/hooks';
import { formatScore } from '@/lib/ranking';

export default function BookScreen() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const workKey = workKeyFromId(workId);

  const book = useBook(workKey);
  const details = useWorkDetails(workKey);
  const entry = useLibraryEntry(workKey);
  const setShelf = useSetShelf();
  const [expanded, setExpanded] = useState(false);

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
  const description = details.data?.description;

  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: b.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <BookCover uri={b.coverUrl?.replace('-M.jpg', '-L.jpg') ?? null} width={140} />
          <View style={styles.heroText}>
            <ThemedText type="default" style={styles.title}>
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
          {SHELVES.map((shelf) => (
            <Button
              key={shelf.status}
              variant="secondary"
              label={shelf.label}
              selected={currentStatus === shelf.status}
              loading={setShelf.isPending && setShelf.variables?.status === shelf.status}
              disabled={setShelf.isPending || entry.isPending}
              style={styles.shelfButton}
              onPress={() =>
                setShelf.mutate({ book: b, status: shelf.status }, { onSuccess: () => entry.refetch() })
              }
            />
          ))}
        </View>
        {setShelf.isError ? <ErrorText error={setShelf.error} /> : null}
        {entry.data?.score !== null && entry.data?.score !== undefined ? (
          <ThemedText type="smallBold">Your score: {formatScore(Number(entry.data.score))}</ThemedText>
        ) : currentStatus === 'read' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Not ranked yet. Ranking is coming in the next update.
          </ThemedText>
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
  title: { fontSize: 22, lineHeight: 28, fontWeight: 700 },
  shelves: { flexDirection: 'row', gap: Spacing.two },
  shelfButton: { flex: 1, paddingHorizontal: Spacing.one },
  description: { gap: Spacing.one },
  more: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
