import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { TranslationBody } from './TranslationBody';
import { ParticleHint } from './ParticleHint';
import { analyzeTranslation, translationSummary } from '../../lib/vocabulary/translationParser';
import { anchorIcon, anchorCredit, AnchorType } from '../../lib/vocabulary/anchor';

// Ficha de vocabulario expandible, compartida por el buscador y la pantalla de
// "palabras más falladas" para que la maquetación no diverja. El estado de
// expansión lo gestiona el padre (acordeón de una sola abierta).
export interface VocabResultItem {
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
  anchor_type?: string;
  anchor_year?: number;
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

export function getMasteryInfo(level?: number): { label: string; color: string; bg: string } {
  if (level === undefined || level === null) return { label: 'Nueva', color: '#6B7280', bg: '#F3F4F6' };
  if (level === 0) return { label: 'Vista', color: '#6B7280', bg: '#F3F4F6' };
  if (level === 1) return { label: 'Aprendiendo', color: '#F59E0B', bg: '#FEF3C7' };
  if (level === 2) return { label: 'Repasando', color: '#3B82F6', bg: '#DBEAFE' };
  return { label: 'Dominada', color: '#22C55E', bg: '#DCFCE7' };
}

interface VocabResultCardProps {
  item: VocabResultItem;
  expanded: boolean;
  onToggle: () => void;
  // Insignia extra en la cabecera (p.ej. nº de fallos en "más falladas").
  headerBadge?: React.ReactNode;
}

export function VocabResultCard({ item, expanded, onToggle, headerBadge }: VocabResultCardProps) {
  const mastery = getMasteryInfo(item.mastery_level);
  // En entradas multi-acepción los ejemplos ya van dentro de cada acepción
  // (TranslationBody), así que ocultamos los example_sentence(_2) duplicados.
  const isMultiSense = analyzeTranslation(item.translation).kind === 'senses';

  return (
    <Pressable onPress={onToggle} style={styles.resultItem}>
      <View style={styles.resultHeader}>
        <View style={styles.resultMain}>
          <Text style={styles.wordText}>{item.word}</Text>
          <Text style={styles.translationText} numberOfLines={expanded ? undefined : 2}>
            {translationSummary(item.translation)}
          </Text>
        </View>
        <View style={styles.resultMeta}>
          {headerBadge}
          <View style={[styles.masteryBadge, { backgroundColor: mastery.bg }]}>
            <Text style={[styles.masteryText, { color: mastery.color }]}>{mastery.label}</Text>
          </View>
          <Text style={styles.cefrText}>{item.cefr_level}</Text>
        </View>
      </View>

      {expanded && (
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

          {/* Traducción con maquetación coherente (acepciones / pares / etc.) */}
          <View style={styles.translationBody}>
            <TranslationBody translation={item.translation} align="left" />
          </View>

          <ParticleHint word={item.word} category={item.category} />

          {!isMultiSense && item.example_sentence && (
            <View style={styles.exampleBlock}>
              <Text style={styles.exampleText}>"{item.example_sentence}"</Text>
              {item.example_translation && (
                <Text style={styles.exampleTranslation}>"{item.example_translation}"</Text>
              )}
            </View>
          )}

          {!isMultiSense && item.example_sentence_2 && (
            <View style={styles.exampleBlock}>
              <Text style={styles.exampleText}>"{item.example_sentence_2}"</Text>
              {item.example_translation_2 && (
                <Text style={styles.exampleTranslation}>"{item.example_translation_2}"</Text>
              )}
            </View>
          )}

          {item.song_title && (
            <View style={styles.songBlock}>
              <Text style={styles.songIcon}>{anchorIcon(item.anchor_type as AnchorType)}</Text>
              {item.song_lyric && (
                <Text style={styles.songLyric}>"{item.song_lyric}"</Text>
              )}
              {item.song_lyric && item.song_lyric_translation && (
                <Text style={styles.songTranslation}>"{item.song_lyric_translation}"</Text>
              )}
              <Text style={styles.songCredit}>
                — {anchorCredit(item.song_title, item.song_artist, item.anchor_year)}
              </Text>
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
}

const styles = StyleSheet.create({
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
  translationBody: {
    marginBottom: 12,
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
});
