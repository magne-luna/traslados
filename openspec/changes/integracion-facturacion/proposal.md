## Why

El frontend de Facturación está completo (listado, formulario, asistencias embebidas, selector de
días facturables, alerta de cupo, circuito de estados, panel de cobros, checklist documental y vista
imprimible — archivado como `facturacion-ui`, `openspec/changes/archive/2026-07-27-facturacion-ui/`,
61/61 tasks) pero **habla con `mockFacturaRepository` y `mockCobroRepository`**: dos fixtures en
`localStorage` con latencia simulada.

Este es el change **4 de la serie de integración por módulo** (`CHANGES.md` §Plan de integración
Backend↔Frontend, fila 4: *"Facturación (C-07) — ⏳ pendiente. Depende de Obra Social"*), después de
`integracion-pacientes`, `integracion-obra-social` e `integracion-conductores-vehiculos`. La
dependencia de Obra Social está satisfecha: `integracion-obra-social` ya dejó real la plantilla de
factura y el `identificador_origen` por obra social que Facturación consume.

**⚠️ GOVERNANCE CRÍTICO.** Facturación es el equivalente a *Billing* en la tabla de gobernanza del
proyecto: **cero código de aplicación sin aprobación humana explícita**. Este propose es
íntegramente análisis y documentación. Ninguna decisión de este documento habilita el apply por sí
sola — ver `design.md` §Aprobaciones requeridas.

**Hallazgo que reescribe la premisa de arranque.** Se verificó el schema `facturacion` **real** contra
el proyecto vinculado (`supabase db query --linked`, 2026-07-31, mismo método que
`integracion-obra-social`). Resultado: **4 de las 5 discrepancias con el docx que `CHANGES.md` §C-07
declara bloqueantes ya fueron absorbidas por backend** — existen `facturacion.asistencia_prestacion`,
`facturacion.documento_factura`, `facturas.cantidad_km`, `facturas.fecha_estimada_cobro`,
`facturas.mes_facturado`, `facturas.anio_facturado`, `facturas.prestacion`,
`facturas.dependencia_y_retorno`, `facturas.domicilio_id`, `facturas.identificador_origen` y
`facturas.identificador_valor`, todas con RLS, GRANT y triggers de auditoría aplicados, y ninguna de
ellas está en `supabase/migrations/20260724100005_schema_facturacion.sql`. Es el **tercer change
consecutivo de esta serie** que encuentra el schema real por delante de lo que el repo documenta.

Lo que falta **no** es el schema: es **una columna** (`facturas.fecha_factura`), los **índices de
todas las FK** del schema (no existe ni uno), y las **funciones de escritura atómica**. Este change
es un swap sobre un schema vivo y casi completo, no una creación.

## What Changes

### 1. Frontend — el swap (el corazón del change)

- **`SupabaseFacturaRepository.ts`** nuevo en `frontend/src/shared/lib/facturacion/`, cumpliendo
  `FacturaRepository` **sin cambiarle una firma** (`list`, `getById`, `listByPaciente`, `create`,
  `update`).
- **`SupabaseCobroRepository.ts`** nuevo, cumpliendo `CobroRepository` (`list`, `listByFactura`,
  `create`, `remove`). **No es scope inflado**: dejar los cobros en `localStorage` mientras las
  facturas son reales rompe `estadoDerivadoFactura` y `saldoPendiente` (los cobros del mock
  referencian ids de fixture que ya no existen). Ver `design.md` D6.
- **`facturaMapping.ts`** nuevo: todo el mapeo fila↔dominio como funciones puras con type guards
  sobre `unknown` (nunca `any`, nunca `as`), testeable sin red. Mismo criterio que
  `obraSocialMapping.ts` y `pacienteMapping.ts`.
- **Un solo archivo de producto cambia el cableado**: `FacturacionRoute.tsx` (composition root).
  Ningún componente, hook ni context de `features/facturacion/` se toca por el swap.
