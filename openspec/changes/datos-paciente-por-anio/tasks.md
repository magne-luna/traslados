> Strict TDD: cada tarea de código arranca con el test en ROJO (archivo indicado), luego verde,
> triangulación y refactor. Verificar tipos con `npx tsc -b --noEmit` dentro de `frontend/`.
> Pasos marcados **[lo aplica Enzo]** no los ejecuta ningún agente (`db push`, `functions deploy`,
> queries contra la base real). Serie de 3 PRs: PR 1 = backend (secciones 1–3), PR 2 = ficha
> (4–6), PR 3 = consumidores (7–8).

## 0. Gate — decisiones abiertas (bloquea todo lo demás)

- [ ] 0.1 Resolver con la usuaria/Andrea DA-1…DA-9 de `design.md` (§Decisiones abiertas) y anotar la respuesta de cada una en `design.md`; si DA-2 = "diagnóstico por año", volver a proponer con la alternativa B antes de seguir
- [ ] 0.2 **[lo aplica Enzo]** Correr el SELECT de diagnóstico (D6) contra la base real: prestaciones con año en el nombre, pacientes con `obra_social_id` sin cobertura, coberturas por paciente / con `fecha_desde` NULL / solapadas; pegar el resultado en `design.md`

## 1. Migración 1 — `anio` en prestaciones y destinos habituales (PR 1)

- [ ] 1.1 Escribir `supabase/migrations/<ts>_pacientes_anio_prestaciones_recorridos.sql` (D1/D6: ADD COLUMN nullable → backfill año por defecto DA-5 → renombrado según DA-6 → NOT NULL + CHECK + índice `(paciente_id, anio)`), idempotente y con bloque Rollback comentado (incluye UPDATE inverso de nombres)
- [ ] 1.2 Revisión de la migración 1.1 por la usuaria antes de seguir (governance HIGH)

## 2. Migración 2 — coberturas con período real (PR 1)

- [ ] 2.1 Escribir `supabase/migrations/<ts>_coberturas_periodo.sql` (D3/D6: crear coberturas faltantes, normalizar `fecha_desde` y cerrar filas superpuestas, `fecha_desde NOT NULL`, constraint de no-solape con `btree_gist` o trigger, función `obra_social.cobertura_vigente(paciente_id, fecha)` `STABLE SECURITY INVOKER`), con bloque Rollback
- [ ] 2.2 Revisión de la migración 2.1 por la usuaria
- [ ] 2.3 **[lo aplica Enzo]** `supabase db push` (migraciones 1 y 2) y verificar los conteos contra el SELECT de 0.2

## 3. Edge functions (PR 1)

- [ ] 3.1 RED: test de la función pura de resolución de obra social/afiliado para facturar (nueva, en `supabase/functions/_shared/`, ej. `resolverCoberturaFactura.test.ts`): obra social = la del presupuesto, afiliado = cobertura vigente en `periodo_mes`; casos: cobertura única, cambio de OS a mitad de año, sin cobertura vigente → error `EMISION_SIN_COBERTURA`
- [ ] 3.2 GREEN + wiring en `supabase/functions/facturar/index.ts` (deja de leer `paciente.obra_social_id`, D4)
- [ ] 3.3 `supabase/functions/presupuestos/index.ts`: devolver/aceptar `anio` de prestaciones donde las lea; test de mapeo si hay función pura, si no documentar en el PR
- [ ] 3.4 **[lo aplica Enzo]** `supabase functions deploy facturar presupuestos` (después de 2.3)
- [ ] 3.5 Agregar los pasos 2.3 y 3.4 a `docs/PENDIENTE-ENZO.md` con el formato existente (qué es, qué pasa hoy, qué falta en orden, cómo probar)

## 4. Tipos y mapping (PR 2)

- [ ] 4.1 RED: `prestacionMapping.test.ts` y `recorridoHabitualMapping.test.ts` — `anio` se lee y escribe; fila sin `anio` (backend viejo) → año actual
- [ ] 4.2 GREEN: `anio: number` en `shared/types/prestacion.ts` y `recorridoHabitual.ts`; actualizar mappings
- [ ] 4.3 RED: test de función pura `aniosDelPaciente(prestaciones, recorridos, coberturas, hoy)` (spec "Pestañas por año": con datos 2025/2026 → [2025, 2026, 2027]; paciente nuevo → [actual, siguiente])
- [ ] 4.4 GREEN `aniosDelPaciente` en `features/pacientes/`
- [ ] 4.5 RED: test de función pura `coberturaVigente(coberturas, fecha)` y `coberturasDelAnio(coberturas, anio)` (vigente abierta, cambio mitad de año, sin cobertura)
- [ ] 4.6 GREEN ambas en `shared/lib/pacientes/` + tipo `Cobertura` (id, obraSocialId, numeroAfiliado, fechaDesde, fechaHasta?)
- [ ] 4.7 RED: test de `validarSolapeCoberturas` (spec "Coberturas solapadas") → GREEN

