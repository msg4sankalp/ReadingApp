/** Shared book club UI: avatars, post cards, the composer. */

import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ME } from '@/lib/clubs/demoClubs';
import { timeAgo } from '@/lib/clubs/logic';
import type { ClubMember, ClubPost } from '@/lib/clubs/types';

export function Avatar({ member, size = 28 }: { member: ClubMember | undefined; size?: number }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel={member?.name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: member?.color ?? theme.textSecondary,
        borderWidth: 2,
        borderColor: theme.backgroundElement,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <ThemedText style={{ color: '#fff', fontSize: size * 0.42, lineHeight: size * 0.5, fontWeight: 600 }}>
        {(member?.name ?? '?')[0]}
      </ThemedText>
    </View>
  );
}

export function AvatarStack({ members, size = 28 }: { members: ClubMember[]; size?: number }) {
  return (
    <View style={styles.stack}>
      {members.slice(0, 5).map((m, i) => (
        <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -size * 0.3 }}>
          <Avatar member={m} size={size} />
        </View>
      ))}
    </View>
  );
}

export function PostCard({
  post,
  author,
  replies,
  meta,
  onPress,
  onLike,
  onDelete,
}: {
  post: ClubPost;
  author: ClubMember | undefined;
  replies?: number;
  /** Extra text after the time, e.g. the checkpoint. */
  meta?: string;
  onPress?: () => void;
  onLike: () => void;
  onDelete?: () => void;
}) {
  const theme = useTheme();
  const liked = post.likes.includes(ME);
  const content = (
    <>
      <View style={styles.meta}>
        <Avatar member={author} size={26} />
        <ThemedText type="smallBold">{author?.name ?? 'Someone'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex} numberOfLines={1}>
          · {timeAgo(post.createdAt)}
          {meta ? ` · ${meta}` : ''}
        </ThemedText>
        {onDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={post.authorId === ME ? 'Delete post' : 'Remove post'}
            onPress={onDelete}
            hitSlop={10}>
            <ThemedText type="small" themeColor="textSecondary">
              {post.authorId === ME ? 'Delete' : 'Remove'}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      <ThemedText style={styles.body}>{post.body}</ThemedText>
      <View style={styles.acts}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Unlike' : 'Like'}
          accessibilityState={{ selected: liked }}
          onPress={onLike}
          hitSlop={8}>
          <ThemedText type="smallBold" themeColor={liked ? 'accent' : 'textSecondary'}>
            {liked ? '♥' : '♡'} {post.likes.length}
          </ThemedText>
        </Pressable>
        {replies !== undefined ? (
          <ThemedText type="small" themeColor="textSecondary">
            💬 {replies === 1 ? '1 reply' : `${replies} replies`}
          </ThemedText>
        ) : null}
      </View>
    </>
  );
  // A plain container when the card itself isn't tappable: a disabled wrapper
  // would also disable the Like button inside it on web.
  if (!onPress) return <View style={[styles.post, { backgroundColor: theme.backgroundElement }]}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.post, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 }]}>
      {content}
    </Pressable>
  );
}

export function Composer({
  placeholder,
  action = 'Post',
  onSubmit,
  busy,
}: {
  placeholder: string;
  action?: string;
  onSubmit: (text: string) => Promise<unknown>;
  busy?: boolean;
}) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0 && !busy;
  const send = async () => {
    if (!canSend) return;
    await onSubmit(text);
    setText('');
  };
  return (
    <View style={[styles.composer, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        multiline
        accessibilityLabel={placeholder}
        style={[styles.input, { color: theme.text, fontFamily: FontFamily.sans[400] }]}
      />
      <Pressable
        accessibilityRole="button"
        disabled={!canSend}
        onPress={send}
        style={[styles.send, { backgroundColor: theme.cta, opacity: canSend ? 1 : 0.35 }]}>
        <ThemedText type="smallBold" style={{ color: theme.onCta }}>
          {action}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { flexDirection: 'row' },
  post: { borderRadius: 18, padding: Spacing.three - 3, gap: Spacing.two },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  body: { fontSize: 15, lineHeight: 22 },
  acts: { flexDirection: 'row', gap: Spacing.three },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.two,
    paddingLeft: Spacing.three,
  },
  input: { flex: 1, fontSize: 15, minHeight: 36, maxHeight: 120, paddingTop: 8 },
  send: { borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: 9 },
});
