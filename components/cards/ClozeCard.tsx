import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useAudio } from '../../hooks/useAudio';
import { matchAnswer, MatchResult } from '../../lib/utils/fuzzyMatch';

interface ClozeCardProps {
  word: string;
  translation: string;
  sentence: string;            // example sentence containing the word
  sentenceTranslation?: string;
  cefrLevel?: string;
  onResult: (result: MatchResult, userInput: string, hintsUsed: number) => void;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Recall-in-context: show the example sentence with the target word blanked and
// let the user produce it. Recalling a word in a real sentence builds more
// durable, transferable memory than translating it in isolation.
export function ClozeCard({
  word,
  translation,
  sentence,
  sentenceTranslation,
  cefrLevel,
  onResult,
}: ClozeCardProps) {
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const inputRef = useRef<TextInput>(null);
  const { hapticsEnabled } = useSettingsStore();
  const { playWord } = useAudio();

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, []);

  // Blank out the word in the sentence (whole word, case-insensitive).
  const blanked = sentence.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi'), '_____');
  const parts = blanked.split('_____');
  const before = parts[0] ?? sentence;
  const after = parts.length > 1 ? parts.slice(1).join('_____') : '';

  const handleSubmit = () => {
    if (input.trim().length === 0 || submitted) return;
    const match = matchAnswer(input, word);
    setMatchResult(match.result);
    setSubmitted(true);
    playWord(word);
    if (hapticsEnabled) {
      Haptics.notificationAsync(
        match.result === 'wrong'
          ? Haptics.NotificationFeedbackType.Error
          : Haptics.NotificationFeedbackType.Success
      );
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.card,
          submitted && matchResult === 'exact' && styles.cardCorrect,
          submitted && matchResult === 'close' && styles.cardClose,
          submitted && matchResult === 'wrong' && styles.cardWrong,
        ]}
      >
        {cefrLevel && (
          <View style={styles.cefrBadge}>
            <Text style={styles.cefrBadgeText}>{cefrLevel.toUpperCase()}</Text>
          </View>
        )}

        <Text style={styles.prompt}>Completa la frase</Text>

        {/* Spanish meaning as the hint */}
        <Text style={styles.translationHint}>{translation}</Text>

        {/* Sentence with the gap */}
        <View style={styles.sentenceContainer}>
          <Text style={styles.sentenceText}>
            {before}
            <Text
              style={[
                styles.gapText,
                submitted && matchResult === 'exact' && styles.gapCorrect,
                submitted && matchResult === 'wrong' && styles.gapWrong,
              ]}
            >
              {submitted ? (matchResult === 'exact' ? input.trim() : word) : '_____'}
            </Text>
            {after}
          </Text>
        </View>

        {!submitted ? (
          <>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Escribe la palabra que falta..."
              placeholderTextColor="#9CA3AF"
              value={input}
              onChangeText={setInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <Pressable
              style={[styles.submitButton, input.trim().length === 0 && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={input.trim().length === 0}
            >
              <Text style={styles.submitButtonText}>Comprobar</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.resultRow}>
              <Text style={styles.resultEmoji}>
                {matchResult === 'exact' ? '✅' : matchResult === 'close' ? '🟡' : '❌'}
              </Text>
              <Text style={styles.resultTitle}>
                {matchResult === 'exact' ? '¡Correcto!' : matchResult === 'close' ? '¡Casi!' : 'Incorrecto'}
              </Text>
            </View>

            {matchResult !== 'exact' && (
              <Text style={styles.correctAnswer}>
                Respuesta: <Text style={styles.correctAnswerBold}>{word}</Text>
              </Text>
            )}

            {sentenceTranslation && (
              <Text style={styles.sentenceTranslation}>"{sentenceTranslation}"</Text>
            )}

            {matchResult === 'wrong' ? (
              <View style={styles.selfAssessRow}>
                <Pressable
                  style={[styles.assessButton, styles.assessAgain]}
                  onPress={() => onResult('wrong', input, 0)}
                >
                  <Text style={styles.assessButtonText}>No lo sabía</Text>
                </Pressable>
                <Pressable
                  style={[styles.assessButton, styles.assessKnew]}
                  onPress={() => onResult('close', input, 0)}
                >
                  <Text style={styles.assessButtonText}>Sí lo sabía</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.continueButton} onPress={() => onResult(matchResult!, input, 0)}>
                <Text style={styles.continueButtonText}>Continuar</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', flex: 0.8, alignSelf: 'center' },
  card: {
    width: '100%', height: '100%', borderRadius: 16, padding: 24,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5,
  },
  cardCorrect: { backgroundColor: '#F0FDF4' },
  cardClose: { backgroundColor: '#FEFCE8' },
  cardWrong: { backgroundColor: '#FEF2F2' },
  cefrBadge: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  cefrBadgeText: { fontSize: 12, fontWeight: '700', color: '#4F46E5' },
  prompt: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' },
  translationHint: { fontSize: 18, fontWeight: '600', color: '#4F46E5', textAlign: 'center', marginBottom: 20 },
  sentenceContainer: { marginBottom: 24, paddingHorizontal: 8 },
  sentenceText: { fontSize: 20, lineHeight: 32, color: '#1F2937', textAlign: 'center' },
  gapText: { fontSize: 20, fontWeight: '700', color: '#4F46E5', textDecorationLine: 'underline' },
  gapCorrect: { color: '#16A34A' },
  gapWrong: { color: '#DC2626' },
  input: {
    width: '100%', height: 50, borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 16, fontSize: 18, color: '#1F2937', textAlign: 'center', backgroundColor: '#FAFAFA', marginBottom: 16,
  },
  submitButton: { width: '100%', height: 48, borderRadius: 12, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  resultEmoji: { fontSize: 28 },
  resultTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  correctAnswer: { fontSize: 16, color: '#374151', marginBottom: 10 },
  correctAnswerBold: { fontWeight: '700', color: '#4F46E5' },
  sentenceTranslation: { fontSize: 13, color: '#6B7280', fontStyle: 'italic', textAlign: 'center', marginBottom: 16 },
  selfAssessRow: { flexDirection: 'row', gap: 12, width: '100%' },
  assessButton: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  assessAgain: { backgroundColor: '#EF4444' },
  assessKnew: { backgroundColor: '#22C55E' },
  assessButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  continueButton: { width: '100%', height: 48, borderRadius: 12, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' },
  continueButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
