import * as SQLite from 'expo-sqlite';
import { LOCAL_SCHEMA, INIT_QUERIES } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  
  db = await SQLite.openDatabaseAsync('vinslingo.db');
  await initializeDatabase();
  return db;
}

async function initializeDatabase(): Promise<void> {
  if (!db) return;
  
  // Ejecutar schema
  await db.execAsync(LOCAL_SCHEMA);
  
  // Ejecutar queries de inicialización
  await db.execAsync(INIT_QUERIES.initSyncMetadata);
  await db.execAsync(INIT_QUERIES.initSettings);
  
  console.log('✅ Database initialized');
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

// Helper para ejecutar queries con parámetros
export async function runQuery<T>(
  query: string,
  params: (string | number | null)[] = []
): Promise<T[]> {
  const database = await getDatabase();
  return database.getAllAsync<T>(query, params);
}

// Helper para ejecutar un statement (INSERT, UPDATE, DELETE)
export async function runStatement(
  query: string,
  params: (string | number | null)[] = []
): Promise<SQLite.SQLiteRunResult> {
  const database = await getDatabase();
  return database.runAsync(query, params);
}

// Helper para obtener un solo registro
export async function getOne<T>(
  query: string,
  params: (string | number | null)[] = []
): Promise<T | null> {
  const database = await getDatabase();
  return database.getFirstAsync<T>(query, params);
}

// Helper para transacciones
export async function withTransaction(
  callback: (db: SQLite.SQLiteDatabase) => Promise<void>
): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    await callback(database);
  });
}
