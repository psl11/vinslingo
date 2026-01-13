import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsState {
  // Preferencias de estudio
  dailyGoalMinutes: number;
  cardsPerSession: number;
  
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
      
      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'vinslingo-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
