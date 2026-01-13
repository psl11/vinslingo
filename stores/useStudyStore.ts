import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SM2Result, SimpleQuality, QUALITY_MAP, calculateSM2 } from '../lib/srs/sm2';

export interface VocabularyItem {
  id: string;
  word: string;
  translation: string;
  pronunciation?: string;
  audio_url?: string;
  part_of_speech?: string;
  cefr_level: string;
  category?: string;
  frequency_rank?: number;
  example_sentence?: string;
  example_translation?: string;
}

export interface StudyCard extends VocabularyItem {
  easeFactor?: number;
  interval?: number;
  repetitions?: number;
}

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
    sm2Result: SM2Result;
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
  answerCard: (quality: SimpleQuality, responseTimeMs: number) => SM2Result | null;
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

      answerCard: (quality, responseTimeMs) => {
        const session = get().currentSession;
        if (!session) return null;

        const card = session.cards[session.currentIndex];
        if (!card) return null;

        const sm2Result = calculateSM2(
          {
            easeFactor: card.easeFactor,
            interval: card.interval,
            repetitions: card.repetitions,
          },
          QUALITY_MAP[quality]
        );

        const result = {
          cardId: card.id,
          quality,
          sm2Result,
          responseTimeMs,
        };

        set({
          currentSession: {
            ...session,
            results: [...session.results, result],
          },
        });

        return sm2Result;
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
        const correct = session.results.filter(
          (r) => r.quality !== 'again'
        ).length;

        return {
          total: session.cards.length,
          completed,
          correct,
          incorrect: completed - correct,
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
