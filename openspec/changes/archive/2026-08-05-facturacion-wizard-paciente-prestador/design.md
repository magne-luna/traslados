## ⚠️ Governance: CRÍTICO — aprobación ya dada

Facturación es dominio **CRÍTICO** (`CHANGES.md` §C-07, misma tabla de gobernanza que
`factura-por-prestador`/`integracion-facturacion`): ningún código de aplicación se escribe sin
aprobación humana explícita. A diferencia de esos dos changes, acá la aprobación **ya ocurrió en
conversación directa con Enzo**, sobre el plan exacto de 3 pasos descripto en `proposal.md` — este
`design.md` documenta esa decisión ya tomada, no abre ninguna nueva pregunta de negocio. No hay
tabla de decisiones pendientes de aprobar: es análisis + implementación de algo ya aprobado.

---

## Goals / Non-Goals

**Goals**
- Guiar el alta de una factura en 3 pasos secuenciales (Paciente → Obra social/Prestador → resto),
  reusando el `values`/lógica existente sin tocarlo.
- No forzar el wizard cuando se edita una factura existente (paciente/prestador ya resueltos).
- Preservar el gateo de escritura (`gateo-facturacion`) intacto, reorganizado por paso.

**Non-Goals**
- No cambia ninguna regla de negocio, validación, tipo ni contrato (ver `proposal.md` §"Lo que
  este change NO hace").
- No construye un framework de wizard genérico ni lo retrofitea a otras pantallas.
- No toca `factura-por-prestador` (selección de Prestador, fijación de `tipoComprobante`) más allá
  de reubicar dónde se renderiza.

## Decisiones de diseño

**D1 — `esEdicion` se deriva de `initial?.pacienteId`, no de una prop nueva.** `FacturaForm` ya
recibe `initial?: FacturaFormValues` (usado hoy para poblar el estado inicial). Agregar una prop
booleana explícita (`modo: 'alta' | 'edicion'`) hubiera sido una segunda fuente de verdad que
`FacturaDetail.tsx` tendría que mantener sincronizada con `initial` — innecesario, porque
`initial?.pacienteId` truthy ya es exactamente la señal que `FacturaDetail.tsx` usa hoy para
distinguir alta de edición (`factura === null` vs. `factura` resuelto, y toda `Factura` real tiene
`pacienteId` no vacío por validación). `esEdicion` se calcula una vez en el cuerpo del componente y
no cambia durante su vida (depende solo de la prop `initial` con la que se montó).

**D2 — Un solo árbol de contenido, dos formas de renderizarlo.** En vez de duplicar JSX entre "vista
de alta" y "vista de edición", el contenido de cada paso vive en tres constantes locales
(`pasoPacienteContent`, `pasoObraSocialContent`, `pasoRestoContent`) definidas una sola vez dentro
de `FacturaForm`. El render final elige entre:
- **Alta** (`!esEdicion`): un paso visible a la vez (`paso` en estado local, `0 | 1 | 2`), con
  `Stepper` + botones "Siguiente"/"Atrás" gateados por reglas de negocio ya existentes.
- **Edición** (`esEdicion`): los tres bloques renderizados juntos, sin `Stepper` ni navegación —
  exactamente el layout plano de antes de este change.

Esto evita que la lógica de gateo, los props de cada sub-componente o el layout de campos diverjan
entre los dos modos: hay un solo lugar donde "Paciente" se renderiza, un solo lugar donde
"Prestador" se renderiza, etc.

**D3 — Reutilizar `faltaElegirPrestador` para gatear "Siguiente" del Paso 2.** Esa variable ya
existía (change `factura-por-prestador`, design.md D5) para decidir si se arma la vista previa de
la descripción. Es exactamente la misma condición que necesita "Siguiente" del Paso 2→3
(`obraSocial.modalidadFacturacion === 'por-prestacion' && !values.prestadorId`) — no se duplica el
cálculo, se reusa la misma constante para las dos cosas.

Consecuencia observada al implementar: en modo alta, una vez que el wizard permite llegar al Paso
3, `faltaElegirPrestador` siempre es `false` para esa modalidad (el propio gateo del Paso 2 ya
exigió el prestador para poder avanzar) — la bandera queda funcionalmente redundante ahí, pero
sigue siendo necesaria en modo edición, donde los tres pasos están visibles juntos y el usuario
puede limpiar un prestador ya elegido sin pasar por ningún gateo de navegación.

**D4 — Gateo de escritura (`CamposSoloLectura`) por paso, no una sola inserción.** Antes de este
change, `gateo-facturacion` (design.md D3) envolvía **una vez** el grid con
`FacturaFormDatosBasicos` + `FacturaFormEconomicos`, porque los dos vivían siempre montados juntos.
Con el contenido repartido en `pasoPacienteContent`/`pasoObraSocialContent`/`pasoRestoContent`, cada
uno gatea su propia porción de campos:
- `pasoPacienteContent`: un `<CamposSoloLectura>` alrededor del `<Select>` de Paciente.
- `pasoObraSocialContent`: un `<CamposSoloLectura>` alrededor de `PrestadorSelector` (el nombre de
  la obra social es texto de solo lectura, no necesita gateo).
- `pasoRestoContent`: el mismo envoltorio único de siempre sobre el grid
  `FacturaFormDatosBasicos` + `FacturaFormEconomicos` — sin cambios ahí.

"Siguiente"/"Atrás" quedan **fuera** de cualquier `CamposSoloLectura`, mismo criterio que ya regía
para "Cancelar" (`gateo-facturacion`, design.md D3: "Cancelar queda fuera del envoltorio y sigue
operativo") — son navegación, no escritura de datos.

**Consecuencia no trivial (documentada, no un bug):** con el Paciente deshabilitado por falta de
permiso de escritura, `values.pacienteId` nunca puede setearse, así que "Siguiente" del Paso 1
nunca se habilita — una cuenta de solo lectura que abre "Nueva factura" queda visualmente detenida
en el Paso 1, sin poder ver el resto del formulario (ni siquiera de solo lectura). Antes de este
change, esa misma cuenta veía el formulario plano completo, todo deshabilitado. Es una regresión de
"cuánto se puede previsualizar sin permiso", pero no de autorización real (la RLS del servidor
sigue siendo la frontera): tiene sentido de producto porque el wizard de alta existe específicamente
para el caso "todavía no sé qué paciente/prestador es" — una cuenta que no puede escribir tampoco
puede completar esa elección, así que no hay nada útil que mostrarle más allá del Paso 1. En
edición (`esEdicion`), donde el wizard se saltea, este efecto no aplica: todo sigue visible de una,
igual que siempre.

**D5 — Botones Cancelar/Guardar extraídos a `accionesFinales`, compartidos entre modos.** Viven en
el Paso 3 (alta) y al final del layout plano (edición) — nunca en los Pasos 1/2, que solo tienen
"Siguiente"/"Atrás". Una cuenta en el Paso 1/2 de una alta nueva usa el link "← Volver al listado"
de `FacturaDetail.tsx` (fuera de `FacturaForm`, siempre visible) para salir sin guardar — no hace
falta un "Cancelar" duplicado en cada paso.

**D6 — Adaptación de tests: modo edición como vehículo para aserciones multi-paso.** Varios tests
existentes verificaban dos bloques de campos a la vez en el mismo render (p. ej. "elegir un
prestador bloquea `tipoComprobante`" — Prestador vive en el Paso 2, `tipoComprobante` en el Paso
3, nunca simultáneamente visibles en alta). En vez de forzar un `initial` artificial o inventar un
mecanismo nuevo, esos tests pasan a montar `FacturaForm` con `initial` (modo edición, todo visible
de una) — es exactamente el escenario real que ejercitan (ver todos los campos juntos), y ya existe
como parte del propio diseño (D2), no es un atajo de testing. Los tests que sí ejercitan el flujo
de alta real navegan el wizard con clicks (`userEvent.click(... 'Siguiente' ...)`), incluida la
nueva cobertura de gateo por paso, conservación de valores con "Atrás" y el bypass de edición.

## Impacto en tipos y contratos

Ninguno. `FacturaFormValues`, `Factura`, `ObraSocial`, `Prestador` no cambian. `FacturaFormProps`
tampoco gana ni pierde props — `esEdicion` es una constante derivada dentro del componente, no una
prop nueva.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| Cuenta de solo lectura queda "atascada" en el Paso 1 al dar de alta (D4) | Documentado como consecuencia esperada, no un bug — cubierto por test dedicado (`FacturaForm.test.tsx`, describe "gateo de escritura") |
| Duplicar JSX entre alta/edición y que diverjan con el tiempo | D2: un solo árbol de contenido (`pasoPacienteContent`/`pasoObraSocialContent`/`pasoRestoContent`), nunca dos copias |
| Que el wizard se perciba como precedente para otras pantallas | Comentario explícito en `stepper.tsx` y en `FacturaForm.tsx` marcándolo como excepción única, no patrón a reusar |
| Romper los ~20 tests existentes de `FacturaForm.test.tsx`/`FacturaDetail.test.tsx` que asumían todo visible de una | D6 + verificación línea por línea de cada test roto, adaptado (nunca borrado) |

## Migration Plan

Cero SQL, cero Edge Functions, cero dependencias nuevas, cero estado persistido nuevo. Build normal
del frontend.

**Rollback:** revertir los archivos de "Código modificado" de `proposal.md` y borrar
`frontend/src/design-system/stepper.tsx` devuelve el formulario a su estado plano anterior, sin
efecto sobre ningún otro módulo.

**Verificación:** `npx tsc -b --noEmit` limpio, suite de `src/features/facturacion` en verde,
suite completa sin regresiones nuevas frente a la línea base conocida (flakiness pre-existente de
`ChecklistEditor.test.tsx`/`PermisosMatrizFields.test.tsx`/`VehiculosList.test.tsx`/
`VehiculosPage.test.tsx`, no causada por este change).

## Open Questions

Ninguna — el plan de 3 pasos fue aprobado por Enzo en conversación directa antes de escribir
código (ver `proposal.md` §Why). Este `design.md` documenta decisiones de implementación sobre ese
plan, no negocio pendiente de confirmar con Andrea.

## Governance

Dominio **facturación → nivel CRÍTICO** en la tabla de Agent Governance del proyecto. Aprobación
humana explícita ya obtenida (Enzo, conversación previa a este change) para el plan exacto descripto
en `proposal.md` — habilita escribir el código de este change sin una ronda adicional de
aprobación.
