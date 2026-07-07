import React, { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Platform, LayoutChangeEvent } from 'react-native';
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

interface ParsedExample {
  en: string;
  es: string;
}
interface ParsedSense {
  n: string;
  desc: string;
  examples: ParsedExample[];
}
interface ParsedTranslation {
  header: string | null;
  body: string;
  senses: ParsedSense[] | null; // solo cuando hay varias acepciones numeradas
  note: string | null;
}

// Extrae la descripción y los pares "inglés" = español de una acepción.
function extractExamples(text: string): { desc: string; examples: ParsedExample[] } {
  const firstQuote = text.indexOf('"');
  let desc = firstQuote >= 0 ? text.slice(0, firstQuote) : text;
  desc = desc.replace(/[:\s]+$/, '').trim();
  const examples: ParsedExample[] = [];
  const re = /"([^"]+)"\s*=\s*([^"]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // El español es hasta la siguiente comilla; recortamos una posible nota
    // final ("... . Opuesto: ...") que empiece tras un signo de puntuación.
    const es = m[2]
      .replace(/([.?!])\s+[A-ZÁÉÍÓÚÑ¿¡].*$/, '$1')
      .replace(/[.,;:\s]+$/, '')
      .trim();
    examples.push({ en: m[1].trim(), es });
  }
  return { desc, examples };
}

// Las traducciones de phrasal verbs / idioms vienen como
//   "TÍTULOS — 1) desc: "eng" = esp. 2) desc: "eng" = esp. (nota)"
// (monosémicas: "TÍTULO — explicación" sin numerar). Separamos título,
// acepciones numeradas (con sus ejemplos) y una posible nota final.
function parseTranslation(translation: string): ParsedTranslation {
  const dashIdx = translation.indexOf(' — ');
  if (dashIdx === -1) {
    return { header: null, body: translation.trim(), senses: null, note: null };
  }
  const header = translation.slice(0, dashIdx).trim();
  const body = translation.slice(dashIdx + 3).trim();
  if (!/\d\)/.test(body)) {
    return { header, body, senses: null, note: null };
  }
  const rawSenses: { n: string; text: string }[] = [];
  const re = /(\d)\)\s*([\s\S]*?)(?=\s*\d\)\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    rawSenses.push({ n: m[1], text: m[2].trim() });
  }
  let note: string | null = null;
  if (rawSenses.length) {
    const last = rawSenses[rawSenses.length - 1];
    const nm = last.text.match(/\s*(\([^()]*\)[.)]?)\s*$/);
    if (nm) {
      note = nm[1];
      last.text = last.text.slice(0, nm.index).trim();
    }
  }
  const senses: ParsedSense[] = rawSenses.map((s) => ({ n: s.n, ...extractExamples(s.text) }));
  return { header, body, senses, note };
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

  // Estructura del reverso. Multi-acepción → lista tipo diccionario (título +
  // acepciones numeradas con su ejemplo). Monosémica → término destacado +
  // explicación. Vocabulario simple ("correr") sin "—" → tal cual.
  const parsed = parseTranslation(translation);
  const isMultiSense = !!parsed.senses && parsed.senses.length >= 2;
  const translationTerm = !isMultiSense && parsed.header ? parsed.header : null;
  const translationExplanation = translationTerm ? parsed.body : null;
  // Los campos example_sentence(_2) duplican ejemplos que en las entradas
  // multi-acepción ya van dentro de cada acepción: solo los mostramos abajo en
  // las monosémicas.
  const showBottomExamples = !isMultiSense && (!!example || !!example2);

  // Escalado del reverso: si el contenido (traducción + ejemplos + canción)
  // no cabe en el alto disponible, encogemos todo el bloque de forma
  // proporcional en vez de mostrar scroll dentro de la ficha. Medimos el alto
  // disponible y el alto natural del contenido (onLayout devuelve el tamaño de
  // layout SIN transform, así que la medida es estable y no oscila).
  const [contentScale, setContentScale] = useState(1);
  const availHeight = useRef(0);
  const contentHeight = useRef(0);
  const recomputeScale = () => {
    const avail = availHeight.current;
    const content = contentHeight.current;
    if (avail <= 0 || content <= 0) return;
    // Sin ampliar (máx 1) y con un suelo razonable para que nunca quede ilegible.
    const next = content <= avail ? 1 : Math.max(0.55, avail / content);
    setContentScale((prev) => (Math.abs(prev - next) > 0.005 ? next : prev));
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
    const url = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(url);
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
              style={[styles.backInner, { transform: [{ scale: contentScale }] }]}
              onLayout={onContentLayout}
            >
              {isMultiSense ? (
                /* Varias acepciones: lista tipo diccionario, cada una separada
                   y con su(s) ejemplo(s) debajo. */
                <View style={styles.sensesBlock}>
                  {parsed.header ? (
                    <Text style={styles.sensesHeader}>{parsed.header}</Text>
                  ) : null}
                  {parsed.senses!.map((s, i) => (
                    <View
                      key={s.n}
                      style={[styles.senseItem, i > 0 && styles.senseItemDivider]}
                    >
                      <View style={styles.senseRow}>
                        <View style={styles.senseNumber}>
                          <Text style={styles.senseNumberText}>{s.n}</Text>
                        </View>
                        <Text style={styles.senseDesc}>{s.desc}</Text>
                      </View>
                      {s.examples.map((ex, j) => (
                        <View key={j} style={styles.senseExample}>
                          <Text style={styles.senseExampleEn}>"{ex.en}"</Text>
                          {ex.es ? (
                            <Text style={styles.senseExampleEs}>{ex.es}</Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ))}
                  {parsed.note ? (
                    <Text style={styles.senseNote}>{parsed.note}</Text>
                  ) : null}
                </View>
              ) : translationTerm ? (
                <View style={styles.translationBlock}>
                  <Text style={styles.translationTerm}>{translationTerm}</Text>
                  <Text style={styles.translationExplanation}>{translationExplanation}</Text>
                </View>
              ) : (
                <Text style={[
                  styles.translationText,
                  translation.length > 50 && styles.translationTextSmall
                ]}>
                  {translation}
                </Text>
              )}

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
  translationText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  translationTextSmall: {
    fontSize: 18,
  },
  translationBlock: {
    width: '100%',
    alignItems: 'center',
  },
  translationTerm: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  translationExplanation: {
    fontSize: 15,
    fontWeight: '400',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
  // --- Multi-acepción (lista tipo diccionario) ---
  sensesBlock: {
    width: '100%',
    alignItems: 'stretch',
  },
  sensesHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  senseItem: {
    width: '100%',
    paddingVertical: 8,
  },
  senseItemDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  senseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  senseNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  senseNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  senseDesc: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 20,
  },
  senseExample: {
    marginLeft: 30,
    marginTop: 5,
  },
  senseExampleEn: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#334155',
    lineHeight: 18,
  },
  senseExampleEs: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 17,
    marginTop: 1,
  },
  senseNote: {
    marginTop: 10,
    fontSize: 12,
    fontStyle: 'italic',
    color: '#94A3B8',
    lineHeight: 16,
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
