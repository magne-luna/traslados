## Context

**Estado actual del frontend.** `frontend/src/features/facturacion/FacturacionRoute.tsx` inyecta
`mockFacturaRepository` y `mockCobroRepository` (localStorage, `SCHEMA_VERSION = 1`, latencia
simulada, fixtures `buildFacturasFixture()` / `buildCobrosFixture()`) en sus dos providers, más cinco
repositories mock de solo lectura (Paciente, ObraSocial, Presupuesto, Autorizacion, Documento) y el
fixture de feriados. Toda la feature (26 componentes + 3 hooks + 2 contexts + 2 validadores) consume
las interfaces `FacturaRepository` / `CobroRepository` vía context — ningún componente conoce
Supabase. `useFacturas` / `useCobros` manejan `loading`/`error` capturando lo que el repository lance
y leyendo `err.message`, igual que `usePacientes` y `useObrasSociales`.

Las **9 funciones puras de reglas de negocio** (`renderDescripcionFactura`,
`construirDatosDescripcion`, `diasFacturables`, `cupoConsumido`, `validarCupoFacturacion`,
`calcularFechaEstimadaCobro`, `estadoVencimientoFactura`, `estadoDerivadoFactura`, `totalesFactura`,
`resolverIdentificadorFactura`) viven en `shared/lib/facturacion/` con sus tests y **no se tocan**:
son el contrato de negocio que el backend real tiene que sostener, no reimplementar.

**Estado real del backend — verificado en vivo, no asumido.** Se consultó el proyecto vinculado
(`pkryfoljypuzfifofdwp`) con `supabase db query --linked` el 2026-07-31 (solo lectura; nunca se corrió
DDL desde el agente, por governance). El schema `facturacion` **existe, está expuesto en el Data API**
(control: `GET /rest/v1/facturas` con `Accept-Profile: facturacion` y `anon key` → `401 42501
"permission denied for schema facturacion"`, **no** `PGRST106`/`PGRST205`; control negativo con
`Accept-Profile: obra_social` → `404 PGRST205`) y tiene **muchísimo más de lo que
`supabase/migrations/20260724100005_schema_facturacion.sql` commitea**:

```sql
facturacion.facturas (
  id, paciente_id FK→pacientes.paciente, descripcion, dias, valor_km, monto,
  estado facturacion.estado_factura DEFAULT 'a facturar', fecha_init, fecha_tope,
  tipo facturacion.tipo_factura,
  -- ↓ TODO ESTO NO ESTÁ EN LA MIGRACIÓN COMMITEADA, pero SÍ en la base real:
  cantidad_km NUMERIC, fecha_estimada_cobro DATE, prestacion TEXT,
  mes_facturado INT CHECK (1..12), anio_facturado INT, dependencia_y_retorno TEXT,
  domicilio_id UUID FK→pacientes.direcciones,
  identificador_origen obra_social.identificador_origen_factura, identificador_valor TEXT )

facturacion.asistencia_prestacion (  -- TABLA NUEVA, no está en la migración commiteada
  id, factura_id FK→facturas ON DELETE CASCADE, fecha DATE NOT NULL,
  prestacion TEXT NOT NULL, dependencia TEXT, retorno TEXT,
  factura_sabados BOOLEAN NOT NULL DEFAULT false )

facturacion.documento_factura (      -- TABLA NUEVA, no está en la migración commiteada
  id, factura_id FK→facturas ON DELETE CASCADE,
  id_tipo_documento FK→obra_social.tipos_documento ON DELETE RESTRICT,
  archivo_url TEXT NOT NULL, created_at timestamptz DEFAULT now() )

facturacion.cobros ( id, facturas_id FK→facturas ON DELETE CASCADE,
                     fecha DATE NOT NULL, monto_pagado NUMERIC NOT NULL )
```

Las siete tablas del schema tienen **RLS habilitada**, `GRANT ALL … TO authenticated` (incluidas las
dos creadas fuera de historial — verificado con `information_schema.role_table_grants`) y trigger
`auditoria.log_action()` en INSERT/UPDATE/DELETE. **Las seis tablas tienen 0 filas.**

Enums reales (`pg_enum`):

```
facturacion.estado_factura   = 'a facturar' | 'pendiente' | 'facturado' | 'cobrado' | 'pagado parcialmente'
facturacion.tipo_factura     = 'A' | 'B' | 'C'
obra_social.identificador_origen_factura = 'paciente.dni' | 'paciente.numeroAfiliado'
```

**Referencia de patrón.** `integracion-pacientes` (change 1) e `integracion-obra-social` (change 2)
fijaron el molde que este change copia: mapeo puro separado del I/O, embeds de PostgREST en una sola
consulta, escritura multi-tabla atómica vía RPC **`SECURITY INVOKER`** (nunca `DEFINER`, nunca
insert-padre + borrado compensatorio), traducción de errores a castellano, fake tipado del cliente en
los tests, verificación de RLS con cuentas reales como tarea manual separada, y discrepancias
documentadas por triplicado (KB + `CHANGES.md` + `AvisoModeloDatos`) en vez de resueltas a dedo.

**Restricciones duras del proyecto** (`CLAUDE.md`): nada de `any` (usar `unknown` + narrowing); solo
utilidades Tailwind v4, nunca `style={{}}`; reusar `design-system/components.tsx`; `anon key`
únicamente; toda tabla nueva define su RLS en el mismo change; `npx tsc -b --noEmit` como único
type-check válido; Conventional Commits; el docx manda en estructura y la KB en reglas de negocio, y
toda discrepancia se documenta en los dos lugares **y** con `AvisoModeloDatos`, nunca se resuelve
adivinando.

---

## ⚠️ Governance: CRÍTICO — Aprobaciones requeridas antes del apply

Facturación es dominio **CRÍTICO** (`CHANGES.md` §C-07), el equivalente a *Billing* en la tabla de
gobernanza global: **análisis solamente; ningún código de aplicación se escribe sin aprobación humana
explícita**. Este `design.md` es análisis. **No autoriza el apply.**

Las siguientes decisiones requieren **aprobación explícita de la usuaria antes de escribir una sola
línea de código o de SQL**. Están replicadas como tareas bloqueantes en `tasks.md` §0:

| # | Decisión | Por qué necesita aprobación |
|---|---|---|
| **D3** | Agregar la columna `facturacion.facturas.fecha_factura` | Es la única modificación de schema sobre un dominio financiero. Toca una tabla de backend fuera del historial de migraciones del repo — necesita coordinación con Enzo, no solo con la usuaria |
| **D4** | Dos funciones RPC nuevas de escritura sobre datos financieros | Código de servidor que escribe facturas. Cuarto y quinto RPC de la serie sin ningún harness automatizado que los verifique |
| **D6** | Incluir el swap de `CobroRepository` en este mismo change | Amplía el alcance de un change CRÍTICO. Se argumenta que es obligatorio, no opcional — pero la decisión es de la usuaria |
| **D9** | Dejar la validación de cupo sobre fuente mixta (facturas reales × autorizaciones de fixture) | Una alerta de cupo (RN-FA-02) que se calcula contra datos falsos puede autorizar de más una factura real. Es el riesgo funcional más alto del change |
| **D10** | `CREATE INDEX` sin `CONCURRENTLY` | Se aparta de una regla dura de `database-schema-design`. La justificación (0 filas) es sólida hoy, pero caduca |

Además, **el agente no aplica migraciones**. Las corre la usuaria / Enzo. Esto es governance, no un
límite técnico: el CLI del sandbox tiene sesión válida contra el proyecto real y se usó **solo para
lectura** durante este propose.

---

## Goals / Non-Goals

