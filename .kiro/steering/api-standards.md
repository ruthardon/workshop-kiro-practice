---
inclusion: always
---

# Estándares de API

## Formato de respuesta
Toda respuesta sigue el sobre `{ success, data, error }`:

```json
{ "success": true, "data": { "id": 1 }, "error": null }
{ "success": false, "data": null, "error": { "code": "CLAIM_NOT_FOUND", "message": "Siniestro no encontrado" } }
```

- `error.code` es una constante en `UPPER_SNAKE_CASE`; `error.message` está en español; `error.details` es opcional.
- Usa el helper `ok()` para éxitos y lanza `AppError` para fallos.

## Manejo centralizado de errores
Los controladores no construyen respuestas de error: lanzan `AppError(status, code, message)` y el middleware `errorHandler` responde.

| HTTP | Cuándo usarlo | Ejemplo de code |
|------|---------------|-----------------|
| 400 | Formato inválido: campos faltantes, tipos incorrectos, id no numérico | `VALIDATION_ERROR`, `INVALID_ID` |
| 404 | El recurso no existe | `CLAIM_NOT_FOUND`, `POLICY_NOT_FOUND` |
| 409 | Conflicto con el estado actual del recurso | `INVALID_STATE_TRANSITION` |
| 422 | Datos bien formados que violan una regla de negocio | `POLICY_NOT_ACTIVE`, `INCIDENT_OUT_OF_COVERAGE` |
| 500 | Error inesperado; mensaje genérico, sin detalles internos | `INTERNAL_ERROR` |

## Documentación Swagger obligatoria
- Cada endpoint tiene su anotación `@openapi` en `backend/src/routes/` con tags, summary, parámetros, requestBody y todas las respuestas posibles (incluidos 400/404/409/422).
- Los esquemas reutilizables viven en `backend/src/config/swagger.ts` bajo `components.schemas`.
- Un endpoint sin documentar en Swagger no se considera terminado.
- Verifica en `http://localhost:3000/api-docs` que el cambio aparece.

## Convenciones
- Rutas bajo `/api`, en plural y minúsculas (`/api/claims/:id/approve`).
- Fechas en ISO 8601; montos como string decimal.
- Las mutaciones aceptan opcionalmente el header `x-user` para `changed_by`.
