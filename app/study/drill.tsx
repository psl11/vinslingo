import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { confirmAction } from '../../lib/utils/confirm';
import { PressableScale } from '../../components/ui/PressableScale';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { TypingCard } from '../../components/cards/TypingCard';
import type { MatchResult } from '../../lib/utils/fuzzyMatch';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useUserStore } from '../../stores/useUserStore';
import type { DrillExercise } from '../../lib/drill/exerciseGenerator';
import { SimpleQuality } from '../../lib/srs/fsrs';
import { colors, radius, spacing, fontSize, fontWeight } from '../../constants/theme';

// Modo "Entrenamiento" (drill de palabras falladas, estilo Duolingo).
// Cola de ejercicios por etapas (reconocer → comprender → producir); los fallos
// se re-encolan al final y cada palabra se gradúa al superar sus 3 formatos.
// El resultado alimenta FSRS de verdad (0 fallos=good, 1=hard, 2+=again).
// Ver docs/drill-mode.md.

type Feedback = { chosenIdx: number; correct: boolean } | null;

const EX_TITLES: Record<string, string> = {
  mc_en_es: '¿Qué significa?',
  mc_es_en: '¿Cuál es la palabra?',
  fill_blank: 'Completa la frase',
  typing: 'Escríbela en inglés',
};

