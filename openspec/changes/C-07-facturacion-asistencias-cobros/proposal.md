# Proposal: Facturación, Asistencias y Cobros (backend) — cierre de schema

## Intent

`facturacion.facturas`/`cobros` ya existían (pusheados durante C-02, revisión de rebote). Cerrar
el gap real contra el contrato del frontend (`shared/types/factura.ts`) antes de exponer las
Edge Functions: sin `asistencia_prestacion`, `cantidad_km` y `fecha_estimada_cobro` no se pueden
validar RN-FA-01/RN-FA-02/RN-PA-03 ni calcular el plazo de cobro; sin `prestacion`,
`mes_facturado`/`anio_facturado`, `dependencia_y_retorno`, `domicilio_id` e
`identificador_origen`/`identificador_valor` la tabla ni siquiera admite los campos que el
formulario de facturación ya recolecta.

## Scope

### In Scope
- `facturacion.facturas`: agregar `cantidad_km`, `fecha_estimada_cobro`, `prestacion`,
  `mes_facturado`, `anio_facturado`, `dependencia_y_retorno`, `domicilio_id` (FK a
  `pacientes.direcciones`), `identificador_origen`/`identificador_valor` (snapshot de
  `IdentificadorFactura`, IN-01/RN-FA-06 — nunca mutable retroactivamente).
- Tabla nueva `facturacion.asistencia_prestacion` (1---N con `facturas`, RLS + audit trigger):
  el docx no tiene ninguna entidad de asistencias; la KB/US-400 sí. El frontend la embebe en
  `Factura.asistencias[]` sin repository propio (mismo ciclo de vida que la factura) — la base
  necesita tabla propia porque N filas variables por factura no caben en una columna.
- Edge Functions `facturas` (reemplazo completo de `asistencias` en cada POST/PATCH que las
  incluya, mismo patrón que `update-permisos`) y `cobros` (sin `PATCH` — `CobroRepository` del
  frontend no tiene `update`).

### Out of Scope
- Validación dura de cupo (RN-FA-02) y cálculo de fecha estimada de cobro (RN-FA-04) como lógica
  de servidor — hoy son funciones puras del frontend (`facturacion-ui`, ya testeadas); replicarlas
  en trigger/Edge Function queda para cuando el frontend real reemplace el mock.
- Exclusión de feriados (RN-FA-03), integración ARCA, alertas de vencimiento — sin cambios de
  schema propios, no bloquean el cierre de este change.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `supabase/migrations/20260730100000_schema_factura_gaps.sql` | New | 8 columnas en `facturas` + tabla `asistencia_prestacion` |
| `supabase/functions/facturas/index.ts` | New | CRUD + asistencias embebidas |
| `supabase/functions/cobros/index.ts` | New | CRUD sin `PATCH` |

## Rollback Plan

Tablas sin datos reales todavía — dropear las 8 columnas nuevas de `facturas` y la tabla
`asistencia_prestacion`; despublicar las 2 Edge Functions.

## Dependencias

`C-04` (obra_social, vía `identificador_origen`), `C-05` (paciente/direcciones, vía
`domicilio_id`), `C-06` (cupo autorizado, consumido — no modificado por este change), `C-03`
(`documento_factura`, ya existente).

## Success Criteria

- [ ] Insertar una factura con `asistencias[]` embebidas y recuperarla con el mismo array
- [ ] Reemplazar el set de `asistencias` de una factura vía `PATCH` (delete+insert, nunca merge)
- [ ] `identificadorFactura` viaja como snapshot `{origen, valor}`, ausente mientras no se emitió
- [ ] `cobros` filtra por `?facturaId=` y lista todos sin filtro; sin `PATCH`
