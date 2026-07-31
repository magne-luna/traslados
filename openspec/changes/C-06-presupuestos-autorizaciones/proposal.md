# Proposal: Presupuestos y Autorizaciones (backend) — cierre de schema

## Intent

`facturacion.presupuesto`/`autorizacion` ya existían (pusheados durante C-02). Cerrar los 2
puntos que `CHANGES.md` marcaba explícitamente como **bloqueantes** para esta tabla: sin un
monto comparable en `autorizacion` no se puede validar RN-PA-01 (autorización nunca mayor al
presupuesto), y sin `vigencia_desde` no hay forma de registrar la carga retroactiva de RN-PA-02.

## Scope

### In Scope
- `facturacion.autorizacion`: agregar `monto_autorizado` (nullable — el docx no tiene este
  campo, es agregado real de negocio para poder validar RN-PA-01) y `vigencia_desde` (RN-PA-02).
- Trigger `validar_autorizacion_monto`: rechaza (excepción dura) cualquier
  INSERT/UPDATE donde `monto_autorizado > presupuesto.monto` — RN-PA-01, "nunca puede ser mayor".

### Out of Scope
- Cualquier archivo de frontend — `montoAutorizado?`/`vigenciaDesde?` ya existen en el
  contrato del frontend (`shared/types/presupuesto.ts`), solo había que sumarlos acá.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `supabase/migrations/<new>_schema_autorizacion_monto_vigencia.sql` | New | `monto_autorizado`, `vigencia_desde`, trigger de validación dura RN-PA-01 |

## Rollback Plan

Tabla sin datos reales todavía — dropear las 2 columnas y el trigger.

## Dependencias

`C-04` (obra_social), `C-05` (paciente) — ambos listos (las FK de `presupuesto` ya apuntan a ellos).

## Success Criteria

- [ ] Insertar una autorización con `monto_autorizado` mayor al presupuesto falla con excepción clara
- [ ] Insertar una autorización con `monto_autorizado` igual o menor al presupuesto funciona
- [ ] `vigencia_desde` acepta una fecha anterior a `fecha_respuesta` (carga retroactiva)
