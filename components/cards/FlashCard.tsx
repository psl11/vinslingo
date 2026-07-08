import React, { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Platform, LayoutChangeEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useAudio } from '../../hooks/useAudio';
import { TranslationBody } from '../vocabulary/TranslationBody';
import { ParticleHint } from '../vocabulary/ParticleHint';
import { analyzeTranslation } from '../../lib/vocabulary/translationParser';

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
  category?: string;
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
  category,
  onFlip,
}: FlashCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { hapticsEnabled } = useSettingsStore();
  const { playWord, playUrl } = useAudio();

  // La maquetación del reverso la resuelve <TranslationBody>. Aquí solo
  // necesitamos saber si es multi-acepción: en ese caso los ejemplos ya van
  // dentro de cada acepción, así que ocultamos los example_sentence(_2) de
  // abajo (que los duplican).
  const isMultiSense = analyzeTranslation(translation).kind === 'senses';
  const showBottomExamples = !isMultiSense && (!!example || !!example2);

  // Escalado del reverso: si el contenido (traducción + ejemplos + canción)
  // no cabe en el alto disponible, encogemos todo el bloque de forma
  // proporcional en vez de mostrar scroll dentro de la ficha. Medimos el alto
  // disponible y el alto natural del contenido (onLayout devuelve el tamaño de
  // layout SIN transform, así que la medida es estable y no oscila).
  const [contentScale, setContentScale] = useState(1);
  // Mantenemos el contenido invisible (pero medible) hasta la 1ª medición para
  // evitar un frame a escala 1 antes de encoger (flicker en fichas densas).
  const [measured, setMeasured] = useState(false);
  const availHeight = useRef(0);
  const contentHeight = useRef(0);
  const recomputeScale = () => {
    const avail = availHeight.current;
    const content = contentHeight.current;
    if (avail <= 0 || content <= 0) return;
    // Sin ampliar (máx 1) y con un suelo razonable para que nunca quede ilegible.
    const next = content <= avail ? 1 : Math.max(0.55, avail / content);
    setContentScale((prev) => (Math.abs(prev - next) > 0.005 ? next : prev));
    setMeasured(true);
  };
  const onAvailLayout = (e: LayoutChangeEvent) => {
    availHeight.current = e.nativeEvent.layout.height;
    recomputeScale();
  };
  const onContentLayout = (e: LayoutChangeEvent) => {
    contentHeight.current = e.nativeEvent.layout.height;
    recomputeScale();
  };

  const handlePlayAudio = async () => {
    if (audioUrl) {
      await playUrl(audioUrl);
    } else {
      await playWord(word);
    }
  };

  const openSpotify = (e?: any) => {
    e?.stopPropagation?.(); // evita que el toque también voltee la tarjeta
    const cleanArtist = (songArtist || '').replace(/\s*\([^)]*\)/g, '').trim();
    const query = [songTitle, cleanArtist].filter(Boolean).join(' ');
    if (!query) return;
    const webUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;

    if (Platform.OS !== 'web') {
      Linking.openURL(webUrl);
      return;
    }

    // En la PWA, window.open(_blank) deja una pestaña del navegador en blanco:
    // el universal link abre la app de Spotify pero la pestaña que lo lanzó se
    // queda ahí. En su lugar, deep-linkeamos con el esquema `spotify:` (abre la
    // app sin pestaña). Si Spotify no está instalado, la página sigue visible y
    // caemos a la web en la misma pestaña (sin dejar ventana en blanco).
    const appUrl = `spotify:search:${encodeURIComponent(query)}`;
    let done = false;
    const fallback = setTimeout(() => {
      if (!done && typeof document !== 'undefined' && document.visibilityState === 'visible') {
        done = true;
        window.location.href = webUrl;
      }
    }, 1500);
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        done = true;
        clearTimeout(fallback);
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility, { once: true });
    }
    window.location.href = appUrl;
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
          <View style={styles.cardHeader}>
            <Text style={styles.languageLabel}>🇬🇧 INGLÉS</Text>
            <View style={styles.headerRight}>
              {cefrLevel && (
                <View style={styles.cefrBadge}>
                  <Text style={styles.cefrBadgeText}>{cefrLevel.toUpperCase()}</Text>
                </View>
              )}
              <Pressable onPress={handlePlayAudio} style={styles.audioButton}>
                <Text style={styles.audioIcon}>🔊</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.wordText}>{word}</Text>
          {pronunciation && (
            <Text style={styles.pronunciationText}>{pronunciation}</Text>
          )}
          <Text style={styles.tapHint}>¿Sabes qué significa? Toca para ver</Text>
        </View>
      ) : (
        /* Back of card - SPANISH translation */
        <View style={[styles.card, styles.cardBack]}>
          <View style={styles.cardHeader}>
            <Text style={styles.languageLabel}>🇪🇸 ESPAÑOL</Text>
            {cefrLevel && (
              <View style={styles.cefrBadge}>
                <Text style={styles.cefrBadgeText}>{cefrLevel.toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={styles.backContent} onLayout={onAvailLayout}>
            <View
              style={[styles.backInner, { transform: [{ scale: contentScale }], opacity: measured ? 1 : 0 }]}
              onLayout={onContentLayout}
            >
              <TranslationBody translation={translation} align="center" />

              <ParticleHint word={word} category={category} />

              {/* Ejemplos sueltos (solo monosémicas) + canción */}
              {(showBottomExamples || songLyric) && (
              <View style={styles.allExamplesContainer}>
                {/* Example 1 */}
                {showBottomExamples && example && (
                  <View style={styles.exampleItem}>
                    <Text style={styles.exampleText}>"{example}"</Text>
                    {exampleTranslation && (
                      <Text style={styles.exampleTranslation}>"{exampleTranslation}"</Text>
                    )}
                  </View>
                )}

                {/* Example 2 */}
                {showBottomExamples && example2 && (
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
                    {songTitle && (
                      <Pressable onPress={openSpotify} style={styles.spotifyButton}>
                        <Text style={styles.spotifyButtonText}>▶  Escuchar en Spotify</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
              )}
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
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
  cardHeader: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  languageLabel: {
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
  backContent: {
    flex: 1,
    width: '100%',
    marginTop: 36,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  backInner: {
    width: '100%',
    alignItems: 'center',
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
    // Padding vertical simétrico y generoso: mismo aire encima del 🎵 que debajo
    // del botón de Spotify.
    paddingVertical: 14,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginTop: 12,
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
  spotifyButton: {
    marginTop: 10,
    alignSelf: 'center',
    backgroundColor: '#1DB954',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  spotifyButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
