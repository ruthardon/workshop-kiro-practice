# Plan de implementación: Modo Cero-Instalación (SQLite) + Docker opcional

Rutas absolutas base: `/Users/ruthardon/Documents/Proyectos/Kiro Workshop/workshop-kiro-practice` (sin worktree, sin commits). Todo texto visible al usuario en español; identificadores en inglés.

## Hallazgos de la exploración (código leído)

- `backend/src/config/db.ts` exporta `pool` (`pg.Pool`) y `waitForDb()`. `env.ts` solo tiene `port` y `databaseUrl`.
- Solo dos servicios usan SQL: `services/claims.service.ts` y `services/policies.service.ts`. Controladores, rutas y `swagger.ts` no tocan la BD. `tests/health.test.ts` importa `app` (sin tocar la BD, pero el import de `db.ts` crea el Pool).
- Backend: TS `module: commonjs`, Node 22 en Dockerfile (`node:22-alpine`, `npm ci --omit=dev`, usuario `node`). Frontend: Vite 5, `API_URL = VITE_API_URL ?? 'http://localhost:3000'`, `vite.config.ts` sin proxy.
- `npm view better-sqlite3`: v13.1.1, `engines.node >=22` (dato de registro, ya leído). Esto fija el mínimo de Node en 22 y coincide con el Dockerfile.
- `.gitignore`, `.dockerignore`, `.env.example`, `sonar-project.properties` existen y son cortos. Hay que ampliarlos.
- README: sección "Inicio rápido" y "Desarrollo local" (líneas ~5-58) y FEAT-201 (líneas ~173-240). `swagger.ts:81` tiene `reserved_amount` de ejemplo `'16550.00'`. Las semillas dan APPROVED = 2950.00 + 13000.00 = **15950.00** (cálculo leído de `init.sql`; confirmar contra `/api/claims/stats` durante la implementación).
- Review anterior (`review.md`) ya pedía corregir ese ejemplo y aclarar FEAT-201. Ambos entran aquí.

## Decisiones de diseño

