# ClaimShield

Sistema de gestión de siniestros y reclamaciones de seguros. Repositorio base de un **workshop técnico** con Kiro: se levanta con un simple `npm start` (sin Docker) o con Docker, trae configuración de Kiro prehecha (steerings, hooks y workflows), contiene problemas intencionales para diagnosticar y está listo para usar los powers de **Draw.io, SonarQube, Swagger y Postman**.

## Inicio rápido
ClaimShield se puede ejecutar de dos formas. Elige la que te convenga: el código, los bugs y la API son los mismos en ambas.

### Opción A: Cero-Instalación (recomendado, solo Node.js ≥ 22)
No necesitas Docker ni PostgreSQL. El backend usa SQLite (archivo local `backend/data/claimshield.db`, se crea y se siembra solo).
```bash
npm start
```
La primera vez instala las dependencias de `backend/` y `frontend/` y luego levanta ambos servicios con salida prefijada (`[api]` y `[web]`). Cuando todo está listo se imprimen las URLs. Detén todo con `Ctrl+C`.

| Script | Qué hace |
|--------|----------|
| `npm start` | Instala dependencias si faltan y levanta backend + frontend (SQLite) |
| `npm run setup` | Solo instala dependencias |
| `npm run dev` | Igual que `start`, con recarga automática del backend |
| `npm run db:reset` | Recrea la BD SQLite con los datos semilla |
| `npm run build` | Compila backend y frontend |
| `npm test` | Pruebas del backend (SQLite en memoria, sin Docker) |
| `npm run docker:up` / `docker:down` | Atajos de Docker Compose (Opción B) |

### Opción B: Docker
Requisitos: Docker y Docker Compose. Levanta PostgreSQL 16, backend y frontend.
```bash
docker-compose up --build
# o, con Compose v2:
docker compose up --build
```
Espera a que los tres servicios estén `healthy` (`docker compose ps`). Para reiniciar la base de datos con los datos semilla:
```bash
docker compose down -v && docker compose up --build
```
Variables opcionales en `.env.example` (cópialo a `.env` si quieres cambiar puertos o credenciales).

### Comparativa
| | Opción A: Cero-Instalación | Opción B: Docker |
|---|---|---|
| Requisitos | Node.js ≥ 22 | Docker + Docker Compose |
| Base de datos | SQLite (`backend/data/claimshield.db`) | PostgreSQL 16 (volumen `pgdata`) |
| Comando | `npm start` | `docker-compose up --build` |
| `DB_CLIENT` | `sqlite` (lo fija `npm start`) | `postgres` (lo fija `docker-compose.yml`) |
| Reset de datos | `npm run db:reset` | `docker compose down -v` |
| Montos | Centavos enteros internos; la API devuelve string decimal | `NUMERIC(12,2)`; la API devuelve string decimal |
| Puertos | 5173 (web), 3000 (API) | 5173, 3000, 5432 (BD) |

Swagger, Postman y SonarQube funcionan igual en ambos modos: la API siempre está en `http://localhost:3000` y devuelve las mismas respuestas. SonarQube corre aparte (ver sección SonarQube) y analiza el código fuente, no la BD.

### Requisitos de Node.js
Para cambiar la ubicación del archivo SQLite usa `SQLITE_PATH` (una ruta relativa se resuelve desde la raíz del repositorio; por defecto `backend/data/claimshield.db`).

Se requiere **Node.js ≥ 22** (campo `engines`). SQLite se accede con `better-sqlite3`, que incluye binarios precompilados para Windows, macOS y Linux: no hace falta Python ni compilador de C++. Para que npm no intente compilarlo, `backend/.npmrc` fija `ignore-scripts=true`.

### Solución de problemas
- **Puerto ocupado (3000 o 5173):** `npm start` lo avisa y se detiene. Localiza el proceso con `lsof -i :3000` (macOS/Linux) o `netstat -ano | findstr :3000` (Windows) y ciérralo. Si tienes los contenedores levantados, ejecuta `npm run docker:down`.
- **Quiero los datos originales de SQLite:** `npm run db:reset` (con la app detenida).
- **Windows:** usa PowerShell o CMD (no hace falta bash). Si la ruta del proyecto tiene espacios, funciona igual; si tu antivirus bloquea `npm install`, reintenta o añade una excepción.
- **`npm install` falla al compilar:** confirma que usas Node ≥ 22 y que existe `backend/.npmrc`; no se necesita toolchain de compilación.
- **El frontend muestra "Failed to fetch":** comprueba que el backend responde en `http://localhost:3000/api/health`.

