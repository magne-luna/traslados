## Why

Hoy la pantalla Pacientes → "Checklist documental" ya muestra **N bloques**, uno por actividad del
paciente (`documentos-checklist-por-actividad`, archivado 2026-08-07) más un bloque "General". Pero
**los N bloques reciben exactamente la misma lista de ítems**: la de la obra social, y nada más.
Verificado en el código, no asumido — `frontend/src/features/pacientes/PacienteDocumentos.tsx` pasa
literalmente el mismo array en los dos puntos de montaje:

```tsx
// línea 127 — bloque "General"
<PacienteDocumentosChecklist … items={resolucion.items} label={ETIQUETA_GENERAL} … />
// línea 144 — cada actividad
<PacienteDocumentosChecklist … items={resolucion.items} agrupacionId={direccion.id} … />
```

y `resolucion.items` sale de un único origen (`obraSocialRepository.getById(obraSocialId)` →
`obraSocial.checklist`, líneas 55-63). O sea: **la instanciación por actividad ya existe; la
diferenciación de contenido por actividad, no.**

Este change agrega esa segunda mitad: cada bloque de actividad muestra los ítems de la obra social
**más** los ítems propios del *tipo* de esa actividad (escuela, terapia, CET, …), de forma
**aditiva/complementaria** — no reemplazo. El bloque "General" no cambia: sigue mostrando solo los
ítems de la obra social.

### ⚠️ Esta regla de negocio NO está confirmada por la clienta

**Diferencia central respecto de los tres refinamientos anteriores de este mismo dominio.**
`pacientes-documentos-multiples`, `documentos-previsualizacion` y `documentos-checklist-por-actividad`
fueron **feedback real de la clienta (Andrea Pastor)**, transcripto de notas de voz
(`docs/cambios/cambios2-requerimientos.pdf`). Este change **no**: nace de una hipótesis de la usuaria
(Delfina), enunciada en conversación —*"yo creería que cada actividad define los suyos… conviven, es
un complemento"*— y **todavía sin verificar con Andrea**.

Este es exactamente el escenario que el change anterior anticipó y dejó anotado. Su
**Checkpoint (d)** preguntaba *"¿los ~10 ítems son los mismos para la escuela y para la terapia, o
cambian?"* y quedó con este veredicto textual (`archive/2026-08-07-documentos-checklist-por-actividad/tasks.md`
líneas 61-64):

> **VEREDICTO PROVISORIO (2026-08-06, usuaria): asumimos que son los mismos ítems para todas las
> actividades — seguimos con este alcance. ⚠️ Sin confirmar con la clienta todavía (la usuaria
> sospecha que en realidad varían). Si al confirmar resulta que varían, es una extensión aditiva
> sobre lo que este change construye…**

