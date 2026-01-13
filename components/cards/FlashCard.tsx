import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useAudio } from '../../hooks/useAudio';

interface FlashCardProps {
  word: string;
  translation: string;
  pronunciation?: string;
  audioUrl?: string;
  example?: string;
  exampleTranslation?: string;
  onFlip?: (isFlipped: boolean) => void;
}

export function FlashCard({
  word,
  translation,
  pronunciation,
  audioUrl,
  example,
  exampleTranslation,
  onFlip,
}: FlashCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { hapticsEnabled } = useSettingsStore();
  const { playWord, playUrl } = useAudio();

  const handlePlayAudio = async () => {
    if (audioUrl) {
      await playUrl(audioUrl);
    } else {
      await playWord(word);
    }
  };

  const handleFlip = () => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    const newFlipped = !isFlipped;
    setIsFlipped(newFlipped);
    onFlip?.(newFlipped);
  };

  return (
    <Pressable onPress={handleFlip} style={styles.container}>
      {!isFlipped ? (
        /* Front of card */
        <View style={[styles.card, styles.cardFront]}>
          <Text style={styles.wordText}>{word}</Text>
          {pronunciation && (
            <Text style={styles.pronunciationText}>{pronunciation}</Text>
          )}
          <Pressable onPress={handlePlayAudio} style={styles.audioButton}>
            <Text style={styles.audioIcon}>🔊</Text>
          </Pressable>
          <Text style={styles.tapHint}>Toca para ver traducción</Text>
        </View>
      ) : (
        /* Back of card */
        <View style={[styles.card, styles.cardBack]}>
          <Text style={styles.translationText}>{translation}</Text>
          {example && (
            <View style={styles.exampleContainer}>
              <Text style={styles.exampleText}>"{example}"</Text>
              {exampleTranslation && (
                <Text style={styles.exampleTranslation}>"{exampleTranslation}"</Text>
              )}
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 280,
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 16,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardFront: {
    backgroundColor: '#FFFFFF',
  },
  cardBack: {
    backgroundColor: '#F0F9FF',
  },
  wordText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  pronunciationText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 8,
  },
  audioButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioIcon: {
    fontSize: 24,
  },
  tapHint: {
    position: 'absolute',
    bottom: 20,
    fontSize: 14,
    color: '#999999',
  },
  translationText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  exampleContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    width: '100%',
  },
  exampleText: {
    fontSize: 16,
    color: '#444444',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  exampleTranslation: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
});
