## Context

**Rama de demo.** Todo esto vive en `feature/prestadores-crud` para mostrarle el concepto a Andrea.
Los supuestos de modelo del `proposal.md` (§Supuestos provisorios, 5 filas) **no se relitigan acá** —
este documento decide únicamente el **cómo técnico** de construirlos, asumiéndolos como dados y
provisorios.

**Lo verificado en el código real, no asumido:**

- `obra_social.prestadores` existe desde `20260724100003_schema_obra_social.sql:28-34` con 4 columnas
  (`razon_social`, `cuit UNIQUE NOT NULL`, `direccion`, `telefono`), RLS habilitada, policies
  `tiene_permiso('obra_social', 'read'|'write')` y trigger `trg_audit_prestadores`. **Sin ninguna
  FK** desde ni hacia ella en las 28 migraciones.
- `ObraSocial` end-to-end ya está construida y cableada a Supabase real
  (`ObraSocialesRoute.tsx:1` importa `supabaseObraSocialRepository`): interfaz de 4 métodos, mapeo
  puro, repository de I/O, context, hook, list+detail, form sin librería. Es el molde exacto a
  espejar.
- `obra_social.obra_social.plazo_cobro_dias INT NOT NULL DEFAULT 90` y `tipo_comprobante
  facturacion.tipo_factura` (nullable) ya existen desde
  `20260729110000_schema_obra_social_facturacion_config.sql:14-25`.
- `auditoria.log_action()` (`20260724100001:27-44`) usa `row_to_json(NEW)`/`row_to_json(OLD)`,
  `TG_TABLE_NAME` y `TG_OP` — **no depende de que la tabla tenga columna `id`**. Dato que habilita
  D2.

**Restricciones duras heredadas** (`CLAUDE.md`): nada de `any`; solo utilidades Tailwind v4; reusar
`design-system/components.tsx`; toda tabla nueva define su RLS en el mismo change; `npx tsc -b
--noEmit` como único type-check válido; y — regla vigente de esta sesión — **las migraciones se
escriben como archivo, nunca se aplican: `supabase db push` es siempre una acción humana y explícita
de Enzo**.

---

## Goals / Non-Goals

**Goals**

- `Prestador` como entidad de primer orden: tipo, repository, pantalla, gateo, tests — espejando el
  patrón de `ObraSocial` archivo por archivo, sin inventar uno nuevo.
- Que el vínculo N:N exista, sea persistente y sea navegable desde la UI, con RLS propia.
- Que Facturación **siga compilando y en verde** después de que `ObraSocial` pierda 2 campos, con el
  reemplazo marcado como provisorio en el código, no escondido.
- Que la migración quede escrita, revisable y **no destructiva**: aplicarla no puede perder ni un dato.

**Non-Goals**

- No se resuelve el supuesto #2 (ambigüedad de CUIT) ni el #5 (qué Prestador aplica al facturar).
- **No se toca ninguna de las dos funciones `SECURITY INVOKER` de Obra Social** (`20260731120001` /
  `20260731150000`) — ver D3, no hace falta.
- No se dropea ninguna columna (D3).
- No se introduce TanStack Query ni React Hook Form/Zod (mismo criterio YAGNI de `ObraSocialForm`).
- No se aplica nada contra Supabase real.

---

## Decisions

### D1 — CRUD directo por PostgREST, sin RPC, espejando `ObraSocial` archivo por archivo

**Sin RPC, confirmado.** `obra_social.prestadores` no tiene tablas hijas: un alta o una edición es un
único `INSERT`/`UPDATE` sobre una fila plana. Las dos funciones `SECURITY INVOKER` de Obra Social
existen porque ahí una sola operación toca hasta 4 tablas y PostgREST **no da transacciones entre
requests** (D6 de `integracion-obra-social`); acá ese problema no existe. Precedente directo en el
propio repo: `SupabasePacienteRepository` usa `.update()` directo para los campos planos de
`paciente` y reserva la RPC para el alta con colecciones hijas.

*(El vínculo N:N sí introduce escrituras multi-request. Se resuelve sin RPC — ver D2.)*

**Estructura de archivos (espejo 1:1):**

