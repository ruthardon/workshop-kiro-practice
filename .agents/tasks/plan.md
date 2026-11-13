# Implementation Plan — ClaimShield

Raíz: `/Users/ruthardon/Documents/Proyectos/Kiro Workshop/workshop-kiro-practice` (usar rutas absolutas; NO commits). Repo vacío salvo `.git` y `.agents/`. Entorno: Node v26.12.0, npm 11.20.0, Docker 29.9.3 disponible. Todo texto en español, identificadores en inglés. No se descompone en FEATs: el trabajo es un solo repo acoplado por contratos; se ejecuta con el loop existente (review.json APPROVED).

## Decisiones de diseño
- Backend Express + TypeScript, ejecutado en contenedor con `tsx` en dev-simple: Dockerfile multi-stage (build `tsc` -> runtime `node dist/server.js`, usuario `node`). Razón: arranque rápido, Sonar escanea TS.
- Tests backend: vitest + supertest (sin tests de los bugs). Razón: ESM/TS sin config extra.
- Montos: pg devuelve NUMERIC como string; se mantienen como string en la API (`"1500.00"`). Los bugs de aritmética usan `Number()` donde convenga (BUG-101 `Number(claimed) - Number(deductible)`).
- Frontend: Vite + React + TS + Tailwind 3 (postcss), servido con `vite --host 0.0.0.0 --port 5173` en contenedor (simple). `VITE_API_URL=http://localhost:3000` (el navegador llama al backend desde el host).
- Sin autenticación; `changed_by` = `"system"` por defecto o header `x-user` opcional.

## Árbol de archivos
```
.gitignore  .dockerignore  .env.example  docker-compose.yml  sonar-project.properties  README.md
db/init.sql
backend/{package.json,tsconfig.json,Dockerfile,.dockerignore,vitest.config.ts}
backend/src/server.ts  app.ts
backend/src/config/{db.ts,swagger.ts,env.ts}
backend/src/routes/{health.routes.ts,policies.routes.ts,claims.routes.ts,index.ts}
backend/src/controllers/{policies.controller.ts,claims.controller.ts}
backend/src/services/{policies.service.ts,claims.service.ts}
backend/src/middleware/{errorHandler.ts,notFound.ts}
backend/src/utils/{appError.ts,response.ts}
backend/src/types/index.ts
backend/tests/health.test.ts   (único test: GET /api/health; app exportada sin listen)
frontend/{package.json,tsconfig.json,vite.config.ts,tailwind.config.js,postcss.config.js,index.html,Dockerfile,.dockerignore}
frontend/src/{main.tsx,App.tsx,index.css,types.ts}
frontend/src/api/client.ts
frontend/src/components/{KpiCards.tsx,ClaimsTable.tsx,StatusBadge.tsx,NewClaimModal.tsx,Filters.tsx}
frontend/src/hooks/useClaims.ts
.kiro/steering/{insurance-domain,security-pii,api-standards}.md
.kiro/hooks/{sync-swagger-on-route-change,check-pii-on-save}.json
.kiro/workflows/{design-and-build-endpoint,fix-bug-ticket}.md
```

## Contratos

### DB (`db/init.sql`)
- `policies(id SERIAL PK, policy_number VARCHAR(30) UNIQUE, holder_name, national_id VARCHAR(20), phone VARCHAR(20), email VARCHAR(120), status VARCHAR(10) CHECK IN ('ACTIVE','EXPIRED'), start_date DATE, end_date DATE, deductible NUMERIC(12,2), coverage_limit NUMERIC(12,2), created_at TIMESTAMPTZ DEFAULT now())`
- `claims(id SERIAL PK, policy_id INT FK policies, description TEXT, incident_date DATE, claimed_amount NUMERIC(12,2), indemnity_amount NUMERIC(12,2) (SIN CHECK >= 0, para que el bug se persista), status VARCHAR(10) CHECK IN ('OPEN','APPROVED','REJECTED','CLOSED') DEFAULT 'OPEN', closed_at TIMESTAMPTZ NULL, reopen_count INT NOT NULL DEFAULT 0, created_at, updated_at)`
- `claim_audits(id SERIAL PK, claim_id INT FK, old_status NULL, new_status, changed_by, reason TEXT NULL, created_at)`
- Seeds: 6 pólizas (4 ACTIVE con deducibles 250/500/1000/2000, 2 EXPIRED con fechas pasadas), 8 siniestros (3 OPEN, 2 APPROVED, 2 REJECTED, 1 CLOSED, con `closed_at` para REJECTED/CLOSED), audits coherentes (creación null->OPEN + transición). Seeds con indemnity coherente (≥0). Siniestros OPEN con indemnity calculada igual (claimed−deductible, positiva).
- Healthcheck db: `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`; volumen nombrado `pgdata`.

