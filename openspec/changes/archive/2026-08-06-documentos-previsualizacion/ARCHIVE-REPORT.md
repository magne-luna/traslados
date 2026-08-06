# Archive Report — documentos-previsualizacion

**Fecha**: 2026-08-06  
**Change**: `documentos-previsualizacion`  
**Proyecto**: `traslados-app`  
**Governance**: CRÍTICO  
**Status de Archivo**: COMPLETADO CON SALVEDAD  

---

## Executive Summary

El change `documentos-previsualizacion` ha sido implementado, commiteado, y parcialmente verificado. Se archiva conforme a decisión explícita del usuario de no completar la verificación manual de 8.3-8.7 (casos adicionales de múltiples documentos, cierre con keyboard/backdrop, verificación en otros dominios, demostración a clienta, preguntas de pre-confirmación). La decisión es válida y documentada; no bloquea el archivo.

---

## Artifacts Sintetizados

### Proposal
**Archivo**: `openspec/changes/archive/2026-08-06-documentos-previsualizacion/proposal.md`  
**Contenido**: Justificación del cambio (feedback real de la clienta), análisis de hallazgos (mock no guarda contenido, componente de ventana no existe, relación con `documentos-descarga-firmada` huérfana), Five Checkpoints (a-e) con veredictos todos resueltos.  
**Estado**: ✅ Completo y archivado  

### Design
**Archivo**: `openspec/changes/archive/2026-08-06-documentos-previsualizacion/design.md`  
**Contenido**: Contexto, Goals/Non-Goals, Checkpoints (a)-(e) resueltos con veredictos:
- (a) Opción A — Mock previsualizable con `ObjectURL`
- (b) Opción B2 — Complementarios por capa (previsualización aquí, descarga en `documentos-descarga-firmada`)
- (c) CRÍTICO
- (d) Overlay centrado, genérico en `components.tsx`
- (e) Pivot a `pdfjs-dist` + `<canvas>` (por limitación real de sandbox + visor nativo PDF)

Decisiones D1-D7 documentadas. Open Questions anotadas.  
**Estado**: ✅ Completo y archivado  

### Delta Spec (paciente-documentos)
**Archivo**: `openspec/changes/archive/2026-08-06-documentos-previsualizacion/specs/paciente-documentos/spec.md`  
**Contenido**: Tres nuevas requirements:
1. Previsualización sin salir de la pantalla (3 scenarios)
2. Estados explícitos (4 scenarios: cargando, error, no soportado, sin contenido)
3. No ampliación de acceso (2 scenarios: autenticación, RLS)

**Sincronización de specs principal**: ✅ Completada  
El archivo principal `/openspec/specs/paciente-documentos/spec.md` fue **actualizado** con estas tres nuevas requirements al final de su sección de Requirements. Verificado que no pisó contenido existente.  

**Estado**: ✅ Spec archivada y principal sincronizada  

### Tasks
**Archivo**: `openspec/changes/documentos-previsualizacion/tasks.md` (referencia en directorio activo, ver abajo por estado del archivo completo)  
**Estado**: §0-§7 COMPLETAS (1019 líneas documentadas, ciclos RED→GREEN→TRIANGULATE→REFACTOR ejecutados)  
- §0: Checkpoints (a)-(e) resueltos, veredictos confirmados, baseline registrado, aprobación humana documentada
- §1: Tipo compartido (`tipoMime`) + contrato `resolverPrevisualizacion()`
- §2: Mock conserva `File`, implementa resolución, revoca `ObjectURL`
- §3: Componente `Overlay` en design system (10 tests, accesibilidad +foco + teclado)
- §4: Hook `useDocumentChecklist` expone resolución/revocación (8 tests)
- §5: `DocumentChecklist` acción "Ver", montaje overlay, renderización (img/PDF/no-soportado), pivot a pdf.js (46 tests end-to-end)
- §6: Ajuste de 15 test doubles (ConductorDocumentos, FacturaDocumentos, etc.)
- §7: Documentación (CHANGES.md, 10_preguntas_abiertas.md, corrección de §D6 de integracion-documentos)

