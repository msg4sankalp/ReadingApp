/** Spoiler-safe discussion: posts grouped by checkpoint; later checkpoints stay locked. */

import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Composer, PostCard } from '@/components/clubs';
import { ThemedText } from '@/components/themed-text';
import { Button, Centered, Chip, ErrorText, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ME } from '@/lib/clubs/demoClubs';
import { isUnlocked } from '@/lib/clubs/logic';
import { useClub, useClubAction } from '@/lib/clubs/hooks';

export default function DiscussionScreen() {
  const { id, cp } = useLocalSearchParams<{ id: string; cp?: string }>();
  const theme = useTheme();
  const club = useClub(id);
  const post = useClubAction((b, a: { checkpointId: string; body: string }) => b.createPost(id, a.checkpointId, a.body, null));
  const like = useClubAction((b, postId: string) => b.toggleLike(postId));
  const remove = useClubAction((b, postId: string) => b.deletePost(postId));
  const unlock = useClubAction((b, index: number) => b.setReached(id, index));

  if (club.isPending) {
    return (
      <Screen edges={['left', 'right']}>
        <Centered>
          <ActivityIndicator />
        </Centered>
      </Screen>
    );
  }
  if (!club.data?.club.current) {
    return (
      <Screen edges={['left', 'right']}>
        <Centered>{club.isError ? <ErrorText error={club.error} /> : <ThemedText themeColor="textSecondary">No discussion yet.</ThemedText>}</Centered>
      </Screen>
    );
  }

  const { club: c, members, posts, reached } = club.data;
  const checkpoints = c.current!.checkpoints;
  const selectedIndex = Math.max(0, cp ? checkpoints.findIndex((x) => x.id === cp) : reached);
  const selected = checkpoints[selectedIndex] ?? checkpoints[0];
  const unlocked = isUnlocked(selectedIndex, reached);
  const topLevel = (cpId: string) => posts.filter((p) => p.checkpointId === cpId && p.parentId === null);
  const shown = topLevel(selected.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const memberById = new Map(members.map((m) => [m.id, m]));
  const replyCount = (postId: string) => posts.filter((p) => p.parentId === postId).length;
  const hiddenCount = posts.filter((p) => p.checkpointId === selected.id).length;

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={styles.chipsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {checkpoints.map((x, i) => (
              <Chip
                key={x.id}
                label={`${isUnlocked(i, reached) ? '' : '🔒 '}${x.label}${isUnlocked(i, reached) ? ` · ${topLevel(x.id).length}` : ''}`}
                selected={x.id === selected.id}
                onPress={() => router.setParams({ cp: x.id })}
              />
            ))}
          </ScrollView>
        </View>

        {unlocked ? (
          <FlatList
            data={shown}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                No posts about {selected.label} yet. Share the first thought.
              </ThemedText>
            }
            renderItem={({ item }) => (
              <PostCard
                post={item}
                author={memberById.get(item.authorId)}
                replies={replyCount(item.id)}
                onLike={() => like.mutate(item.id)}
                onDelete={item.authorId === ME || c.ownerId === ME ? () => remove.mutate(item.id) : undefined}
                onPress={() => router.push({ pathname: '/clubs/[id]/post/[postId]', params: { id, postId: item.id } })}
              />
            )}
          />
        ) : (
          <View style={[styles.lock, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="heading">🔒 {selected.label}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              {hiddenCount === 0
                ? 'Nobody has posted about this part yet.'
                : `${hiddenCount} ${hiddenCount === 1 ? 'post is' : 'posts are'} hidden so nothing gets spoiled.`}{' '}
              Reached this part?
            </ThemedText>
            <Button
              variant="secondary"
              selected
              label={`I’ve reached ${selected.label}`}
              loading={unlock.isPending}
              onPress={() => unlock.mutate(selectedIndex)}
            />
          </View>
        )}

        {unlocked ? (
          <View style={styles.composer}>
            {post.isError ? <ErrorText error={post.error} /> : null}
            <Composer
              placeholder={`Share a thought about ${selected.label}…`}
              busy={post.isPending}
              onSubmit={(body) => post.mutateAsync({ checkpointId: selected.id, body })}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  chipsWrap: { paddingVertical: Spacing.three - 4 },
  chips: { gap: Spacing.two, paddingRight: Spacing.three },
  list: { gap: Spacing.three - 6, paddingBottom: Spacing.four },
  empty: { paddingVertical: Spacing.four, textAlign: 'center' },
  lock: {
    margin: Spacing.two,
    padding: Spacing.four,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: Spacing.three - 4,
  },
  composer: { gap: Spacing.one, paddingVertical: Spacing.two },
});