### API (todas bajo `/api`, envelope `{success:boolean,data:any|null,error:null|{code,message,details?}}`)
- `GET /api/health` -> `{status:"ok"}`
- `GET /api/policies` -> lista, PII enmascarada en listado (`***-**-1234`), pero `/:id` NO (SEC-103a).
- `GET /api/policies/:id` -> póliza completa con national_id/phone/email en claro.
- `GET /api/claims?status=` -> filas con join: `id, policy_id, policy_number, holder_name, description, incident_date, claimed_amount, indemnity_amount, status, closed_at, reopen_count, created_at` (policy_number enmascarado a últimos 4 en listado). Status inválido -> 400.
- `GET /api/claims/stats` (declarar ANTES de `/:id`) -> `{total, open, reserved_amount}` (suma indemnity de APPROVED... definición fija: `reserved_amount` = suma de `indemnity_amount` de claims `APPROVED`+`OPEN`? **Decisión: suma de `indemnity_amount` de estado APPROVED**; así aprobar cambia el KPI y BUG-104 es observable).
- `GET /api/claims/:id` -> 404 `CLAIM_NOT_FOUND`.
- `POST /api/claims` body `{policy_id, description, incident_date, claimed_amount}`: 400 si faltan/mal formato; 404 si póliza no existe; 201 con claim. Registra audit (null->OPEN).
- `PATCH /api/claims/:id/approve|reject` body opcional `{reason}`: 404 si no existe; 409 `INVALID_STATE_TRANSITION` si no está OPEN; transacción (UPDATE + INSERT claim_audits). Devuelve claim actualizado.
- Errores: clase `AppError(status, code, message)`; `errorHandler` centralizado; 500 genérico sin filtrar detalles; 404 para rutas desconocidas.
- Swagger: `swagger-jsdoc` leyendo `src/routes/*.ts` (+ `dist/routes/*.js` en runtime vía glob doble), UI en `/api-docs`, JSON en `/api-docs.json`; todos los endpoints anotados con `@openapi`, schemas Claim, Policy, ApiResponse, ApiError en `config/swagger.ts`.
- CORS: `cors()` abierto.
- Env: `PORT=3000`, `DATABASE_URL=postgres://claimshield:claimshield@db:5432/claimshield`, backend `depends_on: db: condition: service_healthy`, pool con reintentos simples. Healthcheck backend: `node -e fetch('http://localhost:3000/api/health')` (o wget); frontend: wget/ node fetch a `:5173`. Frontend `depends_on` backend healthy.

### Frontend
- `api/client.ts` usa `VITE_API_URL`, desempaqueta envelope y lanza Error con `error.message`.
- `useClaims`: carga claims y stats una vez.

## Ubicación exacta de los bugs (sin comentarios delatores; solo comentarios neutros)
- **BUG-101**: `backend/src/services/claims.service.ts` `createClaim()`: `const indemnity = Number(input.claimed_amount) - Number(policy.deductible);` insertado tal cual en `indemnity_amount`; sin max(0) ni tope `coverage_limit`.
- **BUG-102**: mismo `createClaim()` y `claims.controller.ts`: solo se valida existencia de póliza y campos requeridos; no se mira `policy.status` ni `start_date/end_date` vs `incident_date`.
- **SEC-103a**: `policies.service.ts#getPolicyById` + `policies.controller.ts`: devuelve la fila completa sin enmascarar.
- **SEC-103b**: `processClaimLegacy(claimId, policyId, mode, ...)` exportada en `claims.service.ts`, ≥10 ramas if/else anidadas, variables sin usar (`const temp = ...`, `let flag`), `console.log` con `national_id`, `policy_number`, `email`, varios `catch (e) {}` vacíos; invocada desde `POST /api/claims/:id/legacy-process` (ruta anotada en Swagger) o al menos exportada y referenciada. `tsconfig`: `noUnusedLocals:false`, `noUnusedParameters:false`. Debe compilar.
- **BUG-104**: `frontend/src/hooks/useClaims.ts` / `App.tsx`: stats/KPIs obtenidos en `useEffect(..., [])` o `useState(() => computeKpis(initialClaims))` una sola vez; `handleApprove/Reject` actualiza `claims` (badge) pero no recalcula/refetch KPIs. Sin comentarios que lo revelen. Crear siniestro nuevo puede refrescar todo con normalidad (no otros bugs); el KPI "Total" y "Abiertos" deben comportarse de forma coherente con el mismo patrón sin romper la reproducción de "Monto Reservado" (documentar en README que reproducción es Aprobar y observar KPI).

