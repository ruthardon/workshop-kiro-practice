// Recrea la base de datos SQLite local (backend/data/claimshield.db) con los datos semilla.
process.env.DB_CLIENT = 'sqlite';

import fs from 'fs';

async function main() {
  const { env } = await import('../src/config/env');
  const { db } = await import('../src/config/db');
  if (env.sqlitePath !== ':memory:') {
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(`${env.sqlitePath}${suffix}`, { force: true });
    }
  }
  await db.init();
  const { rows } = await db.query<{ total: number }>('SELECT COUNT(*) AS total FROM claims');
  await db.close();
  console.log(`Base de datos SQLite recreada con ${rows[0].total} siniestros de ejemplo.`);
}

main().catch((err) => {
  console.error('No se pudo recrear la base de datos:', err instanceof Error ? err.message : 'error');
  process.exit(1);
});
