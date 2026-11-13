import { app } from './app';
import { db } from './config/db';
import { env } from './config/env';

async function main() {
  await db.init();
  app.listen(env.port, () => {
    console.log(`ClaimShield API escuchando en el puerto ${env.port} (motor de BD: ${env.dbClient})`);
  });
}

main().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err instanceof Error ? err.message : 'error');
  process.exit(1);
});
