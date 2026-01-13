import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncState {
  // Estado de sincronización
  status: SyncStatus;
  lastSyncAt: number | null;
  pendingChanges: number;
  isOnline: boolean;
  lastError: string | null;
  
  // Acciones
  setOnlineStatus: (isOnline: boolean) => void;
  startSync: () => void;
  syncSuccess: () => void;
  syncError: (error: string) => void;
  setPendingChanges: (count: number) => void;
  incrementPendingChanges: () => void;
  decrementPendingChanges: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      lastSyncAt: null,
      pendingChanges: 0,
      isOnline: true,
      lastError: null,

      setOnlineStatus: (isOnline) => {
        set({ 
          isOnline,
          status: isOnline ? 'idle' : 'offline',
        });
      },

      startSync: () => {
        if (!get().isOnline) {
          set({ status: 'offline' });
          return;
        }
        set({ status: 'syncing', lastError: null });
      },

      syncSuccess: () => {
        set({ 
          status: 'idle',
          lastSyncAt: Date.now(),
          pendingChanges: 0,
          lastError: null,
        });
      },

      syncError: (error) => {
        set({ 
          status: 'error',
          lastError: error,
        });
      },

      setPendingChanges: (count) => {
        set({ pendingChanges: count });
      },

      incrementPendingChanges: () => {
        set((state) => ({ pendingChanges: state.pendingChanges + 1 }));
      },

      decrementPendingChanges: () => {
        set((state) => ({ 
          pendingChanges: Math.max(0, state.pendingChanges - 1) 
        }));
      },
    }),
    {
      name: 'vinslingo-sync',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        lastSyncAt: state.lastSyncAt,
        pendingChanges: state.pendingChanges,
      }),
    }
  )
);
