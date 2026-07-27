> **⛔ Governance CRITICO (CHANGES.md C-07) — el nivel más alto del proyecto.** Facturación y cobros: dinero real, plazos legales, seguimiento ante la Superintendencia. La regla de gobernanza para nivel CRITICO es **solo análisis; no se escribe código sin aprobación humana explícita**. **NO ejecutar ninguna task de este archivo** hasta que exista aprobación humana **punto por punto** —no basta con aprobar "el plan"— de: (a) las Decisiones 3, 4, 6, 7, 9 y 10 de `design.md`, que fijan **defaults sobre preguntas abiertas de prioridad Alta sin cerrar con el cliente** (identificador en factura DNI vs. afiliado; período estructurado; la alerta de cupo avisa pero **no bloquea**; plazos 90/45/60 y **su precedencia**, donde el amparo judicial gana sobre el plazo de la obra social; ARCA como adjunto manual sin API; estado derivado de los cobros); y (b) las **5 discrepancias de impacto backend** con `docs/core/Traslados-Modelo-Datos.docx` (`AsistenciaPrestacion` inexistente, documentos por factura inexistentes, `fechaEstimadaCobro` inexistente, `cantidadKm` inexistente, enum de estados divergente), que deben confirmarse con quien mantiene el docx **antes** de cerrar el esquema del backend `C-07`.
>
> **Strict TDD**: todas las funciones puras de reglas de negocio de la sección 3 se implementan **test-first** (RED → GREEN → triangulación con al menos un caso borde → REFACTOR). Antes de tocar archivos existentes, correr el safety net (`npm test` en `frontend/`) y registrar el baseline.
>
> **Reglas duras del proyecto**: TypeScript strict, prohibido `any` (usar `unknown` + narrowing); solo clases utilitarias de Tailwind v4, prohibido `style={{}}` inline; prohibido crear cliente Supabase real, migraciones o RLS en este change; keys de lista por id estable, nunca índice de array; componentes < ~200 líneas.

## 1. Contrato de datos (tipos)

- [x] 1.1 Crear `frontend/src/shared/types/factura.ts`, importando (nunca redefiniendo) `TipoComprobante`, `PlantillaFactura`, `PlantillaCampo`, `OrigenCampoPlantilla` e `IdentificadorOrigenFactura` de `obraSocial.ts`, `CupoAutorizado` de `presupuesto.ts`, y `ChecklistItem`/`DocumentoAdjunto` de `documento.ts`. Sin `any`. **No importar nada de `hojaDeRuta.ts`** (RN-FA-01, design.md Decisión 2).
- [x] 1.2 Definir `EstadoFactura = 'a-facturar' | 'facturado' | 'cobrado' | 'pagado-parcialmente'` (unión cerrada) y comentar la Discrepancia 5 (el docx enumera "pendiente" y no tiene "facturado"; "pendiente" se trata como sinónimo de `a-facturar`).
- [x] 1.3 Definir `IdentificadorFactura` (`{ origen: IdentificadorOrigenFactura; valor: string }`) como snapshot congelado al emitir (IN-01, design.md Decisión 3).
- [x] 1.4 Definir `AsistenciaPrestacion` (`id`, `fecha`, `prestacion`, `dependencia`, `retorno`, `facturaSabados: boolean`), comentada como **entidad agregada sobre el docx** (Discrepancia 1) y **sin ningún campo que referencie recorridos** (RN-FA-01).
- [x] 1.5 Definir `Factura` con los campos del docx (`id`, `pacienteId`, `descripcion`, `dias`, `valorKm`, `monto`, `estado`, `fechaInicial`, `fechaTope`, `tipoComprobante`) más los agregados: `cantidadKm` (Discrepancia 4), `fechaEstimadaCobro?` y `fechaFactura?` (Discrepancia 3), y los estructurados de la descripción (`prestacion`, `mesFacturado`, `anioFacturado`, `dependenciaYRetorno`, `domicilioId`, `identificadorFactura`) más `asistencias: AsistenciaPrestacion[]`. Comentar cada agregado con su discrepancia.
- [x] 1.6 Definir `Cobro` (`id`, `facturaId`, `fecha`, `montoPagado`), comentando que el `id` es un agregado sobre el docx (Discrepancia 7) requerido para keys estables.
- [x] 1.7 Definir los payloads `NuevaFactura`/`ActualizacionFactura` y `NuevoCobro`/`ActualizacionCobro` (sin `id`, sin permitir cambiar el `id`).

## 2. Constantes configurables

