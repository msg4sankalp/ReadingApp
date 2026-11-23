/** Home's "Picked for you": the top recommendation in a feature card, then a row of more. */

import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BookCover, Button, SectionHeader } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSeedBook, workIdFromKey } from '@/lib/library/hooks';
import { formatScore } from '@/lib/ranking';
import type { Recommendation } from '@/lib/recommend/candidates';
import { useRecommendations } from '@/lib/recommend/hooks';

export function PickedForYou() {
  const theme = useTheme();
  const seedBook = useSeedBook();
  const { recommendations, needsRankings, isLoading, error, refetch } = useRecommendations({ count: 20 });

  const open = (r: Recommendation) => {
    seedBook(r.book);
    router.push({ pathname: '/book/[workId]', params: { workId: workIdFromKey(r.book.openLibraryKey) } });
  };

  const header = (
    <SectionHeader
      title="Picked for you"
      action={recommendations.length > 0 ? 'See all' : undefined}
      onAction={() => router.push('/for-you')}
    />
  );

  if (needsRankings || isLoading || error || recommendations.length === 0) {
    return (
      <>
        {header}
        <View style={[styles.hero, styles.heroEmpty, { backgroundColor: theme.highlight }]}>
          {isLoading ? (
            <>
              <ActivityIndicator color={theme.onHighlight} />
              <ThemedText style={{ color: theme.onHighlight }}>Finding books for you…</ThemedText>
            </>
          ) : error ? (
            <>
              <ThemedText style={{ color: theme.onHighlight }}>Couldn’t load picks right now.</ThemedText>
              <Button variant="secondary" label="Try again" onPress={refetch} />
            </>
          ) : (
            <ThemedText style={{ color: theme.onHighlight }}>
              {needsRankings
                ? 'Rank a few books you’ve read and your picks appear here.'
                : 'No new picks right now. Rank more books to find more.'}
            </ThemedText>
          )}
        </View>
      </>
    );
  }

  const [top, ...rest] = recommendations;
  return (
    <>
      {header}
      <Pressable accessibilityRole="button" onPress={() => open(top)} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
        <View style={[styles.hero, { backgroundColor: theme.highlight }]}>
          <View style={styles.heroText}>
            <ThemedText type="label" style={{ color: theme.onHighlight, opacity: 0.7 }}>
              Top pick for you
            </ThemedText>
            <ThemedText type="heading" numberOfLines={3} style={{ color: theme.onHighlight }}>
              {top.book.title}
            </ThemedText>
            <ThemedText type="small" numberOfLines={1} style={{ color: theme.onHighlight, opacity: 0.8 }}>
              {top.book.authors[0] ?? ''}
            </ThemedText>
            <ThemedText type="small" numberOfLines={2} style={[styles.reason, { color: theme.onHighlight }]}>
              {top.prediction.reason}
            </ThemedText>
          </View>
          <View style={styles.heroSide}>
            <BookCover uri={top.book.coverUrl} width={84} />
            <ThemedText type="heading" style={{ color: theme.onHighlight }}>
              {formatScore(top.prediction.score, !top.prediction.confident)}
            </ThemedText>
          </View>
        </View>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {rest.slice(0, 8).map((r) => (
          <Pressable key={r.book.openLibraryKey} accessibilityRole="button" onPress={() => open(r)} style={styles.item}>
            <BookCover uri={r.book.coverUrl} width={96} />
            <ThemedText type="small" numberOfLines={2} style={styles.itemTitle}>
              {r.book.title}
            </ThemedText>
            <ThemedText type="smallBold" themeColor="accent">
              {formatScore(r.prediction.score, !r.prediction.confident)} for you
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    gap: Spacing.three,
    borderRadius: 24,
    padding: Spacing.four - 4,
    minHeight: 190,
  },
  heroEmpty: { alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: Spacing.three, borderRadius: Radius.card },
  heroText: { flex: 1, gap: Spacing.one },
  heroSide: { alignItems: 'center', gap: Spacing.two },
  reason: { marginTop: Spacing.two, fontWeight: 500 },
  row: { gap: Spacing.three - 4, paddingRight: Spacing.three, paddingTop: Spacing.three },
  item: { width: 96, gap: 2 },
  itemTitle: { marginTop: Spacing.one + 2, lineHeight: 18 },
});
