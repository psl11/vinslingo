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
import { colors, radius, spacing, fontSize, fontWeight } from '../constants/theme';

// Etiquetas legibles de las categorías (mismas que en el resto de la app). El
// chip "Todas" se añade aparte; los demás se pintan solo si hay guardadas de esa
// categoría.
const CATEGORY_LABELS: Record<string, string> = {
  ngsl: 'NGSL',
  phave: 'Phrasal Verbs',
  idiom: 'Idioms',
  connector: 'Conectores',
  false_friend: 'False Friends',
  expression: 'Expresiones',
  confusing_pair: 'Confusing Pairs',
  collocation: 'Collocations',
  british_slang: 'Slang UK',
  american_slang: 'Slang US',
};

interface CategoryChip {
  category: string;
  count: number;
}

export default function SavedWordsScreen() {
  const router = useRouter();
  const [words, setWords] = useState<VocabResultItem[]>([]);
  const [categories, setCategories] = useState<CategoryChip[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // null = todas
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async (category: string | null) => {
    const { getSavedWords, getSavedCategories } = await import(
      '../lib/services/savedWordsService'
    );
    const [data, cats] = await Promise.all([
      getSavedWords({ category: category ?? undefined }),
      getSavedCategories(),
    ]);
    return { data, cats };
  }, []);

  // Recarga al enfocar (refleja lo guardado desde las fichas) y al cambiar el
  // filtro de categoría.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          setIsLoading(true);
          const { data, cats } = await load(selectedCategory);
          if (!active) return;
          setWords(data);
          setCategories(cats);
          // Si la categoría seleccionada se queda sin palabras (p.ej. quitaste la
          // última), volver a "Todas" para no mostrar un listado vacío colgado.
          if (selectedCategory && !cats.some((c) => c.category === selectedCategory)) {
            setSelectedCategory(null);
          }
        } catch (error) {
          console.error('Error loading saved words:', error);
        } finally {
          if (active) setIsLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [selectedCategory, load])
  );

  const handleUnsave = async (id: string) => {
    try {
      const { removeSavedWord } = await import('../lib/services/savedWordsService');
      await removeSavedWord(id);
      // Optimista: quítala de la lista sin recargar todo.
      setWords((prev) => prev.filter((w) => w.id !== id));
      const { getSavedCategories } = await import('../lib/services/savedWordsService');
      setCategories(await getSavedCategories());
    } catch (error) {
      console.error('Error removing saved word:', error);
    }
  };

  const renderItem = ({ item }: { item: VocabResultItem }) => (
    <VocabResultCard
      item={item}
      expanded={expandedId === item.id}
      onToggle={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
      headerBadge={
        <Pressable
          onPress={(e) => {
            (e as any)?.stopPropagation?.();
            handleUnsave(item.id);
          }}
          hitSlop={8}
          style={styles.pinBadge}
          accessibilityLabel="Quitar de guardadas"
        >
          <Text style={styles.pinBadgeText}>📌</Text>
        </Pressable>
      }
    />
  );

  const hasAny = categories.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </Pressable>
        <Text style={styles.title}>📌 Palabras guardadas</Text>
        <Text style={styles.subtitle}>
          Tu listado personal. Toca la chincheta de una palabra para quitarla.
        </Text>
      </View>

      {/* Filtro de categorías (solo si hay guardadas de más de una categoría) */}
      {hasAny && (
        <View style={styles.filterRow}>
          <PressableScale
            style={[styles.filterChip, selectedCategory === null && styles.filterChipSelected]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text
              style={[
                styles.filterText,
                selectedCategory === null && styles.filterTextSelected,
              ]}
            >
              Todas
            </Text>
          </PressableScale>
          {categories.map((c) => (
            <PressableScale
              key={c.category}
              style={[
                styles.filterChip,
                selectedCategory === c.category && styles.filterChipSelected,
              ]}
              onPress={() => setSelectedCategory(c.category)}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedCategory === c.category && styles.filterTextSelected,
                ]}
              >
                {CATEGORY_LABELS[c.category] || c.category} ({c.count})
              </Text>
            </PressableScale>
          ))}
        </View>
      )}

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
          <Text style={styles.emptyEmoji}>📌</Text>
          <Text style={styles.emptyText}>
            {selectedCategory
              ? 'No tienes palabras guardadas en esta categoría.'
              : 'Aún no has guardado ninguna palabra. Cuando estudies, toca la chincheta 📌 en el reverso de una ficha para guardarla aquí.'}
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
  subtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  filterTextSelected: {
    color: colors.onPrimary,
  },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
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
  pinBadge: {
    backgroundColor: colors.warningSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  pinBadgeText: {
    fontSize: fontSize.sm,
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
