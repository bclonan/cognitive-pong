import fs from "fs";
import path from "path";

type DatabaseSyncLike = {
  exec: (sql: string) => unknown;
  prepare: (sql: string) => {
    run: (...params: unknown[]) => unknown;
    get: (...params: unknown[]) => any;
    all: (...params: unknown[]) => any[];
  };
  close: () => void;
};

type SQLiteTableName = "matches" | "arena_battles";

const SQLITE_STORE_RE = /\.(?:sqlite|sqlite3|db)$/i;

const TABLE_SQL: Record<SQLiteTableName, string> = {
  matches: `
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      sort_index INTEGER NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_matches_public_sort ON matches (is_public, sort_index DESC);
  `,
  arena_battles: `
    CREATE TABLE IF NOT EXISTS arena_battles (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE,
      status TEXT NOT NULL,
      visibility TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sort_index INTEGER NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_arena_battles_slug ON arena_battles (slug);
    CREATE INDEX IF NOT EXISTS idx_arena_battles_visibility_sort ON arena_battles (visibility, sort_index DESC);
  `,
};

export function isSQLiteStorePath(storeFile: string) {
  return SQLITE_STORE_RE.test(storeFile.trim());
}

export function isSQLiteRuntimeAvailable() {
  try {
    return Boolean((process as any).getBuiltinModule?.("node:sqlite")?.DatabaseSync);
  } catch {
    return false;
  }
}

function loadDatabaseSync(): new (filename: string) => DatabaseSyncLike {
  try {
    const sqlite = (process as any).getBuiltinModule?.("node:sqlite") as
      | { DatabaseSync?: new (filename: string) => DatabaseSyncLike }
      | undefined;
    if (!sqlite.DatabaseSync) {
      throw new Error("node:sqlite DatabaseSync is unavailable in this Node.js runtime.");
    }
    return sqlite.DatabaseSync;
  } catch (err: any) {
    throw new Error(
      `SQLite persistence requires Node.js with node:sqlite support. Use Node 24+ or switch this store back to a .json file. ${err.message || ""}`.trim(),
    );
  }
}

function openSQLiteStore(storeFile: string) {
  if (!isSQLiteStorePath(storeFile)) {
    throw new Error(`Expected a .sqlite, .sqlite3, or .db store path, received ${storeFile}`);
  }

  const dir = path.dirname(storeFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const DatabaseSync = loadDatabaseSync();
  const db = new DatabaseSync(storeFile);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(TABLE_SQL.matches);
  db.exec(TABLE_SQL.arena_battles);
  return db;
}

function readSQLiteJsonRows<T>(storeFile: string, table: SQLiteTableName): T[] {
  const db = openSQLiteStore(storeFile);
  try {
    const rows = db
      .prepare(`SELECT payload_json FROM ${table} ORDER BY sort_index DESC, rowid DESC`)
      .all() as Array<{ payload_json: string }>;
    return rows.map((row) => JSON.parse(row.payload_json) as T);
  } finally {
    db.close();
  }
}

function replaceSQLiteJsonRows<T>(
  storeFile: string,
  table: SQLiteTableName,
  rows: T[],
  insertSql: string,
  toParams: (row: T, sortIndex: number) => unknown[],
) {
  const db = openSQLiteStore(storeFile);
  try {
    db.exec("BEGIN IMMEDIATE;");
    db.prepare(`DELETE FROM ${table}`).run();
    const insert = db.prepare(insertSql);
    rows.forEach((row, index) => {
      insert.run(...toParams(row, rows.length - index));
    });
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  } finally {
    db.close();
  }
}

export function countSQLiteRows(storeFile: string, table: SQLiteTableName) {
  const db = openSQLiteStore(storeFile);
  try {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count?: number };
    return Number(row?.count || 0);
  } finally {
    db.close();
  }
}

export function readSQLiteMatches<T = any>(storeFile: string): T[] {
  return readSQLiteJsonRows<T>(storeFile, "matches");
}

export function writeSQLiteMatches(matches: any[], storeFile: string) {
  replaceSQLiteJsonRows(
    storeFile,
    "matches",
    matches,
    `
      INSERT INTO matches (id, topic, is_public, updated_at, sort_index, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    (match, sortIndex) => [
      String(match.id),
      String(match.topic || ""),
      match.isPublic === false ? 0 : 1,
      String(match.timestamp || new Date().toISOString()),
      sortIndex,
      JSON.stringify(match),
    ],
  );
}

export function seedSQLiteMatchesIfEmpty(seedMatches: any[], storeFile: string) {
  if (countSQLiteRows(storeFile, "matches") === 0) {
    writeSQLiteMatches(seedMatches, storeFile);
  }
}

export function readSQLiteArenaBattles<T = any>(storeFile: string): T[] {
  return readSQLiteJsonRows<T>(storeFile, "arena_battles");
}

export function writeSQLiteArenaBattles(battles: any[], storeFile: string) {
  replaceSQLiteJsonRows(
    storeFile,
    "arena_battles",
    battles,
    `
      INSERT INTO arena_battles (id, slug, status, visibility, updated_at, sort_index, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    (battle, sortIndex) => [
      String(battle.id),
      battle.slug ? String(battle.slug) : null,
      String(battle.status || "created"),
      String(battle.visibility || "private"),
      String(battle.updated_at || new Date().toISOString()),
      sortIndex,
      JSON.stringify(battle),
    ],
  );
}
