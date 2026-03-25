import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
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
  example2?: string;
  exampleTranslation2?: string;
  songLyric?: string;
  songLyricTranslation?: string;
  songTitle?: string;
  songArtist?: string;
  cefrLevel?: string;
  onFlip?: (isFlipped: boolean) => void;
}

export function FlashCard({
  word,
  translation,
  pronunciation,
  audioUrl,
  example,
  exampleTranslation,
  example2,
  exampleTranslation2,
  songLyric,
  songLyricTranslation,
  songTitle,
  songArtist,
  cefrLevel,
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
        /* Front of card - ENGLISH word */
        <View style={[styles.card, styles.cardFront]}>
          <Text style={styles.languageLabel}>🇬🇧 INGLÉS</Text>
          {cefrLevel && (
            <View style={styles.cefrBadge}>
              <Text style={styles.cefrBadgeText}>{cefrLevel.toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.wordText}>{word}</Text>
          {pronunciation && (
            <Text style={styles.pronunciationText}>{pronunciation}</Text>
          )}
          <Pressable onPress={handlePlayAudio} style={styles.audioButton}>
            <Text style={styles.audioIcon}>🔊</Text>
          </Pressable>
          <Text style={styles.tapHint}>¿Sabes qué significa? Toca para ver</Text>
        </View>
      ) : (
        /* Back of card - SPANISH translation */
        <View style={[styles.card, styles.cardBack]}>
          <Text style={styles.languageLabel}>🇪🇸 ESPAÑOL</Text>
          {cefrLevel && (
            <View style={styles.cefrBadge}>
              <Text style={styles.cefrBadgeText}>{cefrLevel.toUpperCase()}</Text>
            </View>
          )}
          <ScrollView 
            style={styles.scrollContent} 
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[
              styles.translationText,
              translation.length > 50 && styles.translationTextSmall
            ]}>
              {translation}
            </Text>
            
            {/* Examples Container */}
            <View style={styles.allExamplesContainer}>
              {/* Example 1 */}
              {example && (
                <View style={styles.exampleItem}>
                  <Text style={styles.exampleText}>"{example}"</Text>
                  {exampleTranslation && (
                    <Text style={styles.exampleTranslation}>"{exampleTranslation}"</Text>
                  )}
                </View>
              )}
              
              {/* Example 2 */}
              {example2 && (
                <View style={styles.exampleItem}>
                  <Text style={styles.exampleText}>"{example2}"</Text>
                  {exampleTranslation2 && (
                    <Text style={styles.exampleTranslation}>"{exampleTranslation2}"</Text>
                  )}
                </View>
              )}
              
              {/* Song Example */}
              {songLyric && (
                <View style={styles.songExampleItem}>
                  <Text style={styles.songIcon}>🎵</Text>
                  <Text style={styles.songLyricText}>"{songLyric}"</Text>
                  {songLyricTranslation && (
                    <Text style={styles.exampleTranslation}>"{songLyricTranslation}"</Text>
                  )}
                  {(songTitle || songArtist) && (
                    <Text style={styles.songCredit}>
                      — {songTitle}{songArtist ? ` (${songArtist})` : ''}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 0.75,
    alignSelf: 'center',
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 16,
    padding: 20,
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
  languageLabel: {
    position: 'absolute',
    top: 16,
    left: 16,
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  exampleLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
    textAlign: 'center',
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
  cefrBadge: {
    position: 'absolute',
    top: 16,
    right: 68,
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
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  translationTextSmall: {
    fontSize: 18,
  },
  scrollContent: {
    flex: 1,
    width: '100%',
    marginTop: 36,
  },
  scrollContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 16,
  },
  exampleContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    width: '100%',
  },
  exampleText: {
    fontSize: 14,
    color: '#444444',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  exampleTranslation: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
    textAlign: 'center',
  },
  allExamplesContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    width: '100%',
    gap: 8,
  },
  exampleItem: {
    width: '100%',
    paddingVertical: 4,
  },
  songExampleItem: {
    width: '100%',
    paddingVertical: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  songIcon: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  songLyricText: {
    fontSize: 13,
    color: '#92400E',
    fontStyle: 'italic',
    textAlign: 'center',
    fontWeight: '500',
  },
  songCredit: {
    fontSize: 12,
    color: '#B45309',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '600',
  },
});
