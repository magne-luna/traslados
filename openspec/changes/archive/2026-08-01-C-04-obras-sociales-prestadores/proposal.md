# Proposal: Obras Sociales y Prestadores (backend) — cierre de schema

## Intent

`obra_social.obra_social`/`prestadores`/`tipos_documento`/`requisitos_os` ya existían (pusheados
durante la revisión de C-02) y ya cubrían la estructura del docx 1:1. Lo que faltaba era lo que
el docx no tiene: los campos de negocio de RN-FA-07/08 que `04_modelo_de_datos.md
§Discrepancias` ya documenta como pendientes de sumar a la migración real.

## Scope

### In Scope
- `obra_social.obra_social`: agregar `plazo_cobro_dias`, `modalidad_facturacion`,
  `admite_pagos_parciales`, `identificador_origen` (IN-01); convertir `tipo_factura` (TEXT
  libre) a `tipo_comprobante` reusando el enum ya definido en `facturacion.tipo_factura`.
- `obra_social.requisitos_os`: agregar `orden` (RN-FA-08, el orden del checklist debe
  respetarse) y `requerido`.
- `obra_social.plantilla_campo` (nueva tabla): plantilla de descripción de factura,
  `PlantillaCampo[]` del frontend.

### Out of Scope
- Cargar el checklist real de OSECAC como dato — es contenido de negocio real, no estructura;
  lo carga la administradora desde la app cuando exista la pantalla, no se inventa acá.
- Cualquier archivo de frontend.

## Nombres de campo y defaults

Tomados 1:1 del contrato ya construido/testeado en `frontend/src/shared/types/obraSocial.ts` y
los defaults de `ObraSocialForm.tsx`/`osecacFixture.ts` (`plazoCobroDias: 90`,
`modalidadFacturacion: 'por-prestacion'`, `admitePagosParciales: false`,
`identificadorOrigen: 'paciente.numeroAfiliado'`) — evita renegociar shapes cuando frontend
conecte esto a datos reales.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `supabase/migrations/<new>_schema_obra_social_facturacion_config.sql` | New | Campos RN-FA-07/08 + tabla `plantilla_campo` |

## Rollback Plan

Nada pusheado antes de este cambio depende de estas columnas — revertir es dropear las
columnas/tabla nuevas y volver a renombrar `tipo_comprobante` a `tipo_factura`.

## Dependencias

`C-02` (RLS, `tiene_permiso()`), `C-01` — ambos listos.

## Success Criteria

- [ ] Los 4 campos nuevos existen en `obra_social.obra_social` con los defaults del frontend
- [ ] `requisitos_os` preserva orden y obligatoriedad
- [ ] `plantilla_campo` existe, RLS'd y auditada
