import path from 'path';

export type DbClient = 'sqlite' | 'postgres';

function resolveDbClient(): DbClient {
  const value = (process.env.DB_CLIENT ?? 'postgres').trim().toLowerCase();
  if (value !== 'sqlite' && value !== 'postgres') {
    throw new Error(`DB_CLIENT inválido: "${value}". Valores permitidos: sqlite, postgres`);
  }
  return value;
}

// Raíz del repositorio (backend/src/config o backend/dist/config -> ../../..)
const repoRoot = path.resolve(__dirname, '../../..');

function resolveSqlitePath(): string {
  const raw = process.env.SQLITE_PATH?.trim();
  if (!raw) return path.resolve(__dirname, '../../data/claimshield.db');
  if (raw === ':memory:' || path.isAbsolute(raw)) return raw;
  // Una ruta relativa siempre se interpreta desde la raíz del repositorio
  return path.resolve(repoRoot, raw);
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  dbClient: resolveDbClient(),
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://claimshield:claimshield@localhost:5432/claimshield',
  sqlitePath: resolveSqlitePath(),
};
