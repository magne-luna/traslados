## ⚠️ Governance: CRÍTICO — Aprobación requerida antes del apply

Facturación es dominio **CRÍTICO** (`CHANGES.md` §C-07, misma tabla de gobernanza que
`integracion-facturacion`): **análisis solamente; ningún código de aplicación se escribe sin
aprobación humana explícita**. Este `design.md` es análisis, no autoriza el apply.

| # | Decisión | Por qué necesita aprobación |
|---|---|---|
| **D1** | Confirmar la lectura de "por-prestador" | El enum real se llama `modalidadFacturacion: 'por-prestacion' \| 'general'` (literal `'por-prestacion'`, sin "d"). Este change interpreta ese literal como "hay que elegir un Prestador" — coherente con lo que pidió Enzo, pero es una interpretación de negocio sobre un campo cuya semántica exacta nunca se confirmó con Andrea (ver `knowledge-base/10_preguntas_abiertas.md`, supuesto #1 de `desacople-prestacion-factura`) |
| **D2** | No resolver el supuesto #5 de `prestadores-crud` | "General" con una obra social multi-prestador queda sin prestador asignado, a propósito. Si el negocio necesita uno igual para el comprobante, es una decisión de Andrea, no del agente |
| **D3** | Fijar `tipoComprobante` desde `Prestador`, sin poder editarlo mientras haya un prestador elegido | Cambia un comportamiento hoy 100% manual (`TIPO_COMPROBANTE_DEFAULT`, editable). Confirmado con Enzo (2026-08-04): en modalidad "por-prestador" el campo queda de solo lectura, tomado del prestador; en "general" sigue editable como hoy |

Ninguna de las tres bloquea tanto como una migración — no hay SQL en este change — pero son
decisiones de negocio sobre un dominio fiscal, no de implementación. Replicadas en `tasks.md` §0.

---

## Goals / Non-Goals

**Goals**
- Que `ObraSocial.modalidadFacturacion` tenga un efecto real en el formulario de factura.
- Poder asociar una `Factura` a un `Prestador` concreto cuando la modalidad lo requiere.
- Cerrar el gap de `tipoComprobante` sin precarga que dejó `prestadores-crud`.

**Non-Goals**
- No construir "factura general consolidando N prestaciones" (eso sigue siendo
  `desacople-prestacion-factura`, sin retomar).
- No tocar Supabase, RLS ni ninguna migración.
- No resolver ninguno de los 5 supuestos abiertos de `prestadores-crud` más allá de lo que D2 ya
  aclara (dejarlo sin resolver, explícitamente).

## Decisiones de diseño

**D1 — Dónde vive el fetch de Prestadores.** Dos opciones:
  - (a) `FacturacionRoute.tsx` fetchea todos los `Prestador` de una y los pasa como prop a
    `FacturaForm`, igual que `pacientes`/`obrasSociales` hoy.
  - (b) Un componente nuevo (`PrestadorSelector.tsx`, análogo a `PrestadoresDeObraSocial.tsx`) usa
    `usePrestadorRepository()` + `useEffect` para pedir `listarPorObraSocial(obraSocial.id)` cada vez
    que cambia la obra social resuelta.

  **Elegida: (b).** Evita traer todos los prestadores del sistema cuando la mayoría de las facturas
  ni los va a usar (modalidad "general"), y reutiliza exactamente el mismo patrón/método que
  `PrestadoresDeObraSocial.tsx` ya usa — cero lógica nueva de fetching, solo un segundo consumidor
  del mismo repository. Se dispara solo cuando `obraSocial.modalidadFacturacion === 'por-prestacion'`
  (no tiene sentido pedir la lista si la UI ni la va a mostrar).

  **⚠️ Corrección post-implementación (2026-08-04, coordinación con Enzo):** la primera pasada de
  este change inyectó `supabasePrestadorRepository` (real) en `FacturacionRoute.tsx`, razonando que
  "no existe `mockPrestadorRepository` en el repo, es el único disponible". Bug real: `obraSocial.id`
  en esa misma pantalla viene de `mockObraSocialRepository`/`osecacFixture.ts` (id de fixture
  literal, `'osecac'`, no un UUID de Supabase) — `listarPorObraSocial('osecac')` contra el backend
  real nunca matchea ninguna fila, así que `PrestadorSelector` quedaba siempre vacío en la práctica,
  y además violaba el Non-Goal "No tocar Supabase" de este mismo `design.md`. Corregido: se agregó
  `mockPrestadorRepository.ts` (`shared/lib/mocks/`, mismo patrón que `mockObraSocialRepository.ts`
  — localStorage + `SCHEMA_VERSION`), sembrado con el mismo espacio de ids que
  `mockObraSocialRepository` (`'osecac'`), e inyectado en `FacturacionRoute.tsx` en lugar del
  repository real. `usePrestadorRepository()` sigue siendo el mecanismo de fetch (esa parte de D1 no
  cambió) — lo que cambió es **qué implementación concreta** se inyecta en el composition root de
  Facturación: mock, nunca `supabasePrestadorRepository`, mientras Facturación siga 100% en mocks
  (design.md Non-Goals, Goals de arriba). `ObraSocialesRoute.tsx`/`PrestadoresRoute.tsx` sí siguen
  inyectando el repository real — ese lado del sistema ya tiene ids reales de Supabase, no hay
  mismatch ahí.

**D2 — Dónde vive el nuevo bloque de UI.** `FacturaFormDatosBasicos.tsx` no recibe `obraSocial` hoy
  (solo `paciente`). Se agrega `obraSocial: ObraSocial | undefined` como nueva prop (mismo patrón que
  `paciente`, resuelto en el padre `FacturaForm.tsx:105` y ya disponible ahí). El nuevo bloque
  (`PrestadorSelector`, condicionado a `modalidadFacturacion === 'por-prestacion'`) se renderiza
  dentro de `FacturaFormDatosBasicos`, inmediatamente después del campo "Prestación" — mismo lugar
  conceptual que el resto de los campos derivados de la obra social del paciente.

**D3 — `tipoComprobante` fijo mientras haya prestador elegido.** El callback `onChange` de
  `PrestadorSelector` llama `set('prestadorId', prestador.id)` y, en el mismo evento,
  `set('tipoComprobante', prestador.tipoComprobante)`. A diferencia de una simple precarga,
  `FacturaFormEconomicos.tsx` recibe una nueva prop `tipoComprobanteBloqueado: boolean` —
  `Boolean(values.prestadorId)` calculado en `FacturaForm.tsx` — y el `<Select>` de tipo de
  comprobante se renderiza `disabled` cuando es `true` (RN-FA-07 sigue rigiendo el default en
  modalidad "general", que no cambia). Si el usuario limpia el prestador elegido (vuelve a
  "Seleccionar…"), `tipoComprobanteBloqueado` pasa a `false` y el campo vuelve a ser editable con el
  último valor que tenía — no se resetea a `TIPO_COMPROBANTE_DEFAULT` al desbloquear, evita perder
  sin querer un valor que el usuario ya había tocado antes de elegir prestador.

**D4 — Qué pasa si se cambia el paciente/obra social después de elegir prestador.** Mismo criterio
  que ya existe para el resto del form al cambiar de paciente (no hay reseteo automático de campos
  hermanos hoy — el usuario es responsable de revisar el form tras cambiar el paciente). No se agrega
  un caso especial solo para `prestadorId`: si cambia la obra social, `PrestadorSelector` vuelve a
  fetchear con el nuevo `obraSocial.id` y muestra la nueva lista, pero `values.prestadorId` viejo
  queda en el estado hasta que el usuario elija de nuevo o lo limpie — igual de "manual" que hoy es
  `domicilioId` al cambiar de paciente.

## Impacto en tipos y contratos

- `Factura.prestadorId?: string` — opcional, nunca embebido.
- `FacturaFormValues` (`FacturaForm.tsx:21`, derivado de `Omit<Factura, ...>`) hereda el campo
  automáticamente — no requiere tocar esa línea.
- `valoresPorDefecto()` (`FacturaForm.tsx:23-42`): no necesita agregar `prestadorId` explícito
  (queda `undefined` por omisión, TypeScript strict lo permite en un campo opcional).
