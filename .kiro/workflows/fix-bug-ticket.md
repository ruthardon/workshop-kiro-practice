# Workflow: resolver un ticket de bug

Aplica los steerings de `.kiro/steering/` en todos los pasos.

## 1. Diagnosticar
- Lee el ticket (descripción, pasos de reproducción, resultado esperado vs actual).
- Reproduce el problema en local (UI, `curl` o Swagger).
- Localiza la causa raíz en el código y explícala en una frase.

## 2. Escribir primero el test que falla
- Crea un test (backend: vitest + supertest en `backend/tests/`) que codifique el comportamiento esperado.
- Ejecuta `npm test` y confirma que falla por la causa correcta.

## 3. Aplicar el fix
- Cambia lo mínimo necesario para que el test pase, respetando `insurance-domain.md`, `security-pii.md` y `api-standards.md`.
- Si cambia el contrato de la API, actualiza Swagger.
- No mezcles refactors no relacionados.
- Si el fix requiere cambiar el esquema, aplícalo en AMBOS lugares: `db/init.sql` y `db/sqlite/*.sql`.

## 4. Verificar
- Ejecuta `npm run build` y `npm test` en los paquetes afectados.
- Repite los pasos de reproducción manual del ticket.
- Ejecuta `sonar-scanner` y revisa con el power de SonarQube que no hay issues nuevos y el Quality Gate pasa.

## Checklist
- [ ] Bug reproducido antes del fix
- [ ] Test escrito y fallando antes del fix
- [ ] Test pasando tras el fix
- [ ] Sin PII en respuestas ni logs
- [ ] Swagger actualizado si cambió el contrato
- [ ] Cambios de estado registrados en `claim_audits`
- [ ] Esquema actualizado en `db/init.sql` y `db/sqlite/*.sql` si aplica
- [ ] Build y tests en verde
- [ ] SonarQube sin issues nuevos