Este propose **es** esa extensión aditiva, y llega **antes** de la confirmación. Por eso, y por regla
dura del proyecto (`CLAUDE.md`: *"Donde no haya respuesta del cliente, implementar con el valor por
defecto documentado en la KB y dejar el campo **configurable**, nunca hardcodeado"* + *"documentar
cualquier discrepancia en los dos lugares a la vez, nunca resolverla adivinando"*), este change:

1. se diseña con un **default documentado** que preserva el comportamiento actual (sin ítems por tipo
   configurados, cada bloque muestra exactamente lo que muestra hoy — cero regresión);
2. mantiene la lista **genuinamente configurable**, nunca una constante hardcodeada en el código;
3. **documenta la discrepancia en los dos lugares** (`knowledge-base/05_reglas_de_negocio.md` RN-FA-08
   / RN-FA-10 + `CHANGES.md` `C-03`/`C-05`) y la muestra en pantalla con `AvisoModeloDatos`;
4. deja la regla como **checkpoint explícito sin veredicto** en `design.md`, bloqueante para `/opsx:apply`.

### Verificado contra el código, no asumido

**1. El origen de los ítems es único y no tiene ninguna dimensión de actividad.**
`PacienteDocumentos.tsx` mantiene un solo estado `Resolucion` con un solo `items: ChecklistItem[]`
(líneas 22-26), poblado exclusivamente desde `obraSocial.checklist`. `ChecklistItem` es
`{ id, nombre, requerido }` (`shared/types/documento.ts`) — no tiene procedencia ni tipo de actividad.

**2. La lista de actividades ya está resuelta y centralizada.**
`features/pacientes/actividadDocumental.ts` expone `obtenerActividadesConChecklist(direcciones)`
(`direcciones.filter(d => d.tipo !== 'domicilio')`) y `etiquetaActividad(direccion)`. El `tipo` que
habría que usar para scopear los ítems nuevos es una unión cerrada ya existente:
`TipoDireccion = 'domicilio' | 'escuela' | 'escuela-especial' | 'terapia' | 'cet' | 'otro'`
(`shared/types/paciente.ts:20`). "Club" (ejemplo de la clienta) cae en `otro` — punto sensible: dos
actividades distintas del tipo `otro` compartirían la misma lista de ítems. Ver Checkpoint (b) de
`design.md`.

**3. El checklist de obra social ya está integrado contra la base real y es relacional.**
`obra_social.requisitos_os (obra_social_id, tipo_documento_id)` +
`obra_social.tipos_documento (id, tipo UNIQUE)` — catálogo **compartido** con Pacientes
(`pacientes.documentos.id_tipo_documento`, `ON DELETE RESTRICT`) y con Facturación
(`facturacion.documento_factura.id_tipo_documento`). Es decir: **el patrón "checklist configurable
relacional" ya existe y funciona**; una lista por tipo de actividad sería su tabla hermana
(`requisitos_actividad`, o el nombre que salga del Checkpoint (a)) reusando el mismo catálogo de
tipos. Precedente arquitectónico directo, no invención.

**4. La dimensión "actividad" ya llegó a la base.** A diferencia del change anterior —que se propuso
cuando `pacientes.documentos` no tenía columna de actividad—, hoy sí la tiene:
`20260807010000_documentos_direccion_id.sql` agregó `direccion_id UUID REFERENCES
pacientes.direcciones(id) ON DELETE RESTRICT` (fue un bug real encontrado en verificación manual: el
repository real ignoraba `agrupacionId` por completo). O sea, la instanciación por actividad es real
end-to-end; lo que falta es de dónde salen los ítems de cada bloque.

**5. Este dominio ya corre contra Supabase real, no contra mock.** `integracion-documentos` está
archivado (2026-08-07): `PacientesRoute.tsx` inyecta `SupabaseDocumentoRepository`. Cualquier fuente
de datos nueva que introduzca este change tiene que llegar **con tabla, RLS y repository reales**, no
como constante en el frontend — esto lo distingue de sus tres antecesores, todos frontend+mock.

## What Changes

- **Cada bloque de actividad pasa a mostrar `ítems de la obra social` + `ítems del tipo de esa
  actividad`**, sumados en una sola lista por bloque. Aditivo, complementario, nunca reemplazo.
- **El bloque "General" no cambia**: sigue mostrando solo los ítems de la obra social. Es la
  documentación que no pertenece a ninguna actividad (CUD, DNI, RHC).
- **Se introduce una fuente de configuración nueva: "ítems requeridos por tipo de actividad"**,
  genuinamente configurable (tabla + RLS + repository + pantalla de administración), nunca
  hardcodeada. **Dónde vive exactamente es el Checkpoint (a), sin veredicto.**
- **Se define el alcance del scope**: ¿solo por `TipoDireccion`, o también por la `descripcion` libre
  de la actividad (para distinguir dos `terapia` entre sí)? **Checkpoint (b), sin veredicto.**
- **Se define el comportamiento de merge/dedup** cuando un ítem coincide entre la lista de la obra
  social y la del tipo de actividad (por `id`, por `nombre` normalizado, o sin dedup).
  **Checkpoint (c), sin veredicto.**
- **Se define dónde se administra** esa configuración: pantalla nueva, o extensión del
  `ChecklistEditor.tsx` existente (`C-04`, obras sociales). **Checkpoint (d), sin veredicto.**
- **Se define si la configuración es global o por obra social** (¿la escuela pide lo mismo para
  OSDE que para IOMA?). **Checkpoint (e), sin veredicto** — es la decisión que más multiplica el
  alcance.
- **Se documenta la discrepancia** de regla de negocio no confirmada en `knowledge-base/05_reglas_de_negocio.md`
  (RN-FA-08 / RN-FA-10), en `CHANGES.md` (`C-03` y `C-05`) y con `AvisoModeloDatos` visible en la
  pantalla de documentación del paciente. **Cuándo se reescribe el texto de las RN es el
  Checkpoint (f)** — la recomendación es documentar la discrepancia ahora y reescribir las RN recién
  cuando haya veredicto real de Andrea.
- **Default documentado y sin regresión**: si no hay ítems configurados para un tipo de actividad, el
  bloque muestra exactamente lo que muestra hoy (solo los de la obra social). El comportamiento actual
  es el caso degenerado del nuevo.

### Lo que este change explícitamente NO hace

- **No confirma la regla de negocio.** La hipótesis sigue siendo una hipótesis hasta que Andrea la
  valide; este change la implementa como configuración vacía por defecto, no como verdad del dominio.
- **No toca la instanciación por actividad** (`obtenerActividadesConChecklist`, `agrupacionId`,
  `direccion_id`, bloque "General", progreso agregado) — todo eso ya está archivado y funciona.
- **No cambia el contrato documental compartido** (`ChecklistItem`, `DocumentoAdjunto`,
  `DocumentoRepository`): la dimensión nueva es sobre **qué ítems se piden**, no sobre la forma del
  documento. Vehículos, Conductores y Facturas no se enteran. (Salvo que el Checkpoint (c) obligue a
  distinguir la **procedencia** de un ítem en la UI — ver ahí.)
- **No implementa el punto 3 del feedback original** (vincular actividad ↔ documentación al
  operar/facturar; exportar/transferir documentación a otro domicilio). Sigue esperando el video que
  el cliente prometió.
- **No escribe ni aplica SQL en la fase de propose.** La migración se escribe en `/opsx:apply`,
  después de que los checkpoints tengan veredicto, y con RLS en el mismo cambio que crea la tabla
  (regla dura del proyecto).
- **No decide quién administra `obra_social.tipos_documento`** (pregunta abierta preexistente,
  `knowledge-base/10_preguntas_abiertas.md:129`).

## Capabilities

> **Actualizado 2026-08-10 (tasks.md 1.8), con los veredictos de 1.2/1.5/1.6 en mano.** Los tres
> checkpoints que condicionaban esta sección ya están resueltos: (a)=tabla `requisitos_actividad` en
> el schema `obra_social` reusando `tipos_documento` (1.2); (e)=global por tipo, sin `obra_social_id`
> (1.5); (d)=pantalla propia, no extensión de `ChecklistEditor.tsx` (1.6, consistente con 1.5=global:
> una pantalla que vive dentro de la ficha de una obra social puntual sugeriría que la configuración
> es de esa obra social, y no lo es — ver `design.md` Checkpoint (d), segunda fila de la tabla).

### New Capabilities

- **`checklist-por-tipo-actividad`** (`openspec/changes/documentos-checklist-items-por-actividad/specs/checklist-por-tipo-actividad/spec.md`):
  pantalla propia de administración de "ítems requeridos por tipo de actividad" — alta/baja de ítems,
  marcar requerido, reordenar, reusando `ChecklistEditor`/`ChecklistItemRow` y el design system. Nace
  como capability nueva (no como delta de `obra-social-checklist-editor`) porque la configuración es
  **global por tipo de actividad** (veredicto 1.5), no por obra social: vive en su propia ruta,
  gateada por el módulo `obra_social` (mismo módulo que gatea `requisitos_os` hoy, veredicto 1.2),
  pero fuera de la ficha de ninguna obra social puntual.

### Modified Capabilities

- `paciente-documentos` (`openspec/specs/paciente-documentos/spec.md`): el requisito *"Ítems filtrados
  por la obra social del paciente"* deja de ser la **única** fuente de ítems para los bloques de
  actividad. Se agrega el requisito de que cada bloque de actividad muestre la unión de los ítems de
  la obra social y los ítems configurados para el **tipo** de esa actividad, y de que el bloque
  "General" conserve solo los de la obra social. Todos los requisitos ya existentes (reusar
  `DocumentChecklist`, cardinalidad múltiple, previsualización, instanciación por actividad, progreso,
  aislamiento entre actividades) siguen vigentes **sin cambios**.

- `documento-avisos-modelo-datos` (`openspec/specs/documento-avisos-modelo-datos/spec.md`): se agrega
  la obligación de documentar la regla "ítems por tipo de actividad" como **discrepancia no
  confirmada** en los tres lugares del proyecto (KB §Discrepancias, notas `⚠️` en RN-FA-08/RN-FA-10, y
  `CHANGES.md` `C-03`/`C-05`), más el `AvisoModeloDatos` en pantalla.

### Capabilities NO afectadas

- `obra-social-checklist-editor` (`openspec/specs/obra-social-checklist-editor/spec.md`): **no recibe
  delta.** El veredicto 1.6 (pantalla propia) descartó la extensión de este editor — queda intacto,
  sigue administrando exclusivamente el checklist **por obra social** (RN-FA-08), sin ninguna noción
  de tipo de actividad.

- `paciente-direcciones`: este change no toca el editor de direcciones ni la advertencia al quitar una
  actividad con documentos (ya archivada).
- `vehiculo-documentos`, `conductor-documentos`, `factura-documentacion`: el contrato compartido no
  cambia; los ítems de esos tres dominios siguen saliendo de donde salen hoy.

## Impact

**Código a modificar** (alcance exacto condicionado a los Checkpoints (a), (b), (d) y (e)):

- `frontend/src/features/pacientes/PacienteDocumentos.tsx` — hoy pasa `resolucion.items` a los N+1
  bloques por igual (líneas 127 y 144); pasaría a componer, por bloque de actividad, la lista
  combinada. El bloque "General" queda igual.
- `frontend/src/features/pacientes/actividadDocumental.ts` — candidato natural para la función pura de
  combinación (`itemsDeActividad(base, porTipo, direccion)`), en línea con el criterio ya escrito ahí:
  *"criterio único, nunca un `filter` inline repetido en cada componente"*. Función pura ⇒ TDD directo.
- **Repository nuevo o extensión de `ObraSocialRepository`** (`frontend/src/shared/lib/…`) — según
  Checkpoints (a) y (e). Hoy `ObraSocialRepository` tiene 4 métodos (`list`, `getById`, `create`,
  `update`) y no conoce tipos de actividad.
- **Pantalla de administración** — `frontend/src/features/obras-sociales/ChecklistEditor.tsx`
  (extensión) o pantalla nueva, según Checkpoint (d).
- `frontend/src/features/pacientes/PacienteDetail.tsx` — cartel `AvisoModeloDatos` de regla no
  confirmada (la sección de documentación ya tiene uno del change anterior; hay que decidir si se suma
  o se reescribe).
- Tests: `PacienteDocumentos.test.tsx`, `actividadDocumental.test.ts`, más los del repository/pantalla
  nuevos. Strict TDD activo (`openspec/config.yaml`, `testing.strict_tdd: true`), runner
  `cd frontend && npx vitest run`.

**Sin impacto esperado**

- `frontend/src/shared/components/DocumentChecklist.tsx` — recibe `items` y los renderiza; no le
  importa de dónde salieron. **No debe cambiar** (salvo veredicto del Checkpoint (c) que exija mostrar
  la procedencia de cada ítem).
- `frontend/src/shared/types/documento.ts` y `DocumentoRepository` — la forma del documento no cambia.
- `pacientes.documentos` (tabla real) — no se toca; `direccion_id` ya existe y ya se usa.
- Vehículos, Conductores, Facturación.

**Base de datos**

- **En propose no se escribe ni se aplica SQL.** La forma probable (a confirmar en `design.md` y
  escribir en apply) es una tabla de requisitos por tipo de actividad que **reusa el catálogo
  existente** `obra_social.tipos_documento`, con `tipo_lugar` del enum ya existente
  `pacientes.tipo_direccion`, y `UNIQUE` sobre la combinación — espejo estructural de
  `obra_social.requisitos_os`.
- **RLS obligatoria en la misma migración que cree la tabla** (regla dura del proyecto). El módulo que
  la gatea depende del Checkpoint (d)/(e): `obra_social` si la configuración es del dominio obra
  social, `pacientes` si es del dominio paciente. Decidirlo mal expone configuración a un perfil que
  no debería verla — se resuelve con veredicto, no por defecto.
- Trigger de auditoría (`auditoria.log_action()`) como toda tabla de configuración del proyecto.

**Dependencias**

- Requiere (ya cumplido y archivado): `C-03-gestion-documental-core`, `pacientes-documentos-multiples`,
  `documentos-previsualizacion`, `documentos-checklist-por-actividad`, `integracion-documentos`,
  `C-04-obras-sociales-prestadores` + `integracion-obra-social` (checklist relacional real).
- **Bloqueado por**: confirmación de la regla de negocio con Andrea Pastor. Sin eso, `/opsx:apply` no
  arranca (governance CRÍTICO + regla dura de no resolver reglas de negocio adivinando).

**Riesgo y rollback**

- **Riesgo principal (regla de negocio)**: se construye configuración para una regla que la clienta no
  pidió. Mitigación: default vacío ⇒ comportamiento idéntico al actual; la funcionalidad queda
  disponible pero inactiva hasta que alguien la configure. Si Andrea la rechaza, no hay que revertir
  nada urgente — alcanza con no configurar ítems.
- **Riesgo de scope creep**: si el Checkpoint (e) se resuelve por "por obra social × tipo de
  actividad", la matriz de configuración se multiplica (N obras sociales × 5 tipos) y la pantalla de
  administración deja de ser una extensión menor.
- **Riesgo de UX**: los bloques ya son largos (~10 ítems × N actividades); sumar ítems por tipo los
  alarga más. Se resuelve reusando el design system (`Section`, `Chip`, `ProgressBar`,
  `SectionBadge`), nunca markup ad-hoc ni `style={{}}`.
- **Riesgo de datos**: ninguno inmediato — no se migra ni se reescribe ningún documento existente. Los
  documentos ya cargados conservan su `itemId` y su `direccion_id`. **Pero**: si un ítem por tipo de
  actividad se quita de la configuración después de que ya hay documentos cargados contra él, esos
  documentos quedan sin ítem visible en el checklist. `ON DELETE RESTRICT` sobre
  `tipos_documento` ya cubre el catálogo compartido; la tabla nueva necesita su propia decisión.
- **Governance: CRÍTICO** — mismo criterio que los tres refinamientos anteriores de este dominio
  (`pacientes-documentos-multiples`, `documentos-previsualizacion`,
  `documentos-checklist-por-actividad`) y que `C-05`: datos de salud de personas con discapacidad,
  incluidos menores. Además, este change **sí** crea tabla nueva con RLS (los tres anteriores eran
  frontend puro). Aprobación humana explícita antes de que apply escriba una línea.
- **Rollback**: revertir los archivos de frontend; la migración se revierte con el `DROP TABLE` de su
  bloque de rollback (aditiva, ninguna tabla existente se altera).