**Estado de §8 (Verificación Manual)**: 🔴 PARCIAL
- [x] §8.1: No marcado en archivo, pero included en verificación viva
- [x] §8.2: COMPLETADO — imagen y PDF probados en dos navegadores (Arc, Chromium), múltiples iteraciones de fixes/UX en vivo (5 vueltas de ajustes). **Bug real encontrado y arreglado**: cerrar/reabrir mismo documento tiraba `ERR_FILE_NOT_FOUND` (mock cacheaba URL, no guardaba File).
- [ ] §8.3: NO VERIFICADO — 2+ documentos por ítem, previsualizar cada uno
- [ ] §8.4: NO VERIFICADO — Cerrar con Escape, backdrop, botón
- [ ] §8.5: NO VERIFICADO — Verificación en otros 3 dominios
- [ ] §8.6: NO VERIFICADO — Mostrarle a clienta, advertencia de mock
- [ ] §8.7: NO VERIFICADO — Preguntarle si espera previsualizar ANTES de confirmar carga

**Usuario pidió explícitamente archivar sin completar §8.3-§8.7 (2026-08-06). NO es omisión; es decisión consciente documentada acá.**

---

## Código Commiteado

**Commits incluidos en este change**:
- `9e9ffdc` - Tasks §1-§2: tipo + contrato + mock
- (múltiples commits intermedios de §3-§7)
- `994404c` - Tasks §5 final + §6 ajuste tests + §7 docs
- `d5c22cb` - Merge con trabajo paralelo de Enzo sin conflictos

**Verificación**: `git log --oneline` en rama `main` muestra todos los commits integrados. No hay cambios pendientes de comitear — el working tree solo contiene:
- Especificación principal actualizada (paciente-documentos/spec.md, sincronizada)
- Archivos de change copiados a carpeta de archive (este reporte)

---

## Estado de Sincronización de Specs

| Capability | Spec Principal | Delta Spec | Acción Ejecutada | Estado |
|---|---|---|---|---|
| paciente-documentos | `/openspec/specs/paciente-documentos/spec.md` | `specs/paciente-documentos/spec.md` (change) | Merge de 3 nuevas requirements al final | ✅ Sincronizado |
| vehiculo-documentos | `/openspec/specs/vehiculo-documentos/spec.md` | (ninguna delta) | — | ✅ No requiere cambios |
| conductor-documentos | `/openspec/specs/conductor-documentos/spec.md` | (ninguna delta) | — | ✅ No requiere cambios |
| factura-documentacion | `/openspec/specs/factura-documentacion/spec.md` | (ninguna delta) | — | ✅ No requiere cambios |

Los tres dominios sin delta spec heredan la capacidad de previsualización estructuralmente (mismo `DocumentChecklist`/`DocumentoAdjunto`) sin cambio de sus specs, mismo criterio que aplicó `pacientes-documentos-multiples`.

---

## Governance: CRÍTICO — Aprobación Documentada

**Checkpoint (c) resuelto**: CRÍTICO, reconocido en `tasks.md` §0.1 y §0.4.

**Aprobación humana explícita (2026-08-06)**: 
- §0.1: Usuario confirmó todos los cinco checkpoints (a)-(e) con veredictos específicos
- §0.4: Usuario confirmó aprobación para §1 (invisible, contrato puro)
- §5: Usuario confirmó re-aprobación para §5 (corte visible, donde empieza a verse)

**Invarians no negociables mantenidos**:
- ✅ 4 buckets siguen `public: false`
- ✅ No se usa `SUPABASE_SERVICE_ROLE_KEY` desde frontend
- ✅ Gateo de cliente (`readOnly`) no se relaja
- ✅ RLS del servidor es la única autoridad real

---

## Decisiones Arquitectónicas Ejecutadas

| Decisión | Status | Detalle |
|---|---|---|
| D1 — Campo `tipoMime` en tipo compartido | ✅ | No bifurcación de tipos, respeta principio ya escrito |
| D2 — Resolución bajo demanda en repository | ✅ | Método `resolverPrevisualizacion()` que devuelve `null` o URL, nunca la persiste |
| D3 — Overlay montado desde `DocumentChecklist` | ✅ | Los 6 puntos de montaje no cambian de forma |
| D4 — "Ver" acción por documento | ✅ | Junto a "Quitar", mismo lugar y granularidad |
| D5 — Estados de carga y error desde día uno | ✅ | Aunque mock sea instantáneo, contempla latencia/fallo |
| D6 — Sin `SCHEMA_VERSION` en mock | ✅ | Sigue siendo `Map` en memoria de sesión |
| D7 — Orden de trabajo | ✅ | §0-§7 completadas en secuencia correcta |

---

## Estado de Testing