1. **Driver SQLite: `better-sqlite3` 13.1.1 (pinneado, sin `^`), dependencia normal en `backend`.** `node:sqlite` queda descartado: es experimental en Node 22 y emite advertencias; `better-sqlite3` ofrece API síncrona estable y binarios precompilados. Requiere verificación durante la implementación: que `npm install` en copia limpia funcione sin toolchain (si el binario precompilado no se descarga, `prebuild-install` cae a `node-gyp` y falla). Si falla en esta máquina o no hay binario precompilado para el Node instalado (la máquina tiene Node v26.12.0, que puede no tener prebuild), el coder debe: probar `npm install` con Node 22 (`npx -y node@22`) y, si sigue sin haber prebuild, cambiar a `node:sqlite` (Node ≥22.13, sin flag) y documentarlo. No dejar la decisión abierta: registrar el resultado en `verification-sqlite.md`. `engines` en `backend/package.json` y `/package.json`: `"node": ">=22"`.
2. **Selección de motor:** `DB_CLIENT=sqlite|postgres`. Valor por defecto en código: `postgres` (para no alterar el comportamiento actual). `docker-compose.yml` fija `DB_CLIENT: postgres` explícito. `scripts/start.mjs` y `db:reset` fijan `DB_CLIENT=sqlite`. Ruta de archivo: `SQLITE_PATH` (por defecto `backend/data/claimshield.db`, resuelta con `path.resolve(__dirname, '../../data/claimshield.db')`; `:memory:` permitido para tests).
3. **Dinero en SQLite: centavos enteros (INTEGER) en columnas `*_cents`.** Es exacto y evita aritmética flotante. La capa de acceso los convierte a string decimal `"1500.00"` al leer y a centavos al escribir, con una única función compartida en `backend/src/utils/money.ts` (`toCents(string|number): number`, `fromCents(number): string`, redondeo a 2 decimales). Alternativa descartada: TEXT decimal (no permite `SUM` en SQL). Los nombres de columna visibles para servicios siguen siendo `claimed_amount`, `indemnity_amount`, `deductible`, `coverage_limit` (la capa de dialecto hace `claimed_cents AS ...` y la conversión). **Decisión concreta:** el esquema SQLite define columnas `claimed_amount_cents`, etc. y el wrapper reescribe resultados: cada fila devuelta pasa por `normalizeRow()` que convierte `*_cents` a campos sin sufijo en string `"x.xx"`. Los servicios nunca ven centavos.
4. **Aislar los bugs de la abstracción.** BUG-101 se mantiene: `createClaim` sigue calculando `Number(claimed) - Number(deductible)` y lo guarda tal cual. En SQLite eso produce un entero negativo en `indemnity_amount_cents` (se convierte desde el número calculado con la misma función de redondeo). **Sin `CHECK` de rango** en `db/sqlite/schema.sql` ni cambios de validación en `init.sql`. Los `CHECK (status IN ...)` ya existen en `init.sql`; se replican igual en SQLite (no afectan a los bugs). No tocar la ausencia de validaciones de vigencia ni de enmascarado en `getPolicyById`.
5. **Fechas:** en SQLite `DATE` como TEXT `YYYY-MM-DD` y `TIMESTAMPTZ` como TEXT ISO UTC `YYYY-MM-DDTHH:mm:ss.sssZ`. **Requiere verificación durante la implementación:** `pg` devuelve `DATE` como objeto `Date` (serializa a ISO con zona horaria local del proceso) y `TIMESTAMPTZ` como `Date`. Para que las respuestas sean idénticas, primero capturar la forma real de Postgres (docker `up`, `curl /api/claims/1` y `/api/policies/1`). Estrategia preferida: registrar en `db.ts` `types.setTypeParser(1082, v => v)` para que Postgres devuelva `DATE` como string `YYYY-MM-DD`, y que SQLite devuelva el mismo formato. Esto cambia el campo de fecha de Postgres de ISO con hora a `YYYY-MM-DD`. Si el frontend o los tests dependen de la forma anterior, el coder debe comprobar los componentes (`ClaimsTable.tsx`, `NewClaimModal.tsx`) y documentar el cambio. Si se opta por no tocar Postgres, SQLite debe imitar exactamente la forma capturada. Registrar la decisión final en `verification-sqlite.md`.
6. **Concurrencia y `FOR UPDATE`:** SQLite no lo admite. La interfaz expone `transaction(fn)`; en SQLite usa `BEGIN IMMEDIATE` (serializa escritores, equivale al bloqueo de fila) y el `FOR UPDATE` se omite por el adaptador.
7. **Dialecto:** el código de servicios escribe SQL con placeholders `$1` y el adaptador SQLite los traduce a `?` (reemplazo ordenado; se debe soportar `$1` repetido, p. ej. el UPDATE de `transition`, convirtiendo a parámetros nombrados `@p1`). Esto evita duplicar consultas. Para los fragmentos con sintaxis específica de Postgres (`::int`, `::text`, `::varchar`, `FILTER (WHERE ...)`, `now()`, `FOR UPDATE`, `RETURNING`) el servicio recibe un helper `sql` del adaptador (`db.dialect`) o se reescriben con SQL portable: ver mapeo.

## Interfaz de `backend/src/config/db.ts`

```ts
export type Row = Record<string, unknown>;
export interface Queryable { query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>; }
export interface Db extends Queryable {
  dialect: 'sqlite' | 'postgres';
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  init(): Promise<void>;     // postgres: espera conexión; sqlite: crea archivo/schema/seed si vacío
  close(): Promise<void>;
}
export const db: Db;         // construido según env.dbClient
export async function waitForDb(...): Promise<void>; // se mantiene, delega en db.init()
```

- Postgres: `pg.Pool`; `transaction` usa `pool.connect()`, `BEGIN/COMMIT/ROLLBACK`, `release()` en `finally` (mismo comportamiento actual).
- SQLite: carga `better-sqlite3` con `require` dinámico solo si `DB_CLIENT=sqlite` (así la imagen Docker de producción sigue funcionando aunque el binario no se use; ver paso 9 sobre Dockerfile). Activa `PRAGMA foreign_keys = ON` y `journal_mode = WAL`. `query` es async por compatibilidad. Detecta si la sentencia devuelve filas (`stmt.reader`) para usar `.all()` o `.run()`. Convierte `$n` a `?n`/`@pn`, aplica `normalizeRow()` (centavos → string decimal) y nunca loguea parámetros.
- Los tipos de fecha se alinean según decisión 5.
- Importante: el wrapper no debe añadir validaciones ni corrección de resultados (decisión 4).

