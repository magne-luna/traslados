## Why

`obra_social.prestadores` existe en la base real desde el 2026-07-24, sin FK a ninguna otra
tabla, sin tipo, repository ni pantalla en el frontend — Prestador está completamente sin
modelar (D8 de `integracion-obra-social`: "prestadores-crud queda como change propio").

Al revisar este proposal con Enzo (2026-08-01) surgió algo más grande que un CRUD simple: US-300
dice literalmente **"Se registra plazo de cobro, tipo de comprobante (A/B/C) y demás condiciones
particulares **por prestador**"** — pero `plazoCobroDias`/`tipoComprobante` ya están implementados
como columnas de `obra_social.obra_social` (migración C-04 de esta mañana), no de
`obra_social.prestadores`. Es la misma clase de discrepancia que RF-106 (formato de afiliado): la
palabra literal del requisito apunta a una entidad, y lo implementado quedó en otra, sin que nadie
chequeara la palabra exacta. `modalidadFacturacion` y `admitePagosParciales`, en cambio, son
preferencias de la obra social pagadora, no condiciones del prestador (confirmado con Enzo) — se
quedan donde están.

**⚠️ Esto es una rama de demo, no un diseño confirmado.** Todo el trabajo vive en
`feature/prestadores-crud` para mostrarle el concepto a Andrea; recién después se decide si va a
`main`. Las decisiones de modelo de abajo son **provisorias**, tomadas en conversación con Enzo
para poder mostrar algo funcionando — no son respuestas de la clienta.

## ⚠️ Supuestos provisorios — SIN confirmar con Andrea

> **Supuesto provisorio para esta rama de demo — SIN confirmar con Andrea. No mergear a main sin
> validar esto primero.**

