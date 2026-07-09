import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale } from '../ui/PressableScale';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { colors, radius, spacing, fontSize, fontWeight } from '../../constants/theme';

interface ErrorCorrectionCardProps {
  sentence: string;          // Sentence WITH error: "She suggested me to go..."
  correctedSentence: string; // Full corrected sentence
  errorPhrase: string;       // The wrong part: "me to go"
  correction: string;        // The right part: "I go"
  options?: string[];        // Multiple choice for the correction
  explanation: string;
  explanationEs: string;
  cefrLevel?: string;
  answerEs?: string;
  onResult: (isCorrect: boolean) => void;
}

export function ErrorCorrectionCard({
  sentence,
  correctedSentence,
  errorPhrase,
  correction,
  options,
  explanation,
  explanationEs,
  cefrLevel,
  answerEs,
  onResult,
}: ErrorCorrectionCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { hapticsEnabled } = useSettingsStore();

  const isCorrect = submitted && selected?.toLowerCase() === correction.toLowerCase();

  // Highlight the error in the sentence
  const errorIndex = sentence.toLowerCase().indexOf(errorPhrase.toLowerCase());
  const beforeError = errorIndex >= 0 ? sentence.slice(0, errorIndex) : sentence;
  const errorText = errorIndex >= 0 ? sentence.slice(errorIndex, errorIndex + errorPhrase.length) : '';
  const afterError = errorIndex >= 0 ? sentence.slice(errorIndex + errorPhrase.length) : '';

  const handleSelect = (option: string) => {
    if (submitted) return;
    setSelected(option);
  };

  const handleSubmit = () => {
    if (submitted || !selected) return;
    setSubmitted(true);
    const correct = selected.toLowerCase() === correction.toLowerCase();
    if (hapticsEnabled) {
      Haptics.notificationAsync(
        correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      );
    }
  };

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

        {/* Instruction */}
        <Text style={styles.instruction}>Encuentra y corrige el error:</Text>

        {/* Sentence with highlighted error */}
        <View style={styles.sentenceContainer}>
          <Text style={styles.sentenceText}>
            {beforeError}
            <Text style={[
              styles.errorHighlight,
              submitted && styles.errorStrikethrough,
            ]}>
              {errorText}
            </Text>
            {afterError}
          </Text>
        </View>

        {/* Show correction target */}
        <View style={styles.questionBox}>
          <Text style={styles.questionLabel}>
            ¿Qué debería decir en lugar de{' '}
            <Text style={styles.errorInQuestion}>"{errorPhrase}"</Text>?
          </Text>
        </View>

        {!submitted ? (
          <>
            {/* Options */}
            {options && options.length > 0 && (
              <View style={styles.optionsGrid}>
                {options.map((option) => (
                  <PressableScale
                    key={option}
                    style={[styles.optionButton, selected === option && styles.optionSelected]}
                    onPress={() => handleSelect(option)}
                  >
                    <Text style={[styles.optionText, selected === option && styles.optionTextSelected]}>
                      {option}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            )}

            <PressableScale
              style={[styles.submitButton, !selected && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!selected}
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

            {/* Show corrected sentence */}
            <View style={styles.correctedBox}>
              <Text style={styles.correctedLabel}>Frase correcta:</Text>
              <Text style={styles.correctedText}>{correctedSentence}</Text>
            </View>

            {answerEs && (
              <View style={styles.translationRow}>
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
  instruction: {
    fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.danger, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: spacing.lg,
  },
  sentenceContainer: { marginBottom: spacing.xl, paddingHorizontal: spacing.sm },
  sentenceText: { fontSize: fontSize.lg, lineHeight: 30, color: colors.textPrimary, textAlign: 'center' },
  errorHighlight: {
    color: colors.danger, fontWeight: fontWeight.bold, backgroundColor: colors.dangerSurface,
    paddingHorizontal: spacing.xxs, borderRadius: spacing.xs,
  },
  errorStrikethrough: { textDecorationLine: 'line-through' },
  questionBox: { marginBottom: spacing.xl, paddingHorizontal: spacing.sm },
  questionLabel: { fontSize: fontSize.md, color: '#4B5563', textAlign: 'center', lineHeight: 22 },
  errorInQuestion: { fontWeight: fontWeight.bold, color: colors.danger },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.xl, width: '100%' },
  optionButton: {
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.border, backgroundColor: '#FAFAFA', minWidth: '40%', alignItems: 'center',
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySurface },
  optionText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.textStrong },
  optionTextSelected: { color: colors.primary, fontWeight: fontWeight.bold },
  submitButton: { width: '100%', height: 48, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  resultEmoji: { fontSize: 28 },
  resultLabel: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  resultCorrect: { color: colors.success },
  resultWrong: { color: colors.danger },
  correctedBox: { backgroundColor: colors.successSurface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg, width: '100%' },
  correctedLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.success, textTransform: 'uppercase', marginBottom: spacing.xs },
  correctedText: { fontSize: fontSize.md, color: colors.textPrimary, lineHeight: 24 },
  explanationBox: { backgroundColor: colors.screen, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.xl, width: '100%' },
  explanationText: { fontSize: fontSize.base, color: colors.textStrong, lineHeight: 20, marginBottom: spacing.sm },
  explanationEs: { fontSize: fontSize.sm, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 18 },
  translationRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primarySurface, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  translationValue: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary, fontStyle: 'italic' },
  continueButton: { width: '100%', height: 48, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  continueButtonText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
