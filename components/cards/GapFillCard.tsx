import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { PressableScale } from '../ui/PressableScale';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { colors, radius, spacing, fontSize, fontWeight, webInputReset } from '../../constants/theme';

interface GapFillCardProps {
  sentence: string;       // e.g. "I wanted to go, ___ it was raining."
  answer: string;         // e.g. "but"
  options?: string[];     // e.g. ["but","so","because","although"] — null for typing mode
  explanation: string;
  explanationEs: string;
  cefrLevel?: string;
  answerEs?: string;
  baseWord?: string;      // frase completa a mostrar en el chip (p.ej. "set up" en vez de "up")
  onResult: (isCorrect: boolean) => void;
}

export function GapFillCard({
  sentence,
  answer,
  options,
  explanation,
  explanationEs,
  cefrLevel,
  answerEs,
  baseWord,
  onResult,
}: GapFillCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [typedInput, setTypedInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { hapticsEnabled } = useSettingsStore();

  const isMultipleChoice = !!options && options.length > 0;
  const isCorrect = submitted && (
    isMultipleChoice
      ? selected?.toLowerCase() === answer.toLowerCase()
      : typedInput.trim().toLowerCase() === answer.toLowerCase()
  );

  const handleSelectOption = (option: string) => {
    if (submitted) return;
    setSelected(option);
  };

  const handleSubmit = () => {
    if (submitted) return;
    if (isMultipleChoice && !selected) return;
    if (!isMultipleChoice && typedInput.trim().length === 0) return;

    setSubmitted(true);
    const correct = isMultipleChoice
      ? selected?.toLowerCase() === answer.toLowerCase()
      : typedInput.trim().toLowerCase() === answer.toLowerCase();

    if (hapticsEnabled) {
      if (correct) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  const handleContinue = () => {
    onResult(isCorrect);
  };

  // Split sentence around ___
  const parts = sentence.split('___');
  const before = parts[0] || '';
  const after = parts[1] || '';

  // Shuffle options deterministically (they come pre-shuffled from seed, but let's ensure)
  const shuffledOptions = options ? [...options] : [];

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

        {/* Sentence with gap */}
        <View style={styles.sentenceContainer}>
          <Text style={styles.sentenceText}>
            {before}
            <Text style={[
              styles.gapText,
              submitted && isCorrect && styles.gapCorrect,
              submitted && !isCorrect && styles.gapWrong,
            ]}>
              {submitted
                ? (isMultipleChoice ? selected : typedInput.trim()) || '___'
                : '___'}
            </Text>
            {after}
          </Text>
        </View>

        {!submitted ? (
          <>
            {/* Multiple choice options */}
            {isMultipleChoice ? (
              <View style={styles.optionsGrid}>
                {shuffledOptions.map((option) => (
                  <PressableScale
                    key={option}
                    style={[
                      styles.optionButton,
                      selected === option && styles.optionSelected,
                    ]}
                    onPress={() => handleSelectOption(option)}
                  >
                    <Text style={[
                      styles.optionText,
                      selected === option && styles.optionTextSelected,
                    ]}>
                      {option}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            ) : (
              /* Typing input */
              <TextInput
                ref={inputRef}
                style={[styles.input, webInputReset]}
                placeholder="Escribe el conector..."
                placeholderTextColor="#9CA3AF"
                value={typedInput}
                onChangeText={setTypedInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                autoFocus
              />
            )}

            {/* Submit button */}
            <PressableScale
              style={[
                styles.submitButton,
                ((isMultipleChoice && !selected) || (!isMultipleChoice && typedInput.trim().length === 0))
                  && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={(isMultipleChoice && !selected) || (!isMultipleChoice && typedInput.trim().length === 0)}
            >
              <Text style={styles.submitButtonText}>Comprobar</Text>
            </PressableScale>
          </>
        ) : (
          /* Result phase */
          <>
            <View style={styles.resultRow}>
              <Text style={styles.resultEmoji}>{isCorrect ? '✅' : '❌'}</Text>
              <Text style={[styles.resultLabel, isCorrect ? styles.resultCorrect : styles.resultWrong]}>
                {isCorrect ? '¡Correcto!' : 'Incorrecto'}
              </Text>
            </View>

            {!isCorrect && (
              <Text style={styles.correctAnswer}>
                Respuesta correcta: <Text style={styles.correctAnswerBold}>{answer}</Text>
              </Text>
            )}

            {answerEs && (
              <View style={styles.translationRow}>
                <Text style={styles.translationLabel}>{baseWord || answer}</Text>
                <Text style={styles.translationArrow}> = </Text>
                <Text style={styles.translationValue}>{answerEs}</Text>
              </View>
            )}

            <View style={styles.explanationBox}>
              <Text style={styles.explanationText}>{explanation}</Text>
              <Text style={styles.explanationEs}>{explanationEs}</Text>
            </View>

            <PressableScale style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueButtonText}>Continuar</Text>
            </PressableScale>
          </>
        )}
      </View>
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
  cardWrong: {
    backgroundColor: colors.dangerSurfaceSoft,
  },
  cefrBadge: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
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
  sentenceContainer: {
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.sm,
  },
  sentenceText: {
    fontSize: fontSize.xl,
    lineHeight: 32,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  gapText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  gapCorrect: {
    color: colors.success,
  },
  gapWrong: {
    color: colors.danger,
    textDecorationLine: 'line-through',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
    width: '100%',
  },
  optionButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#FAFAFA',
    minWidth: '40%',
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  optionText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textStrong,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  input: {
    width: '100%',
    height: 48,
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
  submitButton: {
    width: '100%',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: colors.onPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  resultEmoji: {
    fontSize: 28,
  },
  resultLabel: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  resultCorrect: {
    color: colors.success,
  },
  resultWrong: {
    color: colors.danger,
  },
  correctAnswer: {
    fontSize: fontSize.md,
    color: colors.textStrong,
    marginBottom: spacing.lg,
  },
  correctAnswerBold: {
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  explanationBox: {
    backgroundColor: colors.screen,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    width: '100%',
  },
  explanationText: {
    fontSize: fontSize.base,
    color: colors.textStrong,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  explanationEs: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  translationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySurface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  translationLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  translationArrow: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  translationValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    fontStyle: 'italic',
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