| Archivo nuevo | Espeja a | Qué hace |
|---|---|---|
| `shared/types/prestador.ts` | `types/obraSocial.ts` | `Prestador`, `NuevoPrestador = Omit<…,'id'>`, `ActualizacionPrestador = Partial<Omit<…,'id'>>` |
| `shared/lib/prestadores/PrestadorRepository.ts` | `ObraSocialRepository.ts` | `list()/getById()/create()/update()`; `getById` resuelve `null`, **no lanza** |
| `shared/lib/prestadores/prestadorMapping.ts` | `obraSocialMapping.ts` | puro: `isRecord()`, `readOptionalString()`, `parsePrestadorRow`, `toCrearPrestadorPayload`, `toActualizarPrestadorPayload` |
| `shared/lib/prestadores/SupabasePrestadorRepository.ts` | `SupabaseObraSocialRepository.ts` | solo I/O + `mapearErrorPrestador` |
| `features/prestadores/PrestadorRepositoryContext.tsx` | `ObraSocialRepositoryContext.tsx` | Context + Provider + hook que lanza si falta el Provider |
| `features/prestadores/usePrestadores.ts` | `useObrasSociales.ts` | `loading`/`error`/`recargar`/`crear`/`actualizar`, `err.message` directo a la UI |
| `features/prestadores/PrestadoresRoute.tsx` | `ObraSocialesRoute.tsx` | **único** archivo que importa la implementación Supabase |
| `features/prestadores/PrestadoresPage.tsx` | `ObraSocialesPage.tsx` | `View = list \| detail`, monta `<AvisoSoloLectura />` una sola vez |
| `features/prestadores/PrestadoresList.tsx` | `ObrasSocialesList.tsx` | grid de tarjetas, búsqueda local, estados vacío/error/loading |
| `features/prestadores/PrestadorDetail.tsx` | `ObraSocialDetail.tsx` | ficha + form embebido (edición diferida, nunca modal) |
| `features/prestadores/PrestadorForm.tsx` + `validatePrestadorForm.ts` | ídem de Obra Social | estado controlado plano, validación pura aparte |

**Lo que se copia son patrones reales, no genéricos:**

- **Mapeo defensivo sobre `unknown`**: `isRecord()` como único type guard base, `readOptionalString()`
  para las columnas NULLable, y defaults de módulo privados con comentario de *por qué* —
  `DEFAULT_PLAZO_COBRO_DIAS = 90` y `DEFAULT_TIPO_COMPROBANTE: TipoComprobante = 'A'` **se mudan
  desde `obraSocialMapping.ts` a `prestadorMapping.ts`** junto con las columnas. Cero `as` fuera del
  narrowing de uniones cerradas ya usado en el original.
- **Errores traducidos al castellano en el repository**, nunca `error.message` crudo: `23505` sobre
  `cuit` → `Ya existe un prestador con el CUIT «…».`; `42501`/`PGRST301` → `No tenés permiso para
  modificar prestadores.`; `PGRST204` → `Las condiciones de facturación del prestador no están
  habilitadas en el servidor todavía.` (síntoma exacto de migración sin aplicar); `PGRST106` → `El
  módulo de Obras Sociales no está habilitado en el servidor.`; genérico según operación.
- **Gateo RLS-driven en la UI**: `<AvisoSoloLectura />` a nivel de página, `<CamposSoloLectura>`
  envolviendo **solo** el bloque de campos del form (nunca la barra de acciones — Cancelar debe
  seguir vivo), y `<Button requiereEscritura>` en el submit. Es UX; **la defensa real es la policy**.

### D2 — `obra_social.obra_social_prestador`: PK compuesta, FK en `CASCADE`, y la UI del vínculo vive en `PrestadorForm`

**Forma de la tabla.**

```sql
CREATE TABLE obra_social.obra_social_prestador (
    obra_social_id UUID NOT NULL REFERENCES obra_social.obra_social(id) ON DELETE CASCADE,
    prestador_id   UUID NOT NULL REFERENCES obra_social.prestadores(id)  ON DELETE CASCADE,
    PRIMARY KEY (obra_social_id, prestador_id)
);
CREATE INDEX idx_obra_social_prestador_prestador ON obra_social.obra_social_prestador(prestador_id);
```

- **Sin `id` surrogate.** La fila es identidad-libre: no tiene ni un atributo propio, es solo el par.
  `requisitos_os` sí tiene surrogate + `UNIQUE(par)`, y D2 de `integracion-obra-social` documenta
  exactamente el daño que causa apoyarse en el id de una fila de vínculo (desvincular y volver a
  vincular genera un id nuevo). La PK compuesta da la unicidad gratis y elimina la tentación.
- **Índice explícito sobre `prestador_id`.** La PK compuesta indexa `(obra_social_id, prestador_id)`,
  que sirve para "prestadores de esta obra social" pero **no** para el sentido inverso, que es
  justamente el que consulta la pantalla de Prestador. Es además el índice de FK que
  `integracion-pacientes` reportó faltante en otros schemas — acá no se repite el olvido.