**Goals**

- Que la pantalla de Facturación lea y escriba facturas y cobros reales de Postgres vía RLS, con la
  sesión del usuario.
- Cumplir `FacturaRepository` y `CobroRepository` **byte por byte**: mismas firmas, misma semántica
  de `null`, misma forma de error. Los 26 componentes, los 3 hooks y los 2 contexts no se tocan.
- **Cerrar el inventario de discrepancias de `CHANGES.md` §C-07 contra la realidad**, no contra lo
  que el repo asume: 4 de las 5 ya no existen, y hay 3 nuevas que nadie había registrado.
- Que las 9 funciones puras de reglas de negocio sigan siendo la **única** implementación de esas
  reglas. Cero duplicación en SQL.
- **Heredar** los 4 defaults de negocio de `facturacion-ui` sin re-decidirlos ni cerrarlos.
- Aislar todo el mapeo en funciones **puras**, testeables sin red; los repositories quedan como
  cáscaras delgadas de I/O.
- Reusar el patrón ya validado por los 3 changes anteriores de la serie.

**Non-Goals**

- **No se construye la pantalla de Facturación** — ya existe (`facturacion-ui`, archivado).
- **No se integra ARCA** (default heredado: carga manual). Cero cliente HTTP, cero variables de
  entorno, cero endpoints.
- **No se swapea `documento_factura`** (D8) ni `presupuesto`/`autorizacion` (D9).
- No se resuelve ninguna de las 4 preguntas abiertas de prioridad Alta.
- No se mueve ninguna regla de negocio a Postgres.
- No se agrega `NOT NULL` a columnas existentes (D11).
- No se migran los datos del `localStorage` de los mocks a Postgres — son fixtures de desarrollo.
- No se monta pgTAP ni Supabase local (sigue abierto; este change lo encarece más).
- No se introduce TanStack Query.

---

## Decisions

### D1 — Mapeo puro separado del I/O: `facturaMapping.ts` + dos repositories delgados

Toda la traducción fila↔dominio vive en `facturaMapping.ts` como funciones puras exportadas:
`parseFacturaRow`, `parseAsistenciaRow`, `parseCobroRow`, `ensamblarFactura(row)`,
`toCrearFacturaPayload(nueva)`, `toActualizarFacturaPayload(cambios)`, `toCrearCobroPayload(nuevo)`,
más el par de conversores de estado de D2. Los repositories solo hacen `await`, chequean `error` y
llaman a esas funciones.

*Por qué:* Strict TDD funciona mejor sobre funciones puras (RED sin montar fakes de red), y el mapeo
acá no es trivial: **19 columnas** en la tabla padre con 8 renombres respecto del tipo del frontend,
una colección embebida, un enum con un literal extra (D2), dos campos que se colapsan en un objeto
(`identificador_origen` + `identificador_valor` → `IdentificadorFactura`), y **13 columnas nullables
en la base que el tipo del frontend declara requeridas** (D11).

*Alternativa descartada:* mapear inline en cada método. Con 19 columnas y estas asimetrías, el
repository se volvería ilegible y el mapeo no sería testeable sin red.

**Renombres, para que estén escritos una sola vez:**

| Columna real | Campo del tipo | Nota |
|---|---|---|
| `fecha_init` | `fechaInicial` | renombre puro |
| `fecha_tope` | `fechaTope` | renombre puro |
| `tipo` | `tipoComprobante` | renombre puro |
| `valor_km` / `cantidad_km` | `valorKm` / `cantidadKm` | snake→camel |
| `mes_facturado` / `anio_facturado` | `mesFacturado` / `anioFacturado` | snake→camel |
| `dependencia_y_retorno` | `dependenciaYRetorno` | snake→camel |
| `fecha_estimada_cobro` | `fechaEstimadaCobro` | opcional en ambos lados |
| `identificador_origen` + `identificador_valor` | `identificadorFactura?: { origen, valor }` | **dos columnas → un objeto**; si cualquiera de las dos es `NULL`, el campo queda ausente |
| `asistencia_prestacion[]` | `asistencias` | colección embebida, `factura_sabados` → `facturaSabados` |
| `cobros.facturas_id` | `Cobro.facturaId` | ojo: la columna es **plural** (`facturas_id`) |
| `fecha_factura` (**a crear**, D3) | `fechaFactura` | opcional en ambos lados |

### D2 — El enum de estado se mapea explícitamente; **la base no se toca**

**El problema.** El enum real es `'a facturar' | 'pendiente' | 'facturado' | 'cobrado' | 'pagado
parcialmente'` (separado por espacios, 5 literales). El tipo del frontend es
`'a-facturar' | 'facturado' | 'cobrado' | 'pagado-parcialmente'` (con guiones, 4 literales). No
coinciden ni en formato ni en cardinalidad.

**La decisión.** Un par de funciones puras y totales en `facturaMapping.ts`:

```
estadoDesdeBase('a facturar')          → 'a-facturar'
estadoDesdeBase('pendiente')           → 'a-facturar'      ← el `pendiente` del docx es sinónimo
estadoDesdeBase('facturado')           → 'facturado'
estadoDesdeBase('cobrado')             → 'cobrado'
estadoDesdeBase('pagado parcialmente') → 'pagado-parcialmente'
estadoDesdeBase(cualquier otra cosa)   → 'a-facturar'      ← total, nunca lanza

estadoHaciaBase('a-facturar')          → 'a facturar'      ← nunca escribe 'pendiente'
estadoHaciaBase('facturado')           → 'facturado'
estadoHaciaBase('cobrado')             → 'cobrado'
estadoHaciaBase('pagado-parcialmente') → 'pagado parcialmente'
```

