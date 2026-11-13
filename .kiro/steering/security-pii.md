---
inclusion: always
---

# Privacidad y datos personales (PII)

## Qué es PII en ClaimShield
`national_id`, `phone`, `email`, `holder_name` y el número de póliza completo (`policy_number`).

## Enmascaramiento en respuestas API
- Ningún endpoint devuelve PII en texto plano. Aplica el patrón `***-**-1234` (últimos 4 caracteres) mediante la utilidad compartida de enmascarado.
- Ejemplos:
  - `national_id`: `1012345678` -> `***-**-5678`
  - `phone`: `+57 300 123 4567` -> `***-**-4567`
  - `email`: `maria.ortiz@example.com` -> `m***@example.com`
  - `policy_number`: `POL-2025-000123` -> `***-**-0123`
- El enmascarado se aplica en la capa de servicio o serialización, nunca en el frontend.
- Los endpoints de detalle siguen la misma regla que los listados.

## Logs
- Prohibido absolutamente loguear datos personales o números de póliza completos, ni siquiera en `console.log` de depuración.
- Permitido: ids internos (`claim_id`, `policy_id`), estados, códigos de error y los últimos 4 caracteres de un identificador.
- No loguees objetos completos (`row`, `policy`, `req.body`). Selecciona los campos seguros de forma explícita.
- Los mensajes de error al cliente no incluyen PII ni detalles de SQL.

## Revisión
- Antes de cerrar cualquier tarea, busca `console.log`, `console.error` y `logger` con `national_id`, `phone`, `email`, `policy_number`.
- Los datos de ejemplo en tests y documentación deben ser ficticios.