| # | Pregunta abierta | Supuesto provisorio de esta rama |
|---|---|---|
| 1 | ¿Prestador se relaciona con ObraSocial, y cómo? | **N:N** (confirmado con Enzo, 2026-08-01): una ObraSocial puede tener varios Prestadores, y un Prestador puede atender varias ObrasSociales. Requiere tabla de vínculo, no una FK simple. |
| 2 | ¿Qué representa `prestadores.cuit` frente a `obra_social.cuit`? | **Sigue sin resolver.** Construir esta pantalla no la resuelve — la vuelve visible en dos lugares (dos CUITs cargables) sin que quede claro cuál es cuál. |
| 3 | ¿"condiciones particulares por prestador" (US-300) vive en Prestador o en ObraSocial? | **Se mueven a Prestador solo `plazoCobroDias` y `tipoComprobante`** (confirmado con Enzo, lectura literal de US-300). `modalidadFacturacion` y `admitePagosParciales` **se quedan en ObraSocial** — son preferencias de la obra social pagadora (cómo quiere que le facturen, si admite pagos parciales), no condiciones fiscales del prestador (confirmado con Enzo). Ver Impacto — esto es un cambio de columnas real, no solo de UI. |
| 4 | ¿Alcance de esta primera versión? | Los 4 campos ya existentes (razón social, CUIT, dirección, teléfono) **más** los 2 campos movidos desde ObraSocial (supuesto #3). |
| 5 | **Nueva, surgida de mover #3**: si una ObraSocial tiene varios Prestadores (N:N), ¿cuál Prestador aplica al generar una factura general? | **Sin decidir — explícitamente abierta.** Enzo: "si es facturación general todavía no sé cómo manejarlo, pero entiendo que se completa en facturación" — la lectura de trabajo es que se **elige a mano al generar la factura general** (no hay vínculo fijo Paciente↔Prestador), pero esto NO está confirmado ni con Andrea ni completamente con Enzo. **Bloqueante real para el futuro change de "factura general"** (`desacople-prestacion-factura`), no para este CRUD en sí — este change solo necesita que el vínculo N:N exista y sea navegable, no resolver la selección al facturar. |

## What Changes

### 1. Prestador pasa a ser entidad de primer orden en el frontend

- **`prestador.ts`** nuevo en `frontend/src/shared/types/`: `Prestador` con `id`, `razonSocial`,
  `cuit`, `direccion?`, `telefono?` **más** `plazoCobroDias`, `tipoComprobante` (movidos desde
  `ObraSocial`, supuesto #3). `modalidadFacturacion`/`admitePagosParciales` no se mueven — se
  quedan en `ObraSocial`.
- **`PrestadorRepository`** + **`SupabasePrestadorRepository`**: CRUD directo sin RPC
  (`.insert()`/`.update()` de PostgREST — sin tablas hijas, sin problema de atomicidad, mismo
  criterio que los campos planos de `paciente`).
- **`features/prestadores/`**: ruta + listado + form, espejando el patrón completo de
  `features/obras-sociales/` (repository interface, mapping puro, composition root, list+detail,
  form sin librería — 4-8 campos no justifican React Hook Form/Zod).
- Ruta gateada con `modulo: 'obra_social'` (ya existente) — no se crea un módulo `prestadores`
  nuevo; la RLS real de `obra_social.prestadores` ya está fija a ese módulo.
- **Vínculo N:N** con ObraSocial: selector multi-choice en `ObraSocialForm`/`PrestadorForm`
  (a definir en `design.md` cuál lado es dueño de la UI de vínculo) sobre una tabla de vínculo
  nueva (ver Impacto).

### 2. `ObraSocial` pierde 2 de las 4 columnas de condiciones de facturación

- `formatoAfiliado` (RF-106, ya resuelto hoy) **se queda** en ObraSocial — no forma parte de esta
  discrepancia, es un caso distinto.
- `modalidadFacturacion` y `admitePagosParciales` **se quedan** en ObraSocial — son preferencias
  de la obra social pagadora, no condiciones fiscales del prestador.
- `plazoCobroDias` y `tipoComprobante` **se sacan** de `ObraSocial` y pasan a `Prestador`. Esto
  rompe cualquier lugar que hoy lea esos campos desde `ObraSocial` (ver Impacto —
  `FacturaForm.tsx` es el consumidor real más importante para `tipoComprobante`).

### 3. Lo que este change NO hace

- **NO resuelve la ambigüedad del CUIT** (supuesto #2) — la deja más visible, no la cierra.
- **NO resuelve qué Prestador aplica al facturar en modo general** (supuesto #5) — eso es alcance
  del futuro change `desacople-prestacion-factura`/"factura general", que deberá leer este
  proposal como contexto previo antes de proponer su solución.
- **NO escribe ninguna migración real contra Supabase** — el schema nuevo (columnas movidas +
  tabla de vínculo) se documenta acá y en `design.md`, pero no se aplica (`supabase db push` queda
  a cargo de Enzo, como el resto de las migraciones de esta sesión).
- **NO toca `integracion-facturacion`** (el change en curso de swap de backend real de
  Facturación) directamente — pero si "condiciones de facturación en Prestador" se confirma con
  Andrea, ese change va a necesitar coordinarse antes de cerrar sus propias 5 aprobaciones
  pendientes, porque hoy asume que esos campos viven en ObraSocial.

## Capabilities

### New Capabilities

- `prestador-contract`: tipo `Prestador` con identidad propia, incluidas las condiciones de
  facturación movidas desde ObraSocial (supuesto #3), señalizado como provisorio.
- `prestador-crud`: pantalla de listado/alta/edición de Prestador, gateada por el módulo
  `obra_social` existente.
- `obra-social-prestador-vinculo`: relación N:N entre ObraSocial y Prestador — tabla de vínculo +
  UI mínima para asociar/desasociar, sin resolver todavía la selección al facturar (supuesto #5).

### Modified Capabilities

- `obra-social-contract`: `ObraSocial` pierde `plazoCobroDias`/`tipoComprobante` (supuesto #3);
  conserva `modalidadFacturacion`/`admitePagosParciales`.
- `obra-social-crud` (`ObraSocialForm.tsx`): el formulario deja de pedir esos 2 campos; gana el
  selector de Prestadores vinculados.
- `factura-contract`/`factura-crud`: `FacturaForm.tsx` hoy completa `tipoComprobante` con el
  default de `obraSocial.tipoComprobante` (línea 120) — ese default deja de existir en
  `ObraSocial` y tiene que resolverse contra el/los Prestador(es) vinculados. **Cómo exactamente
  es parte del supuesto #5, sin resolver** — en esta rama de demo puede quedar como default fijo
  (`'A'`) documentado como provisorio, en vez de construir la selección real.

## Impact

**Código nuevo**
- `frontend/src/shared/types/prestador.ts`
- `frontend/src/shared/lib/prestadores/{PrestadorRepository,prestadorMapping,SupabasePrestadorRepository}.ts` + tests
- `frontend/src/features/prestadores/` (ruta, listado, form) + tests

**Código modificado**
- `frontend/src/shared/types/obraSocial.ts` — se quitan 2 columnas de condiciones
  (`plazoCobroDias`, `tipoComprobante`)
- `frontend/src/features/obras-sociales/ObraSocialForm.tsx` — se quitan esos campos, se agrega
  selector de Prestadores
- `frontend/src/features/facturacion/FacturaForm.tsx:120` — el default de `tipoComprobante` ya no
  puede leer `obraSocial.tipoComprobante`; queda como pendiente documentado (supuesto #5), no
  resuelto en este change
- `frontend/src/shared/lib/obrasSociales/obraSocialMapping.ts` — dejan de mapearse esas 2 columnas

**Base de datos** (documentado, no aplicado — `supabase db push` a cargo de Enzo)
- `ALTER TABLE obra_social.prestadores ADD COLUMN plazo_cobro_dias, tipo_comprobante` (mismos
  tipos/enums que hoy en `obra_social`)
- `ALTER TABLE obra_social.obra_social DROP COLUMN` de esas 2 (⚠️ destructivo — requiere backup y
  confirmación explícita de Enzo antes de aplicarse; no se dropea en este change, solo se
  documenta la migración objetivo). `modalidad_facturacion`/`admite_pagos_parciales` no se tocan.
- Tabla nueva de vínculo N:N, ej. `obra_social.obra_social_prestador (obra_social_id, prestador_id,
  PRIMARY KEY (obra_social_id, prestador_id))`, con su propia RLS gateada por `obra_social`

**Documentación**
- `knowledge-base/10_preguntas_abiertas.md` — agregar la pregunta #5 (selección de Prestador al
  facturar en modo general), nueva y no derivada de las anteriores
- `knowledge-base/04_modelo_de_datos.md` §Discrepancias — mover la nota de "condiciones por
  prestador" de "resuelta en ObraSocial" a "movida a Prestador, provisorio"

**Sin impacto**
- `integracion-facturacion`: no se modifica en este change, pero queda anotado como dependencia a
  revisar antes de que ese change cierre sus aprobaciones (ver "Lo que este change NO hace").
- `desacople-prestacion-factura` (otra rama de demo, `feature/desacoplar-prestaciones-factura`):
  no se toca, pero su futuro diseño de "factura general" va a necesitar leer el supuesto #5 de
  este proposal antes de proponer cómo se resuelve la selección de Prestador.

**Riesgo y rollback**
- Riesgo #1: mover columnas de `ObraSocial` a `Prestador` es un cambio de schema real (no aditivo
  puro) — si Andrea no confirma la lectura literal de US-300, hay que revertir tanto frontend como
  la migración documentada. Mitigado: nada se aplica a la base real todavía.
- Riesgo #2: el supuesto #5 queda genuinamente sin resolver — `FacturaForm.tsx` pierde su fuente
  de default real para `tipoComprobante` sin un reemplazo completo. Mitigado: se documenta como
  pendiente explícito, con un default fijo temporal para que la demo siga funcionando.
- **Rollback**: borrar la rama. Cero migraciones aplicadas contra Supabase real.

## Criterios de éxito

- [ ] Se puede crear, listar y editar un Prestador con sus 6 campos (4 propios + 2 movidos).
- [ ] Se puede vincular una ObraSocial a varios Prestadores y viceversa.
- [ ] El flujo actual de Facturación sigue compilando y pasando tests, con el default de
      `tipoComprobante` documentado como pendiente (no roto, pero explícitamente provisorio).
- [ ] `npx tsc -b --noEmit` y `npx vitest run` en verde dentro de `frontend/`.
- [ ] Los 5 supuestos quedan registrados como abiertos, no como resueltos.
