# Tasks: Integración del archivo de Autorizaciones con Storage real

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450-550 (2 migrations, EF, repo interface+2 impls, mapping, form, types, tests) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 (SQL) → PR2 (Edge Function) → PR3 (Repository+Frontend+tests) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Bucket + RLS + reabrir columnas | PR 1 | Base: main. Mirrors rollback capa 3 (proposal) |
| 2 | Edge Function `autorizaciones` | PR 2 | Base: main (depende de PR1 aplicada en Supabase, no de su branch) |
| 3 | Repository + Frontend + tests | PR 3 | Base: main (depende de PR2 deployada) |

> **Governance ALTO**: PR1 (SQL/RLS) requiere confirmación humana explícita antes de aplicarse (G1/G2/G3 del proposal). `sdd-apply` NO debe ejecutar la migración SQL sin luz verde de la usuaria.

## Phase 1: Migraciones SQL (bloqueante)

- [x] 1.1 **[BLOQUEANTE]** Crear `supabase/migrations/20260818090000_add_autorizacion_archivo_meta.sql`: re-agrega `archivo_nombre`/`archivo_cargado_en` SOLO en `facturacion.autorizacion` (D4). Comentario SQL explicando por qué se reabre `20260730120000_revert_presupuesto_archivo_meta.sql` (mismo criterio de discrepancias del proyecto). `COMMENT ON COLUMN archivo_url` documentando que guarda clave, no URL. Fases 2-4 dependen de esta migración. (2026-08-18)
- [x] 1.2 Crear `supabase/migrations/20260818091000_bucket_documentos_autorizaciones.sql`: `INSERT` bucket `documentos-autorizaciones` (`public=false`) + 4 policies RLS (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) con `modulos.tiene_permiso('presupuestos', 'read'|'write')`, calcadas de `20260729100001_storage_objects_rls.sql`. (2026-08-18)
- [x] 1.3 Verificar en vivo (`supabase db query --linked` o dashboard): 5 buckets con `public=false`, columnas presentes en `facturacion.autorizacion`, policies gateadas por `presupuestos` — Success Criteria del proposal.
      **Confirmado en producción 2026-08-18** tras `supabase db push` (proyecto `pkryfoljypuzfifofdwp`,
      "Sistema de Traslado Personalizado"): `supabase migration list` mostró `local == remote` para
      `20260818090000`/`20260818091000`, y las 4 queries de abajo dieron el resultado esperado
      (5 buckets `public=false`, 2 columnas presentes, 4 policies gateadas por `presupuestos`,
      0 módulos nuevos). SQL de verificación corrido:
      ```sql
      -- 1. Los 5 buckets, todos privados
      SELECT id, public FROM storage.buckets ORDER BY id;

      -- 2. Columnas nuevas en facturacion.autorizacion
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'facturacion' AND table_name = 'autorizacion'
        AND column_name IN ('archivo_nombre', 'archivo_cargado_en');

      -- 3. Las 4 policies del bucket nuevo, gateadas por presupuestos
      SELECT policyname, cmd, qual, with_check FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname LIKE '%documentos-autorizaciones%';

      -- 4. Confirmar que NO se creó ningún módulo nuevo
      SELECT * FROM modulos.modulos WHERE tipo_modulo IN ('autorizaciones', 'documentos-autorizaciones');
      ```
      Resultado esperado: 5 filas en (1) con `public = false`; 2 filas en (2); 4 filas en (3), las
      cuatro con `presupuestos` en `qual`/`with_check`; 0 filas en (4). Adicionalmente,
      `supabase migration list --linked` debe mostrar `local == remote` para ambas migraciones.

## Phase 2: Edge Function

