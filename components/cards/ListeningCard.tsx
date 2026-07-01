import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useAudio } from '../../hooks/useAudio';
import { matchAnswer, MatchResult } from '../../lib/utils/fuzzyMatch';

interface ListeningCardProps {
  word: string;
  translation: string;
  example?: string;
  exampleTranslation?: string;
  cefrLevel?: string;
  onResult: (result: MatchResult, userInput: string, hintsUsed: number) => void;
}

// Dictation exercise: the word is played out loud (English TTS) and the user
// types what they heard. Trains listening comprehension and spelling — a skill
// the flashcard/typing flows don't exercise.
export function ListeningCard({
  word,
  translation,
  example,
  exampleTranslation,
  cefrLevel,
  onResult,
}: ListeningCardProps) {
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const inputRef = useRef<TextInput>(null);
  const { hapticsEnabled } = useSettingsStore();
  const { playWord } = useAudio();

  // Play the word when the card appears, then focus the input.
  useEffect(() => {
    playWord(word);
    const timer = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = () => {
    if (input.trim().length === 0 || submitted) return;

    const match = matchAnswer(input, word);
    setMatchResult(match.result);
    setSubmitted(true);

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

        {!submitted ? (
          <>
            <Text style={styles.prompt}>🎧 Escucha y escribe</Text>

            <Pressable style={styles.playButton} onPress={() => playWord(word)}>
              <Text style={styles.playIcon}>🔊</Text>
              <Text style={styles.playText}>Reproducir de nuevo</Text>
            </Pressable>

            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="¿Qué has oído?"
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
            <Text style={styles.resultEmoji}>
              {matchResult === 'exact' ? '✅' : matchResult === 'close' ? '🟡' : '❌'}
            </Text>
            <Text style={styles.resultTitle}>
              {matchResult === 'exact' ? '¡Correcto!' : matchResult === 'close' ? '¡Casi!' : 'Incorrecto'}
            </Text>

            <View style={styles.comparisonBlock}>
              <Text style={styles.comparisonLabel}>Tu respuesta:</Text>
              <Text
                style={[
                  styles.comparisonText,
                  matchResult === 'exact' && styles.textCorrect,
                  matchResult === 'close' && styles.textClose,
                  matchResult === 'wrong' && styles.textWrong,
                ]}
              >
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

            {example && (
              <View style={styles.exampleBlock}>
                <Text style={styles.exampleText}>"{example}"</Text>
                {exampleTranslation && (
                  <Text style={styles.exampleTranslation}>"{exampleTranslation}"</Text>
                )}
              </View>
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
  prompt: { fontSize: 16, fontWeight: '600', color: '#6B7280', marginBottom: 20 },
  playButton: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#EEF2FF', borderRadius: 16, paddingVertical: 18, paddingHorizontal: 28, marginBottom: 24,
  },
  playIcon: { fontSize: 28 },
  playText: { fontSize: 16, fontWeight: '600', color: '#4F46E5' },
  input: {
    width: '100%', height: 50, borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 16, fontSize: 18, color: '#1F2937', textAlign: 'center', backgroundColor: '#FAFAFA', marginBottom: 16,
  },
  submitButton: { width: '100%', height: 48, borderRadius: 12, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  resultEmoji: { fontSize: 48, marginBottom: 8 },
  resultTitle: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 16 },
  comparisonBlock: { width: '100%', marginBottom: 12, alignItems: 'center' },
  comparisonLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  comparisonText: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  textCorrect: { color: '#16A34A' },
  textClose: { color: '#CA8A04' },
  textWrong: { color: '#DC2626' },
  textAnswer: { color: '#16A34A' },
  translationSmall: { fontSize: 14, color: '#6B7280', marginTop: 4, marginBottom: 12, textAlign: 'center' },
  exampleBlock: { width: '100%', marginBottom: 16, alignItems: 'center' },
  exampleText: { fontSize: 14, color: '#444444', fontStyle: 'italic', textAlign: 'center' },
  exampleTranslation: { fontSize: 12, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  selfAssessRow: { flexDirection: 'row', gap: 12, width: '100%' },
  assessButton: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  assessAgain: { backgroundColor: '#EF4444' },
  assessKnew: { backgroundColor: '#22C55E' },
  assessButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  continueButton: { width: '100%', height: 48, borderRadius: 12, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' },
  continueButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
