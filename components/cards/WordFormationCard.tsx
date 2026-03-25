import React, { useState, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/useSettingsStore';

interface WordFormationCardProps {
  sentence: string;       // "The experiment was a great ___."
  answer: string;         // "success"
  baseWord: string;       // "SUCCEED"
  options?: string[];     // ["success","successful","succession","successive"]
  explanation: string;
  explanationEs: string;
  cefrLevel?: string;
  answerEs?: string;
  onResult: (isCorrect: boolean) => void;
}

export function WordFormationCard({
  sentence,
  answer,
  baseWord,
  options,
  explanation,
  explanationEs,
  cefrLevel,
  answerEs,
  onResult,
}: WordFormationCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [typedInput, setTypedInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { hapticsEnabled } = useSettingsStore();

  const isMultipleChoice = !!options && options.length > 0;
  const userAnswer = isMultipleChoice ? selected : typedInput.trim();
  const isCorrect = submitted && userAnswer?.toLowerCase() === answer.toLowerCase();

  const handleSubmit = () => {
    if (submitted) return;
    if (isMultipleChoice && !selected) return;
    if (!isMultipleChoice && typedInput.trim().length === 0) return;

    setSubmitted(true);
    const correct = (isMultipleChoice ? selected : typedInput.trim())?.toLowerCase() === answer.toLowerCase();

    if (hapticsEnabled) {
      Haptics.notificationAsync(
        correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      );
    }
  };

  const parts = sentence.split('___');
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

        {/* Base word pill */}
        <View style={styles.baseWordPill}>
          <Text style={styles.baseWordLabel}>Palabra base</Text>
          <Text style={styles.baseWordText}>{baseWord}</Text>
        </View>

        {/* Sentence with gap */}
        <View style={styles.sentenceContainer}>
          <Text style={styles.sentenceText}>
            {before}
            <Text style={[
              styles.gapText,
              submitted && isCorrect && styles.gapCorrect,
              submitted && !isCorrect && styles.gapWrong,
            ]}>
              {submitted ? userAnswer || '___' : '___'}
            </Text>
            {after}
          </Text>
        </View>

        {!submitted ? (
          <>
            {isMultipleChoice ? (
              <View style={styles.optionsGrid}>
                {options.map((option) => (
                  <Pressable
                    key={option}
                    style={[styles.optionButton, selected === option && styles.optionSelected]}
                    onPress={() => setSelected(option)}
                  >
                    <Text style={[styles.optionText, selected === option && styles.optionTextSelected]}>
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Escribe la palabra transformada..."
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

            <View style={styles.transformRow}>
              <Text style={styles.transformFrom}>{baseWord}</Text>
              <Text style={styles.transformArrow}>→</Text>
              <Text style={styles.transformTo}>{answer}</Text>
            </View>

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
    width: '100%', height: '100%', borderRadius: 16, padding: 24,
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
  baseWordPill: {
    backgroundColor: '#FEF3C7', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    alignItems: 'center', marginBottom: 20,
  },
  baseWordLabel: { fontSize: 11, fontWeight: '600', color: '#92400E', textTransform: 'uppercase', marginBottom: 2 },
  baseWordText: { fontSize: 22, fontWeight: '800', color: '#92400E', letterSpacing: 2 },
  sentenceContainer: { marginBottom: 24, paddingHorizontal: 8 },
  sentenceText: { fontSize: 19, lineHeight: 30, color: '#1F2937', textAlign: 'center' },
  gapText: { fontSize: 19, fontWeight: '700', color: '#4F46E5', textDecorationLine: 'underline' },
  gapCorrect: { color: '#16A34A' },
  gapWrong: { color: '#DC2626', textDecorationLine: 'line-through' },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 20, width: '100%' },
  optionButton: {
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12,
    borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA', minWidth: '40%', alignItems: 'center',
  },
  optionSelected: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  optionText: { fontSize: 16, fontWeight: '500', color: '#374151' },
  optionTextSelected: { color: '#4F46E5', fontWeight: '700' },
  input: {
    width: '100%', height: 48, borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 16, fontSize: 18, color: '#1F2937', textAlign: 'center', backgroundColor: '#FAFAFA', marginBottom: 16,
  },
  submitButton: { width: '100%', height: 48, borderRadius: 12, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  resultEmoji: { fontSize: 28 },
  resultLabel: { fontSize: 20, fontWeight: '700' },
  resultCorrect: { color: '#16A34A' },
  resultWrong: { color: '#DC2626' },
  correctAnswer: { fontSize: 16, color: '#374151', marginBottom: 12 },
  correctAnswerBold: { fontWeight: '700', color: '#4F46E5' },
  transformRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  transformFrom: { fontSize: 16, fontWeight: '700', color: '#92400E', backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  transformArrow: { fontSize: 20, color: '#6B7280' },
  transformTo: { fontSize: 16, fontWeight: '700', color: '#16A34A', backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  explanationBox: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 20, width: '100%' },
  explanationText: { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 6 },
  explanationEs: { fontSize: 13, color: '#6B7280', fontStyle: 'italic', lineHeight: 18 },
  translationRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EEF2FF', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 12,
  },
  translationLabel: { fontSize: 16, fontWeight: '700', color: '#4F46E5' },
  translationArrow: { fontSize: 16, color: '#6B7280' },
  translationValue: { fontSize: 16, fontWeight: '700', color: '#1F2937', fontStyle: 'italic' },
  continueButton: { width: '100%', height: 48, borderRadius: 12, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' },
  continueButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
