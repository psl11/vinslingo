import { supabase } from '../supabase';
import { runQuery, runStatement } from '../database/client';
import { getPendingSyncItems } from '../database/queries';

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      result.errors.push('No authenticated user');
      return result;
    }

    // 1. Upload local changes to Supabase
    const pendingItems = await getPendingSyncItems();
    
    for (const item of pendingItems) {
      try {
        const payload = item.payload ? JSON.parse(item.payload) : {};
        
        if (item.table_name === 'user_vocabulary') {
          // Handle vocabulary progress with delta-based correct/incorrect counts
          await syncQueuedVocabularyProgress(user.id, payload);
        } else if (item.table_name === 'study_sessions' && item.action === 'INSERT') {
          // Handle queued study sessions
          const { error } = await supabase
            .from('study_sessions')
            .insert({ ...payload, user_id: user.id });
          if (error) throw error;
        } else if (item.table_name === 'profiles' && payload.xp_delta) {
          // Handle queued XP updates
          const { data: profile } = await supabase
            .from('profiles')
            .select('total_xp')
            .eq('id', user.id)
            .single();
          const currentXp = profile?.total_xp || 0;
          const { error } = await supabase
            .from('profiles')
            .update({ total_xp: currentXp + payload.xp_delta, updated_at: new Date().toISOString() })
            .eq('id', user.id);
          if (error) throw error;
        } else if (item.action === 'INSERT' || item.action === 'UPDATE') {
          const { error } = await supabase
            .from(item.table_name)
            .upsert({ ...payload, user_id: user.id });
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
        // Increment retry count
        await runStatement(
          'UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE id = ?',
          [message, item.id]
        );
      }
    }

    // 2. Download user progress from Supabase (paginated: PostgREST caps each
    // request at ~1000 rows). INSERT OR REPLACE collapses any duplicate onto
    // the UNIQUE(vocabulary_id) index, keeping one row per word.
    if (user) {
      const PAGE_SIZE = 1000;
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data: userVocab, error } = await supabase
          .from('user_vocabulary')
          .select('*')
          .eq('user_id', user.id)
          .range(from, from + PAGE_SIZE - 1);

        if (error || !userVocab || userVocab.length === 0) break;

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

        if (userVocab.length < PAGE_SIZE) break;
      }
    }

    // Update last sync time
    await runStatement(
      `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
       VALUES ('last_full_sync', ?, ?)`,
      [Date.now().toString(), Date.now()]
    );

    // Prune already-synced queue entries so sync_queue doesn't grow unbounded.
    await runStatement('DELETE FROM sync_queue WHERE synced_at IS NOT NULL');

    console.log(`✅ Sync complete: ${result.uploaded} up, ${result.downloaded} down`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    result.errors.push(message);
    console.error('Sync error:', err);
  }

  return result;
}

// Handle queued vocabulary progress with delta-based counts
async function syncQueuedVocabularyProgress(
  userId: string,
  payload: any
): Promise<void> {
  const vocabId = payload.vocabulary_id;
  const now = new Date().toISOString();

  // Check if record exists in Supabase
  const { data: existing } = await supabase
    .from('user_vocabulary')
    .select('id, times_correct, times_incorrect')
    .eq('user_id', userId)
    .eq('vocabulary_id', vocabId)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('user_vocabulary')
      .update({
        ease_factor: payload.ease_factor,
        interval_days: payload.interval_days,
        repetitions: payload.repetitions,
        next_review_at: payload.next_review_at,
        last_reviewed_at: payload.last_reviewed_at || now,
        times_correct: existing.times_correct + (payload.times_correct_delta || 0),
        times_incorrect: existing.times_incorrect + (payload.times_incorrect_delta || 0),
        mastery_level: payload.mastery_level,
        updated_at: now,
      })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('user_vocabulary')
      .insert({
        user_id: userId,
        vocabulary_id: vocabId,
        ease_factor: payload.ease_factor,
        interval_days: payload.interval_days,
        repetitions: payload.repetitions,
        next_review_at: payload.next_review_at,
        last_reviewed_at: payload.last_reviewed_at || now,
        times_correct: payload.times_correct_delta || 0,
        times_incorrect: payload.times_incorrect_delta || 0,
        mastery_level: payload.mastery_level,
      });
    if (error) throw error;
  }
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
