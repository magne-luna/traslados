## Context

**Estado actual del frontend — verificado, no asumido.**

`frontend/src/features/presupuestos/PresupuestoForm.tsx` es un formulario plano de **cinco campos**
(`pacienteId`, `obraSocialId`, `monto`, `fechaEmision`, `archivo?`), con estado controlado y sin
ninguna noción de prestación. La obra social se elige por `<Select>` pero **solo se guarda su id**: el
formulario nunca lee ninguna propiedad del objeto `ObraSocial` seleccionado. El comentario de la línea
119-121 dice literalmente: *"«Monto» único (docx): estimación funcionalmente anual/por prestación, sin
desglose estructurado — design.md Discrepancia 4"*.

`frontend/src/shared/types/presupuesto.ts:35` repite lo mismo sobre el campo: *"Importe único
propuesto (docx: `Monto`). NO es un desglose por prestación"*.

**El tipo de la modalidad ya existe y está en el lugar que el requerimiento asume**
(`frontend/src/shared/types/obraSocial.ts`):

```ts
// línea 13
export type ModalidadFacturacion = 'por-prestacion' | 'general';
// línea 79
modalidadFacturacion: ModalidadFacturacion;
```

Del lado de la base, la columna vive en `obra_social.obra_social.modalidad_facturacion`
(`20260731120000_obra_social_config_facturacion.sql`). **El requerimiento no necesita inventar
nada acá: el dato ya está modelado, cargado y mapeado. Lo único que falta es que el formulario lo
lea.**

**Estado actual de la escritura de presupuestos.**

`supabase/functions/presupuestos/index.ts` hace **CRUD directo contra la tabla** desde el Edge
Function:

```ts
// línea 92
await userClient.schema('facturacion').from('presupuesto').insert(toDb(body)).select('*').single();
```

`SupabasePresupuestoRepository.ts` nunca habla con PostgREST: **toda su I/O pasa por
`supabase.functions.invoke('presupuestos', …)`**, y su cabecera explica por qué —
`integracion-presupuestos` D3 decidió deliberadamente que el gateo de autorización viva del lado del
servidor (`requirePermiso('presupuestos', 'read'|'write')`) y que el repository **no lo duplique**
(hay un test de código fuente, `repositorySourceGuards.test.ts`, que verifica que este archivo no
consulte `modulos.permisos` ni `modulos.modulos`).

Además, `20260730140000_split_modulos_permisos.sql` movió las RLS policies de
`presupuesto`/`autorizacion` al módulo **`presupuestos`** (no `facturacion`), y el `MODULO` del Edge
Function fue actualizado en consecuencia (`index.ts:17`).

**El mapeo puro ya está aislado.** `frontend/src/shared/lib/presupuestos/presupuestoMapping.ts`
(nombre **verificado**, no asumido) tiene `parsePresupuestoApi`, `toCrearPresupuestoPayload`,
`toActualizarPresupuestoPayload` y `mapArchivoUrl`: funciones puras, sin `any`, sin `as`, con type
guards sobre `unknown`. Este change **extiende** ese archivo, no lo reescribe.

**Referencia de patrón para el catálogo.** `pacientes.direcciones`
(`20260724100004_schema_pacientes.sql:62-68`) + `DireccionesEditor.tsx` +
`Paciente.direcciones: Direccion[]` (`paciente.ts:105`) es **exactamente** la misma forma que
`pacientes.prestaciones` necesita: tabla hija con FK `ON DELETE CASCADE`, RLS del módulo `pacientes`,
trigger de auditoría, editor in-place embebido en `PacienteDetail.tsx`, y colección en el tipo de
dominio.

**Referencia de patrón para las RPC.** `obra_social.crear_obra_social_completa`
(`20260731120001_obra_social_rpc.sql`) y `pacientes.crear_paciente_completo`
(`20260730180000_crear_paciente_completo.sql`), ambas **aplicadas y verificadas**. La
`facturacion.crear_factura_completa` que el requerimiento menciona como molde **todavía no está
aplicada** — vive como decisión D4 del change **activo** `integracion-facturacion`, no en
`supabase/migrations/`. Se cita como molde de diseño, no como precedente ya en producción.

