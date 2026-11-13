# Verificación: 3 observaciones menores (capa dual SQLite/PostgreSQL)

## Cambios
1. `SQLITE_PATH`: en `backend/src/config/env.ts` una ruta relativa se resuelve desde la raíz del repositorio (`:memory:` y rutas absolutas pasan igual). Sin variable, el valor por defecto sigue siendo `backend/data/claimshield.db`. `.env.example` y README lo documentan; `start.mjs`, `db-reset` y `docker-compose` no necesitaron cambios.
2. y 3. `backend/src/controllers/claims.controller.ts`: `incident_date` se valida con `isRealDate` (formato `YYYY-MM-DD` estricto y fecha calendario real). Con hora o fecha inexistente responde `400 VALIDATION_ERROR` en ambos motores. Swagger de `POST /api/claims` documenta el 400. No hay otros campos de fecha en los requests.

## Verificación
- `npm run build` backend y frontend: OK. `npm test` backend: 2/2.
- SQLite (`DB_CLIENT=sqlite`, puerto 3917, `SQLITE_PATH=tmp-verify/t.db`): el archivo se creó en `<raíz>/tmp-verify` (no en `backend/backend`). `2025-02-30` → 400; `2025-03-01T10:00:00` → 400; `2025-03-01` → 201.
- BUG-101 sigue reproducible: póliza 3, reclamado 300 → `indemnity_amount "-700.00"`. BUG-102: póliza 5 EXPIRED → 201.
- Docker (`docker compose up --build -d`): mismos resultados (400, 400, 201, póliza EXPIRED aceptada con indemnización `-200.00`). `docker compose down` ejecutado.
- Procesos detenidos y archivos temporales eliminados.

## No verificado
- Los 5 modos de arranque `npm start` completos tras el cambio (se probó el backend directo). BUG-104 y SEC-103 no se tocaron.
