import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { AvatarStack, PostCard } from '@/components/clubs';
import { ThemedText } from '@/components/themed-text';
import { BookCover, Button, Card, Centered, ErrorText, Screen, SectionHeader } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ME } from '@/lib/clubs/demoClubs';
import { calendarLink, formatMeetingWhen, isUnlocked, nextMeeting, rsvpCounts, scheduleProgress, visiblePosts } from '@/lib/clubs/logic';
import { backToClub, clubKeys, getClubBackend, useClub, useClubAction } from '@/lib/clubs/hooks';
import type { ClubDetail, Meeting, Rsvp } from '@/lib/clubs/types';
import { localDateString } from '@/lib/library/readingDates';

function confirm(title: string, message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: title, style: 'destructive', onPress: onYes },
    ]);
  }
}

export default function ClubScreen() {
  const { id, invite } = useLocalSearchParams<{ id: string; invite?: string }>();
  const club = useClub(id);
  const client = useQueryClient();

  // Opening the club clears its "new posts" count.
  useEffect(() => {
    getClubBackend()
      ?.markSeen(id)
      .then(() => client.invalidateQueries({ queryKey: clubKeys.list() }));
  }, [id, client]);

  if (club.isPending) {
    return (
      <Screen edges={['left', 'right']}>
        <Centered>
          <ActivityIndicator />
        </Centered>
      </Screen>
    );
  }
  if (club.isError || !club.data) {
    return (
      <Screen edges={['left', 'right']}>
        <Centered>
          {club.isError ? <ErrorText error={club.error} /> : <ThemedText themeColor="textSecondary">This club isn’t available.</ThemedText>}
        </Centered>
      </Screen>
    );
  }
  return <ClubHome detail={club.data} inviteOpen={invite === '1'} />;
}

