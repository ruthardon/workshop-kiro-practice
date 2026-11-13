# Modo Cero-Instalación (SQLite) con capa de BD dual y Docker opcional

El cambio añade `npm start` desde la raíz: instala dependencias, levanta backend (SQLite, `better-sqlite3` 13.1.1) y frontend, y muestra las URLs. Docker + PostgreSQL se conserva con `DB_CLIENT=postgres` fijado en compose. Los servicios usan un único `db` con SQL portable (placeholders `$n`) y un adaptador por motor. Los 4 bugs intencionales siguen presentes en ambos motores y la evidencia de verificación contiene ejecuciones reales.

Watch for: (1) `SQLITE_PATH` relativo en `.env.example` se resolvería contra el cwd del backend (possible, no bloqueante); (2) diferencias menores de dialecto no cubiertas (fechas calendario inválidas, `incident_date` con hora) (confirmed, documentadas en parte).

**Verdict**: APPROVED

## High-level view

La capa `db.ts` expone `query`/`transaction`/`init` y traduce `$n`→`?`, elimina `FOR UPDATE`, convierte `*_cents` a string decimal y las fechas DATE a la forma ISO que devuelve `pg`. Las transacciones SQLite usan `BEGIN IMMEDIATE` sobre una cola única, de modo que cambio de estado y `claim_audits` siguen siendo atómicos. Los servicios solo cambiaron `pool`→`db` y fragmentos de dialecto; la fórmula `claimed - deductible` sin validación, la ausencia de validación de vigencia, la PII sin enmascarar en `getPolicyById` y `processClaimLegacy` (anidación, variables sin usar, `console.log` con PII, `catch {}`) permanecen. El KPI de frontend (BUG-104) no se tocó y se reprodujo con Playwright. Docker no tiene regresiones de configuración y se verificó con `up --build` y comparación de JSON entre motores.

<details>
<summary>Issues (3)</summary>

1. **Ruta relativa de SQLITE_PATH** — `.env.example` sugiere `backend/data/claimshield.db`, que `env.ts` pasaría tal cual (relativa al cwd `backend/`) y crearía `backend/backend/data`. Usar `data/claimshield.db` o resolver contra la raíz (possible, no bloqueante).
2. **`incident_date` con hora en SQLite** — `normalizeRow` solo normaliza valores de 10 caracteres; una fecha con hora se guardaría y devolvería distinta que en Postgres (likely, menor).
3. **Fecha calendario inválida** — `2025-02-30` se acepta en SQLite y da 500 en Postgres; ya declarado en verificación, mantener documentado (confirmed, menor).

</details>

<details>
<summary>Details</summary>

### Bugs intencionales intactos en ambos motores

`createClaim` mantiene `Number(claimed) - Number(deductible)` y lo persiste (en SQLite vía `toCents`, que acepta negativos): la verificación muestra `"-700.00"` / `-70000` centavos. No hay `CHECK` sobre indemnización ni validación de vigencia en `schema.sql` ni `init.sql` (solo los `CHECK` de `status` ya existentes). `getPolicyById` devuelve la fila completa sin máscara. `processClaimLegacy` solo cambió `pool.query` a `db.query`. `grep BUG-|SEC-` en `src` sin resultados y no hay comentarios que delaten los bugs. BUG-104 reproducido en navegador (KPIs fijos tras aprobar, `/stats` ya cambiado).

### Equivalencia de respuestas y dialecto

`getStats` usa consulta distinta por motor; la de Postgres queda sin cambios. La verificación diffeó `/claims`, `/claims/1`, `/claims/stats` idénticos y `/policies` solo con `created_at` distinto (no está en la semilla). Placeholders repetidos se manejan duplicando valores. El `UPDATE` de `transition` usa `dialectSql.varchar` y `now` sin duplicar placeholders. Riesgo residual: `incident_date` con hora y fechas inválidas.

### Arranque multiplataforma

`start.mjs` es Node puro (`shell: true` en Windows, `taskkill`, `process.kill(-pid)` en POSIX), valida Node ≥22, detecta puertos ocupados en tres hosts, imprime URLs y tira ambos procesos si uno muere. Windows no se ejecutó (declarado). Vite añade proxy `/api` y `strictPort`; `client.ts` conserva la URL absoluta.

### Docs, Kiro y tests

README con Opción A/B, tabla comparativa, requisitos y troubleshooting; steering `insurance-domain.md` y ambos workflows apuntan a los dos esquemas. `reserved_amount` de Swagger es `15950.00`, coincidente con la semilla. FEAT-201 sigue sin implementar. Los tests (health y listado de 8) corren con SQLite en memoria y no cubren los bugs. El código nuevo no loguea PII ni usa aritmética flotante nueva sobre montos (la única es la del bug preexistente). Los dos `console.log` de PII son los intencionales de `processClaimLegacy`.

### Evidencia

`verification-sqlite.md` contiene salidas reales (limpio dos veces, build, tests, Docker healthy, diffs entre motores) y declara no verificado: Windows, npm 10 local, SonarQube/hooks, modal y filtros.

</details>

<details>
<summary>Mapa de archivos</summary>

- `backend/src/config/{db,env}.ts`: capa dual y selección de motor
- `backend/src/utils/money.ts`: centavos y redondeo único
- `backend/src/services/*`: migrados a `db`
- `db/sqlite/{schema,seed}.sql`: esquema y semilla SQLite
- `scripts/start.mjs`, `package.json`, `backend/scripts/db-reset.ts`: arranque y reset
- `docker-compose.yml`, `backend/Dockerfile`, `backend/.npmrc`: DB_CLIENT y `--ignore-scripts`
- `README.md`, `.kiro/*`, `.env.example`, `.gitignore`, `.dockerignore`, `sonar-project.properties`: docs y config

</details>
