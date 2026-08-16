## Why

Cerrar la fila 8 —la última— del §Plan de integración Backend↔Frontend de `CHANGES.md`.
`integracion-documentos` (archivado 2026-08-07) dejó el swap **hecho solo para Pacientes** y los
otros tres composition roots a una línea de distancia. Esa línea sigue sin escribirse:

```
VehiculosRoute.tsx:18      <VehiculosPage    documentoRepository={mockDocumentoRepository} />
ConductoresRoute.tsx:20    <ConductoresPage  documentoRepository={mockDocumentoRepository} />
FacturacionRoute.tsx:48    <FacturacionPage  documentoRepository={mockDocumentoRepository} …/>
```

Hoy el archivo que la usuaria elige en esas tres pantallas **nunca sale del navegador** y desaparece
al recargar — señalizado con `AvisoModeloDatos` en las tres.

### Las 3 precondiciones del "Checkpoint 0" del change viejo ya están resueltas

`integracion-documentos` no avanzó sobre estas tres entidades por una razón concreta y correcta: sus
`entidadId` eran de fixture (`generateId()`), y las tres tablas destino tienen FK
`NOT NULL … REFERENCES` — el primer upload habría dado `23503` dejando un objeto huérfano en el
bucket. Esa razón **caducó**:

| Entidad | Repository real inyectado hoy | Desde | Evidencia leída en este propose |
|---|---|---|---|
| Vehículo | `supabaseVehiculoRepository` | 2026-08-10, commit `9ae79d6` | `VehiculosRoute.tsx:16` |
| Conductor | `supabaseConductorRepository` | 2026-08-11, commit `ce2dd02` | `ConductoresRoute.tsx:18` |
| Factura | `supabaseFacturaRepository` | 2026-08-12 (`integracion-facturacion`) | `FacturacionRoute.tsx:41` |

Los tres `entidadId` son UUID reales de Postgres. **Lo único que sigue en mock en esas pantallas es
Documentos.**

### El lado de código ya está escrito — este change es sobre todo decisión, no implementación

`SupabaseDocumentoRepository.ts` y `documentoMapping.ts` **ya soportan las 4 entidades**:
`CONFIG_ENTIDAD` (`documentoMapping.ts:47-81`) tiene las cuatro filas completas
(schema/tabla/columnaEntidad/columnaItem/bucket/módulo), y el repository no ramifica por entidad.
No hay que escribir un repository nuevo: hay que **habilitar** el que existe.

### Hallazgo 1 — Checkpoints 2 y 3 del change viejo YA ESTÁN RESUELTOS (y no estaba escrito en la fila 8)

Contra el árbol de migraciones actual, no contra la foto de 2026-08-05:

| Checkpoint viejo | Estado real hoy | Migración que lo cerró |
|---|---|---|
| **CP2** — falta `nombre_archivo` × 4 y `created_at` en `documentacion_conductores` | ✅ **cerrado** | `20260806190000_documentos_nombre_archivo.sql` (5 `ADD COLUMN` + 4 `COMMENT ON COLUMN`) |
| **CP3** 🔴 — bucket `documentos-vehiculos` gateado por `conductores` vs. tabla por `vehiculos` | ✅ **cerrado por opción A** | `20260805140001_fix_documentos_vehiculos_rls_modulo.sql` (`DROP`+`CREATE` × 4 policies → `vehiculos`) |

O sea: **el hallazgo CRÍTICO del change archivado ya fue corregido durante su propio apply.** El
mismatch de RLS de storage que la fila 8 dejaba como riesgo abierto no lo es. Esto reduce el
governance de este change respecto de lo que se anticipaba: **no hace falta volver a tocar
`storage.objects`.**

> ⚠️ Verificado leyendo `supabase/migrations/`, **no** contra la base viva: este propose no tuvo
> acceso a `supabase db query --linked`. Que el `.sql` exista en el repo no prueba que esté aplicado
> en el remoto. Re-verificación en vivo de las dos migraciones es **tarea bloqueante §0** del apply.

### Hallazgo 2 — 🔴 el Checkpoint 1 mutó y hoy es un BLOQUEANTE DURO para Facturación