function ClubHome({ detail, inviteOpen }: { detail: ClubDetail; inviteOpen: boolean }) {
  const theme = useTheme();
  const { club, members, reached, posts, meetings } = detail;
  const [showInvite, setShowInvite] = useState(inviteOpen);
  const like = useClubAction((b, postId: string) => b.toggleLike(postId));
  const leave = useClubAction((b, clubId: string) => b.leaveClub(clubId));

  const current = club.current;
  const today = localDateString();
  const progress = current ? scheduleProgress(current.checkpoints, current.startDate, today) : null;
  const next = nextMeeting(meetings);
  const later = meetings.filter((m) => m !== next && new Date(m.endsAt) > new Date());
  const memberById = new Map(members.map((m) => [m.id, m]));
  const checkpointLabel = new Map((current?.checkpoints ?? []).map((c) => [c.id, c.label]));
  const latest = current ? visiblePosts(posts, current.checkpoints, reached).slice(0, 3) : [];
  const replyCount = (postId: string) => posts.filter((p) => p.parentId === postId).length;
  const names = members.map((m) => m.name);
  const namesText = names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={() => setShowInvite(!showInvite)} hitSlop={10}>
              <ThemedText type="smallBold" themeColor="accent">
                Invite
              </ThemedText>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="title">{club.name}</ThemedText>
        <View style={styles.membersRow}>
          <AvatarStack members={members} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {namesText}
          </ThemedText>
        </View>

        {showInvite ? (
          <Card style={styles.invite}>
            <View style={styles.flex}>
              <ThemedText style={styles.code}>{club.code}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Friends join with this code from the Clubs tab.
              </ThemedText>
            </View>
            <Button
              variant="secondary"
              label="Share"
              onPress={() =>
                Share.share({ message: `Join my book club "${club.name}" on Flip with the code ${club.code}` }).catch(() => {})
              }
            />
          </Card>
        ) : null}

        {current && progress ? (
          <Card style={styles.reading}>
            <View style={styles.row}>
              <BookCover uri={current.book.coverUrl} width={54} />
              <View style={styles.flex}>
                <ThemedText type="label" themeColor="textSecondary">
                  Now reading
                </ThemedText>
                <ThemedText type="defaultBold" numberOfLines={2}>
                  {current.book.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Week {progress.week} of {progress.weeks} · you’re on {current.checkpoints[reached]?.label}
                </ThemedText>
              </View>
            </View>
            <View style={[styles.bar, { backgroundColor: theme.border }]}>
              <View style={[styles.barFill, { backgroundColor: theme.accent, width: `${Math.round(progress.fraction * 100)}%` }]} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ticks}>
              {current.checkpoints.map((c, i) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/clubs/[id]/discussion', params: { id: club.id, cp: c.id } })}
                  style={[styles.tick, { borderColor: i === progress.current ? theme.accent : theme.border }]}>
                  <ThemedText type="small" style={{ fontWeight: 600 }}>
                    {isUnlocked(i, reached) ? '' : '🔒 '}
                    {c.label}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    by {new Date(`${c.dueDate}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </Card>
        ) : null}

        <SectionHeader
          title="Next catch-up"
          action="Schedule"
          onAction={() => router.push({ pathname: '/clubs/[id]/schedule', params: { id: club.id } })}
        />
        {next ? (
          <MeetingCard meeting={next} clubName={club.name} label={next.checkpointId ? checkpointLabel.get(next.checkpointId) : undefined} canCancel={club.ownerId === ME} />
        ) : (
          <Card style={styles.emptyMeeting}>
            <ThemedText themeColor="textSecondary" style={styles.flex}>
              Nothing planned yet.
            </ThemedText>
            <Button variant="secondary" label="Schedule" onPress={() => router.push({ pathname: '/clubs/[id]/schedule', params: { id: club.id } })} />
          </Card>
        )}
        {later.map((m) => {
          const w = formatMeetingWhen(m);
          return (
            <ThemedText key={m.id} type="small" themeColor="textSecondary" style={styles.later}>
              Also: {w.day}, {w.time} · {m.place.kind === 'video' ? 'Video call' : m.place.name}
            </ThemedText>
          );
        })}

        <SectionHeader
          title="Discussion"
          action="See all"
          onAction={() => router.push({ pathname: '/clubs/[id]/discussion', params: { id: club.id } })}
        />
        {latest.length === 0 ? (
          <Card>
            <ThemedText themeColor="textSecondary">No posts yet. Start the conversation.</ThemedText>
          </Card>
        ) : (
          <View style={styles.posts}>
            {latest.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                author={memberById.get(p.authorId)}
                meta={checkpointLabel.get(p.checkpointId)}
                replies={replyCount(p.id)}
                onLike={() => like.mutate(p.id)}
                onPress={() => router.push({ pathname: '/clubs/[id]/post/[postId]', params: { id: club.id, postId: p.id } })}
              />
            ))}
          </View>
        )}

        <Button
          variant="ghost"
          label="Leave club"
          style={styles.leave}
          onPress={() =>
            confirm('Leave club', `You’ll stop seeing ${club.name}. You can rejoin with the invite code.`, () =>
              leave.mutate(club.id, { onSuccess: () => backToClub() }),
            )
          }
        />
      </ScrollView>
    </Screen>
  );
}

function MeetingCard({ meeting, clubName, label, canCancel }: { meeting: Meeting; clubName: string; label?: string; canCancel: boolean }) {
  const theme = useTheme();
  const rsvp = useClubAction((b, r: Rsvp) => b.rsvp(meeting.id, r));
  const cancel = useClubAction((b) => b.cancelMeeting(meeting.id));
  const when = formatMeetingWhen(meeting);
  const counts = rsvpCounts(meeting);
  const mine = meeting.rsvps[ME];
  const where = meeting.place.kind === 'video' ? 'Video call' : meeting.place.name;

  return (
    <Card style={styles.meeting}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <ThemedText type="heading">{when.day}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {when.time} · {where}
            {label ? ` · ${label}` : ''}
          </ThemedText>
        </View>
        {meeting.place.kind === 'video' ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL((meeting.place as { url: string }).url)}
            style={[styles.joinPill, { backgroundColor: theme.accentSoft }]}>
            <ThemedText type="smallBold" themeColor="accent">
              Join ↗
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.rsvps}>
        {(['going', 'maybe', 'no'] as const).map((r) => (
          <Button
            key={r}
            variant="secondary"
            selected={mine === r}
            label={r === 'going' ? `Going · ${counts.going}` : r === 'maybe' ? `Maybe · ${counts.maybe}` : 'Can’t'}
            onPress={() => rsvp.mutate(r)}
            style={styles.rsvp}
          />
        ))}
      </View>
      <View style={styles.meetingLinks}>
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(calendarLink(meeting, `${clubName} catch-up`, label ? `Discussing ${label}` : 'Book club catch-up'))}>
          <ThemedText type="link">Add to calendar</ThemedText>
        </Pressable>
        {canCancel ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => confirm('Cancel catch-up', 'Everyone in the club will see it’s been cancelled.', () => cancel.mutate(undefined))}>
            <ThemedText type="small" themeColor="textSecondary">
              Cancel catch-up
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      {rsvp.isError ? <ErrorText error={rsvp.error} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingVertical: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three - 4 },
  row: { flexDirection: 'row', gap: Spacing.three - 4, alignItems: 'center' },
  membersRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  invite: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  code: { fontSize: 22, letterSpacing: 4, fontWeight: 700 },
  reading: { gap: Spacing.three - 4 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  ticks: { gap: Spacing.two },
  tick: { borderWidth: 1, borderRadius: 14, paddingHorizontal: Spacing.three - 4, paddingVertical: Spacing.two },
  meeting: { gap: Spacing.three - 4 },
  joinPill: { borderRadius: Radius.pill, paddingHorizontal: Spacing.three - 4, paddingVertical: 7 },
  rsvps: { flexDirection: 'row', gap: Spacing.two },
  rsvp: { flex: 1, paddingHorizontal: Spacing.one },
  meetingLinks: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyMeeting: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  later: { paddingHorizontal: Spacing.one },
  posts: { gap: Spacing.three - 6 },
  leave: { marginTop: Spacing.four },
});
