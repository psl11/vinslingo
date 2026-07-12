import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Platform, LayoutChangeEvent, Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useAudio } from '../../hooks/useAudio';
import { TranslationBody } from '../vocabulary/TranslationBody';
import { ParticleHint } from '../vocabulary/ParticleHint';
import { analyzeTranslation } from '../../lib/vocabulary/translationParser';
import { anchorIcon, anchorIsSong, anchorCredit } from '../../lib/vocabulary/anchor';
import { formalSynonymLabel, separabilityNote } from '../../lib/vocabulary/phaveGrammar';
import { colors, radius, spacing, fontSize, fontWeight } from '../../constants/theme';

interface FlashCardProps {
  word: string;
  translation: string;
  pronunciation?: string;
  pronunciationEs?: string; // respelling legible adaptado al español (kídni)
  audioUrl?: string;
  example?: string;
  exampleTranslation?: string;
  example2?: string;
  exampleTranslation2?: string;
  songLyric?: string;
  songLyricTranslation?: string;
  songTitle?: string;
  songArtist?: string;
  anchorType?: string; // 'song' | 'movie' | 'book' (null → canción)
  anchorYear?: number;
  formalSynonym?: string; // cognado latino formal (put off ≈ postpone)
  separability?: string; // 'separable' | 'inseparable' | 'intransitive'
  cefrLevel?: string;
  category?: string;
  // "Aprende con tu música": verso de una canción del usuario donde aparece la
  // palabra (con la forma exacta a resaltar), + título y artista.
  musicLine?: string | null;
  musicLineTranslation?: string | null;
  musicHighlight?: string | null;
  musicSong?: string | null;
  musicArtist?: string | null;
  onFlip?: (isFlipped: boolean) => void;
}

// Renderiza un verso resaltando en negrita la forma exacta que aparece (case-
// insensitive). Si no la encuentra, muestra el verso tal cual.
function HighlightedLine({ line, highlight }: { line: string; highlight?: string | null }) {
  if (!highlight) return <Text style={styles.musicLineText}>“{line}”</Text>;
  const idx = line.toLowerCase().indexOf(highlight.toLowerCase());
  if (idx < 0) return <Text style={styles.musicLineText}>“{line}”</Text>;
  return (
    <Text style={styles.musicLineText}>
      “{line.slice(0, idx)}
      <Text style={styles.musicLineBold}>{line.slice(idx, idx + highlight.length)}</Text>
      {line.slice(idx + highlight.length)}”
    </Text>
  );
}