- [x] 2.1 Modificar `supabase/functions/autorizaciones/index.ts`: agregar `archivo_nombre`/`archivo_cargado_en` a `AutorizacionRow`, `AutorizacionInput`, `toApi`, `toDb`. Los tres campos de metadata (`archivoUrl`/`archivoNombre`/`archivoCargadoEn`) se tipan `string | null` en `AutorizacionInput` (no solo `?: string`) porque el flujo de "quitar" (design.md D5) envía los tres explícitamente en `null` en el mismo PATCH — sin esto el tipo no reflejaría un valor que la EF realmente acepta. Verificado con `deno check supabase/functions/autorizaciones/index.ts` (2026-08-18): sin errores. (2026-08-18)
- [x] 2.2 Corregir comentario de cabecera (L11-17) que afirma que no hay nombre/fecha aparte — ya no es cierto tras la migración `20260818090000` de Fase 1 (confirmada en producción). Nuevo comentario documenta que `archivo_url` guarda la clave del objeto (no una URL firmada) y que las tres columnas viajan juntas. (2026-08-18)
- [x] 2.3 Deploy de la función actualizada. **Confirmado en producción 2026-08-18** (`supabase functions deploy autorizaciones --project-ref pkryfoljypuzfifofdwp`, sin Docker corriendo — deploy remoto directo). Pendiente: verificación post-deploy sugerida (`PATCH` real con `archivoNombre`/`archivoCargadoEn` + `GET`) — se puede validar de punta a punta junto con la Fase 3.

> Sin cobertura de test automatizada (no hay Deno test runner configurado en el proyecto) — verificación manual vía PATCH real, igual que el resto de la EF.

## Phase 3: Repository (TDD)

- [x] 3.1 RED — `frontend/src/shared/lib/presupuestos/autorizacionMapping.test.ts`: casos con `archivo_nombre`/`archivo_cargado_en` presentes/ausentes, sin derivar de `fechaRespuesta`. Cubierto en el describe `parseAutorizacionApi — archivo (3.1, integracion-documentos-autorizaciones)` (3 casos: completo con `clave`, ausente no deriva de `fechaRespuesta`, `archivoNombre` sin `archivoCargadoEn` no fabrica un archivo parcial). (2026-08-18)
- [x] 3.2 GREEN — `autorizacionMapping.ts`: leer `archivoNombre`/`archivoCargadoEn` directo (`parseArchivo`), quitar `mapArchivoUrl`. Verificado: el archivo ya no importa `mapArchivoUrl` de `presupuestoMapping.ts`. (2026-08-18)
- [x] 3.3 Modificar `frontend/src/shared/types/presupuesto.ts`: `ArchivoAdjunto` gana `clave`. **Desviación documentada en el propio código**: `clave?: string` (opcional), no `clave: string` a secas como decía la task — `ArchivoAdjunto` es compartido con `Presupuesto`, cuyo flujo de carga real sigue fuera de alcance de este change y no tiene de dónde sacar una `clave` real hoy; forzarla obligatoria hubiera requerido inventar un valor ahí. Para `Autorizacion` siempre viene poblada cuando hay archivo (garantizado por `parseArchivo`). (2026-08-18)
- [x] 3.4 Modificar `AutorizacionRepository.ts`: agregados `uploadArchivo(id, file): Promise<Autorizacion>` / `removeArchivo(id): Promise<Autorizacion>` a la interfaz, con JSDoc explicando D3/D5 e idempotencia. (2026-08-18)
- [x] 3.5 RED — `SupabaseAutorizacionRepository.test.ts`: upload exitoso sin archivo previo, reemplazo (triangulación: borra la clave VIEJA después del PATCH, nunca la nueva), fallo de PATCH (compensa borrando el objeto recién subido, la referencia vieja queda intacta), tipo no soportado y tamaño >10MB rechazados antes de tocar Storage/EF, quitar con archivo (PATCH con los 3 campos en `null` + borra objeto) y quitar sin archivo (idempotente, no llama a Storage ni a la EF), id inexistente en `removeArchivo` lanza el mismo mensaje que `update()`. 12 casos en los describes `uploadArchivo() (3.5/3.6)` y `removeArchivo() (3.5/3.6)`. (2026-08-18)
- [x] 3.6 GREEN — `SupabaseAutorizacionRepository.ts`: implementa D3/D5 (`subirArchivoAutorizacion`: UPLOAD clave nueva → PATCH fila → DELETE clave vieja best-effort; en fallo de PATCH, borra la clave nueva y no toca la vieja), validación de tipo (`application/pdf`/`image/jpeg`/`image/png`) y tamaño (10MB) ANTES de tocar Storage, clave `{autorizacionId}/{uuid}-{nombreSeguro}` vía `construirClaveArchivo` (reusa `nombreArchivoSeguro` de `documentoMapping.ts`, no reimplementado). `quitarArchivoAutorizacion` idempotente si no hay archivo. Verificado con los 12 tests de 3.5 en verde. (2026-08-18)
- [x] 3.7 GREEN — `mockAutorizacionRepository.ts`: implementa `uploadArchivo`/`removeArchivo` in-memory con el mismo contrato (id inexistente lanza, reemplazo genera una clave local distinguible vía `generateId`, remove sin archivo es idempotente sin reescribir el store). 6 tests dedicados en `mockAutorizacionRepository.test.ts` (siembra, persistencia, id inexistente ×2, triangulación de reemplazo, remove sin archivo). (2026-08-18)
- [x] 3.8 REFACTOR — duplicación entre upload/replace/remove ya extraída a helpers compartidos: `obtenerAutorizacion` (GET, usado también por `getById`), `eliminarObjetoBestEffort` (delete tolerante a huérfanos), `mapearErrorStorage`, `validarArchivo`, `construirClaveArchivo`. Suite completa relevante a este change (14 archivos: `AutorizacionRepository`, `SupabaseAutorizacionRepository`, `mockAutorizacionRepository`, `autorizacionMapping`, y los ~10 consumidores en facturación/presupuestos que implementan la interfaz ampliada) corrida bajo Node v24.14.0 (ver nota de entorno más abajo): **13 archivos / 146 tests, 100% verde**. `npx tsc -b --noEmit`: 0 errores. (2026-08-18)