- **Los mocks NO se borran**: siguen como dobles de test y para desarrollo sin backend.

### 2. Backend — una migración aditiva mínima + una de funciones

- **`supabase/migrations/2026XXXXXXXXXX_factura_fecha_emision_indices.sql`** (expand, aditivo,
  ninguna columna existente se altera ni se borra):
  - `facturacion.facturas` gana **`fecha_factura DATE`** (nullable). Es la **única** columna que
    falta de verdad. Hoy `Factura.fechaFactura` no puede persistirse, y sin ella **RF-406** (alerta
    de factura vencida sin cobro a los 60 días) y la tarjeta de mora de **C-11** no tienen fecha de
    referencia. Ver `design.md` D3.
  - **Índices sobre las FK del dominio de Facturación**: `facturas.paciente_id`,
    `facturas.domicilio_id`, `cobros.facturas_id`, `asistencia_prestacion.factura_id`,
    `documento_factura.factura_id`, `documento_factura.id_tipo_documento`. **Hoy no existe ni un
    índice en todo el schema `facturacion` fuera de las PK** — verificado contra `pg_indexes`. Es la
    regla de `database-schema-design` (índice en toda FK) y el embed de asistencias filtra por
    `factura_id` en cada lectura de factura.
- **`supabase/migrations/2026XXXXXXXXXX_factura_rpc.sql`**: dos funciones **`SECURITY INVOKER`**,
  `facturacion.crear_factura_completa(jsonb) RETURNS uuid` y
  `facturacion.actualizar_factura_completa(uuid, jsonb) RETURNS uuid`. Una factura y sus asistencias
  se declaran y facturan juntas (`AsistenciaPrestacion` embebida, sin repository propio) y PostgREST
  no da transacción entre requests. Mismo patrón exacto, y misma prohibición explícita de
  `SECURITY DEFINER`, que `pacientes.crear_paciente_completo` y las dos RPC de
  `integracion-obra-social`, ya aplicadas y verificadas.

### 3. Los 4 defaults de negocio se HEREDAN, no se re-deciden

`knowledge-base/10_preguntas_abiertas.md` §"Defaults implementados por `facturacion-ui`" documenta
cuatro preguntas de prioridad **Alta** que el frontend resolvió con defaults reversibles. **Este
change las hereda tal cual y no cierra ninguna** (confirmado explícitamente por la usuaria):

| Pregunta abierta | Default heredado | Dónde vive ya |
|---|---|---|
| Identificador de la factura (IN-01) | `obraSocial.plantillaFactura.identificadorOrigen`, configurable por obra social | columna `obra_social.identificador_origen` (existe) + `facturas.identificador_origen`/`identificador_valor` (existen) |
| Período de facturación (RF-400) | estructurado: `mesFacturado` 1-12 + `anioFacturado`, numéricos | columnas `facturas.mes_facturado` (con `CHECK 1..12`) y `anio_facturado` (existen) |
| Plazos de cobro (90/60/45) y precedencia amparo > obra social > default | constantes en `frontend/src/shared/lib/facturacion/constantes.ts` + `obra_social.plazo_cobro_dias` | sin cambios en este change |
| Integración ARCA | **cero** integración automática; carga manual como ítem del checklist documental | `FacturaDocumentos.tsx`, sin cliente HTTP ni variables de entorno |

El swap de backend **hereda el default, no lo convierte en definitivo**. Las cuatro siguen abiertas
en la KB después de este change.

### 4. Lo que este change NO hace

- **NO construye la pantalla de Facturación** — ya existe (`facturacion-ui`, archivado).
- **NO swapea `documento_factura`.** `FacturaDocumentos.tsx` consume `mockDocumentoRepository`
  (uploads simulados), y el reemplazo de documentos + Storage es la **fila 8** del plan de
  integración, con su propio change. La tabla real existe y queda intacta y sin usar. Ver
  `design.md` D8.
