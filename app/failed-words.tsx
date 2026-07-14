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
import { colors, radius, spacing, fontSize, fontWeight } from '../constants/theme';

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
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
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
          <>
            {/* Entrenamiento: drill estilo Duolingo (cada palabra en 3 formatos,
                los fallos se repiten al final). Ver docs/drill-mode.md. */}
            <PressableScale
              style={styles.trainButton}
              onPress={() =>
                router.push({
                  pathname: '/study/drill',
                  params: { limit: String(cardsPerRound), scope },
                })
              }
            >
              <Text style={styles.ctaButtonText}>🏋️ Entrenar</Text>
            </PressableScale>
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
          </>
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
    backgroundColor: colors.screen,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
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
  subtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  controls: {
    paddingHorizontal: spacing.xl,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  scopeChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  scopeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scopeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  scopeTextSelected: {
    color: colors.onPrimary,
  },
  cardCountLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  cardCountRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  cardCountChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cardCountChipSelected: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primary,
  },
  cardCountText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  cardCountTextSelected: {
    color: colors.primary,
  },
  trainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.accentPurple,
    marginBottom: spacing.md,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  ctaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  ctaButtonTyping: {
    backgroundColor: colors.warning,
  },
  ctaButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.onPrimary,
  },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
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
  failBadge: {
    backgroundColor: colors.dangerSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  failBadgeText: {
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.bold,
    color: colors.danger,
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
