import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { PressableScale } from '../components/ui/PressableScale';
import { VocabResultCard, VocabResultItem } from '../components/vocabulary/VocabResultCard';
import { useSettingsStore } from '../stores/useSettingsStore';

const CARD_COUNT_OPTIONS = [5, 10, 15, 20];
type Scope = 'all' | 'notmastered';

export default function FailedWordsScreen() {
  const router = useRouter();
  const { selectedCEFRLevels } = useSettingsStore();
  const [scope, setScope] = useState<Scope>('all');
  const [cardsPerRound, setCardsPerRound] = useState(10);
  const [words, setWords] = useState<VocabResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Recarga al enfocar (para reflejar los fallos tras un cuestionario) y cuando
  // cambian el toggle o el filtro de nivel del perfil.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          setIsLoading(true);
          const { getMostFailedVocabulary } = await import('../lib/services/vocabularyService');
          const data = await getMostFailedVocabulary({
            onlyNotMastered: scope === 'notmastered',
            cefrLevels: selectedCEFRLevels,
          });
          if (active) setWords(data);
        } catch (error) {
          console.error('Error loading failed words:', error);
        } finally {
          if (active) setIsLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [scope, selectedCEFRLevels])
  );

  const startQuiz = (typingMode: boolean) => {
    router.push({
      pathname: '/study/failed',
      params: {
        limit: String(cardsPerRound),
        scope,
        ...(typingMode ? { mode: 'typing' } : {}),
      },
    });
  };

  const renderItem = ({ item }: { item: VocabResultItem }) => (
    <VocabResultCard
      item={item}
      expanded={expandedId === item.id}
      onToggle={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
      headerBadge={
        <View style={styles.failBadge}>
          <Text style={styles.failBadgeText}>❌ {item.times_incorrect ?? 0}</Text>
        </View>
      }
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </Pressable>
        <Text style={styles.title}>🔥 Palabras más falladas</Text>
        <Text style={styles.subtitle}>
          Ordenadas por número de fallos. Repásalas para reforzarlas.
        </Text>
      </View>

      {/* Controles: toggle de alcance + tarjetas por ronda + CTA */}
      <View style={styles.controls}>
        <View style={styles.scopeRow}>
          {(
            [
              ['all', 'Todas'],
              ['notmastered', 'Solo no dominadas'],
            ] as [Scope, string][]
          ).map(([value, label]) => (
            <PressableScale
              key={value}
              style={[styles.scopeChip, scope === value && styles.scopeChipSelected]}
              onPress={() => setScope(value)}
            >
              <Text
                style={[styles.scopeText, scope === value && styles.scopeTextSelected]}
              >
                {label}
              </Text>
            </PressableScale>
          ))}
        </View>

        <Text style={styles.cardCountLabel}>Tarjetas por ronda</Text>
        <View style={styles.cardCountRow}>
          {CARD_COUNT_OPTIONS.map((count) => (
            <PressableScale
              key={count}
              style={[
                styles.cardCountChip,
                cardsPerRound === count && styles.cardCountChipSelected,
              ]}
              onPress={() => setCardsPerRound(count)}
            >
              <Text
                style={[
                  styles.cardCountText,
                  cardsPerRound === count && styles.cardCountTextSelected,
                ]}
              >
                {count}
              </Text>
            </PressableScale>
          ))}
        </View>

        {words.length > 0 && (
          <View style={styles.ctaRow}>
            <PressableScale style={styles.ctaButton} onPress={() => startQuiz(false)}>
              <Text style={styles.ctaButtonText}>Tarjetas</Text>
            </PressableScale>
            <PressableScale
              style={[styles.ctaButton, styles.ctaButtonTyping]}
              onPress={() => startQuiz(true)}
            >
              <Text style={styles.ctaButtonText}>Escribir</Text>
            </PressableScale>
          </View>
        )}
      </View>

      {/* Contador */}
      {!isLoading && words.length > 0 && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {words.length} {words.length === 1 ? 'palabra' : 'palabras'}
          </Text>
        </View>
      )}

      {/* Listado */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : words.length > 0 ? (
        <FlatList
          data={words}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🎉</Text>
          <Text style={styles.emptyText}>
            {scope === 'notmastered'
              ? 'No tienes palabras falladas sin dominar en los niveles seleccionados. ¡Buen trabajo!'
              : 'Aún no has fallado ninguna palabra en los niveles seleccionados. Sigue estudiando y aquí verás las que más se te resistan.'}
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
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  controls: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  scopeChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  scopeChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  scopeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  scopeTextSelected: {
    color: '#FFFFFF',
  },
  cardCountLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  cardCountRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  cardCountChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cardCountChipSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  cardCountText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B7280',
  },
  cardCountTextSelected: {
    color: '#4F46E5',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ctaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
  },
  ctaButtonTyping: {
    backgroundColor: '#F59E0B',
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
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
  failBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  failBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
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
