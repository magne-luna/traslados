## Context

**Estado actual del frontend.** Dos features completas y archivadas, ambas sobre mock:

| | Vehículos | Conductores |
|---|---|---|
| Composition root | `features/vehiculos/VehiculosRoute.tsx` | `features/conductores/ConductoresRoute.tsx` |
| Repository inyectado | `mockVehiculoRepository` (`SCHEMA_VERSION = 3`) | `mockConductorRepository` (`SCHEMA_VERSION = 2`) |
| Interfaz | `VehiculoRepository` — `list`/`getById`/`create`/`update` | `ConductorRepository` — idéntica |
| Hook | `useVehiculos(repo)` → `{ vehiculos, loading, error, recargar, crear, actualizar }` | `useConductores(repo)` → ídem |
| Context | `VehiculoRepositoryContext` | `ConductorRepositoryContext` |

`ConductoresRoute.tsx` **monta los dos providers**: el selector de vehículo de la asignación semanal
consume `VehiculoRepository` de solo lectura vía su propio context. Ese detalle es la razón por la
que los dos dominios se integran en el mismo change y no en dos.

Los dos hooks capturan lo que el repository lance y renderizan `err.message` sin transformarlo
(`toErrorMessage`), igual que `usePacientes` / `useObrasSociales`. Las colecciones hijas
(`Vehiculo.gastos`, `Vehiculo.mantenimientos`, `Vehiculo.habilitaciones`, `Conductor.asignaciones`)
son **arrays embebidos** que se mutan vía el `update()` del padre — no tienen repository propio.

**Estado real del backend — verificado, no asumido.**
`supabase/migrations/20260724100006_schema_conductores.sql` crea el schema `conductores` con **7
tablas**, 3 tipos enum, RLS habilitada en las 7, `GRANT ALL … TO authenticated` y trigger
`auditoria.log_action()` en las 7:

```sql
conductores.conductores            (id, nombre, apellido, fecha_nacimiento, domicilio,
                                    dni UNIQUE NOT NULL, cuil, telefono, estado, notas)
conductores.documentacion_conductores (id, conductor_id FK, tipo_documento, archivo_url)
conductores.vehiculo               (id, tipo, patente UNIQUE NOT NULL, modelo, capacidad,
                                    año, notas, estado)
conductores.accesorios_vehiculo    (id, vehiculo_id FK, accesorio_id FK → pacientes.accesorios,
                                    UNIQUE(vehiculo_id, accesorio_id))
conductores.documentacion_vehiculo (id, vehiculo_id FK, tipo_documento, archivo_url, created_at)
conductores.mantenimiento          (id, vehiculo_id FK, categoria, fecha,
                                    fecha_proximo_vencimiento, km_actual, km_proximo_vencimiento)
conductores.conductores_vehiculos  (id, conductor_id FK, vehiculo_id FK, fecha_init,
                                    fecha_fin_semana, UNIQUE(conductor_id, vehiculo_id, fecha_init))
```

```sql
conductores.estado_conductor       AS ENUM ('operando', 'fuera de servicio')
conductores.estado_vehiculo        AS ENUM ('habilitado', 'fuera de servicio')
conductores.categoria_mantenimiento AS ENUM ('gasto', 'preventivo', 'correctivo')
```

Más dos FK que esa misma migración agrega hacia afuera: `pacientes.historial_recorridos.id_vehiculo`
y **`facturacion.gastos_vehiculos.vehiculo_id`** → `conductores.vehiculo(id)`.

**El mapa de permisos NO es un solo módulo.** `20260730140000_split_modulos_permisos.sql` ya
reescribió las policies del schema. Estado vigente, verificado línea por línea:

| Tabla | Módulo que la gatea |
|---|---|
| `conductores.conductores` | `conductores` |
| `conductores.documentacion_conductores` | `conductores` |
| `conductores.vehiculo` | **`vehiculos`** |
| `conductores.accesorios_vehiculo` | **`vehiculos`** |
| `conductores.documentacion_vehiculo` | **`vehiculos`** |
| `conductores.mantenimiento` | **`vehiculos`** |
| `conductores.conductores_vehiculos` | **`vehiculos`** ← la asignación semanal, que se edita desde la pantalla de Conductores |
| `pacientes.accesorios` (catálogo) | **`pacientes`** |
| `facturacion.gastos_vehiculos` | **`facturacion`** (confirmado con la usuaria: *"es un gasto, no una operación sobre el vehículo en sí"*) |

Es decir: **las dos pantallas de este change cruzan cuatro módulos de permisos.** Este hecho manda
sobre buena parte del diseño (D5, D7, D10) y es la discrepancia de mayor impacto operativo del
change. La nota de `CHANGES.md` §C-08 que decía *"el docx ubica `gasto_vehiculo` bajo el módulo
`facturacion`, no `conductores`"* ya está **implementada**, no pendiente — la tabla es
`facturacion.gastos_vehiculos` y existe desde `20260724100005`. No falta ninguna tabla.

**Referencia de patrón.** `integracion-pacientes` (change 1, código completo) e
`integracion-obra-social` (change 2, propose completo) fijaron el molde que este change copia:
mapeo puro separado del I/O, embeds de PostgREST en una sola consulta, escritura multi-tabla atómica
vía RPC **`SECURITY INVOKER`** (nunca `DEFINER`, nunca insert-padre + borrado compensatorio),
traducción de errores a castellano, fake tipado del cliente en los tests, verificación de RLS con
cuentas reales como tarea manual separada, y discrepancias documentadas por triplicado.

**Restricciones duras del proyecto** (`CLAUDE.md`): nada de `any` (usar `unknown` + narrowing); solo
utilidades Tailwind v4, nunca `style={{}}`; reusar `design-system/components.tsx`; `anon key`
únicamente, nunca `service_role`; **toda tabla nueva define su RLS en el mismo change**;
`npx tsc -b --noEmit` como único type-check válido; Conventional Commits; el docx manda en
estructura y la KB en reglas de negocio, y toda discrepancia se documenta en los dos lugares **y**
con `AvisoModeloDatos`, nunca se resuelve adivinando.

**Governance: ALTO.** `CHANGES.md` declara `C-08` como ALTO y `C-09` como BAJO; para un change
combinado aplica el más restrictivo. Concretamente: **este propose no escribe código**, y las
decisiones **D3**, **D5**, **D6** y la colisión de asignación semanal (§Open Questions) se pusieron a
revisión de la usuaria en la tarea `0.1` **antes** de que `/opsx:apply` escribiera nada — mismo
mecanismo que D3/D8 en `integracion-obra-social`.

> **✅ Checkpoint `0.1` resuelto (2026-07-31).** Las cuatro decisiones están tomadas y volcadas en
> este documento: **D3 → opción B** (habilitaciones derivadas de `conductores.mantenimiento`),
> **D5 → opción A** (degradar y avisar), **D6 → opción B** (todo a `notas`, docx literal) y
> **colisión semanal → se bloquea siempre, sin override, con un `UNIQUE` en la base** (D7 §Colisión).
> No quedan checkpoints bloqueantes: `/opsx:apply` puede avanzar. Las decisiones D3, D6 y la de
> colisión **cambian pantallas ya aprobadas por la usuaria** y por eso suman tareas de UI explícitas
> en `tasks.md` (§2B, §2C y §2D).

---

## Goals / Non-Goals

**Goals**

- Que las pantallas de Vehículos y Conductores lean y escriban datos reales de Postgres vía RLS, con
  la sesión del usuario.
- Cumplir `VehiculoRepository` y `ConductorRepository` **al pie de la letra**: mismas firmas, misma
  semántica de `null` en `getById`, misma forma de error. Los hooks y los contexts no se tocan, y
  **el swap en sí** no toca ningún componente: el diff de producto de §5 y §7 es un import y una
  prop en cada `*Route.tsx`.
  **Salvedad, y es real**: las resoluciones de los checkpoints **D3** (opción B) y **D6** (opción B)
  sí cambian pantallas — `VehiculoDetail` / `VehiculoMantenimiento` dejan de tratar
  `habilitaciones` como colección editable, y `ConductorForm` / `ConductorDetail` /
  `ConductoresList` pierden el selector estructurado de restricciones. Eso **no es** consecuencia
  del swap sino de las decisiones de modelo que la usuaria tomó en el checkpoint `0.1`, y va en
  fases propias, sobre el mock, **antes** del swap (`tasks.md` §2B y §2C). La afirmación original
  de este documento —"los ~25 componentes no se tocan"— quedó **desactualizada** por esas dos
  decisiones y se corrige acá en vez de sostenerse.
- **Hacer visible el gateo cruzado de cuatro módulos** en vez de dejar que se manifieste como
  pantallas silenciosamente vacías.
- Cerrar los huecos de columna que hoy impiden persistir lo que la UI ya edita (kilometraje,
  categoría de mantenimiento de nivel 2, habilitaciones, restricciones) con una decisión explícita
  cada uno.
- Que RN-VE-01 (compatibilidad de accesorios) tenga un catálogo real contra el cual validar — hoy
  `pacientes.accesorios` está vacío.
- Aislar todo el mapeo en funciones **puras**, testeables sin red; los repositories quedan como
  cáscaras delgadas de I/O.

**Non-Goals**

- **No se construyen las pantallas** — ya existen (`vehiculos-ui`, `vehiculo-mantenimiento-registro`,
  `conductores-ui`, los tres archivados).
- **No se integra el `DocumentoRepository`** (D8). Es compartido con Pacientes y Facturas y su swap
  es la fila 8 del plan de integración, con su propio change.
- No se implementa la exclusión de vehículos fuera de servicio de las hojas de ruta (RN-VE-02) ni la
  validación de compatibilidad al asignar un paciente (RN-VE-01): son de `C-10`. Este change deja el
  dato consultable y correcto, nada más.
