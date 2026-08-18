# Proposal: Integración del archivo de Autorizaciones con Storage real

## Intent

La clienta reportó que en Autorizaciones "no funciona la carga de archivos". **No es un bug: es un
pendiente conocido y declarado en pantalla.** El archivo elegido en `AutorizacionForm` vive solo en
el estado de React — nunca viaja al servidor. `AutorizacionForm.tsx:97-102` lo dice textualmente
("todavía no se guarda en el servidor… va a llegar en un cambio aparte"), y
`autorizacion-repository-supabase` lo tiene escrito como requisito
(*"MUST NOT enviar un `archivoUrl` para un archivo recién elegido"*).

Este change cierra ese pendiente: la autorización de una obra social **es** el respaldo documental
del presupuesto; sin adjunto persistido, el circuito Presupuesto → Autorización → Facturación queda
sin evidencia. Es el último dominio con carga de archivos simulada junto a Vehículos/Conductores/
Facturas.

## Scope

### In Scope
- Bucket privado nuevo `documentos-autorizaciones` + policies RLS de `storage.objects` gateadas por
  el módulo **`presupuestos`** (ya existente desde `20260730140000_split_modulos_permisos.sql`).
- Subida real del archivo desde el navegador al bucket, con clave determinista
  `{autorizacionId}/{uuid}-{nombreSeguro}` (mismo saneado que `documentoMapping.ts`).
- Persistencia de la referencia vía la Edge Function `autorizaciones` (`archivoUrl` ya soportado;
  `archivoNombre`/`archivoCargadoEn` **hay que agregarlos** a `toApi`/`toDb`).
- Reemplazo del archivo (1 archivo por autorización) y quita del adjunto.
- Retiro del `AvisoModeloDatos` de "todavía no se guarda" en `AutorizacionForm.tsx`.
- Validación de tipo (PDF/JPG/PNG) y tamaño (10 MB) en la capa de aplicación, coherente con
  `storage-buckets`.

### Out of Scope
- **Descarga y previsualización firmada** del adjunto — depende de `documentos-descarga-firmada`,
  que sigue **sin proponerse** (ver `CHANGES.md` §C-03). Acá se muestra nombre + fecha persistidos,
  no se abre el archivo. ⚠️ *Checkpoint para la usuaria: si quiere ver el PDF cargado, este change
  crece o hay que proponer primero `documentos-descarga-firmada`.*
- Checklist multi-documento: el docx modela **un solo "Archivo"** por autorización. No se crea tabla
  `documento_autorizacion`, no se reusa `DocumentChecklist`/`DocumentoRepository`.
- El adjunto de `facturacion.presupuesto` (mismas columnas `archivo_nombre`/`archivo_cargado_en`,
  mismo pendiente) — queda para un change hermano, para no mezclar dos pantallas.
- Migrar la escritura de Edge Function a RPC (eso es alcance de `presupuesto-prestaciones` D2).

## Capabilities

### New Capabilities
- `autorizacion-archivo-storage`: subida, reemplazo y quita del archivo único de la autorización
  contra el bucket privado `documentos-autorizaciones`, con orden de operaciones compensado entre
  Storage y la Edge Function.

### Modified Capabilities
- `storage-buckets`: pasa de **4 a 5** buckets privados; el nuevo se gatea por `presupuestos`.
- `autorizacion-repository-supabase`: se **invierte** el requisito *"El adjunto se mapea sin inventar
  datos"* — ahora sí se envía `archivoUrl`, y `nombre`/`cargadoEn` dejan de derivarse (de la URL y de
  `fechaRespuesta`) para leerse de columnas reales.
- `autorizacion-gestion`: el escenario *"El archivo adjunto todavía no se guarda en el servidor"* se
  reemplaza por su opuesto; se conserva el requisito de archivo único y el de no perder una
  referencia ya persistida al editar otros campos.

## Approach

