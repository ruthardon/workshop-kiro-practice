# Verificación (iteración 1)

Docker estaba instalado pero el daemon apagado; lo inicié con `open -a Docker` y quedó disponible.

## Ejecutado y resultados
- backend: `npm install`, `npm run build` (tsc) y `npm test` (vitest, 1 test health): OK.
- frontend: `npm install` y `npm run build` (tsc + vite): OK (tras corregir un `\;` espurio en client.ts).
- `docker compose config -q`: OK (tras corregir YAML de healthchecks).
- `docker compose up --build -d`: db, backend y frontend `healthy`.
  - Hallazgos corregidos durante la verificación: (1) frontend con usuario `node` no podía escribir en /app ni node_modules (Dockerfile ajustado: instalar como `node`); (2) approve/reject devolvían 500 por tipos de parámetro ambiguos en el UPDATE (cast `::varchar`).
- curl: `/api/health` ok; `/api/claims` ok (enmascara policy_number); `/api/claims/stats` ok; `/api-docs/` 200; `/api-docs.json` lista todos los endpoints; frontend `HTTP 200`.
- BD: 6 pólizas; claims 3 OPEN / 2 APPROVED / 2 REJECTED / 1 CLOSED; audits seed.
- Bugs reproducidos: BUG-101 (indemnity `-700.00` con claimed 300, deducible 1000), BUG-102 (póliza EXPIRED → 201; incident_date 2020-01-01 → 201), SEC-103 (`GET /api/policies/1` devuelve national_id, phone y email en claro; `processClaimLegacy` accesible vía `POST /api/claims/:id/legacy-process`), listado `/api/policies` sí enmascarado.
- Flujos correctos: approve y reject crean filas en `claim_audits` (changed_by desde `x-user`); segundo approve → 409; id inexistente → 404; `?status=BAD` → 400.
- Playwright: dashboard carga con KPIs (Total 8, Reservado US$ 17.500, Abiertos 1), tabla, filtros y botones. Al aprobar el siniestro 3 el badge cambió a "Aprobado" pero el KPI siguió en 17.500 / 1 mientras `/api/claims/stats` devolvía 25000.00 / 0: BUG-104 reproducido. El modal de nuevo siniestro no se ejercitó en el navegador (solo el endpoint por curl).
- `docker compose down -v` ejecutado (entorno de prueba propio; BD vuelve a datos semilla al siguiente `up`).
- `grep -rnE "BUG-|SEC-" backend/src frontend/src`: sin resultados.
- Limpieza: eliminados `backend/dist` y `frontend/dist`. Sin commits.

## No verificado
- sonar-scanner / SonarQube real, ni la ejecución de hooks y workflows de Kiro.
- Modal "Reportar siniestro" y filtros en navegador (solo snapshot inicial).
