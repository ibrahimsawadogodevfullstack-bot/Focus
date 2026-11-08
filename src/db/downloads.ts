import { getDatabase } from './database';
import { toFileUri } from '../../services/filePaths';

export type DownloadStatus = 'queued' | 'downloading' | 'completed' | 'failed' | 'canceled';

export type DownloadRecord = {
  id: string;
  videoId: string;
  sourceUrl: string;
  title: string;
  channelName: string;
  thumbnailLocalPath: string | null;
  filePath: string | null;
  durationSec: number;
  sizeBytes: number;
  format: 'video' | 'audio';
  quality: string;
  categoryId: string;
  status: DownloadStatus;
  progress: number;
  errorCode: string | null;
  errorMessage: string | null;
  lastPositionSec: number;
  createdAt: number;
};

export type NewDownload = Omit<DownloadRecord, 'progress' | 'errorCode' | 'errorMessage' | 'lastPositionSec' | 'createdAt' | 'status'> & {
  status?: DownloadStatus;
};

const COLUMNS =
  'id, videoId, sourceUrl, title, channelName, thumbnailLocalPath, filePath, durationSec, sizeBytes, format, quality, categoryId, status, progress, errorCode, errorMessage, lastPositionSec, createdAt';

function rowToRecord(row: any): DownloadRecord {
  return {
    id: row.id,
    videoId: row.videoId,
    sourceUrl: row.sourceUrl,
    title: row.title,
    channelName: row.channelName ?? '',
    thumbnailLocalPath: row.thumbnailLocalPath ?? null,
    filePath: row.filePath ?? null,
    durationSec: row.durationSec ?? 0,
    sizeBytes: row.sizeBytes ?? 0,
    format: row.format === 'audio' ? 'audio' : 'video',
    quality: row.quality ?? '720p',
    categoryId: row.categoryId,
    status: row.status,
    progress: row.progress ?? 0,
    errorCode: row.errorCode ?? null,
    errorMessage: row.errorMessage ?? null,
    lastPositionSec: row.lastPositionSec ?? 0,
    createdAt: row.createdAt,
  };
}

export async function insertDownload(record: DownloadRecord): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO downloads (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.videoId,
      record.sourceUrl,
      record.title,
      record.channelName,
      record.thumbnailLocalPath,
      record.filePath,
      record.durationSec,
      record.sizeBytes,
      record.format,
      record.quality,
      record.categoryId,
      record.status,
      record.progress,
      record.errorCode,
      record.errorMessage,
      record.lastPositionSec,
      record.createdAt,
    ],
  );
}

export async function updateDownload(id: string, patch: Partial<DownloadRecord>): Promise<void> {
  const db = await getDatabase();
  const keys = Object.keys(patch) as (keyof DownloadRecord)[];
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => patch[k] ?? null);
  await db.runAsync(`UPDATE downloads SET ${sets} WHERE id = ?`, [...values, id]);
}

export async function deleteDownloadRow(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM downloads WHERE id = ?', [id]);
}

export async function getDownload(id: string): Promise<DownloadRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    `SELECT ${COLUMNS} FROM downloads WHERE id = ?`,
    [id],
  );
  return row ? rowToRecord(row) : null;
}

export async function listDownloads(): Promise<DownloadRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT ${COLUMNS} FROM downloads ORDER BY createdAt DESC`,
  );
  return rows.map(rowToRecord);
}

export async function listDownloadsByCategory(categoryId: string): Promise<DownloadRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT ${COLUMNS} FROM downloads WHERE categoryId = ? ORDER BY createdAt DESC`,
    [categoryId],
  );
  return rows.map(rowToRecord);
}

export async function moveDownloadsCategory(fromId: string, toId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE downloads SET categoryId = ? WHERE categoryId = ?', [toId, fromId]);
}

export async function startupReconcile(): Promise<void> {
  const db = await getDatabase();
  // Anything left as `downloading` after a crash becomes `failed` with retry.
  await db.runAsync(
    `UPDATE downloads SET status = 'failed', errorCode = COALESCE(errorCode, 'ERR_INTERRUPTED'),
     errorMessage = COALESCE(errorMessage, 'Interrupted') WHERE status = 'downloading'`,
  );
  // Mark completed entries whose file disappeared as missing.
  const rows = await db.getAllAsync<any>(
    `SELECT id, filePath FROM downloads WHERE status = 'completed'`,
  );
  const { File } = await import('expo-file-system');
  for (const row of rows) {
    if (!row.filePath) continue;
    const file = new File(toFileUri(row.filePath));
    if (!file.exists) {
      await db.runAsync(
        `UPDATE downloads SET status = 'failed', errorCode = 'missing_file', errorMessage = 'File missing' WHERE id = ?`,
        [row.id],
      );
    }
  }
}


