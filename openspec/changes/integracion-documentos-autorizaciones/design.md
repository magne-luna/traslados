# Design: Integración del archivo de Autorizaciones con Storage real

## Technical Approach

Replicar el patrón bucket-privado + RLS + repository ya probado 4 veces (`C-03`,
`integracion-documentos`), pero con dos ejes deliberadamente distintos: un solo archivo (no
checklist) y escritura híbrida (Storage directo + Edge Function existente, no RPC nuevo). Alcance
confirmado: solo carga (subir/reemplazar/quitar + ver nombre/fecha). Descarga queda fuera.

## Hallazgo bloqueante (corrige un supuesto del proposal)

El proposal asume *"archivo_nombre y archivo_cargado_en ya existen en `facturacion.autorizacion`"*
(Approach §1) citando `20260729160000_schema_presupuesto_autorizacion_archivo_meta.sql`. Falso hoy:
`20260730120000_revert_presupuesto_archivo_meta.sql` (aplicada después, mismo día) hace
`DROP COLUMN` de ambas columnas en `facturacion.presupuesto` **y** `facturacion.autorizacion`, con
una decisión explícita documentada en su cabecera: *"el frontend usa `archivo_url` directamente...
las Edge Functions ya usan `archivo_url`, nunca estas 2 columnas"*. No es "verificar si está
aplicada" (tarea bloqueante §1 del proposal) — es: **la migración fue aplicada y luego revertida a
propósito**. Este change reabre esa decisión (ver D4) y debe escribir una migración **nueva** que
vuelva a agregar las columnas, no asumir que ya están.

## Architecture Decisions

| # | Decisión | Alternativas rechazadas | Rationale |
|---|----------|--------------------------|-----------|
| **D1** | Un solo archivo por autorización, reusar `archivo_url`/`archivo_nombre`/`archivo_cargado_en` de la fila existente. Sin tabla `documento_autorizacion`, sin `DocumentChecklist` | Checklist multi-documento (`DocumentoRepository`/`EntidadDocumental`) | El docx modela un único campo "Archivo" en Autorización, no una colección. `presupuesto.ts` ya documenta este mismo eje para `Presupuesto`/`Autorizacion`: *"el docx modela un solo 'Archivo'... NO una colección"*. Extender el checklist forzaría una cardinalidad que el dominio no tiene y complicaría RLS/mapping sin necesidad |
| **D2** | Bucket `documentos-autorizaciones` (`public=false`) + 4 policies RLS calcadas de `20260729100001_storage_objects_rls.sql`, gateadas por el módulo `presupuestos` ya existente | Módulo nuevo `autorizaciones-archivos`; bucket compartido con `documentos-facturas` | `presupuestos` ya gatea `facturacion.autorizacion` (tabla) desde `20260730140000_split_modulos_permisos.sql` y la EF `autorizaciones` (`MODULO = 'presupuestos'`). Reusarlo evita que cuentas con acceso hoy a la fila queden sin acceso al archivo; un módulo nuevo requeriría re-onboarding manual de permisos. Bucket propio (no compartido) porque cada bucket ya mapea 1:1 a un dominio en el patrón existente — mezclar con facturas rompería esa correspondencia |
| **D3** | Flujo híbrido: el objeto sube **directo** navegador→Storage (cliente Supabase + RLS de `storage.objects`); la referencia (`archivoUrl`/`archivoNombre`/`archivoCargadoEn`) se persiste con **PATCH a la EF `autorizaciones`** existente | (a) Todo por la EF (cliente sube el archivo como body de la función, la EF hace el `storage.upload`); (b) Todo por RPC `SECURITY INVOKER`, sin EF | **vs (a)**: Deno Edge Functions no están pensadas para relayar binarios de hasta 10 MB — agrega un hop, límites de tamaño de body y reimplementa algo ya resuelto: `SupabaseDocumentoRepository.ts` (los 4 dominios documentales) ya sube directo navegador→Storage con RLS, sin pasar por ninguna función. Mismo patrón, no uno nuevo. **vs (b)**: `presupuesto-prestaciones` (change en curso) está migrando la escritura de EF a RPC `SECURITY INVOKER` para el dominio `presupuestos`, pero es su propio D2, todavía no aplicado — adoptarlo acá antes de tiempo acopla el orden de apply de dos changes independientes y el proposal ya lo excluyó explícitamente de alcance. La EF actual sigue siendo la superficie estable y ya autorizada (`requirePermiso('presupuestos', 'write')`) — extenderla es el cambio mínimo |
| **D4** | Volver a agregar `archivo_nombre`/`archivo_cargado_en` a `facturacion.autorizacion` con una migración **nueva** (no depender de la revertida) | Derivar `nombre`/`cargadoEn` de `archivo_url` + `fecha_respuesta`, como hace hoy `mapArchivoUrl` para `Presupuesto` | La derivación existente usa `fechaRespuesta` como proxy de "cuándo se cargó el archivo" — son conceptualmente distintos (fecha de respuesta de la obra social vs. fecha de subida real; una autorización puede tener `fechaRespuesta` sin archivo, o el archivo puede cargarse después de editarla). Reusar ese proxy fabricaría un dato, el mismo antipatrón que el proyecto ya viene corrigiendo (`"MUST NOT enviar un archivoUrl para un archivo recién elegido"`). Columnas reales, nullable, mismo criterio aditivo que el resto de la serie |
| **D5** | Reemplazo compensado: `UPLOAD` objeto nuevo → `PATCH` fila → `DELETE` objeto viejo (best-effort). Si el `PATCH` falla, se borra el objeto recién subido | Orden `DELETE` viejo → `UPLOAD` nuevo → `PATCH` (más simple) | El orden simple deja una ventana sin archivo si el `UPLOAD` nuevo falla después de borrar el viejo. El orden elegido nunca deja la fila apuntando a una clave inexistente (mismo criterio D4 de `integracion-documentos`): en el peor caso queda un objeto huérfano en el bucket (tolerable), nunca un puntero roto |

