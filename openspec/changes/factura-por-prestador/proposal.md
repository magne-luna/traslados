## Why

`ObraSocial.modalidadFacturacion: 'por-prestacion' | 'general'` (`frontend/src/shared/types/obraSocial.ts:13`)
existe, se configura en `ObraSocialForm.tsx` y se muestra como badge en `ObraSocialDetail.tsx` /
`ObrasSocialesList.tsx` — pero **cero lugares** de `features/facturacion/*` o
`shared/lib/facturacion/*` la leen. Es configuración sin consumo.

`Prestador` (`frontend/src/shared/types/prestador.ts`, módulo mergeado a `main` el 2026-08-02 por el
change `prestadores-crud`) tiene `tipoComprobante`/`plazoCobroDias`, movidos ahí desde `ObraSocial`.
Ese mismo change dejó un gap conocido y ya documentado en el propio código
(`FacturaForm.tsx:73`, `FacturaForm.test.tsx:88`): `tipoComprobante` **ya no se precarga** desde
ningún lado al armar una factura — el form arranca siempre con `TIPO_COMPROBANTE_DEFAULT` ('A') y
queda 100% manual. Nadie cerró ese gap todavía.

Tampoco existe hoy ninguna forma de asociar una `Factura` a un `Prestador` concreto — `Factura` no
tiene `prestadorId`, y `Factura.prestacion` es un campo de texto libre no relacionado (no confundir:
"prestación" texto libre vs. "Prestador" entidad).

Enzo (backend) pidió este flujo explícito para el formulario de "Nueva factura":

1. Seleccionar paciente (ya funciona, `FacturaForm.tsx:104-105`).
2. Obra social se deriva automáticamente del paciente (ya funciona).
3. Elegir si la factura es general o por prestador — **nuevo**, leyendo
   `obraSocial.modalidadFacturacion`.
4. Si es "por prestador": mostrar la lista de `Prestador` vinculados a esa `ObraSocial` (ya existe el
   dato — `PrestadorRepository.listarPorObraSocial(obraSocialId)`, hoy usado solo de lectura en
   `PrestadoresDeObraSocial.tsx`) y elegir uno. Si es "general": no se pide prestador.
5. A partir de ahí, arrancar el armado de la descripción según la plantilla de la obra social — **no
   se toca**, ya funciona (`renderDescripcionFactura`).

## What Changes

### 1. `Factura` gana un vínculo opcional a `Prestador`

- `frontend/src/shared/types/factura.ts`: nuevo campo `prestadorId?: string`. Ausente cuando la
  modalidad es `'general'` o cuando la obra social no tiene prestadores vinculados. Referencia por
  id, nunca embebido (mismo criterio que `pacienteId`/`domicilioId` en el mismo archivo).

### 2. El formulario lee `modalidadFacturacion` y condiciona la UI

- `FacturaFormDatosBasicos.tsx` (o el sub-componente que corresponda tras revisar el árbol actual del
  form): nuevo bloque, visible solo cuando `obraSocial` está resuelta:
  - Si `obraSocial.modalidadFacturacion === 'general'`: sin cambios visibles, `prestadorId` nunca se
    setea.
  - Si `obraSocial.modalidadFacturacion === 'por-prestacion'`: selector de `Prestador`, poblado vía
    `PrestadorRepository.listarPorObraSocial(obraSocial.id)` (mismo repository/método que ya usa
    `PrestadoresDeObraSocial.tsx`, sin duplicar lógica). Lista vacía → `EmptyState`, mismo patrón que
    el componente de solo lectura existente.

### 3. Al elegir un Prestador, `tipoComprobante` queda fijo (no editable)

- Cierra el gap dejado por `prestadores-crud` (ver Why): al seleccionar un `Prestador`,
  `tipoComprobante` se toma de `Prestador.tipoComprobante` y el campo pasa a **solo lectura**
  mientras ese prestador siga elegido (confirmado con Enzo, 2026-08-04). Si se limpia la selección
  de prestador, el campo vuelve a ser editable. En modalidad "general" (sin prestador) el
  comportamiento actual **no cambia**: sigue 100% manual, con `TIPO_COMPROBANTE_DEFAULT` como punto
  de partida (RN-FA-07).

### 4. Mocks y fixtures

- `mockFacturaRepository.ts` / `facturasFixture.ts`: agregar `prestadorId` donde corresponda en los
  datos de ejemplo, consistente con los prestadores ya sembrados por `prestadores-crud`
  (`feat(seed): datos de ejemplo de obras sociales y prestadores para la demo`).

### 5. Lo que este change NO hace

- **NO resuelve el supuesto #5 de `prestadores-crud`** (sin confirmar con Andrea): qué `Prestador`
  aplica cuando la modalidad es "general" y la obra social tiene varios prestadores vinculados. Este
  change deja "general" exactamente como está — sin selección ni asignación implícita de prestador.
  Si mañana se decide que "general" también necesita un prestador (p. ej. para el comprobante), es
  una decisión de negocio nueva, no algo que este change deba adivinar.