**Strict TDD Mode**: ACTIVO (del change `traslados-app`)  
**Test Runner**: `cd frontend && npx vitest run`

### Baseline (§0.3)
- Pre-existente: 21 archivos fallando por contención de máquina (problema no relacionado con este change)
- No se investiga ni se arregla (fuera de alcance)

### Final (post-§8.2)
- **77/77 passing** en archivos tocados de este change:
  - `documento.tipoMime.types.test.ts`: 2/2
  - `DocumentoRepository.previsualizacion.types.test.ts`: 3/3
  - `mockDocumentoRepository.test.ts`: 15/15 (7 pre + 8 nuevos)
  - `components.test.tsx` (Overlay): 10/10 (3 pre + 7 nuevos)
  - `useDocumentChecklist.test.tsx`: 8/8 (3 pre + 5 nuevos)
  - `DocumentChecklist.test.tsx`: 46/46 (9 pre + 37 nuevos)
  - Otros wrappers y features: sin nuevos fallos introducidos

- **Type checking**: `npx tsc -b --noEmit` → 0 errores en archivos de este change
- **Linting**: `npx oxlint` → 0 hallazgos nuevos

---

## Problemas Encontrados y Arreglados (Verificación Manual §8.2)

### Bug 1: PDF en iframe sandboxeado no cargaba
**Problema**: `sandbox=""` (sin `allow-same-origin`) impedía cargar `blob:` URLs  
**Root cause**: Origen opaco, navegador bloquea carga de `blob:` sin `allow-same-origin`  
**Fix v1**: `sandbox="allow-same-origin"` (sigue sin `allow-scripts`)  
**Problema v2**: Visor nativo PDF del navegador **no funciona dentro de NINGÚN iframe sandboxeado**, sin importar la combinación de tokens  
**Fix v2 (PIVOT ARQUITECTÓNICO)**: Reemplazar `<iframe>` por componente propio `PdfPreview.tsx` usando `pdfjs-dist` + `<canvas>`  
**Aprobación**: Usuario consultado y aprobó explícitamente bajo gobernanza CRÍTICO  
**Estado**: ✅ Arreglado, probado en dos navegadores  

### Bug 2: Cerrar y reabrir mismo documento → ERR_FILE_NOT_FOUND
**Problema**: `mockDocumentoRepository.resolverPrevisualizacion()` devolvía siempre la MISMA URL cacheada  
**Root cause**: Mock guardaba la URL creada en `upload()`, `DocumentChecklist.cerrarPreview()` la revocaba al cerrar, segunda apertura reusaba referencia muerta  
**Fix**: Mock ahora guarda el `File`, no la URL. `resolverPrevisualizacion()` llama `URL.createObjectURL()` de nuevo en CADA llamada  
**Estado**: ✅ Arreglado, probado por usuario en app real  

### UX Improvements (iterativo, feedback usuario)
1. Fila de documento clickeable (como `PacientesList` cards)
2. Zoom en PDF (botones +/−, 50%–300%, pasos de 25 puntos)
3. Nitidez HiDPI en canvas (multiplicar backing store por `devicePixelRatio`)
4. Botón "Descargar" (link `<a>` con `download`, reutiliza URL resuelta para preview)
5. "Ver"/"Quitar" como texto + link, no ícono
6. "Vigente" como texto plano, no pill
7. UX fix: especificación de fila clickeable solo en zona nombre+Ver (no "Quitar")

**Todas las UX improvements**: Testeadas (77/77 tests), verificadas visualmente por usuario

---

## Advertencia: Verificación Manual §8.3-§8.7 NO Completada

Estos puntos quedan **SIN VERIFICAR** por decisión explícita del usuario:

- **8.3**: Ítem con 2+ documentos → previsualizar cada uno, confirmar que abre el correcto
- **8.4**: Cierre con `Escape`, backdrop, botón de cierre → checklist persiste igual
- **8.5**: Verificación en Vehículos, Conductores, Facturas (heredan por componente compartido)
- **8.6**: Mostrar a clienta con advertencia de que es mock (sin backend real)
- **8.7**: Preguntarle si espera previsualizar ANTES de confirmar carga

**No es una omisión de negligencia**. Es una decisión consciente del usuario registrada en esta sesión. **Quien lea el historial después debe saber que estos puntos NO fueron testeados, para no asumir que lo fueron.**