## Pasos ordenados

- [ ] 1. **Verificar el driver SQLite en limpio.** En un directorio temporal (`mktemp -d`) crear un `package.json` mínimo, instalar `better-sqlite3@13.1.1` con `npm install` (sin `python`/`make`/compilador forzados; revisar la salida para confirmar "prebuilt" y que no invoca `node-gyp`), abrir `:memory:` y ejecutar un `SELECT 1`. Hacerlo con el Node del sistema (v26.12.0) y, si es posible, con Node 22 (`npx -y node@22`). Si no hay prebuild: aplicar el plan de contingencia de la decisión 1 (`node:sqlite`). Registrar resultado y versión mínima de Node en `/Users/ruthardon/Documents/Proyectos/Kiro Workshop/workshop-kiro-practice/.agents/tasks/verification-sqlite.md`. Limpiar el directorio temporal.
  Archivos: ninguno del repo (solo directorio temporal y `verification-sqlite.md`).
  Verificar: `node -e "new (require('better-sqlite3'))(':memory:').prepare('select 1 as x').get()"` devuelve `{ x: 1 }`.

- [ ] 2. **Capturar la línea base de Postgres antes de cambiar nada.** Si Docker está disponible (`docker info`), `docker compose up --build -d`, guardar en un archivo temporal (fuera del repo, `mktemp`) las respuestas de `/api/claims`, `/api/claims/stats`, `/api/policies`, `/api/policies/1`, `/api/claims/1`, para la comparación del paso 16. Si Docker no está disponible, decirlo explícitamente y usar la forma leída en código (documentar como "no verificado contra Postgres real"). Luego `docker compose down` (sin `-v` salvo entorno de prueba propio).
  Verificar: archivos de línea base no vacíos.

- [ ] 3. **Esquema y semillas SQLite.** Crear `db/sqlite/schema.sql` (tablas `policies`, `claims`, `claim_audits`, índices, `CHECK` de `status` como en `init.sql`, `INTEGER PRIMARY KEY AUTOINCREMENT`, columnas monetarias `*_cents INTEGER NOT NULL`, fechas TEXT, `reopen_count INTEGER NOT NULL DEFAULT 0`, `created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`) y `db/sqlite/seed.sql` con exactamente los mismos 6 pólizas, 8 siniestros y 14 audits de `db/init.sql` (montos en centavos, fechas `'2025-08-12T09:00:00.000Z'`). Sin `CHECK` sobre `indemnity_amount_cents`. Orden y valores de `id` idénticos (inserciones en el mismo orden).
  Archivos: `db/sqlite/schema.sql`, `db/sqlite/seed.sql`. `db/init.sql` NO cambia.
  Verificar: cargar ambos con `better-sqlite3` en memoria y comprobar `count(*)`: 6 pólizas, 8 siniestros (3 OPEN, 2 APPROVED, 2 REJECTED, 1 CLOSED), 14 audits.

- [ ] 4. **Utilidad de dinero.** Crear `backend/src/utils/money.ts` con `toCents`, `fromCents` y `roundMoney` (aritmética por cadena/enteros, sin sumas flotantes sobre valores almacenados). Aceptar `number` y `string`. Importante para BUG-101: `toCents` debe aceptar negativos y no limitarlos.
  Archivos: `backend/src/utils/money.ts`.
  Verificar: `npm run build` en backend; comprobación rápida con `tsx -e` de `fromCents(toCents(-700))==='-700.00'` y `fromCents(155000)==='1550.00'`.

- [ ] 5. **Configuración.** Ampliar `backend/src/config/env.ts` con `dbClient` (`process.env.DB_CLIENT === 'sqlite' ? 'sqlite' : 'postgres'`; valor desconocido → error claro en español al arrancar) y `sqlitePath`. Mantener `port` y `databaseUrl`.
  Archivos: `backend/src/config/env.ts`.
  Verificar: `npm run build` en backend.

