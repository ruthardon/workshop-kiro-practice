# Repositorio base ClaimShield con 4 bugs intencionales

El repo cubre el brief: Docker con 3 servicios, esquema y semillas, backend Express/TS con Swagger y formato `{ success, data, error }`, dashboard React, configuración `.kiro/` y README con backlog y FEAT-201 (sin implementar). Los 4 problemas pedidos existen y son reproducibles según `verification.md`. No encontré bugs adicionales en los demás flujos ni comentarios que delaten los bugs en `backend/src` o `frontend/src`. Las observaciones restantes son menores y no bloquean el workshop.

Watch for: la evidencia de navegador no cubre el modal ni los filtros (confirmed, solo se leyó el código); los registros semilla `REJECTED`/`CLOSED` no se pueden reabrir en FEAT-201 por la ventana de 30 días (confirmed).

**Verdict**: APPROVED

## High-level view

La infraestructura es coherente: `db` con volumen `pgdata` y `init.sql` montado en `docker-entrypoint-initdb.d`, `backend` y `frontend` con healthchecks y `depends_on` por salud. Puertos 5432, 3000 y 5173. Las semillas son consistentes (indemnización = reclamado - deducible en los 8 siniestros, fechas dentro de vigencia, audits coherentes con cada estado).

Los bugs están implementados de forma natural. BUG-101 y BUG-102 viven en `createClaim` y en el controlador sin ninguna validación de vigencia. SEC-103 está en `getPolicyById` (devuelve la fila completa, mientras `listPolicies` sí enmascara) y en `processClaimLegacy`, expuesta por `POST /api/claims/:id/legacy-process`. BUG-104 es el estado de KPIs cargado una vez en `useClaims`, mientras approve/reject solo reemplazan la fila.

Los flujos sanos (approve/reject con transacción y auditoría, 404/409/400, filtros, `errorHandler`) cumplen los steerings. La configuración de Kiro y el README son completos y en español.

<details>
<summary>Issues (4)</summary>

1. **Ejemplo de reapertura inalcanzable con semillas** — el request de ejemplo de FEAT-201 usa el siniestro 6 (`closed_at` 2025-07-15), que supera los 30 días; aclarar en el README que el éxito requiere rechazar/cerrar un siniestro recién creado. No bloqueante.
2. **Modal y filtros sin verificación en navegador** — `verification.md` lo declara; el código tiene labels, `role="dialog"`, `aria-modal`, foco inicial y Escape. Falta trampa de foco (Tab sale del modal) y restaurar el foco al cerrar. No bloqueante.
3. **Ejemplo Swagger de `ClaimStats`** — `reserved_amount: '16550.00'` no coincide con la semilla (15950.00). Cosmético.
4. **Fecha calendario inválida** — `incident_date` como `2025-02-30` pasa la validación de formato del controlador y puede acabar en 500 desde Postgres (likely, no ejecutado). Menor; no es uno de los 4 bugs pedidos pero podría confundir.

</details>

<details>
<summary>Details</summary>

## Verificación de requisitos del brief

Docker: `docker-compose.yml` define `db` (postgres:16-alpine, `pg_isready`, volumen nombrado `pgdata`, `init.sql` montado de solo lectura), `backend` (healthcheck con fetch a `/api/health`) y `frontend` (wget a 5173), con puertos y variables vía `.env.example`. `.gitignore` incluye `node_modules`; existen `.dockerignore` raíz y por paquete. `sonar-project.properties` está en la raíz con `projectKey=claimshield`, fuentes `backend/src,frontend/src`, exclusiones, lcov y host `http://localhost:9000`.

Base de datos: tablas `policies`, `claims` y `claim_audits` con los campos pedidos y `NUMERIC(12,2)`. Hay 6 pólizas (4 activas con deducibles 250/500/1000/2000 y 2 expiradas) y 8 siniestros: 3 OPEN, 2 APPROVED, 2 REJECTED y 1 CLOSED. Las auditorías seed siguen las transiciones de cada estado y la creación `NULL -> OPEN`.

Backend: endpoints health, policies, policies/:id, claims (filtro `status`), stats, claims/:id, POST, approve, reject y legacy-process, todos con `@openapi` y esquemas reutilizables en `swagger.ts`. `AppError` + `errorHandler` + `notFound` centralizan errores; `ok()` produce el sobre. Approve/reject usan `SELECT ... FOR UPDATE`, UPDATE y audit en una transacción, y `x-user` define `changed_by`. Solo existe `tests/health.test.ts`, sin cobertura de los bugs. FEAT-201 no está implementado (solo columnas y la mención en `processClaimLegacy` de `reopen_count`).

Frontend: tres KPI (Total Siniestros, Monto Reservado, Siniestros Abiertos), tabla con selector de estado y búsqueda, badges coloreados, botones Aprobar/Rechazar solo en filas OPEN con `aria-label`, y modal con labels, `role="dialog"`, `aria-modal`, `aria-labelledby`, foco inicial y cierre con Escape.

Kiro: tres steerings con `inclusion: always`, dos hooks `v1` con `PostFileSave` y matchers correctos, y los dos workflows con los pasos Draw.io, BD, implementación, Swagger, Postman y SonarQube, y el de bug con test-first y checklist.

## Los cuatro bugs y ausencia de otros

BUG-101: `createClaim` calcula `Number(claimed) - Number(deductible)` y lo persiste sin tope ni piso (confirmed). BUG-102: ni el controlador ni el servicio miran `status` ni el rango de fechas (confirmed). SEC-103a: `getPolicyById` devuelve `SELECT *` sin máscara (confirmed). SEC-103b: `processClaimLegacy` tiene `if/else` anidados a 5 niveles, `flag`, `temp` y `counter` sin uso, `console.log` con `national_id`, `policy_number` y `email`, y dos `catch (e) {}` vacíos (confirmed); el `tsconfig` tiene `noUnusedLocals: false` y la función se invoca desde la ruta. BUG-104: confirmed en `useClaims` (`stats` solo se asigna en el efecto inicial y en `create`). `grep` de `BUG-|SEC-|FEAT` en código fuente, `db` y compose no devuelve resultados.

El resto de flujos es correcto. El rechazo fija `closed_at`, coherente con las semillas REJECTED. Los comentarios existentes en código son neutros.

## Evidencia de verificación

`verification.md` cubre builds, `docker compose config`, servicios healthy, curl a los endpoints, reproducción de los bugs y de BUG-104 con Playwright. Las cifras del navegador (17.500 y 1 abierto tras otras mutaciones, luego 25.000) son aritméticamente consistentes con las semillas. No se re-ejecutó nada. Quedan sin verificar SonarQube real, la ejecución de hooks y el modal/filtros en navegador, declarado por el coder.

</details>

<details>
<summary>File map</summary>

- `docker-compose.yml`, `.env.example`, `.gitignore`, `.dockerignore`, `sonar-project.properties`: infraestructura y Sonar.
- `db/init.sql`: esquema y semillas.
- `backend/`: API Express/TS, Swagger, errorHandler, Dockerfile y test de health.
- `frontend/`: dashboard React/Vite/Tailwind y Dockerfile.
- `.kiro/`: 3 steerings, 2 hooks, 2 workflows.
- `README.md`: inicio rápido, backlog y FEAT-201.

Diff completo: `git status` (todo sin commitear).

</details>