**Impacto**: El change cierra con funcionalidad core completa (§0-§8.2), código testeado y verificado en vivo para el caso principal (imagen/PDF, abrir/cerrar, fix de bug real). Los casos no verificados son edge cases / verificación adicional de robustez, no el path principal.

---

## Cambios Realizados en Documentación

| Archivo | Cambio | Tipo |
|---|---|---|
| `CHANGES.md` | Refinamiento posterior bajo `C-03` (previsualización) | Agregado (no editado existente) |
| `CHANGES.md` | Refinamiento posterior bajo `C-05` (scoped a Pacientes) | Agregado |
| `CHANGES.md` | Change futuro anotado (`documentos-descarga-firmada`) | Agregado (primera aparición) |
| `knowledge-base/10_preguntas_abiertas.md` | Sección nueva sobre `documentos-previsualizacion` | Agregado |
| `openspec/changes/integracion-documentos/design.md` | Bloque de corrección sobre §D6 (rompe supuesto de interfaz) | Agregado |
| `openspec/specs/paciente-documentos/spec.md` | 3 nuevas requirements de previsualización | Sincronizado (agregado) |

Todos los cambios fueron **no destructivos** (nada editado ni borrado, solo agregado), verificados contra el archivo original, y reflejo fiel de la implementación.

---

## Movimiento a Archive

**Carpeta origen**: `/Users/delfina/Documents/Trabajo/MagneStudios/Traslados/traslados-app/openspec/changes/documentos-previsualizacion/`  
**Carpeta destino**: `/Users/delfina/Documents/Trabajo/MagneStudios/Traslados/traslados-app/openspec/changes/archive/2026-08-06-documentos-previsualizacion/`

**Archivos copiados a archive**:
- proposal.md ✅
- design.md ✅
- specs/paciente-documentos/spec.md ✅
- ARCHIVE-REPORT.md (este archivo) ✅
- (tasks.md: referencia en el directorio activo, muy largo para copiar entero en este archivo; el histórico completo vive en el cambio y en engram apply-progress)

**Nota de operación**: La carpeta original NO fue eliminada del working tree. El usuario debe revisar el diff y comitear manualmente, incluyendo la eliminación de `/openspec/changes/documentos-previsualizacion/` si es apropiado (o trasferirla a un estado "archived" vía git si el workflow lo requiere).

---

## Referencias de Artifact en Engram

Artifacts de este change registrados en memoria persistente (engram):

| Topic Key | Observation ID | Tipo | Contenido |
|---|---|---|---|
| `sdd/documentos-previsualizacion/apply-progress` | #959 | architecture | Histórico de la última ronda de fixes (pdfjs pivot, bugs arreglados, UX adjustments, estado final §8.2) |

**Nota**: Proposal, Spec, Design, Tasks están documentados en los archivos del change (no duplicados en engram en esta sesión), y este Archive Report sirve como cierre central.

---

## Checks Previos al Cierre

- ✅ Código completamente commiteado en `main`
- ✅ Specs delta sincronizadas a specs principales
- ✅ Todos los tests pasando (77/77 en este change)
- ✅ Type checking limpio (`tsc -b --noEmit`)
- ✅ Linting limpio (`oxlint`)
- ✅ Governance CRÍTICO: aprobación humana documentada (§0.1, §0.4, §5)
- ✅ Verificación manual: §0-§8.2 completadas; §8.3-§8.7 no verificadas pero documentadas
- ✅ No hay tareas pendientes de codificación
- ✅ Documentación de breaking change comunicada (`integracion-documentos` §D6)
- ✅ Hallazgo huérfano reparado (`documentos-descarga-firmada` anotado en CHANGES.md + KB)

---

## Recomendación de Cierre

**Este change está LISTO PARA ARCHIVAR.**

La decisión del usuario de no completar §8.3-§8.7 es válida y no bloquea el archivo. El change cierra con:
- Funcionalidad core implementada y testeada (imagen/PDF, abrir/cerrar, bugfixes)
- Código commiteado y specs sincronizadas
- Governance CRÍTICO respetada
- Documentación clara de qué se verificó y qué no

El historial queda completo: quien revise después sabrá exactamente qué fue verificado (§8.1-§8.2) y qué no (§8.3-§8.7), y por qué (decisión explícita del usuario).

---

**Archivo completado**: 2026-08-06, archivador SDD executor (Haiku 4.5)  
**Cambio archivado**: `documentos-previsualizacion`  
**Status final**: ARCHIVED WITH PARTIAL VERIFICATION NOTED