- [ ] 6. **Reescribir `db.ts` con la interfaz común** (ver sección anterior) con adaptadores Postgres y SQLite, aplicación automática de `schema.sql` + `seed.sql` cuando la BD SQLite no tenga la tabla `policies` o `policies` esté vacía, creación del directorio `backend/data/` si no existe, y mensaje de log neutro (sin PII). Las rutas a `db/sqlite/*.sql` se resuelven desde `backend/src/config` hacia `../../../db/sqlite`. Para ejecución en Docker, la ruta no existe pero tampoco se usa (modo postgres).
  Archivos: `backend/src/config/db.ts`.
  Verificar: `npm run build` en backend. Arrancar con `DB_CLIENT=sqlite` y comprobar que se crea `backend/data/claimshield.db` y que el segundo arranque no duplica semillas.

- [ ] 7. **Migrar servicios al `db` común (mapeo archivo por archivo).** Sin cambiar lógica de negocio ni comportamientos (incluidos los bugs).

  `backend/src/services/policies.service.ts`
  - `listPolicies`: `SELECT * FROM policies ORDER BY id`. Portable. Sustituir `pool.query` por `db.query`. Los montos salen como string vía `normalizeRow` (en Postgres ya son string por NUMERIC).
  - `getPolicyById`: `SELECT * FROM policies WHERE id = $1`. Portable con traducción de placeholder. Devuelve la fila completa sin máscara (SEC-103 intacto).

  `backend/src/services/claims.service.ts`
  - `CLAIM_SELECT` (JOIN con `policies`): portable. En SQLite las columnas `*_cents` se convierten en `claimed_amount`/`indemnity_amount`. El orden de claves de la fila debe coincidir con Postgres para que el JSON sea idéntico.
  - `listClaims` (`WHERE c.status = $1 ORDER BY c.id DESC`): portable.
  - `getClaimById`: portable.
  - `getStats`: usa `COUNT(*)::int`, `COUNT(*) FILTER (WHERE ...)`, `SUM(...) FILTER`, `::text`. SQLite no soporta `::`; `FILTER` sí existe en SQLite ≥3.30. Reescribir en SQL portable: `COUNT(*)`, `SUM(CASE WHEN status='OPEN' THEN 1 ELSE 0 END)`, y para Postgres/SQLite calcular `reserved_amount` con `SUM(CASE WHEN status='APPROVED' THEN indemnity_amount ELSE 0 END)`. En SQLite el campo es `indemnity_amount_cents`, así que usar una consulta distinta por dialecto (`db.dialect`) devolviendo `{ total: number, open: number, reserved_amount: "15950.00" }`; en Postgres mantener la consulta actual sin cambios para evitar regresiones. En SQLite convertir `total`/`open` a número entero y el monto con `fromCents`.
  - `createClaim`: `SELECT * FROM policies WHERE id = $1` (portable). `const indemnity = Number(input.claimed_amount) - Number(policy.deductible)` se mantiene. Convertir a centavos solo al escribir en SQLite (`toCents`). `INSERT ... RETURNING id`: Postgres soporta `RETURNING`; SQLite ≥3.35 también y `better-sqlite3` lo admite con `.all()`, por lo que se mantiene (verificar durante la implementación la versión de SQLite embebida). `now()`/defaults los cubre el esquema. La transacción pasa a `db.transaction(async (tx) => {...})`; `getClaimById` se invoca después del commit, como ahora.
  - `transition`: `SELECT status FROM claims WHERE id = $1 FOR UPDATE` → el adaptador SQLite elimina ` FOR UPDATE`. El `UPDATE` usa `$1::varchar`, `CASE WHEN $1::varchar = 'REJECTED' THEN now() ...` y `updated_at = now()`. Reescribir con un parámetro auxiliar por dialecto: Postgres mantiene la consulta actual tal cual; SQLite usa `strftime('%Y-%m-%dT%H:%M:%fZ','now')`. Resolver mediante un helper `db.sql.now()` (devuelve `now()` o la expresión de SQLite) y pasar el estado dos veces (`$1`, `$2`) para evitar reutilizar placeholder con cast. El INSERT en `claim_audits` es portable. Resultado: mismo estado, `closed_at` solo en REJECTED (igual que hoy), `updated_at` actualizado, auditoría en la misma transacción.
  - `processClaimLegacy`: es solo consulta + `console.log`. Cambiar solo `pool.query` → `db.query`. Mantener `console.log` con PII, `catch (e) {}` vacíos, variables sin usar, anidación. La consulta es `SELECT c.*, p.national_id, p.policy_number, p.email, p.status AS policy_status ...` (portable; `c.*` incluye `reopen_count`).

  `backend/src/controllers/*.ts`, `backend/src/routes/*.ts`, `backend/src/middleware/*.ts`: sin cambios (verificado por lectura que no tocan BD). `swagger.ts`: solo el ejemplo de `reserved_amount` (paso 12).

  `backend/src/server.ts`: cambiar `waitForDb()` por `await db.init()` (mantener `waitForDb` exportado como alias para no romper nada); imprimir un mensaje en español con el motor activo (`Motor de BD: sqlite|postgres`) sin rutas con credenciales ni `DATABASE_URL`.

  Archivos: `backend/src/services/claims.service.ts`, `backend/src/services/policies.service.ts`, `backend/src/server.ts`, `backend/src/config/db.ts` (ajustes de dialecto), `backend/src/types/index.ts` (solo si hace falta).
  Verificar: `npm run build` en backend; luego `grep -rnE "console\.(log|error)" backend/src` y confirmar que no se añadió logging nuevo con PII (los de `processClaimLegacy` ya existentes se mantienen a propósito).

