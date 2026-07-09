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
          style={styles.searchInput}
          placeholder="Busca una palabra en inglés o español..."
          placeholderTextColor="#9CA3AF"
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
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    marginBottom: 8,
  },
  backBtnText: {
    fontSize: 16,
    color: '#4F46E5',
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    height: '100%',
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  clearBtnText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
});
