import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { PressableScale } from '../ui/PressableScale';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { colors, radius, spacing, fontSize, fontWeight, webInputReset } from '../../constants/theme';

interface KeyWordTransformCardProps {
  originalSentence: string;  // "I last saw her three years ago."
  targetSentence: string;    // "I ___ three years."
  keyword: string;           // "SINCE"
  answer: string;            // "haven't seen her for"
  explanation: string;
  explanationEs: string;
  cefrLevel?: string;
  answerEs?: string;
  onResult: (isCorrect: boolean) => void;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/['']/g, "'").replace(/\s+/g, ' ').trim();
}

export function KeyWordTransformCard({
  originalSentence,
  targetSentence,
  keyword,
  answer,
  explanation,
  explanationEs,
  cefrLevel,
  answerEs,
  onResult,
}: KeyWordTransformCardProps) {
  const [typedInput, setTypedInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { hapticsEnabled } = useSettingsStore();

  const isCorrect = submitted && normalise(typedInput) === normalise(answer);

  const handleSubmit = () => {
    if (submitted || typedInput.trim().length === 0) return;
    setSubmitted(true);
    const correct = normalise(typedInput) === normalise(answer);
    if (hapticsEnabled) {
      Haptics.notificationAsync(
        correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      );
    }
  };

  const parts = targetSentence.split('___');
  const before = parts[0] || '';
  const after = parts[1] || '';

  return (
    <View style={styles.container}>
      <View style={[
        styles.card,
        submitted && isCorrect && styles.cardCorrect,
        submitted && !isCorrect && styles.cardWrong,
      ]}>
        {cefrLevel && (
          <View style={styles.cefrBadge}>
            <Text style={styles.cefrBadgeText}>{cefrLevel}</Text>
          </View>
        )}

        {/* Original sentence */}
        <View style={styles.originalBox}>
          <Text style={styles.originalLabel}>Frase original</Text>
          <Text style={styles.originalText}>{originalSentence}</Text>
        </View>

        {/* Keyword pill */}
        <View style={styles.keywordPill}>
          <Text style={styles.keywordLabel}>Palabra clave</Text>
          <Text style={styles.keywordText}>{keyword}</Text>
        </View>

        {/* Target sentence with gap */}
        <View style={styles.sentenceContainer}>
          <Text style={styles.sentenceText}>
            {before}
            <Text style={[
              styles.gapText,
              submitted && isCorrect && styles.gapCorrect,
              submitted && !isCorrect && styles.gapWrong,
            ]}>
              {submitted ? typedInput.trim() || '___' : '___'}
            </Text>
            {after}
          </Text>
        </View>

        {!submitted ? (
          <>
            <TextInput
              ref={inputRef}
              style={[styles.input, webInputReset]}
              placeholder="Completa la transformación..."
              placeholderTextColor="#9CA3AF"
              value={typedInput}
              onChangeText={setTypedInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              autoFocus
            />

            <PressableScale
              style={[styles.submitButton, typedInput.trim().length === 0 && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={typedInput.trim().length === 0}
            >
              <Text style={styles.submitButtonText}>Comprobar</Text>
            </PressableScale>
          </>
        ) : (
          <>
            <View style={styles.resultRow}>
              <Text style={styles.resultEmoji}>{isCorrect ? '✅' : '❌'}</Text>
              <Text style={[styles.resultLabel, isCorrect ? styles.resultCorrect : styles.resultWrong]}>
                {isCorrect ? '¡Correcto!' : 'Incorrecto'}
              </Text>
            </View>

            {!isCorrect && (
              <View style={styles.correctAnswerBox}>
                <Text style={styles.correctAnswerLabel}>Respuesta correcta:</Text>
                <Text style={styles.fullSentence}>
                  {before}
                  <Text style={styles.correctAnswerBold}>{answer}</Text>
                  {after}
                </Text>
              </View>
            )}

            {answerEs && (
              <View style={styles.translationRow}>
                <Text style={styles.translationLabel}>{answer}</Text>
                <Text style={styles.translationArrow}> = </Text>
                <Text style={styles.translationValue}>{answerEs}</Text>
              </View>
            )}

            <View style={styles.explanationBox}>
              <Text style={styles.explanationText}>{explanation}</Text>
              <Text style={styles.explanationEs}>{explanationEs}</Text>
            </View>

            <PressableScale style={styles.continueButton} onPress={() => onResult(isCorrect)}>
              <Text style={styles.continueButtonText}>Continuar</Text>
            </PressableScale>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', flex: 0.85, alignSelf: 'center' },
  card: {
    width: '100%', height: '100%', borderRadius: radius.lg, padding: spacing.xxl,
    justifyContent: 'center', alignItems: 'center', backgroundColor: colors.card,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5,
  },
  cardCorrect: { backgroundColor: colors.successSurface },
  cardWrong: { backgroundColor: colors.dangerSurfaceSoft },
  cefrBadge: {
    position: 'absolute', top: spacing.lg, right: spacing.lg,
    backgroundColor: colors.primarySurface, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm,
  },
  cefrBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.primary },
  originalBox: {
    backgroundColor: colors.surfaceSubtle, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg, width: '100%',
  },
  originalLabel: { fontSize: fontSize.xxs, fontWeight: fontWeight.semibold, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.xs },
  originalText: { fontSize: fontSize.md, color: colors.textPrimary, lineHeight: 24, fontStyle: 'italic' },
  keywordPill: {
    backgroundColor: colors.infoSurface, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    alignItems: 'center', marginBottom: spacing.lg,
  },
  keywordLabel: { fontSize: fontSize.xxs, fontWeight: fontWeight.semibold, color: '#1E40AF', textTransform: 'uppercase', marginBottom: spacing.xxs },
  keywordText: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: '#1E40AF', letterSpacing: 2 },
  sentenceContainer: { marginBottom: spacing.xl, paddingHorizontal: spacing.xs },
  sentenceText: { fontSize: fontSize.lg, lineHeight: 28, color: colors.textPrimary, textAlign: 'center' },
  gapText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary, textDecorationLine: 'underline' },
  gapCorrect: { color: colors.success },
  gapWrong: { color: colors.danger, textDecorationLine: 'line-through' },
  input: {
    width: '100%', height: 48, borderWidth: 2, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, fontSize: fontSize.lg, color: colors.textPrimary, textAlign: 'center', backgroundColor: '#FAFAFA', marginBottom: spacing.lg,
  },
  submitButton: { width: '100%', height: 48, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  resultEmoji: { fontSize: 28 },
  resultLabel: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  resultCorrect: { color: colors.success },
  resultWrong: { color: colors.danger },
  correctAnswerBox: { marginBottom: spacing.lg, width: '100%' },
  correctAnswerLabel: { fontSize: fontSize.base, color: colors.textSecondary, marginBottom: spacing.sm },
  fullSentence: { fontSize: fontSize.md, color: colors.textPrimary, lineHeight: 24 },
  correctAnswerBold: { fontWeight: fontWeight.bold, color: colors.primary },
  explanationBox: { backgroundColor: colors.screen, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.xl, width: '100%' },
  explanationText: { fontSize: fontSize.base, color: colors.textStrong, lineHeight: 20, marginBottom: spacing.sm },
  explanationEs: { fontSize: fontSize.sm, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 18 },
  translationRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primarySurface, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  translationLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
  translationArrow: { fontSize: fontSize.md, color: colors.textSecondary },
  translationValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary, fontStyle: 'italic' },
  continueButton: { width: '100%', height: 48, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  continueButtonText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