## Data Flow — subida/reemplazo de archivo

```
AutorizacionForm          storage.objects              EF autorizaciones           facturacion.autorizacion
     │  (File en estado,        (bucket privado)          (PATCH /:id)                    (fila)
     │   no solo metadata)
     │
     ├──1. upload(clave, file, {upsert:false})──▶  RLS: tiene_permiso('presupuestos','write')
     │                                              │
     │◀─────────────── objectPath ─────────────────┘
     │
     ├──2. PATCH {archivoUrl, archivoNombre,
     │           archivoCargadoEn} ────────────────────────▶ requirePermiso('presupuestos','write')
     │                                                           │
     │                                                           ├──UPDATE facturacion.autorizacion──▶ fila
     │                                                           │◀──────────── row ──────────────────┘
     │◀───────────────────────── 200 {…} ───────────────────────┘
     │
     ├──3a. si 2 fue 200 y había clave vieja: remove(claveVieja) [best-effort]
     └──3b. si 2 falló: remove(claveNueva) [compensación] → propaga error en castellano
```

`quitar`: mismo PATCH con `archivoUrl: null, archivoNombre: null, archivoCargadoEn: null` (limpia
la fila) → luego `remove(claveVieja)` best-effort. No hay diagrama aparte por presupuesto de tamaño.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/<ts>_bucket_documentos_autorizaciones.sql` | Create | Bucket `documentos-autorizaciones` + 4 policies RLS por `presupuestos` (D2) |
| `supabase/migrations/<ts>_add_autorizacion_archivo_meta.sql` | Create | Re-agrega `archivo_nombre`/`archivo_cargado_en` SOLO en `facturacion.autorizacion` (D4); `COMMENT ON COLUMN archivo_url` documentando que guarda clave, no URL |
| `supabase/functions/autorizaciones/index.ts` | Modify | `archivo_nombre`/`archivo_cargado_en` en `AutorizacionRow`, `AutorizacionInput`, `toApi`, `toDb`; corregir comentario L11-12 |
| `frontend/src/shared/lib/presupuestos/AutorizacionRepository.ts` | Modify | Nuevos métodos `uploadArchivo(id, file)` / `removeArchivo(id)` (separados de `update()`, mismo criterio que `DocumentoRepository.upload`/`remove`) |
| `frontend/src/shared/lib/presupuestos/SupabaseAutorizacionRepository.ts` | Modify | Implementa D3/D5: upload directo + PATCH + compensación |
| `frontend/src/shared/lib/mocks/mockAutorizacionRepository.ts` | Modify | Implementa los mismos métodos nuevos de la interfaz (in-memory) |
| `frontend/src/shared/lib/presupuestos/autorizacionMapping.ts` | Modify | `archivo` deja de derivarse con `mapArchivoUrl`; lee `archivoNombre`/`archivoCargadoEn` directo |
| `frontend/src/features/presupuestos/AutorizacionForm.tsx` | Modify | Retiene el `File` real en estado (hoy solo guarda metadata derivada); quita `AvisoModeloDatos` del archivo; estado de subida/error |
| `frontend/src/shared/types/presupuesto.ts` | Modify | `ArchivoAdjunto` gana `clave: string` (necesaria para borrar el objeto viejo en el reemplazo) |
| `CHANGES.md`, `knowledge-base/04_modelo_de_datos.md` | Modify | Discrepancia `archivo_url` guarda clave no URL; nota de las 5 buckets |

## Interfaces / Contracts

```ts
// AutorizacionRepository.ts — nuevos métodos, separados de update() a propósito (D3):
uploadArchivo(id: string, file: File): Promise<Autorizacion>;
removeArchivo(id: string): Promise<Autorizacion>;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | `autorizacionMapping.ts` (parseo con/sin metadata), `toDb` de la EF | Vitest puro, sin red |
| Integration | `SupabaseAutorizacionRepository.uploadArchivo`/`removeArchivo` (compensación en fallo de PATCH) | Vitest + mocks de `supabase.storage`/`functions.invoke` |
| E2E | No disponible (`e2e: available:false`) | Verificación manual con 2 cuentas reales (read/write), Success Criteria del proposal |

## Migration / Rollout

Orden de apply: (1) migración de bucket+RLS, (2) migración de columnas (D4), (3) deploy EF, (4)
frontend. Rollback en 3 capas ya definido en el proposal — sin cambios acá, salvo que la capa 3
ahora incluye la migración D4 nueva (no la vieja, que sigue revertida).

## Open Questions

- [ ] G1/G2/G3 (governance ALTO) — requieren confirmación humana explícita antes de aplicar SQL, ya
      señalado en el proposal, no repetido acá.
- [ ] Confirmar con la usuaria/Enzo que reabrir la decisión revertida el 2026-07-30 (D4) es aceptable
      — la reversión fue deliberada, no un descarte accidental de la parte de columnas.
- [ ] Riesgo de acoplamiento con `presupuesto-prestaciones` D2 (migración EF→RPC) — no bloquea este
      design, coordinar orden de apply si ese patrón se extiende a `autorizaciones` (ver D3).
