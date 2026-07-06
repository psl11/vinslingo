import { useState, useEffect, useCallback } from 'react';
import { getVocabularyStats } from '../lib/services/vocabularyService';

export function useVocabularyStats() {
  const [stats, setStats] = useState<{
    total: number;
    byCategory: { category: string; count: number }[];
    byLevel: { level: string; count: number }[];
    learnedByCategory: { category: string; count: number }[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const newStats = await getVocabularyStats();
      setStats(newStats);
    } catch (err) {
      console.error('Error loading vocabulary stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, isLoading, refresh };
}