- [x] 2.1 Crear `frontend/src/shared/lib/facturacion/constantes.ts` con `PLAZO_COBRO_DEFAULT_DIAS = 90`, `PLAZO_COBRO_AMPARO_DIAS = 45` y `PLAZO_ALERTA_VENCIDA_DIAS = 60`, cada una documentando su regla de origen (RN-FA-04, RF-406) y que está **pendiente de confirmar con el cliente** (`10_preguntas_abiertas.md`, prioridad Alta). Patrón: `shared/lib/mantenimiento/constantes.ts`.
- [x] 2.2 Verificar que ningún componente ni función de dominio contenga los literales `90`, `45` o `60` como plazo: siempre se importan de `constantes.ts` o llegan por parámetro.

## 3. Funciones puras de reglas de negocio (Strict TDD — test-first)

- [x] 3.1 `renderDescripcionFactura(plantilla, datos)` → string: recorre `plantilla.campos` por `orden` y resuelve cada `OrigenCampoPlantilla` (incluido `valor-manual` y `traslado.mesYAnio` formateado desde mes/año numéricos). Pura, sin repositorios ni fecha del sistema. Casos: orden respetado, dos plantillas distintas, cobertura de los campos de US-400, campo manual.
- [x] 3.2 `resolverIdentificadorFactura(paciente, identificadorOrigen)` → `IdentificadorFactura`: devuelve DNI o número de afiliado según lo configurado en la obra social (IN-01). Casos: cada origen, y que no exista ninguna constante local que fije uno de los dos.
- [x] 3.3 `diasFacturables({ mes, anio, feriados, facturaSabados })` → fechas facturables: excluye feriados del catálogo recibido, excluye domingos, incluye sábados solo si `facturaSabados` (RN-FA-03). Casos: feriado excluido, sábado incluido/excluido, sábado feriado (gana la exclusión), catálogo vacío.
- [x] 3.4 `cupoConsumido(facturas, pacienteId, mes, anio)` → `{ dias, km }`: suma solo facturas del mismo paciente y período en estado `facturado`/`cobrado`/`pagado-parcialmente`, excluyendo la factura en edición. Casos: `a-facturar` no cuenta, factura en edición excluida, aislamiento por paciente y por mes.
- [x] 3.5 `validarCupoFacturacion({ diasFacturados, kmFacturados, cupo })` → resultado con `excedeDias`/`excedeKm` y mensaje comparativo (RN-FA-02). Casos: exceso de días, exceso de km, dentro del cupo, cupo ausente o sin valores cargados.
- [x] 3.6 `calcularFechaEstimadaCobro({ fechaFactura, amparoJudicial, plazoObraSocial })` → ISO date, contando desde la fecha de factura (RN-FA-04). Precedencia: amparo > plazo de la obra social > default. Casos: uno por cada rama de la precedencia, y verificación de que el día cero es la fecha de factura.
- [x] 3.7 `estadoVencimientoFactura({ fechaFactura, hoy, estado })` → vencida / no vencida (RF-406). Casos: `facturado` vencida, `pagado-parcialmente` vencida, `cobrado` nunca vencida, dentro del plazo.
- [x] 3.8 `calcularTotalFactura({ valorKm, cantidadKm })` y `saldoFactura(factura, cobros)`. Casos: total producto, saldo con cobros parciales, saldo cero, factura sin cobros.
- [x] 3.9 `estadoDerivadoFactura(factura, cobros)` → `EstadoFactura`: sin cobros `facturado`; con saldo > 0 `pagado-parcialmente`; saldo 0 `cobrado`. Casos: primer cobro parcial, cobros que saldan, baja de cobro que reabre saldo.

## 4. Repositories e implementaciones mock

- [x] 4.1 Crear `frontend/src/shared/lib/facturacion/FacturaRepository.ts` (`list()`, `getById(id)` → `null` si no existe, `listByPaciente(pacienteId)`, `create(data)`, `update(id, data)`). Las `AsistenciaPrestacion` viven embebidas en la `Factura`, sin repository aparte.
- [x] 4.2 Crear `frontend/src/shared/lib/facturacion/CobroRepository.ts` (`listByFactura(facturaId)`, `create(data)`, `remove(id)`).
- [x] 4.3 Crear `frontend/src/shared/lib/mocks/feriadosFixture.ts` con feriados nacionales del año del fixture, incluyendo al menos uno dentro del período de alguna factura sembrada.
- [x] 4.4 Crear `frontend/src/shared/lib/mocks/facturasFixture.ts`: facturas con `pacienteId` existentes en `pacientesFixture` y obra social existente, con **una factura por cada estado del circuito** y al menos una del paciente con `amparoJudicial: true`. Verificar/ajustar que el fixture de pacientes tenga un paciente con amparo judicial y que el de autorizaciones tenga cupos de días y km cargados (si falta, sumarlo sin cambiar los contratos existentes).
- [x] 4.5 Crear `frontend/src/shared/lib/mocks/cobrosFixture.ts` con al menos una factura con cobros parciales y una saldada.
- [x] 4.6 Crear `mockFacturaRepository.ts` y `mockCobroRepository.ts`: cumplen las interfaces al pie de la letra, persisten en `localStorage` (claves `facturas` y `cobros`, con `schemaVersion`), siembran desde fixture cuando no hay datos y devuelven promesas con latencia simulada (patrón `mockPresupuestoRepository`).
- [x] 4.7 Manejar mismatch de `schemaVersion` / payload corrupto: re-sembrar desde fixture en vez de romper la deserialización.

