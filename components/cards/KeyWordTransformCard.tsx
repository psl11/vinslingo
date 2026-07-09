import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { PressableScale } from '../ui/PressableScale';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/useSettingsStore';

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
              style={styles.input}
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
  originalBox: {
    backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14, marginBottom: 16, width: '100%',
  },
  originalLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 },
  originalText: { fontSize: 16, color: '#1F2937', lineHeight: 24, fontStyle: 'italic' },
  keywordPill: {
    backgroundColor: '#DBEAFE', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8,
    alignItems: 'center', marginBottom: 16,
  },
  keywordLabel: { fontSize: 11, fontWeight: '600', color: '#1E40AF', textTransform: 'uppercase', marginBottom: 2 },
  keywordText: { fontSize: 20, fontWeight: '800', color: '#1E40AF', letterSpacing: 2 },
  sentenceContainer: { marginBottom: 20, paddingHorizontal: 4 },
  sentenceText: { fontSize: 18, lineHeight: 28, color: '#1F2937', textAlign: 'center' },
  gapText: { fontSize: 18, fontWeight: '700', color: '#4F46E5', textDecorationLine: 'underline' },
  gapCorrect: { color: '#16A34A' },
  gapWrong: { color: '#DC2626', textDecorationLine: 'line-through' },
  input: {
    width: '100%', height: 48, borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 16, fontSize: 17, color: '#1F2937', textAlign: 'center', backgroundColor: '#FAFAFA', marginBottom: 16,
  },
  submitButton: { width: '100%', height: 48, borderRadius: 12, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  resultEmoji: { fontSize: 28 },
  resultLabel: { fontSize: 20, fontWeight: '700' },
  resultCorrect: { color: '#16A34A' },
  resultWrong: { color: '#DC2626' },
  correctAnswerBox: { marginBottom: 16, width: '100%' },
  correctAnswerLabel: { fontSize: 14, color: '#6B7280', marginBottom: 6 },
  fullSentence: { fontSize: 16, color: '#1F2937', lineHeight: 24 },
  correctAnswerBold: { fontWeight: '700', color: '#4F46E5' },
  explanationBox: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 20, width: '100%' },
  explanationText: { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 6 },
  explanationEs: { fontSize: 13, color: '#6B7280', fontStyle: 'italic', lineHeight: 18 },
  translationRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EEF2FF', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 12,
  },
  translationLabel: { fontSize: 15, fontWeight: '700', color: '#4F46E5' },
  translationArrow: { fontSize: 15, color: '#6B7280' },
  translationValue: { fontSize: 15, fontWeight: '700', color: '#1F2937', fontStyle: 'italic' },
  continueButton: { width: '100%', height: 48, borderRadius: 12, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' },
  continueButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
