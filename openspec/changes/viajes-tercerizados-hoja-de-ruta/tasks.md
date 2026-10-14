# Tasks — viajes-tercerizados-hoja-de-ruta

> Strict TDD: cada tarea de código arranca con el test en rojo (RED → GREEN → TRIANGULATE →
> REFACTOR). Antes de tocar un archivo existente, correr sus tests como red de seguridad.
> Verificación de tipos SIEMPRE con `npx tsc -b --noEmit` dentro de `frontend/`.
> Las secciones 1-2 (backend) y 3-6 (frontend) son separables: el frontend se puede desarrollar y
> testear entero contra mocks, pero **no se mergea/deploya antes de que Enzo aplique la sección 2**
> (ver design.md Risks).

## 1. Migración (redactada en el repo, NO se aplica desde el agente)

- [ ] 1.1 RED: en `frontend/src/shared/lib/hojas-de-ruta/hojaDeRutaMigrations.test.ts`, agregar un `describe` para la migración nueva que exija: `ADD COLUMN tipo_transporte TEXT NOT NULL DEFAULT 'propio'`, CHECK de los tres valores, `ADD COLUMN agencia_remis TEXT`, `DROP NOT NULL` de `vehiculo_id` y `conductor_id`, la constraint `recorrido_tipo_transporte_coherente`, `ERRCODE = '45305'` y que se conserven `45301`-`45304`; dos `SECURITY INVOKER`, ninguna cláusula activa `SECURITY DEFINER`, `REVOKE ... FROM anon` y `GRANT EXECUTE ... TO authenticated` de las dos funciones; ningún `DROP COLUMN`/`DROP TABLE`
- [ ] 1.2 GREEN: escribir `supabase/migrations/<timestamp>_recorrido_tipo_transporte.sql` (timestamp > `20261014130000`) según design.md D1/D2: cabecera con por qué, decisión de la usuaria 2026-10-14, discrepancia con el docx, rollback y "⚠️ lo aplica Enzo con `supabase db push`"; `ALTER TABLE` + `CREATE OR REPLACE` de `crear_hoja_de_ruta_completa` y `actualizar_hoja_de_ruta_completa` copiadas literalmente de `20260804110000_hoja_de_ruta_rpc.sql` con el diff mínimo de D2
- [ ] 1.3 Revisar el diff de las dos funciones contra `20260804110000` (`diff` de los cuerpos): solo cambian la lista de columnas del `INSERT INTO pacientes.recorrido`, los dos valores nuevos y el handler `check_violation` → `45305`
- [ ] 1.4 Agregar entrada en `docs/PENDIENTE-ENZO.md` ("Viajes tercerizados en hoja de ruta — ⏳ pendiente"): qué es, verificación en vivo previa (`\d pacientes.recorrido`, `pg_get_functiondef` de las dos funciones vs. repo), `supabase db push` con el nombre del archivo, que **no** hay Edge Function que deployar, verificación post (`SELECT tipo_transporte, count(*) ... GROUP BY 1` → solo `propio`; la hoja actual sigue cargando), y "avisarle a Delfi para mergear el frontend recién después"

## 2. Aplicación en Supabase (lo aplica Enzo)

- [ ] 2.1 (lo aplica Enzo) Verificar en vivo que `pacientes.recorrido` y las dos funciones coinciden con el repo; si difieren, avisar antes de aplicar
- [ ] 2.2 (lo aplica Enzo) `supabase db push`
- [ ] 2.3 (lo aplica Enzo) Verificación post-aplicación del punto 1.4 y confirmar a Delfina

## 3. Contrato y lógica pura (frontend, TDD)

- [ ] 3.1 RED/GREEN: en `frontend/src/shared/types/hojaDeRuta.ts`, `TipoTransporte`, `TransporteRecorrido` (unión discriminada), `RecorridoBase`, `Recorrido` y `NuevoRecorrido` según design.md D3, con doc-comment de la discrepancia con el docx. Correr `npx tsc -b --noEmit` y guardar la lista de errores: es el inventario de consumidores a corregir en 3.x-5.x
- [ ] 3.2 RED: `transporteRecorrido.test.ts` — `etiquetaTransporte` (propio con patente/modelo/conductor; propio con referencia no resoluble; `aplicacion` → "Uber / aplicación"; `remis` → "Remis · París"), `esPropio` (las tres variantes), `validarTransporte` (remis con agencia vacía y solo espacios → mensaje; propio sin vehículo o sin conductor → mensaje; aplicación → `null`; remis válido → `null`)
- [ ] 3.3 GREEN + REFACTOR: `frontend/src/shared/lib/hojas-de-ruta/transporteRecorrido.ts` (switch exhaustivo con `never`)
- [ ] 3.4 RED/GREEN: `hojaDeRutaMapping.test.ts` — `parseRecorridoRow` lee `aplicacion` y `remis` sin vehículo/conductor (antes los descartaba), trata como `propio` una fila sin `tipo_transporte`, descarta `propio` sin vehículo y `remis` sin agencia; `toCrearHojaDeRutaPayload`/`toActualizarHojaDeRutaPayload` envían `tipo_transporte`, `agencia_remis` y `null` en `vehiculo_id`/`conductor_id`/`id_vehiculo` de las paradas para tercerizados; un propio sale igual que hoy más `tipo_transporte: 'propio'` y `agencia_remis: null`
- [ ] 3.5 RED/GREEN: `SupabaseHojaDeRutaRepository.test.ts` — el select incluye `tipo_transporte, agencia_remis`; `45305` → "Revisá el tipo de transporte del recorrido."; `45304` sin cambios
- [ ] 3.6 RED/GREEN: `sugerirRecorridoExistente.test.ts` — un recorrido tercerizado nunca se sugiere (narrowing con `esPropio`)
- [ ] 3.7 Fixture/mock: agregar a `shared/lib/mocks/hojasDeRutaFixture.ts` un recorrido `aplicacion` y uno `remis`; ajustar `mockHojaDeRutaRepository.ts` a los tipos nuevos; tests del mock en verde