## URLs de acceso
| Servicio | URL |
|----------|-----|
| Frontend (dashboard) | http://localhost:5173 |
| Backend API | http://localhost:3000/api |
| Swagger UI | http://localhost:3000/api-docs |
| OpenAPI JSON | http://localhost:3000/api-docs.json |
| PostgreSQL (solo Docker) | `localhost:5432` (usuario/clave/BD: `claimshield`) |
## Estructura del repositorio

```
.
├── package.json                # scripts raíz: start, setup, dev, db:reset, docker:up, test
├── scripts/start.mjs           # arranque Cero-Instalación multiplataforma (SQLite)
├── docker-compose.yml          # db + backend + frontend con healthchecks y volumen pgdata
├── sonar-project.properties    # configuración de escaneo SonarQube
├── db/init.sql                 # esquema y semilla PostgreSQL (policies, claims, claim_audits)
├── db/sqlite/                  # schema.sql y seed.sql equivalentes para SQLite
├── backend/                    # Node.js + Express + TypeScript
│   └── src/{config,routes,controllers,services,middleware,utils,types}
├── frontend/                   # React + Vite + TailwindCSS
│   └── src/{api,components,hooks}
└── .kiro/
    ├── steering/               # reglas de dominio, PII y estándares de API
    ├── hooks/                  # automatizaciones al guardar archivos
    └── workflows/              # guías paso a paso
```

Datos semilla: 6 pólizas (4 activas con deducibles de 250, 500, 1000 y 2000; 2 expiradas) y 8 siniestros (3 `OPEN`, 2 `APPROVED`, 2 `REJECTED`, 1 `CLOSED`) con su historial en `claim_audits`.

## Desarrollo local

```bash
npm run setup   # instala dependencias de backend y frontend
npm run build   # compila ambos
npm test        # pruebas del backend con SQLite en memoria
```

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado del servicio |
| GET | `/api/policies` | Lista de pólizas |
| GET | `/api/policies/:id` | Detalle de póliza |
| GET | `/api/claims?status=` | Lista de siniestros, filtrable por estado |
| GET | `/api/claims/stats` | KPIs: total, abiertos, monto reservado |
| GET | `/api/claims/:id` | Detalle de siniestro |
| POST | `/api/claims` | Reportar siniestro |
| PATCH | `/api/claims/:id/approve` | Aprobar siniestro `OPEN` |
| PATCH | `/api/claims/:id/reject` | Rechazar siniestro `OPEN` |
| POST | `/api/claims/:id/legacy-process` | Procesamiento heredado |

Todas las respuestas siguen el formato `{ success, data, error }`. "Monto Reservado" es la suma de `indemnity_amount` de los siniestros `APPROVED`.

## SonarQube

1. Levanta SonarQube local (por ejemplo `docker run -d -p 9000:9000 sonarqube:community`) y crea un token.
2. (Opcional) genera cobertura: `cd backend && npm run test:coverage`.
3. Desde la raíz del repositorio:

```bash
sonar-scanner -Dsonar.token=<TU_TOKEN>
```

El archivo `sonar-project.properties` ya define `projectKey=claimshield`, las fuentes (`backend/src`, `frontend/src`), exclusiones y el host `http://localhost:9000`.

## Powers utilizados

| Power | Uso en el taller |
|-------|------------------|
| Draw.io | Diagramas de secuencia y arquitectura |
| Swagger | Documentación OpenAPI en `/api-docs` |
| Postman | Colecciones de prueba generadas desde el OpenAPI |
| SonarQube | Análisis de calidad y seguridad |

## Configuración de Kiro

- **Steerings** (`.kiro/steering/`): `insurance-domain.md`, `security-pii.md`, `api-standards.md`.
- **Hooks** (`.kiro/hooks/`): `sync-swagger-on-route-change.json` (revisa Swagger al guardar rutas) y `check-pii-on-save.json` (revisa logs con PII al guardar en `backend/src`).
- **Workflows** (`.kiro/workflows/`): `design-and-build-endpoint.md` y `fix-bug-ticket.md`.

---

## Backlog del Workshop

