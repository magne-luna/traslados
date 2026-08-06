## Why

El formulario "Nueva factura" (`FacturaForm.tsx` + `FacturaFormDatosBasicos.tsx` +
`FacturaFormEconomicos.tsx`) muestra hoy todos sus campos de una sola vez: Paciente, obra
social/Prestador (change `factura-por-prestador`, ya en `main`), período, prestación, domicilio,
económicos, días facturables, asistencias y la vista previa de la descripción — todo junto, desde
el primer render.

Enzo (backend, product owner de esta decisión) pidió un flujo guiado en 3 pasos para el alta:
elegir primero el paciente, después resolver obra social/Prestador (que condiciona buena parte
del resto — tipo de comprobante, si hace falta un prestador), y recién ahí completar el resto del
formulario. Aprobado en conversación explícita — este `proposal.md` documenta lo ya decidido, no
abre una decisión nueva.

## What Changes

### 1. `FacturaForm` se reorganiza en un wizard de 3 pasos (solo en alta)

- **Paso 1 — Paciente**: únicamente el `<Select>` de paciente (antes primer campo de
  `FacturaFormDatosBasicos`). "Siguiente" deshabilitado hasta elegir uno.
- **Paso 2 — Obra social / Prestador**: nombre de la obra social resuelta (solo lectura) y, si
  `obraSocial.modalidadFacturacion === 'por-prestacion'`, el `PrestadorSelector` existente (change
  `factura-por-prestador`, reusado tal cual). Elegir un prestador es obligatorio para avanzar en
  esa modalidad; en `'general'` "Siguiente" ya está habilitado (no hay nada que elegir). "Atrás"
  vuelve al Paso 1.
- **Paso 3 — el resto**: todo lo demás que ya existía — el resto de
  `FacturaFormDatosBasicos` (mes, año, prestación, domicilio, dependencia y retorno), todo
  `FacturaFormEconomicos`, `DiasFacturablesSelector`, `AlertaCupo`, `AsistenciasEditor`, la vista
  previa de la descripción y los botones Cancelar/Guardar. "Atrás" vuelve al Paso 2.

### 2. Edición saltea el wizard

Cuando `FacturaForm` recibe `initial` con `pacienteId` ya resuelto (edición de una factura
existente, vía `FacturaDetail.tsx`), el formulario arranca directo mostrando los tres bloques
juntos — sin Stepper, sin "Atrás"/"Siguiente" — igual que el formulario plano de antes de este
change. El wizard existe para el caso "no sé todavía qué paciente/prestador es"; en edición esa
pregunta ya está resuelta, forzar el flujo guiado sería fricción sin propósito.

### 3. Nueva primitiva `Stepper` en el design system

`frontend/src/design-system/stepper.tsx`: indicador visual chico y específico para este wizard (N
pasos con label, estado completado/activo/pendiente) — no un framework de wizard genérico. Es el
primer patrón de este tipo en la app; el resto del sistema sigue "list+detail inline, nunca modal"
(`knowledge-base/08_arquitectura_propuesta.md`), y esta primitiva es una excepción deliberada y
acotada a este único flujo, no un precedente para retrofitear en otras pantallas.

### 4. Cero cambio de lógica de negocio

Ver "Lo que este change NO hace" más abajo.

## Capabilities

### New Capabilities

- `facturacion-wizard-alta`: flujo guiado de 3 pasos para el alta de una factura nueva
  (Paciente → Obra social/Prestador → resto del formulario), con bypass automático en edición.

### Modified Capabilities

Ninguna — `factura-crud`, `factura-contract` y `factura-prestador-seleccion` (change
`factura-por-prestador`) no cambian: mismos campos, mismas validaciones, mismo contrato. Este
change es puramente de presentación sobre el mismo formulario.

## Lo que este change NO hace

- **No cambia ninguna regla de negocio ni validación.** `validateFacturaForm` sigue corriendo
  únicamente al hacer submit final (Paso 3 → Guardar), exactamente igual que antes. No se agrega
  validación por paso más allá del gateo de "Siguiente" ya descripto (paciente elegido / prestador
  elegido si la modalidad lo exige) — ese gateo no bloquea el submit, solo la navegación.
- **No agrega ni quita ningún campo, tipo ni entidad.** Cero cambios en
  `frontend/src/shared/types/factura.ts`, `obraSocial.ts` ni `prestador.ts`.
- **No toca Supabase ni escribe ninguna migración.** La pantalla de Facturación sigue hablando con
  `mockFacturaRepository`, sin cambios.
- **No modifica el comportamiento ya aprobado y en producción de `factura-por-prestador`**
  (selección condicional de Prestador, fijación de `tipoComprobante`, gateo por modalidad) —
  solo reubica DÓNDE se renderiza cada pieza, nunca QUÉ computa.
- **No retrofitea el patrón Stepper/wizard a ninguna otra pantalla.** Sigue siendo la única
  excepción a "list+detail inline, nunca modal" en toda la app.

## Impact

**Código nuevo**
- `frontend/src/design-system/stepper.tsx` — primitiva `Stepper`, sin dependencias nuevas.

**Código modificado**
- `frontend/src/features/facturacion/FacturaForm.tsx` — reorganiza el render en 3 pasos (alta) o
  todo junto (edición); mismo estado, misma lógica derivada, mismos handlers.
- `frontend/src/features/facturacion/FacturaFormDatosBasicos.tsx` — pierde el campo Paciente
  (mudado al Paso 1) y ya no recibe `pacientes`/`obraSocial` como prop (ninguno de los dos campos
  que los necesitaba sigue viviendo acá).
- `frontend/src/features/facturacion/FacturaFormEconomicos.tsx` — sin cambios de comportamiento,
  solo comentario actualizado (ahora vive en el Paso 3).
- `frontend/src/features/facturacion/FacturaForm.test.tsx` y
  `frontend/src/features/facturacion/FacturaDetail.test.tsx` — tests existentes adaptados para
  navegar el wizard por clicks; tests nuevos de gateo de pasos, conservación de valores con
  "Atrás" y bypass en edición.

**Sin impacto**
- `PrestadorSelector.tsx` — se reusa tal cual, cero cambios.
- `validateFacturaForm.ts`, `renderDescripcionFactura`, `construirDatosDescripcion`,
  `cupoConsumido`, `validarCupoFacturacion` — ninguna regla de negocio se toca.
- `DiasFacturablesSelector`, `AlertaCupo`, `AsistenciasEditor` — se mueven de posición (todos al
  Paso 3), sin cambios internos.
- Supabase / migraciones — cero cambios.
- El resto del design system (`components.tsx`, `form.tsx`, `layout.tsx`, `feedback.tsx`,
  `table.tsx`) — `Stepper` es un archivo nuevo, no modifica ninguno de los existentes.

**Dependencias**
- Requiere (ya cumplido): `factura-por-prestador` mergeado a `main` — el `PrestadorSelector` y la
  lógica de `tipoComprobanteBloqueado`/`faltaElegirPrestador` que el Paso 2 reutiliza ya existen.
- Requiere (ya cumplido): `gateo-facturacion` mergeado a `main` — el wizard preserva el gateo de
  escritura existente, reorganizado por paso.

**Riesgo y rollback**
- Riesgo bajo: cambio de frontend puro, sin backend ni migración, sin nuevos tipos ni contratos.
  Rollback: revertir los archivos de "Código modificado" (y borrar `stepper.tsx`).
- Riesgo de UX real, no técnico: es el primer wizard de la app — si el flujo guiado resulta
  incómodo en el uso real, la reversión es barata (mismo `values`/lógica, solo cambia el render).