> **Nota de entorno (no bloqueante, no relacionada con este change)**: el `node` del PATH del sistema en este sandbox es v26.0.0 (no gestionado por `nvm`, muy reciente), y bajo esa versión `jsdom` 29.1.1 rompe: `window.localStorage`/`globalThis.localStorage` resuelven a `undefined` pese a tener un getter definido (confirmado con un test de diagnóstico ad-hoc, luego borrado). Esto tumba TODO archivo de test que use `localStorage` en `beforeEach` — ~186 tests en ~26 archivos ajenos a este change (conductores, pacientes, vehículos, obras sociales, hojas de ruta, facturación, presupuestos, incluido `mockAutorizacionRepository.test.ts` de este mismo change). Bajo Node v24.14.0 (disponible vía `nvm use 24.14.0`), el mismo `localStorage` resuelve a `object` normalmente y la suite corre limpia. Se usó Node 24 para toda la verificación de esta Fase 3. Recomendación: fijar la versión de Node del proyecto (`.nvmrc` o `"engines"` en `package.json`) para que CI/otros agentes no tropiecen con lo mismo — no se tocó en este batch por estar fuera del alcance de `integracion-documentos-autorizaciones`.

## Phase 4: Frontend (TDD)

- [x] 4.1 RED — `AutorizacionForm.test.tsx`: describe `AutorizacionForm — subida real del archivo (integracion-documentos-autorizaciones)` (8 casos: upload con id real, triangulación con otro id/archivo — el nombre/fecha mostrados son los que devuelve el repository, nunca el `File.name`/fecha local del navegador —, estado "Subiendo…" mientras la promesa está pendiente, error de upload en castellano sin tocar el archivo mostrado, sin `autorizacionId` avisa que hay que guardar antes de adjuntar, "Quitar archivo" con éxito, "Quitar archivo" con error conserva el archivo, sin archivo no ofrece "Quitar archivo"), más 1 test de wiring en `PresupuestoDetail.test.tsx` (`autorizacionRepository.uploadArchivo` recibe el id real de la autorización editada). Actualizado también el test del cartel de "archivo único" (ya no debe decir "todavía no se guarda en el servidor"). (2026-08-18)
- [x] 4.2 GREEN — `AutorizacionForm.tsx`: retiene el `File` real, sube DIRECTO al elegirlo vía `repository.uploadArchivo(autorizacionId, file)` (independiente del botón "Guardar respuesta" — D3/D5 son I/O separada de los campos planos), botón "Quitar archivo" (`repository.removeArchivo`), estados `archivoBusy`/`archivoError` en castellano ("Guardá la autorización antes de adjuntar un archivo.", mensajes del repository tal cual — ya en castellano desde Fase 3). Nuevos props `autorizacionId?: string` / `repository: Pick<AutorizacionRepository, 'uploadArchivo' | 'removeArchivo'>`; `PresupuestoDetail.tsx` los reenvía (`autorizacion?.id` + `autorizacionRepository`, ya en su scope — no se tocó el context). El `archivo` mostrado es siempre el que devuelve el repository, nunca fabricado desde `File.name` + fecha local (bug que este change corrige, design.md D4). (2026-08-18)
- [x] 4.3 RED+GREEN — cartel de archivo único conservado (discrepancia real docx vs. `CHANGES.md`, single-archivo vs. checklist multi-doc) pero SIN la frase "todavía no se guarda en el servidor" (ya no es cierto). Test actualizado en 4.1. (2026-08-18)
- [x] 4.4 REFACTOR — verificado en verde: `AutorizacionForm.test.tsx` (24/24), `PresupuestoDetail.test.tsx` (12/12), suite completa relevante al change (presupuestos + facturación + mocks): 51 archivos / 478 tests, 100% verde (Node v24.14.0, ver nota de entorno de Fase 3). `npx tsc -b --noEmit`: 0 errores. Sin `any`, sin `style={{}}` inline (verificado con grep). Corrida completa de regresión (`npx vitest run`, todo el repo): 271 archivos / 3015 tests verdes, 6 archivos / 24 tests con fallas preexistentes SIN TOCAR — todas ajenas a Autorizaciones/Presupuestos (`cuentas/PermisosMatrizFields`, `hojas-de-ruta/RecorridoCard` ×14, `obras-sociales/ChecklistEditor` ×2, `pacientes/PacienteDetail` ×2, `pacientes/PacientesPage` ×3, `vehiculos/VehiculosPage` ×2) — mismo hallazgo de entorno (Node 26 + jsdom/localStorage) documentado en Fase 3; el conteo exacto (6/24 hoy vs. 7/~23-25 documentado en Fase 3) varía levemente entre corridas, no investigado por estar fuera de alcance. (2026-08-18)

## Phase 5: Documentación

- [x] 5.1 Actualizado `CHANGES.md` §C-03 (bullet `integracion-documentos-autorizaciones` in-place, de "propuesto, sin aplicar" a "implementado y verificado en verde") y `knowledge-base/04_modelo_de_datos.md` §Discrepancias (item #2 de la lista D13 Presupuestos/Autorizaciones, de "ABIERTA" a "RESUELTA", con nota de que `autorizacion.archivo_url` guarda la clave del objeto en el bucket, no una URL absoluta, mismo criterio que `C-03`/`integracion-documentos`). (2026-08-18)
- [ ] 5.2 **Pendiente de la usuaria** — verificación manual con 2 cuentas reales (read/write) en la app real contra `pkryfoljypuzfifofdwp`, Success Criteria del proposal (sin e2e disponible en el proyecto). No ejecutable por el agente.

---

**Nota de gobernanza**: este tasks.md prepara la implementación. `sdd-apply` (PR1, SQL/RLS) necesita luz verde explícita de la usuaria antes de escribir/ejecutar código — governance ALTO del proposal (G1/G2/G3), no implícita por haber aprobado tasks.