- No se derivan **las alertas del service preventivo** (RN-VE-03) del historial: siguen calculándose
  de `kilometraje` / `kilometrajeUltimoService` / `fechaUltimoService`, campos propios del vehículo.
  Lo que **sí** cambia por D3-B son las **habilitaciones VTV/RTO** (RN-VE-04), que pasan a derivarse
  del historial. La decisión de `vehiculo-mantenimiento-registro` (*"el historial no es la fuente de
  verdad de los vencimientos"*) queda entonces **parcialmente revertida**: sigue valiendo para el
  service preventivo y deja de valer para VTV/RTO.
- No se migran los datos del `localStorage` de los mocks a Postgres: son fixtures de desarrollo.
- No se introduce TanStack Query ni ninguna librería de data-fetching (mismo criterio que
  `integracion-pacientes` D6 e `integracion-obra-social`).
- No se monta pgTAP ni Supabase local. La pregunta sigue abierta y **este es el tercer change
  consecutivo que la vuelve más cara** (§Open Questions).

---

## Decisions

### D1 — Cuatro archivos nuevos por dominio: mapeo puro + repository + (Conductores) un módulo de fechas

Toda la traducción fila↔dominio vive en módulos de funciones puras exportadas; los repositories solo
hacen `await`, chequean `error` y llaman a esas funciones.

```
shared/lib/vehiculos/
  vehiculoMapping.ts        parseVehiculoRow, parseMantenimientoRow, parseGastoRow,
                            parseHabilitacionRow, parseAccesoriosRows, ensamblarVehiculo,
                            toCrearVehiculoPayload, toActualizarVehiculoPayload
  SupabaseVehiculoRepository.ts

shared/lib/conductores/
  semanaIso.ts              semanaIsoADesdeHasta(semana), desdeHastaASemanaIso(init, fin)
  conductorMapping.ts       parseConductorRow, parseAsignacionRow, ensamblarConductor,
                            toCrearConductorPayload, toActualizarConductorPayload
  SupabaseConductorRepository.ts
```

*Por qué:* Strict TDD funciona mejor sobre funciones puras (RED sin montar fakes de red), y acá el
mapeo **no es trivial**: una unión discriminada de 4 miembros (`MantenimientoRegistro`), dos enums
con valores distintos a los del frontend, una conversión de calendario (semana ISO ↔ par de fechas)
con casos borde de año, y tres colecciones que vienen de tres schemas distintos.

*Por qué `semanaIso.ts` separado y no dentro de `conductorMapping.ts`:* la conversión de semana ISO
es aritmética de calendario pura, sin nada de Postgres, y `C-10` (hojas de ruta) la va a necesitar
igual. Separarla hace que sus ~20 tests de casos borde no se mezclen con los del mapeo de filas.

### D2 — Orden del swap: Vehículos primero, Conductores después; cada fase revertible sola

`tasks.md` ordena las fases para que **el árbol nunca quede a mitad de camino**:

```
§2  Vehiculo.notas + kilometraje, ENTERAMENTE sobre el mock  →  la app anda igual, con campos nuevos
§2B habilitaciones derivadas del historial (D3-B), sobre el mock   ← cambio de UI, no de backend
§2C restricciones → observaciones (D6-B), sobre el mock            ← cambio de UI, no de backend
§2D se elimina el override de colisión, sobre el mock              ← cambio de UI, no de backend
§4  mapeo + repository de Vehículos (nadie los importa todavía)
§5  swap de VehiculosRoute.tsx        ← corte real 1: Vehículos contra Postgres, Conductores en mock
§6  mapeo + repository de Conductores
§7  swap de ConductoresRoute.tsx      ← corte real 2
```

*Por qué §2B, §2C y §2D van antes del mapeo y no junto al swap:* son las consecuencias de UI de los
checkpoints D3, D6 y de la colisión semanal, y **son cambios de forma del dominio**, no
de origen de los datos. Hacerlos
enteramente sobre el mock deja cada uno verificable en navegador por separado, con la app entera
funcionando, y evita que el corte real arrastre a la vez un cambio de persistencia y un cambio de
pantalla. Si algo de §2B/§2C/§2D sale mal, se revierte sin tocar nada de Postgres.

*Por qué Vehículos primero:* `conductores_vehiculos.vehiculo_id` tiene FK a `conductores.vehiculo`, y
`ConductoresRoute.tsx` monta el provider de vehículos. Hacerlo al revés obligaría a que la pantalla
de Conductores resolviera ids de vehículo reales contra un mock que los tiene inventados
(`generateId('vehiculo')`), y el selector de la asignación quedaría roto durante toda una fase.

*Por qué el corte 1 es seguro con Conductores todavía en mock:* la pantalla de Conductores usa
`VehiculoRepository` **de solo lectura** (para el selector). Tras el corte 1 ese selector muestra los
vehículos reales y las asignaciones siguen guardándose en `localStorage` contra ids que ya no
existen. Es un estado **transitorio de una sola fase** y hay que decirlo explícito, no descubrirlo:
`tasks.md` §5.5 lo marca como limitación conocida y §7 la cierra. Si por cualquier motivo el change
se detiene entre §5 y §7, revertir §5 devuelve la coherencia.

### D3 — Las habilitaciones VTV/RTO se derivan del historial de mantenimiento ✅ DECIDIDO

**El problema.** `Vehiculo.habilitaciones: RegistroHabilitacion[]` (`{ tipo: 'vtv' | 'rto',
fechaEmision, fechaVencimiento }`) es lo que alimenta las alertas de RN-VE-04 (VTV cada 6 meses, RTO
independiente) en la pantalla. **No tiene ninguna tabla ni columna en la base.** Y ya hay una
duplicación documentada y sin resolver (`CHANGES.md` §C-08, punto 2 del bloque de
`vehiculo-mantenimiento-registro`): el mismo vencimiento vive en
`MantenimientoRegistro.proximoVencimientoFecha` cuando el subtipo es `'vtv'` o `'rto'`.

El docx no ayuda a decidir solo: modela VTV/RTO como ítems del catálogo genérico de documentos
vehiculares **sin fecha de vencimiento propia**, y dice que *"el vencimiento se rastrea vía
mantenimiento"* — sin decir cómo.

**Las dos opciones reales:**

| | **A. Tabla propia `conductores.habilitaciones_vehiculo`** | **B. Derivarlas de `conductores.mantenimiento`** |
|---|---|---|
| Forma | `(id, vehiculo_id, tipo CHECK IN ('vtv','rto'), fecha_emision, fecha_vencimiento)` | filas con `categoria='preventivo'` y `subtipo IN ('vtv','rto')`: `fecha` → `fechaEmision`, `fecha_proximo_vencimiento` → `fechaVencimiento` |
| Frontend | `habilitaciones` y `mantenimientos` siguen siendo dos colecciones independientes | `habilitaciones` pasa a ser **derivada**: se calcula en el mapeo, la UI de alta de habilitación pasa a dar de alta un mantenimiento |
| Duplicación | **se consolida** (una VTV cargada por dos vías queda como dos filas de dos tablas distintas) | **se elimina** — la causa raíz desaparece |
| Alineación con el docx | divergente (crea una entidad que el docx no tiene) | alineada (*"el vencimiento se rastrea vía mantenimiento"*) |
| Costo | bajo: tabla nueva + RLS + mapeo directo | medio: cambia el flujo de alta de habilitación en la UI, y toca la decisión ya tomada por `vehiculo-mantenimiento-registro` ("el historial no es la fuente de verdad de los vencimientos") |
| Riesgo | la duplicación queda para siempre y se vuelve dato inconsistente en producción | revertir una decisión de UI reciente que la usuaria ya verificó en navegador |

**✅ La usuaria resolvió por B (2026-07-31).** Las habilitaciones VTV/RTO se derivan de
`conductores.mantenimiento`. **No se crea `conductores.habilitaciones_vehiculo`** — esa tabla queda
descartada de todo el change (migración, RPC, RLS y mapeo) y sale también del inventario D15. La
duplicación de la que hablaba `CHANGES.md` §C-08 punto 2 **se elimina en la causa raíz**, no se
documenta como deuda.

**Regla de derivación, exacta y testeable** (es la parte que ninguna fuente resolvía, y que esta
decisión obliga a fijar acá):

```
habilitaciones = para cada tipo ∈ {'vtv', 'rto'}:
    candidatas = filas de mantenimiento con categoria='preventivo' y subtipo=tipo
                 y fecha_proximo_vencimiento NOT NULL
    si candidatas está vacío           → no se emite habilitación de ese tipo
    si no                              → se toma la de `fecha` MÁS RECIENTE
                                         (desempate determinista por `id`), y:
                                            fechaEmision    ← fecha
                                            fechaVencimiento ← fecha_proximo_vencimiento
```

*Por qué la más reciente y no todas:* `RegistroHabilitacion` modela **el estado vigente** de la
habilitación (es lo que consume `estadoHabilitacion()` para RN-VE-04), no su historia. La historia
completa ya está —y ahora **solo**— en el historial de mantenimiento. *Por qué se exige
`fecha_proximo_vencimiento`:* una intervención de VTV sin vencimiento cargado no permite calcular
ningún estado; emitir una habilitación con fecha inventada sería exactamente lo que la regla dura
del proyecto prohíbe.

**Consecuencias, todas explícitas:**

1. **`Vehiculo.habilitaciones[]` pasa a ser un dato derivado**, calculado en el mapeo puro
   (`derivarHabilitaciones(mantenimientos)`), **no persistido**. El tipo del frontend **no cambia**:
   `habilitaciones: RegistroHabilitacion[]` sigue existiendo y los consumidores
   (`estadoHabilitacion`, `VehiculoMantenimiento`, `VehiculosList`, las alertas del dashboard y
   `alertasMantenimiento`) siguen funcionando sin tocarse. Lo que cambia es **quién lo llena**.
2. **La escritura ignora `habilitaciones`.** `toCrearVehiculoPayload` / `toActualizarVehiculoPayload`
   **nunca** emiten esa clave, y las RPC no tienen ninguna tabla donde ponerla. Un payload que la
   traiga no falla: se descarta en el mapeo, porque es un campo de salida.
3. **La UI de alta cambia** (`tasks.md` §2B). Hoy no existe un formulario de alta de habilitación
   —`VehiculoDetail` crea el vehículo con `habilitaciones: []` y `VehiculoMantenimiento` solo las
   muestra—, así que el "cambio de flujo" concreto es: **la única vía de carga de una VTV/RTO pasa a
   ser `NuevoMantenimientoForm` con tipo preventivo + subtipo `vtv`/`rto`**, que ya existe y ya está
   validado. Las dos secciones que las muestran dejan de presentarlas como una colección propia:
   el estado vacío de `VehiculoMantenimiento` pasa a decir de dónde salen, y el `AvisoModeloDatos`
   de la sección Mantenimiento se reescribe (§8.3).
4. **El mock queda coherente con la real**: el fixture pasa a traer, para cada habilitación que
   muestre, su fila de mantenimiento `preventivo` + `vtv`/`rto` con vencimiento. Si no, mock y
   Supabase mostrarían cosas distintas en la misma pantalla y la divergencia sería invisible.
5. **`vehiculo-mantenimiento-historial` §"El historial no es la fuente de verdad de los
   vencimientos" se invierte para VTV/RTO** y se mantiene para el service preventivo. El delta de
   ese spec se actualiza en este mismo change, no en uno posterior.

### D4 — La categoría de mantenimiento de dos niveles gana columnas reales

**El problema.** `vehiculo-mantenimiento-registro` (archivado 2026-07-31) modeló
`MantenimientoRegistro` como una **unión discriminada de 4 miembros** con categoría de dos niveles:

```ts
tipoIntervencion: 'preventivo'  → subtipo: 'cambio-aceite-filtros' | 'vtv' | 'rto'
tipoIntervencion: 'correctivo'  → subtipo: 'alternador' | 'bateria' | 'frenos' | 'embrague' | 'cubiertas'
tipoIntervencion: 'correctivo'  → subtipo: 'otro'  +  detalle: string   (requerido)
tipoIntervencion: 'gasto'       → (sin subtipo)
```

`conductores.mantenimiento` solo tiene el **nivel 1** (`categoria conductores.categoria_mantenimiento`,
que ya coincide exactamente con `TipoIntervencion`). No hay dónde guardar el subtipo ni el `detalle`
del caso `'otro'` ni la `descripcion`.

**La decisión.** Tres columnas aditivas, con los valores **exactos** de las uniones del frontend —
no se inventa ninguno:

```sql
ALTER TABLE conductores.mantenimiento
  ADD COLUMN subtipo     TEXT,
  ADD COLUMN detalle     TEXT,
  ADD COLUMN descripcion TEXT;

-- CHECK de coherencia con la unión discriminada, en un solo constraint:
ALTER TABLE conductores.mantenimiento ADD CONSTRAINT chk_categoria_subtipo CHECK (
  (categoria = 'gasto'      AND subtipo IS NULL AND detalle IS NULL) OR
  (categoria = 'preventivo' AND subtipo IN ('cambio-aceite-filtros','vtv','rto') AND detalle IS NULL) OR
  (categoria = 'correctivo' AND subtipo = 'otro' AND detalle IS NOT NULL AND btrim(detalle) <> '') OR
  (categoria = 'correctivo' AND subtipo IN ('alternador','bateria','frenos','embrague','cubiertas'))
) NOT VALID;
```

**`NOT VALID` a propósito** (mismo patrón expand/contract que `integracion-obra-social` D4): si la
tabla ya tiene filas cargadas por backend, todas tendrían `subtipo IS NULL` y el `ADD CONSTRAINT`
directo rompería el deploy. La validación (`VALIDATE CONSTRAINT`) es una tarea **separada y
posterior**, después de confirmar que no hay filas violatorias — si las hay, se reportan en vez de
bloquear.

**El CHECK es el que hace que el type guard del mapeo sea honesto.** Sin él, `parseMantenimientoRow`
tendría que decidir qué hacer con una fila `correctivo` + `subtipo='otro'` + `detalle=NULL`, que no
corresponde a ningún miembro de la unión. Con él, esa fila no puede existir; y si igual apareciera
(por el `NOT VALID`), el mapeo la **descarta** sin romper el vehículo entero — misma política que el
mapeo de Pacientes con filas hijas malformadas.

*Alternativa descartada:* un `subtipo` como enum de Postgres. Los subtipos son un catálogo de negocio
que va a crecer (US-500 dice *"alternador, batería, frenos, embrague, cubiertas, **etc.**"*), y
agregar un valor a un enum de Postgres es una migración con `ALTER TYPE`; un CHECK sobre TEXT se
amplía con un `DROP CONSTRAINT` + `ADD CONSTRAINT` y no bloquea. El escape `'otro' + detalle` ya está
diseñado justo para eso.

### D5 — El catálogo de accesorios se siembra y el gateo cruzado degrada con aviso ✅ DECIDIDO

**El hecho verificado.** `conductores.accesorios_vehiculo` es una tabla de vínculo contra
`pacientes.accesorios (id, tipo TEXT NOT NULL, descripcion)`. Ese catálogo **está vacío**: ninguna
migración del repo inserta una sola fila. Consecuencia inmediata y no obvia: con el repository real,
`Vehiculo.accesoriosCompatibles` **no se puede escribir** (no hay `accesorio_id` que referenciar), y
`Paciente.accesorioMovilidad` —que `integracion-pacientes` ya lee de la misma tabla— tampoco.
RN-VE-01, la regla que existe *"para evitar errores humanos"*, no tiene datos contra los que operar.

**Dos problemas encadenados, no uno:**

1. **El catálogo está vacío.** Hay que sembrarlo con exactamente los 5 valores de la unión cerrada
   `AccesorioMovilidad` (`silla-plegable`, `silla-rigida`, `silla-postural`, `andador`, `tripode`).
   `pacientes.accesorios.tipo` no tiene `UNIQUE`, así que el seed no es idempotente sin agregarlo
   primero: `ADD CONSTRAINT uq_accesorios_tipo UNIQUE (tipo)` + `INSERT … ON CONFLICT (tipo) DO
   NOTHING`. **No hay texto libre en juego** — a diferencia del catálogo compartido de
   `integracion-obra-social` D3, acá lo que se siembra es una unión cerrada del frontend, no lo que
   un usuario tipeó.
2. **El catálogo está gateado por `pacientes`, no por `vehiculos`.** Una cuenta con
   `vehiculos: write` y sin `pacientes: read` ve **todos los vehículos sin accesorios**, y no puede
   guardar ninguno. RLS filtra el embed en silencio; no hay error.

**La decisión para (1): sembrar en esta migración, con los 5 valores del frontend.** Es la única
opción que deja RN-VE-01 operativa, y desbloquea de paso el mismo hueco en `integracion-pacientes`.

**La decisión para (2) era el checkpoint.** Tres opciones:

| Opción | Qué implica | Efecto en la usuaria |
|---|---|---|
| **A. Degradar y avisar** ✅ **elegida** | sin `pacientes: read`, el vehículo se lee entero pero con `accesoriosCompatibles: []`, y la pantalla muestra un `AvisoModeloDatos` que dice *por qué* está vacío | ninguna cuenta se rompe; el operador entiende qué le falta |
| B. Mover `pacientes.accesorios` a un módulo compartido o duplicar el catálogo bajo `conductores` | migración de policies + posible duplicación de datos | cambia el modelo de permisos que la usuaria ya confirmó en `permisos-modulos-granulares` |
| C. Exigir `pacientes: read` para entrar a Vehículos | el gateo de ruta pide dos permisos | cuentas que hoy funcionan dejan de entrar |

**✅ La usuaria resolvió por A (2026-07-31).** Nunca inventar un accesorio, nunca fallar la lectura
entera del vehículo por una colección que RLS ocultó. Es la misma política de degradación explícita
que `integracion-pacientes` D3 usó para el número de afiliado cross-schema. **El modelo de permisos
no se toca**: `pacientes.accesorios` sigue gateada por el módulo `pacientes` (B queda descartada), y
ninguna ruta pasa a exigir dos permisos para entrar (C queda descartada).

**Coherencia con D10 — verificada.** D10 ya estaba escrita asumiendo esta resolución: su fila
`pacientes: read` dice exactamente *"`accesoriosCompatibles: []` + `AvisoModeloDatos` en
`VehiculoDetail` explicando que falta el permiso `pacientes`, **no** «este vehículo no admite
accesorios»"*. D5 y D10 dicen ahora lo mismo y **D10 es la especificación normativa del
comportamiento**; D5 se queda con la decisión de modelo (el catálogo se siembra, el gateo no se
mueve). El cartel correspondiente es la tarea §8.2 y solo se muestra cuando el flag de degradación
del repository (§5.4) está activo — nunca ante una lista genuinamente vacía.

### D6 — `Conductor.restricciones` desaparece: todo va a `notas`, como el docx ✅ DECIDIDO

**El problema, que ya estaba anotado y nunca se cerró.** `CHANGES.md` §C-09 pendiente #1 y
`knowledge-base/04_modelo_de_datos.md` §Discrepancias lo dicen igual: el frontend modela
`restricciones: RestriccionConductor[]` (hoy un solo valor, `'no-carga-fisica'`) **más** un
`observaciones?: string` aparte; el docx tiene un único campo `Notas` de texto libre donde conviven
las dos cosas. La base implementó el docx: `conductores.conductores.notas TEXT`, y nada más.

**Por qué no se puede simplemente mapear `observaciones` → `notas` y listo.** Porque
`restricciones` no es decoración: es lo que `C-10` va a consultar para no asignar a un conductor un
paciente que requiere carga física (US-600, RN-GL-03). Si se funde en texto libre, esa regla deja de
ser computable y pasa a ser una lectura humana.

| Opción | Forma en la base | Consecuencia |
|---|---|---|
| A. Columna estructurada + `notas` para observaciones | `restricciones TEXT[] NOT NULL DEFAULT '{}'` con CHECK contra la unión, y `notas` ↔ `observaciones` | el frontend no cambia; `C-10` puede filtrar; divergente del docx (se documenta) |
| **B. Todo a `notas` (docx literal)** ✅ **elegida** | `restricciones` desaparece de la base **y del dominio**; queda un único campo de texto libre | alineado al docx; cambia la pantalla ya aprobada y deja RN-GL-03 sin dato computable |
| C. Tabla de vínculo `conductores.restricciones_conductor` contra un catálogo | 3NF pura | correcto pero desproporcionado para una unión de **un** valor; y abre la pregunta de quién administra el catálogo |

**✅ La usuaria resolvió por B (2026-07-31), no por la A que proponía este documento.** El docx manda
en estructura y esa regla se aplica sin excepción: `conductores.conductores.notas TEXT` es el único
lugar donde vive tanto la observación libre como cualquier restricción de perfil. **No se agrega
ninguna columna** a `conductores.conductores` en este change.

**Esto es un cambio de scope real, no solo de backend.** Lo que implica, punto por punto:

1. **El tipo desaparece del dominio.** `Conductor.restricciones: RestriccionConductor[]` se elimina
   de `frontend/src/shared/types/conductor.ts`, junto con la unión `RestriccionConductor` y el
   módulo `features/conductores/restriccionConductorOptions.ts` completo. El único campo de texto
   libre del perfil pasa a ser **`observaciones?: string`**, que ya existe y ya mapea a la columna
   `notas` (D15 #1 / `conductor-repository-supabase` §Renombre de columnas). **No se renombra
   `observaciones` a `notas`** en el frontend: el renombre columna↔dominio ya estaba resuelto y
   cambiarlo ahora sería churn sin beneficio.
2. **Tres pantallas cambian**, todas dadas por intocables en la versión original de este documento:
   `ConductorForm.tsx` (se saca el `<fieldset>` de checkboxes y su `Chip` de "pendiente de
   confirmar"; el `Textarea` de observaciones queda como único lugar), `ConductorDetail.tsx` (se
   saca el bloque de `Chip`s de restricciones de la ficha) y **`ConductoresList.tsx`**, que también
   las muestra por fila y que la consigna original del checkpoint no había detectado. Van con sus
   tests, en `tasks.md` §2C, sobre el mock y antes del swap.
3. **`C-10` (hojas de ruta) pierde el filtro automático por restricción.** Es la consecuencia
   costosa y la usuaria la asumió a sabiendas: RN-GL-03 / US-600 (*"no asignar a un conductor un
   paciente que requiere carga física"*) pasa a ser **lectura humana de un texto libre**, no un
   predicado computable. `C-10` no va a poder excluir conductores automáticamente por este criterio;
   como mucho puede mostrar las observaciones junto al conductor en el armado del recorrido, para
   que la persona decida. **Esta decisión está tomada y no se reabre**: no corresponde que `C-10`
   proponga volver a estructurar el campo sin una decisión nueva de la usuaria.
4. **El `AvisoModeloDatos` de `ConductorDetail` se reescribe** (§8.5): deja de anunciar una
   divergencia pendiente con el docx —ya no hay divergencia— y pasa a explicar que las restricciones
   de perfil se anotan en Observaciones, como texto libre, alineado al modelo de datos real.
5. **El pendiente #1 de C-09 queda cerrado**, y con él la pregunta de §Open Questions sobre si el
   catálogo tenía más valores que `'no-carga-fisica'`: con B es **irrelevante**, porque no hay
   catálogo. Se documenta como cerrada, no como abierta.

*Lo que se pierde y conviene tener escrito:* un `SCHEMA_VERSION` del mock no alcanza para recuperar
restricciones ya cargadas — pero no hay dato de producción (el mock es fixture de desarrollo y la
columna estructurada nunca existió en Postgres), así que no hay migración de datos que hacer. Es
puramente una eliminación de código.

### D7 — La asignación semanal se persiste como dos fechas; la etiqueta ISO se deriva

**El problema.** `AsignacionSemanal.semana` es una etiqueta ISO-8601 (`'2026-W30'`);
`conductores.conductores_vehiculos` tiene `fecha_init DATE NOT NULL` y `fecha_fin_semana DATE NOT
NULL`. Es el pendiente #5 de C-09 y una discrepancia ya señalizada con `AvisoModeloDatos`.

**La decisión — no es checkpoint, la resuelve la regla dura del proyecto.** *El docx manda en
estructura*: se persiste el par de fechas, tal como está la base, y **el tipo del frontend no
cambia**. La traducción vive entera en `semanaIso.ts`, pura y bidireccional:

```
LECTURA   (fecha_init, fecha_fin_semana) ──▶ semana: string
            desdeHastaASemanaIso(init, fin) → la semana ISO que contiene `fecha_init`

ESCRITURA semana: string ──▶ (fecha_init, fecha_fin_semana)
            semanaIsoADesdeHasta('2026-W30') → (lunes de esa semana, domingo de esa semana)
```

**Los casos borde son la parte que importa**, y por eso el módulo tiene tests propios: la semana 1
ISO es *la que contiene el primer jueves del año* (no la del 1 de enero); hay años de 53 semanas;
una semana puede cruzar el cambio de año (`2026-W53` empieza en diciembre y termina en enero); y
`fecha_init` es un `DATE` de Postgres — se parsea **como fecha local sin zona horaria**, nunca con
`new Date('2026-07-27')`, que la interpreta como UTC y en Argentina (UTC−3) devuelve el día anterior.
Ese bug de off-by-one-día es el error más probable de todo el change y tiene test dedicado.

**Degradación de una fila incoherente.** Si el backend cargara una fila cuyo `fecha_init` no es lunes
o cuyo `fecha_fin_semana` no es el domingo correspondiente, el mapeo **no la descarta ni la
"corrige"**: deriva la semana ISO que contiene `fecha_init` y sigue. Es lo único que preserva el dato
que un humano cargó a mano.

*Alternativa descartada:* agregar `semana TEXT` a la tabla y guardar la etiqueta. Duplicaría la
información con las dos fechas que el docx sí pide, y crearía la posibilidad de que se
desincronicen.

#### Colisión de asignación semanal: se bloquea siempre, y la barrera es un constraint ✅ DECIDIDO

Resolución del pendiente #2 de C-09 (era la primera pregunta de §Open Questions): **un conductor
nunca puede tener dos vehículos asignados la misma semana. Se bloquea siempre, sin excepción y sin
override.**

**Por qué el bloqueo incondicional y no la excepción:**

- **Ninguna fuente confirma que la excepción sea un caso real de negocio.** Ni la KB ni el docx la
  mencionan; era una hipótesis del frontend, no un requisito.
- **El override `permitirMultiple` que existe hoy nunca se usó.** Vive como `useState` local de
  `AsignacionSemanalTabla.tsx` y **está apagado por defecto desde que se implementó `conductores-ui`
  (2026-07-24)**. Mantenerlo sería fijar en la base y en la RPC una flexibilización que nadie ejerció.
- **Bloquear siempre es más simple y más seguro**: se resuelve con **un constraint de base de datos**,
  no con lógica de aplicación. Nada que threadear desde la UI hasta un `jsonb`, nada que un cliente
  que evita el repository pueda saltear, nada que testear en tres capas.
- **La asimetría de costos manda.** Si mañana aparece un caso real confirmado por la cliente, agregar
  la excepción es un change chico y acotado. Sacar una flexibilización de la que la gente ya depende
  es mucho más caro. Se empieza por lo restrictivo.

**Cómo se implementa — un `UNIQUE` con nombre, en la migración de campos:**

```sql
ALTER TABLE conductores.conductores_vehiculos
  ADD CONSTRAINT uq_conductor_semana UNIQUE (conductor_id, fecha_init);
```

*Por qué un constraint con nombre y no `CREATE UNIQUE INDEX` suelto:* el nombre del constraint es lo
que viaja en el error de Postgres, y es **exactamente** lo que permite que `mapearErrorConductor`
distinga los dos `23505` posibles (ver D12). Además queda declarado como intención en
`information_schema.table_constraints` y se revierte por nombre, simétricamente.

*Por qué no es un índice **parcial** (`WHERE …`):* `conductores_vehiculos` no tiene soft-delete, ni
`estado`, ni `activo` — cada fila es una asignación vigente. No hay nada que filtrar, y un `WHERE`
siempre verdadero sería ruido que sugiere una condición que no existe.

**Relación con el `UNIQUE(conductor_id, vehiculo_id, fecha_init)` que ya existe.** El nuevo constraint
lo **subsume**: todo lo que rechazaba el viejo lo rechaza también el nuevo. Igual **no se elimina** —
este change no edita ni borra nada que una migración aplicada haya creado, y dropearlo no compra nada.
Consecuencia a saber, y es cosmética: cuando alguien repite el trío exacto
`(conductor, vehículo, semana)` se violan los dos, y Postgres reporta el índice que chequea primero
(el más viejo, de OID menor) → `conductores_vehiculos_conductor_id_vehiculo_id_fecha_init_key`. Los
dos mensajes de D12 son ciertos en ese caso, así que la ambigüedad no confunde a nadie.

**El constraint no admite `NOT VALID`** (a diferencia del CHECK de D4): `ADD CONSTRAINT … UNIQUE`
construye el índice y **falla el deploy** si ya hay filas violatorias. Por eso hay una verificación
previa explícita y bloqueante (`tasks.md` 1B.9): si aparecen filas con el mismo conductor y la misma
`fecha_init` y vehículos distintos, **se reportan a la usuaria**, no se borran ni se "arreglan" desde
el agente.

**En el frontend, la validación pura pasa a ser incondicional.** `validarAsignacionSemanal` pierde el
parámetro `permitirMultiple` y `AsignacionSemanalTabla.tsx` pierde su `useState` y su toggle
"Permitir múltiple" (`tasks.md` §2D). Sigue existiendo como **feedback inmediato** —para que el error
aparezca antes de ir al servidor— pero ya no es la única defensa: la barrera real es el constraint,
que ningún cliente puede saltear. Los tipos de payload (`NuevoConductor` / `ActualizacionConductor`)
**no cambian**: no hay ningún flag que llevar.

*Alternativa descartada:* validar dentro de `crear_/actualizar_conductor_completo` con un flag
`permitirMultiple` en el `jsonb`. Era la única forma de expresar *"prohibido salvo que quien escribe
lo pida"*, y con el override eliminado esa expresividad ya no hace falta. Mover a la aplicación algo
que la base garantiza sola sería lógica de más, con más superficie de bug y menos garantía.

### D8 — El swap del `DocumentoRepository` queda fuera de este change ✅ DECIDIDO

`conductores.documentacion_conductores` y `conductores.documentacion_vehiculo` existen, con RLS y
trigger de auditoría. Pero la UI de documentos de las dos pantallas **no** las consume vía
`VehiculoRepository`/`ConductorRepository`: usa `mockDocumentoRepository`, que implementa la interfaz
**compartida** `DocumentoRepository` (`listByEntity` / `upload` / `remove` sobre
`EntidadDocumental = 'paciente' | 'vehiculo' | 'conductor' | 'factura'`).

**No entra acá, por tres razones:**

1. **Es otro tipo de trabajo.** Un `SupabaseDocumentoRepository` toca Supabase **Storage** (subida de
   archivos, buckets, URLs firmadas), no solo PostgREST. Es la fila 8 del plan de integración de
   `CHANGES.md`, con su propio change.
2. **Es transversal.** La misma implementación sirve a Pacientes, Vehículos, Conductores y Facturas.
   Hacerla acá la ataría a dos dominios y obligaría a re-tocarla en los otros dos.
3. **El checklist del conductor sigue sin confirmar** (pendiente #4 de C-09: el frontend sembró
   licencia de conducir / DNI / apto médico *como ejemplo*). Construir la persistencia real sobre un
   checklist inventado sería fijar en la base algo que nadie pidió.

Lo que sí hace este change: dejar la decisión escrita, y **verificar** que las dos tablas de
documentación existen y quedan intactas — este change no las lee ni las escribe.

### D9 — Escritura atómica: cuatro funciones `SECURITY INVOKER`

**El problema.** Guardar un vehículo escribe en hasta **4 tablas de 3 schemas**
(`conductores.vehiculo`, `conductores.accesorios_vehiculo`, `conductores.mantenimiento`,
`facturacion.gastos_vehiculos` — y **ninguna tabla de habilitaciones**, que D3-B eliminó del
diseño: las VTV/RTO viajan como filas de `mantenimiento`). Guardar un conductor escribe en 2
(`conductores.conductores`,
`conductores.conductores_vehiculos`). PostgREST **no da transacciones entre requests**: cada
`insert()` de supabase-js es un request HTTP que commitea por su cuenta. Una secuencia cortada a
mitad deja un vehículo con la mitad del historial de mantenimiento o un conductor con asignaciones
que no corresponden a sus datos.

**La resolución.** Cuatro funciones `plpgsql`, **todas `SECURITY INVOKER`**, en
`20260801120001_conductores_vehiculos_rpc.sql`:

```
conductores.crear_vehiculo_completo(p_vehiculo jsonb)              RETURNS uuid
conductores.actualizar_vehiculo_completo(p_id uuid, p_cambios jsonb) RETURNS uuid
conductores.crear_conductor_completo(p_conductor jsonb)           RETURNS uuid
conductores.actualizar_conductor_completo(p_id uuid, p_cambios jsonb) RETURNS uuid
```

`create()` y `update()` releen con `getById(uuid)` y devuelven eso, de modo que lo devuelto siempre
es lo que quedó realmente en la base (defaults, triggers, normalizaciones).

**Semántica de colecciones: reemplazo completo, no diff.** Igual que `integracion-obra-social` D6 y a
diferencia de `integracion-pacientes` D5, acá las colecciones hijas son identidad-libre desde el
punto de vista de la base: **nada referencia** `accesorios_vehiculo.id`, `mantenimiento.id`,
`gastos_vehiculos.id` ni `conductores_vehiculos.id`. `DELETE` + `INSERT` dentro de la transacción es
trivial de expresar y no pierde ningún id que alguien esté mirando. (Los ids que la UI usa como key
de React son los del array del dominio, que se releen enteros después de cada guardado.)

**Semántica parcial de `p_cambios`.** `ActualizacionVehiculo` / `ActualizacionConductor` son
`Partial<…>`: la ausencia de una clave significa **"no tocar"**. En `jsonb` eso se distingue con el
operador `?` (`p_cambios ? 'mantenimientos'`), que diferencia *clave ausente* de *clave presente con
valor `null`* — `->>` sola no alcanza, y confundirlas **borraría el historial de mantenimiento de
cualquiera que edite solo la patente**. Es la trampa más fácil del change y tiene test dedicado.

#### El detalle que esto resuelve y que un `insert()` suelto no podría

`facturacion.gastos_vehiculos` está gateada por **`facturacion`**, no por `vehiculos`. Si la función
tocara esa tabla siempre, un usuario con `vehiculos: write` y sin `facturacion: write` **no podría
cambiar ni la patente** — el `42501` de la última tabla haría rollback de todo. Por eso la función
toca `gastos_vehiculos` **solo si `p_cambios ? 'gastos'`**. Editar datos del vehículo sin permiso de
facturación funciona; intentar cargar un gasto sin ese permiso falla entero y con mensaje propio.
Mismo criterio para `accesorios_vehiculo` (que necesita leer `pacientes.accesorios`): solo se toca si
la clave viene.

#### ⚠️ `SECURITY INVOKER`, no `SECURITY DEFINER` — requisito de seguridad duro

Las cuatro funciones se declaran **`SECURITY INVOKER`** explícitamente (aunque sea el default de
PostgreSQL) para que sea una afirmación revisable en el diff y no un default silencioso.

**Por qué `DEFINER` sería una regresión inaceptable.** El owner de una función creada por una
migración de Supabase es `postgres`, superusuario, que **bypassea RLS por completo**. Con `DEFINER`,
cualquier usuario autenticado —incluso sin ninguna fila en `modulos.permisos`— podría dar de alta
vehículos y conductores, y de paso **escribir en `facturacion.gastos_vehiculos`**, que pertenece a
otro módulo de permisos con datos financieros. El radio de daño cruza el módulo.

Cómo se hace cumplir el permiso, verificado contra las policies vigentes:

| Tabla escrita por la función | Policy vigente (tras el split) | Efecto sin permiso |
|---|---|---|
| `conductores.vehiculo` | `FOR ALL … USING (tiene_permiso('vehiculos','write'))` | `42501` en el primer INSERT/UPDATE → rollback total |
| `conductores.accesorios_vehiculo` | ídem `vehiculos` | ídem |
| `conductores.mantenimiento` | ídem `vehiculos` | ídem |
| `conductores.conductores` | `… USING (tiene_permiso('conductores','write'))` | ídem |
| `conductores.conductores_vehiculos` | **`vehiculos`**, no `conductores` | ídem — y por eso D10 |
| `facturacion.gastos_vehiculos` | `… USING (tiene_permiso('facturacion','write'))` | ídem, solo si la clave `gastos` viene |
| `pacientes.accesorios` (solo SELECT) | `… USING (tiene_permiso('pacientes','read'))` | fila invisible → `accesorio_id` no resuelve |

Las policies existentes son `FOR ALL` **con `USING` y sin `WITH CHECK`**, y en ese caso PostgreSQL usa
la expresión de `USING` también como check de `INSERT` (mismo detalle que ya verificaron
`integracion-pacientes` D4 e `integracion-obra-social` D6). Tras la resolución de D3 por la opción B,
**este change no crea ninguna tabla nueva**, así que no hay policies nuevas que escribir: se apoya
enteramente en las 7 tablas ya existentes y sus policies vigentes.

`SET search_path = ''` en las cuatro, `REVOKE ALL … FROM PUBLIC` y `FROM anon`,
`GRANT EXECUTE … TO authenticated`, y `COMMENT ON FUNCTION` con la prohibición de `DEFINER` escrita
para quien lea la base sin abrir este documento.

#### Errores propios de las funciones (clase `45`, libre en PostgreSQL)

| Código | Cuándo | Mensaje de UI |
|---|---|---|
| `45201` | `p_vehiculo` / `p_conductor` no es un objeto JSON | `No se pudo guardar el vehículo.` / `…el conductor.` (genérico — es un bug del cliente) |
| `45202` | `actualizar_…` con un id que no existe (o que RLS oculta) | `No existe un vehículo con id "…".` / `No existe un conductor con id "…".` (idéntico al mock) |
| `45203` | un accesorio del payload no existe en `pacientes.accesorios` | `No se pudo guardar: el accesorio «…» no está en el catálogo.` |
| `45204` | una intervención de mantenimiento llega con categoría/subtipo incoherente | `Revisá la categoría de la intervención de mantenimiento.` |

**Las funciones no validan la colisión de asignación semanal**, y por eso no hay un `45205`: esa
regla la garantiza el constraint `uq_conductor_semana` de la tabla (D7 §Colisión) y llega al
repository como un `23505` común, traducido en D12. Es la diferencia entre una invariante del dato
—que corresponde a la base— y una coherencia del payload —que sí corresponde a la función.

#### Auditoría y rollback

Los triggers `auditoria.log_action()` de las 7 tablas disparan fila por fila **dentro de la misma
transacción** (RN-GL-02): un alta deja su rastro completo o no deja ninguno. Rollback de las
funciones: `DROP FUNCTION` × 4 — no crean ni alteran tablas, columnas, policies ni datos.

### D10 — Degradación explícita, nunca dato inventado, cuando falta un permiso cruzado

Es la consecuencia directa del mapa de cuatro módulos, y la decisión de comportamiento más visible
del change. **RLS filtra filas; no devuelve error.** Sin una política explícita, una cuenta con
permisos parciales vería pantallas silenciosamente incompletas y las tomaría por datos correctos.

| Falta | Qué pasa hoy en la base | Qué hace este change |
|---|---|---|
| `pacientes: read` | el embed de `accesorios_vehiculo → accesorios` vuelve vacío | `accesoriosCompatibles: []` + `AvisoModeloDatos` en `VehiculoDetail` explicando que falta el permiso `pacientes`, **no** "este vehículo no admite accesorios" |
| `facturacion: read` | `gastos_vehiculos` vuelve vacío | `gastos: []` + cartel en la sección Gastos: *"no se muestran por falta de permiso de facturación"*, nunca "$0" ni "sin gastos" |
| `facturacion: write` | `42501` al guardar un gasto | mensaje propio: `No tenés permiso para registrar gastos del vehículo.` — y **el resto del vehículo sí se guarda** si el payload no traía gastos (D9) |
| `vehiculos: read` (estando en Conductores) | `conductores_vehiculos` vuelve vacío **y** el selector de vehículos vuelve vacío | `asignaciones: []` + cartel en `ConductorDetail` §Flota: *"la asignación semanal requiere permiso del módulo Vehículos"* |
| `vehiculos: write` (estando en Conductores) | `42501` al guardar una asignación | mensaje propio: `No tenés permiso para modificar asignaciones de vehículos.` |

**El caso 4 es el que hay que subrayar**: es contra-intuitivo que la pantalla de Conductores necesite
el permiso de Vehículos, y hoy no está escrito en ningún lado. Va a la KB, a `CHANGES.md` y a la UI.

*Por qué degradar y no fallar:* fallar la lectura entera del vehículo porque RLS ocultó una colección
convierte un permiso faltante en una pantalla rota. Degradar con cartel convierte lo mismo en
información accionable. Es la misma política de `integracion-pacientes` D3.

### D11 — Lectura: una consulta por schema, embeds de PostgREST, orden client-side

```
supabase.schema('conductores').from('vehiculo').select(`
  id, patente, modelo, tipo, capacidad, año, estado, notas,
  kilometraje, kilometraje_ultimo_service, fecha_ultimo_service,
  accesorios_vehiculo ( accesorio_id, accesorios:accesorio_id ( id, tipo ) ),
  mantenimiento ( id, categoria, subtipo, detalle, descripcion, fecha,
                  fecha_proximo_vencimiento, km_actual, km_proximo_vencimiento )
`)
```

Una **segunda** consulta, batcheada, para `facturacion.gastos_vehiculos` (otro schema, otro módulo):
una sola query filtrada por `vehiculo_id IN (…)` para `list()`, agrupada client-side — nunca N+1.
Misma técnica que `integracion-pacientes` usó para `obra_social.coberturas_paciente`.

Conductores es más simple: un solo schema, un solo embed.

```
supabase.schema('conductores').from('conductores').select(`
  id, nombre, apellido, dni, cuil, telefono, fecha_nacimiento, domicilio, estado, notas,
  conductores_vehiculos ( id, vehiculo_id, fecha_init, fecha_fin_semana )
`)
```

`getById` agrega `.eq('id', id).maybeSingle()`. El ordenamiento de las colecciones se aplica
**client-side en el mapeo puro** (mantenimientos y gastos por `fecha` desc, asignaciones por
`fecha_init` asc, `id` como desempate determinista), no con `.order()` sobre el embed: es
determinista, testeable sin red, y no depende de la sintaxis de ordenamiento de embeds de PostgREST,
que es la parte de la API que más ha cambiado entre versiones.

**Flujo de `getById` de Vehículo (secuencia):**

```
UI (VehiculoDetail)
  └─> useVehiculos / repository.getById(id)
        ├─> schema('conductores').from('vehiculo').select(embeds).eq('id',id).maybeSingle()
        │     └─> RLS 'vehiculos:read' en vehiculo/accesorios_vehiculo/mantenimiento
        │           ├── permitido -> row (con embeds, quizá parciales)
        │           └── denegado  -> row = null   (RLS filtra, NO devuelve error)
        ├─> si row === null -> return null            (contrato: no lanza)
        ├─> schema('facturacion').from('gastos_vehiculos').select().eq('vehiculo_id',id)
        │     └─> RLS 'facturacion:read'
        │           └── denegado -> [] + flag de degradación (D10), NO error
        └─> ensamblarVehiculo(row, gastos)            (puro: uniones, orden, enums)
              -> Vehiculo
```

### D12 — Traducción de errores: PostgREST → `Error` con mensaje de UI

`useVehiculos` / `useConductores` pintan `err.message` directamente, así que los repositories
**siempre** lanzan `Error` con `.message` en castellano listo para mostrar. Como no existe un
traductor compartido en el repo (`SupabasePacienteRepository` y `SupabaseCuentaRepository` tienen
cada uno el suyo), este change escribe `mapearErrorVehiculo` y `mapearErrorConductor` siguiendo el
mismo idioma de `switch` sobre `code`:

| Señal | Mensaje |
|---|---|
| `23505` sobre `vehiculo.patente` | `Ya existe un vehículo con la patente «…».` |
| `23505` sobre `conductores.dni` | `Ya existe un conductor con el documento «…».` |
| `23505` sobre `conductores_vehiculos_conductor_id_vehiculo_id_fecha_init_key` | `Ese conductor ya tiene ese vehículo asignado en esa semana.` |
| `23505` sobre **`uq_conductor_semana`** (D7 §Colisión) | `Ese conductor ya tiene otro vehículo asignado en esa semana.` |
| `23503` (FK) al asignar un vehículo inexistente | `El vehículo seleccionado ya no existe.` |
| `23514` (CHECK de `chk_categoria_subtipo`) | `Revisá la categoría de la intervención de mantenimiento.` |
| `22P02` (valor fuera del enum de estado) | `El estado indicado no es válido.` |
| `42501` / `PGRST301` sobre `vehiculos` | `No tenés permiso para modificar vehículos.` |
| `42501` / `PGRST301` sobre `conductores` | `No tenés permiso para modificar conductores.` |
| `42501` sobre `facturacion` | `No tenés permiso para registrar gastos del vehículo.` |
| `45201` – `45204` | los de la tabla de D9 |
| `PGRST202` (RPC inexistente → migración sin aplicar) | `El alta de vehículos no está habilitada en el servidor todavía.` |
| `PGRST204` (columna inexistente → migración sin aplicar) | `Esta pantalla necesita una actualización del servidor que todavía no se aplicó.` |
| `PGRST106` (schema no expuesto) | `El módulo de Flota no está habilitado en el servidor.` |
| cualquier otro | `No se pudo cargar/guardar el vehículo.` / `…el conductor.` según la operación |
| `getById` sin fila | **no lanza** → `null` (contrato explícito de la interfaz) |

*Por qué mensajes fijos y no el `error.message` crudo:* filtra nombres de tablas y columnas hacia la
UI y evita textos en inglés. El contrato de error pasa a ser **normativo** en los specs de
`vehiculo-contract` y `conductor-contract`, porque a partir de acá hay dos implementaciones que deben
coincidir.

**Los dos `23505` de `conductores_vehiculos` se distinguen por el nombre del constraint**, que
PostgREST propaga en `message` / `details` (`duplicate key value violates unique constraint "…"`).
`mapearErrorConductor` matchea ese nombre; el genérico "ya existe una asignación así" queda como
fallback si el nombre no viniera. Los mensajes son deliberadamente distintos —*ese* vehículo vs.
*otro* vehículo— porque las dos situaciones piden acciones distintas de quien está cargando.

**Nota de seguridad.** El gateo de escritura de la UI (`usePuedeEscribir`, cableado por
`gateo-conductores`) es client-side y **bypassable**. La defensa real son las policies. Este change
**no las duplica ni las reimplementa**: solo traduce su rechazo a un mensaje legible, y hay un test
de código fuente que verifica que los repositories no consultan `modulos.permisos`.

### D13 — Enums: los valores de la base y los del frontend no coinciden

| Dominio | Base (enum de Postgres) | Frontend (unión de TS) |
|---|---|---|
| Estado de vehículo | `'habilitado'` / `'fuera de servicio'` | `'habilitado'` / `'fuera-de-servicio'` |
| Estado de conductor | `'operando'` / `'fuera de servicio'` | `'operando'` / `'fuera-de-servicio'` |
| Categoría de mantenimiento | `'gasto'` / `'preventivo'` / `'correctivo'` | idénticos ✅ |

Diferencia de **espacio vs. guion**. Se traduce en el mapeo con dos funciones puras y totales por
dominio (`parseEstadoVehiculo` / `toEstadoVehiculoRow`), no con un `.replace(' ', '-')`: un replace
es silenciosamente correcto hoy y silenciosamente incorrecto en cuanto aparezca un tercer valor.
Un valor desconocido que venga de la base **no rompe la lectura**: se degrada al valor por defecto
del dominio (`'habilitado'` / `'operando'`) y se registra, misma política que las filas hijas
malformadas.

*Por qué no se cambia el enum de la base a guiones:* es un `ALTER TYPE` sobre un enum ya usado por
columnas con default, y el docx usa la forma con espacio (*"fuera de servicio"*). El docx manda en
estructura.

### D14 — Tests: mapeo puro exhaustivo + repositories contra un fake tipado + aserciones sobre el `.sql`

Tres capas, siguiendo el precedente de `SupabasePacienteRepository.test.ts`:

1. **`vehiculoMapping.test.ts` / `conductorMapping.test.ts` / `semanaIso.test.ts`** — funciones
   puras, sin mocks. Cubren: los 4 miembros de la unión `MantenimientoRegistro` (ida y vuelta), la
   fila incoherente descartada sin romper el vehículo, los dos enums con valor desconocido, el orden
   de las tres colecciones incluido el desempate por `id`, colecciones vacías, la semántica parcial
   de `toActualizar…Payload` (clave ausente vs. `null`), y —en `semanaIso`— la semana 1 ISO, los años
   de 53 semanas, la semana que cruza el año y el parseo de `DATE` sin corrimiento de zona horaria.
2. **`SupabaseVehiculoRepository.test.ts` / `SupabaseConductorRepository.test.ts`** —
   `vi.mock('../supabaseClient')` con un fake tipado a mano (interfaces propias, cero `any`, cero
   `as`) que **registra** cada llamada. Permite afirmar cosas que un fake mudo no: que `create()`
   emite **una sola** `.rpc()` y **ningún** `.insert()` sobre las tablas hijas; que `list()` hace
   **una** consulta a `facturacion` y no N; que un `42501` de `facturacion` **no** hace fallar la
   lectura del vehículo.
3. **Las funciones SQL.** El repo sigue sin harness para funciones de Postgres (sin pgTAP, sin
   `supabase/config.toml`, sin CI con Docker). Se sigue el precedente: **verificación manual con
   cuentas reales**, como tareas explícitas y separadas en `tasks.md` §1B, a coordinar con
   Enzo/backend. **La única barrera automatizada** contra la regresión de seguridad más grave es el
   test que lee el `.sql` con `node:fs` y verifica que dice `SECURITY INVOKER` y no `SECURITY
   DEFINER` fuera de comentarios y literales — patrón ya resuelto empíricamente en
   `integracion-pacientes` 3.12b (`?raw` de Vite **no** funciona para rutas fuera de `frontend/`).

Más aserciones de código fuente (`?raw`) de que los repositories no contienen `service_role`, no
contienen `any` y no consultan `modulos.permisos` ni `modulos.modulos`.

### D15 — Inventario de discrepancias: qué se resuelve y qué solo se documenta

| # | Frontend | Base real | Discrepancia | Resolución en este change |
|---|---|---|---|---|
| 1 | `Conductor.documento` | `conductores.dni` | renombre | se mapea; el docx manda en estructura |
| 2 | `estado: 'fuera-de-servicio'` | enum `'fuera de servicio'` | guion vs. espacio (× 2 dominios) | **se resuelve**: mapeo total (D13) |
| 3 | `Vehiculo.kilometraje` + `kilometrajeUltimoService` + `fechaUltimoService` | — | sin columnas; RN-VE-03 no persiste | **se resuelve**: 3 columnas aditivas |
| 4 | `MantenimientoRegistro.subtipo` / `detalle` / `descripcion` | solo `categoria` (nivel 1) | el nivel 2 no tiene dónde guardarse | **se resuelve**: 3 columnas + CHECK (D4) |
| 5 | `GastoVehiculo.descripcion` | — | sin columna (ya anotado en C-08) | **se resuelve**: columna aditiva |
| 6 | `Vehiculo.habilitaciones[]` | — | sin tabla; vencimiento duplicado con mantenimiento | **se resuelve**: D3-B — se derivan de `mantenimiento` (`preventivo` + `vtv`/`rto`), no se crea tabla; la duplicación desaparece |
| 7 | — | `conductores.vehiculo.notas` | columna sin campo en el frontend (ya anotado en C-08) | **se resuelve**: se suma `Vehiculo.notas?` |
| 8 | `Vehiculo.accesoriosCompatibles` (unión cerrada) | `pacientes.accesorios.tipo` TEXT, **vacío** | RN-VE-01 sin datos; catálogo cross-módulo | **se resuelve**: seed + `UNIQUE`; el gateo se resuelve por D5-A (degradar y avisar), el modelo de permisos no se mueve |
| 9 | `Conductor.restricciones[]` (catálogo cerrado) | `notas` TEXT libre | pendiente #1 de C-09, abierto desde 2026-07-24 | **se resuelve**: D6-B — el docx gana, `restricciones` se elimina del dominio y todo va a `observaciones` ↔ `notas`. Costo asumido: `C-10` pierde el filtro computable (RN-GL-03 pasa a lectura humana) |
| 10 | `AsignacionSemanal.semana` (ISO) | `fecha_init` + `fecha_fin_semana` | pendiente #5 de C-09 | **se resuelve**: conversión pura, el tipo no cambia (D7) |
| 11 | colisión de asignación semanal con override `permitirMultiple` | sin constraint (el `UNIQUE` existente no la cubre) | pendiente #2 de C-09 | **se resuelve**: la colisión **se bloquea siempre, sin override**. Se agrega `UNIQUE (conductor_id, fecha_init)` como constraint `uq_conductor_semana` (D7 §Colisión); el override `permitirMultiple` **se elimina** del frontend (nunca se usó) y no hay validación de colisión en la RPC ni flag en los payloads |
| 12 | `Conductor.domicilio` y `cuil` requeridos | columnas nullable | el alta real puede devolver `null` | **se resuelve**: el mapeo degrada a `''`; **la obligatoriedad del alta es pendiente #3 de C-09**, no se cambia acá |
| 13 | una sola pantalla por dominio | 4 módulos de permisos | gateo cruzado invisible | **se resuelve como comportamiento** (D10); el **modelo** de permisos **no se toca** (D5-A) |
| 14 | `Vehiculo` sin campo año | `conductores.vehiculo.año` | columna sin campo en el frontend | **NO se resuelve**: se documenta (columna con nombre no-ASCII, además — ver §Open Questions) |
| 15 | documentos vía `DocumentoRepository` | `documentacion_vehiculo` / `documentacion_conductores` | dos tablas sin consumidor real | **NO se resuelve**: change propio (D8) |
| 16 | checklist de documentos del conductor sembrado "como ejemplo" | — | pendiente #4 de C-09 | **NO se resuelve**: bloqueado por D8 |

Las que dicen "NO se resuelve" van a `knowledge-base/04_modelo_de_datos.md` §Discrepancias, a
`CHANGES.md` §C-08/§C-09 y a un `AvisoModeloDatos` en la pantalla. Ninguna se resuelve
unilateralmente.

---

## Risks / Trade-offs

- **[El gateo cruzado de cuatro módulos deja pantallas silenciosamente parciales]** → riesgo #1 del
  change, porque **RLS filtra filas y no devuelve error**: una cuenta con `conductores: write` y sin
  `vehiculos: read` ve conductores completos con la grilla de asignación vacía, sin ningún indicio de
  que le falta un permiso. Mitigación: D10 (degradación explícita señalizada en la UI, nunca dato
  inventado) + verificación manual de las combinaciones de permisos como tarea **bloqueante**.
- **[El catálogo `pacientes.accesorios` está vacío y es compartido]** → hasta que se siembre, ni
  Vehículos ni Pacientes pueden persistir accesorios, y RN-VE-01 no tiene datos. Mitigación: seed
  idempotente con la unión cerrada del frontend + `UNIQUE (tipo)`. Riesgo residual: si backend ya
  cargó filas con otros nombres (`"Silla plegable"` con mayúscula y espacio), el seed las deja y
  quedan **duplicados semánticos**. Por eso hay una tarea de verificación (`select tipo from
  pacientes.accesorios`) **antes** de escribir la migración.
- **[Alguien convierte una de las 4 funciones a `SECURITY DEFINER`]** → bypass total del gateo por
  módulo, con radio de daño que cruza a `facturacion`. Mitigación en cuatro capas: D9, el bloque ⚠️⚠️
  en la cabecera de la migración, el `COMMENT ON FUNCTION` visible desde el dashboard, y el test
  automatizado del texto del `.sql`.
- **[`p_cambios ? 'clave'` mal implementado borra colecciones enteras]** → editar solo la patente
  podría vaciar el historial de mantenimiento. Es el bug más fácil de escribir y el más difícil de
  notar (la UI recarga y muestra la lista vacía como si fuera correcta). Mitigación: test dedicado
  por colección, y `getById` post-escritura que devuelve lo que quedó realmente en la base.
- **[Off-by-one de zona horaria en las fechas de la asignación semanal]** → `new Date('2026-07-27')`
  se interpreta como UTC; en Argentina (UTC−3) eso es el 26 a las 21:00, y la semana ISO derivada
  puede ser la anterior. Mitigación: `semanaIso.ts` parsea `YYYY-MM-DD` a componentes y construye la
  fecha local, con test explícito del caso lunes.
- **[~~La duplicación VTV/RTO se vuelve dato inconsistente en producción~~]** → **eliminado por
  D3-B**: no hay tabla de habilitaciones, así que no hay dos lugares que se puedan desincronizar.
  El riesgo que **sí** queda, y es menor, es el opuesto: un vehículo con VTV cargada como
  intervención preventiva **sin `fecha_proximo_vencimiento`** no genera ninguna habilitación y la
  ficha la muestra como inexistente. Mitigación: es el mismo dato que hoy haría falta para calcular
  la alerta (sin vencimiento no hay estado posible), el estado vacío de `VehiculoMantenimiento`
  explica de dónde salen las habilitaciones (§2B), y el mapeo nunca inventa una fecha.
- **[La derivación de habilitaciones elige la fila equivocada]** → si un vehículo tiene varias VTV
  históricas, mostrar la vieja como vigente sería peor que no mostrar ninguna. Mitigación: la regla
  de D3 es explícita (la de `fecha` más reciente, desempate por `id`) y tiene test dedicado con al
  menos tres filas del mismo tipo.
- **[Las migraciones no se aplican y las pantallas quedan rotas]** → el frontend pasa a depender de 7
  columnas, 1 constraint, 1 seed y 4 funciones que solo existen tras el `db push`. Síntomas:
  `PGRST204` y `PGRST202`. Mitigación: aplicarlas es tarea **bloqueante** del cableado, y ambos
  códigos tienen mensaje propio en castellano.
- **[Desfasaje del historial de migraciones ya conocido]** → `integracion-pacientes` 1B.3 registró
  ~12 versiones aplicadas al remoto sin commitear y una migración aplicada por SQL Editor sin quedar
  en `supabase_migrations.schema_migrations`. **Este change lo hereda**, y con un agravante propio:
  no está confirmado si `20260724100006_schema_conductores.sql` está aplicada. Mitigación: tarea
  explícita de verificar el estado del historial **antes** de escribir nada, y
  `supabase migration repair --status applied` documentado como salida.
- **[`20260724100006` podría no estar aplicada todavía]** → si estuviera solo en el repo, la
  tentación es editarla en vez de escribir una migración aditiva. **No se hace**: la regla del
  proyecto (*"no se edita ninguna migración ya aplicada"*) más la imposibilidad de verificarlo desde
  el sandbox hacen que la migración aditiva sea la única opción segura. Si la verificación de la
  tarea 1.2 prueba que no está aplicada **ni commiteada**, consolidar es una decisión de la usuaria,
  no del agente.
- **[`uq_conductor_semana` no se puede aplicar porque ya hay filas violatorias]** → a diferencia del
  CHECK de D4, un `ADD CONSTRAINT … UNIQUE` **no admite `NOT VALID`**: construye el índice y hace
  fallar la migración entera si algún conductor ya tiene dos vehículos en la misma `fecha_init`.
  Mitigación: la consulta de verificación de `tasks.md` 1B.9 es **bloqueante** y corre antes de
  escribir la migración; si aparecen filas, se reportan a la usuaria y ella decide la reconciliación
  — el agente no borra ni reasigna nada. Probabilidad baja (el schema se creó el 2026-07-24 y la app
  todavía no escribe contra él), impacto alto si pasa desapercibido.
- **[`ALTER TABLE … ADD COLUMN` sobre tablas con filas]** → en Postgres 11+ no reescribe la tabla y
  no hay ventana de bloqueo relevante; son tablas maestras pequeñas. Riesgo bajo, se anota para que
  quien revise no lo confunda con un cambio destructivo.
- **[Regresión en la suite existente]** → safety net obligatorio: correr `cd frontend && npx vitest
  run` **antes** de tocar cualquier archivo existente y registrar el baseline. Referencia:
  `integracion-pacientes` cerró en 1385 tests, y `vehiculo-mantenimiento-registro` cerró después —
  el baseline real **se mide, no se asume**.
- **[El fake del query builder se desincroniza de supabase-js]** → tests verdes contra una API que
  cambió. Mitigación: consultar `https://supabase.com/changelog.md` antes de implementar (regla de la
  skill `supabase`) y mantener el fake en el subconjunto mínimo usado. Atención especial al embed de
  dos niveles con alias (`accesorios_vehiculo ( accesorios:accesorio_id ( … ) )`), que es la sintaxis
  más frágil de todo el change.

---

## Migration Plan

1. ~~**Checkpoint de diseño** con la usuaria.~~ **✅ Cerrado el 2026-07-31**: D3 → B (derivar de
   mantenimiento), D5 → A (degradar y avisar), D6 → B (todo a `notas`), colisión semanal → **se
   bloquea siempre, con un `UNIQUE` en la base y sin override**. Los pasos siguientes ya no están
   bloqueados. Las tres consecuencias de UI (§2B habilitaciones derivadas, §2C restricciones →
   observaciones, §2D eliminación del override de colisión) son fases propias sobre el mock, antes
   del paso 8.
2. Verificar que el schema `conductores` está en *Exposed schemas* del Data API. `facturacion` y
   `pacientes` también hacen falta (D10) — `pacientes` ya está confirmado por
   `integracion-pacientes`.
3. Verificar el **estado del historial de migraciones** contra el remoto
   (`supabase migration list --linked`) y, en particular, si `20260724100006_schema_conductores.sql`
   está aplicada. Verificar también el contenido actual de `pacientes.accesorios` y que **no haya
   filas que violen `uq_conductor_semana`** (mismo conductor, misma `fecha_init`, vehículos
   distintos): el constraint no admite `NOT VALID` y haría fallar el deploy.
4. Escribir `20260801120000_conductores_vehiculos_campos.sql` (expand aditivo + seed) y
   `20260801120001_conductores_vehiculos_rpc.sql` (las 4 funciones). Revisarlas contra el checklist
   de `supabase-postgres-best-practices` y correr `supabase db advisors --linked --type security`
   **antes** de aplicar (línea base de hallazgos preexistentes) y **después**.
5. **Aplicar las dos migraciones** al proyecto real. **Las corre la usuaria / Enzo, no el agente**: el
   sandbox no tiene Docker ni credenciales. Este paso **bloquea** los pasos 8 y 10.
6. Verificación manual de las 4 funciones con **cuentas reales** (checklist completo en `tasks.md`
   §1B): `vehiculos: write` → alta completa; `vehiculos: read` sin `write` → `42501` y cero filas
   (la prueba de que `INVOKER` está haciendo su trabajo); `vehiculos: write` sin `facturacion: write`
   → edita la patente OK, falla al cargar un gasto; `conductores: write` sin `vehiculos: read` →
   guarda datos personales, no ve ni guarda asignaciones; y
   `select prosecdef from pg_proc where pronamespace = 'conductores'::regnamespace` → `false` en las
   4 filas nuevas.
7. Fases **enteramente sobre el mock**, en este orden y cada una revertible por sí sola:
   (a) `Vehiculo.notas` + kilometraje (tipo, `SCHEMA_VERSION` 3→4, fixture, formulario, ficha,
   tests); (b) **§2B** habilitaciones derivadas del historial (D3-B); (c) **§2C** eliminación de
   `restricciones` del dominio y de las tres pantallas de Conductores (D6-B, `SCHEMA_VERSION` del
   mock de conductores 2→3); (d) **§2D** eliminación del override de colisión —
   `validarAsignacionSemanal` pasa a ser incondicional y `AsignacionSemanalTabla` pierde el toggle.
   Al terminar, la app anda con la forma final del dominio y todavía contra `localStorage`.
8. Implementar `vehiculoMapping.ts` + `SupabaseVehiculoRepository.ts` por TDD estricto (nada de esto
   toca producción todavía: nadie los importa).
9. Cambiar `VehiculosRoute.tsx` — **corte real 1**.
10. Implementar `semanaIso.ts` + `conductorMapping.ts` + `SupabaseConductorRepository.ts` por TDD.
11. Cambiar `ConductoresRoute.tsx` — **corte real 2**. A partir de acá las dos pantallas usan datos
    reales y el estado transitorio de D2 se cierra.
12. Documentar las discrepancias (KB + `CHANGES.md` + `10_preguntas_abiertas.md`) y sumar los
    `AvisoModeloDatos`.
13. Verificación manual en navegador con las cuentas del paso 6, más el rastro en `auditoria.logs`.
14. Actualizar `ROADMAP-FRONTEND.md` §FE-8 y la fila 3 del §Plan de integración de `CHANGES.md`.

**Rollback**: revertir los commits de los pasos 9 y 11 (un import y una prop en cada `*Route.tsx`).
Las dos pantallas vuelven al mock al instante y los archivos nuevos quedan inertes. Las migraciones
**no hace falta revertirlas**: las columnas nuevas quedan con su `DEFAULT`, el seed del catálogo es
dato válido que Pacientes también necesita, y las funciones sin llamador son inertes. Si aun así se
quiere limpiar: `DROP FUNCTION` × 4 + `ALTER TABLE … DROP COLUMN` × 7 + `DROP CONSTRAINT` × 3
(`chk_categoria_subtipo`, `uq_accesorios_tipo`, `uq_conductor_semana`).
**Ningún dato existente se transforma ni se borra en ningún paso del plan.**

---

## Open Questions

> Las tres primeras preguntas de esta sección **se cerraron el 2026-07-31** en el checkpoint `0.1` y
> quedan acá como registro de qué se decidió y por qué, no como trabajo pendiente.

- **✅ CERRADA — ¿La colisión de asignación semanal se bloquea siempre, o el override es un caso
  real?** Pendiente #2 de C-09, abierto desde `conductores-ui`. **Resolución de la usuaria: se
  bloquea siempre, sin excepción y sin override.** Ninguna fuente (KB ni docx) confirmaba que la
  excepción fuera un caso real, y el override `permitirMultiple` del frontend estaba apagado por
  defecto desde `conductores-ui` (2026-07-24) sin que nadie lo usara nunca. Se resuelve con **un
  constraint de base de datos** —`uq_conductor_semana UNIQUE (conductor_id, fecha_init)`—, no con
  lógica de aplicación: no hay flag en los payloads, no hay validación de colisión en la RPC y no
  hay código `45205`. La función pura del frontend se conserva como feedback inmediato pero pasa a
  ser **incondicional**. Detalle completo en **D7 §Colisión**. Si en el futuro apareciera un caso
  real confirmado por la cliente, agregar la excepción es un change chico y acotado; sacarla
  después, no.
- **✅ CERRADA — ¿El catálogo de restricciones del conductor tiene más valores que
  `'no-carga-fisica'`?** Pendiente #1 de C-09. **La pregunta quedó sin objeto**: la usuaria resolvió
  D6 por la opción B, así que **no hay catálogo** — las restricciones de perfil se escriben en
  `observaciones` como texto libre, igual que el docx. Si en el futuro alguien quisiera volver a
  estructurarlas, es una decisión nueva de la usuaria y un change propio, no una reapertura de esta.
- **¿Cuáles son los campos obligatorios del alta de conductor?** Pendiente #3 de C-09. El frontend
  tomó apellido + nombre + documento; la base solo hace `NOT NULL` sobre `nombre`, `apellido` y
  `dni` — coincide. Pero `domicilio` y `cuil` son **requeridos en el tipo del frontend** y nullable
  en la base: hoy el mapeo los degrada a `''`. ¿Deberían ser `NOT NULL` en la base, u opcionales en
  el tipo? **No se resuelve acá.** **Decisor**: cliente.
- **¿Qué documentos van en el checklist del conductor?** Pendiente #4 de C-09. El frontend sembró
  licencia / DNI / apto médico *como ejemplo*. Bloqueado por D8 (el swap de documentos es otro
  change), pero conviene cerrarlo antes de ese change y no después.
- **¿`conductores.vehiculo.año` se usa?** La columna existe, el frontend no tiene el campo, y su
  nombre lleva **`ñ`** — un identificador no-ASCII en PostgREST obliga a citarlo y es una fuente de
  fricción evitable (el resto del esquema es ASCII). ¿Se suma el campo al frontend, se renombra a
  `anio`, o se deja muerta? **Decisor**: usuaria / backend.
- **✅ CERRADA — ¿La VTV/RTO se rastrea vía `mantenimiento` (docx) o con entidad propia?**
  **Resolución de la usuaria: vía `mantenimiento`** (D3, opción B). La arista que ninguna fuente
  resolvía —el docx dice *"se rastrea vía mantenimiento"* **sin decir cómo**— la fija ahora **D3**
  con una regla de derivación explícita: por tipo (`vtv` / `rto`), la fila `preventivo` de ese
  subtipo con `fecha_proximo_vencimiento` no nulo y `fecha` más reciente. RN-VE-04 sigue cumpliéndose
  porque cada tipo se deriva por separado y ninguno depende del otro.
- **¿Alguien más ya cargó filas en `pacientes.accesorios`?** Si backend sembró el catálogo con otros
  nombres, el seed de D5 crea duplicados semánticos. Se verifica antes de escribir la migración
  (tarea 1.4), pero si aparecen, **la reconciliación la decide la usuaria**, no el agente.
- **¿Se monta pgTAP (o `supabase start`)?** **Tercera vez consecutiva** que un change de esta serie
  verifica funciones de Postgres a mano. `integracion-pacientes` 1B.5 lo registró como decisión
  pendiente *"antes del segundo change de integración"*; `integracion-obra-social` lo repitió. Con 4
  funciones más y un CHECK de coherencia que ningún test automatizado ejercita, el costo acumulado de
  no automatizarlo son tres checklists SQL manuales y cinco changes por delante. **Decisor**: equipo
  técnico. No se monta acá.
- **¿Los índices de las FK que faltan?** `conductores_vehiculos.conductor_id` /
  `.vehiculo_id`, `mantenimiento.vehiculo_id`, `accesorios_vehiculo.vehiculo_id` y
  `gastos_vehiculos.vehiculo_id` no tienen índice. A la escala actual (decenas de vehículos) no
  importa; `integracion-pacientes` ya reportó lo mismo para sus tablas hijas. Sigue sin resolverse,
  fuera de scope acá — pero es el tercer change que lo anota.
