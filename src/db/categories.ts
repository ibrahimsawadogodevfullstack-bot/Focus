import { getDatabase, UNCATEGORIZED_ID } from './database';

export type Category = {
  id: string;
  name: string;
  createdAt: number;
};

export async function listCategories(): Promise<Category[]> {
  const db = await getDatabase();
  return db.getAllAsync<Category>(
    'SELECT id, name, createdAt FROM categories ORDER BY createdAt ASC',
  );
}

export async function upsertCategory(id: string, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO categories (id, name, createdAt) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
    [id, name, Date.now()],
  );
}

export async function deleteCategory(id: string): Promise<void> {
  if (id === UNCATEGORIZED_ID) return;
  const db = await getDatabase();
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}

export async function renameCategory(id: string, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
}

export async function ensureCategories(ids: { id: string; name: string }[]): Promise<void> {
  for (const c of ids) {
    await upsertCategory(c.id, c.name);
  }
}