- **NO swapea `presupuesto` ni `autorizacion`.** Son de `C-06`, **bloqueado** (`CHANGES.md` fila 5).
  La validación de cupo sigue leyendo autorizaciones del mock — con una consecuencia nueva y no
  obvia que este change descubre y documenta (`design.md` D9, ⚠️ CHECKPOINT).
- **NO integra ARCA.** Cero cliente HTTP, cero variables de entorno, cero endpoints.
- **NO resuelve ninguna pregunta abierta de prioridad Alta** (ver punto 3).
- **NO mueve ninguna regla de negocio a SQL.** `calcularFechaEstimadaCobro`, `diasFacturables`,
  `validarCupoFacturacion`, `estadoDerivadoFactura` y las demás 9 funciones puras siguen siendo la
  única implementación. Duplicarlas en Postgres crearía dos fuentes de verdad.
- **NO agrega `NOT NULL` a ninguna columna existente** (ver `design.md` D11).
- **NO monta pgTAP ni Supabase local.** La pregunta sigue abierta y este change la vuelve más cara.
- **NO introduce TanStack Query.**

## Capabilities

### New Capabilities

- `factura-repository-supabase`: implementación real de `FacturaRepository` y `CobroRepository`
  contra el schema `facturacion` — lectura con embed de asistencias en una sola consulta, alta y
  edición atómicas vía funciones `SECURITY INVOKER`, mapeo bidireccional del enum de estado (que en
  la base tiene un literal que el frontend no modela), traducción de errores de PostgREST a
  castellano, consumo (nunca duplicación) de las policies de RLS existentes, e inyección en el
  composition root.

### Modified Capabilities

- `factura-contract`: el contrato de errores del repository pasa a ser **normativo** (dos
  implementaciones deben coincidir); "Implementaciones mock con persistencia en localStorage" deja de
  ser la implementación inyectada en la app; el requisito de señalización de discrepancias se
  actualiza porque **4 de las 5 ya no existen**.
- `factura-estados-circuito`: la fecha de emisión pasa a persistirse en una columna real
  (`fecha_factura`); el estado persistido pasa por un mapeo bidireccional contra un enum de Postgres
  que incluye un literal (`pendiente`) que el frontend no modela.
- `cobro-registro`: la persistencia de cobros pasa de `localStorage` a `facturacion.cobros`, con
  borrado real y gateo por RLS.
- `factura-cupo-validacion`: se agrega el requisito de que la validación de cupo, mientras
  Presupuestos siga en mock, opera sobre **fuente mixta** (facturas reales + autorizaciones de
  fixture) y eso debe ser visible, no silencioso.

## Impact

**Código nuevo**
- `frontend/src/shared/lib/facturacion/facturaMapping.ts` + `.test.ts`
- `frontend/src/shared/lib/facturacion/SupabaseFacturaRepository.ts` + `.test.ts`
- `frontend/src/shared/lib/facturacion/SupabaseCobroRepository.ts` + `.test.ts`

**Código modificado**
- `frontend/src/features/facturacion/FacturacionRoute.tsx` (**el swap**, única línea de cableado)
- `frontend/src/features/facturacion/FacturacionRoute.test.tsx` (dobles inyectados)
- `frontend/src/features/facturacion/FacturaAvisoDiscrepancias.tsx` (4 de 5 discrepancias se
  retiran; se suma la de `fecha_factura` y la de fuente mixta del cupo)

**Base de datos**
- `2026XXXXXXXXXX_factura_fecha_emision_indices.sql` (**nuevo**, aditivo: 1 columna + 6 índices)
- `2026XXXXXXXXXX_factura_rpc.sql` (**nuevo**, dos funciones `SECURITY INVOKER`)
- **Las aplica la usuaria / backend (Enzo)**, no el agente — regla de governance, no límite técnico.

