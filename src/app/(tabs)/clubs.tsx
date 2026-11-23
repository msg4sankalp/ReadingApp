import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AvatarStack } from '@/components/clubs';
import { ThemedText } from '@/components/themed-text';
import { BookCover, Button, Card, Centered, ErrorText, Screen, TextField } from '@/components/ui';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMeetingWhen, scheduleProgress } from '@/lib/clubs/logic';
import { getClubBackend, useClubAction, useClubs } from '@/lib/clubs/hooks';
import type { ClubSummary } from '@/lib/clubs/types';
import { localDateString } from '@/lib/library/readingDates';

export default function ClubsScreen() {
  const clubs = useClubs();
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const join = useClubAction((b, c: string) => b.joinClub(c));

  if (!getClubBackend()) {
    return (
      <Screen>
        <ThemedText type="title" style={styles.title}>
          Clubs
        </ThemedText>
        <Centered>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            Book clubs are coming soon for accounts. Try them in demo mode.
          </ThemedText>
        </Centered>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.six }}
        refreshControl={
          <RefreshControl
            refreshing={clubs.isRefetching}
            onRefresh={() => {
              clubs.refetch();
            }}
          />
        }>
        <ThemedText type="title" style={styles.title}>
          Clubs
        </ThemedText>

        {clubs.isPending ? (
          <ActivityIndicator />
        ) : clubs.isError ? (
          <ErrorText error={clubs.error} />
        ) : clubs.data.length === 0 ? (
          <Card style={styles.empty}>
            <ThemedText type="heading">Read together</ThemedText>
            <ThemedText themeColor="textSecondary">
              Start a club with friends: pick a book, set a reading schedule, talk about it without spoilers, and plan
              catch-ups.
            </ThemedText>
          </Card>
        ) : (
          <View style={styles.list}>
            {clubs.data.map((s) => (
              <ClubCard key={s.club.id} summary={s} />
            ))}
          </View>
        )}

        <View style={styles.actions}>
          <Button label="Start a club" onPress={() => router.push('/clubs/new')} style={styles.flex} />
          <Button variant="secondary" label="Join with code" selected={joining} onPress={() => setJoining(!joining)} style={styles.flex} />
        </View>

        {joining ? (
          <Card style={styles.join}>
            <ThemedText type="small" themeColor="textSecondary">
              Enter the invite code a friend shared with you. (Demo: try FLIP-123.)
            </ThemedText>
            <TextField
              value={code}
              onChangeText={setCode}
              placeholder="e.g. SNV-42K"
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Invite code"
            />
            {join.isError ? <ErrorText error={join.error} /> : null}
            <Button
              label="Join club"
              loading={join.isPending}
              disabled={code.trim().length < 4}
              onPress={() =>
                join.mutate(code, {
                  onSuccess: (club) => {
                    setJoining(false);
                    setCode('');
                    router.push({ pathname: '/clubs/[id]', params: { id: club.id } });
                  },
                })
              }
            />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function ClubCard({ summary }: { summary: ClubSummary }) {
  const theme = useTheme();
  const { club, members, nextMeeting, newPosts } = summary;
  const current = club.current;
  const progress = current ? scheduleProgress(current.checkpoints, current.startDate, localDateString()) : null;
  const when = nextMeeting ? formatMeetingWhen(nextMeeting) : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/clubs/[id]', params: { id: club.id } })}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          {current ? <BookCover uri={current.book.coverUrl} width={58} /> : null}
          <View style={styles.flex}>
            <ThemedText type="heading">{club.name}</ThemedText>
            {current ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {current.book.title}
              </ThemedText>
            ) : null}
            <View style={styles.membersRow}>
              <AvatarStack members={members} size={26} />
              <ThemedText type="small" themeColor="textSecondary">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </ThemedText>
            </View>
          </View>
        </View>
        {progress ? (
          <View style={[styles.bar, { backgroundColor: theme.border }]}>
            <View style={[styles.barFill, { backgroundColor: theme.accent, width: `${Math.round(progress.fraction * 100)}%` }]} />
          </View>
        ) : null}
        <View style={styles.cardBottom}>
          {when && nextMeeting ? (
            <View style={[styles.pill, { backgroundColor: theme.accentSoft }]}>
              <ThemedText type="smallBold" themeColor="accent" numberOfLines={1}>
                📅 {when.day.split(',')[0].slice(0, 3)} {when.time.split('–')[0]} ·{' '}
                {nextMeeting.place.kind === 'video' ? 'Video' : nextMeeting.place.name}
              </ThemedText>
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              No catch-up planned
            </ThemedText>
          )}
          {newPosts > 0 ? (
            <ThemedText type="smallBold" themeColor="accent">
              {newPosts} new {newPosts === 1 ? 'post' : 'posts'}
            </ThemedText>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  title: { paddingTop: Spacing.three, paddingBottom: Spacing.three },
  list: { gap: Spacing.three - 4 },
  empty: { gap: Spacing.two },
  card: { gap: Spacing.three - 4 },
  cardTop: { flexDirection: 'row', gap: Spacing.three - 4 },
  membersRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  pill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: Radius.pill, flexShrink: 1 },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.four },
  join: { gap: Spacing.three - 4, marginTop: Spacing.three - 4 },
});
