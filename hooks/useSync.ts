import { useState, useCallback, useEffect } from 'react';
import { useSyncStore } from '../stores/useSyncStore';
import { 
  syncUserProgress, 
  getLastSyncTime, 
  formatLastSync,
  SyncResult 
} from '../lib/services/syncService';

export function useSync() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string>('Nunca');
  const [result, setResult] = useState<SyncResult | null>(null);
  
  const { 
    isOnline, 
    pendingChanges,
    startSync, 
    syncSuccess, 
    syncError,
    setPendingChanges,
  } = useSyncStore();

  // Load last sync time on mount
  useEffect(() => {
    getLastSyncTime().then((time) => {
      setLastSync(formatLastSync(time));
    });
  }, []);

  const sync = useCallback(async () => {
    if (!isOnline) {
      return { uploaded: 0, downloaded: 0, errors: ['Sin conexión'] };
    }

    setIsLoading(true);
    startSync();

    try {
      const syncResult = await syncUserProgress();
      setResult(syncResult);
      
      if (syncResult.errors.length === 0) {
        syncSuccess();
        setPendingChanges(0);
      } else {
        syncError(syncResult.errors.join(', '));
      }
      
      // Update last sync display
      const time = await getLastSyncTime();
      setLastSync(formatLastSync(time));
      
      return syncResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de sincronización';
      syncError(message);
      return { uploaded: 0, downloaded: 0, errors: [message] };
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, startSync, syncSuccess, syncError, setPendingChanges]);

  return {
    sync,
    isLoading,
    isOnline,
    lastSync,
    pendingChanges,
    result,
  };
}