1. **Migración**: `INSERT` del bucket `documentos-autorizaciones` (`public = false`) + 4 policies
   (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) con `modulos.tiene_permiso('presupuestos', 'read'|'write')`,
   calcadas de `20260729100001_storage_objects_rls.sql`. **Sin tabla nueva ni columna nueva** —
   `archivo_url`, `archivo_nombre` y `archivo_cargado_en` ya existen en `facturacion.autorizacion`.
2. **Edge Function** `autorizaciones/index.ts`: agregar `archivo_nombre`/`archivo_cargado_en` a
   `AutorizacionRow`, `toApi` y `toDb`, y actualizar el comentario de cabecera (L11-12) que hoy
   afirma que no hay nombre/fecha aparte.
3. **Repository**: la subida a Storage va **directa** desde el navegador (`supabase.storage`, RLS del
   bucket), y la fila se escribe por la EF — igual que `SupabaseDocumentoRepository`, con el mismo
   orden compensado (subir objeto nuevo → PATCH fila → borrar objeto viejo; si el PATCH falla, se
   borra el objeto recién subido). Mapeo puro en `autorizacionMapping.ts`.
4. **UI**: `AutorizacionForm` guarda el `File` y lo sube en el submit; sacar el aviso, mostrar estado
   de subida y errores en castellano.

## Affected Areas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `supabase/migrations/<nueva>_bucket_autorizaciones.sql` | New | Bucket + 4 policies RLS |
| `supabase/functions/autorizaciones/index.ts` | Modified | `archivo_nombre`/`archivo_cargado_en` en row/API/DB |
| `frontend/src/shared/lib/presupuestos/SupabaseAutorizacionRepository.ts` | Modified | Subida + compensación |
| `frontend/src/shared/lib/presupuestos/autorizacionMapping.ts` | Modified | `archivo` deja de derivarse |
| `frontend/src/features/presupuestos/AutorizacionForm.tsx` | Modified | `File` real, sin aviso |
| `frontend/src/shared/types/presupuesto.ts` | Modified? | `ArchivoAdjunto` puede necesitar la clave |
| `CHANGES.md`, `knowledge-base/04_modelo_de_datos.md` | Modified | §C-03 y §Discrepancias |

## Risks

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| **`archivo_nombre`/`archivo_cargado_en` podrían no estar aplicadas en producción**: la verificación en vivo del 2026-08-13 (`facturacion-seleccion-autorizacion` `tasks.md` §1.2) listó 9 columnas de `facturacion.autorizacion` y **no las incluyó** | Media | **Task bloqueante §1**: verificar el schema real con `supabase db query --linked` antes de escribir una línea. Si faltan, la migración `20260729160000` no está aplicada y este change la incluye |
| Objeto huérfano en el bucket si falla el PATCH | Media | Orden compensado ya probado en `integracion-documentos`; nunca puntero roto (fila sin archivo) |
| RLS mal gateada expone documentación de obra social | Baja | Módulo `presupuestos` idéntico al que ya gatea la tabla; verificación manual con 2 cuentas reales (read-only / write) antes de cerrar |
| `archivo_url` sigue sin guardar una URL (guarda la clave) | Alta | Discrepancia **ya documentada** para las otras 4 tablas; extender la nota + `COMMENT ON COLUMN` |
| Sin descarga, la usuaria no puede comprobar que subió bien | Alta | Declarado como checkpoint arriba; mientras tanto, nombre + fecha reales son la señal |

## Rollback Plan

Reversible en tres capas independientes, en este orden:

1. **Frontend**: revertir el commit del repository/form → la UI vuelve al mock local y al aviso. No
   depende de la base.
2. **Edge Function**: redeploy de la versión anterior de `autorizaciones` → `archivoNombre`/
   `archivoCargadoEn` dejan de viajar; las columnas quedan con datos, sin romper nada (el mapeo
   viejo ignora columnas desconocidas).