## 5. Repositories (PR 2)

- [ ] 5.1 RED: `SupabasePacienteRepository.test.ts` — `getById` devuelve `coberturas` del paciente; `update` con coberturas hace diff (alta/edición, nunca DELETE) y recalcula `obra_social_id` = cobertura vigente hoy (D3)
- [ ] 5.2 GREEN en `SupabasePacienteRepository.ts` (reemplaza el upsert actual "fecha_desde = hoy" del número de afiliado)
- [ ] 5.3 RED: test `copiarAnio(pacienteId, desde, hasta)` — crea filas nuevas con `anio = hasta` solo de prestaciones activas y todos los destinos de `desde`; no toca `desde`; rechaza si `hasta` ya tiene datos
- [ ] 5.4 GREEN en el repository (D5) + mock repository equivalente

## 6. Ficha del paciente (PR 2)

- [ ] 6.1 RED: `PacienteDetail.test.tsx` — selector de años, año actual por defecto, datos fijos fuera de las pestañas
- [ ] 6.2 GREEN: selector de año en `PacienteDetail.tsx` reusando componentes de `design-system/components.tsx` (revisar catálogo antes), Tailwind sin inline styles
- [ ] 6.3 RED/GREEN: `PrestacionesEditor` filtra y crea con el `anio` seleccionado (spec "Hidroterapia solo en 2027", "Misma prestación en dos años")
- [ ] 6.4 RED/GREEN: `RecorridosHabitualesEditor` idem (spec "Cambio de escuela"); direcciones siguen comunes
- [ ] 6.5 RED/GREEN: `PacienteCoberturaFields` → lista de coberturas del año (OS, afiliado, desde, hasta), "cambiar de obra social" cierra la vigente y abre otra; error visible en solape
- [ ] 6.6 RED/GREEN: acción "Copiar desde <año-1>" visible solo con el año vacío
- [ ] 6.7 Reemplazar el `AvisoModeloDatos` de coberturas ("no hay historial") por el aviso de datos por año (D7); test que lo verifica

## 7. Presupuestos (PR 3)

- [ ] 7.1 RED: `PresupuestoForm.test.tsx` — prestaciones/destinos del año de `vigenciaDesde` (fallback `fechaEmision`); cambio de año quita prestaciones ajenas con aviso; año sin prestaciones → estado vacío con link a la pestaña
- [ ] 7.2 GREEN en `PresupuestoForm.tsx` / `construirDatosTrasladoDesdeRecorridos` (filtrar por año antes de construir)
- [ ] 7.3 RED: obra social = `coberturaVigente(vigenciaDesde)`; sin cobertura → guardado bloqueado; edición de presupuesto viejo conserva su OS
- [ ] 7.4 GREEN en `PresupuestoForm.tsx` (reemplaza la derivación desde `paciente.obraSocialId`)
- [ ] 7.5 `PacienteResumen`/`list()` incluye lo mínimo para 7.1–7.4 (`anio` en prestaciones, coberturas) sin volver a traer la ficha completa; test del repo

## 8. Hojas de ruta (PR 3)

- [ ] 8.1 RED: `recorridosHabitualesDelDia.test.ts` — solo destinos del año de la fecha (spec "Hoja del 2027-03-01", "Año sin destinos")
- [ ] 8.2 GREEN en `shared/lib/hojas-de-ruta/recorridosHabitualesDelDia.ts`

## 9. Documentación y cierre

- [ ] 9.1 `knowledge-base/04_modelo_de_datos.md` §Discrepancias + §Paciente (datos fijos vs. por año) y bullet `⚠️ Discrepancia con Traslados-Modelo-Datos.docx` en `CHANGES.md`
- [ ] 9.2 `knowledge-base/10_preguntas_abiertas.md` ítem 2 → marcar resuelto con link a este change y las respuestas de DA-1…DA-9
- [ ] 9.3 Suite completa verde (`npm test` en `frontend/`) + `npx tsc -b --noEmit`
- [ ] 9.4 Prueba manual con Andrea tras el deploy de Enzo: preparar 2027 de un paciente copiando 2026, crear presupuesto 2027, cambio de OS a mitad de año
