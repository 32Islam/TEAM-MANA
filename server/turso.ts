import { createClient, type Client } from '@libsql/client';
import { randomUUID } from 'crypto';

export interface TournamentState {
  config?: any;
  savedMatches?: any[];
  lastUpdated?: number;
}

let client: Client | null = null;
let schemaPromise: Promise<void> | null = null;

function getClient(): Client {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error('TURSO_DATABASE_URL is not configured');
  }

  client = createClient({
    url,
    authToken,
  });

  return client;
}

export async function ensureSchema(): Promise<void> {
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    const db = getClient();
    await db.batch([
      `CREATE TABLE IF NOT EXISTS tournaments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        config TEXT NOT NULL DEFAULT '{}',
        matches TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        is_current INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS tournaments_one_current_idx
        ON tournaments (is_current) WHERE is_current = 1`,
      `CREATE INDEX IF NOT EXISTS tournaments_updated_at_idx
        ON tournaments (updated_at DESC)`,
      `CREATE TABLE IF NOT EXISTS tournament_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
    ], 'write');
  })().catch((err) => {
    schemaPromise = null;
    throw err;
  });

  return schemaPromise;
}

function parseJson(value: unknown, fallback: any) {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function getCurrentTournament(): Promise<{
  id: string;
  name: string;
  config: any;
  matches: any[];
  status: string;
  createdAt: string;
  updatedAt: string;
} | null> {
  const db = getClient();
  await ensureSchema();

  const result = await db.execute(`
    SELECT id, name, config, matches, status, created_at, updated_at
    FROM tournaments
    WHERE is_current = 1
    ORDER BY updated_at DESC
    LIMIT 1
  `);

  const row = result.rows[0] as any;
  if (!row) return null;

  return {
    id: String(row.id),
    name: String(row.name || 'PUBG Mobile Tournament'),
    config: parseJson(row.config, {}),
    matches: parseJson(row.matches, []),
    status: String(row.status || 'active'),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function saveCurrentTournament(
  state: TournamentState
): Promise<{ id: string; lastUpdated: number; matchesCount: number }> {
  const db = getClient();
  await ensureSchema();

  const incomingLastUpdated = Number(state.lastUpdated) || Date.now();

  const currentResult = await db.execute(`
    SELECT id, config, matches, updated_at
    FROM tournaments
    WHERE is_current = 1
    ORDER BY updated_at DESC
    LIMIT 1
  `);

  const current = currentResult.rows[0] as any;

  const config = state.config && typeof state.config === 'object'
    ? state.config
    : parseJson(current?.config, {});

  const matches = Array.isArray(state.savedMatches)
    ? state.savedMatches
    : parseJson(current?.matches, []);

  const name = String(config?.name || 'PUBG Mobile Tournament');

  /*
   * IMPORTANT:
   * Reject stale requests.
   *
   * This prevents an old 9 MB request that was still uploading
   * from overwriting a newer reset/clear/save operation.
   */
  if (current?.updated_at) {
    const currentUpdatedAt = new Date(String(current.updated_at)).getTime();

    if (
      Number.isFinite(currentUpdatedAt) &&
      incomingLastUpdated < currentUpdatedAt
    ) {
      console.warn(
        `[Turso] Ignoring stale save. Incoming: ${incomingLastUpdated}, Current: ${currentUpdatedAt}`
      );

      return {
        id: String(current.id),
        lastUpdated: currentUpdatedAt,
        matchesCount: parseJson(current.matches, []).length,
      };
    }
  }

  const now = new Date(incomingLastUpdated).toISOString();

  if (current?.id) {
    await db.execute({
      sql: `
        UPDATE tournaments
        SET
          name = ?,
          config = ?,
          matches = ?,
          status = 'active',
          updated_at = ?
        WHERE id = ?
      `,
      args: [
        name,
        JSON.stringify(config),
        JSON.stringify(matches),
        now,
        String(current.id),
      ],
    });

    return {
      id: String(current.id),
      lastUpdated: incomingLastUpdated,
      matchesCount: matches.length,
    };
  }

  const id = randomUUID();

  await db.batch([
    {
      sql: `
        INSERT INTO tournaments
          (id, name, config, matches, status, is_current, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', 1, ?, ?)
      `,
      args: [
        id,
        name,
        JSON.stringify(config),
        JSON.stringify(matches),
        now,
        now,
      ],
    },
    {
      sql: `
        INSERT OR REPLACE INTO tournament_meta
          (key, value)
        VALUES ('current_tournament_id', ?)
      `,
      args: [id],
    },
  ], 'write');

  return {
    id,
    lastUpdated: incomingLastUpdated,
    matchesCount: matches.length,
  };
}

export async function createNewTournament(
  config: any | null
): Promise<{ id: string; name: string; createdAt: string }> {
  const db = getClient();
  await ensureSchema();

  const safeConfig = config && typeof config === 'object' ? config : {};
  const name = String(safeConfig.name || 'PUBG Mobile Tournament');
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.batch([
    `UPDATE tournaments
      SET is_current = 0,
          status = CASE WHEN status = 'active' THEN 'completed' ELSE status END,
          updated_at = '${now}'
      WHERE is_current = 1`,
    {
      sql: `
        INSERT INTO tournaments
          (id, name, config, matches, status, is_current, created_at, updated_at)
        VALUES (?, ?, ?, '[]', 'active', 1, ?, ?)
      `,
      args: [id, name, JSON.stringify(safeConfig), now, now],
    },
    {
      sql: `INSERT OR REPLACE INTO tournament_meta (key, value) VALUES ('current_tournament_id', ?)`,
      args: [id],
    },
  ], 'write');

  return { id, name, createdAt: now };
}

export async function listTournaments(limit = 50): Promise<any[]> {
  const db = getClient();
  await ensureSchema();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const result = await db.execute({
    sql: `
      SELECT id, name, status, is_current, created_at, updated_at,
             length(matches) - length(replace(matches, '{', '')) AS matches_count_hint
      FROM tournaments
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [safeLimit],
  });
  return result.rows;
}

export async function getTournamentById(id: string): Promise<any | null> {
  const db = getClient();
  await ensureSchema();
  const result = await db.execute({
    sql: `SELECT id, name, config, matches, status, is_current, created_at, updated_at FROM tournaments WHERE id = ? LIMIT 1`,
    args: [id],
  });
  const row = result.rows[0] as any;
  if (!row) return null;
  return {
    ...row,
    config: parseJson(row.config, {}),
    matches: parseJson(row.matches, []),
  };
}

export async function healthCheckDb(): Promise<boolean> {
  const db = getClient();
  await db.execute('SELECT 1');
  return true;
}