Acá está el cambio que invalida el análisis del change archivado, y es de **ayer y hoy**:

- **2026-08-15** (fix directo, sin change SDD): `CHECKLIST_DOCUMENTOS_FACTURA` reemplaza al checklist
  configurable de la obra social por una **lista fija propia de Facturación** con ids **slug**:
  `'comprobante-arca'`, `'asistencia'`, `'codem'` (`checklistDocumentosFactura.ts:15-19`), consumida
  por `FacturaDetail.tsx:217`.
- **2026-08-16** (hoy): `20260816100000_facturacion_tipos_documento.sql` crea
  `facturacion.tipos_documento` (`id UUID PK`, `tipo TEXT UNIQUE`, seed *Comprobante ARCA /
  Asistencia / CODEM*) y **repunta la FK** de `documento_factura.id_tipo_documento` del catálogo
  compartido `obra_social.tipos_documento` a ese catálogo propio.

El resultado es una **colisión que no existía cuando se escribió el change archivado**:

```
itemId que manda la UI:      'comprobante-arca'        (slug, hardcodeado)
columna que lo recibe:       id_tipo_documento UUID NOT NULL
                             REFERENCES facturacion.tipos_documento(id)
```

`toInsertPayload` escribe el `itemId` crudo en `columnaItem` sin traducir (por diseño, D2 del change
archivado: *"acá no hay ninguna rama por entidad"*). **Swapear Facturación hoy falla en el primer
upload con `22P02` (`invalid input syntax for type uuid`)** — ni siquiera llega a la FK. El
`design.md` archivado daba por sentado que el `itemId` de factura *"ya es el UUID de
`tipos_documento`"*; eso era cierto el 2026-08-05 y **es falso desde ayer**.

Vehículo y Conductor **no** tienen este problema: su columna es `tipo_documento TEXT` libre y sus
slugs (`vehiculoDocumentosItems.ts`, `conductorDocumentosItems.ts`) se persisten tal cual. Para esas
dos, la opción A del Checkpoint 1 (aceptar la heterogeneidad) sigue siendo válida sin tocar nada.

**Consecuencia de alcance:** Vehículos y Conductores son un swap de una línea cada uno. Facturación
**no**, y su desbloqueo exige un veredicto que este propose no puede tomar solo (§Checkpoints).

## What Changes

- **Swap de 2 composition roots, una línea cada uno**: `VehiculosRoute.tsx` y `ConductoresRoute.tsx`
  pasan a inyectar `supabaseDocumentoRepository` (ya exportado,
  `SupabaseDocumentoRepository.ts:370`).
- **Swap de `FacturacionRoute.tsx` condicionado** al veredicto del Checkpoint A. No se swapea sin
  resolver el `itemId`: hacerlo rompe la pantalla de facturas en producción.