- **`ON DELETE CASCADE` en las dos FK.** Razonado, no copiado: la fila de vínculo **no tiene sentido
  sin los dos lados** y no guarda ningún dato propio, así que borrarla junto con cualquiera de ellos
  no pierde información. `RESTRICT` sería lo correcto si la fila hija guardara algo (por eso
  `pacientes.documentos.id_tipo_documento` sí es `RESTRICT`: ahí hay un documento subido de verdad),
  pero acá solo bloquearía el borrado de un prestador por filas vacías, y **ninguna de las dos
  entidades tiene siquiera un método `delete()` en su repository** — el borrado solo puede venir de
  un admin por SQL/dashboard, que es exactamente a quien no hay que trabar con ruido. Coherente
  además con `requisitos_os`/`plantilla_campo`, que ya son `CASCADE` en el mismo schema.
- **Trigger de auditoría: sí, y funciona.** `auditoria.log_action()` usa `row_to_json(NEW)` y
  `TG_TABLE_NAME`, sin tocar `NEW.id` — verificado en `20260724100001:27-44`. La PK compuesta no lo
  rompe. Se agrega `trg_audit_obra_social_prestador` porque RN-GL-02 exige rastro de toda escritura
  y porque *quién vinculó a quién* es precisamente el tipo de dato que Andrea va a querer auditar.

**RLS — mismo gate de módulo que `prestadores`, con el estilo literal del archivo original:**

```sql
ALTER TABLE obra_social.obra_social_prestador ENABLE ROW LEVEL SECURITY;
GRANT ALL ON obra_social.obra_social_prestador TO authenticated;

CREATE POLICY "Read obra_social_prestador" ON obra_social.obra_social_prestador FOR SELECT TO authenticated USING (modulos.tiene_permiso('obra_social', 'read'));
CREATE POLICY "Write obra_social_prestador" ON obra_social.obra_social_prestador FOR ALL TO authenticated USING (modulos.tiene_permiso('obra_social', 'write'));
```

Dos detalles que **no** son cosméticos: (1) el `GRANT` va **explícito por tabla** — el `GRANT ALL ON
ALL TABLES IN SCHEMA obra_social` de `20260724100003:42` es de una sola vez y no alcanza a las tablas
futuras (por eso `plantilla_campo` tuvo que repetirlo en `20260729110000:51`); (2) la policy de
escritura es `FOR ALL` con `USING` y **sin** `WITH CHECK`, igual que las 5 policies ya vigentes del
schema — en `FOR ALL`, PostgreSQL usa la expresión de `USING` también como check de `INSERT`, así que
es semánticamente completa y mantiene el diff legible contra el archivo original.

**Qué lado es dueño de la UI del vínculo: `PrestadorForm`.** El multi-select de **ObrasSociales** vive
en el form de Prestador; `ObraSocialDetail` recibe un panel **de solo lectura** con los prestadores
vinculados. La contracara natural (`ObraSocialForm` gana el selector, que es lo que insinúa el
`proposal.md` §Capabilities) se evaluó y **se descarta**:

| | Editar desde `ObraSocialForm` (descartada) | Editar desde `PrestadorForm` (elegida) |
|---|---|---|
| Camino de escritura existente | RPC `actualizar_obra_social_completa(jsonb)` | `.update()` PostgREST plano (D1) |
| Costo de agregar el vínculo | migrar de nuevo una función **`SECURITY INVOKER`** recién escrita y todavía pendiente de `db push`, **o** romper la atomicidad que D6 fue a buscar | 2 requests extra en un repository nuevo que nadie más consume |
| Radio de daño si falla a mitad | el alta/edición de Obra Social, que sí está en uso | un vínculo re-editable que hoy nadie lee |
| Interacciones reales | ~10 obras sociales × visitar cada form | 1 pantalla, 1 multi-select (hoy hay 1 prestador: la propia empresa) |

Que `ObraSocial` sea la entidad más madura juega **a favor** de esta decisión, no en contra:
justamente porque ya está cableada, testeada y pendiente de aplicar sus migraciones, es la que menos
conviene reabrir. Y direccionalmente el change se trata de que *Prestador* pase a ser entidad de
primer orden: si sus condiciones fiscales (`plazoCobroDias`/`tipoComprobante`) se mudan ahí, "a qué
obras sociales les factura" pertenece a la misma conversación y a la misma pantalla. Ambos sentidos de
la N:N quedan igualmente construibles desde un solo lado (tildar OS1 y OS2 en P1 = un prestador con
varias obras sociales; tildar OS1 en P1 y en P2 = una obra social con varios prestadores).