- [ ] 8. **`backend/package.json`.** Añadir `better-sqlite3` pinneado y `@types/better-sqlite3` pinneado (dev), `engines: { node: ">=22" }`, scripts `db:reset` (`DB_CLIENT=sqlite tsx scripts/db-reset.ts`; sin sintaxis bash de variables en línea: usar `cross-env` pinneado o hacer que el script TS fije `process.env.DB_CLIENT` antes de importar, preferible sin dependencia extra) y `start:sqlite`/`dev:sqlite` si ayuda al script raíz. Regenerar `package-lock.json` con `npm install`.
  Archivos: `backend/package.json`, `backend/package-lock.json`, `backend/scripts/db-reset.ts` (borra `backend/data/claimshield.db` y sus `-wal`/`-shm`, recrea y resiembra, imprime resultado en español).
  Verificar: `cd backend && npm install && npm run build && npm run db:reset` termina con código 0 y crea el archivo con 8 siniestros.

- [ ] 9. **Dockerfile del backend y modo Docker sin regresiones.** `better-sqlite3` pasa a `dependencies`, por lo que `npm ci --omit=dev` en `node:22-alpine` lo instalará. Requiere verificación durante la implementación: que exista binario precompilado musl para alpine (si no, la imagen fallaría al compilar). Si no hay prebuild musl, mover `better-sqlite3` a `optionalDependencies` (con carga dinámica ya prevista en `db.ts`) para que Docker no se rompa, o cambiar la imagen a `node:22-slim`. Decidir según resultado y documentarlo en `verification-sqlite.md`. Añadir `DB_CLIENT: postgres` en `docker-compose.yml` (servicio `backend`). No cambiar healthchecks, volúmenes ni puertos. `db/init.sql` no se modifica.
  Archivos: `backend/Dockerfile` (solo si hace falta), `docker-compose.yml`.
  Verificar: `docker compose config -q` sin errores; en el paso 15 la imagen construye y los 3 servicios quedan `healthy`.