### BUG-101 · Indemnización negativa al reportar siniestro
- **Tipo / Prioridad:** Bug / Alta
- **Descripción:** Al crear un siniestro cuyo monto reclamado es menor que el deducible de la póliza, se guarda una indemnización negativa.
- **Pasos para reproducir:**
  1. `POST /api/claims` con `policy_id: 3` (deducible 1000.00), `claimed_amount: 300`, una descripción y una fecha válida.
  2. Consulta el siniestro creado.
- **Resultado esperado:** `indemnity_amount = "0.00"`; nunca negativa y limitada por `coverage_limit`.
- **Resultado actual:** `indemnity_amount = "-700.00"` persistido en la base de datos.
- **Criterios de aceptación:**
  - Reclamado menor o igual al deducible produce indemnización `0.00`.
  - La indemnización no supera `coverage_limit`.
  - Test que cubre reclamado < deducible, = deducible, > deducible y > coverage_limit.
  - El cálculo evita aritmética flotante (ver `insurance-domain.md`).
- **Powers sugeridos:** Swagger (reproducir), SonarQube (verificar).

### BUG-102 · Se aceptan siniestros sobre pólizas no vigentes
- **Tipo / Prioridad:** Bug / Alta
- **Descripción:** `POST /api/claims` no valida la vigencia de la póliza.
- **Pasos para reproducir:**
  1. `POST /api/claims` con `policy_id: 5` (póliza `EXPIRED`).
  2. `POST /api/claims` con `policy_id: 1` e `incident_date: "2020-01-01"` (fuera del rango `start_date`–`end_date`).
- **Resultado esperado:** `422` con código `POLICY_NOT_ACTIVE` o `INCIDENT_OUT_OF_COVERAGE`, sin crear el siniestro.
- **Resultado actual:** `201 Created` en ambos casos.
- **Criterios de aceptación:**
  - Pólizas `EXPIRED` rechazadas con `422`.
  - `incident_date` fuera de `[start_date, end_date]` rechazada con `422`.
  - Los límites del rango son inclusivos.
  - Tests para cada rama y Swagger documenta el `422`.
- **Powers sugeridos:** Swagger, Postman.

### SEC-103 · Exposición de PII y code smells
- **Tipo / Prioridad:** Seguridad / Crítica
- **Descripción:**
  - `GET /api/policies/:id` devuelve `national_id`, `phone` y `email` sin enmascarar.
  - El servicio de siniestros tiene una función heredada (`processClaimLegacy`) con complejidad ciclomática alta, variables sin usar, `console.log` con datos sensibles y bloques `catch` vacíos.
- **Pasos para reproducir:**
  1. `curl http://localhost:3000/api/policies/1` y revisa los campos.
  2. Ejecuta el escaneo de SonarQube y revisa los issues del servicio de siniestros.
  3. Llama a `POST /api/claims/3/legacy-process` y revisa los logs del backend (consola `[api]` de `npm start` o `docker compose logs backend`).
- **Resultado esperado:** PII enmascarada (`***-**-1234`), sin logs de datos personales y función con complejidad baja y sin bloques vacíos.
- **Resultado actual:** PII en texto plano, logs con datos sensibles y múltiples code smells.
- **Criterios de aceptación:**
  - El detalle de póliza enmascara `national_id`, `phone`, `email` y `policy_number`.
  - Cero `console.log` con datos sensibles.
  - `processClaimLegacy` refactorizada (complejidad cognitiva ≤ 15), sin variables sin usar ni `catch` vacíos.
  - SonarQube sin issues Blocker/Critical en el archivo.
- **Powers sugeridos:** SonarQube, Swagger.

### BUG-104 · KPI "Monto Reservado" no se actualiza
- **Tipo / Prioridad:** Bug / Media
- **Descripción:** Al aprobar o rechazar un siniestro, el badge de la fila cambia pero el KPI superior no se recalcula hasta recargar la página.
- **Pasos para reproducir:**
  1. Abre http://localhost:5173 y anota "Monto Reservado" y "Siniestros Abiertos".
  2. Aprueba un siniestro `Abierto`.
  3. Observa que el badge cambia a "Aprobado" pero los KPIs no.
  4. Recarga con F5: los KPIs ahora sí cambian.
- **Resultado esperado:** Los KPIs se actualizan de inmediato tras aprobar o rechazar.
- **Resultado actual:** Los KPIs quedan desactualizados hasta recargar.
- **Criterios de aceptación:**
  - Tras aprobar o rechazar, "Monto Reservado" y "Siniestros Abiertos" reflejan el nuevo estado sin recargar.
  - Sin llamadas redundantes innecesarias.
  - Comportamiento verificado con una prueba manual descrita en el PR.
