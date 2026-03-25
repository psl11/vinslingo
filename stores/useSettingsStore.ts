import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

interface SettingsState {
  // Preferencias de estudio
  dailyGoalMinutes: number;
  cardsPerSession: number;
  
  // Filtro de niveles CEFR
  selectedCEFRLevels: CEFRLevel[];
  
  // Notificaciones
  notificationsEnabled: boolean;
  reminderTime: string; // "HH:MM" format
  
  // Audio y feedback
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  autoPlayAudio: boolean;
  
  // Apariencia
  themeMode: ThemeMode;
  
  // Acciones
  setDailyGoal: (minutes: number) => void;
  setCardsPerSession: (count: number) => void;
  toggleNotifications: () => void;
  setReminderTime: (time: string) => void;
  toggleSound: () => void;
  toggleHaptics: () => void;
  toggleAutoPlayAudio: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleCEFRLevel: (level: CEFRLevel) => void;
  setSelectedCEFRLevels: (levels: CEFRLevel[]) => void;
  resetToDefaults: () => void;
}

const DEFAULT_SETTINGS = {
  dailyGoalMinutes: 10,
  cardsPerSession: 20,
  notificationsEnabled: true,
  reminderTime: '09:00',
  soundEnabled: true,
  hapticsEnabled: true,
  autoPlayAudio: true,
  themeMode: 'system' as ThemeMode,
  selectedCEFRLevels: ['A1', 'A2', 'B1', 'B2', 'C1'] as CEFRLevel[],
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setDailyGoal: (minutes) => set({ dailyGoalMinutes: minutes }),
      
      setCardsPerSession: (count) => set({ cardsPerSession: count }),
      
      toggleNotifications: () => set((state) => ({ 
        notificationsEnabled: !state.notificationsEnabled 
      })),
      
      setReminderTime: (time) => set({ reminderTime: time }),
      
      toggleSound: () => set((state) => ({ 
        soundEnabled: !state.soundEnabled 
      })),
      
      toggleHaptics: () => set((state) => ({ 
        hapticsEnabled: !state.hapticsEnabled 
      })),
      
      toggleAutoPlayAudio: () => set((state) => ({ 
        autoPlayAudio: !state.autoPlayAudio 
      })),
      
      setThemeMode: (mode) => set({ themeMode: mode }),
      
      toggleCEFRLevel: (level) => set((state) => {
        const currentLevels = state.selectedCEFRLevels;
        if (currentLevels.includes(level)) {
          // No permitir deseleccionar todos los niveles
          if (currentLevels.length === 1) return state;
          return { selectedCEFRLevels: currentLevels.filter(l => l !== level) };
        } else {
          return { selectedCEFRLevels: [...currentLevels, level].sort() };
        }
      }),
      
      setSelectedCEFRLevels: (levels) => set({ 
        selectedCEFRLevels: levels.length > 0 ? levels : ['A1', 'A2', 'B1', 'B2', 'C1'] 
      }),
      
      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'vinslingo-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