export default function DrillScreen() {
  const { limit, scope } = useLocalSearchParams<{ limit?: string; scope?: string }>();
  const router = useRouter();
  const { selectedCEFRLevels } = useSettingsStore();
  const { addXp, addStudyTime, addCardsStudied, checkAndUpdateStreak } = useUserStore();

  const [isLoading, setIsLoading] = useState(true);
  const [noCards, setNoCards] = useState(false);
  const [queue, setQueue] = useState<DrillExercise[]>([]);
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [passedKeys, setPassedKeys] = useState<Set<string>>(new Set());
  const [showSummary, setShowSummary] = useState(false);
  const [typingKey, setTypingKey] = useState(0);

  // Espejo de la cola en ref: el flujo de escritura encadena fallo→avance en el
  // mismo tick, y leer `queue` del closure vería la cola SIN el re-encolado
  // (cerraría la sesión con ejercicios pendientes).
  const queueRef = useRef<DrillExercise[]>([]);
  const setQueueBoth = (q: DrillExercise[]) => { queueRef.current = q; setQueue(q); };

  // Contabilidad por palabra (refs: no re-renderizan y sobreviven al flujo async)
  const failsByWord = useRef<Map<string, number>>(new Map());
  const timeByWord = useRef<Map<string, number>>(new Map());
  const graduated = useRef<Set<string>>(new Set());
  const totalDistinct = useRef(0);
  const wordList = useRef<DrillExercise['word'][]>([]);
  const exerciseStart = useRef(Date.now());
  const sessionStart = useRef(Date.now());

  useEffect(() => {
    (async () => {
      try {
        const { getMostFailedVocabulary, getDistractorPool } = await import('../../lib/services/vocabularyService');
        const { generateDrill } = await import('../../lib/drill/exerciseGenerator');
        const words = await getMostFailedVocabulary({
          limit: limit ? parseInt(limit, 10) : 10,
          cefrLevels: selectedCEFRLevels,
          onlyNotMastered: scope === 'notmastered',
        });
        if (words.length === 0) { setNoCards(true); return; }
        const pool = await getDistractorPool();
        const q = generateDrill(words, pool);
        wordList.current = words;
        totalDistinct.current = q.length;
        setQueueBoth(q);
        exerciseStart.current = Date.now();
      } catch (e) {
        console.error('Error building drill:', e);
        setNoCards(true);
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = queue[idx];

  // Graduación: si todos los ejercicios de la palabra están superados, se guarda
  // el resultado en FSRS (misma maquinaria que el estudio normal).
  const maybeGraduate = async (wordId: string, newPassed: Set<string>) => {
    if (graduated.current.has(wordId)) return;
    const wordExercises = queueRef.current.filter((e) => e.word.id === wordId);
    const allPassed = wordExercises.every((e) => newPassed.has(e.key));
    if (!allPassed) return;
    graduated.current.add(wordId);
    const fails = failsByWord.current.get(wordId) ?? 0;
    const quality: SimpleQuality = fails === 0 ? 'good' : fails === 1 ? 'hard' : 'again';
    const responseTimeMs = Math.min(timeByWord.current.get(wordId) ?? 0, 5 * 60 * 1000);
    try {
      const card = wordExercises[0].word;
      const { updateUserVocabularyAfterReview } = await import('../../lib/database/queries');
      const { syncVocabularyProgress, syncPendingReviewLogs } = await import('../../lib/services/progressService');
      const { schedule, cardFromRow, cardToState, logToRow } = await import('../../lib/srs/fsrs');
      const now = new Date();
      const { card: nextCard, log } = schedule(cardFromRow(card as any, now), quality, now);
      await updateUserVocabularyAfterReview(card.id, {
        state: cardToState(nextCard),
        isCorrect: quality !== 'again',
        log: logToRow(log, responseTimeMs),
      });
      await syncVocabularyProgress(card.id, { state: cardToState(nextCard), isCorrect: quality !== 'again' });
      await syncPendingReviewLogs();
    } catch (e) {
      console.error('Error saving drill progress:', e);
    }
  };

  const registerTime = (wordId: string) => {
    const elapsed = Date.now() - exerciseStart.current;
    timeByWord.current.set(wordId, (timeByWord.current.get(wordId) ?? 0) + elapsed);
  };

  const advance = () => {
    setFeedback(null);
    setTypingKey((k) => k + 1);
    exerciseStart.current = Date.now();
    if (idx + 1 >= queueRef.current.length) setShowSummary(true);
    else setIdx(idx + 1);
  };

  const handlePass = async (ex: DrillExercise) => {
    registerTime(ex.word.id);
    const newPassed = new Set(passedKeys).add(ex.key);
    setPassedKeys(newPassed);
    await maybeGraduate(ex.word.id, newPassed);
  };

  const handleFail = (ex: DrillExercise) => {
    registerTime(ex.word.id);
    failsByWord.current.set(ex.word.id, (failsByWord.current.get(ex.word.id) ?? 0) + 1);
    // Re-encolar una copia al final (marca Duolingo: no acabas sin superarlo).
    setQueueBoth([...queueRef.current, { ...ex }]);
  };

  const chooseOption = async (i: number) => {
    if (!current?.options || feedback) return;
    const correct = current.options[i].correct;
    setFeedback({ chosenIdx: i, correct });
    if (correct) await handlePass(current);
    else handleFail(current);
  };

  const handleTypingResult = async (result: MatchResult, _input: string, _hints: number) => {
    if (!current) return;
    if (result === 'wrong') handleFail(current);
    else await handlePass(current);
    advance();
  };

  // Atajos web: 1-4 elige opción; Espacio/Enter continúa tras el feedback.
  const stateRef = useRef({ feedback, current, idx });
  stateRef.current = { feedback, current, idx };
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const { feedback: fb, current: cur } = stateRef.current;
      if (!cur || cur.type === 'typing') return;
      if (fb && (e.code === 'Space' || e.key === 'Enter')) {
        e.preventDefault();
        advance();
        return;
      }
      if (!fb && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        chooseOption(parseInt(e.key, 10) - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, idx, feedback]);

  const handleClose = () => {
    confirmAction({
      title: 'Abandonar entrenamiento',
      message: 'Las palabras ya graduadas quedan guardadas. ¿Salir?',
      confirmText: 'Salir',
      cancelText: 'Continuar',
      destructive: true,
      onConfirm: () => router.back(),
    });
  };

  const handleFinish = async () => {
    const durationSec = Math.round((Date.now() - sessionStart.current) / 1000);
    const words = wordList.current;
    const clean = words.filter((w) => (failsByWord.current.get(w.id) ?? 0) === 0).length;
    const xp = graduated.current.size * 10;
    checkAndUpdateStreak();
    addXp(xp);
    addStudyTime(Math.max(1, Math.round(durationSec / 60)));
    addCardsStudied(words.length);
    try {
      const { saveStudySession } = await import('../../lib/services/progressService');
      await saveStudySession('review', words.length, clean, durationSec, xp);
    } catch (e) {
      console.error('Error saving drill session:', e);
    }
    router.back();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><Text style={styles.loadingText}>Preparando entrenamiento...</Text></View>
      </SafeAreaView>
    );
  }

  if (noCards) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🎉</Text>
          <Text style={styles.emptyTitle}>Nada que entrenar</Text>
          <Text style={styles.emptyText}>No tienes palabras falladas en los niveles seleccionados.</Text>
          <PressableScale style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Volver</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    );
  }

  if (showSummary) {
    const words = wordList.current;
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.summaryScroll}>
          <Text style={styles.summaryEmoji}>🏋️</Text>
          <Text style={styles.summaryTitle}>¡Entrenamiento completado!</Text>
          <Text style={styles.summarySubtitle}>
            {words.length} {words.length === 1 ? 'palabra graduada' : 'palabras graduadas'} · +{graduated.current.size * 10} XP
          </Text>
          <View style={styles.summaryList}>
            {words.map((w) => {
              const fails = failsByWord.current.get(w.id) ?? 0;
              return (
                <View key={w.id} style={styles.summaryRow}>
                  <Text style={styles.summaryWord}>{w.word}</Text>
                  <Text style={[styles.summaryBadge, fails === 0 ? styles.summaryClean : styles.summaryFails]}>
                    {fails === 0 ? '✓ a la primera' : `${fails} ${fails === 1 ? 'fallo' : 'fallos'}`}
                  </Text>
                </View>
              );
            })}
          </View>
          <PressableScale style={styles.primaryBtn} onPress={handleFinish}>
            <Text style={styles.primaryBtnText}>Terminar</Text>
          </PressableScale>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!current) return null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header: cerrar + progreso (solo avanza con aciertos) */}
      <View style={styles.header}>
        <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
        <View style={styles.progressWrap}>
          <ProgressBar current={passedKeys.size} total={totalDistinct.current} />
        </View>
      </View>

      {current.type === 'typing' ? (
        <View style={styles.cardArea}>
          <TypingCard
            key={`${current.key}:${typingKey}`}
            word={current.word.word}
            translation={current.word.translation}
            pronunciation={current.word.pronunciation}
            pronunciationEs={current.word.pronunciation_es}
            category={current.word.category}
            partOfSpeech={current.word.part_of_speech}
            cefrLevel={current.word.cefr_level}
            onResult={handleTypingResult}
          />
        </View>
      ) : (
        <View style={styles.exerciseArea}>
          <Text style={styles.exerciseTitle}>{EX_TITLES[current.type]}</Text>
          <Text style={current.type === 'fill_blank' ? styles.promptSentence : styles.promptWord}>
            {current.prompt}
          </Text>
          {current.type === 'fill_blank' && current.promptTranslation ? (
            <Text style={styles.promptTranslation}>"{current.promptTranslation}"</Text>
          ) : null}

          <View style={styles.options}>
            {current.options!.map((opt, i) => {
              const isChosen = feedback?.chosenIdx === i;
              const showCorrect = feedback && opt.correct;
              const showWrong = feedback && isChosen && !opt.correct;
              return (
                <PressableScale
                  key={`${current.key}:${i}`}
                  style={[
                    styles.option,
                    showCorrect && styles.optionCorrect,
                    showWrong && styles.optionWrong,
                  ]}
                  onPress={() => chooseOption(i)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      showCorrect && styles.optionTextCorrect,
                      showWrong && styles.optionTextWrong,
                    ]}
                    numberOfLines={3}
                  >
                    {opt.text}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          {feedback && (
            <View style={styles.feedbackBar}>
              <Text style={[styles.feedbackText, feedback.correct ? styles.feedbackOk : styles.feedbackKo]}>
                {feedback.correct ? '✓ ¡Correcto!' : '✗ Se repetirá al final'}
              </Text>
              <PressableScale style={styles.primaryBtn} onPress={advance}>
                <Text style={styles.primaryBtnText}>Continuar</Text>
              </PressableScale>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screen },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.huge },
  loadingText: { fontSize: fontSize.md, color: colors.textSecondary },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
    paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.card,
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { fontSize: fontSize.lg, color: colors.textSecondary },
  progressWrap: { flex: 1 },
  cardArea: { flex: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  exerciseArea: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  exerciseTitle: {
    fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: spacing.xl,
  },
  promptWord: {
    fontSize: fontSize.displayLg, fontWeight: fontWeight.bold, color: colors.textPrimary,
    textAlign: 'center', marginBottom: spacing.xxxl,
  },
  promptSentence: {
    fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: colors.textPrimary,
    textAlign: 'center', lineHeight: 30, marginBottom: spacing.md,
  },
  promptTranslation: {
    fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center',
    fontStyle: 'italic', marginBottom: spacing.xl,
  },
  options: { gap: spacing.md, marginTop: spacing.md },
  option: {
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg,
  },
  optionCorrect: { backgroundColor: colors.successSurface, borderColor: colors.success },
  optionWrong: { backgroundColor: colors.dangerSurfaceSoft, borderColor: colors.danger },
  optionText: { fontSize: fontSize.md, color: colors.textPrimary, textAlign: 'center', fontWeight: fontWeight.medium },
  optionTextCorrect: { color: colors.successText, fontWeight: fontWeight.bold },
  optionTextWrong: { color: colors.danger, fontWeight: fontWeight.bold },
  feedbackBar: { marginTop: spacing.xxl, gap: spacing.lg, alignItems: 'center' },
  feedbackText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  feedbackOk: { color: colors.success },
  feedbackKo: { color: colors.danger },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.lg, paddingHorizontal: spacing.huge, alignSelf: 'center',
  },
  primaryBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.onPrimary },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xxl },
  summaryScroll: { padding: spacing.xl, paddingTop: spacing.huge, alignItems: 'center' },
  summaryEmoji: { fontSize: 56, marginBottom: spacing.md },
  summaryTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  summarySubtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.xxl },
  summaryList: { width: '100%', gap: spacing.sm, marginBottom: spacing.xxxl },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
  },
  summaryWord: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  summaryBadge: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  summaryClean: { color: colors.success },
  summaryFails: { color: colors.warningText },
});