**Modelo y escritura del vínculo.** El vínculo vive en el tipo de **Prestador**
(`obrasSocialesIds: string[]`), nunca en `ObraSocial` — así el tipo `ObraSocial`, su mapeo, su
`select` y sus dos RPC quedan **intactos**. Lectura por embed en la misma consulta
(`obra_social_prestador ( obra_social_id )`), mismo criterio de una sola consulta que D5 de
`integracion-obra-social`. Escritura **por diff, no por reemplazo**, dentro de `update()`:

```
update(id, cambios)
  ├─ .update(camposPlanos) sobre obra_social.prestadores           (1 request)
  └─ si cambios.obrasSocialesIds !== undefined:
       ├─ .select(obra_social_id) del vínculo actual  → conjunto real del servidor
       ├─ .delete().eq('prestador_id', id).in('obra_social_id', quitados)   (solo si hay)
       └─ .insert(agregados.map(…))                                          (solo si hay)
  └─ getById(id)  → devuelve lo que quedó realmente en la base
```

Diff y no `DELETE`-todo + `INSERT`-todo (que es lo que hace la RPC de Obra Social con su checklist)
por tres razones concretas: el conjunto no está ordenado, así que no hay nada que "reordenar"; una
falla intermedia nunca deja al prestador con **cero** vínculos, solo con el cambio a medio aplicar; y
la auditoría registra exactamente los vínculos que cambiaron en vez de reescribir la tabla entera en
cada guardado. Es el mismo criterio de diff fino de D5 de `integracion-pacientes`.

⚠️ **Esta escritura no es atómica** (PostgREST no da transacciones entre requests). Se acepta *en esta
rama de demo* porque el vínculo todavía no alimenta a nadie (D4 deja Facturación con un fallback
fijo) y porque cualquier estado intermedio se corrige volviendo a guardar. **Si Andrea confirma el
modelo y el vínculo pasa a alimentar la factura general, esto debe convertirse en una RPC
`SECURITY INVOKER`** — condición de disparo escrita acá para que no se decida por omisión.

**Panel de solo lectura en `ObraSocialDetail`.** Se implementa como un método extra del repository de
Prestador (`listarPorObraSocial(obraSocialId)`) consumido por un componente chico
(`PrestadoresDeObraSocial.tsx`), con `PrestadorRepositoryProvider` montado en `ObraSocialesRoute.tsx`
— el composition root es exactamente el lugar donde se conoce una implementación concreta. Con esto,
`shared/types/obraSocial.ts`, `obraSocialMapping.ts` y `SupabaseObraSocialRepository.ts` **no se
tocan por el vínculo** (solo por la baja de 2 campos, D4). Es la pieza de menor prioridad del change:
si hay que recortar para la demo, se recorta esto.

### D3 — Migración aditiva y nada más: el `DROP` no se escribe como archivo ⚠️

**Un solo archivo nuevo**, `supabase/migrations/20260801100000_prestadores_condiciones_y_vinculo.sql`,
enteramente aditivo:

```sql
-- Migration: prestadores_condiciones_y_vinculo
-- Change: prestadores-crud (rama de demo). US-300 literal: "se registra plazo de cobro, tipo de
-- comprobante (A/B/C) y demás condiciones particulares POR PRESTADOR". Supuesto provisorio #3 del
-- proposal, SIN confirmar con Andrea.
--
-- ⚠️ ADITIVA A PROPÓSITO: no dropea ni transforma ninguna columna existente. Las columnas gemelas
-- de obra_social.obra_social quedan en su lugar, sin uso desde el frontend — mismo patrón no
-- destructivo que facturacion.gastos_vehiculos (C-08) y coberturas_paciente.formato_afiliado
-- (20260731140000).
--
-- ⚠️ Se redacta como artefacto de diseño. NO se aplica desde el agente: `supabase db push` es
-- siempre acción explícita de Enzo.

ALTER TABLE obra_social.prestadores
  ADD COLUMN plazo_cobro_dias INT NOT NULL DEFAULT 90,
  ADD COLUMN tipo_comprobante facturacion.tipo_factura NOT NULL DEFAULT 'A';

CREATE TABLE obra_social.obra_social_prestador (
    obra_social_id UUID NOT NULL REFERENCES obra_social.obra_social(id) ON DELETE CASCADE,
    prestador_id   UUID NOT NULL REFERENCES obra_social.prestadores(id)  ON DELETE CASCADE,
    PRIMARY KEY (obra_social_id, prestador_id)
);

CREATE INDEX idx_obra_social_prestador_prestador ON obra_social.obra_social_prestador(prestador_id);

ALTER TABLE obra_social.obra_social_prestador ENABLE ROW LEVEL SECURITY;
GRANT ALL ON obra_social.obra_social_prestador TO authenticated;

CREATE POLICY "Read obra_social_prestador" ON obra_social.obra_social_prestador FOR SELECT TO authenticated USING (modulos.tiene_permiso('obra_social', 'read'));
CREATE POLICY "Write obra_social_prestador" ON obra_social.obra_social_prestador FOR ALL TO authenticated USING (modulos.tiene_permiso('obra_social', 'write'));

CREATE TRIGGER trg_audit_obra_social_prestador AFTER INSERT OR UPDATE OR DELETE ON obra_social.obra_social_prestador FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
```