**Restricciones duras del proyecto** (`CLAUDE.md`): nada de `any` (usar `unknown` + narrowing); solo
utilidades Tailwind v4, nunca `style={{}}`; reusar `design-system/components.tsx`; `anon key`
únicamente; toda tabla nueva define su RLS en el mismo change que la crea; `npx tsc -b --noEmit` como
único type-check válido; Conventional Commits; el docx manda en estructura y la KB en reglas de
negocio, y toda discrepancia se documenta en `knowledge-base/04_modelo_de_datos.md` **y**
`CHANGES.md` **y** con `AvisoModeloDatos` en pantalla.

---

## ⚠️ Governance: ALTO — Aprobaciones requeridas antes de escribir SQL

Presupuestos es dominio **ALTO** (`CHANGES.md` §C-06) — **no CRÍTICO** como Facturación. Pero este
change toca **schema financiero ya en producción** (`facturacion.presupuesto` tiene backend + frontend
reales desde `integracion-presupuestos`, archivado el 2026-08-06). El gate es **más liviano que el de
`integracion-facturacion`, pero del mismo espíritu**: ninguna línea de `.sql` se escribe antes de la
aprobación.

Estas tres decisiones están replicadas como **checkboxes bloqueantes** en `tasks.md` §0:

| # | Decisión | Por qué necesita aprobación |
|---|---|---|
| **D1** | `pacientes.prestaciones` (tabla nueva) + `facturacion.presupuesto.prestacion_id` (columna nullable, aditiva) | Es la única modificación de schema, y cruza dos schemas: una FK desde un dominio financiero hacia el dominio clínico |
| **D2** | Migrar la escritura de Edge Function a RPC `SECURITY INVOKER` | Alcance extra **ya aceptado explícitamente por la usuaria**. Es código de servidor que escribe datos financieros, y **revierte parcialmente una decisión de diseño de `integracion-presupuestos` (D3)** |
| **D3** | Verificar el volumen real de `facturacion.presupuesto` en producción **antes** de aplicar | Solo lectura. Define si la migración es trivial o si necesita ventana / backfill |

**Coordinación con backend (Enzo) antes de escribir el `.sql`.** Mismo aprendizaje que
`integracion-facturacion` D3, y ya confirmado **tres changes consecutivos** de la serie de
integración: en este proyecto **el schema real va por delante de lo que el repo documenta**. Asumir
que `supabase/migrations/` es la verdad es el error histórico más repetido del proyecto.

**El agente escribe las migraciones; las aplica la usuaria / Enzo.** Governance, no límite técnico.

---

## Goals / Non-Goals

**Goals**

- Que un presupuesto pueda asociarse a **UNA** prestación puntual del paciente cuando la obra social
  factura `por-prestacion`.
- Que en modalidad `general` el usuario pueda **razonar por prestación** al cargar el monto, sin que
  eso cambie ni una coma del modelo persistido.
- Que el paciente tenga un **catálogo propio de prestaciones**, editable desde su ficha, con el mismo
  patrón que ya usa para direcciones.
- Que el alta de N presupuestos (uno por prestación) sea **atómica**: o entran todos, o no entra
  ninguno.
- Que la escritura de presupuestos deje de ser el único CRUD directo-contra-tabla del repo.

**Non-Goals**

- **NO se reabre la discrepancia #13.** `presupuesto.monto` sigue siendo un importe único. No cambia
  de tipo, de semántica ni de nullability. **Ver §D5.**
- **NO se persiste el desglose de la modalidad `general`.** Las líneas viven en el estado del
  formulario y mueren en el submit.