3. **Base**: `DROP POLICY` × 4 sobre `storage.objects` + `DELETE FROM storage.buckets WHERE id =
   'documentos-autorizaciones'`. **Migración de rollback aparte, no `DROP` de columnas** — las
   columnas de metadata son preexistentes y las comparte `facturacion.presupuesto`.
   ⚠️ Borrar el bucket **elimina los archivos ya subidos**: si hay adjuntos reales, el rollback de
   la capa 3 requiere descarga previa y confirmación explícita de la usuaria.

## Dependencies

**Archivados (precedente directo, no bloquean):**
- `C-03 gestion-documental-core` (2026-08-06) — patrón de bucket privado + RLS por módulo.
- `integracion-documentos` (2026-08-07) — orden compensado Storage↔Postgres, saneado de nombre,
  clave determinista, traducción de errores. **Se copia el patrón, no el código**: acá no hay
  `DocumentoRepository` (archivo único, no checklist).
- `pacientes-documentos-multiples`, `documentos-checklist-por-actividad` — refuerzan por qué acá
  **no** aplica multi-documento.
- `C-06 presupuestos-autorizaciones` + `integracion-presupuestos` — EF `autorizaciones` y repository
  real que este change extiende.

**En curso — verificados, sin conflicto:**
- `presupuesto-prestaciones`: su `proposal.md:141-146` declara **"Sin impacto"** sobre
  `AutorizacionForm.tsx`, `autorizacionMapping.ts` y `facturacion.autorizacion`. ⚠️ *Solape indirecto*:
  su **D2** migra la escritura de Edge Function a RPC para `presupuestos`. Si ese patrón se extiende
  después a `autorizaciones`, la capa 2 de este change (EF) habría que rehacerla — **coordinar el
  orden de apply**, no bloqueante.
- `facturacion-seleccion-autorizacion`: **lee** autorizaciones (`autorizacionesPendientes.ts`) pero
  no toca `AutorizacionForm.tsx`, `SupabaseAutorizacionRepository.ts` ni la EF `autorizaciones`. Sin
  conflicto de archivos.

**Bloqueante externo:** ninguno. **Prerequisito de verificación:** schema real confirmado (§1).

## ⚠️ Governance — ALTO

Toca RLS y control de acceso a documentación de obra social. **Requiere confirmación humana explícita
antes de aplicar SQL**, sobre estos tres puntos:

| # | Decisión | Recomendación |
|---|----------|---------------|
| **G1** | Bucket **privado** (`public = false`) | **Sí, privado** — idéntico a los otros 4. Un bucket público expondría documentación de obra social por URL adivinable |
| **G2** | Gateo por el módulo **`presupuestos`** existente, sin crear módulo nuevo | **Sí** — es el módulo que ya gatea `facturacion.autorizacion`; un módulo nuevo dejaría a las cuentas actuales sin permiso |
| **G3** | Alcance de la descarga (out of scope hoy) | Decisión de la usuaria: aceptar "subo pero no veo" o ampliar el alcance |

## Success Criteria

- [ ] Schema real de `facturacion.autorizacion` verificado en vivo antes de escribir código (§1).
- [ ] Un archivo subido en Autorizaciones sobrevive a recargar la página y a reabrir la autorización.
- [ ] `storage.buckets` tiene 5 buckets, los 5 con `public = false`.
- [ ] Una cuenta con `presupuestos: read` ve el nombre del adjunto pero **no puede** subir ni quitar.
- [ ] Una cuenta sin `presupuestos` no puede leer ningún objeto del bucket (verificado en vivo).
- [ ] `archivo_url` nunca contiene `http://` ni `https://` (guarda la clave del bucket).
- [ ] Un fallo del PATCH no deja fila apuntando a un archivo inexistente.
- [ ] El `AvisoModeloDatos` de "todavía no se guarda" ya no aparece en `AutorizacionForm.tsx`.
- [ ] `cd frontend && npx tsc -b --noEmit` y `npx vitest run` en verde, sin `any` ni `as` sobre datos
      externos.
