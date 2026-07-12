import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SimpleQuality,
  schedule,
  cardFromRow,
  cardToState,
  type Card,
  type StudyFsrsFields,
} from '../lib/srs/fsrs';

export interface VocabularyItem {
  id: string;
  word: string;
  translation: string;
  pronunciation?: string;
  pronunciation_es?: string;
  audio_url?: string;
  part_of_speech?: string;
  cefr_level: string;
  category?: string;
  frequency_rank?: number;
  example_sentence?: string;
  example_translation?: string;
  example_sentence_2?: string;
  example_translation_2?: string;
  song_lyric?: string;
  song_lyric_translation?: string;
  song_title?: string;
  song_artist?: string;
  anchor_type?: string;
  anchor_year?: number;
  formal_synonym?: string;
  separability?: string;
}

// StudyCard lleva el estado FSRS de la fila de progreso (StudyFsrsFields).
// Las tarjetas de lección nueva no traen estos campos → se tratan como nuevas.
export interface StudyCard extends VocabularyItem, StudyFsrsFields {}

interface StudySession {
  id: string;
  type: 'lesson' | 'review' | 'practice';
  lessonId?: string;
  startedAt: number;
  cards: StudyCard[];
  currentIndex: number;
  results: {
    cardId: string;
    quality: SimpleQuality;
    responseTimeMs: number;
  }[];
}

interface StudyState {
  // Estado de sesión actual
  currentSession: StudySession | null;
  isSessionActive: boolean;
  
  // Acciones de sesión
  startSession: (type: 'lesson' | 'review' | 'practice', cards: StudyCard[], lessonId?: string) => void;
  endSession: () => StudySession | null;
  
  // Acciones de tarjeta
  getCurrentCard: () => StudyCard | null;
  isCurrentCardRetry: () => boolean;
  answerCard: (quality: SimpleQuality, responseTimeMs: number) => Card | null;
  nextCard: () => boolean; // returns true if there are more cards
  
  // Estadísticas de sesión
  getSessionStats: () => {
    total: number;
    completed: number;
    correct: number;
    incorrect: number;
  };
}

export const useStudyStore = create<StudyState>()(
  persist(
    (set, get) => ({
      currentSession: null,
      isSessionActive: false,

      startSession: (type, cards, lessonId) => {
        const session: StudySession = {
          id: `session_${Date.now()}`,
          type,
          lessonId,
          startedAt: Date.now(),
          cards,
          currentIndex: 0,
          results: [],
        };
        set({ currentSession: session, isSessionActive: true });
      },

      endSession: () => {
        const session = get().currentSession;
        set({ currentSession: null, isSessionActive: false });
        return session;
      },

      getCurrentCard: () => {
        const session = get().currentSession;
        if (!session || session.currentIndex >= session.cards.length) {
          return null;
        }
        return session.cards[session.currentIndex];
      },

      isCurrentCardRetry: () => {
        const session = get().currentSession;
        if (!session) return false;
        const card = session.cards[session.currentIndex];
        if (!card) return false;
        return session.results.some(r => r.cardId === card.id);
      },

      answerCard: (quality, responseTimeMs) => {
        const session = get().currentSession;
        if (!session) return null;

        const card = session.cards[session.currentIndex];
        if (!card) return null;

        // Programa con FSRS a partir del estado de la tarjeta (o nueva si nunca
        // fue programada). La persistencia real la hace la pantalla; aquí solo
        // se actualiza el estado de sesión y se re-encolan los fallos.
        const { card: nextState } = schedule(cardFromRow(card), quality);

        const result = {
          cardId: card.id,
          quality,
          responseTimeMs,
        };

        // Re-queue failed cards at the end con el estado FSRS actualizado
        const updatedCards = [...session.cards];
        if (quality === 'again') {
          updatedCards.push({
            ...card,
            ...cardToState(nextState),
          });
        }

        set({
          currentSession: {
            ...session,
            cards: updatedCards,
            results: [...session.results, result],
          },
        });

        return nextState;
      },

      nextCard: () => {
        const session = get().currentSession;
        if (!session) return false;

        const nextIndex = session.currentIndex + 1;
        const hasMore = nextIndex < session.cards.length;

        set({
          currentSession: {
            ...session,
            currentIndex: nextIndex,
          },
        });

        return hasMore;
      },

      getSessionStats: () => {
        const session = get().currentSession;
        if (!session) {
          return { total: 0, completed: 0, correct: 0, incorrect: 0 };
        }

        const completed = session.results.length;
        
        // Count by unique card: use the LAST result per cardId
        const lastResultByCard = new Map<string, SimpleQuality>();
        for (const r of session.results) {
          lastResultByCard.set(r.cardId, r.quality);
        }
        const uniqueCorrect = [...lastResultByCard.values()].filter(q => q !== 'again').length;
        const uniqueIncorrect = [...lastResultByCard.values()].filter(q => q === 'again').length;

        return {
          total: session.cards.length,
          completed,
          correct: uniqueCorrect,
          incorrect: uniqueIncorrect,
        };
      },
    }),
    {
      name: 'vinslingo-study',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Solo persistir la sesión si está activa (para recuperar si la app se cierra)
        currentSession: state.isSessionActive ? state.currentSession : null,
        isSessionActive: state.isSessionActive,
      }),
    }
  )
);