- [ ] 10. **Frontend: proxy de Vite y variable de API.** En `frontend/vite.config.ts` añadir `server.proxy` de `/api` → `http://localhost:3000` y un fallback para que `client.ts` use ruta relativa cuando `VITE_API_URL` no esté definida en modo local. Para no alterar Docker, `docker-compose.yml` ya pasa `VITE_API_URL` como build arg (el modo Docker sigue usando URL absoluta). Cambiar en `frontend/src/api/client.ts` `API_URL = import.meta.env.VITE_API_URL ?? ''` solo si la verificación confirma que el proxy funciona y que Docker (con `VITE_API_URL` definido) mantiene su comportamiento. Alternativa más segura y elegida: dejar `client.ts` como está (default `http://localhost:3000`, CORS ya habilitado) y añadir proxy solo como respaldo; decisión: **no modificar `client.ts`** para minimizar riesgo (el backend local en 3000 con CORS abierto funciona sin configuración). Añadir `strictPort: true` en `vite.config.ts` para que falle claramente si 5173 está ocupado en lugar de saltar de puerto.
  Archivos: `frontend/vite.config.ts`.
  Verificar: `cd frontend && npm run build`; con `npm start` el dashboard en `http://localhost:5173` carga datos (paso 15).

- [ ] 11. **Scripts raíz.** Crear `/package.json` (`"private": true`, `"engines": { "node": ">=22" }`, sin dependencias de runtime; tipo `module`) con scripts:
  - `start`: `node scripts/start.mjs`
  - `setup`: `node scripts/start.mjs --setup-only`
  - `dev`: `node scripts/start.mjs --dev`
  - `db:reset`: `npm --prefix backend run db:reset`
  - `docker:up`: `docker compose up --build`
  - `docker:down`: `docker compose down`
  - `test`: `npm --prefix backend test`
  - `build`: `npm --prefix backend run build && npm --prefix frontend run build`

  Crear `scripts/start.mjs` (Node puro, sin bash, usa `child_process.spawn` con `shell: process.platform === 'win32'` para resolver `npm.cmd`):
  1. Comprueba versión de Node ≥ 22; si no, mensaje claro y `exit 1`.
  2. Si falta `backend/node_modules` o `frontend/node_modules`, ejecuta `npm install` (o `npm ci` si hay lockfile) en cada uno con prefijo en la salida.
  3. Comprueba que los puertos 3000 y 5173 están libres con `net.createServer().listen` (probar `127.0.0.1` y `::`); si no, mensaje en español indicando cómo liberar el puerto (`lsof -i :3000` / `netstat -ano | findstr :3000`) o usar `BACKEND_PORT`/`FRONTEND_PORT`, y `exit 1`.
  4. Lanza backend (`npm run dev` en backend en modo `--dev`; en modo normal `npm run build` + `npm start` o `tsx src/server.ts`, elegir lo más rápido y confiable: `tsx src/server.ts`) con `DB_CLIENT=sqlite` y `PORT`, y frontend (`npm run dev` en frontend) con salida prefijada `[api]`/`[web]` (colores ANSI opcionales), sin dependencia `concurrently`.
  5. Espera `GET /api/health` (reintentos) y entonces imprime en consola un cuadro con URLs: Frontend `http://localhost:5173`, API `http://localhost:3000`, Swagger `http://localhost:3000/api-docs`, y el aviso del archivo `backend/data/claimshield.db`.
  6. Maneja `SIGINT`/`SIGTERM` terminando ambos procesos hijos (en Windows con `taskkill /pid <pid> /T /F`; en POSIX `process.kill(-pid)` o `kill` del hijo) y si uno muere, termina el otro.

  Archivos: `/package.json`, `scripts/start.mjs`.
  Verificar: ver paso 15 (flujo completo). Antes: `node --check scripts/start.mjs`.

- [ ] 12. **Swagger y ejemplo de stats.** Cambiar en `backend/src/config/swagger.ts:81` el ejemplo de `reserved_amount` a `'15950.00'` (confirmar con `/api/claims/stats` en ambos modos; si el valor real difiere, usar el real). No cambiar nada más en Swagger.
  Archivos: `backend/src/config/swagger.ts`.
  Verificar: `npm run build` en backend y `curl http://localhost:3000/api-docs.json` muestra el ejemplo nuevo.