- **NO cambia la relación Autorización↔Presupuesto.** Sigue siendo 1:1, sin excepciones.
- **NO se toca el trigger `facturacion.validar_autorizacion_monto`.** Ver §D6.
- **NO se agrega borrado de presupuestos** (sigue siendo la pregunta abierta #12 de la KB).
- **NO se resuelve la subida real del archivo adjunto** (sigue abierta desde `integracion-presupuestos`).
- **NO se introduce un catálogo global de prestaciones** compartido entre pacientes. Ver §D7.
- **NO se toca Facturación.** `facturas.prestacion` (columna `TEXT` libre existente) **no** se
  conecta con `pacientes.prestaciones` en este change. Ver §D8.

---

## Decisions

### D1 — `pacientes.prestaciones` + `presupuesto.prestacion_id` ⚠️ REQUIERE APROBACIÓN

**Qué.** Dos migraciones aditivas, en este orden:

```sql
-- 2026XXXXXXXXXX_schema_pacientes_prestaciones.sql
CREATE TABLE pacientes.prestaciones (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes.paciente(id) ON DELETE CASCADE,
    nombre      TEXT NOT NULL,
    descripcion TEXT,
    activa      BOOLEAN NOT NULL DEFAULT true
);
-- + ALTER TABLE … ENABLE ROW LEVEL SECURITY
-- + POLICY "Read prestaciones"  … modulos.tiene_permiso('pacientes', 'read')
-- + POLICY "Write prestaciones" … modulos.tiene_permiso('pacientes', 'write')
-- + GRANT ALL ON pacientes.prestaciones TO authenticated
-- + TRIGGER trg_audit_prestaciones … auditoria.log_action()
-- + CREATE INDEX ON pacientes.prestaciones (paciente_id)

-- 2026XXXXXXXXXX_presupuesto_prestacion_id.sql
ALTER TABLE facturacion.presupuesto
  ADD COLUMN prestacion_id UUID REFERENCES pacientes.prestaciones(id);
-- + CREATE INDEX ON facturacion.presupuesto (prestacion_id)
```

**Por qué así.**

- La tabla es **calco literal** de `pacientes.direcciones` (misma forma de FK, mismo `ON DELETE
  CASCADE`, mismo módulo de RLS, mismo trigger), con **una columna extra**: `activa`. Cero patrón
  nuevo que revisar salvo ese campo.
- `prestacion_id` es **nullable**: en modalidad `general` queda `NULL` para siempre. Poner `NOT NULL`
  rompería todas las filas existentes y todas las futuras de modalidad general.
- **Borrado lógico, no físico** (decisión explícita del usuario, corrige la recomendación inicial de
  `RESTRICT` de este mismo documento): "quitar" una prestación desde `PrestacionesEditor` no hace
  `DELETE`, hace `UPDATE … SET activa = false`. El selector de prestaciones de `PresupuestoForm`
  filtra `WHERE activa = true`; los presupuestos ya emitidos **siguen mostrando** la prestación
  inactiva en `PresupuestoDetail` (una FK que apunta a una fila inactiva sigue siendo válida, nunca
  huérfana). Esto evita el problema que motivaba `RESTRICT` (bloquear el borrado con presupuestos
  asociados) por otra vía: no hay borrado físico que bloquear.
- **El `ON DELETE` de `prestacion_id` se deja igual en el default (`NO ACTION`/`RESTRICT`)** como
  defensa en profundidad — la UI nunca emite un `DELETE` real sobre `pacientes.prestaciones`, pero si
  alguien lo hiciera a mano por SQL directo, la base sigue sin permitir dejar presupuestos financieros
  con una FK rota.
- El índice sobre `prestacion_id` existe porque `PresupuestoDetail` filtra por esa columna.

**Alternativas descartadas.**

| Alternativa | Por qué no |
|---|---|
| Tabla intermedia `presupuesto_prestacion` (N:N) | El requerimiento es **UNA** prestación por presupuesto. Una N:N sería exactamente el desglose persistido que la #13 prohíbe, con otro nombre |
| `prestacion TEXT` libre en `presupuesto` (como `facturas.prestacion`) | Sin FK no hay integridad, no hay catálogo reutilizable, y se repite el error que `facturas.prestacion` ya tiene. El requerimiento pide catálogo, no texto |
| `prestacion_id NOT NULL` + fila sentinela "General" | Contamina el catálogo del paciente con una fila fantasma que la UI tendría que esconder en todas partes |
| Colgar el catálogo de `ObraSocial` en vez de `Paciente` | El requerimiento dice explícitamente *"catálogo nuevo en la ficha del paciente"*. Ver §D7 |
| Borrado físico con `ON DELETE RESTRICT` (recomendación original de este documento) | El usuario prefirió borrado lógico: una prestación con historial no debe bloquear al operador ni desaparecer de los presupuestos viejos — solo dejar de ofrecerse para presupuestos nuevos |

---

### D2 — Escritura vía RPC `SECURITY INVOKER`, no CRUD directo ⚠️ REQUIERE APROBACIÓN

**Qué.** Dos funciones Postgres nuevas, ambas **`SECURITY INVOKER`** (el default de PL/pgSQL, pero se
escribe explícito y se documenta con `COMMENT ON FUNCTION`):

| Función | Firma | Uso |
|---|---|---|
| `facturacion.crear_presupuesto_completo` | `(jsonb) RETURNS uuid` | Alta simple — modalidad `general` |
| `facturacion.crear_presupuestos_lote` | `(jsonb) RETURNS uuid[]` | Alta **atómica** de N presupuestos, uno por prestación — modalidad `por-prestacion` |

**Por qué.**

1. **Atomicidad real.** En modalidad `por-prestacion`, un submit crea N presupuestos. Hoy eso serían N
   `POST` sucesivos al Edge Function: si el tercero falla, quedan dos presupuestos financieros
   huérfanos y ninguna forma limpia de compensar. PostgREST **no da transacción entre requests**; una
   función SÍ.
2. **Consistencia con el repo.** `crear_paciente_completo` y `crear_obra_social_completa` ya fijaron
   este molde y están aplicadas. Presupuestos es el **único** módulo que todavía hace
   `.from(...).insert(...)` desde el Edge Function.
3. **`SECURITY INVOKER` es innegociable.** Convertirlas a `DEFINER` bypassearía las policies de RLS
   que `20260730140000_split_modulos_permisos.sql` puso sobre `presupuesto`/`autorizacion` en el
   módulo `presupuestos` — sobre **datos financieros**. Mitigado en cuatro capas: acá, en la cabecera
   del `.sql`, en el `COMMENT ON FUNCTION`, y en un test automatizado del texto del `.sql` (mismo
   patrón que `integracion-facturacion` D4).

**Tensión honesta con `integracion-presupuestos` D3.** Aquel change decidió que el gateo de
autorización viviera **del lado del servidor**, en `requirePermiso('presupuestos', …)` del Edge
Function, y dejó un test de código fuente (`repositorySourceGuards.test.ts`) que verifica que el
repository **no** duplique ese chequeo. Este change **no revierte esa decisión, la refuerza**: la
autorización pasa a estar **una capa más abajo todavía** (RLS de Postgres, con la sesión del usuario),
que es la única que no se puede saltear desde el cliente. El `requirePermiso` del Edge Function se
mantiene como defensa en profundidad.

**Punto abierto de esta decisión** — *"el Edge Function pasa a invocar la RPC, o se evalúa
reemplazarlo por invocación directa desde el repository"*:

| Opción | A favor | En contra |
|---|---|---|
| **A. El Edge Function invoca la RPC** (recomendada) | Cero cambios en `SupabasePresupuestoRepository.ts`, cero cambios en `presupuestoMapping.ts` más allá del campo nuevo, `repositorySourceGuards.test.ts` sigue verde, `requirePermiso` sobrevive como defensa en profundidad. **El diff más chico posible** | Un salto de red extra (cliente → Edge → RPC) |
| **B. El repository llama `supabase.rpc(...)` directo** | Un salto menos; alinea Presupuestos con Pacientes/Obras Sociales | Rompe el contrato de `repositorySourceGuards.test.ts`, obliga a reescribir el repository entero y el manejo de errores (`edgeFunctionErrors.ts` deja de aplicar), y **elimina** el `requirePermiso` de servidor sin reemplazo equivalente |

**Recomendación: opción A.** La B es un refactor de infraestructura disfrazado de requerimiento de
negocio, y triplica el diff de un change que ya toca schema financiero. **Decisión final del usuario
en el gate §0.**

---

### D3 — Verificar el volumen real de `facturacion.presupuesto` antes de aplicar ⚠️ REQUIERE APROBACIÓN

**Qué.** Antes de escribir el `.sql`, correr **solo lectura** contra el proyecto vinculado:

```bash
supabase db query --linked "
  SELECT count(*) AS presupuestos FROM facturacion.presupuesto;
  SELECT count(*) AS autorizaciones FROM facturacion.autorizacion;
"
# + verificar que 'prestacion_id' NO exista ya (el schema real va por delante del repo)
# + verificar que pacientes.prestaciones NO exista ya
```

**Por qué.** Tres motivos concretos, ninguno teórico:

1. **`integracion-facturacion` encontró 4 de 5 discrepancias ya absorbidas por backend**, y fue el
   *tercer* change consecutivo en encontrar el schema real por delante del repo. Es perfectamente
   posible que alguna de estas dos estructuras **ya exista**. Escribir la migración sin verificar es
   cómo se producen colisiones de historial.
2. **`facturacion.presupuesto` tiene datos reales.** A diferencia de `facturacion.facturas` (0 filas
   cuando `integracion-facturacion` verificó), Presupuestos está integrado y en uso desde el
   2026-08-06. `ADD COLUMN … NULL` sin default es `O(1)` en Postgres 11+ — pero el `CREATE INDEX`
   sobre una tabla con volumen **no** lo es, y define si hace falta `CONCURRENTLY`.
3. **Define el mensaje de la migración.** Si hay N presupuestos existentes, todos quedan con
   `prestacion_id IS NULL`, que es semánticamente correcto (fueron emitidos bajo el modelo anterior) —
   pero hay que **decirlo** en la cabecera del `.sql` y en la KB, no dejarlo implícito.

**Regla dura del proyecto: el agente lee, el agente NO aplica DDL.** El CLI del sandbox tiene sesión
válida contra el proyecto real; se usa **solo para `SELECT`**.

---

### D4 — El contrato del repository gana una operación de lote, no cambia la existente ✅ DECIDIDO

`PresupuestoRepository.create(nuevo)` devuelve **un** `Presupuesto`. La modalidad `por-prestacion`
necesita crear N. Opciones:

- ❌ Cambiar la firma de `create` para devolver `Presupuesto[]` → rompe todos los llamadores y todos
  los tests, para un caso que no es el mayoritario.
- ❌ Llamar `create` N veces desde el route → exactamente la falta de atomicidad que D2 resuelve.
- ✅ **Agregar `createLote(nuevos: NuevoPresupuesto[]): Promise<Presupuesto[]>`** a la interfaz,
  implementada por `SupabasePresupuestoRepository` y por el mock. `create` **no se toca**.

`Presupuesto` gana `prestacionId?: string` (opcional, `undefined` en modalidad general) y
`presupuestoMapping.ts` gana el campo en `parsePresupuestoApi`, `toCrearPresupuestoPayload` y
`toActualizarPresupuestoPayload` — **respetando la semántica parcial de D6b de
`integracion-presupuestos`**: clave ausente significa "no tocar", nunca se rellena con `undefined`
explícito. Ese agujero exacto ya borró checklists enteros una vez (`integracion-obra-social` D6).

---

### D5 — `monto` no cambia de forma; la #13 se referencia, no se edita ✅ DECIDIDO

`knowledge-base/04_modelo_de_datos.md` §Discrepancias **#13** dice: *"`Presupuesto` = monto único vs.
la lectura anterior de la KB («estimación anual por prestación») — **NO SE REABRE**"*.

Este change **la respeta y la cita**, y abre una **entrada nueva** en su lugar, con este texto de
referencia:

> **`presupuesto.prestacion_id` (columna nueva) — decidido, NO es reapertura de #13.** El docx no
> vincula `Presupuesto` con ninguna prestación. Se agrega una FK **opcional** a
> `pacientes.prestaciones` para soportar obras sociales con `modalidad_facturacion =
> 'por-prestacion'`, donde cada prestación genera su propio presupuesto (con su propio `monto` único
> y su propia autorización 1:1). **`monto` sigue siendo un importe único y nunca un desglose
> persistido**, exactamente como fijó #13. En modalidad `general` la columna queda `NULL` y el
> desglose por prestación **solo existe en el formulario**, no en la base.

**La #13 no se edita.** Se referencia desde la entrada nueva y nada más. Cartel `AvisoModeloDatos`
correspondiente en `PresupuestoForm.tsx` y `PresupuestoDetail.tsx`.

---

### D6 — El trigger `validar_autorizacion_monto` (RN-PA-01) NO se toca ✅ DECIDIDO

**Explícito y verificado.** `supabase/migrations/20260729130000_schema_autorizacion_monto_vigencia.sql`
define:

```sql
CREATE OR REPLACE FUNCTION facturacion.validar_autorizacion_monto() ...
  SELECT monto INTO monto_presupuesto FROM facturacion.presupuesto WHERE id = NEW.presupuesto_id;
  IF monto_presupuesto IS NOT NULL AND NEW.monto_autorizado > monto_presupuesto THEN
    RAISE EXCEPTION 'RN-PA-01: monto_autorizado (%) no puede superar el presupuesto (%)', ...
```

**El trigger lee exactamente una cosa: `presupuesto.monto`, de una fila, por `presupuesto_id`.**

Este change **no altera** el tipo de `monto`, ni su nullability, ni su semántica, ni la cardinalidad
de `presupuesto_id` en `autorizacion` (sigue 1:1). Por lo tanto:

- **En modalidad `por-prestacion`**: cada presupuesto del lote tiene su propio `monto` y su propia
  autorización. El trigger valida cada par por separado, con la misma aritmética de siempre. RN-PA-01
  queda **más** fina que antes, no más laxa: se valida por prestación en vez de contra un agregado.
- **En modalidad `general`**: el presupuesto tiene un `monto` que es la suma de las líneas, calculada
  en frontend. Para el trigger es un número más. Nada cambia.

**Nota deliberada:** el trigger es `SECURITY DEFINER`, y eso **se mantiene tal cual**. Es una
excepción preexistente y justificada (necesita leer `presupuesto` desde el contexto de un `INSERT` en
`autorizacion`, posiblemente con permisos distintos), tiene `SET search_path = ''`, y **no está en el
alcance de este change**. La prohibición de `SECURITY DEFINER` de D2 aplica a las **funciones nuevas
de escritura**, no a este trigger existente de validación.

**No se agrega ninguna validación cruzada nueva en SQL.** La regla "la suma de las líneas es el
`monto`" es una regla de **formulario**, no de base — persistirla como `CHECK` sería imposible (las
líneas no se persisten) y duplicarla en Postgres crearía dos fuentes de verdad, que es exactamente lo
que `integracion-facturacion` D-Goals prohíbe.