**Por qué `pendiente` se lee como `a-facturar` y nunca se escribe.** Es exactamente lo que ya decidió
`facturacion-ui` (`shared/types/factura.ts`, comentario de `EstadoFactura`: *"el `pendiente` del docx
se trata como sinónimo de `a-facturar`"*), y la cabecera de `20260724100005_schema_facturacion.sql`
documenta que los dos vienen del docx. La lectura tiene que tolerarlo porque una fila puede haber
sido cargada por backend o por SQL directo. La escritura no lo produce nunca, porque el frontend no
tiene forma de expresarlo y el circuito de estados (`factura-estados-circuito`) no lo contempla.

**Por qué NO se toca el enum de la base.** Tres razones: (1) `'a facturar'`, `'cobrada'`,
`'pagada parcialmente'` y `'pendiente'` son **literalmente los valores del docx**, que manda en
estructura — cambiarlos a guiones sería resolver una discrepancia adivinando; (2) `ALTER TYPE …
RENAME VALUE` es irreversible dentro de una transacción y afecta un dominio CRÍTICO; (3) el mapeo
client-side es puro, testeable y reversible. La asimetría queda documentada, no borrada.

*Alternativa descartada:* agregar `'pendiente'` a `EstadoFactura` en el frontend. Rompería el
circuito de estados, `estadoDerivadoFactura`, los badges de la lista y 4 specs archivadas — para
modelar un estado que la UI no puede producir ni necesita distinguir.

### D3 — `facturas.fecha_factura`: la única columna que falta de verdad ⚠️ REQUIERE APROBACIÓN

**El hecho.** `Factura.fechaFactura?: string` existe en el tipo desde `facturacion-ui` y es la fecha
de **emisión** (transición `a-facturar → facturado`), distinta de `fechaInicial`/`fechaTope` (que son
el período facturado). **No tiene columna en la base.** Verificado columna por columna contra
`information_schema.columns`.

**Qué se rompe sin ella.** `estadoVencimientoFactura` (RF-406, alerta de factura vencida sin cobro a
los `PLAZO_ALERTA_VENCIDA_DIAS = 60` días) toma la fecha de emisión como punto de partida. Sin
persistirla, toda factura releída del servidor pierde su fecha de emisión y la alerta queda muda.
Además `CHANGES.md` §C-11 ya declaró esto **bloqueante** para la tarjeta de facturas en mora
(discrepancia 2/4: *"la factura del docx no tiene fecha de emisión … Sin ellas RF-801 no se puede
cumplir"*). La otra mitad de esa discrepancia —el estado `facturado`— **ya está resuelta**: el enum
real lo tiene.

**La decisión.** `ALTER TABLE facturacion.facturas ADD COLUMN fecha_factura DATE;`

- **Nullable, sin default.** Una factura en `a-facturar` **no tiene** fecha de emisión, y ese es su
  significado, no un dato faltante. Un `DEFAULT now()` mentiría sobre facturas no emitidas.
- **Sin `NOT NULL`** aunque el estado sea `facturado`: expresar eso pediría un `CHECK` correlacionado
  entre dos columnas, que rompería cualquier corrección manual de estado hecha desde SQL (el panel de
  cobros ya permite corrección manual de estado — `factura-estados-circuito`).
- Aditiva sobre una tabla de **0 filas**: sin backfill, sin ventana de esquema roto, sin bloqueo.
- **Rollback**: `ALTER TABLE … DROP COLUMN fecha_factura;` — no hay dato que perder.

**Por qué necesita aprobación pese a ser trivial.** Es una modificación de schema sobre un dominio
financiero, en una tabla que backend viene modificando fuera del historial de migraciones del repo.
Si Enzo ya tiene una columna equivalente planeada con otro nombre, agregarla acá crea una duplicación
permanente — exactamente lo que le pasó a D12 de `integracion-obra-social`. **Se confirma con backend
antes de escribir el `.sql`.**

### D4 — Alta y edición atómicas: dos funciones `SECURITY INVOKER` ⚠️ REQUIERE APROBACIÓN

**El problema.** Guardar una factura escribe en 2 tablas: `facturacion.facturas` y
`facturacion.asistencia_prestacion` (N filas). PostgREST **no da transacciones entre requests**: cada
`insert()` de supabase-js es un request HTTP que commitea por su cuenta. Una secuencia cortada a
mitad deja una factura sin sus asistencias — y las asistencias son lo que se factura (RN-FA-01) y lo
que se imprime junto a la factura (`factura-exportacion`). Una factura con medio detalle es peor que
ninguna: es un documento fiscal incorrecto.

**La resolución.** Dos funciones `plpgsql`, ambas **`SECURITY INVOKER`**:

```
facturacion.crear_factura_completa(p_factura jsonb) RETURNS uuid
facturacion.actualizar_factura_completa(p_id uuid, p_cambios jsonb) RETURNS uuid
```

PostgREST ejecuta cada `POST /rpc/…` dentro de una transacción: el cuerpo entero commitea o hace
rollback completo. `create()` y `update()` releen con `getById(uuid)` y devuelven eso, de modo que lo
devuelto siempre es lo que quedó realmente en la base (defaults, triggers, normalizaciones).

**Semántica de las asistencias: reemplazo completo del conjunto.** Igual que el checklist de
`integracion-obra-social` (D6) y **a diferencia** de las colecciones de Pacientes: las asistencias son
identidad-libre (nada las referencia con FK, no hay `ON DELETE RESTRICT` apuntándoles) y el editor de
asistencias trabaja sobre el conjunto entero. `DELETE` + `INSERT` dentro de la transacción es más
simple que un diff fino y no pierde ningún id que alguien esté mirando.

**Semántica parcial de `p_cambios`.** `ActualizacionFactura` es `Partial<…>`: la ausencia de una clave
significa "no tocar". En `jsonb` eso se distingue con el operador `?` (`p_cambios ? 'asistencias'`),
que diferencia *clave ausente* de *clave presente con valor null* — `->>` sola no alcanza, y
confundirlas **borraría las asistencias de cualquier factura que se edite solo para cambiar el
estado**, que es la operación más frecuente del circuito. Es la trampa más fácil de este change y
tiene test dedicado. Misma trampa ya documentada y resuelta en `integracion-obra-social` D6.

#### ⚠️ `SECURITY INVOKER`, no `SECURITY DEFINER` — requisito de seguridad duro

Las dos funciones se declaran **`SECURITY INVOKER`** explícitamente (aunque sea el default de
PostgreSQL) para que sea una afirmación revisable en el diff y no un default silencioso.

**Por qué `DEFINER` sería una regresión inaceptable, y acá más que en los changes anteriores.** El
owner de una función creada por una migración de Supabase es `postgres`, superusuario, que
**bypassea RLS por completo**. Con `DEFINER`, cualquier usuario autenticado —incluso sin ninguna fila
en `modulos.permisos`— podría **emitir y editar facturas**. En Obras Sociales el radio de daño era
config; acá es el registro financiero de la empresa, con su rastro de auditoría.

**Cómo se hace cumplir el permiso**, verificado contra `pg_policies` en vivo:

| Tabla escrita por la función | Policy vigente (real) | Efecto sin permiso |
|---|---|---|
| `facturacion.facturas` | `"Write facturacion" FOR ALL … USING (modulos.tiene_permiso('facturacion','write'))` | `42501` en el primer INSERT/UPDATE → rollback total |
| `facturacion.asistencia_prestacion` | `"Write asistencia_prestacion" FOR ALL … USING (modulos.tiene_permiso('facturacion','write'))` | `42501` → rollback total |

Detalle que hace que esto funcione, igual que en los dos changes anteriores: las policies son
`FOR ALL` **con `USING` y sin `WITH CHECK`**, y en ese caso PostgreSQL usa la expresión de `USING`
también como check de `INSERT`. **Este change NO reescribe esas policies** — funcionan, y tocar RLS de
un dominio financiero sin necesidad es riesgo puro. Se registra en §Open Questions que los `WITH
CHECK` explícitos serían preferibles por legibilidad del diff, para que backend lo evalúe.

`modulos.tiene_permiso()` sí es `SECURITY DEFINER` y **debe** serlo (necesita leer `modulos.permisos`
de todos los usuarios); eso no debilita nada porque filtra por `auth.uid()`, que sale del JWT.

`SET search_path = ''` en ambas funciones, `REVOKE ALL … FROM PUBLIC` y `FROM anon`,
`GRANT EXECUTE … TO authenticated`, y `COMMENT ON FUNCTION` con la prohibición de `DEFINER` escrita
para quien lea la base sin abrir este documento. Precedente vivo en el mismo schema:
`facturacion.validar_autorizacion_monto()` es `SECURITY DEFINER` (correcto: es un trigger de
validación que no escribe), lo que hace **más** importante que las dos nuevas declaren `INVOKER` de
forma explícita — si no, quien lea el schema va a asumir que el estilo de la casa es `DEFINER`.

#### Errores propios de las funciones (clase `45`, libre en PostgreSQL)

Se reserva un rango distinto del de `integracion-obra-social` (`451xx`) para que un código no se
confunda entre dominios:

| Código | Cuándo | Mensaje de UI |
|---|---|---|
| `45201` | una asistencia llega sin fecha o sin prestación | `Todas las asistencias necesitan fecha y prestación.` |
| `45202` | `p_factura` / `p_cambios` no es un objeto JSON | `No se pudo guardar la factura.` (genérico — es un bug del cliente) |
| `45203` | `actualizar_…` con un id que no existe (o que RLS oculta) | `No existe una factura con id "…".` (idéntico al mock) |
| `45204` | `mes_facturado` fuera de 1-12 (defensa en profundidad sobre el `CHECK`) | `El mes facturado debe estar entre 1 y 12.` |

#### Auditoría y rollback

Los triggers `auditoria.log_action()` de `facturas` y `asistencia_prestacion` (los dos ya aplicados,
verificados en `information_schema.triggers`) disparan fila por fila **dentro de la misma
transacción** (RN-GL-02): una emisión deja su rastro completo o no deja ninguno. Rollback de las
funciones: `DROP FUNCTION` × 2 — no crean ni alteran tablas, columnas, policies ni datos.

### D5 — Lectura: una sola consulta con embed de asistencias

`list()`, `getById()` y `listByPaciente()` usan un único `select` sobre el schema `facturacion`:

```
supabase.schema('facturacion').from('facturas').select(`
  id, paciente_id, descripcion, dias, valor_km, monto, estado, fecha_init, fecha_tope, tipo,
  cantidad_km, fecha_estimada_cobro, fecha_factura, prestacion, mes_facturado, anio_facturado,
  dependencia_y_retorno, domicilio_id, identificador_origen, identificador_valor,
  asistencia_prestacion ( id, fecha, prestacion, dependencia, retorno, factura_sabados )
`)
```

`getById` agrega `.eq('id', id).maybeSingle()`; `listByPaciente` agrega `.eq('paciente_id', id)`.
Todo vive en el mismo schema, así que —como en Obras Sociales y a diferencia de Pacientes— **no hay
segunda consulta ni degradación parcial**: una factura se lee entera o no se lee.

El ordenamiento de las asistencias se aplica **client-side en el mapeo puro** (por `fecha` asc, `id`
como desempate determinista), no con `.order()` sobre el embed: es testeable sin red y no depende de
la sintaxis de ordenamiento de embeds de PostgREST, que es la parte de la API que más cambió entre
versiones.

**Flujo de `getById` (secuencia):**

```
UI (FacturaDetail)
  └─> useFacturas / repository.getById(id)
        ├─> supabase.schema('facturacion').from('facturas')
        │        .select(embed).eq('id', id).maybeSingle()
        │     └─> RLS: modulos.tiene_permiso('facturacion','read') en facturas Y en asistencia_prestacion
        │           ├── permitido  -> row | null
        │           └── denegado   -> row = null   (RLS filtra, NO devuelve error)
        ├─> si row === null  -> return null        (contrato: no lanza)
        └─> ensamblarFactura(row)                  (mapea, ordena asistencias, puro)
              -> Factura
```

**Trampa registrada:** si el usuario tuviera `facturacion: read` sobre `facturas` pero el embed
fuera denegado, PostgREST devolvería la factura con `asistencia_prestacion: []` — una factura que
parece vacía en vez de un error. Hoy **no puede ocurrir** porque las dos policies usan el mismo
predicado (verificado), pero es exactamente el modo de falla "0 filas en silencio" que la skill de
`supabase` advierte. Se cubre con una tarea de verificación manual explícita.

### D6 — `CobroRepository` entra en este change, no en otro ⚠️ REQUIERE APROBACIÓN

**El argumento.** No es scope inflado, es acoplamiento duro:

1. `estadoDerivadoFactura(factura, cobros)` y `saldoPendiente` cruzan `Cobro.facturaId` contra
   `Factura.id`. Con facturas reales (UUID de Postgres) y cobros de `localStorage` (ids de fixture
   `cobro-…`), **ningún cobro matchea ninguna factura**: el panel de cobros aparece vacío para toda
   factura y toda factura emitida se ve como impaga.
2. `CobrosPanel` permite corregir el estado manualmente a partir de los cobros registrados
   (`factura-estados-circuito`). Con cobros falsos, esa corrección opera sobre datos inventados.
3. `facturacion.cobros` ya existe, con RLS por el **mismo** módulo (`facturacion`), FK
   `ON DELETE CASCADE` a `facturas` y trigger de auditoría. No hay nada que construir en backend.

**Lo que agrega**: `SupabaseCobroRepository.ts` con las 4 firmas de la interfaz. `remove(id)` es un
`.delete().eq('id', id)` directo (no hace falta RPC: es una sola tabla). `create` es un `.insert()`
con `.select().single()`. `list()` sin filtro (lo necesita `C-11`); `listByFactura` con
`.eq('facturas_id', facturaId)` — **ojo con el nombre plural de la columna**.

**Por qué igual requiere aprobación.** Amplía un change ya CRÍTICO. La alternativa (change propio
`integracion-cobros` inmediatamente después) es legítima si la usuaria prefiere lotes más chicos,
pero deja la app en un estado intermedio roto entre los dos changes — lo que la preferencia
registrada de la usuaria (*"no messy intermediate states"*) desaconseja explícitamente.

### D7 — Traducción de errores: PostgREST → `Error` con mensaje de UI

`useFacturas` y `useCobros` pintan `err.message` directamente, así que los repositories **siempre**
lanzan `Error` con `.message` en castellano listo para mostrar:

| Señal | Mensaje |
|---|---|
| `42501` / `PGRST301` (RLS deniega write) | `No tenés permiso para modificar facturas.` |
| `23503` sobre `paciente_id` | `El paciente seleccionado ya no existe.` |
| `23503` sobre `domicilio_id` | `El domicilio seleccionado ya no existe en la ficha del paciente.` |
| `23503` sobre `facturas_id` (cobro) | `La factura de ese cobro ya no existe.` |
| `23514` (viola el `CHECK` de `mes_facturado`) | `El mes facturado debe estar entre 1 y 12.` |
| `22P02` (enum inválido — estado o tipo de comprobante fuera de rango) | `No se pudo guardar la factura.` |
| `45201` | `Todas las asistencias necesitan fecha y prestación.` |
| `45202` | `No se pudo guardar la factura.` |
| `45203` | `No existe una factura con id "…".` (idéntico al mensaje del mock) |
| `45204` | `El mes facturado debe estar entre 1 y 12.` |
| `PGRST202` (la RPC no existe → migración sin aplicar) | `El alta de facturas no está habilitada en el servidor todavía.` |
| `PGRST204` (columna inexistente → `fecha_factura` sin aplicar) | `La fecha de emisión de factura no está habilitada en el servidor todavía.` |
| `PGRST106` (schema no expuesto) | `El módulo de Facturación no está habilitado en el servidor.` |
| cualquier otro | `No se pudo cargar/guardar la factura.` según la operación |
| `getById` sin fila | **no lanza** → `null` (contrato explícito de la interfaz) |

*Por qué mensajes fijos y no el `error.message` crudo:* filtra nombres de tablas y columnas hacia la
UI y evita textos en inglés. `api-design` (forma de error consistente) se cumple porque las dos
implementaciones —mock y Supabase— lanzan `Error` con la misma forma; el contrato pasa a ser
normativo en el spec de `factura-contract`.

**Nota de seguridad (`security-review`, broken access control).** El gateo de escritura de la UI
(`usePuedeEscribir` / `<CamposSoloLectura>`, cableado por `gateo-facturacion`) es client-side y
**bypassable**. La defensa real es la policy `FOR ALL USING (tiene_permiso('facturacion','write'))`.
Este change **no la duplica ni la reimplementa**: solo traduce su rechazo a un mensaje legible, y hay
un test de código fuente que verifica que los repositories no consultan `modulos.permisos`.

### D8 — `documento_factura` queda fuera de este change ✅ DECIDIDO

**El hecho.** `facturacion.documento_factura` ya existe (FK a `facturas` con `ON DELETE CASCADE`, FK
a `obra_social.tipos_documento` con `ON DELETE RESTRICT`, `archivo_url NOT NULL`, RLS, GRANT y
trigger de auditoría). El frontend, en cambio, resuelve el checklist documental de la factura con
`mockDocumentoRepository` — el mismo mock de **uploads simulados** que usan Pacientes, Vehículos y
Conductores.

**La decisión: NO entra acá.** Es la **fila 8** del §Plan de integración de `CHANGES.md`
(*"Documentos (storage) — buckets ya creados; falta reemplazar `mockDocumentoRepository`"*), un change
transversal a **cuatro** dominios. Razones, en orden de peso:

1. **Es otro tipo de trabajo.** Swapear documentos es integrar **Supabase Storage** (subida real de
   archivos, URLs firmadas, políticas de bucket), no PostgREST. Mezclarlo acá haría imposible
   revertir uno sin el otro.
2. **Resolverlo solo para Facturación duplicaría el trabajo.** El mismo `DocumentoRepository` sirve a
   `pacientes.documentos`, `conductores.documentos`, `vehiculos.documentos` y `documento_factura`. La
   decisión de cómo se mapea el adjunto a Storage se toma una vez, para los cuatro.
3. **Cero regla de negocio se pierde.** El checklist documental de la factura sigue funcionando igual
   que hoy: `factura-documentacion` (spec archivada) no cambia, y el comprobante de ARCA sigue siendo
   un ítem manual más del checklist.

**Consecuencia aceptada y visible:** después de este change, una factura real puede tener documentos
que solo viven en `localStorage`. Se señaliza con `AvisoModeloDatos` en `FacturaDocumentos.tsx` — no
se silencia.

### D9 — La validación de cupo queda sobre fuente mixta ⚠️ CHECKPOINT

**El problema, y es el hallazgo funcional más importante de este change.** `validarCupoFacturacion`
(RN-FA-02, RN-PA-03) compara los días y km facturados del período contra el `CupoAutorizado` que sale
de `AutorizacionRepository`. Después del swap, las facturas son **reales** y las autorizaciones
siguen siendo **fixtures de `localStorage`**.

**Dos consecuencias distintas, las dos malas:**

1. **Fuente mixta.** El cupo consumido se calcula sobre facturas reales de Postgres; el cupo
   autorizado sale de un fixture. La alerta puede dispararse de más (fixture chico) o —peor— **no
   dispararse cuando debería** (fixture generoso), sobre una factura real que se va a emitir. Nada
   falla: la pantalla se ve perfectamente sana.
2. **Trampa de RLS descubierta al verificar el schema real.** Las policies de
   `facturacion.presupuesto` y `facturacion.autorizacion` en la base **no son las que dice la
   migración commiteada**. `20260724100005_schema_facturacion.sql` las crea con
   `tiene_permiso('facturacion', …)` —con un comentario largo justificando por qué el docx exige que
   compartan módulo con Facturas— pero la base real las tiene con **`tiene_permiso('presupuestos',
   …)`**, un módulo distinto que existe en `modulos.modulos` (verificado). Es decir: cuando
   Presupuestos se integre, **un usuario con `facturacion: read/write` y sin `presupuestos: read`
   verá 0 autorizaciones, en silencio, sin ningún error** — y la validación de cupo quedará
   desactivada de hecho para el perfil que más la necesita. Es el modo de falla "policy de SELECT
   faltante → 0 filas silenciosas" del checklist de `supabase`, con otra causa.

**La decisión propuesta (default).** Este change **no swapea autorizaciones** —`C-06` está bloqueado
(`CHANGES.md` fila 5: *"2 puntos a coordinar con backend, governance ALTO"*) y meterlo acá arrastraría
ese bloqueo a un change CRÍTICO— pero **hace visible la fuente mixta** con un `AvisoModeloDatos` en
`AlertaCupo.tsx`, y **registra la trampa de RLS** en la KB, en `CHANGES.md` §C-06 y en §Open
Questions, para que `integracion-presupuestos` no la descubra en producción.

**Las tres opciones sobre la mesa para la usuaria:**

| Opción | Qué implica | Riesgo | Costo |
|---|---|---|---|
| **A. Fuente mixta + cartel** (propuesta) | la alerta de cupo sigue andando contra fixtures, con aviso visible | alerta poco confiable, pero declarada | bajo |
| B. Desactivar la alerta de cupo hasta que `C-06` esté integrado | la pantalla pierde RN-FA-02 temporalmente | regresión funcional visible | medio |
| C. Arrastrar el swap de `autorizacion` a este change | la alerta queda confiable de una | importa el bloqueo de `C-06` a un change CRÍTICO, y expone la trampa de RLS sin coordinación previa | alto |

**Propuesta concreta: A.** B esconde una regla de negocio del cliente; C es exactamente lo que el
corte de esta serie de changes evita. **No avanzar al cableado de `tasks.md` sin respuesta.**

### D10 — Índices sobre las FK: no existe ni uno ⚠️ REQUIERE APROBACIÓN (por el `CONCURRENTLY`)

**El hecho, verificado contra `pg_indexes`.** El schema `facturacion` tiene exactamente **7 índices:
las 7 primary keys**. Ninguna de sus 9 foreign keys está indexada. Es una violación directa de la
regla de `database-schema-design` (*"indexar toda columna FK"*), y no es teórica: el embed de
asistencias de D5 filtra por `asistencia_prestacion.factura_id` en **cada** lectura de factura, y
`listByPaciente` filtra por `facturas.paciente_id`.

**Alcance de este change** — solo las FK del dominio que este change lee o escribe:

| Índice | Columna | Quién lo usa |
|---|---|---|
| `idx_facturas_paciente_id` | `facturas.paciente_id` | `listByPaciente()` (ficha del paciente) |
| `idx_facturas_domicilio_id` | `facturas.domicilio_id` | integridad + futuras consultas por domicilio |
| `idx_asistencia_prestacion_factura_id` | `asistencia_prestacion.factura_id` | **el embed de cada lectura** |
| `idx_cobros_facturas_id` | `cobros.facturas_id` | `listByFactura()` |
| `idx_documento_factura_factura_id` | `documento_factura.factura_id` | D8 (futuro), y el `ON DELETE CASCADE` |
| `idx_documento_factura_id_tipo_documento` | `documento_factura.id_tipo_documento` | el `ON DELETE RESTRICT` desde el catálogo compartido |

**Fuera de alcance, se reporta pero no se toca**: `presupuesto.obra_social_id`,
`presupuesto.paciente_id`, `autorizacion.presupuesto_id` (son de `C-06`) y `gastos_vehiculos.vehiculo_id`
(es de `C-08`). Mismo precedente que las FK hijas de Pacientes, que `integracion-pacientes` reportó y
no arregló.

**El apartamiento de la regla: `CREATE INDEX` sin `CONCURRENTLY`.** `database-schema-design` dice
*"nunca `CREATE INDEX` sin `CONCURRENTLY` en producción"*. Acá se propone **sin**, por dos razones que
se sostienen hoy y hay que re-verificar antes de aplicar:

1. **Las seis tablas tienen 0 filas** (verificado con `count(*)` el 2026-07-31). Un `CREATE INDEX`
   sobre una tabla vacía toma un `SHARE` lock durante microsegundos.
2. **`CREATE INDEX CONCURRENTLY` no puede ejecutarse dentro de un bloque de transacción**, y las
   migraciones de Supabase corren envueltas en una. Usarlo obligaría a partir la migración en un
   script fuera del flujo normal, agregando complejidad operativa real a cambio de un beneficio nulo
   sobre tablas vacías.

**Condición de caducidad, escrita para que no se pierda:** si al momento de aplicar la migración
alguna de estas tablas ya tiene filas en volumen, **hay que rehacerlo con `CONCURRENTLY` fuera de
transacción**. La verificación del `count(*)` es una tarea explícita e inmediatamente anterior al
`db push`, no un supuesto.

**Rollback**: `DROP INDEX` × 6. Los índices no cambian ninguna semántica.

### D11 — Nullability: la base es permisiva, el tipo es estricto; se resuelve en el mapeo

**El problema.** De las 19 columnas de `facturas`, **17 son nullables** (todas menos `id` y
`paciente_id`). El tipo `Factura` declara `dias`, `valorKm`, `monto`, `estado`, `fechaInicial`,
`fechaTope`, `tipoComprobante`, `cantidadKm`, `prestacion`, `mesFacturado`, `anioFacturado`,
`dependenciaYRetorno` y `domicilioId` como **requeridos**. Lo mismo en
`asistencia_prestacion.dependencia` / `.retorno`: nullables en la base, `string` requerido en
`AsistenciaPrestacion`.

**La decisión: se absorbe en el mapeo, la base no se toca.**

- **Lectura**: `parseFacturaRow` aplica defaults documentados y explícitos — `?? ''` para los
  textuales, `?? 0` para los numéricos, `estadoDesdeBase(…)` para el estado (total por D2). Una fila
  parcial cargada por SQL directo se lee como una factura incompleta pero **coherente**, nunca como
  un crash ni como `undefined` filtrándose a la UI.
- **Escritura**: la RPC valida lo que sí es regla de negocio (`45201` asistencias sin fecha o
  prestación, `45204` mes fuera de rango). El resto lo garantiza `validateFacturaForm`, que ya existe
  y no cambia.
- **NO se agregan `NOT NULL`** a columnas existentes. Sería un cambio contract-breaking en un dominio
  CRÍTICO, requeriría backfill coordinado con backend (expand/contract en dos pasos) y **ninguna
  fuente lo pide**: el docx no marca esos campos como obligatorios. Se reporta a backend como
  decisión pendiente.

*Riesgo aceptado y anotado:* un `?? 0` sobre `monto` convierte una factura sin importe en una factura
de $0 en la UI. Es preferible a romper el listado, y `validateFacturaForm` impide producirlo desde la
app — pero es exactamente por esto que la nullability debería cerrarse con backend.

### D12 — Inventario de discrepancias: qué se cierra, qué se abre

`CHANGES.md` §C-07 declara **5 discrepancias bloqueantes** con el docx. Verificadas contra la base
real, **4 ya no existen**:

| # (CHANGES.md) | Discrepancia declarada | Estado real verificado |
|---|---|---|
| 1 | no existe la tabla `asistencia_prestacion` | ✅ **CERRADA** — existe, con FK `ON DELETE CASCADE`, RLS y auditoría |
| 2 | no existe `documento_factura` | ✅ **CERRADA** — existe, con doble FK, RLS y auditoría |
| 3 | no existe `fecha_estimada_cobro` en `factura` | ✅ **CERRADA** — `facturas.fecha_estimada_cobro DATE` existe |
| 4 | no existe `cantidad_km` en `factura` | ✅ **CERRADA** — `facturas.cantidad_km NUMERIC` existe |
| 5 | el enum de estado no incluye `facturado` | 🟡 **PARCIAL** — el enum **sí** tiene `facturado`; pero conserva `pendiente`, que el frontend no modela → se resuelve por mapeo (D2), no por schema |

Y `CHANGES.md` §C-11 declara 4; este change cierra 1 y media:

| # (C-11) | Discrepancia declarada | Estado real verificado |
|---|---|---|
| 2/4 | la factura no tiene fecha de emisión **ni** el estado `facturado` | 🟡 **MITAD CERRADA** — `facturado` existe en el enum; **`fecha_factura` sigue faltando** → D3 |
| 3/4 | no hay período de atribución estructurado | ✅ **CERRADA** — `mes_facturado` (con `CHECK 1..12`) y `anio_facturado` existen |

**Discrepancias NUEVAS que este change abre y documenta:**

| # | Frontend | Base real | Resolución |
|---|---|---|---|
| N1 | `Factura.fechaFactura` | sin columna | **se resuelve**: `ADD COLUMN fecha_factura DATE` (D3) — requiere aprobación |
| N2 | `EstadoFactura` (4 literales, con guiones) | `estado_factura` (5 literales, con espacios) | **se resuelve por mapeo** (D2); la base no se toca |
| N3 | 13 campos requeridos del tipo | 17 columnas nullables | **se absorbe en el mapeo** (D11); se reporta a backend |
| N4 | — | `presupuesto`/`autorizacion` gateadas por el módulo **`presupuestos`**, no `facturacion` como dice la migración commiteada | **NO se resuelve**: se documenta la trampa de 0-filas-silenciosas para `integracion-presupuestos` (D9) |
| N5 | — | ninguna FK del schema tiene índice | **se resuelve parcialmente**: 6 índices del dominio propio (D10); las 3 de `C-06`/`C-08` se reportan |
| N6 | — | 10+ columnas y 2 tablas aplicadas **fuera del historial de migraciones** del repo | **NO se resuelve**: tercera vez consecutiva en esta serie. Se eleva a §Open Questions como problema de proceso, no de este change |

Las que dicen "NO se resuelve" van a `knowledge-base/04_modelo_de_datos.md` §Discrepancias, a
`CHANGES.md` y a un `AvisoModeloDatos` en la pantalla. Ninguna se resuelve unilateralmente.

### D13 — Los 4 defaults de negocio se heredan; **ninguna pregunta abierta se cierra**

Decisión explícita de la usuaria para este change: heredar los defaults de `facturacion-ui` tal como
están, sin re-decidirlos. Se documenta acá **qué significa heredar en cada caso**, porque el swap
toca los cuatro sin resolver ninguno:

- **Identificador de la factura (IN-01).** `resolverIdentificadorFactura` lee
  `obraSocial.plantillaFactura.identificadorOrigen` y congela el resultado al emitir (RN-FA-06). El
  origen vive en `obra_social.identificador_origen` (enum, `DEFAULT 'paciente.numeroAfiliado'`,
  real desde `integracion-obra-social`) y el snapshot en `facturas.identificador_origen` +
  `identificador_valor` (ambas reales). **Nada se hardcodea acá**; el swap solo persiste el snapshot
  que la función pura ya calcula. **Sigue abierta**: si es DNI o número de afiliado lo confirma el
  cliente.
- **Período de facturación (RF-400).** Estructurado y numérico. `facturas.mes_facturado` (con
  `CHECK (1..12)`) y `anio_facturado` ya existen — el default del frontend **coincide con el schema
  real**, no hay nada que decidir. **Sigue abierta**: si alguna obra social exige otro formato de
  período en la plantilla.
- **Plazos de cobro (90/60/45) y precedencia amparo > obra social > default.** Las tres constantes
  siguen en `frontend/src/shared/lib/facturacion/constantes.ts`; el plazo propio de la obra social
  sigue en `obra_social.plazo_cobro_dias` (`DEFAULT 90`, real). `calcularFechaEstimadaCobro` no se
  toca, y la fecha resultante se persiste en `facturas.fecha_estimada_cobro` al emitir. **Este change
  NO mueve las constantes a la base** — hacerlo sería re-decidir la forma de la configuración.
  **Siguen abiertos** los tres valores y, sobre todo, si el amparo judicial realmente le gana al plazo
  propio de la obra social.
- **Integración ARCA.** **Cero.** Carga manual del comprobante como ítem del checklist documental
  (`FacturaDocumentos.tsx`). Este change no agrega ningún cliente HTTP, ninguna variable de entorno,
  ningún endpoint, ninguna tabla y ninguna columna relacionada con ARCA. **Sigue abierta**: si el
  cliente espera integración automática, es un change de backend aparte.

**Ninguna de estas cuatro se marca como resuelta en `10_preguntas_abiertas.md` después de este
change.** El swap hereda el default; no lo convierte en definitivo.

### D14 — Tests: mapeo puro exhaustivo + repositories contra un fake tipado

Dos capas, siguiendo el precedente de `SupabasePacienteRepository.test.ts` y
`SupabaseObraSocialRepository.test.ts`:

1. `facturaMapping.test.ts` — funciones puras, sin mocks. Cubre: los 11 renombres, los 5 literales
   del enum de entrada **incluido `pendiente`** y el caso desconocido (totalidad de `estadoDesdeBase`),
   que `estadoHaciaBase` nunca emite `'pendiente'`, el colapso de las dos columnas de identificador en
   un objeto (y su ausencia si cualquiera es `NULL`), el orden de las asistencias con desempate por
   `id`, colecciones vacías, filas hijas malformadas descartadas sin romper la factura, los 13
   defaults de nullability de D11, y la semántica parcial de `toActualizarFacturaPayload` (clave
   ausente vs. `null` — el caso que borraría las asistencias).
2. `SupabaseFacturaRepository.test.ts` / `SupabaseCobroRepository.test.ts` — `vi.mock` del cliente con
   un fake tipado a mano (interfaces propias, **cero `any`, cero `as`**) que **registra** cada llamada,
   para poder afirmar que `create()` emite **una sola** `.rpc()` y **ningún** `.insert()` sobre
   `asistencia_prestacion`, que `list()` emite **una sola** consulta (anti N+1), y que cada código de
   error produce exactamente el mensaje de D7.

**Tercera capa — las funciones SQL.** El repo sigue sin harness para funciones de Postgres (sin
pgTAP, sin `supabase/config.toml`, sin CI con Docker). Se sigue el precedente de `C-02`,
`integracion-pacientes` e `integracion-obra-social`: **verificación manual con cuentas reales**, como
tareas explícitas y separadas en `tasks.md` §1B, a coordinar con Enzo/backend. **La única barrera
automatizada** contra la regresión de seguridad más grave es el test que lee el `.sql` con `node:fs` y
verifica que dice `SECURITY INVOKER` y no `SECURITY DEFINER` fuera de comentarios y literales —
patrón ya resuelto empíricamente (`?raw` de Vite **no** funciona para rutas fuera de `frontend/`).

Más aserciones de código fuente (`?raw`) de que los repositories no contienen `service_role`, no
contienen `any` y no consultan `modulos.permisos` ni `modulos.modulos`.

**Cuentas reales disponibles** (`frontend/.env`, `VITE_TEST_ACCOUNTS`): Admin, Facturación y
Operación. La cuenta *Facturación* es exactamente el perfil que hace falta para probar el gateo y,
además, es la que expone la trampa de D9 (probablemente **sin** `presupuestos: read`).

---

## Risks / Trade-offs

- **[La alerta de cupo opera sobre fuente mixta]** → riesgo #1 del change, y el único con impacto en
  una regla de negocio del cliente (RN-FA-02). Una factura real puede emitirse sin alerta porque el
  fixture de autorizaciones dice que hay cupo. Mitigación: es un ⚠️ CHECKPOINT (D9), no una decisión
  del agente; `AvisoModeloDatos` en `AlertaCupo.tsx`; y la alerta ya es **no bloqueante por diseño**
  (`factura-cupo-validacion`: avisa y pide confirmación explícita), así que el operador humano sigue
  siendo la última barrera.
- **[`fecha_factura` no se aplica y la alerta de vencimiento queda muda]** → sin la columna, `PGRST204`
  en cada escritura o pérdida silenciosa del campo. Mitigación: aplicar la migración es tarea
  **bloqueante** del cableado (orden explícito en `tasks.md`), y `PGRST204` tiene mensaje propio en
  castellano en vez de un error críptico.
- **[Alguien convierte una de las dos funciones a `SECURITY DEFINER`]** → bypass total del gateo por
  módulo sobre el registro financiero. Radio de daño mayor que en los dos changes anteriores.
  Agravante: `facturacion.validar_autorizacion_monto()` ya es `DEFINER` en el mismo schema, así que el
  "estilo de la casa" puede leerse mal. Mitigación en cuatro capas: esta decisión (D4), el bloque ⚠️⚠️
  en la cabecera de la migración, el `COMMENT ON FUNCTION`, y el test automatizado del texto del `.sql`.
- **[Se pierden las asistencias al editar el estado de una factura]** → si `toActualizarFacturaPayload`
  emite la clave `asistencias` cuando el `Partial` no la trae, la RPC hace `DELETE` de todas. Es la
  operación más frecuente del circuito de estados. Mitigación: operador `?` de `jsonb` en la función,
  test dedicado en las dos capas, y un test de integración del flujo "emitir factura" que verifica que
  las asistencias sobreviven.
- **[El enum de estado se desincroniza]** → si backend agrega un literal al enum, `estadoDesdeBase`
  lo mapea a `'a-facturar'` en silencio. Mitigación: la función es total **a propósito** (nunca romper
  el listado por un dato inesperado), pero el caso desconocido queda cubierto por test para que sea
  una decisión visible, no un accidente.
- **[Nullability: `?? 0` sobre `monto` muestra una factura de $0]** → aceptado (D11), preferible a
  romper el listado. Se reporta a backend como decisión pendiente.
- **[Los índices se aplican sobre tablas ya pobladas]** → la justificación de D10 (0 filas) caduca.
  Mitigación: verificar `count(*)` como tarea inmediatamente anterior al `db push`, no como supuesto.
- **[Tercera vez que el schema real va por delante del repo]** → `integracion-pacientes` 1B.3,
  `integracion-obra-social` 1.3 y ahora este. Diez columnas y dos tablas del dominio más crítico del
  sistema existen en producción sin ninguna migración commiteada que las cree. Es un problema de
  **proceso**, no de este change: quien clone el repo y corra `supabase db reset` obtiene un schema
  `facturacion` que no puede sostener la app. Se eleva a §Open Questions.
- **[Regresión en la suite existente]** → safety net obligatorio: correr la suite **antes** de tocar
  cualquier archivo existente y registrar el baseline. Ojo con el bug de entorno ya diagnosticado
  (`NODE_OPTIONS="--no-experimental-webstorage"`, Node v26 + jsdom 29 + vitest 4: el `localStorage`
  nativo experimental de Node shadowea el de jsdom y hace fallar ~112 tests que no son regresión).
- **[Actividad concurrente de otra sesión sobre el repo]** → `CHANGES.md` registra que
  `integracion-conductores-vehiculos` apareció con propose completo desde otra sesión. Este change no
  toca `features/conductores/`, `features/vehiculos/` ni sus `shared/lib/` — el único punto de
  contacto posible es el conteo del baseline de tests.
- **[El fake del query builder se desincroniza de supabase-js]** → tests verdes contra una API que
  cambió. Mitigación: consultar `https://supabase.com/changelog.md` antes de implementar (regla de la
  skill `supabase`) y mantener el fake en el subconjunto mínimo usado.

---

## Migration Plan

1. **⚠️ Checkpoint de governance CRÍTICO** con la usuaria: aprobar (o rechazar) **D3, D4, D6, D9 y
   D10** — ver §Aprobaciones requeridas. **No se escribe una línea de código ni de SQL sin respuesta
   a las cinco.**
2. **Coordinar D3 con backend (Enzo)** antes de escribir el `.sql`: confirmar que `fecha_factura` no
   está ya planeada con otro nombre. Es el aprendizaje directo de D12-revertida de
   `integracion-obra-social`.
3. Reconfirmar que el schema `facturacion` está expuesto en el Data API (ya verificado el 2026-07-31:
   `42501`, no `PGRST106`) y revisar el **estado del historial de migraciones**
   (`supabase migration list --linked`), por el desfasaje conocido y ahora agravado (N6).
4. **Verificar `count(*)` de las 6 tablas inmediatamente antes de aplicar** — es la condición que
   sostiene D10 (índices sin `CONCURRENTLY`).
5. Escribir las dos migraciones. Revisarlas contra el checklist de
   `supabase-postgres-best-practices` y correr `supabase db advisors --linked --type security`
   **antes** de aplicar (línea base de hallazgos preexistentes) y **después**.
6. **Aplicar las dos migraciones** al proyecto real. **Las corre la usuaria / Enzo, no el agente.**
   Este paso **bloquea** el paso 9.
7. Verificación manual de las dos funciones con **las tres cuentas reales** de `VITE_TEST_ACCOUNTS`
   (checklist completo en `tasks.md` §1B): `facturacion: write` → alta completa con asistencias;
   `facturacion: read` sin `write` → `42501` y cero filas escritas (la prueba de que `INVOKER` está
   haciendo su trabajo); edición de solo el estado → **las asistencias sobreviven**;
   `select prosecdef from pg_proc where proname in ('crear_factura_completa',
   'actualizar_factura_completa')` → `false` en ambas.
8. Implementar `facturaMapping.ts`, `SupabaseFacturaRepository.ts` y `SupabaseCobroRepository.ts` por
   TDD estricto (nada de esto toca producción todavía: nadie los importa).
9. Cambiar `FacturacionRoute.tsx` — **el corte real**. A partir de este commit la pantalla usa datos
   reales.
10. Actualizar `FacturaAvisoDiscrepancias.tsx`: retirar las 4 discrepancias cerradas, sumar las
    nuevas (D12) y los carteles de D8 y D9.
11. Documentar todo (KB §Discrepancias + `10_preguntas_abiertas.md` con el conteo de pgTAP
    actualizado + `CHANGES.md` §C-07, §C-11, §C-06 y §Plan de integración fila 4).
12. Verificación manual en navegador con las tres cuentas del paso 7.
13. Actualizar `ROADMAP-FRONTEND.md`.

**Rollback**: revertir el commit del paso 9 (dos imports y dos props en `FacturacionRoute.tsx`). La
app vuelve a los mocks al instante y los archivos del paso 8 quedan inertes. Las migraciones **no hace
falta revertirlas**: `fecha_factura` queda nullable y nadie la lee, los índices no cambian semántica y
las funciones sin llamador son inertes. Si aun así se quiere limpiar: `DROP FUNCTION` × 2 +
`DROP INDEX` × 6 + `ALTER TABLE facturacion.facturas DROP COLUMN fecha_factura`. **Ningún dato
existente se transforma ni se borra en ningún paso del plan**, y hoy las seis tablas tienen 0 filas.

---

## Open Questions

- **Las 4 preguntas de negocio de prioridad Alta siguen abiertas** (identificador DNI/afiliado,
  formato del período, plazos 90/60/45 y su precedencia, integración ARCA). Este change las **hereda**
  con el default de `facturacion-ui` (D13) y **no cierra ninguna**. **Decisor**: cliente (Andrea
  Pastor) / equipo técnico.
- **¿La factura debe congelar su obra social, o se re-resuelve desde el paciente?** Hoy
  `facturas` **no tiene** `obra_social_id`: la obra social se alcanza vía la cobertura vigente del
  paciente. RN-FA-06 dice que una factura emitida no se ajusta retroactivamente, y hoy eso se cumple
  **a medias**: `descripcion` e `identificadorFactura` **sí** quedan congelados (columnas propias),
  pero el `plazoCobroDias` y la plantilla se re-resuelven en cada lectura. Si un paciente cambia de
  obra social, sus facturas viejas empiezan a mostrar la configuración de la obra social nueva.
  ¿`facturas.obra_social_id` como snapshot? **No se resuelve acá** — es una columna nueva sobre un
  dominio CRÍTICO y no hay ninguna fuente que la pida. **Decisor**: cliente / quien mantiene el docx.
- **¿Las policies `FOR ALL` de `facturacion` deberían tener `WITH CHECK` explícito?** Hoy las 14
  policies del schema usan `USING` sin `WITH CHECK`. Funciona (PostgreSQL reusa `USING` como check de
  `INSERT`), pero el checklist de `supabase` pide que la intención sea revisable en el diff. Este
  change **no las toca** (tocar RLS de un dominio financiero sin necesidad es riesgo puro).
  **Decisor**: backend.
- **¿Por qué `presupuesto` y `autorizacion` quedaron gateadas por el módulo `presupuestos` si la
  migración commiteada dice `facturacion`?** (D9, discrepancia N4). La migración tiene un comentario
  largo argumentando explícitamente lo contrario, citando el docx. O el comentario está mal, o el
  cambio en producción fue involuntario. **Bloquea `integracion-presupuestos`**: sin resolverlo, el
  perfil de Facturación verá 0 autorizaciones en silencio. **Decisor**: backend / quien mantiene el docx.
- **¿Se agregan `NOT NULL` a las columnas de `facturas` que el frontend trata como requeridas?**
  (D11). Hoy 17 de 19 son nullables. Requiere backfill coordinado y expand/contract. **Decisor**:
  backend.
- **¿Cómo se reconcilia el schema real con las migraciones del repo?** (N6). Tercer change consecutivo
  que encuentra columnas y tablas en producción sin migración commiteada — esta vez, **2 tablas y 10+
  columnas del dominio más crítico**. Un `supabase db reset` sobre el repo actual produce un schema
  `facturacion` incapaz de sostener la app. ¿Se genera una migración de reconciliación
  (`supabase db diff`) y se hace `migration repair`? **Decisor**: backend / equipo técnico. Es un
  problema de proceso, no de este change.
- **¿Se monta pgTAP (o `supabase start`)?** **Cuarto** change de la serie que verifica funciones de
  Postgres a mano. Con las dos de este change el acumulado pasa a **4 changes / 5 funciones**
  (`crear_paciente_completo`, `crear_obra_social_completa`, `actualizar_obra_social_completa`,
  `crear_factura_completa`, `actualizar_factura_completa`), y quedan **cinco** changes de integración
  por delante. Este change **no lo resuelve**; solo actualiza el conteo en
  `10_preguntas_abiertas.md`, que es el dato que faltaba para tomar la decisión. **Decisor**: equipo
  técnico.
- **¿Los índices de las FK que faltan en otros schemas?** Este change agrega los 6 de su propio
  dominio (D10), pero quedan sin índice `presupuesto.obra_social_id`, `presupuesto.paciente_id`,
  `autorizacion.presupuesto_id` (`C-06`), `gastos_vehiculos.vehiculo_id` (`C-08`) y las FK hijas de
  Pacientes que `integracion-pacientes` ya reportó. **Decisor**: backend.
- **¿`condicion_iva` (heredada de `integracion-obra-social`) sigue sin valores definidos?** Sí, y
  ahora importa más: Facturación es justamente el consumidor que iba a necesitarla. Este change **no
  la consume** (no aparece en la plantilla ni en la vista imprimible), así que no bloquea — pero la
  pregunta pasa a ser urgente para cualquier integración fiscal futura. **Decisor**: cliente / equipo
  técnico.