- [ ] 13. **Tests sin Docker.** Configurar `backend/vitest.config.ts` con `test.env = { DB_CLIENT: 'sqlite', SQLITE_PATH: ':memory:' }` (o archivo temporal en `os.tmpdir()`), manteniendo `tests/health.test.ts` y ampliándolo mínimamente con un caso `GET /api/claims` que verifica `success: true` y 8 elementos (smoke del adaptador; **no** probar indemnizaciones negativas, vigencia ni PII). Verificar que `npm test` en la raíz funciona sin Postgres ni Docker.
  Archivos: `backend/vitest.config.ts`, `backend/tests/health.test.ts`.
  Verificar: `npm test` desde la raíz: todo en verde.

- [ ] 14. **Ignorados, entorno y Sonar.** Actualizar:
  - `.gitignore`: añadir `backend/data/`, `*.db`, `*.db-wal`, `*.db-shm`, `*.sqlite`.
  - `.dockerignore` y `backend/.dockerignore`: añadir `backend/data`, `data`, `*.db*`.
  - `.env.example`: añadir `DB_CLIENT` (comentado: `postgres` en Docker, `sqlite` en `npm start`), `SQLITE_PATH`, `PORT`, y aclarar que `npm start` ignora las variables de Postgres.
  - `sonar-project.properties`: añadir a `sonar.exclusions` `backend/data/**,**/*.db` (y `scripts/**` si se quiere excluir; mantener `scripts/start.mjs` fuera de `sources`, que ya son `backend/src,frontend/src`).
  Verificar: `git status --short --ignored backend/data` muestra la carpeta como ignorada tras el primer arranque.

- [ ] 15. **README y Kiro.** Reescribir "Inicio rápido" en `README.md`: **Opción A: Cero-Instalación (recomendado, solo Node.js ≥ 22)** con `npm start`, **Opción B: Docker** con `docker-compose up --build` (y `npm run docker:up`); tabla comparativa (requisitos, BD, tiempo de arranque, persistencia, reset, puertos); requisitos de Node (≥22, motivo `better-sqlite3`); solución de problemas (puerto ocupado, `npm run db:reset`, Windows: usar PowerShell/cmd sin bash, antivirus/ruta con espacios, `npm install` sin compilar), aclaración de que Swagger/Postman usan `http://localhost:3000` y SonarQube corre aparte (`sonar-scanner` con `sonar-project.properties`) igual en ambos modos. Actualizar estructura del repo (`scripts/`, `db/sqlite/`, `backend/data/`), tabla de scripts raíz y sección "Desarrollo local". Mantener intactos los tickets BUG-101, BUG-102, SEC-103, BUG-104 y FEAT-201 (NO implementado); ajustar los ejemplos de FEAT-201 para que el éxito use un siniestro recién creado y rechazado/cerrado (las semillas superan 30 días desde el cierre), añadiendo una nota con los pasos exactos (crear siniestro, rechazarlo, reabrir) y mantener el caso del siniestro semilla como ejemplo del error 422 de plazo. Actualizar `.kiro/steering/insurance-domain.md`: línea 10 pasa a "`NUMERIC(12,2)` en PostgreSQL; en SQLite se guardan como centavos enteros (`*_cents`) y siempre se exponen como string decimal; nunca float en ninguno de los dos motores". En `.kiro/workflows/design-and-build-endpoint.md` (paso 2, línea ~11) y `.kiro/workflows/fix-bug-ticket.md` (si menciona esquema): los cambios de esquema se aplican en AMBOS lugares (`db/init.sql` + migración, y `db/sqlite/schema.sql` + `db/sqlite/seed.sql`) y se prueban en ambos motores. **Nota:** la regla de workspace `insurance-domain` y los steerings deben quedar coherentes entre sí.
  Archivos: `README.md`, `.kiro/steering/insurance-domain.md`, `.kiro/workflows/design-and-build-endpoint.md`, `.kiro/workflows/fix-bug-ticket.md`.
  Verificar: relectura del README con los comandos reales ejecutados en el paso 16.