- **Se retiran los `AvisoModeloDatos` de upload simulado** de `VehiculoDocumentos.tsx:31-34`,
  `ConductorDocumentos.tsx:37-40` y —cuando corresponda— `FacturaDocumentos.tsx`. El aviso era
  explícitamente transitorio (`documento-avisos-modelo-datos` spec: *"cuando … aterricen, el aviso se
  retira junto con el swap"*).
- **Ninguna tabla nueva, ningún bucket nuevo, ninguna RPC nueva, ninguna policy de RLS nueva.** A
  diferencia de lo que anticipaba la fila 8, el CP3 ya está cerrado.
- **Migración**: solo si el Checkpoint A se resuelve por una opción que la requiera. Aditiva o
  correctiva sobre una migración de hoy — nunca escrita ni aplicada en este propose.
- **El mock no se borra**: sigue como doble de test (~25 archivos) y como implementación de
  `DesignSystem.tsx`, que **nunca** swapea (catálogo vivo, `entidadId` inventado `'p1'`).

### Lo que este change explícitamente NO hace

- **No escribe `SupabaseDocumentoRepository` ni `documentoMapping`**: ya existen y ya cubren las 4
  entidades. Si alguna corrección hace falta, es puntual, no un archivo nuevo.
- **No toca `storage.objects` ni ninguna policy de RLS** (CP3 cerrado en 2026-08-05).
- **No implementa descarga firmada** (`documentos-descarga-firmada`, sigue pendiente).
- **No unifica el modelo documental de las 4 entidades** en un catálogo único (CP1 opción B, sigue
  descartada — ver Checkpoint A).
- **No revierte ni reinterpreta `20260816100000_facturacion_tipos_documento.sql`** sin veredicto
  explícito: es una migración de hoy, con justificación escrita y pedida por la usuaria.
- **No persiste `vigenciaDesde` ni `tipoMime`** (siguen sin columna; `tipoMime` se deriva de la
  extensión vía `inferirTipoMime`).
- **No agrega agrupación por actividad a Vehículos/Conductores/Facturas**: `columnaAgrupacion` es
  solo de `paciente` (`direccion_id`), por diseño.

## Checkpoints — decisiones que la usuaria/Enzo deben tomar ANTES del apply

### 🔴 Checkpoint A (BLOQUEANTE, solo Facturación) — cómo se resuelve el `itemId` slug vs. UUID

| Opción | Qué implica | En contra |
|---|---|---|
| **A1. El checklist de factura se lee de `facturacion.tipos_documento`** (los `ChecklistItem.id` pasan a ser los UUID reales del catálogo) | Respeta la migración de hoy y su intención (catálogo propio, FK íntegra). Es el modelo que ya usa Pacientes | `facturacion.tipos_documento` no tiene columna `requerido`; hoy `requerido` vive en el slug hardcodeado (ARCA/Asistencia `true`, CODEM `false`). Habría que agregarla o derivarla por nombre — decisión de modelo |
| **A2. Seed con UUID fijos y determinísticos**, hardcodeados también en el frontend | Cambio mínimo, sin lectura extra | Duplica la fuente de verdad en dos lugares que pueden divergir en silencio. Frágil |
| **A3. `id_tipo_documento` pasa a `TEXT`** (como Vehículo/Conductor) y el slug se persiste tal cual | El código actual funciona sin tocar nada más; homogeneiza 3 de 4 tablas | **Contradice la migración escrita hoy** y tira la integridad referencial que esa migración fue a buscar. No proponerlo sin hablarlo con quien la pidió |

Este propose **no recomienda una** sin input: A1 es la más coherente con la intención declarada de la
migración de hoy, pero arrastra la pregunta de `requerido`, y A3 revierte trabajo de la usuaria de
hace horas. **Requiere veredicto escrito.**

### 🟡 Checkpoint B — re-verificación en vivo (bloqueante, mecánica)

Confirmar con `supabase db query --linked`, antes de tocar código, que en el **remoto**:
1. `nombre_archivo` existe en las 4 tablas y `created_at` en `documentacion_conductores` (CP2).
2. Las 4 policies de `documentos-vehiculos` en `storage.objects` dicen `vehiculos`, no `conductores`
   (CP3). **Si siguen diciendo `conductores`, este change vuelve a governance CRÍTICO** y el CP3 del
   change archivado se reabre tal cual está escrito ahí.
3. `facturacion.tipos_documento` existe y `documento_factura` apunta a él (migración de hoy aplicada
   o no).
4. Las 3 tablas de documentos siguen en 0 filas (los seeds de `20260813220000` no insertaron ninguna).

### 🟡 Checkpoint C — `tipo_documento TEXT` sin catálogo en Vehículo/Conductor

Se persistirán slugs (`'vehiculo-doc-vtv'`, `'conductor-doc-licencia'`). Es la opción A del CP1
archivado y no requiere migración, pero conviene confirmar que se acepta que la base guarde slugs de
código y no nombres legibles — y que renombrar un slug en el frontend huerfanaría documentos ya
cargados.

## Capabilities

### New Capabilities
- Ninguna.

### Modified Capabilities
- `documento-repository-supabase`: el requisito de inyección deja de ser *"solo `PacientesRoute`"* y
  pasa a cubrir Vehículos y Conductores (y Facturación, sujeto al Checkpoint A). Se normaliza el
  contrato de `itemId` por entidad.
- `documento-avisos-modelo-datos`: el requisito *"las tres entidades que siguen simulando el upload lo
  dicen en pantalla"* se retira para las que swapean — es la condición de cierre que el propio
  requisito declara.
- `factura-documentacion`: la documentación de respaldo de una factura pasa de simulada a persistida,
  y su `itemId` queda atado al catálogo resuelto en el Checkpoint A.
- `vehiculo-documentos` / `conductor-documentos`: el upload pasa de simulado a real contra Storage +
  Postgres.

## Impact

**Código modificado (mínimo, el grueso del change es decisión)**
- `frontend/src/features/vehiculos/VehiculosRoute.tsx` — 1 import + 1 prop
- `frontend/src/features/conductores/ConductoresRoute.tsx` — 1 import + 1 prop
- `frontend/src/features/facturacion/FacturacionRoute.tsx` — ídem, **gated por Checkpoint A**
- `frontend/src/features/vehiculos/VehiculoDocumentos.tsx`,
  `frontend/src/features/conductores/ConductorDocumentos.tsx`,
  `frontend/src/features/facturacion/FacturaDocumentos.tsx` — retiro del `AvisoModeloDatos`
- `frontend/src/shared/lib/facturacion/checklistDocumentosFactura.ts` — **solo** si el Checkpoint A
  se resuelve por A1/A2
- Tests de los tres roots (smoke de composition root, patrón `vi.hoisted` + `vi.mock` ya establecido)

**Base de datos**
- Nada, salvo lo que decida el Checkpoint A. Ninguna policy de RLS se toca.

**Sin impacto**
- `DocumentoRepository.ts` (5 métodos hoy: `listByEntity`/`upload`/`remove`/`resolverPrevisualizacion`/
  `transferirAgrupacion`), `documentoMapping.ts`, `SupabaseDocumentoRepository.ts`,
  `DocumentChecklist.tsx`, `useDocumentChecklist.ts`, `mockDocumentoRepository.ts`, `DesignSystem.tsx`.

**Dependencias**
- Cumplidas: `integracion-conductores-vehiculos` (Vehículo 2026-08-10, Conductor 2026-08-11),
  `integracion-facturacion` (2026-08-12), `integracion-documentos` (2026-08-07).
- Bloqueante: veredicto del Checkpoint A + re-verificación del Checkpoint B.

**Governance: ALTO.** Toca documentación de salud y de menores (buckets privados, RLS por módulo) y
puede requerir migración sobre `facturacion` (dominio CRÍTICO). **No es CRÍTICO** mientras el
Checkpoint B confirme que el CP3 sigue cerrado; si las policies de storage volvieron a `conductores`,
sube a CRÍTICO y requiere la ceremonia de aprobación escrita del change archivado.

**Riesgo y rollback**
- **`22P02` en Facturación** si se swapea sin resolver el Checkpoint A. Mitigación: el swap de
  Facturación es una tarea aparte, explícitamente gated.
- **Objetos huérfanos**: `upload` sube el archivo antes de insertar la fila y compensa con `REMOVE` si
  el insert falla (D4). El residuo posible es un objeto sin fila (invisible para la UI), nunca una
  fila sin archivo.
- **Slugs persistidos** (Checkpoint C): renombrar un slug huerfanaría documentos ya cargados.
- **Rollback**: revertir cada root al mock (1 import + 1 prop por archivo) y restaurar los tres
  `AvisoModeloDatos`. Las 3 tablas están en 0 filas, así que no hay dato que migrar de vuelta. Una
  eventual migración del Checkpoint A tendría su propio rollback escrito antes de aplicarse.

**Success criteria**
- [ ] Subir un documento a un vehículo, a un conductor y (si A se resuelve) a una factura, recargar la
      pantalla y que el archivo siga ahí.
- [ ] Los tres `AvisoModeloDatos` de upload simulado retirados de las pantallas que swapearon.
- [ ] `cd frontend && npx tsc -b --noEmit` y `npx vitest run` en verde.
- [ ] Fila 8 del §Plan de integración de `CHANGES.md` marcada ✅ (o con el alcance parcial explícito si
      Facturación queda gated).