## Pasos (ordenados por dependencia)

- [ ] 1. Base del repo: `.gitignore` (node_modules, dist, .env, coverage, .scannerwork), `.dockerignore`, `.env.example`, `sonar-project.properties` (projectKey=claimshield, projectName, sources=backend/src,frontend/src, exclusions `**/node_modules/**,**/dist/**,**/tests/**`, `sonar.host.url=http://localhost:9000`, `sonar.javascript.lcov.reportPaths=backend/coverage/lcov.info`, sonar.sourceEncoding=UTF-8).
  Verify: archivos presentes y legibles.
- [ ] 2. `db/init.sql` según contrato.
  Verify: tras paso 7, `docker compose exec db psql -U claimshield -d claimshield -c "select status,count(*) from claims group by 1"` muestra 3 OPEN/2 APPROVED/2 REJECTED/1 CLOSED y `select count(*) from policies` ≥ 5.
- [ ] 3. Backend: package.json (express, cors, pg, swagger-jsdoc, swagger-ui-express; dev: typescript, tsx, vitest, supertest, @types/*, versiones fijas), tsconfig, config, utils, middleware, types, rutas/controladores/servicios incluidos los 4 bugs backend, `app.ts`/`server.ts`, test de health, Dockerfile.
  Verify: `cd backend && npm install && npm run build && npm test` pasan.
- [ ] 4. Frontend: scaffold manual Vite/React/TS/Tailwind, componentes, modal accesible (labels, `role="dialog"`, `aria-modal`, foco inicial y Escape), filtros por estado + búsqueda, botones Aprobar/Rechazar solo en OPEN, badges por color, BUG-104, Dockerfile.
  Verify: `cd frontend && npm install && npm run build` pasa.
- [ ] 5. `docker-compose.yml` (db/backend/frontend, healthchecks, `pgdata`, puertos 5432/3000/5173, envs, depends_on healthy).
  Verify: `docker compose config` sin error.
- [ ] 6. `.kiro/`: 3 steerings (front-matter `inclusion: always`), 2 hooks (`{"version":"v1","hooks":[{name,trigger:"PostFileSave",matcher,action:{type:"agent",prompt}}]}`; matchers `backend/src/routes/.*\\.ts$` y `backend/src/.*\\.ts$`), 2 workflows md (pasos con entregable y criterio de salida; fix-bug con checklist).
  Verify: `node -e` parsea ambos JSON sin error; steerings con front-matter válido.
- [ ] 7. `README.md`: inicio rápido, URLs, estructura, SonarQube (sonar-scanner), powers, backlog BUG-101/BUG-102/SEC-103/BUG-104 (descripción, pasos de reproducción, esperado/actual, criterios de aceptación, powers), reto FEAT-201 (reglas, errores 404/409/422/400, request/response, casos de prueba, powers Draw.io -> Código -> Swagger -> Postman -> SonarQube). No implementar reopen.
  Verify: relectura contra brief; ningún comentario de código nombra BUG/SEC (`grep -rn "BUG-\|SEC-" backend/src frontend/src` vacío).

## Lista de verificación obligatoria
1. `npm install && npm run build` en backend y frontend; `npm test` en backend.
2. `docker compose config`.
3. `docker compose up --build -d`; los 3 servicios `healthy` (`docker compose ps`); `curl localhost:3000/api/health`, `/api/claims`, `/api/claims/stats`, `/api-docs/` (200) y `curl -I localhost:5173`.
4. Reproducir bugs: POST claim con claimed < deductible -> indemnity negativa persistida (201); POST sobre póliza EXPIRED -> 201; incident_date fuera de rango -> 201; `GET /api/policies/:id` muestra national_id/phone/email en claro.
5. Comprobar flujos correctos: approve/reject crean fila en `claim_audits`; segundo approve -> 409; id inexistente -> 404; `?status=` inválido -> 400.
6. Playwright (si disponible): KPIs, tabla, filtros, modal, y BUG-104 (aprobar OPEN: badge cambia, "Monto Reservado" no cambia hasta F5).
7. `docker compose down` (sin `-v`). Limpiar temporales; no hacer commits. Si algo no se pudo verificar, declararlo.
