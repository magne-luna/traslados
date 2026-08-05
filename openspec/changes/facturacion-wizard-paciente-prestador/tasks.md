# Tasks: facturacion-wizard-paciente-prestador

## Phase 0: Aprobación (bloqueante — nada de código sin esto)

- [x] 0.1 Confirmar con Enzo el plan exacto de 3 pasos (Paciente → Obra social/Prestador → resto)
      — aprobado en conversación directa, 2026-08-05 (design.md, Governance)
- [x] 0.2 Confirmar que la edición de una factura existente NO debe forzar el wizard — aprobado,
      2026-08-05 (design.md D1)

## Phase 1: Primitiva de design system

- [x] 1.1 `frontend/src/design-system/stepper.tsx` nuevo: `Stepper` (N pasos, estados
      completado/activo/pendiente), sin lógica de navegación propia — puramente presentacional

## Phase 2: Reorganización del formulario

- [x] 2.1 `FacturaFormDatosBasicos.tsx`: se quita el campo Paciente (mudado al Paso 1) y las props
      `pacientes`/`obraSocial` (ya no las necesita); queda con período, prestación, domicilio,
      dependencia y retorno
- [x] 2.2 `FacturaForm.tsx`: agrega `esEdicion` (derivado de `initial?.pacienteId`, design.md D1),
      estado local `paso`, y los tres bloques de contenido reusables
      (`pasoPacienteContent`/`pasoObraSocialContent`/`pasoRestoContent`, design.md D2)
- [x] 2.3 `FacturaForm.tsx`: Paso 2 muestra el nombre de la obra social resuelta (solo lectura) y
      monta `PrestadorSelector` (reusado sin cambios) condicionado a `modalidadFacturacion`
- [x] 2.4 `FacturaForm.tsx`: gateo "Siguiente" Paso 1→2 con `values.pacienteId`, gateo Paso 2→3
      reusando `faltaElegirPrestador` (design.md D3)
- [x] 2.5 `FacturaForm.tsx`: render final por modo — wizard (`Stepper` + un paso visible + nav) en
      alta, los tres bloques juntos sin `Stepper`/nav en edición
- [x] 2.6 `FacturaFormEconomicos.tsx`: sin cambios de comportamiento, comentario actualizado
      (vive en el Paso 3 del wizard)

## Phase 3: Gateo de escritura por paso

- [x] 3.1 `CamposSoloLectura` alrededor del `<Select>` de Paciente (Paso 1) y de `PrestadorSelector`
      (Paso 2) — antes cubiertos por el envoltorio único de `FacturaFormDatosBasicos`
      (design.md D4)
- [x] 3.2 Envoltorio único existente sobre `FacturaFormDatosBasicos` + `FacturaFormEconomicos`
      (Paso 3) sin cambios
- [x] 3.3 "Siguiente"/"Atrás" fuera de cualquier `CamposSoloLectura` (mismo criterio que
      "Cancelar", `gateo-facturacion`)

## Phase 4: Tests

- [x] 4.1 `FacturaForm.test.tsx`: adaptar todos los tests existentes que asumían campos de más de
      un paso visibles a la vez — navegación por clicks para el flujo de alta real, `initial`
      (modo edición) para los que necesitan ver Prestador + `tipoComprobante` juntos (design.md D6)
- [x] 4.2 `FacturaForm.test.tsx`: tests nuevos — gateo Paso 1→2 (Siguiente deshabilitado sin
      paciente), gateo Paso 2→3 (deshabilitado sin prestador en "por-prestacion", habilitado de
      entrada en "general"), "Atrás" conserva valores ya cargados, modo edición arranca en el
      Paso 3 sin Stepper/nav
- [x] 4.3 `FacturaDetail.test.tsx`: adaptar los dos tests de gateo de escritura que dependían de
      ver `AsistenciasEditor` sin pasar por el wizard (uno navega los pasos con permiso, el otro
      documenta el bloqueo en el Paso 1 sin permiso — ver design.md D4)
- [x] 4.4 `npx tsc -b --noEmit` (dentro de `frontend/`) limpio
- [x] 4.5 Suite de `src/features/facturacion` en verde
      (`NODE_OPTIONS=--no-experimental-webstorage`)
- [x] 4.6 Suite completa sin regresiones nuevas frente a la línea base conocida de flakiness
      (`ChecklistEditor.test.tsx`, `PermisosMatrizFields.test.tsx`, `VehiculosList.test.tsx`,
      `VehiculosPage.test.tsx`)

## Phase 5: Documentación

- [ ] 5.1 `CHANGES.md` — nota de este change bajo `C-07`/`facturacion-asistencias-cobros`
- [ ] 5.2 Archivar este change (`openspec/changes/` → `openspec/changes/archive/`) una vez
      confirmado por Enzo en uso real