---

### D7 — El catálogo cuelga del Paciente, no es global ✅ DECIDIDO

**Qué.** `pacientes.prestaciones` tiene `paciente_id NOT NULL`. Dos pacientes con la misma prestación
tienen **dos filas distintas**.

**Por qué.** Es lo que el requerimiento pide (*"catálogo nuevo en la ficha del paciente"*), y es el
mismo modelo que `pacientes.direcciones` y `pacientes.personas_a_cargo`. Un catálogo global
(`prestaciones` + `prestaciones_paciente` N:N, como `accesorios`/`accesorios_pacientes`) sería más
normalizado, pero:

- Nadie pidió reportes agregados por prestación entre pacientes.
- Obliga a una pantalla de administración del catálogo global que no existe ni está planificada.
- Duplica el trabajo del editor (elegir del catálogo **y** administrar el catálogo).

**Si mañana hacen falta reportes cross-paciente**, migrar de "cuelga del paciente" a "catálogo global"
es una migración aditiva más (tabla nueva + backfill por `nombre`). El camino inverso es más caro.
**YAGNI, con el camino de salida escrito.**

---

### D8 — `facturas.prestacion` queda intacta y desconectada ✅ DECIDIDO

`facturacion.facturas` ya tiene una columna `prestacion TEXT` (libre, sin FK) — documentada en
`integracion-facturacion` §Context como parte del schema real. **Este change no la conecta con
`pacientes.prestaciones`.**