## 5. Hooks y puntos de inyección

- [x] 5.1 Crear `useFacturas(repository)` con datos, `loading`, `error`, `crear()`, `actualizar()` y recarga tras cada mutación (patrón `usePresupuestos`). Devuelve un objeto, no un array.
- [x] 5.2 Crear `useCobros(repository, facturaId)` con datos, `loading`, `error`, `registrar()`, `eliminar()` y recarga tras cada mutación.
- [x] 5.3 Crear `FacturaRepositoryContext` y `CobroRepositoryContext` (provider + hook de consumo), de modo que ninguna pantalla importe los mocks directamente (patrón `PresupuestoRepositoryContext`).

## 6. Pantalla de facturación (listado + detalle)

- [x] 6.1 Crear `frontend/src/features/facturacion/FacturacionPage.tsx` con listado de facturas (paciente, período, monto, estado), estados de carga/vacío/error, y filtros por paciente y por mes/año. Keys por id estable.
- [x] 6.2 Aplicar la convención de UI del proyecto: fila de listado clickeable en su totalidad más botón "Editar" con `stopPropagation`.
- [x] 6.3 Crear `FacturaDetail.tsx`: descripción persistida, período, días, valor del km, cantidad de km, total, tipo de comprobante, estado, fecha de factura, fecha estimada de cobro con el motivo del plazo aplicado, y señalización de factura vencida.
- [x] 6.4 Agregar el `AvisoModeloDatos` único agrupando las 5 discrepancias de impacto backend (design.md Decisión 14).

## 7. Formulario de factura

- [x] 7.1 Crear `FacturaForm.tsx` con selector de paciente (`PacienteRepository` inyectado, solo lectura), período estructurado (mes 1-12 + año, año pre-cargado con el actual y editable), prestación, selector de domicilio poblado con `paciente.direcciones` (guarda solo el id), dependencia y retorno.
- [x] 7.2 Campos económicos: **valor del km de carga manual** (sin autocompletado ni tabla de tarifas, RN-FA-05), cantidad de km, cantidad de días, y total propuesto con `calcularTotalFactura` pero editable.
- [x] 7.3 Pre-cargar el tipo de comprobante desde `obraSocial.tipoComprobante` del paciente, dejándolo editable (RN-FA-07).
- [x] 7.4 Crear `validateFacturaForm.ts` (función pura, test-first): errores por campo ante paciente, período, valor del km o cantidad de días faltantes; no invoca al repository si hay errores.
- [x] 7.5 Crear `AsistenciasEditor.tsx`: alta/baja/edición de `AsistenciaPrestacion` embebidas (fecha, prestación, dependencia, retorno, `facturaSabados`). **No consulta ninguna fuente de recorridos** (RN-FA-01).
- [x] 7.6 Mostrar la **vista previa en vivo** de la descripción renderizada mientras la factura está en `a-facturar` (design.md Decisión 5).

## 8. Días facturables y validación de cupo

- [x] 8.1 Crear `DiasFacturablesSelector.tsx`: pre-selecciona los días devueltos por `diasFacturables` al elegir el período, marca visualmente los feriados como excluidos, y permite marcar/desmarcar días; la cantidad de días de la factura es el conteo confirmado por el usuario (US-400: carga manual).
- [x] 8.2 Consumir `PresupuestoRepository` + `AutorizacionRepository` (inyectados, solo lectura) y `derivarCupoAutorizado` para obtener el `CupoAutorizado` del paciente — **sin reimplementar la derivación**.
- [x] 8.3 Crear `AlertaCupo.tsx`: muestra de forma persistente (no efímera) el resultado de `validarCupoFacturacion` con el mensaje comparativo, y avisa explícitamente cuando no hay cupo contra el cual validar.
- [x] 8.4 Exigir **confirmación explícita** del usuario para emitir una factura que excede el cupo, **sin bloquear** la emisión (design.md Decisión 6, RN-FA-02).

## 9. Circuito de estados y cobros

