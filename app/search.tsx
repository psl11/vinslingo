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

interface SearchResultItem {
  id: string;
  word: string;
  translation: string;
  category: string;
  cefr_level: string;
  part_of_speech?: string;
  example_sentence?: string;
  example_translation?: string;
  example_sentence_2?: string;
  example_translation_2?: string;
  song_lyric?: string;
  song_lyric_translation?: string;
  song_title?: string;
  song_artist?: string;
  mastery_level?: number;
  times_correct?: number;
  times_incorrect?: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  ngsl: 'NGSL',
  phave: 'Phrasal Verbs',
  idiom: 'Idioms',
  connector: 'Conectores',
  false_friend: 'False Friends',
  expression: 'Expresiones',
  confusing_pair: 'Confusing Pairs',
  collocation: 'Collocations',
};

function getMasteryInfo(level?: number): { label: string; color: string; bg: string } {
  if (level === undefined || level === null) return { label: 'Nueva', color: '#6B7280', bg: '#F3F4F6' };
  if (level === 0) return { label: 'Vista', color: '#6B7280', bg: '#F3F4F6' };
  if (level === 1) return { label: 'Aprendiendo', color: '#F59E0B', bg: '#FEF3C7' };
  if (level === 2) return { label: 'Repasando', color: '#3B82F6', bg: '#DBEAFE' };
  return { label: 'Dominada', color: '#22C55E', bg: '#DCFCE7' };
}

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRecent, setShowRecent] = useState(true);
  const [recentWords, setRecentWords] = useState<SearchResultItem[]>([]);
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

  const renderItem = ({ item }: { item: SearchResultItem }) => {
    const mastery = getMasteryInfo(item.mastery_level);
    const isExpanded = expandedId === item.id;

    return (
      <Pressable onPress={() => toggleExpand(item.id)} style={styles.resultItem}>
        <View style={styles.resultHeader}>
          <View style={styles.resultMain}>
            <Text style={styles.wordText}>{item.word}</Text>
            <Text style={styles.translationText}>{item.translation}</Text>
          </View>
          <View style={styles.resultMeta}>
            <View style={[styles.masteryBadge, { backgroundColor: mastery.bg }]}>
              <Text style={[styles.masteryText, { color: mastery.color }]}>{mastery.label}</Text>
            </View>
            <Text style={styles.cefrText}>{item.cefr_level}</Text>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.tagRow}>
              <View style={styles.categoryTag}>
                <Text style={styles.categoryTagText}>
                  {CATEGORY_LABELS[item.category] || item.category}
                </Text>
              </View>
              {item.part_of_speech && (
                <View style={styles.posTag}>
                  <Text style={styles.posTagText}>{item.part_of_speech}</Text>
                </View>
              )}
            </View>

            {item.example_sentence && (
              <View style={styles.exampleBlock}>
                <Text style={styles.exampleText}>"{item.example_sentence}"</Text>
                {item.example_translation && (
                  <Text style={styles.exampleTranslation}>"{item.example_translation}"</Text>
                )}
              </View>
            )}

            {item.example_sentence_2 && (
              <View style={styles.exampleBlock}>
                <Text style={styles.exampleText}>"{item.example_sentence_2}"</Text>
                {item.example_translation_2 && (
                  <Text style={styles.exampleTranslation}>"{item.example_translation_2}"</Text>
                )}
              </View>
            )}

            {item.song_lyric && (
              <View style={styles.songBlock}>
                <Text style={styles.songIcon}>🎵</Text>
                <Text style={styles.songLyric}>"{item.song_lyric}"</Text>
                {item.song_lyric_translation && (
                  <Text style={styles.songTranslation}>"{item.song_lyric_translation}"</Text>
                )}
                {(item.song_title || item.song_artist) && (
                  <Text style={styles.songCredit}>
                    — {item.song_title}{item.song_artist ? ` (${item.song_artist})` : ''}
                  </Text>
                )}
              </View>
            )}

            {item.times_correct !== undefined && item.times_correct !== null && (
              <View style={styles.statsRow}>
                <Text style={styles.statText}>✅ {item.times_correct} correctas</Text>
                <Text style={styles.statText}>❌ {item.times_incorrect ?? 0} incorrectas</Text>
              </View>
            )}
          </View>
        )}
      </Pressable>
    );
  };

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
  resultItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  resultMain: {
    flex: 1,
    marginRight: 12,
  },
  wordText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
  },
  translationText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  resultMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  masteryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  masteryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cefrText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  categoryTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryTagText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '500',
  },
  posTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  posTagText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  exampleBlock: {
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 13,
    color: '#444444',
    fontStyle: 'italic',
  },
  exampleTranslation: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  songBlock: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  songIcon: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  songLyric: {
    fontSize: 13,
    color: '#92400E',
    fontStyle: 'italic',
    textAlign: 'center',
    fontWeight: '500',
  },
  songTranslation: {
    fontSize: 12,
    color: '#B45309',
    textAlign: 'center',
    marginTop: 2,
  },
  songCredit: {
    fontSize: 11,
    color: '#B45309',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
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
