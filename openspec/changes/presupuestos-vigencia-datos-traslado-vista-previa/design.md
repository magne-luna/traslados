# Design: Vigencia, datos de traslado e identificación de presupuestos + vista previa del adjunto

## Context

**Estado actual — verificado archivo por archivo, no asumido.**

| Hecho | Evidencia |
|---|---|
| `Presupuesto` tiene 5 campos + 2 opcionales de prestación | `frontend/src/shared/types/presupuesto.ts:63-91` — `id`, `pacienteId`, `obraSocialId`, `monto`, `fechaEmision`, `archivo?`, `prestacionId?`, `lineas?` |
| `Autorizacion` **ya tiene `vigenciaDesde`, sin `hasta`** | `presupuesto.ts:111` — *"soporta la carga retroactiva (RN-PA-02) que el docx no tiene dónde persistir"* |
| La relación Autorización↔Presupuesto es **1:1** | `facturacion-seleccion-autorizacion/design.md:124` (explícito), reforzado en `presupuesto-prestaciones/design.md:328` |
| Las 2 RPC de alta **enumeran columnas una por una** | `20260816110000_presupuesto_lineas.sql:164-172` y `:223-231` — agregar columnas obliga a `CREATE OR REPLACE` de ambas |
| Las migraciones de `presupuesto-prestaciones` **ya están aplicadas** | `20260812120000_schema_pacientes_prestaciones.sql`, `20260812130000_presupuesto_prestacion_id.sql`, `20260812140000_presupuesto_rpc.sql` |
| El adjunto de autorización **ya sube de verdad** a Storage | bucket `documentos-autorizaciones` (`20260818091000`), columnas `archivo_*` (`20260818090000`), `SupabaseAutorizacionRepository.uploadArchivo` |
| **No existe ningún cálculo de viajes mensuales en el código** | `rg -i viaje` sobre todo el repo: 0 coincidencias de cálculo — solo prosa de KB/specs. El punto 5 es **alta**, no fix de código existente |
| El listado muestra 3 celdas: monto, fecha de emisión, archivo | `PresupuestosList.tsx:103-127` — nada que distinga dos presupuestos del mismo paciente |
| `PdfPreview` es público y reusable | `frontend/src/shared/components/PdfPreview.tsx:22` — `({ url, nombreArchivo })` |
| `ContenidoPreview` es **privado** dentro de `DocumentChecklist.tsx` | `DocumentChecklist.tsx:157` (sin `export`) |
| La URL firmada de documentos fuerza **descarga** a propósito | `SupabaseDocumentoRepository.ts:201-211` — `createSignedUrl(..., { download: nombreArchivo ?? true })`, fix del 2026-08-10 |
| `ArchivoAdjunto` **no tiene `tipoMime`** | `presupuesto.ts:23-39` — solo `nombre`, `cargadoEn`, `clave?`. `DocumentoAdjunto` sí lo tiene |

**Restricciones duras** (`CLAUDE.md`): cero `any`; solo Tailwind v4, nunca `style={{}}`; reusar
`design-system/components.tsx`; `anon key` únicamente; toda tabla nueva define su RLS en el mismo
change; `npx tsc -b --noEmit` (nunca `tsc --noEmit` a secas); Conventional Commits; el docx manda en
estructura y la KB en reglas de negocio, y toda discrepancia va a KB §Discrepancias + `CHANGES.md` +
`AvisoModeloDatos` en pantalla.

---

## Goals / Non-Goals

**Goals**

- Que el presupuesto registre **el período que cubre**, separado de cuándo se emitió.
- Que dos presupuestos del mismo paciente se distingan **en el listado**, sin abrir el detalle.
- Que lo que Andrea *pide* y lo que la obra social *concede* sean campos distintos, también para
  período y dependencia — no solo para el monto.
- Que el presupuesto guarde los datos que hoy solo existen en el formulario de papel de la obra social.
- Que el cálculo de viajes mensuales sea **una función pura testeable**, con el bug del doc de
  referencia (23 → 24) fijado como test de regresión.
- Que Andrea pueda **ver** el PDF de la autorización, no solo saber que existe.