- [x] 9.1 Implementar la acción de **emitir** (`a-facturar → facturado`): fija `fechaFactura`, congela `descripcion` e `identificadorFactura`, y calcula y persiste `fechaEstimadaCobro` (US-400). Pasa por la validación de cupo del 8.4.
- [x] 9.2 Crear `CobrosPanel.tsx`: alta de cobro (fecha + monto), listado ordenado por fecha, baja de cobro, saldo pendiente y total cobrado visibles. No se ofrece registrar cobros en facturas `a-facturar`.
- [x] 9.3 Crear `validateCobroForm.ts` (función pura, test-first): monto positivo obligatorio, fecha obligatoria, y alerta cuando la suma cobrada superaría el monto de la factura.
- [x] 9.4 Recalcular el estado con `estadoDerivadoFactura` tras cada alta/baja de cobro y persistirlo; permitir la corrección manual del estado mostrando la inconsistencia de forma visible en vez de sobrescribirla en silencio (design.md Decisión 10).

## 10. Documentación adjunta por factura

- [x] 10.1 Crear `FacturaDocumentos.tsx` reutilizando `DocumentChecklist` + `useDocumentChecklist` + `DocumentoRepository` inyectado, con `entidad='factura'` y `entidadId = factura.id` (patrón `PacienteDocumentosChecklist`/`ConductorDocumentos`).
- [x] 10.2 Alimentar los ítems del checklist desde `obraSocial.checklist` del paciente, **respetando el orden del array** (RN-FA-08). Mostrar el estado de completitud sin bloquear la emisión.
- [x] 10.3 Verificar que no se agregue ningún cliente HTTP, campo de modelo ni variable de entorno de ARCA: el comprobante es un ítem más del checklist (design.md Decisión 9).
- [x] 10.4 Agregar el `AvisoModeloDatos` de la discrepancia de documentos por factura junto a esta sección.

## 11. Exportación / impresión

- [x] 11.1 Crear `FacturaImprimible.tsx` (componente presentacional puro, recibe factura, asistencias, paciente, obra social y cobros por props): imprime la **descripción persistida**, los datos económicos, el detalle de asistencias y, si existen, los cobros y el saldo. Patrón `HojaDeRutaImprimible.tsx`, con utilidades `print:` de Tailwind v4 y sin `style={{}}` inline.
- [x] 11.2 Verificar que **no se agregue ninguna dependencia** de generación de PDF a `frontend/package.json` (design.md Decisión 13).

## 12. Montaje de la feature

- [x] 12.1 Crear `FacturacionRoute.tsx` como composition root: monta `FacturaRepositoryContext` y `CobroRepositoryContext` con sus mocks, más `PacienteRepositoryContext`, `ObraSocialRepositoryContext`, `PresupuestoRepositoryContext`, `AutorizacionRepositoryContext` y `DocumentoRepositoryContext` de solo lectura (patrón `PresupuestosRoute`/`HojaDeRutaRoute`).
- [x] 12.2 Reemplazar el `element` de `/facturacion` en `frontend/src/app/router.tsx` por `<FacturacionRoute />` y sumar el comentario de trazabilidad que ya sigue el archivo. **No tocar `routes.ts`.**
- [x] 12.3 Extraer subcomponentes donde haga falta para mantener todos los componentes < ~200 líneas.

## 13. Verificación y cierre

- [x] 13.1 Correr `npm test` en `frontend/` y confirmar que toda la suite pasa (incluido el baseline previo, sin regresiones).
- [x] 13.2 Correr `npm run build` (`tsc -b`) y `npm run lint` en `frontend/`: cero errores de tipos, cero `any`, cero `style={{}}` inline.
- [x] 13.3 Agregar un test que verifique que `factura.ts` y la feature `facturacion` **no importan nada de `hojaDeRuta.ts`** ni consultan `HojaDeRutaRepository` (garantía estructural de RN-FA-01, design.md Decisión 2).
- [x] 13.4 Actualizar `knowledge-base/04_modelo_de_datos.md §Discrepancias` con las discrepancias nuevas de este change (`AsistenciaPrestacion` inexistente, `cantidadKm` inexistente, enum de estados divergente) y marcar como resueltas-en-frontend las ya registradas (documentos por factura, plazo de cobro), siguiendo el formato de las entradas existentes.
- [x] 13.5 Actualizar el bullet de discrepancia de `CHANGES.md §C-07` y agregar la línea de "Progreso frontend (mock, vía FE-6)" con el mismo formato que los demás changes.
- [x] 13.6 Dejar registradas en `knowledge-base/10_preguntas_abiertas.md` las decisiones tomadas sobre las preguntas de prioridad Alta (identificador, plazos y su precedencia, ARCA, año/período) como "default implementado, pendiente de confirmación", sin darlas por cerradas.
