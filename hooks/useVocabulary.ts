import { useState, useEffect, useCallback } from 'react';
import { VocabularyItem } from '../lib/database/queries';
import {
  syncVocabularyFromSupabase,
  getLocalVocabularyCount,
  getVocabularyForLesson,
  getDueVocabulary,
  getVocabularyStats,
} from '../lib/services/vocabularyService';
import { useSyncStore } from '../stores/useSyncStore';

export function useVocabularySync() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedCount, setSyncedCount] = useState(0);
  const { isOnline, startSync, syncSuccess, syncError } = useSyncStore();

  const sync = useCallback(async () => {
    if (!isOnline) {
      setError('Sin conexión a internet');
      return 0;
    }

    setIsLoading(true);
    setError(null);
    startSync();

    try {
      const count = await syncVocabularyFromSupabase();
      setSyncedCount(count);
      syncSuccess();
      return count;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de sincronización';
      setError(message);
      syncError(message);
      return 0;
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, startSync, syncSuccess, syncError]);

  return { sync, isLoading, error, syncedCount };
}

export function useLocalVocabularyCount() {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getLocalVocabularyCount()
      .then(setCount)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const newCount = await getLocalVocabularyCount();
      setCount(newCount);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { count, isLoading, refresh };
}

export function useLessonVocabulary(category: string, limit: number = 20) {
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    getVocabularyForLesson(category, limit)
      .then(setVocabulary)
      .catch((err) => {
        console.error('Error loading lesson vocabulary:', err);
        setError('Error al cargar vocabulario');
      })
      .finally(() => setIsLoading(false));
  }, [category, limit]);

  return { vocabulary, isLoading, error };
}

export function useReviewVocabulary(limit: number = 20) {
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const items = await getDueVocabulary(limit);
      setVocabulary(items);
    } catch (err) {
      console.error('Error loading review vocabulary:', err);
      setError('Error al cargar vocabulario para repaso');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { vocabulary, isLoading, error, refresh: load };
}

export function useVocabularyStats() {
  const [stats, setStats] = useState<{
    total: number;
    byCategory: { category: string; count: number }[];
    byLevel: { level: string; count: number }[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getVocabularyStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  return { stats, isLoading };
}
