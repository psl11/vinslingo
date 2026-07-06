import React, { useState, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/useSettingsStore';

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
                  <Pressable
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
                  </Pressable>
                ))}
              </View>
            ) : (
              /* Typing input */
              <TextInput
                ref={inputRef}
                style={styles.input}
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
            <Pressable
              style={[
                styles.submitButton,
                ((isMultipleChoice && !selected) || (!isMultipleChoice && typedInput.trim().length === 0))
                  && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={(isMultipleChoice && !selected) || (!isMultipleChoice && typedInput.trim().length === 0)}
            >
              <Text style={styles.submitButtonText}>Comprobar</Text>
            </Pressable>
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

            <Pressable style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueButtonText}>Continuar</Text>
            </Pressable>
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
    borderRadius: 16,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardCorrect: {
    backgroundColor: '#F0FDF4',
  },
  cardWrong: {
    backgroundColor: '#FEF2F2',
  },
  cefrBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cefrBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  sentenceContainer: {
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  sentenceText: {
    fontSize: 20,
    lineHeight: 32,
    color: '#1F2937',
    textAlign: 'center',
  },
  gapText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4F46E5',
    textDecorationLine: 'underline',
  },
  gapCorrect: {
    color: '#16A34A',
  },
  gapWrong: {
    color: '#DC2626',
    textDecorationLine: 'line-through',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
    width: '100%',
  },
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
    minWidth: '40%',
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  optionTextSelected: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#1F2937',
    textAlign: 'center',
    backgroundColor: '#FAFAFA',
    marginBottom: 16,
  },
  submitButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  resultEmoji: {
    fontSize: 28,
  },
  resultLabel: {
    fontSize: 20,
    fontWeight: '700',
  },
  resultCorrect: {
    color: '#16A34A',
  },
  resultWrong: {
    color: '#DC2626',
  },
  correctAnswer: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 16,
  },
  correctAnswerBold: {
    fontWeight: '700',
    color: '#4F46E5',
  },
  explanationBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    width: '100%',
  },
  explanationText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 6,
  },
  explanationEs: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  translationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  translationLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4F46E5',
  },
  translationArrow: {
    fontSize: 16,
    color: '#6B7280',
  },
  translationValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    fontStyle: 'italic',
  },
  continueButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
