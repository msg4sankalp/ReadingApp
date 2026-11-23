/** "Picked for you": every recommendation, with its prediction, reason and actions. */

import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BookCover, Button, Centered, ErrorText, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCategory } from '@/lib/catalog/categories';
import { useSeedBook, workIdFromKey } from '@/lib/library/hooks';
import { formatScore } from '@/lib/ranking';
import type { Recommendation } from '@/lib/recommend/candidates';
import { useRecommendationAction, useRecommendations } from '@/lib/recommend/hooks';

export default function ForYouScreen() {
  const { recommendations, taste, needsRankings, isLoading, error, refetch } = useRecommendations({ count: 20 });

  if (isLoading) {
    return (
      <Screen edges={['left', 'right']}>
        <Centered>
          <ActivityIndicator />
          <ThemedText themeColor="textSecondary">Finding books for you…</ThemedText>
        </Centered>
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen edges={['left', 'right']}>
        <Centered>
          <ErrorText error={error} />
          <Button variant="secondary" label="Try again" onPress={refetch} />
        </Centered>
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right']}>
      <FlatList
        data={recommendations}
        keyExtractor={(r) => r.book.openLibraryKey}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
            {taste
              ? `Based on the ${taste.totalRanked} books you’ve ranked. Predictions marked ~ are rough; they sharpen as you rank more.`
              : ''}
          </ThemedText>
        }
        ListEmptyComponent={
          <Centered>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              {needsRankings ? 'Rank a few books you’ve read to get picks.' : 'No new picks right now.'}
            </ThemedText>
          </Centered>
        }
        renderItem={({ item }) => <PickRow rec={item} />}
      />
    </Screen>
  );
}

function PickRow({ rec }: { rec: Recommendation }) {
  const theme = useTheme();
  const seedBook = useSeedBook();
  const action = useRecommendationAction();
  const { book, prediction } = rec;
  const workId = workIdFromKey(book.openLibraryKey);
  const busy = action.isPending;

  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          seedBook(book);
          router.push({ pathname: '/book/[workId]', params: { workId } });
        }}
        style={({ pressed }) => [styles.top, { opacity: pressed ? 0.7 : 1 }]}>
        <BookCover uri={book.coverUrl} width={64} />
        <View style={styles.flex}>
          <ThemedText type="defaultBold" numberOfLines={2}>
            {book.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {[book.authors[0], getCategory(rec.category).shortName].filter(Boolean).join(' · ')}
          </ThemedText>
          <ThemedText type="small" themeColor="accent" numberOfLines={2} style={styles.reason}>
            {prediction.reason}
          </ThemedText>
        </View>
        <View style={styles.score}>
          <ThemedText type="heading">{formatScore(prediction.score, !prediction.confident)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            for you
          </ThemedText>
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Button
          variant="secondary"
          label="Want to Read"
          disabled={busy}
          onPress={() => action.mutate({ book, action: 'want_to_read', predictedScore: prediction.score })}
          style={styles.flex}
        />
        <Button
          variant="secondary"
          label="Already read"
          disabled={busy}
          onPress={() =>
            action.mutate(
              { book, action: 'already_read', predictedScore: prediction.score },
              {
                onSuccess: () => {
                  seedBook(book);
                  router.push({ pathname: '/rank/[workId]', params: { workId } });
                },
              },
            )
          }
          style={styles.flex}
        />
        <Button
          variant="ghost"
          label="Not interested"
          disabled={busy}
          onPress={() => action.mutate({ book, action: 'dismissed', predictedScore: prediction.score })}
        />
      </View>
      {action.isError ? <ErrorText error={action.error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  list: { paddingBottom: Spacing.six, flexGrow: 1 },
  intro: { paddingTop: Spacing.three, paddingBottom: Spacing.two },
  row: { paddingVertical: Spacing.three, gap: Spacing.three - 4, borderBottomWidth: StyleSheet.hairlineWidth },
  top: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  reason: { marginTop: Spacing.one, fontWeight: 500 },
  score: { alignItems: 'center', minWidth: 52 },
  actions: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
});
