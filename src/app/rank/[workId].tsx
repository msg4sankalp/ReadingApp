/**
 * The ranking flow: genre → bucket → head-to-head comparisons → score + chips.
 * See PLAN.md → "The ranking system".
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BookCover, Button, Centered, Chip, ErrorText, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { BookSearchResult } from '@/lib/books/openLibrary';
import { CATEGORIES, getCategory, type CategorySlug } from '@/lib/catalog/categories';
import { useBackend } from '@/lib/library/backend';
import { useBook, useLibrary, useLibraryEntry, useRankBook, useSetChips, workKeyFromId } from '@/lib/library/hooks';
import type { RankedBook } from '@/lib/library/types';
import {
  answer,
  formatScore,
  isComplete,
  isProvisional,
  maxQuestions,
  nextOpponent,
  startInsertion,
  type Answer,
  type Bucket,
  type InsertionSession,
} from '@/lib/ranking';

const BUCKET_OPTIONS: { bucket: Bucket; label: string; hint: string }[] = [
  { bucket: 'liked', label: 'I liked it', hint: 'Scores 6.7 – 10' },
  { bucket: 'fine', label: 'It was fine', hint: 'Scores 3.4 – 6.6' },
  { bucket: 'disliked', label: "I didn't like it", hint: 'Scores 0 – 3.3' },
];

type Step =
  | { kind: 'category' }
  | { kind: 'bucket' }
  | { kind: 'loading' }
  | { kind: 'compare'; session: InsertionSession; history: InsertionSession[] }
  | { kind: 'saving' }
  | { kind: 'done'; score: number; position: number; listLength: number };

export default function RankScreen() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const workKey = workKeyFromId(workId);
  const book = useBook(workKey);
  const entry = useLibraryEntry(workKey);

  if (book.isPending || entry.isPending) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Centered>
          <ActivityIndicator />
        </Centered>
      </Screen>
    );
  }
  if (!book.data) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Centered>
          <ErrorText error={book.error ?? 'Book not found'} />
        </Centered>
      </Screen>
    );
  }
  return (
    <RankFlow
      book={book.data}
      initialCategory={entry.data?.category ?? book.data.suggestedCategory}
      initialChips={entry.data?.chips ?? []}
    />
  );
}

function RankFlow({
  book,
  initialCategory,
  initialChips,
}: {
  book: BookSearchResult;
  initialCategory: CategorySlug | null;
  initialChips: string[];
}) {
  const backend = useBackend();
  const rankBook = useRankBook();
  const [step, setStep] = useState<Step>({ kind: 'category' });
  const [category, setCategory] = useState<CategorySlug | null>(initialCategory);
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [opponents, setOpponents] = useState<Map<string, RankedBook>>(new Map());
  const [error, setError] = useState<unknown>(null);

  // The bucket is passed in rather than read from state, because the first
  // book in a list is saved in the same event that chooses the bucket.
  async function save(session: InsertionSession, chosenBucket: Bucket) {
    setStep({ kind: 'saving' });
    try {
      const score = await rankBook.mutateAsync({
        bookId: session.newBook,
        category: category!,
        bucket: chosenBucket,
        position: session.position!,
        comparisons: [...session.comparisons],
      });
      setStep({ kind: 'done', score, position: session.position!, listLength: session.list.length + 1 });
    } catch (e) {
      setError(e);
      setStep({ kind: 'bucket' });
    }
  }

  async function chooseBucket(chosen: Bucket) {
    setBucket(chosen);
    setError(null);
    setStep({ kind: 'loading' });
    try {
      const bookId = await backend.ensureBook(book);
      const list = (await backend.fetchRankedList(category!, chosen)).filter((b) => b.bookId !== bookId);
      setOpponents(new Map(list.map((b) => [b.bookId, b])));
      const session = startInsertion(
        bookId,
        list.map((b) => b.bookId),
      );
      if (isComplete(session)) {
        await save(session, chosen); // First book in this list: nothing to compare.
      } else {
        setStep({ kind: 'compare', session, history: [] });
      }
    } catch (e) {
      setError(e);
      setStep({ kind: 'bucket' });
    }
  }

  function respond(response: Answer) {
    if (step.kind !== 'compare') return;
    const next = answer(step.session, response);
    if (isComplete(next)) save(next, bucket!);
    else setStep({ kind: 'compare', session: next, history: [...step.history, step.session] });
  }

  function undo() {
    if (step.kind !== 'compare' || step.history.length === 0) return;
    setStep({ kind: 'compare', session: step.history.at(-1)!, history: step.history.slice(0, -1) });
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        {step.kind !== 'compare' && step.kind !== 'done' && (
          <View style={styles.bookHeader}>
            <BookCover uri={book.coverUrl} width={48} />
            <View style={styles.flex}>
              <ThemedText numberOfLines={2}>{book.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {book.authors.join(', ')}
              </ThemedText>
            </View>
          </View>
        )}
        {error ? <ErrorText error={error} /> : null}

        {step.kind === 'category' && (
          <CategoryStep
            value={category}
            onChange={setCategory}
            onContinue={() => setStep({ kind: 'bucket' })}
          />
        )}

        {step.kind === 'bucket' && category && (
          <View style={styles.section}>
            <ThemedText type="label" themeColor="textSecondary">
              {getCategory(category).name}
            </ThemedText>
            <ThemedText type="title">How did you feel about it?</ThemedText>
            {BUCKET_OPTIONS.map((o) => (
              <Button
                key={o.bucket}
                variant="secondary"
                label={`${o.label}  ·  ${o.hint}`}
                onPress={() => chooseBucket(o.bucket)}
                style={styles.bigButton}
              />
            ))}
            <Button variant="ghost" label="Change genre" onPress={() => setStep({ kind: 'category' })} />
          </View>
        )}

        {(step.kind === 'loading' || step.kind === 'saving') && (
          <Centered>
            <ActivityIndicator />
          </Centered>
        )}

        {step.kind === 'compare' && (
          <CompareStep
            book={book}
            session={step.session}
            asked={step.history.length}
            opponents={opponents}
            onAnswer={respond}
            onUndo={step.history.length > 0 ? undo : null}
          />
        )}

        {step.kind === 'done' && category && bucket && (
          <DoneStep
            book={book}
            category={category}
            bucket={bucket}
            score={step.score}
            position={step.position}
            listLength={step.listLength}
            initialChips={initialChips}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function CategoryStep({
  value,
  onChange,
  onContinue,
}: {
  value: CategorySlug | null;
  onChange: (c: CategorySlug) => void;
  onContinue: () => void;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="title">Which genre should it compete in?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        You&apos;ll only compare it with other books in this genre.
      </ThemedText>
      <View style={styles.chipWrap}>
        {CATEGORIES.map((c) => (
          <Chip key={c.slug} label={c.name} selected={value === c.slug} onPress={() => onChange(c.slug)} />
        ))}
      </View>
      <Button size="large" label="Continue" onPress={onContinue} disabled={!value} />
    </View>
  );
}

function CompareStep({
  book,
  session,
  asked,
  opponents,
  onAnswer,
  onUndo,
}: {
  book: BookSearchResult;
  session: InsertionSession;
  asked: number;
  opponents: Map<string, RankedBook>;
  onAnswer: (a: Answer) => void;
  onUndo: (() => void) | null;
}) {
  const theme = useTheme();
  const total = maxQuestions(session.list.length);
  const opponent = opponents.get(nextOpponent(session)!)!;
  return (
    <View style={styles.section}>
      <View style={[styles.progress, { backgroundColor: theme.border }]}>
        <View style={[styles.progressFill, { backgroundColor: theme.cta, width: `${((asked + 1) / total) * 100}%` }]} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Question {asked + 1} of at most {total}
      </ThemedText>
      <ThemedText type="title">Which did you like more?</ThemedText>
      <View style={styles.versus}>
        <ChoiceCard title={book.title} authors={book.authors} coverUrl={book.coverUrl} onPress={() => onAnswer('new')} />
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.or}>
          or
        </ThemedText>
        <ChoiceCard
          title={opponent.title}
          authors={opponent.authors}
          coverUrl={opponent.coverUrl}
          onPress={() => onAnswer('existing')}
        />
      </View>
      <View style={styles.row}>
        <Button variant="secondary" label="Too close to call" onPress={() => onAnswer('tie')} style={styles.flex} />
        <Button variant="secondary" label="Skip the rest" onPress={() => onAnswer('skip')} style={styles.flex} />
      </View>
      {onUndo ? <Button variant="ghost" label="Undo last answer" onPress={onUndo} /> : null}
    </View>
  );
}

function ChoiceCard({
  title,
  authors,
  coverUrl,
  onPress,
}: {
  title: string;
  authors: string[];
  coverUrl: string | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`I liked ${title} more`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: pressed ? theme.accent : theme.border },
      ]}>
      <BookCover uri={coverUrl} width={112} />
      <ThemedText type="smallBold" numberOfLines={3} style={styles.center}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.center}>
        {authors[0] ?? ''}
      </ThemedText>
    </Pressable>
  );
}

function DoneStep({
  book,
  category,
  bucket,
  score,
  position,
  listLength,
  initialChips,
}: {
  book: BookSearchResult;
  category: CategorySlug;
  bucket: Bucket;
  score: number;
  position: number;
  listLength: number;
  initialChips: string[];
}) {
  const backend = useBackend();
  const library = useLibrary();
  const setChips = useSetChips();
  const [chips, setChipsState] = useState<string[]>(initialChips);
  const cat = getCategory(category);

  const rankedInCategory = (library.data ?? []).filter((e) => e.category === category && e.score !== null).length;
  const provisional = library.data ? isProvisional(rankedInCategory) : false;
  const bucketName = { liked: 'Liked', fine: 'Fine', disliked: "Didn't like" }[bucket];

  async function finish() {
    const bookId = await backend.ensureBook(book);
    await setChips.mutateAsync({ bookId, category, chips });
    router.back();
  }

  return (
    <View style={[styles.section, styles.centerItems]}>
      <BookCover uri={book.coverUrl} width={110} />
      <ThemedText type="display" style={styles.center}>{formatScore(score, provisional)}</ThemedText>
      <ThemedText style={styles.center}>
        #{position + 1} of {listLength} in {cat.name} · {bucketName}
      </ThemedText>
      {provisional ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Scores in this genre are provisional until you&apos;ve ranked 5 books ({rankedInCategory} so far).
        </ThemedText>
      ) : null}

      <View style={[styles.section, styles.fullWidth]}>
        <ThemedText type="heading">
          {bucket === 'disliked' ? 'What fell short?' : 'What made it work?'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Optional. Pick any that apply.
        </ThemedText>
        <View style={styles.chipWrap}>
          {cat.chips.map((c) => (
            <Chip
              key={c.slug}
              label={c.label}
              selected={chips.includes(c.slug)}
              onPress={() =>
                setChipsState((cur) => (cur.includes(c.slug) ? cur.filter((s) => s !== c.slug) : [...cur, c.slug]))
              }
            />
          ))}
        </View>
        {setChips.isError ? <ErrorText error={setChips.error} /> : null}
        <Button size="large" label="Done" onPress={finish} loading={setChips.isPending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four, paddingVertical: Spacing.four, flexGrow: 1 },
  bookHeader: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  section: { gap: Spacing.three },
  progress: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  bigButton: { minHeight: 56, alignItems: 'flex-start' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  versus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  or: { paddingHorizontal: Spacing.one },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 2,
  },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  centerItems: { alignItems: 'center' },
  fullWidth: { alignSelf: 'stretch', marginTop: Spacing.three },
});
