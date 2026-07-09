import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { VocabResultCard, VocabResultItem } from '../components/vocabulary/VocabResultCard';
import { colors, radius, spacing, fontSize, fontWeight, webInputReset } from '../constants/theme';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VocabResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRecent, setShowRecent] = useState(true);
  const [recentWords, setRecentWords] = useState<VocabResultItem[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recently studied words on mount
  React.useEffect(() => {
    loadRecentWords();
  }, []);

  const loadRecentWords = async () => {
    try {
      setIsLoadingRecent(true);
      const { getAllLearnedVocabulary } = await import('../lib/services/vocabularyService');
      const words = await getAllLearnedVocabulary(30);
      setRecentWords(words);
    } catch (error) {
      console.error('Error loading recent words:', error);
    } finally {
      setIsLoadingRecent(false);
    }
  };

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (text.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      setShowRecent(true);
      return;
    }

    setShowRecent(false);

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { searchVocabulary } = await import('../lib/services/vocabularyService');
        const searchResults = await searchVocabulary(text.trim());
        setResults(searchResults);
        setHasSearched(true);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const renderItem = ({ item }: { item: VocabResultItem }) => (
    <VocabResultCard
      item={item}
      expanded={expandedId === item.id}
      onToggle={() => toggleExpand(item.id)}
    />
  );

  const displayData = showRecent ? recentWords : results;
  const isLoading = showRecent ? isLoadingRecent : isSearching;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </Pressable>
        <Text style={styles.title}>Buscar Vocabulario</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, webInputReset]}
          placeholder="Busca una palabra en inglés o español..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={handleSearch}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {query.length > 0 && (
          <Pressable onPress={() => handleSearch('')} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {showRecent ? '🕐 Estudiadas recientemente' : `${results.length} resultados`}
        </Text>
      </View>

      {/* Results */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : displayData.length > 0 ? (
        <FlatList
          data={displayData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      ) : hasSearched ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🔎</Text>
          <Text style={styles.emptyText}>
            No se encontraron resultados para "{query}"
          </Text>
        </View>
      ) : !showRecent ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>✏️</Text>
          <Text style={styles.emptyText}>
            Escribe al menos 2 caracteres para buscar
          </Text>
        </View>
      ) : (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={styles.emptyText}>
            Aún no has estudiado ninguna palabra
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  backBtn: {
    marginBottom: spacing.md,
  },
  backBtnText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 48,
  },
  searchIcon: {
    fontSize: fontSize.lg,
    marginRight: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    height: '100%',
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  clearBtnText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.huge,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
