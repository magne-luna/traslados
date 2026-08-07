## Context

**Arquitectura actual, verificada leyendo los archivos, no asumida.**

El checklist documental del paciente hoy se ancla al paciente entero, en un único punto de montaje:

```
PacienteDetail.tsx
├── <Section label="Traslados" title="Direcciones">
│     └── <DireccionesEditor direcciones={paciente.direcciones} onChange={…} />   ← N actividades
│
└── <Section label="Documentación" title="Checklist documental">                  ← 1 solo bloque
      └── <PacienteDocumentos pacienteId={paciente.id} obraSocialId={…} … />
            └── (resuelve ObraSocial.checklist)
                  └── <PacienteDocumentosChecklist pacienteId items repository />
                        └── useDocumentChecklist('paciente', pacienteId, items, repository)
                              └── repository.listByEntity('paciente', pacienteId)
                                    └── mockDocumentoRepository → Map keyed by `paciente:${id}`
                        └── <DocumentChecklist items documentos … />              ← compartido x4
```

Las dos `Section` son hermanas y **hoy no se conocen entre sí**: `DireccionesEditor` nunca ve
documentos, `PacienteDocumentos` nunca ve direcciones. La única clave de agrupación del dato
documental es `(entidad, entidadId)` — no existe ningún nivel intermedio en ninguna capa (tipo,
repository, hook, componente).

**No existe entidad "actividad" en el modelo.** Lo más cercano, y sorprendentemente cercano, es
`Direccion` (`shared/types/paciente.ts`):

```ts
export type TipoDireccion = 'domicilio' | 'escuela' | 'escuela-especial' | 'terapia' | 'cet' | 'otro';

export interface Direccion {
  id: string;
  tipo: TipoDireccion;
  calle: string;
  localidad: string;
  descripcion?: string;   // "diferenciar dos direcciones del mismo tipo (ej. dos `terapia`:
  dias?: string;          //  'Kinesióloga' vs 'Fonoaudióloga')" — comentario del propio tipo
  horario?: string;
}
```

