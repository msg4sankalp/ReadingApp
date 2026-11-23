/** "Predicted for you" on the page of a book the reader hasn't ranked. */

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { BookSearchResult } from '@/lib/books/openLibrary';
import { formatScore } from '@/lib/ranking';
import { usePrediction } from '@/lib/recommend/hooks';

export function PredictionCard({ book }: { book: BookSearchResult }) {
  const input = useMemo(() => ({ ...book, category: book.suggestedCategory }), [book]);
  const prediction = usePrediction(input);
  if (!prediction) return null;
  return (
    <Card style={styles.card}>
      <View style={styles.flex}>
        <ThemedText type="label" themeColor="textSecondary">
          Predicted for you
        </ThemedText>
        <ThemedText type="small" themeColor="accent" style={styles.reason}>
          {prediction.reason}
        </ThemedText>
        {!prediction.confident ? (
          <ThemedText type="small" themeColor="textSecondary">
            A rough guess; it sharpens as you rank more books.
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="display" style={styles.score}>
        {formatScore(prediction.score, !prediction.confident)}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1, gap: Spacing.one },
  reason: { fontWeight: 500 },
  score: { fontSize: 48, lineHeight: 52 },
});