## 4. UI de alta y edición (frontend, TDD)

- [ ] 4.1 RED/GREEN: `NuevoRecorridoForm.test.tsx` — "Viaje tercerizado" destildado por defecto y comportamiento actual intacto; al tildar se ocultan vehículo/conductor y aparecen "Uber / aplicación" (default) y "Remis" + agencia; crear aplicación y remis llama `onCrear` con la variante correcta; remis sin agencia no llama `onCrear` y muestra el mensaje; sin vehículos compatibles el alta tercerizada es posible; destildar vuelve a exigir vehículo y conductor
- [ ] 4.2 GREEN + REFACTOR: `features/hojas-de-ruta/NuevoRecorridoForm.tsx` (reusar el patrón del checkbox "manual" y componentes de `design-system/components.tsx`; sin inline styles)
- [ ] 4.3 RED/GREEN: `HojaDeRutaPage.test.tsx` — `onCrear` persiste un recorrido tercerizado vía repository; el `AvisoModeloDatos` menciona tipo de transporte/agencia como campos agregados sobre el docx
- [ ] 4.4 GREEN: `features/hojas-de-ruta/HojaDeRutaPage.tsx` (mapping de `onCrear`, búsqueda de vehículo/conductor solo para propios, texto del aviso)
- [ ] 4.5 RED/GREEN: `RecorridoCard.test.tsx` — lectura de un remis muestra "Remis · París"; edición permite pasar propio → remis (pierde vehículo/conductor) y tercerizado → propio (exige vehículo y conductor antes de guardar)
- [ ] 4.6 GREEN + REFACTOR: `RecorridoCard.tsx` y `RecorridoVehiculoConductor.tsx` (reemplazar los spreads `{ ...recorrido, vehiculoId }` por armado explícito de la variante)

## 5. Asignación, vista global, imprimible y dashboard (frontend, TDD)

- [ ] 5.1 RED/GREEN: `AsignacionPanel.test.tsx` — agregar a un tercerizado un paciente con accesorio incompatible y con el "vehículo" lleno no da error; a un propio sigue bloqueando
- [ ] 5.2 GREEN: `AsignacionPanel.tsx` (`vehiculo` opcional, validaciones solo si `esPropio`)
- [ ] 5.3 RED/GREEN: `VistaGlobalHojaDeRuta.test.tsx` — grupos "Flota propia" y "Tercerizados"; mover una parada a un tercerizado no valida capacidad/accesorios; el destino se identifica con `etiquetaTransporte`
- [ ] 5.4 GREEN: `VistaGlobalHojaDeRuta.tsx`
- [ ] 5.5 RED/GREEN: `HojaDeRutaImprimible.test.tsx` — un remis se encabeza "Remis · París" (nunca "Vehículo desconocido"), con paradas, orden y direcciones
- [ ] 5.6 GREEN: `HojaDeRutaImprimible.tsx`
- [ ] 5.7 RED/GREEN: `features/dashboard/RecorridosDelDiaPanel.test.tsx` — tercerizado muestra su etiqueta sin el texto de referencia no disponible; propio con referencia rota sigue mostrándolo
- [ ] 5.8 GREEN: `RecorridosDelDiaPanel.tsx`

## 6. Cierre de verificación (frontend)

- [ ] 6.1 `npx tsc -b --noEmit` en `frontend/` sin errores (el inventario de 3.1 vacío), cero `any`, cero `style={{}}`
- [ ] 6.2 Suite completa de `frontend/` en verde y `oxlint` limpio
- [ ] 6.3 Prueba manual en modo mock: crear "Uber / aplicación" y "Remis · París", recargar, verlos en tarjeta, vista global, imprimible y dashboard

## 7. Documentación

- [ ] 7.1 `knowledge-base/05_reglas_de_negocio.md`: nueva **RN-HR-05** (tipo de transporte por recorrido; propio ⇒ vehículo + conductor; tercerizado ⇒ sin vehículo/conductor, sin validación de capacidad ni RN-VE-01; remis ⇒ agencia texto libre; decisión 2026-10-14)
- [ ] 7.2 `knowledge-base/04_modelo_de_datos.md`: §HojaDeRuta/Recorrido (campos nuevos, ERD `Recorrido N---0..1 Vehiculo/Conductor`) y §Discrepancias (nueva: tipo de transporte y agencia no existen en el docx; pendiente de coordinar con su dueño)
- [ ] 7.3 `knowledge-base/10_preguntas_abiertas.md` §"Preguntas nuevas — reunión con Andrea (2026-10-07)" ítem 1: marcar como **decidido (2026-10-14)** el modelo y la UI (tipo por recorrido, agencia texto libre, vehículo/conductor no requeridos para tercerizados) con referencia a este change, y dejar abiertas: costo (por recorrido o por pasajero, y si va en la hoja o en gastos), nombre de la aplicación, reporte de deuda por agencia, catálogo de agencias
- [ ] 7.4 `CHANGES.md`: entrada del change con alcance, governance MEDIUM-HIGH, dependencia de `integracion-hojas-de-ruta`, bullet `⚠️ Discrepancia con Traslados-Modelo-Datos.docx` y "backend lo aplica Enzo"