Tipos tomados 1:1 de las columnas que se están mudando (`INT NOT NULL DEFAULT 90` y el enum
`facturacion.tipo_factura`, no `TEXT` libre — así el CHECK A/B/C viaja gratis). `ADD COLUMN NOT NULL
DEFAULT` sobre Postgres 11+ no reescribe la tabla; y acá ni siquiera aplica, porque `prestadores`
**no tiene filas**: nunca hubo una vía en la app para crear una.

**Nada de backfill, y no es un olvido.** Copiar los valores de cada `obra_social` a "su" prestador es
literalmente imposible hoy: no existe ninguna relación entre las dos tablas hasta que esta misma
migración crea la de vínculo, y esa nace vacía. Los prestadores arrancan con los defaults y se cargan
a mano.

**El `DROP` NO se escribe.** El `proposal.md` es explícito ("⚠️ destructivo — requiere backup y
confirmación explícita de Enzo antes de aplicarse; **no se dropea en este change, solo se documenta
la migración objetivo**"). La decisión concreta es más fuerte que "no aplicarlo": **no se crea el
archivo `.sql`**, porque cualquier archivo bajo `supabase/migrations/` es un arma cargada apuntando a
`supabase db push`. Queda solo documentado acá, como migración objetivo a redactar el día que Andrea
confirme el modelo:

```sql
-- ⚠️⚠️ DESTRUCTIVA — NO EXISTE COMO ARCHIVO A PROPÓSITO ⚠️⚠️
-- Requiere: (1) confirmación de Andrea sobre US-300, (2) confirmación explícita de Enzo,
-- (3) backup previo, (4) verificar que ningún consumidor lee estas columnas.
-- ALTER TABLE obra_social.obra_social DROP COLUMN plazo_cobro_dias;
-- ALTER TABLE obra_social.obra_social DROP COLUMN tipo_comprobante;
-- (modalidad_facturacion y admite_pagos_parciales NO se tocan: son de la obra social pagadora.)
```

**Las dos RPC de Obra Social no necesitan migración, verificado línea por línea.** Cuando
`toCrearObraSocialPayload` deje de mandar esas dos claves: `plazo_cobro_dias` está envuelto en
`COALESCE(…, 90)` (`20260731150000:63`) → inserta 90 y satisface el `NOT NULL`; `tipo_comprobante` es
`NULLIF(p_os ->> 'tipo_comprobante','')::facturacion.tipo_factura` (línea 62) → inserta `NULL`, y la
columna **es nullable** (nació `tipo_factura TEXT` sin `NOT NULL` y `20260729110000` solo le cambió el
tipo). En la edición, ambas usan `CASE WHEN p_cambios ? '…'` → clave ausente = no tocar. **Ninguna de
las dos rompe.** Las columnas simplemente quedan vestigiales (90 / `NULL`) hasta el drop.

### D4 — Facturación: fallback fijo con constante nombrada, marcado como provisorio ⚠️ PROVISORIO

Al sacar los 2 campos de `ObraSocial` quedan **cuatro** consumidores reales, no uno. El
`proposal.md` §Impacto solo listó `FacturaForm.tsx:120`; los otros tres aparecieron al leer el
código y son parte obligatoria del alcance:

| Consumidor | Hoy | Diseño |
|---|---|---|
| `features/facturacion/FacturaForm.tsx:118-122` | `useEffect` que precarga `tipoComprobante` desde `obraSocial.tipoComprobante` al elegir paciente | **se borra el `useEffect` entero** (5 líneas). `valoresPorDefecto()` ya inicializa el campo y el `<Select>` sigue editable a mano |
| `features/facturacion/FacturaForm.tsx:32` | `tipoComprobante: 'A'` literal suelto | pasa a `tipoComprobante: TIPO_COMPROBANTE_DEFAULT` |
| `features/facturacion/useEmisionFactura.ts:73` | `plazoObraSocial: obraSocial?.plazoCobroDias` | `plazoObraSocial: undefined` — `calcularFechaEstimadaCobro` **ya** cae en `PLAZO_COBRO_DEFAULT_DIAS` (90) por esa rama, sin tocar la función pura ni sus tests |
| `features/facturacion/FacturaResumen.tsx:25-31` | `motivoPlazo()` con rama "plazo propio de {nombre}" | se borra esa rama: quedan amparo judicial (45) y plazo general (90) |

**Dónde vive la constante.** En `shared/lib/facturacion/constantes.ts`, que es el dueño establecido de
los umbrales de facturación (`PLAZO_COBRO_DEFAULT_DIAS = 90`, `PLAZO_COBRO_AMPARO_DIAS = 45`,
`PLAZO_ALERTA_VENCIDA_DIAS`) y ya tiene el estilo de doc-comment "regla + a confirmar":

```ts
/**
 * ⚠️ PROVISORIO — supuesto #5 del proposal, SIN resolver. RN-FA-07 dice que el tipo de comprobante
 * depende de la relación con la obra social; hasta que se decida qué Prestador aplica al facturar,
 * el formulario arranca en 'A' y el operador lo corrige a mano. NO es la resolución de RN-FA-07:
 * es el marcador de que falta resolverla. Ver design.md D4 de prestadores-crud.
 */
export const TIPO_COMPROBANTE_DEFAULT: TipoComprobante = 'A';
```

Se llama `TIPO_COMPROBANTE_DEFAULT` y no `DEFAULT_TIPO_COMPROBANTE` para seguir el orden de las tres
constantes que ya viven en ese archivo. El `DEFAULT_TIPO_COMPROBANTE` privado de `obraSocialMapping.ts`
es otra cosa (fallback de parseo de una columna) y **se muda a `prestadorMapping.ts`** con la columna.

**Regresión aceptada y visible**: si una obra social facturaba en B, el operador ahora tiene que
elegir B a mano en cada factura nueva. Es exactamente lo que el `proposal.md` pide ("default fijo
documentado como provisorio, en vez de construir la selección real") y **el comentario de la
constante es el lugar donde queda registrado**, no un `// TODO` suelto. Los comentarios de
`FacturaForm.tsx:47` y `:71-72` (que hoy dicen "precargado desde la obra social") se actualizan en el
mismo commit; dejarlos mintiendo sería peor que el cambio en sí.

### D5 — Ruta propia `/prestadores`, gateada con el módulo `obra_social` ya existente

Ruta propia, no pestaña dentro de `/obras-sociales`: son dos maestros con ciclo de vida
independiente, y el patrón list+detail de la app asume una página por entidad. Cambios exactos:

- `app/routes.ts`: entrada nueva en `APP_ROUTES` con `section: 'Operación'` y **`modulo: 'obra_social'`**
  — no se crea ni se siembra un módulo `prestadores`. La RLS real de la tabla ya está fija a ese
  módulo; inventar uno nuevo obligaría a reescribir policies de una tabla en producción sin ninguna
  razón. Consecuencia esperada y correcta: las dos entradas de sidebar aparecen y desaparecen juntas,
  y `moduloDeRuta('/prestadores')` resuelve sin tocar `RequireAuth`.
- `app/navIcons.tsx` + `IconKey`: ícono propio (mismas primitivas SVG 24x24 `currentColor` del resto).
- `app/router.tsx`: entrada en `ELEMENT_POR_RUTA` → `<PrestadoresRoute />`, igual que los otros 8.
- `app/AppShell.test.tsx`: las aserciones sobre la lista de navegación pasan de 8 a 9 entradas.

### D6 — Tests: mapeo puro exhaustivo + repository contra un fake tipado (mismo molde que D10)

1. `prestadorMapping.test.ts` — funciones puras, sin mocks: renombre `razon_social`→`razonSocial`,
   NULLables → `undefined`, `tipo_comprobante` fuera de `'A'|'B'|'C'` → default, `plazo_cobro_dias`
   no numérico → 90, embed de vínculo ausente/malformado → `[]` sin romper el prestador, y la
   semántica parcial de `toActualizarPrestadorPayload` (clave ausente ≠ clave con `[]`).
2. `SupabasePrestadorRepository.test.ts` — `vi.mock('../supabaseClient')` con fake tipado a mano
   (interfaces propias, cero `any`, cero `as`) que **registra** las llamadas. Aserción clave del
   change: que `update()` con `obrasSocialesIds` sin cambios reales **no emite ningún `.delete()` ni
   `.insert()`** sobre el vínculo (es la prueba del diff de D2), y que un cambio parcial solo toca
   los ids agregados/quitados.
3. Componentes con React Testing Library, espejando `ObraSocialForm.test.tsx` /
   `ObrasSocialesList.test.tsx`, incluido el estado de solo lectura.
4. **Sin harness de SQL** (el repo sigue sin pgTAP ni Supabase local): la verificación de la RLS del
   vínculo con cuentas reales es **tarea manual explícita** de `tasks.md`, no algo que este design
   resuelva. Tercera vez consecutiva — ver §Open Questions.

---

## Data flow

```
PrestadoresRoute (único que conoce supabasePrestadorRepository)
  └─> PrestadorRepositoryProvider
        └─> PrestadoresPage ── usePrestadores(repository) ── loading/error/crear/actualizar
              ├─> PrestadoresList          (grid + búsqueda local)
              └─> PrestadorDetail
                    └─> PrestadorForm  ──multi-select de ObrasSociales──┐
                                                                        │
  repository.update(id, cambios)                                        │
    ├─ UPDATE obra_social.prestadores            ← RLS write            │
    └─ diff sobre obra_social_prestador          ← RLS write  ──────────┘
         (DELETE solo quitados / INSERT solo agregados)

ObraSocialesRoute
  └─> ObraSocialDetail
        └─> PrestadoresDeObraSocial  (solo lectura, listarPorObraSocial)
```

---

## Risks / Trade-offs

1. **[La escritura del vínculo no es atómica]** → dos requests sin transacción: una falla entre el
   `DELETE` y el `INSERT` deja el vínculo a medio aplicar. *Mitigación*: diff en vez de reemplazo (el
   estado intermedio nunca es "cero vínculos"), re-guardar corrige, nadie consume todavía el vínculo,
   y D2 deja escrita la condición de disparo para convertirlo en RPC `SECURITY INVOKER`.
2. **[Sacar 2 campos de `ObraSocial` toca ~30 archivos]** → `plazoCobroDias` aparece 59 veces en 31
   archivos; la mayoría son fixtures y literales `ObraSocial` en tests, y TypeScript strict marca
   cada uno como propiedad excedente. *Mitigación*: correr `npx vitest run` **antes** de tocar nada
   para tener baseline, y hacer la baja de campos en una fase propia y anterior al CRUD nuevo, de
   modo que el árbol nunca quede a mitad de camino.
3. **[Facturación pierde el tipo de comprobante real]** → riesgo asumido y explícito del change: una
   factura mal tipada es un problema fiscal, no cosmético. *Mitigación*: `TIPO_COMPROBANTE_DEFAULT`
   con el comentario ⚠️ PROVISORIO, el campo sigue editable en el form, y el supuesto #5 queda
   abierto como bloqueante del futuro `desacople-prestacion-factura`.
4. **[La migración no se aplica y la pantalla queda rota]** → `PGRST205` (tabla de vínculo
   inexistente) y `PGRST204` (columnas nuevas inexistentes). *Mitigación*: ambos códigos tienen
   mensaje propio en castellano en `mapearErrorPrestador`, y aplicar la migración es tarea
   **bloqueante** y previa al cableado en `tasks.md`.
5. **[Desfasaje conocido del historial de migraciones]** → `integracion-pacientes` 1B.3 registró 12
   versiones aplicadas al remoto sin commitear; un `db push` puede fallar con "ya existe".
   *Mitigación*: `supabase migration list --linked` **antes** de aplicar, y `supabase migration repair
   --status applied` documentado como salida.
6. **[Dos CUITs cargables al mismo tiempo]** → el supuesto #2 no se resuelve, se vuelve más visible y
   más fácil de cargar mal. *Mitigación*: `AvisoModeloDatos` en `PrestadorDetail.tsx` con el mismo
   texto que ya está en `ObraSocialDetail.tsx`, apuntando a la misma pregunta abierta.
7. **[Andrea rechaza el modelo tras la demo]** → toda la mudanza de columnas se revierte.
   *Mitigación*: cero migraciones aplicadas, cero columnas dropeadas, rollback = borrar la rama.
8. **[Colisión con `integracion-facturacion`]** → ese change en curso asume que las condiciones de
   facturación viven en `ObraSocial`. *Mitigación*: queda anotado como dependencia a revisar antes de
   que cierre sus 5 aprobaciones pendientes; este change no toca sus archivos.
9. **[El fake del query builder se desincroniza de supabase-js]** → tests verdes contra una API que
   cambió. *Mitigación*: mismo fake mínimo ya usado en Obras Sociales, y consultar el changelog de
   Supabase antes de implementar.

---

## Migration Plan

1. Baseline: `cd frontend && npx vitest run` y registrar el número de tests **antes** de tocar nada.
2. Escribir `20260801100000_prestadores_condiciones_y_vinculo.sql`. **No aplicarla.**
3. Verificar el historial (`supabase migration list --linked`) y aplicar — **lo hace Enzo, no el
   agente**. Bloquea el paso 6.
4. Fase "tipos y baja de campos", enteramente sobre lo existente: `prestador.ts` nuevo; `obraSocial.ts`
   pierde 2 campos; los 4 consumidores de D4; fixtures y tests. Punto de corte limpio: al terminar, la
   app funciona igual salvo el default de comprobante.
5. Fase "repository de Prestador" por TDD estricto: mapping puro → repository → tests. Nadie los
   importa todavía.
6. Fase "pantalla": context, hook, page, list, detail, form, validación, ruta e ícono. **El corte
   real** es el commit de `PrestadoresRoute.tsx`.
7. Vínculo N:N: multi-select en `PrestadorForm`, diff en el repository, panel de solo lectura en
   `ObraSocialDetail` (lo primero que se recorta si hay que recortar).
8. Verificación manual con cuentas reales: `obra_social: write` → alta + vínculo; `read` sin `write` →
   `42501` y la UI en solo lectura; sin permiso → la ruta no aparece.
9. Documentación: pregunta #5 en `knowledge-base/10_preguntas_abiertas.md`, y la nota de "condiciones
   por prestador" en `04_modelo_de_datos.md` §Discrepancias pasa de "resuelta en ObraSocial" a "movida
   a Prestador, provisorio".

**Rollback**: borrar la rama. Si la migración ya se aplicó y hay que limpiar:
`DROP TABLE obra_social.obra_social_prestador` + `ALTER TABLE obra_social.prestadores DROP COLUMN` × 2.
**Ningún dato existente se transforma ni se borra en ningún paso.**

---

## Open Questions

**Los 5 supuestos del `proposal.md`, sin resolver (se arrastran tal cual, no se cierran acá):**

1. **¿Prestador se relaciona con ObraSocial, y cómo?** → supuesto provisorio de esta rama: **N:N**
   (confirmado con Enzo, 2026-08-01), tabla de vínculo, no FK simple. Sin confirmar con Andrea.
2. **¿Qué representa `prestadores.cuit` frente a `obra_social.cuit`?** → **sigue sin resolver**.
   Construir esta pantalla no la resuelve: la vuelve visible en dos lugares.
3. **¿"condiciones particulares por prestador" (US-300) vive en Prestador o en ObraSocial?** → se
   mueven **solo** `plazoCobroDias` y `tipoComprobante` (lectura literal de US-300, confirmado con
   Enzo); `modalidadFacturacion`/`admitePagosParciales` se quedan en ObraSocial. Sin confirmar con Andrea.
4. **¿Alcance de esta primera versión?** → los 4 campos existentes + los 2 movidos.
5. **Si una ObraSocial tiene varios Prestadores, ¿cuál aplica al generar una factura general?** →
   **explícitamente abierta**. Bloqueante real del futuro `desacople-prestacion-factura`, no de este
   CRUD. Es la razón de que D4 sea un fallback fijo.

**Preguntas técnicas nuevas, surgidas de este diseño:**

- **¿El `ON DELETE CASCADE` del vínculo es lo que Andrea espera operativamente?** Técnicamente es
  correcto (D2), pero implica que borrar un prestador desvincula en silencio todas sus obras sociales.
  Hoy no hay ningún `delete()` en la app, así que la pregunta es teórica — deja de serlo el día que se
  agregue baja de prestadores. **Decisor**: producto, antes de construir esa baja.
- **¿La escritura del vínculo debe volverse una RPC `SECURITY INVOKER`?** D2 la deja como diff
  multi-request con condición de disparo escrita. **Decisor**: equipo técnico, cuando el vínculo pase
  a alimentar la factura general.
- **¿Quién carga los prestadores reales?** La tabla está vacía desde 2026-07-24. ¿Es un seed, o carga
  manual en la demo? Si es seed, es una decisión de datos, no de código. **Decisor**: usuaria.
- **¿Se monta pgTAP (o `supabase start`)?** Tercer change consecutivo que verifica RLS/SQL a mano.
  `integracion-pacientes` 1B.5 lo dejó pendiente "antes del segundo change de integración" y ya vamos
  por el tercero. **Decisor**: equipo técnico. No se monta acá.
- **¿Qué pasa con las columnas vestigiales de `obra_social`?** Tras este change, `plazo_cobro_dias`
  queda en 90 y `tipo_comprobante` en `NULL` para toda obra social nueva, sin que nadie las lea (D3).
  Es el patrón no destructivo acordado, pero acumula la tercera columna abandonada del proyecto
  (`gastos_vehiculos`, `coberturas_paciente.formato_afiliado`, y ahora estas dos). **¿Conviene una
  tanda de limpieza única cuando el modelo se confirme?** **Decisor**: Enzo.