Motivo: Facturación es dominio **CRÍTICO** y `integracion-facturacion` es un change **activo y no
aplicado**. Tocar `facturas` desde acá arrastraría un change CRÍTICO adentro de uno ALTO — el mismo
error que `integracion-presupuestos` §Discrepancias #11 ya identificó y evitó.

Se documenta como **pregunta abierta** en `10_preguntas_abiertas.md`: *"¿`facturas.prestacion` debería
apuntar a `pacientes.prestaciones` en vez de ser texto libre?"*, con decisor nombrado.

---

### D9 — UI: la bifurcación es de render, no de dos formularios ✅ DECIDIDO

`PresupuestoForm.tsx` **no se duplica**. Se resuelve la obra social seleccionada
(`obrasSociales.find(os => os.id === values.obraSocialId)`) y se bifurca **el bloque del monto**:

| Modalidad | Bloque renderizado | Estado local | Submit |
|---|---|---|---|
| Ninguna OS elegida | Campo `monto` simple actual + hint "elegí la obra social" | `monto: number` | `create` |
| `general` | `<PresupuestoLineasEditor>` — líneas `{ prestacionId, monto }` + total en vivo, read-only | `lineas: Linea[]` | `create` con `monto = suma(lineas)` |
| `por-prestacion` | Multi-select de prestaciones del paciente + un `<Input type=number>` por prestación elegida | `seleccion: Map<prestacionId, monto>` | `createLote` — N payloads |

