import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/useSettingsStore';

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
                  <Pressable
                    key={option}
                    style={[styles.optionButton, selected === option && styles.optionSelected]}
                    onPress={() => handleSelect(option)}
                  >
                    <Text style={[styles.optionText, selected === option && styles.optionTextSelected]}>
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Pressable
              style={[styles.submitButton, !selected && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!selected}
            >
              <Text style={styles.submitButtonText}>Comprobar</Text>
            </Pressable>
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

            <Pressable style={styles.continueButton} onPress={() => onResult(isCorrect)}>
              <Text style={styles.continueButtonText}>Continuar</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', flex: 0.85, alignSelf: 'center' },
  card: {
    width: '100%', height: '100%', borderRadius: 16, padding: 22,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5,
  },
  cardCorrect: { backgroundColor: '#F0FDF4' },
  cardWrong: { backgroundColor: '#FEF2F2' },
  cefrBadge: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  cefrBadgeText: { fontSize: 12, fontWeight: '700', color: '#4F46E5' },
  instruction: {
    fontSize: 14, fontWeight: '600', color: '#DC2626', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 16,
  },
  sentenceContainer: { marginBottom: 20, paddingHorizontal: 8 },
  sentenceText: { fontSize: 19, lineHeight: 30, color: '#1F2937', textAlign: 'center' },
  errorHighlight: {
    color: '#DC2626', fontWeight: '700', backgroundColor: '#FEE2E2',
    paddingHorizontal: 2, borderRadius: 4,
  },
  errorStrikethrough: { textDecorationLine: 'line-through' },
  questionBox: { marginBottom: 20, paddingHorizontal: 8 },
  questionLabel: { fontSize: 15, color: '#4B5563', textAlign: 'center', lineHeight: 22 },
  errorInQuestion: { fontWeight: '700', color: '#DC2626' },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 20, width: '100%' },
  optionButton: {
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12,
    borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA', minWidth: '40%', alignItems: 'center',
  },
  optionSelected: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  optionText: { fontSize: 15, fontWeight: '500', color: '#374151' },
  optionTextSelected: { color: '#4F46E5', fontWeight: '700' },
  submitButton: { width: '100%', height: 48, borderRadius: 12, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  resultEmoji: { fontSize: 28 },
  resultLabel: { fontSize: 20, fontWeight: '700' },
  resultCorrect: { color: '#16A34A' },
  resultWrong: { color: '#DC2626' },
  correctedBox: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, marginBottom: 16, width: '100%' },
  correctedLabel: { fontSize: 12, fontWeight: '600', color: '#16A34A', textTransform: 'uppercase', marginBottom: 4 },
  correctedText: { fontSize: 16, color: '#1F2937', lineHeight: 24 },
  explanationBox: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 20, width: '100%' },
  explanationText: { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 6 },
  explanationEs: { fontSize: 13, color: '#6B7280', fontStyle: 'italic', lineHeight: 18 },
  translationRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EEF2FF', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 12,
  },
  translationValue: { fontSize: 15, fontWeight: '600', color: '#1F2937', fontStyle: 'italic' },
  continueButton: { width: '100%', height: 48, borderRadius: 12, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' },
  continueButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