- [ ] 16. **Verificación obligatoria y reporte.** Escribir resultados (con comandos y salidas resumidas) en `/Users/ruthardon/Documents/Proyectos/Kiro Workshop/workshop-kiro-practice/.agents/tasks/verification-sqlite.md`:
  a. **Cero-Instalación en limpio:** borrar `backend/node_modules`, `frontend/node_modules` y `backend/data`; `npm start` desde la raíz en segundo plano; esperar. Comprobar con `curl`: `/api/health`, `/api/claims` (8), `/api/claims/stats`, `/api/policies/1` (PII en claro), `/api-docs/` (200), `http://localhost:5173` (200). Reproducir BUG-101 (POST con `claimed_amount` < deducible → indemnización negativa string `"-700.00"`), BUG-102 (póliza 5/6 EXPIRED y `incident_date` fuera de rango → 201), SEC-103 (`national_id`, `phone`, `email` sin máscara y `processClaimLegacy` imprime PII en consola del backend), BUG-104 (Playwright si está disponible: aprobar un siniestro OPEN y comprobar que el KPI no cambia hasta recargar). Verificar en SQLite que approve y reject insertan filas en `claim_audits` (consulta directa con `better-sqlite3`/`node -e` o `sqlite3` si existe) y que un segundo approve devuelve 409. Probar también puerto ocupado (levantar un `nc -l 3000` y comprobar el mensaje) y `npm run db:reset`. Detener los procesos lanzados (comprobar con `lsof -i :3000 -i :5173` que quedan libres) y limpiar `backend/data` y cualquier temporal.
  b. `npm run build` en backend y frontend; `npm test` en la raíz.
  c. **Modo Docker:** `docker compose config -q`; si Docker está disponible, `docker compose up --build -d`, comprobar `docker compose ps` (3 servicios healthy), mismos endpoints y bugs sobre Postgres, luego `docker compose down`. Si no está disponible, decirlo explícitamente.
  d. **Comparación entre modos:** con la misma semilla, comparar `/api/claims`, `/api/claims/1`, `/api/policies`, `/api/policies/1` y `/api/claims/stats` entre SQLite y Postgres (por ejemplo con `jq -S` y `diff`, ignorando solo `created_at`/`updated_at` si hay diferencias de zona documentadas): mismas claves, mismo orden de filas, montos string decimal con 2 decimales, fechas con el mismo formato. Anotar cualquier diferencia y corregirla en `db.ts`.
  e. `grep -rnE "BUG-|SEC-" backend/src frontend/src scripts` sin resultados (no se delatan los bugs); revisar `grep -rnE "console\.(log|error)" backend/src scripts` para confirmar que el único logging de PII sigue siendo el de `processClaimLegacy` (intencional) y que no se añadió logging nuevo con PII.

## Riesgos y puntos "requiere verificación durante la implementación"

- Binario precompilado de `better-sqlite3` para Node 26 / Node 22 y para `node:22-alpine` (musl): no verificado aún.
- Forma exacta de `DATE`/`TIMESTAMPTZ` en las respuestas de Postgres (objeto `Date` serializado): no verificado; condiciona decisión 5.
- Versión de SQLite embebida soporta `RETURNING` (≥3.35) y `FILTER` (≥3.30): requiere verificación.
- Reutilización del mismo placeholder (`$1` repetido) en la traducción a SQLite: requiere pruebas del adaptador.
- Terminación de procesos hijos en Windows desde `start.mjs`: no se puede probar en esta máquina (macOS); documentar como no verificado en Windows y revisar a mano el uso de `taskkill` y `shell: true`.
- Modal y filtros del frontend siguen sin verificación en navegador salvo que el coder los ejercite con Playwright.
- Fuera de alcance (no tocar): corrección de los 4 bugs, implementación de FEAT-201, trampa de foco del modal, validación de fechas calendario inválidas (`2025-02-30`; en SQLite se guardaría sin error mientras Postgres respondería 500: diferencia conocida, documentarla en `verification-sqlite.md` si aparece).

## Estructura del trabajo

El trabajo es un único cambio acoplado (la capa `db.ts` condiciona servicios, tests, scripts y docs), por lo que **no se descompone en FEATs separados**: lo implementa el bucle `build-loop` existente. Contrato conservado: el revisor, último paso del bucle, escribe `/Users/ruthardon/Documents/Proyectos/Kiro Workshop/workshop-kiro-practice/.agents/tasks/review-sqlite.json` con `verdict == "APPROVED"` para terminar.