**Detalles no obvios, decididos:**

- **Cambiar de paciente o de obra social después de cargar líneas resetea el bloque de montos.** Las
  prestaciones son del paciente; cambiar de paciente invalida la selección entera. Se resetea con
  aviso, no en silencio.
- **Paciente sin prestaciones cargadas + OS `por-prestacion`** → empty state con enlace a la ficha del
  paciente, **no** un select vacío. El submit queda bloqueado con mensaje explícito.
- **Modalidad `general` sin líneas** → el formulario cae al campo `monto` simple. La bifurcación
  **agrega** una forma de cargar el monto, no obliga a usarla.
- **`PresupuestoLineasEditor` no toca la red.** Es un componente controlado puro, mismo espíritu que
  `AsistenciasEditor.tsx`. Testeable sin mocks de repository.
- **La edición (`PATCH`) no bifurca.** Editar un presupuesto existente edita su `monto` y su
  `prestacionId`, uno a uno. El lote es solo alta.

---

### D10 — Tests ✅ DECIDIDO

| Capa | Qué se testea | Cómo |
|---|---|---|
| `presupuestoMapping.ts` | `prestacionId` en las 3 direcciones, incluida la semántica parcial de `toActualizar…` (clave ausente ≠ `undefined`) | Unitario puro, sin red |
| `PresupuestoLineasEditor.tsx` | Total en vivo, agregar/quitar línea, línea sin monto, total con decimales | RTL, componente controlado |
| `PrestacionesEditor.tsx` | Alta/edición/baja in-place, confirmación de borrado con presupuestos asociados | RTL, calcado de `DireccionesEditor.test.tsx` |
| `PresupuestoForm.tsx` | **Las tres ramas** de la bifurcación + reset al cambiar paciente/OS + empty state | RTL con `obrasSociales` de las dos modalidades |
| `validatePresupuestoForm.ts` | Monto total > 0 en `general`; al menos una prestación con monto > 0 en `por-prestacion` | Unitario |
| Migraciones | Que el texto del `.sql` **no** contenga `SECURITY DEFINER` en las dos funciones nuevas | Test de código fuente, patrón de `integracion-facturacion` D4 |