**Non-Goals**

- **NO cambia la cardinalidad Autorización↔Presupuesto.** Sigue 1:1. Punto 7, bloqueado por Enzo.
- **NO se reabre la discrepancia #13.** `presupuesto.monto` no cambia de tipo ni de semántica.
- **NO se crea ninguna tabla.** Todo el change es aditivo por columnas.
- **NO se persiste `viajesMensuales`.** Se deriva. Ver D4.
- **NO se define qué le hace CD/SD al valor del km.** Ver D3 y Open Questions.
- **NO se toca el trigger `validar_autorizacion_monto`** (RN-PA-01).
- **NO se toca el adjunto de `Presupuesto`** (su `archivo_url` sigue guardando una URL, no una clave).

---

## Decisions

### D1 — La vigencia vive en `presupuesto`, NO en `presupuesto_linea` ✅ RESUELTA

> Esto cierra la pregunta abierta que dejó la exploración (*"¿la vigencia vive en `presupuesto` o en
> `presupuesto_linea`?"*). **No queda como riesgo: se decide acá.**

**Qué.**

```sql
ALTER TABLE facturacion.presupuesto
  ADD COLUMN vigencia_desde DATE,
  ADD COLUMN vigencia_hasta DATE;
ALTER TABLE facturacion.autorizacion
  ADD COLUMN vigencia_hasta DATE;   -- vigencia_desde ya existe
```

`facturacion.presupuesto_linea` **no se toca**.

**Por qué, en orden de peso:**

1. **La causa del corte no es de línea.** Andrea nombró dos disparadores: vencimiento del **CUD del
   paciente** y del **RNP del prestador**. Ninguno de los dos es un atributo de una prestación
   individual — los dos cortan **todo** lo que se le facture a ese paciente por ese prestador. Poner
   la vigencia en la línea permitiría expresar estados que el negocio no puede producir (dos líneas
   del mismo presupuesto con vigencias distintas por vencimiento de CUD).
2. **La granularidad por prestación ya existe, por otra vía.** En modalidad `por-prestacion` cada
   prestación **ya tiene su propio presupuesto** (`crear_presupuestos_lote` crea N filas, una por
   prestación, cada una con su `prestacion_id` y su `monto`). Si una prestación necesita otra
   vigencia, se expresa **hoy**, sin tocar nada: es otro presupuesto. Poner vigencia en la línea sería
   construir una segunda forma de decir lo mismo.
3. **`presupuesto_linea` solo existe en modalidad `general`.** En `por-prestacion` no hay líneas
   (`lineas` queda `undefined`). Una vigencia que solo se puede cargar en una de las dos modalidades
   no es un campo del dominio, es un accidente del modelo.
4. **Chocaría con la vigencia de la autorización.** `autorizacion.vigencia_desde` es de fila, y la
   autorización es 1:1 con el **presupuesto**. Con vigencia por línea, la autorización tendría que
   responder a N vigencias con una sola — exactamente la ambigüedad 1:N que bloqueó el punto 7. Se
   evita, no se importa.
5. **Simetría con #13.** Un atributo persistido por línea convierte al presupuesto en un agregado.
   Eso es literalmente la forma que la discrepancia #13 prohibió para el monto. Repetirla para la
   vigencia sería reabrir #13 por la puerta de atrás.

**Colisión con `presupuesto-prestaciones` (change en curso): ninguna.** Ese change **no toca**
`presupuesto_linea` (su Non-Goal explícito: *"NO se persiste el desglose de la modalidad `general`"* —
la tabla la creó `20260816110000`, un change posterior). Y sus Non-Goals prohíben tocar `monto` y la
cardinalidad de la autorización; **esta decisión respeta las tres**.

**Alternativas descartadas**

| Alternativa | Por qué no |
|---|---|
| Vigencia en `presupuesto_linea` | Los 5 motivos de arriba. Permite estados imposibles y duplica una granularidad que ya existe |
| Vigencia en **ambos** (presupuesto = envolvente, línea = override) | Dos fuentes de verdad para el mismo hecho; nadie pidió el override; el trigger y la UI tendrían que resolver precedencia |
| Solo `vigencia_hasta`, derivando `desde` de `fechaEmision` | Rompe el caso literal de Andrea: emitido **30/12**, vigente desde **feb-2026**. Fabricar el `desde` es el antipatrón que el proyecto ya viene corrigiendo |
| Un único `vigencia_meses INT` (12 por defecto) | Andrea dijo explícitamente *"no siempre son 12 meses"*. Un entero no expresa "cortado el 14/07 porque venció el CUD" |
| No tocar `autorizacion` (solo presupuesto) | La obra social **puede autorizar menos período del pedido**. Sin `vigencia_hasta` en autorización, ese recorte no tiene dónde vivir — el mismo agujero que `montoAutorizado` vino a tapar |

**Regla de negocio nueva (RN candidata, análoga a RN-PA-01).** El período autorizado MUST estar
contenido en el pedido: `autorizacion.vigencia_desde >= presupuesto.vigencia_desde` y
`autorizacion.vigencia_hasta <= presupuesto.vigencia_hasta`, cuando ambos lados estén cargados.
**Se valida en la capa de aplicación, NO con trigger nuevo** — coherente con el Non-Goal de no tocar
`validar_autorizacion_monto` y con el criterio de `presupuesto-prestaciones` D6 (no duplicar reglas de
formulario en SQL). `CHECK (vigencia_hasta IS NULL OR vigencia_desde IS NULL OR vigencia_hasta >= vigencia_desde)`
sí va en la base: es una invariante de la fila, no una regla cruzada.

---

### D2 — Los datos de traslado NO reusan `RecorridoHabitual`; se copian una vez, no se referencian ✅ RESUELTA

> Esto cierra el solape conceptual que marcó la exploración. **No queda como riesgo: se decide acá.**

**Qué.** Bloque de columnas nuevas en `facturacion.presupuesto`:

```sql
ALTER TABLE facturacion.presupuesto
  ADD COLUMN origen_ida        TEXT,
  ADD COLUMN destino_ida       TEXT,
  ADD COLUMN origen_vuelta     TEXT,
  ADD COLUMN destino_vuelta    TEXT,
  ADD COLUMN horario_entrada   TIME,
  ADD COLUMN horario_salida    TIME,
  ADD COLUMN km_ida            NUMERIC(10,2),
  ADD COLUMN km_vuelta         NUMERIC(10,2),
  ADD COLUMN dias_semana       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN dias_mensuales    SMALLINT;
```

**Sin FK a `pacientes.recorridos`. Sin FK a `pacientes.direcciones`. Sin tabla hija.**

**Por qué NO reusar `RecorridoHabitual`:**

1. **Ciclo de vida opuesto — el argumento decisivo.** `RecorridoHabitual` (`pacientes.recorridos`,
   RF-110) es el **estado actual** del paciente: cambia cuando el paciente cambia de escuela. El
   bloque del presupuesto es una **declaración congelada** presentada a la obra social en una fecha,
   contra la cual esa obra social autoriza y contra la cual mañana se factura. Si compartieran filas,
   cambiar el horario de terapia de un paciente **reescribiría retroactivamente presupuestos ya
   presentados y autorizados**. En un dominio de facturación de salud eso no es un inconveniente: es
   pérdida de trazabilidad.
2. **La forma no coincide, y forzarla pierde datos.** `RecorridoHabitual` es **N filas**, una por
   `(diaSemana, hora)`, con **una sola** `hora` y **ninguna** noción de km. El formulario de la obra
   social es **un bloque** con entrada **y** salida, km de ida **y** de vuelta, y los días como
   **conjunto** (Andrea lo dijo: *"días de la semana, resumible a una cantidad de días"*). Mapearlo a
   `RecorridoHabitual` obligaría a tirar entrada/salida y los dos km, o a deformar esa tabla para un
   dominio que no es el suyo.
3. **Direcciones vs. texto declarado.** `RecorridoHabitual` referencia `Direccion` del catálogo del
   paciente. El origen/destino del presupuesto es **lo que se escribió en el formulario de la obra
   social** — puede no corresponder a ninguna `Direccion` vigente, y el paciente puede mudarse sin que
   el presupuesto presentado cambie. Una FK ataría un dato histórico a una fila mutable.
4. **El repo ya rechazó este mismo acoplamiento dos veces, por escrito.** `recorridoHabitual.ts:1-12`:
   *"Concepto DISTINTO de `Recorrido`/`ParadaRecorrido` … **No compartir tipos entre los dos dominios:
   son tablas y ciclos de vida distintos**, aunque ambos hablen de «recorrido» en el lenguaje del
   dominio"*. Y el mismo archivo marca `Direccion.dias`/`Direccion.horario` como *"un concepto
   huérfano y obsoleto: nunca se persistieron en ningún lado"* — el resultado exacto de haber puesto
   día/hora recurrente en una entidad compartida. **Sería la tercera vez.**

**Lo que SÍ se hace para no retipear: prefill de una sola dirección, opt-in.** En el alta, un botón
*"Traer de los destinos habituales del paciente"* **copia** los `RecorridoHabitual` vigentes a los
campos del formulario (días + horarios), ya editables. **Copy-on-create, nunca referencia viva**: se
sugiere el valor, se guarda una copia propia. Cero acoplamiento, toda la ergonomía.

**Sub-decisiones de forma, decididas:**

| Punto | Decisión | Por qué |
|---|---|---|
| Días de la semana | `TEXT[]` en la base, `DiaSemana[]` en TS | Conjunto acotado de 7. Una tabla hija exigiría RLS/auditoría/índice nuevos para expresar un `Set`. **Se reusa la unión `DiaSemana` ya existente** de `recorridoHabitual.ts` — reusar el **tipo escalar** es correcto; reusar la **entidad** no |
| Sin `CHECK` en `dias_semana` | Deliberado | Mismo criterio ya escrito en `recorridoHabitual.ts:14-16`: *"la cerradura la impone este tipo, no la base"* (la columna real `dia_semana` tampoco tiene CHECK). La validación va en el mapping |
| `dias_mensuales` se **persiste** | Sí | **No** es "días hábiles del mes" calculado: es el número **negociado con la obra social** que figura en el formulario. Derivarlo del calendario sería inventar el dato |
| `viajes_mensuales` **no** se persiste | Ver D4 | Se deriva de `dias_mensuales` |
| Horarios como `TIME` | Sí | `RecorridoHabitual.hora` usa `'HH:MM'` en TS; se mantiene ese formato en el tipo y se mapea a `TIME` en la base |

---

### D3 — CD/SD es un par pedido/concedido, y **solo** un booleano ✅ RESUELTA

**Qué.**

```sql
ALTER TABLE facturacion.presupuesto  ADD COLUMN con_dependencia BOOLEAN;  -- lo pedido
ALTER TABLE facturacion.autorizacion ADD COLUMN con_dependencia BOOLEAN;  -- lo concedido
```

Ambos **nullable** (no `NOT NULL DEFAULT false`): `NULL` = "no se cargó", `false` = "SD, decisión
tomada". Un default `false` haría que todos los presupuestos históricos afirmaran "sin dependencia",
que es fabricar dato.

**Por qué en las dos tablas.** Andrea fue literal: *"lo carga ella, pero la obra social puede
denegarlo — tiene que poder desmarcarse"*. Eso es exactamente pedido≠concedido, la misma forma que
`monto`→`montoAutorizado` y (con D1) `vigencia`→`vigenciaAutorizada`. **Esa simetría es la columna
vertebral de todo este change.**

**Qué NO se decide acá.** Andrea dijo que CD/SD *"cambia el valor/cálculo del km"*, pero **no cómo**.
`04_modelo_de_datos.md:107` describe el valor del km como *"nomenclador, carga manual"*. Este change
**guarda el booleano y deja el km manual**. Inventar un multiplicador en un dominio de facturación de
salud sería exactamente lo que la governance ALTO prohíbe. → Open Question 1.

**Aporte lateral valioso.** `10_preguntas_abiertas.md:430-438` tiene abierta *"¿Qué significan
«dependencia» y «retorno»? … además de aclarar el significado hace falta decidir **dónde vive el
dato** (ficha del paciente, configuración de la obra social, o se sigue cargando por factura).
**Decisor: cliente (Andrea Pastor)"***. Andrea acaba de contestar la parte del "dónde": **en el
presupuesto y en la autorización**, no en el paciente ni en la obra social — porque la obra social lo
decide caso por caso. Ese ítem de la KB se **actualiza** (no se cierra: falta el significado numérico,
y "retorno" sigue sin resolver, aunque el `tieneVuelta` de D4 es un candidato fuerte a ser lo mismo →
Open Question 2).

---

### D4 — Los viajes mensuales se **derivan**, no se guardan; el fix vive en una función pura ✅ RESUELTA

**Hallazgo primero: el cálculo no existe hoy en el código.** `rg -i viaje` sobre todo el repo devuelve
únicamente prosa (KB, specs, comentarios sobre "viaje de ida y vuelta" a Postgres). **No hay nada que
corregir en código: hay que darle su primera implementación, y que sea la correcta.** El "bug" vivía
en el doc de referencia que el equipo usaba a mano.

**Qué.** Módulo nuevo `frontend/src/shared/lib/presupuestos/calculoViajes.ts`, **puro, sin red, sin
React**:

```ts
export interface ParametrosViajes {
  diasMensuales: number;
  tieneVuelta: boolean;
}
/** 23 días hábiles con vuelta = 46 viajes (ida + vuelta), NO 24. */
export function calcularViajesMensuales({ diasMensuales, tieneVuelta }: ParametrosViajes): number;
export function calcularKmMensuales(p: ParametrosViajes & { kmIda: number; kmVuelta: number }): number;
```

`viajesMensuales = diasMensuales × (tieneVuelta ? 2 : 1)`
`kmMensuales = diasMensuales × (kmIda + (tieneVuelta ? kmVuelta : 0))`

`tieneVuelta` se deriva de que haya `origen_vuelta`/`destino_vuelta`/`km_vuelta` cargados — no es una
columna aparte.

**Por qué NO persistir `viajes_mensuales`.** Sería una segunda fuente de verdad de `dias_mensuales`,
que puede desincronizarse en cualquier edición. Es el mismo criterio que `presupuesto-prestaciones`
D6 aplicó a "la suma de las líneas es el monto" (*"duplicarla en Postgres crearía dos fuentes de
verdad, que es exactamente lo que `integracion-facturacion` D-Goals prohíbe"*). Se muestra calculado
**en vivo** en el formulario, igual que el total de `PresupuestoLineasEditor`.

**Por qué función pura y no un `useMemo` adentro del form.** Strict TDD está activo en el proyecto;
una función pura permite el ciclo RED→GREEN→TRIANGULATE sin montar nada. Es la única tarea de todo el
change que es TDD de manual.

**Casos de test obligatorios (triangulación):** `23 + vuelta → 46`; `23 sin vuelta → 23`; `0 → 0`;
`1 + vuelta → 2`; negativo → error o 0 (decidir en RED); **y un test nombrado explícitamente como
regresión del valor viejo 24**, para que nadie lo "arregle" de vuelta hacia atrás.

---

### D5 — Identificar el presupuesto en el listado **sin columna nueva** ✅ RESUELTA

**Qué.** `PresupuestosList.tsx` pasa de 3 celdas (monto / emitido / archivo) a mostrar además:

- **Prestación**: nombre de `prestacionId` (modalidad `por-prestacion`), o los nombres de `lineas[]`
  (modalidad `general`, con "+N" si son muchas), resueltos client-side igual que
  `nombrePaciente`/`nombreObraSocial`.
- **Vigencia**: `vigenciaDesde – vigenciaHasta` (D1), o `"Sin vigencia cargada"`.
- El buscador pasa a filtrar también por nombre de prestación.

**Por qué sin columna nueva.** Los ejemplos de Andrea —*escuela especial, SET, terapia,
hidroterapia*— **son prestaciones**, y `presupuesto-prestaciones` ya está construyendo el catálogo
`pacientes.prestaciones` + `presupuesto.prestacion_id` (migraciones **ya aplicadas**). Agregar un
`descripcion TEXT` libre crearía un segundo nombre para el mismo hecho, divergente del catálogo —
que es **exactamente** el error que `facturas.prestacion TEXT` ya cometió y que
`presupuesto-prestaciones` D8 nombra como tal. **Este punto es UI pura y hace que un change que ya
está a 48/58 rinda de inmediato.**

**Caso borde decidido.** Presupuestos históricos sin `prestacionId` ni `lineas` → chip
`"Sin prestación asociada"`, **nunca** una celda vacía ni un texto inventado. Si Andrea quiere poder
escribir una etiqueta libre para esos casos, es una columna aditiva posterior → Open Question 3. **No
se construye por las dudas.**

---

### D6 — Vista previa: se extrae el componente existente y se invierte deliberadamente el `download` ✅ RESUELTA

**Qué, en tres piezas.**

**(a) Extracción.** `ContenidoPreview` (privado, `DocumentChecklist.tsx:157-213`) se muda a
`frontend/src/shared/components/VistaPreviaArchivo.tsx` y `DocumentChecklist` pasa a consumirlo.
Refactor **sin cambio de comportamiento**, cubierto por los tests existentes de `DocumentChecklist`.
Ese componente concentra lecciones caras que **no se reimplementan**: `<img>` para imágenes,
`PdfPreview` sobre `<canvas>` para PDF (el visor nativo **no corre** en iframe sandboxeado — probado
en dos navegadores el 2026-08-06), y `Alert` para tipos no soportados. Su props se generaliza de
`DocumentoAdjunto` a `{ url, nombreArchivo, tipoMime }` para servir a los dos dominios.

**(b) `download` invertido — el detalle no obvio.**
`SupabaseDocumentoRepository.ts:201-211` pasa `{ download: nombreArchivo }` **a propósito** (fix
"Descargar lleva a otra página", 2026-08-10): eso hace que Storage responda
`Content-Disposition: attachment`. **Para "abrir en otra pestaña" eso es exactamente lo contrario de
lo que hace falta** — el navegador descargaría el PDF en vez de abrirlo. Por eso:

```ts
// AutorizacionRepository.ts
getUrlArchivo(id: string, modo: 'inline' | 'descarga'): Promise<string | null>;
```

`'inline'` **omite** la opción `download` (Storage sirve con su `Content-Type`, el navegador lo
renderiza); `'descarga'` la pasa. Un solo método, dos modos explícitos, y la razón escrita en el
código para que nadie "unifique" los dos y rompa uno de los dos usos.

**(c) `tipoMime`: columna nueva, no adivinanza.**

```sql
ALTER TABLE facturacion.autorizacion ADD COLUMN archivo_tipo_mime TEXT;
```

`ArchivoAdjunto` gana `tipoMime?: string`. Se puebla desde `File.type` en `uploadArchivo` — el dato ya
está en la mano en el momento de subir.

| Alternativa | Por qué no |
|---|---|
| Inferir el MIME de la extensión del nombre | Adivinar un dato que tenemos exacto. El precedente del repo es guardarlo: `DocumentoAdjunto.tipoMime` ya existe |
| Pedirle el `Content-Type` a Storage en cada preview | Un round-trip extra por render, para recuperar algo que pudimos guardar una vez |

**Fallback acotado.** El bucket está vivo desde el 2026-08-18: puede haber filas con archivo y sin
`archivo_tipo_mime`. **Solo para esas** se infiere por extensión, con comentario explícito de que es
una rama de compatibilidad histórica y no el camino normal. Si no se puede inferir → "no se puede
previsualizar acá" + botón de descarga, que es la rama que `ContenidoPreview` ya tiene.

**Ubicación en UI.** Vista previa dentro del `Overlay` del design-system (mismo patrón que el
checklist) desde `AutorizacionForm`/detalle de autorización, con un `<a target="_blank" rel="noopener noreferrer">`
apuntando a la URL `inline` para el "abrir en otra pestaña". Gateado por lectura del módulo
`presupuestos` (RLS del bucket, sin cambios).

---

### D7 — Todo aditivo por columnas: sin tablas nuevas, sin RLS nueva ✅ RESUELTA

Ninguna de las decisiones anteriores crea una tabla. Por lo tanto **no hay policies nuevas que
escribir**: `facturacion.presupuesto` y `facturacion.autorizacion` ya están gateadas por el módulo
`presupuestos` (`20260730140000_split_modulos_permisos.sql`), y el bucket
`documentos-autorizaciones` también (`20260818091000`). La regla dura *"toda tabla nueva define su RLS
en el mismo change"* se cumple **por vacuidad**, y eso se verifica en vivo igual (§0.3), no se asume.

Las 2 RPC (`crear_presupuesto_completo`, `crear_presupuestos_lote`) se `CREATE OR REPLACE`
manteniendo **`SECURITY INVOKER`**, con el mismo test de código fuente sobre el texto del `.sql` que
ya exige `presupuesto-prestaciones` D2/D10.

---

## ⚠️ Discrepancias con `docs/core/Traslados-Modelo-Datos.docx`

El docx modela `Presupuesto` como `Monto` + `Archivo`, y `Autorizacion` con cupos + estado. **Ninguno
de los campos de este change está en el docx.** Las 5 entradas nuevas van a
`knowledge-base/04_modelo_de_datos.md` §Discrepancias **+** `CHANGES.md` (⚠️) **+** `AvisoModeloDatos`
en pantalla, **sin resolverlas adivinando**:

| # | Campo(s) | Pantalla con `AvisoModeloDatos` |
|---|---|---|
| 1 | `presupuesto.vigencia_desde` / `vigencia_hasta` | `PresupuestoForm`, `PresupuestoDetail` |
| 2 | `autorizacion.vigencia_hasta` (extiende la discrepancia ya abierta de `vigencia_desde`) | `AutorizacionForm` |
| 3 | `presupuesto.con_dependencia` / `autorizacion.con_dependencia` (el docx solo tiene "dependencia y retorno" en **Factura**) | `PresupuestoForm`, `AutorizacionForm` |
| 4 | Bloque completo de datos de traslado (10 columnas) | `PresupuestoForm`, `PresupuestoDetail` |
| 5 | `autorizacion.archivo_tipo_mime` | `AutorizacionForm` |

---

## Testing Strategy

| Capa | Qué se testea | Cómo |
|---|---|---|
| Unit (**TDD estricto**) | `calculoViajes.ts` — 46/23/0/1/negativo + regresión del 24 | Vitest puro. **Único módulo del change que es TDD de manual: RED antes de una línea de producción** |
| Unit | `presupuestoMapping` / `autorizacionMapping`: campos nuevos en las 3 direcciones, **respetando la semántica parcial** de `toActualizar…` (clave ausente ≠ `undefined` — el agujero que ya borró checklists una vez) | Vitest puro |
| Unit | Validación de vigencia: `hasta >= desde`; autorizada ⊆ presupuestada | `validatePresupuestoForm` / validador de autorización |
| Unit | `dias_semana`: parseo de array desconocido → `DiaSemana[]`, descartando valores fuera de la unión sin `as` | Vitest, type guards sobre `unknown` |
| Component | `PresupuestosList`: distingue 2 presupuestos del mismo paciente; caso sin prestación; filtro por prestación | RTL |
| Component | `VistaPreviaArchivo`: imagen / PDF / tipo no soportado / error / sin contenido | RTL, calcado de los tests actuales de `DocumentChecklist` |
| Component | `AutorizacionForm`: CD/SD desmarcable, vigencia hasta, abrir preview y pestaña nueva | RTL |
| Integration | `SupabaseAutorizacionRepository.getUrlArchivo`: `inline` **no** manda `download`, `descarga` sí | Vitest + mock de `supabase.storage` |
| Source guard | Las 2 RPC reemplazadas **no** contienen `SECURITY DEFINER` | Test sobre el texto del `.sql` (patrón ya existente) |
| Manual | 2 cuentas reales (`presupuestos: read` / sin módulo) contra la vista previa | Success Criteria del proposal |

---

## Migration Plan

**Orden obligatorio.**

1. **Gate §0** — aprobación de G1-G4. Nada de `.sql` antes.
2. **Archivar `integracion-documentos-autorizaciones`** (19/20) para que sus deltas de spec —
   incluida `autorizacion-archivo-storage`, que este change modifica — estén en `openspec/specs/`.
3. **Verificación en vivo** (solo lectura): columnas actuales de `facturacion.presupuesto` y
   `.autorizacion`, volumen de ambas, y que **ninguna** de las columnas nuevas exista ya.
4. `<ts>_presupuesto_vigencia_dependencia_traslado.sql` — 12 columnas + `CHECK` de vigencia.
5. `<ts>_autorizacion_vigencia_dependencia_mime.sql` — 3 columnas + `CHECK` de vigencia.
6. `<ts>_presupuesto_rpc_campos_nuevos.sql` — `CREATE OR REPLACE` de las 2 RPC. **Requiere (4).**
7. **La usuaria / Enzo aplican.** El agente escribe, no aplica.
8. Edge Functions `presupuestos` y `autorizaciones`.
9. Frontend: tipos → mappings → repositories → `calculoViajes.ts` → `VistaPreviaArchivo` (extracción)
   → `PresupuestosList` (D5) → `AutorizacionForm` (D6) → **`PresupuestoForm` último** (colisión).
10. Documentación: KB §Discrepancias ×5, `CHANGES.md`, `10_preguntas_abiertas.md` (D3, OQ 1-3).

**Entre (7) y (9) la app sigue funcionando sin cambios**: columnas nullable que nadie lee, RPC que
aceptan claves nuevas opcionales. **Las migraciones son inertes hasta que el frontend las use.**

⚠️ **Bloqueo de fase:** el paso 9 no arranca hasta que `presupuesto-prestaciones` (48/58) esté
aplicado — su D9 bifurca `PresupuestoForm.tsx` en tres ramas de render y este change agrega campos
adentro de ese mismo archivo. Los pasos 4-8 no lo tocan y pueden ir en paralelo.

---

## Rollback

Ver `proposal.md` §Rollback Plan (3 capas). Lo específico del diseño:

- **`VistaPreviaArchivo` es neutral**: la extracción se puede dejar aunque se revierta todo lo demás.
- **`calculoViajes.ts` es neutral**: función pura sin llamador tras revertir el form.
- **Punto de no retorno**: con presupuestos reales que tengan vigencia y datos de traslado cargados,
  el `DROP COLUMN` **borra información de negocio que solo existía en papel**. El rollback barato es
  frontend + Edge Function.

---

## Open Questions

1. **¿Qué le hace exactamente CD/SD al valor del km?** Andrea dijo que lo cambia; no cómo. Este change
   guarda el booleano y deja el km manual (como ya dice la KB). **Decide: Andrea.** Bloquea cualquier
   automatización futura del valor del km, no este change.
2. **¿"Retorno" (`Factura.dependenciaYRetorno`) es lo mismo que el "vuelta" de D2/D4?** Si lo es,
   `10_preguntas_abiertas.md:430` queda cerrada de un lado. **No se asume**: se pregunta.
   **Decide: Andrea.**
3. **¿Hace falta una etiqueta libre para presupuestos sin prestación?** (caso borde de D5). Columna
   aditiva posterior si la respuesta es sí. **Decide: Andrea.**
4. **¿La vigencia debería afectar el gateo de facturación** (no permitir facturar un mes fuera del
   período autorizado)? Es la extensión natural de RN-FA-02/`presupuesto-cupo-consumible`, pero toca
   **Facturación (dominio CRÍTICO)** y `facturacion-seleccion-autorizacion` está activo. **Fuera de
   alcance acá, por el mismo motivo que `presupuesto-prestaciones` D8.** **Decide: Andrea + Enzo.**
5. **pgTAP / Supabase local** — sigue abierta desde `integracion-pacientes`. Este change reemplaza 2
   funciones sin harness automatizado. El contador sube; sigue sin decisor.
