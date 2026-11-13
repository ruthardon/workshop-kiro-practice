# Verificación: Modo Cero-Instalación (SQLite) + Docker opcional

Primera iteración (no existía `review-sqlite.json`). Máquina: macOS, Node v26.12.0 (también probado `better-sqlite3` con Node v22.23.5), npm 11.20.

## Decisiones y hallazgos
- **Driver:** `better-sqlite3` 13.1.1 pinneado (SQLite 3.54.1 embebida: soporta `RETURNING`). `engines.node >=22` en `/package.json` y `backend/package.json`. Trae binarios precompilados dentro del paquete (darwin, linux, linuxmusl, win32), sin descarga ni compilación.
  - Prueba en directorio temporal (borrado): `npm install better-sqlite3` instaló en ~1 s; `select 1` OK con Node 26 y con Node 22.
  - **Hallazgo en Docker:** `node:22-alpine` trae npm 10.9, que detecta `binding.gyp` y ejecuta `node-gyp rebuild` (falló: "Could not find any Python"). Solución: `--ignore-scripts` en el `Dockerfile` (ambas etapas), en `scripts/start.mjs` y `backend/.npmrc` (`ignore-scripts=true`). Tras el cambio la imagen construye y arranca.
- **Dinero en SQLite:** centavos enteros (`*_cents`); `backend/src/utils/money.ts` (`toCents`, `fromCents`, `roundMoney`) sin aritmética flotante. La API devuelve string decimal.
- **Fechas:** se capturó la forma real de Postgres (`DATE` → `2025-08-10T00:00:00.000Z`, `TIMESTAMPTZ` → ISO con ms). SQLite la imita; Postgres no se modificó.
- **Bugs:** sin `CHECK` de indemnización ni validación de vigencia en SQLite ni en `init.sql` (`db/init.sql` sin cambios). `processClaimLegacy` solo cambió `pool.query` → `db.query`.

## Comandos y resultados
(a) Cero-Instalación en limpio (`rm -rf backend/node_modules frontend/node_modules backend/data`; `npm start`, repetido dos veces):
- Instala ambas carpetas, crea `backend/data/claimshield.db` y muestra el cuadro con URLs. `/api/health` ok; `/api/claims` → 8 siniestros; `/api/claims/stats` → `{"total":8,"open":3,"reserved_amount":"15950.00"}`; `/api/policies/1` con `national_id`, `phone`, `email` en claro; `/api-docs/` 200; frontend `:5173` 200 (el proxy `/api` de Vite también responde).
- BUG-101: póliza 3 (deducible 1000), reclamado 300 → `indemnity_amount "-700.00"` (y `indemnity_amount_cents = -70000` en la BD). BUG-102: póliza 5 `EXPIRED` → 201; póliza 1 con `incident_date 2020-01-01` → 201. SEC-103: PII en claro; `POST /api/claims/3/legacy-process` imprime en consola `Procesando siniestro ...` con datos de la póliza (log preexistente e intencional).
- BUG-104 (Playwright): KPIs iniciales Total 8, Reservado US$ 15.950,00, Abiertos 3. Tras aprobar el siniestro 3 la fila pasa a "Aprobado" pero los KPIs siguen igual, mientras `/api/claims/stats` devuelve `open 2` y `reserved_amount 23450.00`. Reproducido. El modal de nuevo siniestro no se ejercitó en navegador.
- Auditoría en SQLite: approve (id 1) y reject (id 2) con `x-user: tester` dejaron filas `OPEN→APPROVED` y `OPEN→REJECTED` en `claim_audits`; segundo approve → `409 INVALID_STATE_TRANSITION`; reject fija `closed_at`.
- Puerto ocupado (3000 abierto con un proceso Python): `npm start` imprime el aviso en español y sale sin lanzar nada. (Un primer intento con `nc` colgó por la comprobación original, que solo probaba `::`; se corrigió probando 127.0.0.1, 0.0.0.0 y `::`.)
- `npm run db:reset` → "Base de datos SQLite recreada con 8 siniestros de ejemplo."
- `Ctrl+C` (SIGINT) a `npm start` libera 3000 y 5173 (`lsof` sin resultados). Datos temporales (`backend/data`, `dist`) eliminados; `backend/data` está ignorado en `.gitignore`.

(b) `npm run build` (backend `tsc` y frontend `tsc + vite build`) OK. `npm test` → 2 tests pasan (health y `GET /api/claims` con 8 elementos), SQLite en memoria, sin Docker. Sin tests de los bugs.

(c) Docker: `docker compose config -q` OK. `docker compose up --build -d`: `db`, `backend`, `frontend` quedaron `healthy`. En Postgres: BUG-101 `"-700.00"`, BUG-102 201, `national_id` en claro, approve/reject registraron `claim_audits` (consulta con `psql`), `/api-docs/` 200, frontend 200. Luego `docker compose down -v` (volumen de prueba propio).

(d) Comparación (BD con la misma semilla, sin mutaciones): `/api/claims`, `/api/claims/1` y `/api/claims/stats` son idénticos entre Postgres y SQLite (`diff` de JSON formateado; mismas claves, orden y valores, montos string decimal). `/api/policies` y `/api/policies/1` solo difieren en `created_at` (en las pólizas es `now()` del momento de creación, no está en la semilla). El formato de `/api/claims` también coincidió con la línea base de Postgres capturada antes de tocar el código.

(e) Búsquedas: `grep -rnE "BUG-|SEC-" backend/src frontend/src scripts` sin resultados. `console.log/error` con PII: solo los dos de `processClaimLegacy` (preexistentes, intencionales); el código nuevo (`db.ts`, `money.ts`, `server.ts`, `scripts/*`, `db-reset.ts`) registra solo motor de BD, puerto, conteos y mensajes de error sin parámetros.

## No verificado
- Windows (`taskkill`, `npm.cmd` con `shell: true`): código revisado, no ejecutado en esta máquina.
- npm 10 fuera de Docker: cubierto indirectamente por la build de `node:22-alpine` (npm 10.9.9), no con `npm start` bajo Node 22 local.
- SonarQube real, ejecución de hooks de Kiro, modal y filtros en navegador.
- Diferencia conocida: una fecha calendario inválida (`2025-02-30`) se guarda sin error en SQLite, mientras Postgres respondería 500.