export function FlashCard({
  word,
  translation,
  pronunciation,
  pronunciationEs,
  audioUrl,
  example,
  exampleTranslation,
  example2,
  exampleTranslation2,
  songLyric,
  songLyricTranslation,
  songTitle,
  songArtist,
  anchorType,
  anchorYear,
  formalSynonym,
  separability,
  cefrLevel,
  category,
  musicLine,
  musicLineTranslation,
  musicHighlight,
  musicSong,
  musicArtist,
  onFlip,
}: FlashCardProps) {
  const anchorIconChar = anchorIcon(anchorType);
  const formalLabel = formalSynonymLabel(formalSynonym);
  const sepNote = separabilityNote(separability, word);
  const isSongAnchor = anchorIsSong(anchorType);
  const [isFlipped, setIsFlipped] = useState(false);
  const { hapticsEnabled } = useSettingsStore();
  const { playWord, playUrl } = useAudio();

  // La maquetación del reverso la resuelve <TranslationBody>. Aquí solo
  // necesitamos saber si es multi-acepción: en ese caso los ejemplos ya van
  // dentro de cada acepción, así que ocultamos los example_sentence(_2) de
  // abajo (que los duplican).
  const isMultiSense = useMemo(
    () => analyzeTranslation(translation).kind === 'senses',
    [translation]
  );
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

  // Altavoz reutilizable para oír una frase/verso (TTS). stopPropagation para no
  // voltear la tarjeta al tocarlo (mismo patrón que el botón de Spotify).
  const Speak = ({ text }: { text: string }) => (
    <Pressable
      onPress={(e) => { (e as any)?.stopPropagation?.(); playWord(text); }}
      hitSlop={8}
      style={styles.speakerBtn}
    >
      <Text style={styles.speakerIcon}>🔊</Text>
    </Pressable>
  );

  const openSpotify = (e: any, title?: string | null, artist?: string | null) => {
    e?.stopPropagation?.(); // evita que el toque también voltee la tarjeta
    const cleanArtist = (artist || '').replace(/\s*\([^)]*\)/g, '').trim();
    const query = [title, cleanArtist].filter(Boolean).join(' ');
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

  // Fundido sutil al voltear: la cara actual se desvanece (con micro-zoom), se
  // intercambia el contenido y la nueva cara aparece. Animated + native driver.
  const flipAnim = useRef(new Animated.Value(1)).current;
  const flipScale = flipAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  const isAnimating = useRef(false);

  // NOTA: el volteo se deja SIEMPRE animado a propósito. react-native-web reporta
  // "reduce motion" de forma poco fiable (a veces true aunque el usuario no lo
  // tenga), y atar una interacción core a esa señal rompería el giro. El fundido
  // es sutil (280ms), no el tipo de movimiento que "reduce motion" debe eliminar.
  const handleFlip = () => {
    if (isAnimating.current) return; // evita solapar animaciones con toques rápidos
    isAnimating.current = true;
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Animated.timing(flipAnim, {
      toValue: 0,
      duration: 120,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      const newFlipped = !isFlipped;
      setIsFlipped(newFlipped);
      onFlip?.(newFlipped);
      Animated.timing(flipAnim, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        isAnimating.current = false;
      });
    });
  };

  // Atajo de teclado (solo web/desktop): Espacio o Enter voltea la tarjeta del
  // anverso al reverso. Ya volteada, las valoraciones las maneja la pantalla de
  // estudio (1-4 / Espacio), así que aquí solo actuamos si NO está girada.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isFlipped) return;
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        handleFlip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlipped]);

  return (
    <Pressable onPress={handleFlip} style={styles.container}>
      <Animated.View
        style={[styles.animatedFace, { opacity: flipAnim, transform: [{ scale: flipScale }] }]}
      >
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
          {pronunciationEs && (
            <Text style={styles.respellText}>{pronunciationEs}</Text>
          )}
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
          {/* La palabra estudiada, en grande arriba del reverso, para no perder
              de vista a qué se refiere el significado y los ejemplos. */}
          <Text style={styles.backWord} numberOfLines={2}>{word}</Text>
          {(pronunciation || pronunciationEs) && (
            <Text style={styles.backPron}>
              {[pronunciation, pronunciationEs].filter(Boolean).join('   ·   ')}
            </Text>
          )}
          <View style={styles.backContent} onLayout={onAvailLayout}>
            <View
              style={[styles.backInner, { transform: [{ scale: contentScale }], opacity: measured ? 1 : 0 }]}
              onLayout={onContentLayout}
            >
              <TranslationBody translation={translation} align="center" />

              <ParticleHint word={word} category={category} />

              {/* Mini-gramática del phrasal: sinónimo formal (cognado latino) y
                  separabilidad. SOLO en phrasals monosémicos: en un polisémico
                  (take off = despegar/quitarse/triunfar) tanto el sinónimo como
                  la separabilidad dependen de la acepción, así que un único
                  valor engañaría. */}
              {!isMultiSense && (formalLabel || sepNote) && (
                <View style={styles.phaveGrammar}>
                  {formalLabel && (
                    <Text style={styles.formalSynonym}>{formalLabel}</Text>
                  )}
                  {sepNote && (
                    <Text style={styles.separabilityNote}>📐 {sepNote}</Text>
                  )}
                </View>
              )}

              {/* Ejemplos sueltos (solo monosémicas) + ancla (canción/…) */}
              {(showBottomExamples || (songTitle && !musicLine)) && (
              <View style={styles.allExamplesContainer}>
                {/* Example 1 */}
                {showBottomExamples && example && (
                  <View style={styles.exampleItem}>
                    <View style={styles.exampleEnRow}>
                      <Text style={styles.exampleText}>"{example}"</Text>
                      <Speak text={example} />
                    </View>
                    {exampleTranslation && (
                      <Text style={styles.exampleTranslation}>"{exampleTranslation}"</Text>
                    )}
                  </View>
                )}

                {/* Example 2 */}
                {showBottomExamples && example2 && (
                  <View style={styles.exampleItem}>
                    <View style={styles.exampleEnRow}>
                      <Text style={styles.exampleText}>"{example2}"</Text>
                      <Speak text={example2} />
                    </View>
                    {exampleTranslation2 && (
                      <Text style={styles.exampleTranslation}>"{exampleTranslation2}"</Text>
                    )}
                  </View>
                )}

                {/* Ancla (canción con el phrasal en el título). Se oculta si hay
                    verso de TU música (musicLine): ese bloque es más personal y
                    evita mostrar dos tarjetas de canción a la vez. */}
                {songTitle && !musicLine && (
                  <View style={styles.songExampleItem}>
                    <View style={styles.musicIconRow}>
                      <Text style={styles.songIcon}>{anchorIconChar}</Text>
                      {songLyric && <Speak text={songLyric} />}
                    </View>
                    {songLyric && (
                      <Text style={styles.songLyricText}>"{songLyric}"</Text>
                    )}
                    {songLyric && songLyricTranslation && (
                      <Text style={styles.exampleTranslation}>"{songLyricTranslation}"</Text>
                    )}
                    <Text style={styles.songCredit}>
                      — {anchorCredit(songTitle, songArtist, anchorYear)}
                    </Text>
                    {isSongAnchor && (
                      <Pressable onPress={(e) => openSpotify(e, songTitle, songArtist)} style={styles.spotifyButton}>
                        <Text style={styles.spotifyButtonText}>▶  Escuchar en Spotify</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
              )}

              {/* Verso de tu música donde aparece la palabra (con la forma exacta
                  en negrita) + canción y artista. Gancho de memoria: al escuchar
                  la canción te acuerdas de la expresión. */}
              {musicLine && (
                <View style={styles.musicContext}>
                  <View style={styles.musicIconRow}>
                    <Text style={styles.musicIcon}>🎵</Text>
                    <Speak text={musicLine} />
                  </View>
                  <HighlightedLine line={musicLine} highlight={musicHighlight} />
                  {musicLineTranslation && (
                    <Text style={styles.exampleTranslation}>"{musicLineTranslation}"</Text>
                  )}
                  {(musicSong || musicArtist) && (
                    <Text style={styles.musicCredit}>
                      — {[musicSong, musicArtist].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                  {(musicSong || musicArtist) && (
                    <Pressable onPress={(e) => openSpotify(e, musicSong, musicArtist)} style={styles.spotifyButton}>
                      <Text style={styles.spotifyButtonText}>▶  Escuchar en Spotify</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
    alignSelf: 'center',
  },
  animatedFace: {
    flex: 1,
    width: '100%',
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: radius.lg,
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardFront: {
    backgroundColor: colors.card,
  },
  cardBack: {
    backgroundColor: '#F0F9FF',
  },
  cardHeader: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  languageLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  exampleLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  wordText: {
    fontSize: fontSize.displayLg,
    fontWeight: fontWeight.bold,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  pronunciationText: {
    fontSize: fontSize.md,
    color: '#666666',
    marginTop: spacing.sm,
  },
  respellText: {
    fontSize: fontSize.base,
    color: colors.accentPurple,
    fontStyle: 'italic',
    marginTop: spacing.xxs,
  },
  backPron: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
  cefrBadge: {
    backgroundColor: colors.primarySurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  cefrBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  audioButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioIcon: {
    fontSize: fontSize.xxl,
  },
  backWord: {
    marginTop: 40,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  backContent: {
    flex: 1,
    width: '100%',
    marginTop: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  backInner: {
    width: '100%',
    alignItems: 'center',
  },
  exampleContainer: {
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    width: '100%',
  },
  exampleText: {
    fontSize: fontSize.base,
    color: '#444444',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  exampleTranslation: {
    fontSize: fontSize.xs,
    color: '#666666',
    marginTop: spacing.xxs,
    textAlign: 'center',
  },
  phaveGrammar: {
    width: '100%',
    marginTop: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  formalSynonym: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.accentPurple,
    textAlign: 'center',
  },
  separabilityNote: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  allExamplesContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    width: '100%',
    gap: spacing.sm,
  },
  exampleItem: {
    width: '100%',
    paddingVertical: spacing.xs,
  },
  exampleEnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  musicIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  speakerBtn: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  speakerIcon: {
    fontSize: fontSize.md,
  },
  songExampleItem: {
    width: '100%',
    // Padding vertical simétrico y generoso: mismo aire encima del 🎵 que debajo
    // del botón de Spotify.
    paddingVertical: spacing.lg,
    backgroundColor: colors.warningSurface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  songIcon: {
    fontSize: fontSize.md,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  songLyricText: {
    fontSize: fontSize.sm,
    color: colors.warningText,
    fontStyle: 'italic',
    textAlign: 'center',
    fontWeight: fontWeight.medium,
  },
  songCredit: {
    fontSize: fontSize.xs,
    color: colors.warningTextSoft,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontWeight: fontWeight.semibold,
  },
  musicContext: {
    width: '100%',
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.accentPurpleSurface,
    borderRadius: radius.sm,
  },
  musicIcon: {
    fontSize: fontSize.md,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  musicLineText: {
    fontSize: fontSize.sm,
    color: colors.accentPurple,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 19,
  },
  musicLineBold: {
    fontWeight: fontWeight.bold,
    fontStyle: 'normal',
  },
  musicCredit: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontWeight: fontWeight.semibold,
  },
  spotifyButton: {
    marginTop: spacing.md,
    alignSelf: 'center',
    backgroundColor: '#1DB954',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
  },
  spotifyButtonText: {
    color: colors.onPrimary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
});