Los ejemplos que da la clienta (*escuela, terapia(s), club*) mapean casi uno a uno contra esa unión
cerrada — "club" caería en `otro`. Y el caso difícil del pedido ("si el paciente tiene varias
terapias, habrá varios bloques") **ya está resuelto**: `descripcion` existe exactamente para eso, a
pedido directo de la usuaria (discrepancia documentada en `knowledge-base/04_modelo_de_datos.md`
§Discrepancias, columna real `pacientes.direcciones.descripcion` desde
`20260806150000_direcciones_descripcion.sql`).

**El contrato documental es compartido por cuatro dominios y ya se movió dos veces este mes.**
`shared/types/documento.ts` declara en su cabecera: *"el mismo checklist/documento se reusa en
Pacientes, Vehículos, Conductores y Facturas — solo cambia la entidad y la lista de items, **nunca la
forma del dato**"*. Estado actual tras los dos changes hermanos:

```ts
export interface DocumentoAdjunto {
  id: string;              // ← pacientes-documentos-multiples
  itemId: string;
  nombreArchivo: string;
  subidoEn: string;
  vigenciaDesde?: string;  // ← pacientes-documentos-multiples
  tipoMime?: string;       // ← documentos-previsualizacion
}

interface DocumentoRepository {
  listByEntity(entidad, entidadId): Promise<DocumentoAdjunto[]>;
  upload(entidad, entidadId, itemId, file, vigenciaDesde?): Promise<DocumentoAdjunto>;
  remove(entidad, entidadId, documentoId): Promise<void>;
  resolverPrevisualizacion(entidad, entidadId, documentoId): Promise<string | null>;  // 4.º método
}
```

**Vehículos, Conductores y Facturas no tienen actividades repetibles.** Un vehículo no va a la
escuela. Esa asimetría es el eje del Checkpoint (b): es el primer refinamiento de esta serie que
**no** es homogéneo entre los cuatro dominios.

**La base real NO soporta esta dimensión — al revés que el punto 1.**

```sql
CREATE TABLE pacientes.documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes.paciente(id) ON DELETE CASCADE,
    id_tipo_documento UUID NOT NULL REFERENCES obra_social.tipos_documento(id) ON DELETE RESTRICT,
    archivo_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Ninguna columna de dirección/actividad. En `pacientes-documentos-multiples` la respuesta fue "la base
ya lo permite, cero migración"; acá es lo contrario. Precedente de que la FK es viable y ya se usa en
producción del proyecto: `facturacion.facturas.domicilio_id UUID REFERENCES pacientes.direcciones(id)`
(`20260730100000_schema_factura_gaps.sql:29`) — Facturación **ya** referencia un domicilio del paciente
por id. Ver Checkpoint (h) para la guía de migración futura (no vinculante, no se escribe acá).

**Sigue sin haber backend documental conectado.** No existe `SupabaseDocumentoRepository.ts` (glob
sobre el árbol), e `integracion-documentos` está **propuesto pero no aplicado** (1/55 tasks). Ese
change ya lleva **una corrección registrada** por un refinamiento que aterrizó después
(`documentos-previsualizacion` le agregó el 4.º método al contrato — `integracion-documentos/design.md`
líneas 436-453). Si el Checkpoint (b) toca el contrato, sería la **segunda**. No es un riesgo
hipotético: es un patrón que ya ocurrió.

**Gobernanza.** Mismo encuadre que los dos hermanos: dominio Pacientes (datos de salud de personas con
discapacidad, incluidos menores), pantalla `PacienteDetail`. Ver Checkpoint (g).

---

## Goals / Non-Goals

**Goals**

- Que el checklist documental del paciente se instancie **una vez por actividad** del paciente, no una
  sola vez por paciente — cada actividad con su propio juego de ítems y su propio estado de carga.
- Que dos actividades del mismo tipo (dos terapias) tengan checklists **independientes y
  distinguibles**, sin que un documento de una aparezca en la otra.
- Que la tercera dimensión (actividad) se componga limpiamente con la segunda ya existente
  (N documentos por ítem, con vigencia) — el total es actividades × ítems × versiones, tal como lo
  describe el feedback.
- Que Vehículos, Conductores y Facturas **no cambien de comportamiento ni de UI** — la dimensión nueva
  es específica de Pacientes.
- Dejar documentada la forma que necesitará `pacientes.documentos` el día que exista integración real,
  sin escribirla.

**Non-Goals**

- **No implementa el punto 3** del feedback (vincular la actividad seleccionada con su documentación
  al operar/facturar; exportar o transferir documentación a otro domicilio). Falta el video prometido
  por el cliente.
- **No conecta backend real** ni escribe/aplica SQL.
- **No agrega comportamiento a los otros tres dominios documentales.**
- **No rediseña `DireccionesEditor`** más allá de lo que exija el Checkpoint (e).
- **No toca Hojas de Ruta** (`pacientes.recorridos`, tramo ida/vuelta, RN-HR-02).
- **No define quién administra `obra_social.tipos_documento`** (`10_preguntas_abiertas.md:129`).

---

## Checkpoint (a) — ¿Qué es una "actividad"?

**El problema.** La clienta dice "domicilios/actividades" indistintamente y da ejemplos de lugares
(escuela, terapia, club). No existe entidad `Actividad` en el modelo. Hay que decidir a qué se ancla
el checklist antes de cualquier otra decisión — los checkpoints (b) a (f) dependen de esta.

| Opción | Qué implica | A favor | En contra |
|---|---|---|---|
| **A. Reusar `Direccion`** ✅ recomendada por este propose | El checklist se ancla a `Direccion.id`. Cero entidad nueva. "Actividad" pasa a ser el nombre de negocio de una `Direccion` que no es el domicilio | `TipoDireccion` ya cubre escuela / escuela-especial / terapia / CET; `descripcion` ya resuelve "dos terapias distinguibles" (pedido directo de la usuaria); la tabla real `pacientes.direcciones` existe, tiene RLS y ya la referencia `facturacion.facturas.domicilio_id`; la clienta habla de "domicilios/actividades" como sinónimos, no como dos cosas | Obliga a decidir si el `tipo: 'domicilio'` (la casa) también lleva checklist — ver sub-pregunta. El nombre del tipo (`Direccion`) no dice "actividad", puede confundir a quien lea el código sin contexto |
| B. Entidad nueva `Actividad` | `Paciente 1—N Actividad`, cada una con FK opcional a una `Direccion` | Nombre explícito; permitiría atributos propios de actividad (prestador, frecuencia) el día que hagan falta | Duplica un concepto que ya existe: hoy toda "actividad" que describió la clienta **es** un lugar al que el paciente va. Sin respaldo en `docs/core/Traslados-Modelo-Datos.docx` (que ni siquiera tiene `descripcion` en direcciones). Obligaría a migrar direcciones existentes a actividades y a mantener las dos listas sincronizadas en la UI |
| C. Anclar al `Recorrido` (`pacientes.recorridos`) | El checklist cuelga del viaje (dir. inicial + final + día + hora) | Es lo que más se parece a "un traslado concreto" | Un recorrido es un **viaje**, no una actividad: una misma terapia genera varios recorridos (ida, vuelta, varios días). El checklist se multiplicaría por día de la semana — mucho más de lo que pidió la clienta. Además `Recorrido` vive en Hojas de Ruta, no en la ficha del paciente |

**Sub-pregunta obligatoria si se elige A:** ¿el `tipo: 'domicilio'` (la casa del paciente) lleva
checklist propio? Intuición de este propose: **no** — la documentación de la casa es la del paciente,
no la de una actividad. Pero eso implica que sigue habiendo un bloque "general" (ver Checkpoint (c)) y
que la lista de actividades con checklist es `direcciones.filter(d => d.tipo !== 'domicilio')`, lo cual
es una regla de negocio nueva que **la clienta no enunció**. La alternativa (todas las direcciones
llevan checklist, incluido el domicilio) es más simple y más literal respecto del texto ("cada
actividad/domicilio que tenga el paciente"). **Sin veredicto.**

**Recomendación de este propose: A**, con la sub-pregunta del `domicilio` resuelta explícitamente por
la clienta antes de codear.

---

## Checkpoint (b) — ¿Dónde vive la dimensión "actividad"? (decisión central)

**El problema.** El contrato documental es compartido por cuatro dominios y su cabecera promete "nunca
la forma del dato". Tres de los cuatro dominios **no tienen actividades**. Hay tres formas de meter la
tercera dimensión, con consecuencias muy distintas para esos tres dominios y para
`integracion-documentos`.

| Opción | Forma | A favor | En contra |
|---|---|---|---|
| A. Composición pura con `entidadId` compuesto | Pacientes monta N `<DocumentChecklist>`, cada uno con `useDocumentChecklist('paciente', \`${pacienteId}:${direccionId}\`, …)`. **Cero cambios** en tipo, repository, hook y componente compartido | Cambio mínimo, contrato intacto, los otros tres dominios ni se enteran, `integracion-documentos` no se desactualiza | El `entidadId` compuesto es un identificador **sintético codificado en un string**: el día que exista `SupabaseDocumentoRepository` hay que *parsear* ese string para saber a qué paciente y a qué dirección corresponde (`paciente_id` y `direccion_id` son dos columnas, no una). Es deuda encubierta — el contrato queda mintiendo sobre lo que `entidadId` significa. Además rompe `resolverPrevisualizacion(entidad, entidadId, documentoId)`, que verifica pertenencia por `entidadId` |
| **B. Agrupación opcional explícita en el contrato** ✅ recomendada por este propose | `DocumentoAdjunto` gana `agrupacionId?: string`; `listByEntity(entidad, entidadId, agrupacionId?)` y `upload(…, agrupacionId?)` la aceptan. Pacientes pasa el `Direccion.id`; los otros tres dominios pasan `undefined` y se comportan exactamente igual que hoy. **`DocumentChecklist.tsx` no cambia**: la UI de agrupación (N bloques) la resuelve Pacientes por composición | Explícito y tipado — nada de parsear strings. Mapea 1 a 1 contra la columna futura `direccion_id UUID NULL`. Opcional ⇒ los otros tres dominios quedan literalmente iguales (`undefined` = sin agrupación). Mantiene el principio "un solo componente compartido": el componente sigue siendo agnóstico, quien agrupa es la pantalla | Toca el contrato compartido por tercera vez este mes ⇒ ajuste mecánico en los tests de los cuatro dominios y **segunda** corrección a anotar en `integracion-documentos`. Nombre a decidir: `agrupacionId` (genérico, no le impone "actividad" a Vehículos) vs `actividadId`/`direccionId` (más legible en Pacientes, sin sentido en los otros tres) |
| C. Agrupación dentro de `DocumentChecklist` | El componente compartido gana una prop `grupos: { id, label, items }[]` y renderiza los N bloques él mismo | Un solo lugar donde vive el render de "N bloques"; si mañana Facturas quisiera agrupar, ya está | Le mete a un componente que 3 de 4 dominios usan sin agrupación una segunda forma de renderizarse (con/sin grupos), duplicando ramas de render y de tests para un caso que solo Pacientes necesita. Contradice el principio de la cabecera del tipo más fuerte que la opción B (que solo agrega un campo opcional al **dato**, no una segunda personalidad al **componente**) |

**Recomendación de este propose: B**, con el nombre `agrupacionId` (genérico) en el contrato compartido
y el nombre de negocio ("actividad") viviendo solo en la capa de Pacientes. La UI de N bloques se
resuelve por composición en `PacienteDocumentos.tsx`, sin tocar `DocumentChecklist.tsx`. **No es la
decisión final** — es la decisión más cara de revertir de este change, así que es la que más
explícitamente necesita veredicto.

**Forma propuesta si se confirma B** (ilustrativa, no aplicada):

```ts
export interface DocumentoAdjunto {
  id: string;
  itemId: string;
  /** Agrupa documentos dentro de una misma entidad — en Pacientes, la actividad/dirección a la que
   * pertenece este documento (documentos-checklist-por-actividad). `undefined` = sin agrupación:
   * el caso de Vehículos/Conductores/Facturas y el de la documentación general del paciente
   * (Checkpoint (c)). Opcional a propósito: los documentos cargados antes de este change no la
   * tienen. */
  agrupacionId?: string;
  nombreArchivo: string;
  subidoEn: string;
  vigenciaDesde?: string;
  tipoMime?: string;
}
```

---

## Checkpoint (c) — ¿Qué pasa con la documentación que hoy cuelga del paciente entero?

**El problema.** Todo documento existente hoy tiene `(paciente, pacienteId)` y ninguna actividad. Al
introducir la dimensión, hay que decidir dónde aparecen esos documentos — y si sigue existiendo un
lugar donde cargar documentación que **no** es de ninguna actividad puntual (CUD, DNI, RHC del
paciente).

| Opción | Qué implica | A favor | En contra |
|---|---|---|---|
| **A. Bloque "General" que convive con los de actividad** ✅ recomendada | `agrupacionId === undefined` ⇒ bloque "Documentación general del paciente", primero, arriba de los bloques por actividad | Nada se pierde ni se esconde; los documentos previos siguen visibles sin migración; cubre documentos que genuinamente no son de una actividad (CUD, DNI); es la degradación natural de un campo opcional | La clienta no lo pidió explícitamente — es una lectura de este propose, no del texto. Si en realidad **toda** la documentación es por actividad, el bloque general queda como ruido permanente |
| B. Asignación forzada | Al abrir la pantalla, todo documento sin actividad exige que el usuario le asigne una | Modelo limpio: no existe documento huérfano | Trabajo manual sobre datos ya cargados, con una pantalla nueva de asignación que nadie pidió; y no hay adónde mover un CUD si el CUD no es de ninguna actividad |
| C. Los documentos previos se muestran solo en la primera actividad | Migración implícita | Ninguna ventaja real | Arbitrario y silencioso: reasigna datos de la usuaria sin que ella lo sepa. Descartada |

**Recomendación: A.** Hoy el costo de equivocarse es cero (el mock es memoria de sesión y
`pacientes.documentos` tiene 0 filas reales según `integracion-documentos/design.md:38`), pero la
decisión define la forma del dato para siempre. **Sin veredicto.**

---

## Checkpoint (d) — ¿El checklist de cada actividad es siempre el mismo?

**El problema.** Hoy los ítems salen de `ObraSocial.checklist` (RN-FA-08, `paciente-documentos` spec:
*"El sistema MUST NOT usar una lista de documentos genérica única"*). El feedback dice *"cada actividad
tiene su propio juego de documentación (su propio checklist de ~10 ítems)"* — ambiguo: puede leerse
como "el mismo checklist, repetido" o como "un checklist distinto por actividad".

| Opción | A favor | En contra |
|---|---|---|
| **A. El mismo checklist de la obra social, replicado por actividad** ✅ recomendada | Lectura literal del punto 2 del PDF (*"el checklist… **se repite** por cada actividad"*, y "varios bloques de ~10 ítems", siempre ~10, no "distintos"). No toca `ObraSocialRepository`, `ChecklistEditor` ni `obra_social.tipos_documento`. Alcance acotado | Si la clienta en realidad necesita ítems distintos por tipo de actividad, hay que volver a abrir el tema |
| B. Checklist configurable por tipo de actividad | Más flexible | Change **mucho** más grande: el checklist deja de ser propiedad de la obra social y pasa a ser propiedad de (obra social × tipo de actividad); toca `ObraSocial`, el editor de checklists, la tabla `obra_social.tipos_documento` y probablemente la RLS. Nada en el feedback pide esto explícitamente |

**Recomendación: A.** **Sin veredicto** — es una pregunta corta pero de alcance enorme si la respuesta
es B; conviene preguntársela a la clienta con esas palabras: *"¿los ~10 ítems son los mismos para la
escuela y para la terapia, o cambian?"*.

---

## Checkpoint (e) — Quitar o editar una actividad que ya tiene documentación cargada

**El problema.** `DireccionesEditor.tsx` hoy permite "Quitar" una dirección con un click, sin
confirmación (`onChange(direcciones.filter(d => d.id !== id))`) — es inocuo porque de una dirección no
cuelga nada. Con un checklist de ~10 ítems × N versiones colgando, deja de serlo. Ninguna de las dos
secciones se conoce hoy, así que este acoplamiento es **nuevo** y hay que decidirlo, no descubrirlo en
producción.

| Opción | Qué implica | A favor | En contra |
|---|---|---|---|
| **A. Advertencia explícita antes de quitar** ✅ recomendada | Si la actividad tiene ≥1 documento, se avisa cuántos se van a perder y se pide confirmación. Requiere que `DireccionesEditor` sepa cuántos documentos tiene cada dirección (dato que hoy no recibe) | Evita pérdida silenciosa de documentación clínica — dominio CRÍTICO, el criterio del proyecto es no destruir sin avisar | Acopla `DireccionesEditor` al dominio documental (hoy independientes). Delta spec sobre `paciente-direcciones` |
| B. Bloquear el borrado mientras haya documentos | Equivalente a `ON DELETE RESTRICT` en la UI | Máxima protección | Deja a la usuaria sin salida operativa si cargó una actividad por error y ya subió algo |
| C. Sin protección (comportamiento actual) | Quitar la dirección deja los documentos huérfanos o los borra en cascada | Cero trabajo | Pérdida silenciosa de documentación de salud con un click. Inaceptable para el nivel de gobernanza de este dominio |

**Recomendación: A.** Además hay que decidir el correlato en base de datos para el futuro
(`ON DELETE RESTRICT` vs `SET NULL` sobre `direccion_id`) — ver Checkpoint (h). **Sin veredicto.**

**Editar** una dirección (cambiar calle o tipo) **no** afecta la relación: el `id` no cambia, los
documentos siguen colgando de la misma actividad. No hace falta decisión ahí.

---

## Checkpoint (f) — Cómo se calcula el progreso ("X de Y cargados")

**El problema.** Hoy `DocumentChecklist` calcula `cargados / items.length` y muestra una `ProgressBar`
por checklist. Con N checklists hay N barras — y la pregunta de si existe además un total.

| Opción | A favor | En contra |
|---|---|---|
| **A. Progreso por actividad + total agregado en el encabezado** ✅ recomendada | Responde las dos preguntas que la usuaria realmente se hace ("¿me falta algo de esta terapia?" y "¿este paciente está completo?"). El cálculo por actividad ya existe sin cambios en el componente compartido; el total es un cálculo nuevo en `PacienteDocumentos.tsx` | Un elemento visual más en una pantalla que ya se alarga |
| B. Solo por actividad | Cambio mínimo, cero lógica nueva | Se pierde la vista de "¿cómo viene este paciente en total?" que hoy sí existe (hay una sola barra y es el total) — sería una **regresión funcional** respecto de lo que la usuaria ve hoy |
| C. Solo total | Mantiene la pantalla corta | No permite saber a qué actividad le falta qué, que es justo lo que el punto 2 pide resolver |

**Recomendación: A.** Nota de UX asociada (no un checkpoint aparte): con ~10 ítems × N actividades la
pantalla se alarga mucho; conviene que cada bloque de actividad sea colapsable, y que arranque
colapsado si está completo. Se resuelve reusando `Section`/`Chip`/`ProgressBar` del design system —
**nunca markup ad-hoc ni `style={{}}`**.

---

## Checkpoint (g) — Nivel de gobernanza

Mismo encuadre que los dos changes hermanos, ya resueltos como **CRÍTICO**
(`pacientes-documentos-multiples` Checkpoint (d), veredicto Enzo 2026-08-06; y los cinco `gateo-*`
antes que él, todos frontend puro y todos CRÍTICO por tocar pantallas del dominio Pacientes).

| Opción | Justificación |
|---|---|
| ALTO | El cambio técnico es frontend + mock, sin RLS, sin migración, sin datos reales en juego |
| **CRÍTICO** ✅ recomendada | Precedente directo: los dos changes hermanos sobre esta misma pantalla se trataron como CRÍTICO. `C-05` (dueño de la pantalla) es CRÍTICO. Además este change **sí** introduce un riesgo de pérdida de documentación (Checkpoint (e)) que los hermanos no tenían |

**Recomendación: CRÍTICO** — aprobación humana explícita documentada antes de que `/opsx:apply`
escriba una línea, y verificación manual de cierre. **Sin veredicto.**

---

## Checkpoint (h) — Guía de migración futura (no vinculante, no se escribe acá)

A diferencia del punto 1, la base **no** soporta esta dimensión. El día que exista
`SupabaseDocumentoRepository` (change `integracion-documentos`, hoy 1/55 tasks), `pacientes.documentos`
va a necesitar:

```sql
-- Ilustrativo — NO aplicar en este propose. A escribir en el futuro change de integración
-- documental, si Checkpoint (b) se resuelve por la opción B.
ALTER TABLE pacientes.documentos
  ADD COLUMN direccion_id UUID REFERENCES pacientes.direcciones(id) ON DELETE RESTRICT;
```

Aditiva y nullable ⇒ `NULL` = documentación general del paciente (Checkpoint (c) opción A), y ninguna
fila existente se rompe. Mismo criterio "expand aditivo" que toda la serie de integración. La cláusula
`ON DELETE` debe coincidir con el veredicto del Checkpoint (e): `RESTRICT` si se elige bloquear,
`SET NULL` si se elige "los documentos vuelven al bloque general", `CASCADE` **nunca** (borra
documentación clínica en silencio). No se agregan policies: `pacientes.documentos` ya tiene RLS con
`Read/Write documentos` gateadas por `modulos.tiene_permiso('pacientes', …)`, y una columna aditiva no
las requiere — mismo precedente que `20260805140000_direcciones_geocoding.sql`.

---

## Decisions (condicionadas a los checkpoints)

### D1 — La UI de agrupación vive en Pacientes, no en el componente compartido

Aun si el Checkpoint (b) se resuelve por B (campo en el contrato), `DocumentChecklist.tsx` **no
cambia**: sigue recibiendo `items` + `documentos` y renderizando un checklist. Quien decide "hay N
bloques, uno por actividad" es `PacienteDocumentos.tsx`, montando N instancias. Así el componente
compartido nunca aprende el concepto "actividad", que 3 de sus 4 consumidores no tienen. Forma
propuesta del árbol resultante:

```
<Section label="Documentación" title="Checklist documental">
  └── PacienteDocumentos                       ← resuelve obra social + lista de actividades
        ├── [total agregado: X de Y]           ← Checkpoint (f)
        ├── PacienteDocumentosChecklist(general)                    → DocumentChecklist  (sin cambios)
        ├── PacienteDocumentosChecklist(actividad #1: Escuela)      → DocumentChecklist  (sin cambios)
        ├── PacienteDocumentosChecklist(actividad #2: Kinesióloga)  → DocumentChecklist  (sin cambios)
        └── PacienteDocumentosChecklist(actividad #3: Fonoaudióloga)→ DocumentChecklist  (sin cambios)
```

### D2 — El gateo de escritura no cambia de mecanismo

`PacienteDocumentosChecklist` seguirá pasando `readOnly={!puedeEscribir}` a cada instancia, sin
excepciones por actividad. No se introduce ningún permiso por actividad — nadie lo pidió, y el
principio ya escrito en los wrappers ("el gateo del cliente nunca debe ser más restrictivo que la RLS
del servidor") se mantiene idéntico. Con N instancias, `usePuedeEscribir()` se evalúa N veces con el
mismo resultado; es un hook de contexto, sin costo relevante.

### D3 — Sin `SCHEMA_VERSION` en `mockDocumentoRepository`

Igual que en los dos changes hermanos: el mock usa dos `Map` en memoria de sesión, sin `localStorage`,
así que no hay forma persistida vieja que migrar ni usuarios con datos rotos en el navegador.

### D4 — Nada de este change escribe SQL

Regla dura del proyecto para tareas propose-only, y además innecesario: no hay repository real
conectado. El Checkpoint (h) es guía, no compromiso.

---

## Open Questions

- **Checkpoint (a)** — ¿"actividad" = `Direccion` (recomendado), entidad nueva, o `Recorrido`? Y la
  sub-pregunta: ¿el `domicilio` lleva checklist propio? Sin confirmar.
- **Checkpoint (b)** — ¿dónde vive la dimensión: `entidadId` compuesto, `agrupacionId?` opcional en el
  contrato compartido (recomendado), o agrupación dentro de `DocumentChecklist`? **La decisión más
  cara de revertir.** Sin confirmar.
- **Checkpoint (c)** — ¿bloque "General" para documentos sin actividad (recomendado), asignación
  forzada, o reasignación implícita? Sin confirmar.
- **Checkpoint (d)** — ¿los ~10 ítems son los mismos para todas las actividades (recomendado) o varían
  por tipo de actividad? Pregunta corta, alcance enorme si la respuesta es "varían". Sin confirmar.
- **Checkpoint (e)** — ¿advertir (recomendado), bloquear, o no proteger al quitar una actividad con
  documentación cargada? Sin confirmar.
- **Checkpoint (f)** — ¿progreso por actividad + total (recomendado), solo por actividad, o solo total?
  Sin confirmar.
- **Checkpoint (g)** — ¿gobernanza CRÍTICO (recomendado, por precedente de los dos hermanos) o ALTO?
  Sin confirmar.
- **Checkpoint (h)** — forma de la columna futura y su `ON DELETE`: guía, a re-confirmar en el change
  de integración; depende del veredicto de (e).
- **No bloqueante, pero hay que anotarlo**: si (b) se resuelve por B, `integracion-documentos` queda
  desactualizado por **segunda** vez (la primera fue `documentos-previsualizacion`, ya anotada en su
  `design.md` líneas 436-453). Quien retome ese change debe releer `DocumentoRepository.ts` contra el
  repo real, no contra su propio `design.md`.
- **Fuera de alcance, anotado para el futuro**: el **punto 3** del feedback (vincular la actividad
  seleccionada con su documentación; exportar/transferir documentación a otro domicilio) depende
  directamente de lo que se decida acá — sobre todo del Checkpoint (b), porque "transferir a otro
  domicilio" es literalmente "cambiarle el `agrupacionId` a un documento". Cuando llegue el video del
  cliente, quien proponga ese change debería leer este `design.md` primero.
