import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Keyboard } from 'react-native';
import { PressableScale } from '../ui/PressableScale';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useAudio } from '../../hooks/useAudio';
import { matchAnswer, MatchResult } from '../../lib/utils/fuzzyMatch';
import { translationSummary } from '../../lib/vocabulary/translationParser';
import { colors, radius, spacing, fontSize, fontWeight, webInputReset } from '../../constants/theme';

interface TypingCardProps {
  word: string;
  translation: string;
  pronunciation?: string;
  category?: string;
  partOfSpeech?: string;
  cefrLevel?: string;
  onResult: (result: MatchResult, userInput: string, hintsUsed: number) => void;
}

export function TypingCard({
  word,
  translation,
  pronunciation,
  category,
  partOfSpeech,
  cefrLevel,
  onResult,
}: TypingCardProps) {
  // If the word contains ' vs ', pre-fill it so user doesn't have to type it
  const hasVs = word.toLowerCase().includes(' vs ');
  const [input, setInput] = useState(hasVs ? ' vs ' : '');
  const [submitted, setSubmitted] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [hintLevel, setHintLevel] = useState(0); // 0 = no hint, 1+ = progressive reveals
  const inputRef = useRef<TextInput>(null);
  const { hapticsEnabled } = useSettingsStore();
  const { playWord } = useAudio();

  // Auto-focus the input when card appears
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = () => {
    if (input.trim().length === 0 || submitted) return;

    const match = matchAnswer(input, word);
    setMatchResult(match.result);
    setSubmitted(true);

    if (hapticsEnabled) {
      if (match.result === 'exact' || match.result === 'close') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    // Play pronunciation so they hear the correct word
    playWord(word);
  };

  const handleContinue = () => {
    if (!matchResult) return;
    onResult(matchResult, input, hintLevel);
  };

  // Words to always show in full in hints (connectors, prepositions etc.)
  const ALWAYS_REVEAL = ['vs', 'to', 'a', 'the', 'of', 'in', 'on', 'up', 'out', 'off', 'for', 'at', 'by', 'an'];

  const letterCount = word.replace(/\s/g, '').length;
  const wordCount = word.split(' ').length;

  // Progressive hint: each level reveals more letters
  // Always-revealed words (vs, to, etc.) are shown in full from level 1
  const buildProgressiveHint = (w: string, level: number): string => {
    if (level === 0) return '';
    
    const chars = w.split('');
    const revealed = new Set<number>();
    
    // Always reveal connector words fully (e.g. "vs", "to")
    const words = w.split(' ');
    let pos = 0;
    for (const part of words) {
      if (ALWAYS_REVEAL.includes(part.toLowerCase())) {
        for (let j = 0; j < part.length; j++) {
          revealed.add(pos + j);
        }
      }
      pos += part.length + 1; // +1 for space
    }
    
    // Level 1: also reveal first letter of each non-connector word
    pos = 0;
    for (const part of words) {
      if (!ALWAYS_REVEAL.includes(part.toLowerCase()) && part.length > 0) {
        revealed.add(pos); // first letter
      }
      pos += part.length + 1;
    }
    
    // Level 2+: reveal additional letters deterministically
    if (level >= 2) {
      const hiddenIndices: number[] = [];
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] !== ' ' && !revealed.has(i)) {
          hiddenIndices.push(i);
        }
      }
      const revealsPerLevel = Math.max(1, Math.ceil(hiddenIndices.length / 3));
      const totalToReveal = Math.min(hiddenIndices.length, revealsPerLevel * (level - 1));
      for (let r = 0; r < totalToReveal; r++) {
        const idx = Math.round((r / totalToReveal) * (hiddenIndices.length - 1));
        revealed.add(hiddenIndices[idx]);
      }
    }
    
    return chars.map((ch, i) => {
      if (ch === ' ') return '  ';
      return revealed.has(i) ? ch.toUpperCase() : '_';
    }).join('');
  };
  
  const hintText = buildProgressiveHint(word, hintLevel);
  
  // Check if there are still hidden letters to reveal
  const totalLetters = word.replace(/\s/g, '').length;
  const revealedCount = hintText.split('').filter(c => c !== '_' && c !== ' ').length;
  const canRevealMore = revealedCount < Math.ceil(totalLetters * 0.65);

  // El enunciado del modo escribir debe mostrar SOLO el significado en español,
  // nunca los ejemplos en inglés: esos contienen el propio phrasal verb (a veces
  // conjugado: "went up", "gave up", "points to") y filtrarían la respuesta.
  // translationSummary devuelve el título/acepciones en español sin ejemplos.
  // Enmascaramos además el objetivo por si acaso el resumen contuviera parte de
  // la respuesta (red de seguridad; normalmente no toca nada).
  const maskText = (text: string, target: string): string => {
    if (!text || !target) return text;
    let result = text;
    const escapeFull = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escapeFull, 'gi'), '___');
    const parts = target.split(/\s+/).filter(w => w.length >= 3);
    for (const part of parts) {
      const escapePart = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`\\b${escapePart}\\b`, 'gi'), '___');
    }
    return result;
  };
  const maskedTranslation = maskText(translationSummary(translation), word);

  return (
    <View style={styles.container}>
      {!submitted ? (
        /* Input phase */
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.languageLabel}>🇪🇸 ESPAÑOL → 🇬🇧 INGLÉS</Text>
            {cefrLevel && (
              <View style={styles.cefrBadge}>
                <Text style={styles.cefrBadgeText}>{cefrLevel.toUpperCase()}</Text>
              </View>
            )}
          </View>

          <Text style={styles.translationText}>{maskedTranslation}</Text>

          <View style={styles.hintRow}>
            {partOfSpeech && (
              <View style={styles.hintTag}>
                <Text style={styles.hintTagText}>{partOfSpeech}</Text>
              </View>
            )}
            <View style={styles.hintTag}>
              <Text style={styles.hintTagText}>💡 {letterCount} letras</Text>
            </View>
            {wordCount > 1 && (
              <View style={styles.hintTag}>
                <Text style={styles.hintTagText}>{wordCount} palabras</Text>
              </View>
            )}
          </View>

          <TextInput
            ref={inputRef}
            style={[styles.input, webInputReset]}
            placeholder={hasVs ? '___  vs  ___' : 'Escribe en inglés...'}
            placeholderTextColor="#9CA3AF"
            value={input}
            onChangeText={setInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {hintLevel > 0 && (
            <Text style={styles.hintRevealText}>{hintText}</Text>
          )}

          <View style={styles.buttonRow}>
            {canRevealMore && (
              <PressableScale
                style={styles.hintButton}
                onPress={() => setHintLevel(prev => prev + 1)}
              >
                <Text style={styles.hintButtonText}>💡 {hintLevel === 0 ? 'Pista' : 'Más'}</Text>
              </PressableScale>
            )}
            <PressableScale
              style={[styles.submitButton, input.trim().length === 0 && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={input.trim().length === 0}
            >
              <Text style={styles.submitButtonText}>Comprobar</Text>
            </PressableScale>
          </View>
        </View>
      ) : (
        /* Result phase */
        <View style={[
          styles.card,
          matchResult === 'exact' && styles.cardCorrect,
          matchResult === 'close' && styles.cardClose,
          matchResult === 'wrong' && styles.cardWrong,
        ]}>
          {matchResult === 'exact' && (
            <>
              <Text style={styles.resultEmoji}>✅</Text>
              <Text style={styles.resultTitle}>¡Correcto!</Text>
            </>
          )}
          {matchResult === 'close' && (
            <>
              <Text style={styles.resultEmoji}>🟡</Text>
              <Text style={styles.resultTitle}>¡Casi!</Text>
            </>
          )}
          {matchResult === 'wrong' && (
            <>
              <Text style={styles.resultEmoji}>❌</Text>
              <Text style={styles.resultTitle}>Incorrecto</Text>
            </>
          )}

          <View style={styles.comparisonBlock}>
            <Text style={styles.comparisonLabel}>Tu respuesta:</Text>
            <Text style={[
              styles.comparisonText,
              matchResult === 'exact' && styles.textCorrect,
              matchResult === 'close' && styles.textClose,
              matchResult === 'wrong' && styles.textWrong,
            ]}>
              {input}
            </Text>
          </View>

          {matchResult !== 'exact' && (
            <View style={styles.comparisonBlock}>
              <Text style={styles.comparisonLabel}>Respuesta correcta:</Text>
              <Text style={[styles.comparisonText, styles.textAnswer]}>{word}</Text>
            </View>
          )}

          <Text style={styles.translationSmall}>{translation}</Text>

          {matchResult === 'wrong' ? (
            /* Wrong: let user self-assess like flashcard mode */
            <View style={styles.selfAssessRow}>
              <PressableScale
                style={[styles.assessButton, styles.assessAgain]}
                onPress={() => onResult('wrong', input, hintLevel)}
              >
                <Text style={styles.assessButtonText}>No lo sabía</Text>
              </PressableScale>
              <PressableScale
                style={[styles.assessButton, styles.assessKnew]}
                onPress={() => onResult('close', input, hintLevel)}
              >
                <Text style={styles.assessButtonText}>Sí lo sabía</Text>
              </PressableScale>
            </View>
          ) : (
            <PressableScale style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueButtonText}>Continuar</Text>
            </PressableScale>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 0.8,
    alignSelf: 'center',
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: radius.lg,
    padding: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardCorrect: {
    backgroundColor: colors.successSurface,
  },
  cardClose: {
    backgroundColor: '#FEFCE8',
  },
  cardWrong: {
    backgroundColor: colors.dangerSurfaceSoft,
  },
  cardHeader: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  languageLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  cefrBadge: {
    backgroundColor: colors.primarySurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  cefrBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  translationText: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  hintRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  hintTag: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  hintTagText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    textAlign: 'center',
    backgroundColor: '#FAFAFA',
    marginBottom: spacing.lg,
  },
  hintRevealText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontFamily: 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  hintButton: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.warningSurface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  hintButtonText: {
    color: colors.warningText,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  submitButton: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonFlex: {
    flex: 1,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: colors.onPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  resultEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  resultTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  comparisonBlock: {
    width: '100%',
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  comparisonText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  textCorrect: {
    color: colors.success,
  },
  textClose: {
    color: '#CA8A04',
  },
  textWrong: {
    color: colors.danger,
  },
  textAnswer: {
    color: colors.success,
  },
  translationSmall: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  selfAssessRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  assessButton: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assessAgain: {
    backgroundColor: '#EF4444',
  },
  assessKnew: {
    backgroundColor: '#22C55E',
  },
  assessButtonText: {
    color: colors.onPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  continueButton: {
    width: '100%',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    color: colors.onPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