**Documentación**
- `knowledge-base/04_modelo_de_datos.md` §Discrepancias — bloque nuevo "Facturación vs. esquema real
  de `C-07`": **cierre** de 4 discrepancias documentadas y **apertura** de 3 nuevas.
- `knowledge-base/10_preguntas_abiertas.md` — actualizar el conteo acumulado de la pregunta de
  pgTAP (pasa a 4 changes / 5 funciones) y sumar las preguntas nuevas.
- `CHANGES.md` §`C-07` (el bloque ⚠️ de 5 puntos se reescribe), §`C-11` (2 de sus 4 discrepancias se
  cierran) y §Plan de integración (fila 4 → estado real).
- `ROADMAP-FRONTEND.md`

**Sin impacto**
- `FacturaRepository.ts` y `CobroRepository.ts` (las interfaces), `FacturaRepositoryContext.tsx`,
  `CobroRepositoryContext.tsx`, `useFacturas.ts`, `useCobros.ts`, `useEmisionFactura.ts`, las 9
  funciones puras de reglas de negocio y sus tests, `FacturaForm`, `FacturaDetail`, `CobrosPanel`,
  `FacturaImprimible`, `AsistenciasEditor`, `DiasFacturablesSelector`, `AlertaCupo`,
  `FacturaDocumentos` — sin cambios.
- `frontend/src/shared/types/factura.ts` — **no cambia**. El tipo ya modela todo lo que la base
  tiene.
- Ninguna migración existente se edita. `facturacion.presupuesto`, `facturacion.autorizacion`,
  `facturacion.documento_factura` y `facturacion.gastos_vehiculos` quedan intactas.

**Dependencias**
- Requiere (ya cumplido): `C-01`, `C-02` + `auth-frontend-real`, `permisos-modulos-granulares` (el
  módulo `facturacion` existe en `modulos.modulos`, verificado), `integracion-obra-social` (la
  plantilla de factura y el `identificador_origen` reales), `integracion-pacientes` (paciente y
  direcciones reales, para `paciente_id` y `domicilio_id`), y
  `20260724100005_schema_facturacion.sql` + las columnas/tablas aplicadas fuera de historial.
- **NO requiere que `C-06` (Presupuestos) esté integrado.** La validación de cupo sigue en mock por
  decisión explícita (D9), no por bloqueo técnico.
- Habilita: `C-11` (Dashboard), que necesita facturas y cobros reales para las tarjetas de mora y el
  reporte facturado-vs-cobrado.

**Riesgo y rollback**
- Riesgo #1: **`facturas.fecha_factura` no existe**. Sin la migración, `fechaFactura` no round-trips
  y la alerta de vencimiento (RF-406) queda muda contra datos reales. Es la única dependencia dura de
  este change sobre backend.
- Riesgo #2: **el enum real tiene `pendiente`, el frontend no**. Una fila cargada fuera de la app con
  ese estado tiene que leerse sin romper. Mitigado con mapeo explícito y test dedicado.
- Riesgo #3: **fuente mixta en la validación de cupo** (facturas reales × autorizaciones de fixture).
  Puede alertar de más o de menos sin que nada falle. Es un ⚠️ CHECKPOINT (D9), no una decisión
  tomada por el agente.
- Riesgo #4: convertir cualquiera de las dos funciones a `SECURITY DEFINER` bypassearía el gateo por
  módulo sobre datos **financieros**. Mitigado en cuatro capas (design, cabecera de la migración,
  `COMMENT ON FUNCTION`, y test automatizado del texto del `.sql`).
- **Rollback**: revertir `FacturacionRoute.tsx` a los mocks (dos imports y dos props). Las
  migraciones son aditivas: `fecha_factura` queda nullable y nadie la lee, los índices no cambian
  semántica, y las funciones sin llamador son inertes. **Ningún dato existente se transforma ni se
  borra en ningún paso.** Las seis tablas de `facturacion` tienen **0 filas** hoy (verificado), así
  que ni siquiera hay dato de producción en riesgo al aplicar.
