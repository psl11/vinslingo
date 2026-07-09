import { supabase } from '../supabase';
import { runQuery, runStatement, withTransaction } from '../database/client';
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
          // Handle queued XP updates: RPC atómico con fallback leer-luego-escribir
          // (ver supabase/migrations/001_increment_xp.sql)
          const { error: rpcError } = await supabase.rpc('increment_xp', { amount: payload.xp_delta });
          if (rpcError) {
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
          }
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

    // 2. Download user progress from Supabase
    // Fetch user's vocabulary progress. OJO: al ser INSERT OR REPLACE, hay que
    // escribir TODAS las columnas de estado (incluidas las FSRS) o el replace
    // las machacaría con sus defaults y se perdería la programación local.
    const { data: userVocab, error } = await supabase
      .from('user_vocabulary')
      .select('*')
      .eq('user_id', user.id);

    if (!error && userVocab && userVocab.length > 0) {
      const toMs = (v: string | null | undefined) => (v ? new Date(v).getTime() : null);
      // Una sola transacción para todo el progreso descargado: escribir fila a
      // fila con runStatement suelto es un round-trip al worker por fila (lento
      // en la PWA cuando el usuario tiene cientos de palabras repasadas).
      await withTransaction(async (db) => {
        for (const item of userVocab) {
          await db.runAsync(
            `INSERT OR REPLACE INTO user_vocabulary (
              id, vocabulary_id, ease_factor, interval_days, repetitions,
              next_review_at, last_reviewed_at, times_correct, times_incorrect,
              mastery_level,
              stability, difficulty, elapsed_days, scheduled_days, learning_steps,
              reps, lapses, fsrs_state, due, last_review,
              updated_at, needs_sync
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
              item.id,
              item.vocabulary_id,
              item.ease_factor ?? 2.5,
              item.interval_days ?? 0,
              item.repetitions ?? 0,
              toMs(item.next_review_at),
              toMs(item.last_reviewed_at),
              item.times_correct ?? 0,
              item.times_incorrect ?? 0,
              item.mastery_level ?? 0,
              item.stability ?? 0,
              item.difficulty ?? 0,
              item.elapsed_days ?? 0,
              item.scheduled_days ?? 0,
              item.learning_steps ?? 0,
              item.reps ?? 0,
              item.lapses ?? 0,
              item.fsrs_state ?? 0,
              toMs(item.due),
              toMs(item.last_review),
              Date.now(),
            ]
          );
        }
      });
      result.downloaded += userVocab.length;
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

// Handle queued vocabulary progress with delta-based counts.
// El payload lo escribe addToSyncQueue en progressService (columnas FSRS +
// espejos next_review_at/repetitions + deltas): se reenvía tal cual, separando
// solo los deltas de aciertos, para no volver a desalinearse con el esquema
// (este replay se quedó en columnas SM-2 tras la migración FSRS — bug).
async function syncQueuedVocabularyProgress(
  userId: string,
  payload: any
): Promise<void> {
  const {
    vocabulary_id: vocabId,
    times_correct_delta,
    times_incorrect_delta,
    ...cols
  } = payload;
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
        ...cols,
        last_reviewed_at: cols.last_reviewed_at || now,
        times_correct: existing.times_correct + (times_correct_delta || 0),
        times_incorrect: existing.times_incorrect + (times_incorrect_delta || 0),
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
        ...cols,
        last_reviewed_at: cols.last_reviewed_at || now,
        times_correct: times_correct_delta || 0,
        times_incorrect: times_incorrect_delta || 0,
      });
    if (error) throw error;
  }
}