- **NO toca la plantilla ni el armado de la descripción** (`renderDescripcionFactura`,
  `construirDatosDescripcion`) — siguen leyendo únicamente de `ObraSocial.plantillaFactura`, sin
  ninguna dependencia de `Prestador`.
- **NO toca Supabase ni escribe ninguna migración.** La pantalla de Facturación sigue hablando con
  `mockFacturaRepository` — el swap a Supabase real (`integracion-facturacion`) es un change
  independiente, todavía sin aplicar (propose únicamente). Cuando ese swap se aplique, va a necesitar
  sumar `prestador_id` a su propio alcance — dejar la nota cruzada en ese change al momento de
  retomarlo, no adelantarla acá.
- **NO cambia el circuito de estados, el cupo, los cobros, la impresión ni los documentos.**

## Capabilities

### New Capabilities

- `factura-prestador-seleccion`: selección condicional de `Prestador` en el alta de factura según
  `ObraSocial.modalidadFacturacion`, y fijación (solo lectura) de `tipoComprobante` desde el
  prestador elegido.

### Modified Capabilities

- `factura-crud`: `Factura` gana el campo opcional `prestadorId`.
- `factura-contract`: el contrato de `NuevaFactura`/`ActualizacionFactura` incluye `prestadorId?`.

## Impact

**Código nuevo**
- `frontend/src/features/facturacion/PrestadorSelector.tsx` — se reutiliza la interfaz
  `PrestadorRepository` existente, sin tocarla.
- `frontend/src/shared/lib/mocks/mockPrestadorRepository.ts` +
  `frontend/src/shared/lib/mocks/prestadoresFixture.ts` (⚠️ corrección post-implementación,
  2026-08-04 — ver `design.md` D1): esta sección originalmente decía "ninguno a nivel repository
  nuevo" y listaba `mockPrestadorRepository` bajo "Sin impacto" abajo, asumiendo que ya existía en
  el repo. No existía — `prestadores-crud` nunca lo creó, solo dejó `SupabasePrestadorRepository.ts`
  (real). La primera pasada de implementación inyectó ese repository real en `FacturacionRoute.tsx`,
  lo cual rompía este mismo Non-Goal (bullet de abajo) porque `obraSocial.id` en esa pantalla es un
  id de fixture mock (`'osecac'`), no un UUID de Supabase — el selector quedaba vacío en la
  práctica. Corregido agregando el mock, sembrado en el mismo espacio de ids que
  `mockObraSocialRepository`.

**Código modificado**
- `frontend/src/shared/types/factura.ts` (`prestadorId?: string`)
- `frontend/src/features/facturacion/FacturaFormDatosBasicos.tsx` (o el sub-componente exacto, a
  confirmar en `design.md` tras releer el árbol completo del form)
- `frontend/src/features/facturacion/FacturaForm.tsx` (estado del form, wiring del nuevo campo)
- `frontend/src/features/facturacion/FacturacionRoute.tsx` (monta `PrestadorRepositoryProvider`
  con `mockPrestadorRepository` — no listado en la redacción original de esta sección, necesario
  para que `PrestadorSelector` no explote al montarse; ver corrección arriba)
- `frontend/src/shared/lib/mocks/mockFacturaRepository.ts`, `facturasFixture.ts` (datos de ejemplo)
- Tests correspondientes de los archivos de arriba

**Sin impacto**
- `PrestadorRepository` (la interfaz), `SupabasePrestadorRepository.ts`, `PrestadoresDeObraSocial.tsx`
  — se consumen (o ni eso), no se modifican. `SupabasePrestadorRepository.ts` deja de estar en el
  camino de este change tras la corrección de arriba (ya no se inyecta en `FacturacionRoute.tsx`).
- `renderDescripcionFactura`, `construirDatosDescripcion`, circuito de estados, cupo, cobros,
  impresión, documentos.
- Supabase / migraciones — cero cambios (ver corrección arriba: la primera pasada de implementación
  violó este punto durante un rato, ya corregido).

**Dependencias**
- Requiere (ya cumplido): `prestadores-crud` mergeado a `main` (2026-08-02).
- Independiente de `integracion-facturacion` (el swap a Supabase sigue sin aplicar) — este change no
  lo bloquea ni lo espera, pero lo deja con una nota pendiente (`prestador_id` en el schema real,
  cuando ese change se retome).

**Riesgo y rollback**
- Riesgo bajo: cambio de frontend puro sobre un repository mock, sin backend ni migración. Rollback:
  revertir los archivos de "Código modificado".
- Riesgo funcional real, no técnico: el supuesto #5 sigue sin confirmar con Andrea. Este change no lo
  agrava (no toca el caso "general"), pero tampoco lo cierra.
