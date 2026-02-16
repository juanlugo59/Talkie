import { neon } from "@neondatabase/serverless";

export function getSQL() {
  return neon(process.env.DATABASE_URL!);
}

let initialized = false;
let initPromise: Promise<void> | null = null;

export async function ensureSchema() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = doInit();
  return initPromise;
}

async function doInit() {
  const sql = getSQL();

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color INTEGER NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL
      )
    `;
  } catch (e: unknown) {
    // Ignore "duplicate key" race condition on pg_type (known Neon issue)
    if (!(e instanceof Error && "code" in e && (e as { code: string }).code === "23505")) throw e;
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS text_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        progress REAL NOT NULL DEFAULT 0,
        last_position INTEGER NOT NULL DEFAULT 0,
        folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL
      )
    `;
  } catch (e: unknown) {
    if (!(e instanceof Error && "code" in e && (e as { code: string }).code === "23505")) throw e;
  }

  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_text_items_created_at ON text_items(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_text_items_folder_id ON text_items(folder_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_folders_created_at ON folders(created_at DESC)`;
  } catch {
    // Indexes already exist
  }

  initialized = true;
}
