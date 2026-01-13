import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserProfile {
  id: string;
  username?: string;
  displayName?: string;
  nativeLanguage: string;
  targetLanguage: string;
  dailyGoalMinutes: number;
  currentStreak: number;
  longestStreak: number;
  totalXp: number;
  cefrLevel: string;
  createdAt: string;
}

interface UserState {
  // Estado del usuario
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Estadísticas diarias
  todayXp: number;
  todayMinutes: number;
  todayCardsStudied: number;
  lastStudyDate: string | null;
  
  // Acciones
  setProfile: (profile: UserProfile) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  clearProfile: () => void;
  
  // XP y progreso
  addXp: (amount: number) => void;
  addStudyTime: (minutes: number) => void;
  addCardsStudied: (count: number) => void;
  checkAndUpdateStreak: () => void;
  
  // Getters
  getCurrentLevel: () => { level: number; title: string; progress: number };
}

const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0, title: 'Principiante' },
  { level: 2, xp: 500, title: 'Aprendiz' },
  { level: 3, xp: 1500, title: 'Estudiante' },
  { level: 4, xp: 3500, title: 'Intermedio' },
  { level: 5, xp: 7000, title: 'Avanzado' },
  { level: 6, xp: 12000, title: 'Experto' },
  { level: 7, xp: 20000, title: 'Maestro' },
];

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: null,
      isAuthenticated: false,
      isLoading: true,
      
      todayXp: 0,
      todayMinutes: 0,
      todayCardsStudied: 0,
      lastStudyDate: null,

      setProfile: (profile) => {
        set({ profile, isAuthenticated: true, isLoading: false });
      },

      updateProfile: (updates) => {
        const current = get().profile;
        if (current) {
          set({ profile: { ...current, ...updates } });
        }
      },

      clearProfile: () => {
        set({ 
          profile: null, 
          isAuthenticated: false, 
          isLoading: false,
          todayXp: 0,
          todayMinutes: 0,
          todayCardsStudied: 0,
        });
      },

      addXp: (amount) => {
        const today = getTodayDateString();
        const state = get();
        
        // Reset si es un nuevo día
        const isNewDay = state.lastStudyDate !== today;
        
        set({
          todayXp: isNewDay ? amount : state.todayXp + amount,
          lastStudyDate: today,
          profile: state.profile ? {
            ...state.profile,
            totalXp: state.profile.totalXp + amount,
          } : null,
        });
      },

      addStudyTime: (minutes) => {
        const today = getTodayDateString();
        const state = get();
        const isNewDay = state.lastStudyDate !== today;
        
        set({
          todayMinutes: isNewDay ? minutes : state.todayMinutes + minutes,
          lastStudyDate: today,
        });
      },

      addCardsStudied: (count) => {
        const today = getTodayDateString();
        const state = get();
        const isNewDay = state.lastStudyDate !== today;
        
        set({
          todayCardsStudied: isNewDay ? count : state.todayCardsStudied + count,
          lastStudyDate: today,
        });
      },

      checkAndUpdateStreak: () => {
        const state = get();
        if (!state.profile) return;
        
        const today = getTodayDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        let newStreak = state.profile.currentStreak;
        
        if (state.lastStudyDate === today) {
          // Ya estudió hoy, no cambiar streak
        } else if (state.lastStudyDate === yesterdayStr) {
          // Estudió ayer, incrementar streak
          newStreak = state.profile.currentStreak + 1;
        } else if (state.lastStudyDate !== today) {
          // No estudió ayer, resetear streak a 1 si estudia hoy
          newStreak = 1;
        }
        
        const longestStreak = Math.max(newStreak, state.profile.longestStreak);
        
        set({
          profile: {
            ...state.profile,
            currentStreak: newStreak,
            longestStreak,
          },
        });
      },

      getCurrentLevel: () => {
        const xp = get().profile?.totalXp ?? 0;
        
        let currentLevel = LEVEL_THRESHOLDS[0];
        let nextLevel = LEVEL_THRESHOLDS[1];
        
        for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
          if (xp >= LEVEL_THRESHOLDS[i].xp) {
            currentLevel = LEVEL_THRESHOLDS[i];
            nextLevel = LEVEL_THRESHOLDS[i + 1] || currentLevel;
            break;
          }
        }
        
        const xpInLevel = xp - currentLevel.xp;
        const xpForNextLevel = nextLevel.xp - currentLevel.xp;
        const progress = xpForNextLevel > 0 ? (xpInLevel / xpForNextLevel) * 100 : 100;
        
        return {
          level: currentLevel.level,
          title: currentLevel.title,
          progress: Math.min(100, Math.round(progress)),
        };
      },
    }),
    {
      name: 'vinslingo-user',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