- **Powers sugeridos:** Draw.io (flujo de datos del dashboard), SonarQube.

---

## Reto Final · FEAT-201 · Nuevo endpoint desde cero

### `POST /api/claims/:id/reopen`

Permite reabrir un siniestro cerrado o rechazado. **No está implementado**: se construye desde cero con el workflow `.kiro/workflows/design-and-build-endpoint.md`. Las columnas `closed_at` y `reopen_count` ya existen en la tabla `claims`. Cualquier cambio de esquema se aplica en **ambos** motores: `db/init.sql` (PostgreSQL) y `db/sqlite/schema.sql` + `db/sqlite/seed.sql` (SQLite).

### Reglas de negocio
1. Solo se pueden reabrir siniestros en estado `CLOSED` o `REJECTED`.
2. Máximo **30 días** desde el cierre (`closed_at`).
3. El campo `reason` es obligatorio y tiene **mínimo 20 caracteres** (sin contar espacios sobrantes en los extremos).
4. Máximo **2 reaperturas** por siniestro (`reopen_count`).
5. Al reabrir: `status = OPEN`, `reopen_count + 1`, `closed_at = NULL`.
6. Se registra la transición en `claim_audits` (`old_status`, `new_status = OPEN`, `changed_by`, `reason`) en la misma transacción.
7. Las reglas del repositorio aplican: sin PII en respuestas y logs, formato `{ success, data, error }`.

### Request

Los siniestros `REJECTED`/`CLOSED` de la semilla se cerraron hace más de 30 días, así que reabrirlos devuelve `422 REOPEN_WINDOW_EXPIRED`. Para un caso de éxito, crea un siniestro nuevo (`POST /api/claims`; en una BD recién sembrada será el id `9`) y recházalo con `PATCH /api/claims/9/reject`: su `closed_at` será reciente.

```http
POST /api/claims/9/reopen
Content-Type: application/json
x-user: ajustador.ruiz

{ "reason": "Se presentó nueva evidencia pericial del daño." }
```

### Response 200

```json
{
  "success": true,
  "data": {
    "id": 9,
    "status": "OPEN",
    "closed_at": null,
    "reopen_count": 1
  },
  "error": null
}
```

### Errores

| HTTP | Código sugerido | Cuándo |
|------|-----------------|--------|
| 400 | `VALIDATION_ERROR` | `id` no numérico, o `reason` ausente o de tipo incorrecto |
| 404 | `CLAIM_NOT_FOUND` | El siniestro no existe |
| 409 | `INVALID_STATE_TRANSITION` | El estado no es `CLOSED` ni `REJECTED` |
| 422 | `REOPEN_REASON_TOO_SHORT` | `reason` con menos de 20 caracteres |
| 422 | `REOPEN_WINDOW_EXPIRED` | Pasaron más de 30 días desde `closed_at` |
| 422 | `REOPEN_LIMIT_REACHED` | `reopen_count` ya es 2 |

### Casos de prueba sugeridos
- Reapertura exitosa de un siniestro recién creado y rechazado (cierre reciente) → `200`, `OPEN`, `reopen_count = 1`, nueva fila en `claim_audits`.
- Reapertura exitosa de un siniestro `CLOSED` con `closed_at` reciente (no hay endpoint para cerrar: prepáralo en el test ajustando la BD).
- Siniestro semilla `6` (`REJECTED` en 2025-07-15) → `422 REOPEN_WINDOW_EXPIRED`.
- Siniestro inexistente → `404`.
- Siniestro `OPEN` o `APPROVED` → `409`.
- `reason` de 19 caracteres → `422`; de 20 → `200`.
- Cierre hace 30 días → `200`; hace 31 días → `422`.
- Tercera reapertura → `422`.
- Falla al insertar la auditoría → no cambia el estado (transacción).
- `id` inválido (`abc`) → `400`.

### Ruta de powers por paso

| Paso | Power | Entregable |
|------|-------|------------|
| 1. Diseño | **Draw.io** | Diagrama de secuencia con flujo feliz y errores |
| 2. Código | (Kiro + steerings) | Ruta, controlador, servicio y tests |
| 3. Documentación | **Swagger** | Anotación `@openapi` con 200/400/404/409/422 |
| 4. Pruebas de API | **Postman** | Colección con los casos de prueba anteriores |
| 5. Calidad | **SonarQube** | Quality Gate en verde para el código nuevo |
