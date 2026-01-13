import { supabase } from '../supabase';
import { runQuery, runStatement } from '../database/client';
import { getPendingSyncItems, markAsSynced } from '../database/queries';

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  errors: string[];
}

export async function syncUserProgress(): Promise<SyncResult> {
  const result: SyncResult = {
    uploaded: 0,
    downloaded: 0,
    errors: [],
  };

  try {
    // 1. Upload local changes to Supabase
    const pendingItems = await getPendingSyncItems();
    
    for (const item of pendingItems) {
      try {
        const payload = item.payload ? JSON.parse(item.payload) : {};
        
        if (item.action === 'INSERT' || item.action === 'UPDATE') {
          const { error } = await supabase
            .from(item.table_name)
            .upsert(payload);
          
          if (error) throw error;
        } else if (item.action === 'DELETE') {
          const { error } = await supabase
            .from(item.table_name)
            .delete()
            .eq('id', item.record_id);
          
          if (error) throw error;
        }
        
        // Mark as synced
        await runStatement(
          'UPDATE sync_queue SET synced_at = ? WHERE id = ?',
          [Date.now(), item.id]
        );
        
        result.uploaded++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Failed to sync ${item.table_name}: ${message}`);
      }
    }

    // 2. Download user progress from Supabase (if authenticated)
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Fetch user's vocabulary progress
      const { data: userVocab, error } = await supabase
        .from('user_vocabulary')
        .select('*')
        .eq('user_id', user.id);
      
      if (!error && userVocab) {
        for (const item of userVocab) {
          await runStatement(
            `INSERT OR REPLACE INTO user_vocabulary (
              id, vocabulary_id, ease_factor, interval_days, repetitions,
              next_review_at, last_reviewed_at, times_correct, times_incorrect,
              mastery_level, updated_at, needs_sync
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
              item.id,
              item.vocabulary_id,
              item.ease_factor,
              item.interval_days,
              item.repetitions,
              item.next_review_at ? new Date(item.next_review_at).getTime() : null,
              item.last_reviewed_at ? new Date(item.last_reviewed_at).getTime() : null,
              item.times_correct,
              item.times_incorrect,
              item.mastery_level,
              Date.now(),
            ]
          );
          result.downloaded++;
        }
      }
    }

    // Update last sync time
    await runStatement(
      `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) 
       VALUES ('last_full_sync', ?, ?)`,
      [Date.now().toString(), Date.now()]
    );

    console.log(`✅ Sync complete: ${result.uploaded} up, ${result.downloaded} down`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    result.errors.push(message);
    console.error('Sync error:', err);
  }

  return result;
}

export async function getLastSyncTime(): Promise<number | null> {
  try {
    const result = await runQuery<{ value: string }>(
      "SELECT value FROM sync_metadata WHERE key = 'last_full_sync'"
    );
    return result[0] ? parseInt(result[0].value, 10) : null;
  } catch {
    return null;
  }
}

export function formatLastSync(timestamp: number | null): string {
  if (!timestamp) return 'Nunca';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Hace un momento';
  if (diff < 3600000) return `Hace ${Math.round(diff / 60000)} min`;
  if (diff < 86400000) return `Hace ${Math.round(diff / 3600000)} horas`;
  
  return new Date(timestamp).toLocaleDateString();
}
