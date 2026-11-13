---
inclusion: always
---

# Reglas de dominio asegurador

Estas reglas aplican a todo código que toque pólizas, siniestros o indemnizaciones en ClaimShield.

## Tipos numéricos exactos
- Montos, deducibles y límites de cobertura se guardan siempre como `NUMERIC(12,2)` en PostgreSQL. En SQLite (modo Cero-Instalación) se guardan como centavos enteros (`INTEGER`, columnas `*_cents`) y la capa de datos los expone como string decimal. Nunca `FLOAT`, `REAL` ni `DOUBLE PRECISION` en ninguno de los dos motores.
- Los cambios de esquema se aplican en ambos lugares: `db/init.sql` y `db/sqlite/schema.sql` + `db/sqlite/seed.sql`.
- En la API los montos viajan como string decimal (`"1500.00"`). Prohibido sumar o restar con aritmética flotante de JavaScript: usa centavos enteros o una librería decimal, o haz el cálculo en SQL.
- Redondea siempre a 2 decimales con una única función compartida.

## Cálculo de indemnización
- Fórmula: `indemnización = max(0, monto_reclamado - deducible)`, limitada por `coverage_limit`.
- Prohibido persistir indemnizaciones negativas. Si el reclamado es menor o igual al deducible, la indemnización es `0.00`.
- Todo cambio en la fórmula necesita un test que cubra: reclamado < deducible, = deducible, > deducible y > coverage_limit.

## Vigencia de póliza
- Solo se pueden crear siniestros sobre pólizas con `status = 'ACTIVE'`.
- `incident_date` debe estar dentro de `[start_date, end_date]` (ambos inclusive).
- Si no se cumple, responde `422` con código `POLICY_NOT_ACTIVE` o `INCIDENT_OUT_OF_COVERAGE`.

## Máquina de estados de siniestros
- `OPEN -> APPROVED`, `OPEN -> REJECTED`, `APPROVED -> CLOSED`.
- `REJECTED` y `CLOSED` son estados finales, salvo reaperturas explícitas (`-> OPEN`) con las reglas del endpoint de reapertura.
- Cualquier transición no listada responde `409` con código `INVALID_STATE_TRANSITION`.

## Auditoría obligatoria
- Todo cambio de estado, incluida la creación (`NULL -> OPEN`), inserta una fila en `claim_audits` con `claim_id`, `old_status`, `new_status`, `changed_by`, `reason` y `created_at`.
- El cambio de estado y su auditoría ocurren en la misma transacción. Si falla uno, se revierte el otro.
- Nunca se actualizan ni borran filas de `claim_audits`.