---

## Risks / Trade-offs

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| 1 | **El schema real ya tiene alguna de estas estructuras** (pasó 3 veces seguidas en esta serie) | **Alta** | Colisión de historial de migraciones | **D3** — verificación de solo lectura obligatoria antes de escribir el `.sql`, y coordinación con Enzo |
| 2 | **`crear_presupuestos_lote` es código de servidor que escribe datos financieros**, sin harness automatizado (pgTAP sigue sin montarse) | Media | Alta | `SECURITY INVOKER` + test del texto del `.sql` + verificación manual con cuentas reales como tarea separada en `tasks.md` |
| 3 | **Alguien convierte una RPC a `SECURITY DEFINER`** en un fix futuro | Baja | **Crítico** — bypassea RLS sobre datos financieros | Cuatro capas: este design, cabecera del `.sql`, `COMMENT ON FUNCTION`, y test automatizado |
| 4 | **La suma de líneas en `general` no cuadra con lo que el usuario esperaba** (redondeo, decimales) | Media | Media | Total calculado en vivo y visible **antes** del submit; `NUMERIC(10,2)` en base; test de decimales |
| 5 | **Se percibe como reapertura de la #13** por alguien que lea el diff sin el contexto | Media | Medio (confusión, no daño) | **D5** — texto explícito en la KB, en `CHANGES.md` §C-06 y en `AvisoModeloDatos` |
| 6 | **"Borrar" una prestación con presupuestos emitidos** | Media | Bajo — mitigado por diseño | **D1** — borrado lógico (`activa = false`): no hay `DELETE` real, los presupuestos existentes conservan su FK válida y el catálogo simplemente deja de ofrecer esa prestación en presupuestos nuevos |
| 7 | **N presupuestos = N autorizaciones** en `por-prestacion`: carga operativa multiplicada para la usuaria | Media | Medio | Es consecuencia directa del requerimiento (1:1 sin cambios). Se documenta, no se disimula. **Ver Open Questions** |
| 8 | **Diff grande**: 3 migraciones + 2 componentes nuevos + bifurcación de formulario | **Alta** | Reviewer burnout (guard de 400 líneas) | `tasks.md` debe forecastear y proponer **PRs encadenados**: (1) catálogo de prestaciones, (2) columna + RPC, (3) bifurcación de UI |

---

## Migration Plan

**Orden obligatorio.** Las migraciones son aditivas, pero **no conmutativas**: `presupuesto.prestacion_id`
referencia `pacientes.prestaciones`.

