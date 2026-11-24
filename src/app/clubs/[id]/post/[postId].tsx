/** A post and its replies. */

import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Composer, PostCard } from '@/components/clubs';
import { ThemedText } from '@/components/themed-text';
import { Centered, ErrorText, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ME } from '@/lib/clubs/demoClubs';
import { isUnlocked } from '@/lib/clubs/logic';
import { backToClub, useClub, useClubAction } from '@/lib/clubs/hooks';

export default function ThreadScreen() {
  const { id, postId } = useLocalSearchParams<{ id: string; postId: string }>();
  const theme = useTheme();
  const club = useClub(id);
  const reply = useClubAction((b, a: { checkpointId: string; body: string }) => b.createPost(id, a.checkpointId, a.body, postId));
  const like = useClubAction((b, pid: string) => b.toggleLike(pid));
  const remove = useClubAction((b, pid: string) => b.deletePost(pid));

  if (club.isPending) {
    return (
      <Screen edges={['left', 'right']}>
        <Centered>
          <ActivityIndicator />
        </Centered>
      </Screen>
    );
  }
  const detail = club.data;
  const root = detail?.posts.find((p) => p.id === postId);
  const checkpoints = detail?.club.current?.checkpoints ?? [];
  const cpIndex = root ? checkpoints.findIndex((c) => c.id === root.checkpointId) : -1;
  if (!detail || !root || !isUnlocked(cpIndex, detail.reached)) {
    return (
      <Screen edges={['left', 'right']}>
        <Centered>
          {club.isError ? <ErrorText error={club.error} /> : <ThemedText themeColor="textSecondary">This post isn’t available.</ThemedText>}
        </Centered>
      </Screen>
    );
  }

  const memberById = new Map(detail.members.map((m) => [m.id, m]));
  const replies = detail.posts.filter((p) => p.parentId === postId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const canDelete = (authorId: string) => authorId === ME || detail.club.ownerId === ME;
  const label = checkpoints[cpIndex].label;

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: label }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          data={replies}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <PostCard
              post={root}
              author={memberById.get(root.authorId)}
              replies={replies.length}
              onLike={() => like.mutate(root.id)}
              onDelete={canDelete(root.authorId) ? () => remove.mutate(root.id, { onSuccess: () => backToClub(id) }) : undefined}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.reply, { borderLeftColor: theme.border }]}>
              <PostCard
                post={item}
                author={memberById.get(item.authorId)}
                onLike={() => like.mutate(item.id)}
                onDelete={canDelete(item.authorId) ? () => remove.mutate(item.id) : undefined}
              />
            </View>
          )}
        />
        <View style={styles.composer}>
          {reply.isError ? <ErrorText error={reply.error} /> : null}
          <Composer
            placeholder={`Reply to ${memberById.get(root.authorId)?.name ?? 'this post'}…`}
            action="Reply"
            busy={reply.isPending}
            onSubmit={(body) => reply.mutateAsync({ checkpointId: root.checkpointId, body })}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: Spacing.three - 6, paddingVertical: Spacing.three, paddingBottom: Spacing.four },
  reply: { marginLeft: Spacing.four - 2, paddingLeft: Spacing.three - 4, borderLeftWidth: 2 },
  composer: { gap: Spacing.one, paddingVertical: Spacing.two },
});
