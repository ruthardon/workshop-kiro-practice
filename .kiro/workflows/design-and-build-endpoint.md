# Workflow: diseñar y construir un endpoint desde cero

Aplica los steerings de `.kiro/steering/` en todos los pasos. No avances al siguiente paso sin cumplir el criterio de salida.

## Paso 1. Diagrama de secuencia (power Draw.io)
- Acción: con el power de Draw.io genera un diagrama de secuencia Cliente -> Ruta -> Controlador -> Servicio -> BD, con flujos felices y de error (400/404/409/422).
- Entregable: `docs/diagrams/<endpoint>.drawio`.
- Criterio de salida: el diagrama muestra validaciones, transacción y registro en `claim_audits` si hay cambio de estado.

## Paso 2. Esquema de base de datos (si aplica)
- Acción: actualiza `db/init.sql` (PostgreSQL) y `db/sqlite/schema.sql` + `db/sqlite/seed.sql` (SQLite): los cambios de esquema se aplican en AMBOS lugares. Añade además un script de migración `db/migrations/<fecha>_<descripcion>.sql` para bases PostgreSQL ya creadas.
- Entregable: SQL con `NUMERIC(12,2)` para montos y restricciones `CHECK` necesarias.
- Criterio de salida: `npm run db:reset` (SQLite) y `docker compose down -v && docker compose up --build` (PostgreSQL) levantan la BD sin errores y la migración corre sobre una BD existente.

## Paso 3. Implementación (controlador y servicio)
- Acción: valida entrada en el controlador (400), aplica reglas de negocio en el servicio (404/409/422), usa transacciones y registra en `claim_audits`.
- Entregable: cambios en `backend/src/{routes,controllers,services}`.
- Criterio de salida: cumple `insurance-domain.md`, `security-pii.md` y `api-standards.md`; `npm run build` y `npm test` pasan (los tests usan SQLite en memoria) y el endpoint responde igual con `DB_CLIENT=sqlite` y `postgres`; incluye tests para el camino feliz y cada error.

## Paso 4. Swagger
- Acción: añade la anotación `@openapi` en la ruta y los esquemas en `backend/src/config/swagger.ts`.
- Entregable: endpoint visible en `http://localhost:3000/api-docs`.
- Criterio de salida: todas las respuestas posibles están documentadas con ejemplos y "Try it out" funciona.

## Paso 5. Colección de pruebas (power Postman)
- Acción: con el power de Postman genera una colección a partir de `http://localhost:3000/api-docs.json`, con casos felices y de error y assertions sobre el sobre `{ success, data, error }`.
- Entregable: colección en `postman/<endpoint>.collection.json`.
- Criterio de salida: la colección corre completa contra el entorno local sin fallos inesperados.

## Paso 6. Calidad (power SonarQube)
- Acción: ejecuta `sonar-scanner` con `sonar-project.properties` y consulta el resultado con el power de SonarQube.
- Entregable: reporte sin issues nuevos de severidad Blocker/Critical ni vulnerabilidades.
- Criterio de salida: Quality Gate en verde para el código nuevo.