1. **Gate §0** — aprobación explícita de D1, D2 y D3. Nada se escribe antes.
2. **D3 en vivo** — `supabase db query --linked`, solo lectura: volumen de `presupuesto`, y
   confirmación de que ni `pacientes.prestaciones` ni `presupuesto.prestacion_id` existen ya.
3. `2026XXXXXXXXXX_schema_pacientes_prestaciones.sql` — tabla + RLS + GRANT + auditoría + índice.
4. `2026XXXXXXXXXX_presupuesto_prestacion_id.sql` — columna + índice. **Requiere (3).**
5. `2026XXXXXXXXXX_presupuesto_rpc.sql` — las dos funciones `SECURITY INVOKER`. **Requiere (4).**
6. **La usuaria / Enzo aplican** los tres `.sql`. El agente **no**.
7. Frontend, en este orden: tipos → `presupuestoMapping` → repository (`createLote`) →
   `PrestacionesEditor` + `PacienteDetail` → `PresupuestoLineasEditor` → bifurcación de
   `PresupuestoForm` → `PresupuestoDetail`.
8. Edge Function `presupuestos/index.ts` pasa a invocar las RPC (opción A de D2).
9. Documentación: KB §Discrepancias (entrada nueva), `CHANGES.md` §C-06 (nota de reapertura
   post-archivo), `10_preguntas_abiertas.md` (D8).

**Entre (6) y (7) la app sigue funcionando sin cambios**: columna nullable que nadie lee, tabla que
nadie consulta, funciones sin llamador. **Las migraciones son inertes hasta que el frontend las usa.**

---

## Rollback

**Frontend** — revertir los commits de la §7-8. `PresupuestoForm` vuelve al campo `monto` simple, la
sección de prestaciones desaparece de `PacienteDetail`. Cero pérdida de datos: los presupuestos
existentes siguen teniendo su `monto`.

**Base de datos** — las tres migraciones son **estrictamente aditivas**. Ninguna columna existente se
altera, se renombra ni se borra. Ningún dato existente se transforma.

- `DROP FUNCTION facturacion.crear_presupuestos_lote, facturacion.crear_presupuesto_completo` — sin
  llamador, son inertes.
- `ALTER TABLE facturacion.presupuesto DROP COLUMN prestacion_id` — **destructivo solo para el vínculo
  nuevo**; los presupuestos y sus montos quedan intactos. Si ya hubo altas en modalidad
  `por-prestacion`, se pierde **a qué prestación** correspondía cada uno, pero **no** el presupuesto ni
  su autorización.
- `DROP TABLE pacientes.prestaciones` — **requiere hacer el `DROP COLUMN` primero** (la FK lo impide,
  que es exactamente la protección de D1 funcionando).

**Punto de no retorno.** Una vez que existan presupuestos reales con `prestacion_id` poblado, el
rollback de base **pierde información de negocio**. El rollback barato es solo de frontend. Esto es
otro motivo para el gate §0 y para los PRs encadenados del riesgo #8.

---

## Open Questions

1. **¿Opción A o B en D2?** (Edge Function invoca la RPC vs. repository llama `supabase.rpc` directo).
   Recomendación fundada: **A**. **Decide: la usuaria, en el gate §0.**
2. **¿N presupuestos = N autorizaciones es operativamente aceptable?** (riesgo #7). Si una obra social
   `por-prestacion` tiene 6 prestaciones por paciente, la usuaria carga 6 autorizaciones. Es la
   consecuencia correcta del modelo 1:1 que se decidió **no** tocar, pero conviene confirmarla con la
   usuaria **antes** de construirla, no después. **Decide: la usuaria.**
3. **¿`facturas.prestacion` debería apuntar al catálogo?** (D8). Fuera de alcance acá; se registra en
   `10_preguntas_abiertas.md`. **Decide: la usuaria + backend, en el change de Facturación.**
4. **¿El catálogo de prestaciones necesita un campo de monto/valor de referencia?** El requerimiento
   solo pide `nombre` + `descripcion`; el monto se carga por presupuesto. Si en la práctica cada
   prestación tiene un valor estable, un `monto_referencia` opcional ahorraría retipeo. **No se
   incluye** — YAGNI, y es aditivo después. **Decide: la usuaria.**
5. **pgTAP / Supabase local** — sigue abierta desde `integracion-pacientes`. Este change suma **2
   funciones más** sin harness automatizado. El contador acumulado sube; la pregunta sigue sin
   decisor asignado.
