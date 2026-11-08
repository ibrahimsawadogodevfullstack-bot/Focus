import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const DB_NAME = 'focus-downloads.db';

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = versionRow?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS downloads (
        id TEXT PRIMARY KEY NOT NULL,
        videoId TEXT NOT NULL,
        sourceUrl TEXT NOT NULL,
        title TEXT NOT NULL,
        channelName TEXT NOT NULL DEFAULT '',
        thumbnailLocalPath TEXT,
        filePath TEXT,
        durationSec INTEGER NOT NULL DEFAULT 0,
        sizeBytes INTEGER NOT NULL DEFAULT 0,
        format TEXT NOT NULL DEFAULT 'video',
        quality TEXT NOT NULL DEFAULT '720p',
        categoryId TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        progress REAL NOT NULL DEFAULT 0,
        errorCode TEXT,
        errorMessage TEXT,
        lastPositionSec REAL NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (categoryId) REFERENCES categories(id)
      );

      CREATE INDEX IF NOT EXISTS idx_downloads_category ON downloads(categoryId);
      CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);

      PRAGMA user_version = 1;
    `);
    version = 1;
  }

  // Phase 1: seed the uncategorized system category.
  await db.runAsync(
    `INSERT OR IGNORE INTO categories (id, name, createdAt) VALUES (?, ?, ?)`,
    ['uncategorized', 'Sans catégorie', Date.now()],
  );
}

export const UNCATEGORIZED_ID = 'uncategorized';
export const UNCATEGORIZED_NAME = 'Sans catégorie';
