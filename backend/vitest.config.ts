import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Las pruebas corren contra SQLite en memoria: no requieren Docker ni PostgreSQL.
    env: { DB_CLIENT: 'sqlite', SQLITE_PATH: ':memory:' },
  },
});
