/**
 * Home: what you're reading, what's waiting to be ranked, your genres, and
 * (soon) books picked for you. The full shelves live one tap away in /library.
 */

import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BookCover, Button, Card, Centered, CoverBubble, ErrorText, Screen, SectionHeader } from '@/components/ui';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/auth/session';
import { CATEGORIES } from '@/lib/catalog/categories';
import { useLibrary, workIdFromKey } from '@/lib/library/hooks';
import { daysToRead, formatReadingDate, localDateString } from '@/lib/library/readingDates';
import type { LibraryEntry } from '@/lib/library/types';
import { BUCKETS } from '@/lib/ranking';

const BUCKET_ORDER = new Map(BUCKETS.map((b, i) => [b, i]));

function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning,' : h < 18 ? 'Good afternoon,' : 'Good evening,';
}

const openBook = (entry: LibraryEntry) =>
  entry.book.openLibraryKey &&
  router.push({ pathname: '/book/[workId]', params: { workId: workIdFromKey(entry.book.openLibraryKey) } });

const openRanking = (entry: LibraryEntry) =>
  entry.book.openLibraryKey &&
  router.push({ pathname: '/rank/[workId]', params: { workId: workIdFromKey(entry.book.openLibraryKey) } });

export default function HomeScreen() {
  const library = useLibrary();
  const { email } = useSession();
  const theme = useTheme();
  const name = email ? capitalize(email.split('@')[0].replace(/[^a-zA-Z].*$/, '')) || 'Reader' : 'Reader';

  const view = useMemo(() => {
    const entries = library.data ?? [];
    const ranked = entries.filter((e) => e.score !== null && e.category && e.bucket);
    const genres = CATEGORIES.map((c) => {
      const list = ranked
        .filter((e) => e.category === c.slug)
        .sort((a, b) => BUCKET_ORDER.get(a.bucket!)! - BUCKET_ORDER.get(b.bucket!)! || a.rankPosition! - b.rankPosition!);
      return { category: c, count: list.length, top: list[0] };
    })
      .filter((g) => g.count > 0)
      .sort((a, b) => b.count - a.count);
    const favorite = genres[0];
    const favoriteTop = favorite
      ? ranked
          .filter((e) => e.category === favorite.category.slug && e.bucket === 'liked')
          .sort((a, b) => a.rankPosition! - b.rankPosition!)
          .slice(0, 3)
      : [];
    return {
      reading: entries.filter((e) => e.status === 'reading'),
      wantToRead: entries.filter((e) => e.status === 'want_to_read'),
      unranked: entries.filter((e) => e.status === 'read' && e.score === null),
      genres,
      favorite,
      favoriteTop,
      rankedCount: ranked.length,
      total: entries.length,
    };
  }, [library.data]);

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

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.six }}
        refreshControl={
          <RefreshControl
            refreshing={library.isRefetching}
            onRefresh={() => {
              library.refetch();
            }}
          />
        }>
        <View style={styles.header}>
          <View style={styles.flex}>
            <ThemedText type="title" themeColor="textSecondary">
              {greeting()}
            </ThemedText>
            <ThemedText type="title">{name}</ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile"
            onPress={() => router.navigate('/profile')}
            style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
            <ThemedText type="defaultBold" themeColor="accent">
              {name[0]}
            </ThemedText>
          </Pressable>
        </View>

        {/* Continue reading */}
        <SectionHeader title="Continue reading" />
        {view.reading.length === 0 ? (
          <Card style={styles.emptyCard}>
            <ThemedText themeColor="textSecondary" style={styles.flex}>
              Nothing on the go. Find your next book.
            </ThemedText>
            <Button variant="secondary" label="Search" onPress={() => router.navigate('/search')} />
          </Card>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
            {view.reading.map((e) => {
              const days = e.startedAt ? daysToRead({ startedAt: e.startedAt, finishedAt: today }) : null;
              return (
                <Pressable key={e.bookId} onPress={() => openBook(e)} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
                  <Card style={styles.readingCard}>
                    <BookCover uri={e.book.coverUrl} width={52} />
                    <View style={styles.flex}>
                      <ThemedText type="defaultBold" numberOfLines={2}>
                        {e.book.title}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {e.book.authors[0] ?? ''}
                      </ThemedText>
                      {e.startedAt ? (
                        <ThemedText type="small" themeColor="textSecondary" style={styles.mt}>
                          Started {formatReadingDate(e.startedAt)}
                          {days !== null ? ` · day ${days + 1}` : ''}
                        </ThemedText>
                      ) : null}
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Finished but not ranked */}
        {view.unranked.length > 0 ? (
          <Pressable onPress={() => openRanking(view.unranked[0])} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
            <View style={[styles.rankPrompt, { backgroundColor: theme.accentSoft }]}>
              <View style={styles.coverStack}>
                {view.unranked.slice(0, 3).map((e, i) => (
                  <View key={e.bookId} style={{ marginLeft: i === 0 ? 0 : -22, zIndex: 3 - i }}>
                    <BookCover uri={e.book.coverUrl} width={40} />
                  </View>
                ))}
              </View>
              <View style={styles.flex}>
                <ThemedText type="defaultBold">
                  {view.unranked.length === 1 ? '1 finished book to rank' : `${view.unranked.length} finished books to rank`}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  Start with {view.unranked[0].book.title}
                </ThemedText>
              </View>
              <ThemedText type="smallBold" themeColor="accent">
                Rank ›
              </ThemedText>
            </View>
          </Pressable>
        ) : null}

        {/* Genres */}
        {view.genres.length > 0 ? (
          <>
            <SectionHeader title="Your genres" action="See rankings" onAction={() => router.navigate('/rankings')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bubbles}>
              {view.genres.map((g) => (
                <Pressable
                  key={g.category.slug}
                  accessibilityRole="button"
                  accessibilityLabel={`${g.category.name}: ${g.count} ranked`}
                  onPress={() => router.navigate('/rankings')}
                  style={styles.bubble}>
                  <CoverBubble uri={g.top?.book.coverUrl ?? null} size={76} />
                  <ThemedText type="small" style={styles.bubbleLabel} numberOfLines={2}>
                    {g.category.shortName}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.bubbleCount}>
                    {g.count} ranked
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Picked for you: honest placeholder until recommendations exist. */}
        <SectionHeader title="Picked for you" />
        <View style={[styles.highlight, { backgroundColor: theme.highlight }]}>
          <View style={styles.highlightText}>
            <ThemedText type="label" style={{ color: theme.onHighlight, opacity: 0.7 }}>
              Coming soon
            </ThemedText>
            <ThemedText type="heading" style={{ color: theme.onHighlight }}>
              {view.favorite ? `Books for your ${view.favorite.category.shortName.toLowerCase()} taste` : 'Books picked for your taste'}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.onHighlight, opacity: 0.8 }}>
              Every book you rank sharpens them. {view.rankedCount} ranked so far.
            </ThemedText>
          </View>
          {view.favoriteTop.length > 0 ? (
            <View style={styles.fan} pointerEvents="none">
              {view.favoriteTop.map((e, i) => (
                <View
                  key={e.bookId}
                  style={{
                    marginLeft: i === 0 ? 0 : -26,
                    zIndex: i === 1 ? 2 : 1,
                    transform: [{ rotate: `${(i - 1) * 9}deg` }, { translateY: i === 1 ? -6 : 6 }],
                  }}>
                  <BookCover uri={e.book.coverUrl} width={i === 1 ? 74 : 66} />
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Want to read */}
        {view.wantToRead.length > 0 ? (
          <>
            <SectionHeader title="Want to read" action="See all" onAction={() => router.push('/library')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
              {view.wantToRead.map((e) => (
                <Pressable key={e.bookId} onPress={() => openBook(e)} style={styles.wantItem}>
                  <BookCover uri={e.book.coverUrl} width={96} />
                  <ThemedText type="small" numberOfLines={2} style={styles.wantTitle}>
                    {e.book.title}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Library link */}
        <Pressable onPress={() => router.push('/library')} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
          <Card style={styles.libraryLink}>
            <View style={styles.flex}>
              <ThemedText type="defaultBold">Your library</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {view.total} books · {view.reading.length} reading · {view.wantToRead.length} want to read
              </ThemedText>
            </View>
            <ThemedText type="smallBold" themeColor="accent">
              See all ›
            </ThemedText>
          </Card>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt: { marginTop: Spacing.one },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  hRow: { gap: Spacing.three - 4, paddingRight: Spacing.three },
  readingCard: { flexDirection: 'row', gap: Spacing.three - 4, width: 290, alignItems: 'center', padding: Spacing.three - 4 },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rankPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three - 4,
    paddingRight: Spacing.three,
    borderRadius: Radius.card,
    marginTop: Spacing.three,
  },
  coverStack: { flexDirection: 'row' },
  bubbles: { gap: Spacing.three, paddingRight: Spacing.three },
  bubble: { width: 84, alignItems: 'center' },
  bubbleLabel: { textAlign: 'center', marginTop: Spacing.one + 2, lineHeight: 17, fontWeight: 500 },
  bubbleCount: { textAlign: 'center', fontSize: 12, lineHeight: 16 },
  highlight: { borderRadius: 24, height: 210, overflow: 'hidden', padding: Spacing.four - 4 },
  highlightText: { gap: Spacing.one, maxWidth: '80%' },
  fan: { position: 'absolute', right: 22, bottom: -38, flexDirection: 'row', alignItems: 'flex-end' },
  wantItem: { width: 96 },
  wantTitle: { marginTop: Spacing.one + 2, lineHeight: 18 },
  libraryLink: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.four },
});
