import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BookRow, Centered, ErrorText, Screen, TextField } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { getCategory } from '@/lib/catalog/categories';
import { useBookSearch, useDebouncedValue, useSeedBook, workIdFromKey } from '@/lib/library/hooks';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 350);
  const search = useBookSearch(debounced);
  const seedBook = useSeedBook();
  const showResults = debounced.trim().length >= 2;

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title">Search</ThemedText>
        <TextField
          placeholder="Title, author or ISBN"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search books"
        />
      </View>

      {!showResults ? (
        <Centered>
          <ThemedText themeColor="textSecondary">Find a book to add to your library.</ThemedText>
        </Centered>
      ) : search.isPending ? (
        <Centered>
          <ActivityIndicator />
        </Centered>
      ) : search.isError ? (
        <Centered>
          <ErrorText error={search.error} />
        </Centered>
      ) : search.data.length === 0 ? (
        <Centered>
          <ThemedText themeColor="textSecondary">No books found for “{debounced.trim()}”.</ThemedText>
        </Centered>
      ) : (
        <FlatList
          data={search.data}
          keyExtractor={(b) => b.openLibraryKey}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.three }}
          renderItem={({ item }) => (
            <BookRow
              title={item.title}
              authors={item.authors}
              coverUrl={item.coverUrl}
              detail={[
                item.firstPublishYear,
                item.suggestedCategory ? getCategory(item.suggestedCategory).name : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => {
                seedBook(item);
                router.push({ pathname: '/book/[workId]', params: { workId: workIdFromKey(item.openLibraryKey) } });
              }}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.two },
});
