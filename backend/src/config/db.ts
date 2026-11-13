import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import type BetterSqlite3 from 'better-sqlite3';
import { env } from './env';
import { fromCents } from '../utils/money';

// Acceso a datos común para PostgreSQL y SQLite.
// Los servicios escriben SQL con placeholders $1, $2... y reciben filas con montos como string decimal.
export interface QueryResult<T> {
  rows: T[];
}

export interface Queryable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T = any>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export interface Db extends Queryable {
  dialect: 'sqlite' | 'postgres';
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  init(): Promise<void>;
  close(): Promise<void>;
}

// ---------- PostgreSQL ----------

function createPostgresDb(): Db {
  // Los NUMERIC de Postgres se mantienen como string para no perder precisión.
  const pool = new Pool({ connectionString: env.databaseUrl });

  return {
    dialect: 'postgres',
    query: ((sql: string, params?: unknown[]) => pool.query(sql, params)) as Queryable['query'],
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: ((sql: string, params?: unknown[]) => client.query(sql, params)) as Queryable['query'] });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    async init() {
      const retries = 10;
      const delayMs = 2000;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await pool.query('SELECT 1');
          return;
        } catch (err) {
          if (attempt === retries) throw err;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    },
    close: () => pool.end(),
  };
}

// ---------- SQLite ----------

const SQLITE_SQL_DIR = path.resolve(__dirname, '../../../db/sqlite');
const DATE_COLUMNS = new Set(['incident_date', 'start_date', 'end_date']);

// Placeholders $n -> ? (un parámetro por aparición, admite $n repetido); FOR UPDATE no existe en SQLite.
function translateSql(sql: string, params: unknown[]): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const text = sql.replace(/\s+FOR\s+UPDATE\b/gi, '').replace(/\$(\d+)/g, (_match, index: string) => {
    values.push(params[Number(index) - 1]);
    return '?';
  });
  return { text, values };
}

// Convierte las columnas *_cents en string decimal y las fechas DATE al mismo formato que devuelve Postgres.
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.endsWith('_cents')) {
      out[key.slice(0, -'_cents'.length)] = value === null ? null : fromCents(Number(value));
    } else if (DATE_COLUMNS.has(key) && typeof value === 'string' && value.length === 10) {
      out[key] = `${value}T00:00:00.000Z`;
    } else {
      out[key] = value;
    }
  }
  return out;
}

function createSqliteDb(): Db {
  let conn: BetterSqlite3.Database | null = null;
  // Cola única: una sola conexión, las transacciones y consultas se ejecutan una a una.
  let tail: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(task: () => T | Promise<T>): Promise<T> => {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  };

  const connection = (): BetterSqlite3.Database => {
    if (!conn) throw new Error('La base de datos SQLite no está inicializada');
    return conn;
  };

  const execute = async (sql: string, params: unknown[] = []) => {
    const { text, values } = translateSql(sql, params);
    const stmt = connection().prepare(text);
    if (stmt.reader) {
      return { rows: (stmt.all(...values) as Record<string, unknown>[]).map(normalizeRow) };
    }
    stmt.run(...values);
    return { rows: [] };
  };

  return {
    dialect: 'sqlite',
    query: ((sql: string, params?: unknown[]) => enqueue(() => execute(sql, params))) as Queryable['query'],
    transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
      return enqueue(async () => {
        const db = connection();
        db.exec('BEGIN IMMEDIATE');
        try {
          const result = await fn({ query: ((sql: string, params?: unknown[]) => execute(sql, params)) as Queryable['query'] });
          db.exec('COMMIT');
          return result;
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
      });
    },
    async init() {
      if (conn) return;
      // Carga diferida: en modo PostgreSQL no se necesita el módulo nativo.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Database = require('better-sqlite3') as typeof BetterSqlite3;
      const inMemory = env.sqlitePath === ':memory:';
      if (!inMemory) {
        fs.mkdirSync(path.dirname(env.sqlitePath), { recursive: true });
      }
      const db = new Database(env.sqlitePath);
      db.pragma('foreign_keys = ON');
      if (!inMemory) {
        db.pragma('journal_mode = WAL');
      }
      const hasSchema = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'policies'")
        .get();
      if (!hasSchema) {
        db.exec(fs.readFileSync(path.join(SQLITE_SQL_DIR, 'schema.sql'), 'utf8'));
      }
      const { total } = db.prepare('SELECT COUNT(*) AS total FROM policies').get() as { total: number };
      if (total === 0) {
        db.exec(fs.readFileSync(path.join(SQLITE_SQL_DIR, 'seed.sql'), 'utf8'));
      }
      conn = db;
    },
    async close() {
      await tail;
      conn?.close();
      conn = null;
    },
  };
}

export const db: Db = env.dbClient === 'sqlite' ? createSqliteDb() : createPostgresDb();

// Fragmentos de SQL que cambian según el motor.
export const dialectSql = {
  now: env.dbClient === 'sqlite' ? "strftime('%Y-%m-%dT%H:%M:%fZ','now')" : 'now()',
  varchar: env.dbClient === 'sqlite' ? '' : '::varchar',
  // Columnas de dinero: centavos enteros en SQLite, NUMERIC(12,2) en Postgres.
  money: (column: string) => (env.dbClient === 'sqlite' ? `${column}_cents` : column),
};

export async function waitForDb(): Promise<void> {
  await db.init();
}
