## Context

Fase **FE-6** del `ROADMAP-FRONTEND.md`, lado UI + mock de `C-07 facturacion-asistencias-cobros`. El circuito de negocio (`07_flujos_principales.md §Flujo 3`, docx §5 Facturación): al cierre de mes Facturación revisa las asistencias/prestaciones declaradas del período, arma la descripción según la plantilla de la obra social del paciente, carga manualmente días y valor del km, el sistema valida contra el cupo autorizado y alerta si se supera, se excluyen feriados, se emite la factura con el tipo de comprobante que corresponde, se adjunta la documentación de respaldo (comprobante ARCA, asistencia, CODEM), el sistema calcula la fecha estimada de cobro, se registran cobros o pagos parciales a medida que ingresan, y se alerta si se supera el plazo esperado para hacer seguimiento ante la Superintendencia.

Se construye **frontend + mock**: el backend real (`C-07`: tablas `factura`/`asistencia_prestacion`/`cobro`, RLS, validación dura) es otra sesión/agente.

Estado actual del frontend (ya existe, se reutiliza como patrón y como insumo):
- Stack: React 19 + TypeScript strict + Tailwind v4 (Vite) + React Router 7. Vitest + React Testing Library.
- Patrón consolidado en FE-1..FE-5: **contrato → mock → hook → componente presentacional**. `XRepository` (interfaz) + `mockXRepository` (`localStorage` + `schemaVersion` + fixture + latencia) + `useX` (hook de wiring) + `XRepositoryContext` (inyección) + componentes presentacionales.
- **Insumos ya listos que este change consume de solo lectura:**
  - `ObraSocial.plantillaFactura` (`PlantillaCampo[]` con `etiqueta`/`origen`/`orden`, más `identificadorOrigen`), `tipoComprobante`, `plazoCobroDias`, `checklist` — de `obras-sociales-ui` (`C-04`). `OrigenCampoPlantilla` ya cubre exactamente los campos que pide US-400 (`paciente.nombre`, `paciente.dni`, `paciente.numeroAfiliado`, `paciente.domicilio`, `traslado.prestacion`, `traslado.mesYAnio`, `traslado.cantidadDias`, `traslado.dependenciaYRetorno`, `traslado.valorKm`, `traslado.cantidadKm`, `traslado.total`, `valor-manual`).
  - `Paciente.dni`, `Paciente.numeroAfiliado` (`IdentificadorAfiliado`), `Paciente.direcciones`, `Paciente.obraSocialId` y **`Paciente.amparoJudicial: boolean`** (el flag ya existe, documentado como "afecta plazos de cobro en Facturación, FE-6") — de `pacientes-ui` (`C-05`).
  - `CupoAutorizado` (`{ pacienteId, cupoMensualDias?, cupoMensualKm?, vigenciaDesde? }`) + `derivarCupoAutorizado(autorizacion, pacienteId)` — de `presupuestos-ui` (`C-06`), que dejó el dato consultable delegando explícitamente el control de facturación a FE-6.
  - `DocumentChecklist` + `useDocumentChecklist` + `DocumentoRepository` (`listByEntity`/`upload`/`remove`) — de `C-03`/FE-1. **`EntidadDocumental` ya incluye `'factura'`.**
  - `AvisoModeloDatos` (`frontend/src/design-system/components.tsx`) y primitivos del design-system.
  - `HojaDeRutaImprimible.tsx` como patrón de vista imprimible con utilidades `print:` de Tailwind, sin librería de PDF.
  - `shared/lib/mantenimiento/constantes.ts` como patrón de "umbrales configurables en un único módulo, nunca números mágicos en componentes".
- Convención de UI (`08_arquitectura_propuesta.md`): listado + detalle, fila clickeable completa (`onClick` en el `<li>`, botón "Editar" con `stopPropagation`).

Restricciones duras del proyecto (`CLAUDE.md`): TypeScript strict, prohibido `any` (usar `unknown` + narrowing); estilar SOLO con clases utilitarias de Tailwind v4, prohibido `style={{}}` inline (tokens en `@theme` de `frontend/src/index.css`); prohibido crear cliente Supabase real / RLS / migraciones en este change; Conventional Commits; **estructura del docx + reglas de negocio de la KB, discrepancias documentadas en los dos lugares a la vez (KB/CHANGES.md y cartel `AvisoModeloDatos` en la UI), nunca resueltas adivinando**.

### ⛔ Governance CRITICO — condición de arranque del apply

`CHANGES.md §C-07` marca este dominio como **CRITICO** (el más alto del proyecto: dinero real, plazos legales, seguimiento ante la Superintendencia). La regla global de gobernanza para nivel CRITICO es **"solo análisis; no se escribe código sin aprobación humana explícita"**.

Este documento y el resto de los artefactos son planificación, no código. **El `apply` NO puede arrancar con una aprobación genérica del plan.** Requiere revisión humana **punto por punto** de:

- Las **14 Decisiones** de este documento, con foco en las que fijan un **default sobre una pregunta abierta de prioridad Alta sin cerrar con el cliente**: Decisión 3 (identificador en factura), Decisión 4 (año/período estructurado), Decisión 7 (plazos 90/45/60 **y su precedencia**), Decisión 9 (ARCA como adjunto manual), Decisión 6 (la alerta de cupo **avisa, no bloquea**).
- Las **6 discrepancias con el docx**, en especial las 4 que agregan estructura inexistente en el modelo real (`AsistenciaPrestacion`, `cantidadKm`, `fechaEstimadaCobro`, documentos por factura) y que el backend `C-07` tiene que absorber.
- Las **Open Questions** al final de este documento.

Cada default fijado acá es una **decisión reversible y aislada** (constante configurable o función pura), justamente para que la revisión humana pueda cambiarla sin reescribir componentes.

## Goals / Non-Goals

**Goals:**
- Contrato de datos `Factura` + `AsistenciaPrestacion` + `Cobro` y sus repositories que no haya que reescribir cuando llegue `C-07` backend, cruzando `04_modelo_de_datos.md §Factura` con `docs/core/Traslados-Modelo-Datos.docx §5 Facturación`.
- Formulario de factura que arme la **descripción según la plantilla dinámica** de la obra social del paciente (US-400), sin reimplementar la plantilla (ya es contrato de `C-04`).
- Todas las **reglas de negocio como funciones puras testeables** (Strict TDD, test-first): descripción, días facturables, cupo consumido/validación, fecha estimada de cobro, vencimiento, saldo, estado derivado, total.
- Todos los **valores sin confirmar del cliente como constantes configurables documentadas** en un único módulo — nunca hardcodeados en componentes.
- Circuito de estados completo y registro de cobros/pagos parciales.
- Checklist documental por factura configurable por obra social (RN-FA-08), con ARCA resuelto como adjunto manual.
- Vista imprimible de factura + asistencia.
- Documentar y señalizar en UI **todas** las discrepancias KB ↔ docx.

**Non-Goals:**
- Cliente Supabase real, migraciones SQL (`factura`, `asistencia_prestacion`, `cobro`, `documento_factura`), RLS, buckets de storage — es `C-07` backend / FE-8.
- Cualquier llamada a la API de ARCA (Decisión 9).
- Automatizar el valor del km / nomenclador nacional (RN-FA-05: carga manual, fuera de alcance Fase 1).
- Ajustes retroactivos de valores de facturas ya emitidas (RN-FA-06: fuera de alcance Fase 1).
- Modificar `PacienteRepository`, `ObraSocialRepository`, `PresupuestoRepository`, `AutorizacionRepository` o `DocumentoRepository`: se **consumen** de solo lectura.
- Cualquier dependencia con Hojas de Ruta / recorridos (RN-FA-01 — ver Decisión 2).
- Generación real de PDF con librería (weasyprint, jsPDF, etc.) — Decisión 13.
- Dashboard de mora, diferencia facturado/cobrado y resumen anual: es `C-11` / FE-7.
- Envío de mail o subida al portal de la obra social: la exportación termina en la vista imprimible.

## ⚠️ Discrepancias con Traslados-Modelo-Datos.docx

Comparación hecha 2026-07-25 entre `knowledge-base/04_modelo_de_datos.md §Factura` (+ scope de `C-07` en `CHANGES.md` + US-400 + RN-FA-01..08) y el modelo de datos real del cliente (`docs/core/Traslados-Modelo-Datos.docx §5 Facturación`, entidades **Facturas** y **Cobros**). Mismo formato que la sección de discrepancias de `04_modelo_de_datos.md`. Las que afectan una decisión visible en pantalla se marcan además con `AvisoModeloDatos` en la UI (Decisión 14).

**Campos reales según el docx:**
- **Facturas** (docx): `id`, **Paciente**, **Descripción** ("detalle del servicio facturado"), **Días**, **Valor del kilómetro**, **Monto** (importe total), **Estado** ("a facturar, cobrada, pagada parcialmente o pendiente"), **Fecha inicial / tope** ("período que cubre la factura y su fecha límite"), **Tipo de factura** (A/B/C). Relaciones: 1 Paciente; N Cobros.
- **Cobros** (docx): **Factura**, **Fecha**, **Monto pagado**. Relación: N Cobros por Factura, hasta cubrir el total.
- El área Facturación del docx contiene **solo** Presupuesto, Autorización, Facturas, Cobros y Gastos de Vehículos.

**Discrepancias:**

1. **No existe la entidad `AsistenciaPrestacion` en el docx (NUEVA, impacto backend).** La KB modela `Factura 1---N Asistencia/Prestacion` (`04_modelo_de_datos.md §ERD`) y el scope de `C-07` en `CHANGES.md` pide explícitamente la tabla `asistencia_prestacion`. El docx **no tiene ninguna entidad de asistencias/prestaciones** en el área Facturación (ni en ninguna otra). Sin ella, RN-FA-01 ("las prestaciones declaradas se facturan íntegramente, el recorrido efectivo es independiente") no tiene dónde persistir lo declarado, y la exportación "factura + asistencia" (US-400) no tiene qué exportar. **Decisión (ver Decisión 2):** se agrega `AsistenciaPrestacion` al contrato del frontend, embebida en la `Factura` (agregado), sin repository aparte. **El backend `C-07` debe crear la tabla `asistencia_prestacion`** — pendiente de confirmar con quien mantiene el docx. **Cartel en UI.**

2. **No existe tabla de documentos por Factura en el docx (KNOWN, ya registrada en `04_modelo_de_datos.md §Discrepancias` y `CHANGES.md §C-07`).** La KB asume `Factura 1---N DocumentoFactura` (comprobante ARCA, asistencia, CODEM) y US-400 lo exige. En el docx, Presupuesto y Autorización tienen **un campo "Archivo" único cada uno**, y **Factura no tiene ningún adjunto**. Es el mismo patrón de gap que `C-04`. **Decisión (ver Decisión 8):** a diferencia de `presupuestos-ui` (que usó archivo único porque el docx sí modelaba un "Archivo"), acá se reutiliza el patrón multi-documento de `C-03` (`DocumentChecklist` + `DocumentoRepository`, `entidad='factura'`), porque (a) `EntidadDocumental` **ya incluye `'factura'`** desde FE-1, (b) RN-FA-08 exige un checklist configurable por obra social con orden significativo, y (c) US-400 enumera varios documentos distintos por factura. **El backend `C-07` debe crear la tabla `documento_factura`.** **Cartel en UI.**

3. **No existe campo de plazo / fecha estimada de cobro en la Factura del docx (KNOWN, ya registrada en la KB y en `CHANGES.md §C-07`).** RN-FA-04, US-400 y RF-405/406 exigen calcular y mostrar la fecha estimada de cobro (90/45 días) y alertar por vencimiento (60 días). El docx tiene **"Fecha inicial / tope"** descripto como "período que cubre la factura y su fecha límite" — **ambiguo**: no está claro si "tope" es el fin del período facturado o la fecha límite de cobro, y no hay ningún campo de plazo en días. **Decisión (ver Decisión 7):** el contrato agrega `fechaEstimadaCobro?: string` (ISO, calculada al pasar a `facturado` y persistida) **además de** `fechaInicial`/`fechaTope` del docx, que se conservan como el período facturado. `plazoCobroDias` ya vive en `ObraSocial` (contrato de `C-04`, también ausente en el docx). **El backend `C-07` debe agregar `fecha_estimada_cobro` a `factura`.** **Cartel en UI.**

4. **No existe "cantidad de km" en la Factura del docx (NUEVA, impacto backend).** El docx tiene **"Valor del kilómetro"** (tarifa) y **"Monto"** (total), pero **no la cantidad de km**. US-400 la pide explícitamente en la descripción ("valor del km, cantidad de km y total"), `OrigenCampoPlantilla` ya tiene `'traslado.cantidadKm'`, y sin ella **es imposible validar el cupo mensual de kilómetros** de la Autorización (RN-FA-02, RN-PA-03) ni derivar el total. **Decisión:** se agrega `cantidadKm: number` al contrato. **El backend `C-07` debe agregar `cantidad_km` a `factura`.** **Cartel en UI.**

5. **Los estados del docx y los de la KB no coinciden (NUEVA, impacto backend).** docx: "a facturar, **cobrada**, **pagada parcialmente** o **pendiente**" — **no tiene `facturado`**. KB/US-400: "a facturar/pendiente, **facturado**, cobrado, pagado parcialmente". Sin el estado `facturado` **no hay disparador para el cálculo de la fecha estimada de cobro** ("al pasar a facturado se calcula la fecha estimada de cobro", US-400) ni para la alerta de vencimiento. **Decisión (ver Decisión 10):** se adopta la unión de la KB — `EstadoFactura = 'a-facturar' | 'facturado' | 'cobrado' | 'pagado-parcialmente'` — tratando el `pendiente` del docx como **sinónimo de `a-facturar`** (la propia KB los agrupa: "a facturar/pendiente"). **El backend `C-07` debe alinear el enum de `estado`.** **Cartel en UI.**

6. **Los campos estructurados de la descripción no existen en el docx (menor, decisión de modelado).** US-400 exige que la descripción incluya identificador, domicilio, prestación, mes y año, cantidad de días, dependencia y retorno, valor del km, cantidad de km y total. El docx colapsa todo eso en un único campo de texto **"Descripción"**. **Decisión (ver Decisión 5):** se persisten **ambas cosas**: los campos estructurados (`prestacion`, `mesFacturado`, `anioFacturado`, `dependenciaYRetorno`, `domicilioId`, `identificadorFactura`, `cantidadKm`) **y** la `descripcion` renderizada y congelada. Motivo: los estructurados son necesarios para validar el cupo *mensual* y para el reporte anual de `C-11`; el texto congelado respeta el docx y RN-FA-06 (sin ajustes retroactivos). El backend decide si normaliza los estructurados o guarda solo el texto — **queda documentado, sin cartel dedicado** (se cubre con el cartel de la Discrepancia 4).

7. **`Cobros` no tiene `id` propio en el docx (menor).** El docx lista solo Factura / Fecha / Monto pagado. Se agrega `id: string` porque React exige keys estables por id (nunca índice de array) y porque el borrado/edición de un cobro puntual lo requiere. Sin cartel.

> Estas discrepancias se devuelven también en el resumen del propose. Las de impacto backend (**1, 2, 3, 4 y 5**) deben coordinarse con quien mantiene el docx **antes** de cerrar el esquema de las tablas `factura`, `asistencia_prestacion`, `cobro` y `documento_factura` — governance CRITICO.

## Decisions

### Decisión 1 — `Factura` como agregado; `Cobro` con repository propio
`Factura` embebe sus `AsistenciaPrestacion[]` (se declaran y facturan juntas, mismo ciclo de vida — RN-FA-01) y se persiste vía `FacturaRepository`. `Cobro` **sí** tiene repository propio (`CobroRepository`, con `listByFactura(facturaId)`), porque los cobros llegan **después** de emitida la factura, a lo largo de meses, con su propio ciclo de vida, y son la tabla que `C-11` va a agregar por período. Mismo criterio que `hojas-de-ruta-ui` usó para embeber `Recorrido` en `HojaDeRuta` pero separar entidades con ciclos de vida distintos (`presupuestos-ui`, Decisión 2).
- **Alternativa descartada:** embeber los cobros en la factura — dificultaría el swap a la tabla `cobro` del docx (que es una entidad propia) y el reporte agregado de `C-11`.
- **Alternativa descartada:** repository propio para `AsistenciaPrestacion` — el docx no tiene ni siquiera la tabla (Discrepancia 1); embeberla mantiene el gap contenido en un solo lugar.

### Decisión 2 — RN-FA-01 se garantiza **estructuralmente**: cero acoplamiento con Hojas de Ruta
`AsistenciaPrestacion` (`{ id, fecha, prestacion, dependencia, retorno, facturaSabados }`) **no tiene ningún campo que referencie `Recorrido`, `HojaDeRuta` ni `ParadaRecorrido`**, y `factura.ts` **no importa nada de `hojaDeRuta.ts`**. La feature `facturacion` **no monta `HojaDeRutaRepositoryContext`**. Motivo: RN-FA-01 dice que las prestaciones declaradas se facturan íntegramente y que el recorrido efectivo "es independiente y no se deriva ni valida a partir del número de prestaciones declaradas" (ej.: un paciente con 5 prestaciones semanales puede concentrar 2 terapias en un mismo día). La forma más barata y verificable de cumplir una regla de "no se deriva" es **no tener la referencia**: se vuelve un test de import, no una convención que alguien pueda romper sin darse cuenta.
- **Alternativa descartada:** referenciar `recorridoId` opcional "por trazabilidad" — abre la puerta a que una futura pantalla derive o valide prestaciones desde el recorrido, que es exactamente lo que RN-FA-01 prohíbe.

### Decisión 3 — El identificador de la factura se **resuelve** desde la obra social y se **congela** en la factura (pregunta abierta Alta, IN-01)
La pregunta abierta "¿el identificador del paciente en la factura es el DNI o el N° de afiliado?" **ya fue resuelta estructuralmente en `C-04`**: `PlantillaFactura.identificadorOrigen: 'paciente.dni' | 'paciente.numeroAfiliado'`, **configurable por obra social**, con la resolución propuesta de IN-01 ("definir explícitamente, por obra social, qué campo alimenta el identificador — podría no ser el mismo para todas"). **FE-6 no re-decide nada**: lee `obraSocial.plantillaFactura.identificadorOrigen` del paciente y resuelve el valor.

El valor resuelto se **persiste** en `Factura.identificadorFactura: { origen: IdentificadorOrigenFactura; valor: string }` como **snapshot al emitir**. Motivo: si mañana la obra social cambia su plantilla, las facturas ya emitidas no deben mutar su identificador (RN-FA-06, sin ajustes retroactivos; y una factura emitida es un documento fiscal). El **default heredado** cuando la obra social no lo configuró es el ya documentado en el fixture de `obras-sociales-ui` (`osecacFixture`: `'paciente.numeroAfiliado'`), no una constante nueva de este change.
- **Alternativa descartada:** derivar el identificador en tiempo de render desde la obra social actual — las facturas viejas cambiarían al cambiar la plantilla.
- **Alternativa descartada:** fijar DNI o afiliado como constante global — contradice IN-01 (varía por obra social) y la regla de "configurable, nunca hardcodeado".
- **A confirmar con el cliente:** que el default por obra social sea el número de afiliado y no el DNI. Reversible: es un dato del fixture/formulario, no lógica.

### Decisión 4 — El período se modela **estructurado** (`mesFacturado` + `anioFacturado`), no como texto libre (pregunta abierta Alta)
Pregunta abierta: "¿el año se carga manualmente o se genera de forma estructurada desde la aplicación?". **Default fijado: estructurado** — `mesFacturado: number` (1-12) y `anioFacturado: number`, con selectores en el formulario (el año se pre-carga con el actual y es editable, para permitir facturación retroactiva). Motivos: (a) la validación de cupo de RN-FA-02 es **mensual** (`cupoMensualDias`/`cupoMensualKm`), así que el sistema **necesita** el mes y el año como números para sumar lo ya facturado del período; (b) `C-11` pide resumen **anual** por período; (c) el selector de días facturables (RN-FA-03) necesita saber de qué mes son los días. La plantilla renderiza el campo `'traslado.mesYAnio'` formateado desde ambos, así que el texto que ve la obra social no cambia.
- **Alternativa descartada:** un campo `mesYAnio: string` libre — imposibilita validar cupo mensual y agregar por año sin parsear texto.

### Decisión 5 — La descripción se **renderiza con una función pura y se congela** en la factura
`renderDescripcionFactura(plantilla: PlantillaFactura, datos: DatosDescripcionFactura): string` recorre `plantilla.campos` ordenados por `orden` y resuelve cada `OrigenCampoPlantilla` contra los datos del paciente y del traslado (incluido `valor-manual`, que toma el texto cargado en el campo). Es **pura** (sin repositorios, sin fechas del sistema): entra plantilla + datos, sale el string. Se guarda el resultado en `Factura.descripcion` al emitir y **no se recalcula** después (RN-FA-06). La factura conserva **además** los campos estructurados (Discrepancia 6).
- **Alternativa descartada:** renderizar en el componente — no sería testeable test-first y duplicaría la lógica entre el formulario, el detalle y la vista imprimible.
- **Alternativa descartada:** guardar solo los estructurados y renderizar siempre al vuelo — una edición de la plantilla reescribiría facturas ya emitidas.

### Decisión 6 — La alerta de cupo **avisa y pide confirmación explícita; no bloquea** (RN-FA-02)
`cupoConsumido(facturas, pacienteId, mes, anio)` suma `dias` y `cantidadKm` de las facturas del mismo paciente y período que **ya salieron de `a-facturar`** (estados `facturado`, `cobrado`, `pagado-parcialmente`), excluyendo la factura que se está editando. `validarCupoFacturacion({ diasFacturados, kmFacturados, cupo })` devuelve un resultado explícito con `excedeDias` / `excedeKm` y un mensaje del estilo *"tenés autorizados 20 días, estás facturando 22"*. Ambas son **funciones puras**.

Comportamiento en UI: **alerta visible + confirmación explícita del usuario para continuar**, no bloqueo duro. Motivo: RN-FA-02 dice "el sistema debe **alertar**" y US-400 "el sistema **alerta antes de continuar**" — ninguna de las dos dice "impide". Además hay casos legítimos de exceso (amparo judicial, prestación extraordinaria) y bloquear dejaría a la usuaria sin salida en un mes de cierre. Si la autorización **no existe** o no tiene cupos cargados, se avisa que no hay cupo contra el cual validar, sin bloquear.
- **Alternativa descartada:** bloqueo duro — no está pedido, y `CHANGES.md §C-07` lo llama "validación dura: **alertar**", que es una alerta obligatoria, no una prohibición. **A confirmar con el cliente** (Open Question).

### Decisión 7 — Plazos de cobro: constantes configurables + precedencia explícita (pregunta abierta Alta)
Los tres plazos sin confirmar con el cliente viven en **un único módulo**, `frontend/src/shared/lib/facturacion/constantes.ts`, calcando el patrón ya establecido en `shared/lib/mantenimiento/constantes.ts`:

```
PLAZO_COBRO_DEFAULT_DIAS = 90   // RN-FA-04 — plazo general, a confirmar
PLAZO_COBRO_AMPARO_DIAS  = 45   // RN-FA-04 — amparo judicial, a confirmar
PLAZO_ALERTA_VENCIDA_DIAS = 60  // RF-406  — alerta de mora, a confirmar
```

`calcularFechaEstimadaCobro({ fechaFactura, amparoJudicial, plazoObraSocial })` es **pura** y aplica esta **precedencia**, que es en sí una decisión que hay que confirmar:

1. `paciente.amparoJudicial === true` → `PLAZO_COBRO_AMPARO_DIAS` (45). **Gana sobre todo lo demás.**
2. si no, `obraSocial.plazoCobroDias` si está definido (campo ya existente en el contrato de `C-04`).
3. si no, `PLAZO_COBRO_DEFAULT_DIAS` (90).

Los días se cuentan **desde la fecha de factura**, no desde la prestación ni la autorización (RN-FA-04, explícito). `estadoVencimientoFactura({ fechaFactura, hoy, estado })` marca la factura como vencida sin cobro a los `PLAZO_ALERTA_VENCIDA_DIAS` si sigue en `facturado` o `pagado-parcialmente` (RF-406, seguimiento ante la Superintendencia).

Motivo de la precedencia elegida: un amparo judicial es una orden con plazo propio; sería incoherente que el plazo comercial de la obra social lo pisara. Pero **la KB no lo dice explícitamente** — redacta el 45 como "plazo por defecto" para amparo, no como override. **Es una Open Question de alta prioridad.**
- **Alternativa descartada:** hardcodear 90/45/60 en los componentes — viola la instrucción explícita del roadmap y de `CHANGES.md` ("configurables, no hardcodeados").
- **Alternativa descartada:** que el plazo de la obra social gane sobre el amparo — se descarta por el argumento legal, pero es reversible en una línea de la función pura.

### Decisión 8 — Documentación por factura: checklist multi-documento de `C-03`, ítems tomados de la obra social (RN-FA-08)
Se reutiliza `DocumentChecklist` + `useDocumentChecklist` + `DocumentoRepository` con `entidad='factura'` (valor **ya presente** en `EntidadDocumental`) y `entidadId = factura.id`. Los ítems del checklist salen de `obraSocial.checklist` (`ChecklistItem[]`, configurable por obra social, **con el orden del array como orden significativo** — RN-FA-08 exige respetar el orden y los ítems tal como los pide cada obra social). Motivo: US-400 enumera varios documentos distintos por factura (comprobante ARCA, asistencia, CODEM y demás), y el patrón multi-doc ya está construido, testeado y usado en Pacientes/Vehículos/Conductores. **Diverge a propósito** de `presupuestos-ui`, que usó archivo único porque ahí el docx sí modelaba un campo "Archivo"; acá el docx no modela nada (Discrepancia 2), así que se sigue la KB.
- **Alternativa descartada:** archivo único como en presupuestos-ui — no alcanza para 3+ documentos por factura ni para el checklist ordenado de RN-FA-08.
- **Alternativa descartada:** crear un checklist propio de facturación — duplicaría el de la obra social, que es justamente el que RN-FA-08 declara configurable.

### Decisión 9 — ARCA: **adjunto manual del comprobante, cero llamadas a API** (pregunta abierta Alta)
La pregunta abierta ("¿es viable descargar/consultar comprobantes de ARCA de forma automática, o se trabaja con carga manual del PDF?") **no está cerrada**. `08_arquitectura_propuesta.md §ARCA` dice que la arquitectura debe soportar ambos escenarios, con el adjunto manual como **mínimo viable**. **Default fijado: carga manual**, y el comprobante ARCA es **un ítem más del checklist documental** de la factura (Decisión 8) — no un campo especial, no un componente propio, no una variable de entorno, no un cliente HTTP.

Consecuencia arquitectónica buscada: la integración automática futura **no cambia ninguna pantalla** — solo tiene que producir el mismo `DocumentoAdjunto` con `itemId` del comprobante, vía otra implementación de `DocumentoRepository`. Acoplamiento a ARCA en este change: **cero**.
- **Alternativa descartada:** dejar un `comprobanteArca?: {...}` como campo propio de `Factura` — inventaría estructura no confirmada ni en el docx ni con el cliente, y acoplaría el modelo a un proveedor.

### Decisión 10 — Estados: unión cerrada de la KB, transiciones documentadas y estado **derivado** de los cobros
`EstadoFactura = 'a-facturar' | 'facturado' | 'cobrado' | 'pagado-parcialmente'` (unión cerrada, nunca `string` libre), tomando la enumeración de la KB/US-400 sobre la del docx (Discrepancia 5) y tratando el `pendiente` del docx como sinónimo de `a-facturar`.

Transición `a-facturar → facturado`: es una **acción explícita de la usuaria** ("emitir"), y es la que dispara el cálculo y la persistencia de `fechaEstimadaCobro` (US-400) y la de `fechaFactura`. De ahí en adelante el estado es **derivado por función pura** `estadoDerivadoFactura(factura, cobros)`: sin cobros → `facturado`; con cobros y saldo > 0 → `pagado-parcialmente`; saldo 0 → `cobrado`. Motivo: que el estado y los cobros no puedan desincronizarse (el bug clásico de "cobrada pero con saldo"), y que el estado sea trivialmente testeable.
- **Alternativa descartada:** estado 100% manual — se desincroniza de los cobros; es dinero, no se puede permitir.
- **Alternativa descartada:** máquina de estados con transiciones rígidas que impidan volver atrás — US-400 pide "manejar los estados", no un workflow cerrado, y no está confirmado si una factura puede volver a `a-facturar` (Open Question). Se permite la corrección manual del estado, con el derivado como valor propuesto.

### Decisión 11 — Días facturables: catálogo de feriados configurable + sábados por prestación, con la cantidad final **editable** (RN-FA-03)
`diasFacturables({ mes, anio, feriados, facturaSabados })` es **pura** y devuelve los días del período que se pueden facturar: excluye los feriados del catálogo, excluye domingos, e incluye sábados **solo si** la prestación lo indica (`AsistenciaPrestacion.facturaSabados`, porque RN-FA-03 dice explícitamente "según la prestación — regla configurable, **no uniforme**"). El **catálogo de feriados** vive en `frontend/src/shared/lib/mocks/feriadosFixture.ts` (feriados nacionales argentinos del año del fixture) y se **inyecta** como parámetro: nunca se hardcodea dentro de la función ni del componente, para que el backend pueda alimentarlo desde una tabla o un servicio.

Lo que devuelve la función es una **pre-selección sugerida**: la usuaria puede marcar y desmarcar días, y `Factura.dias` es el conteo final. Motivo: US-400 dice literalmente "la cantidad de días y el valor del km se cargan **manualmente** (no se automatizan)" — la exclusión de feriados es una ayuda visual (el roadmap FE-6 la llama "exclusión **visual** de feriados"), no una imposición.
- **Alternativa descartada:** calcular `dias` automáticamente y bloquear la edición — contradice US-400 y RN-FA-05.
- **Alternativa descartada:** hardcodear el calendario de feriados en el componente — imposible de mantener y de reemplazar por el backend.
- **A confirmar:** que los domingos nunca se facturan (la KB solo habla de feriados y sábados). Open Question.

### Decisión 12 — Total y saldo como funciones puras; el valor del km se carga a mano (RN-FA-05)
`calcularTotalFactura({ valorKm, cantidadKm })` y `saldoFactura(factura, cobros)` son puras. El **valor del km** (nomenclador nacional) es un input manual sin ninguna automatización ni tabla de tarifas (RN-FA-05: "lo fija el Estado, no la empresa; se carga manualmente; no se automatiza"). El `total` se propone calculado y queda **editable**, porque el docx modela `Monto` como un campo propio de la factura y puede haber conceptos que el producto `valorKm × cantidadKm` no cubra.
- **Alternativa descartada:** total de solo lectura — el docx lo tiene como campo persistido, y forzarlo a ser derivado impediría cargar una factura que no cierre exactamente con el producto.

### Decisión 13 — Exportación: vista imprimible con `print:` de Tailwind, sin librería de PDF
`FacturaImprimible.tsx` calca el patrón de `HojaDeRutaImprimible.tsx`: componente presentacional que recibe la factura, sus asistencias, el paciente y la obra social por props, y usa utilidades `print:` de Tailwind v4 (nada de `style={{}}` inline, regla dura). Imprime **factura + asistencia** en la misma vista (US-400: "imprimir/exportar la factura y su asistencia"). El navegador produce el PDF vía "Imprimir → Guardar como PDF". Motivo: cero dependencias nuevas, cero build de servidor, patrón ya validado en FE-5. Una generación real de PDF (server-side) sería un cambio de backend, no de FE-6.
- **Alternativa descartada:** jsPDF / pdfmake / weasyprint — agrega peso y una segunda fuente de verdad de layout para un requisito que el print del navegador ya cubre en un mock.
- **Fuera de alcance explícito:** enviar por mail o subir al portal de la obra social (US-400 lo menciona como el destino del archivo, no como funcionalidad del sistema).

### Decisión 14 — Discrepancias con impacto visible se muestran como cartel `AvisoModeloDatos`
Las discrepancias **1, 2, 3, 4 y 5** (falta `AsistenciaPrestacion`, faltan documentos por factura, falta `fechaEstimadaCobro`, falta `cantidadKm`, enum de estados divergente) se señalizan con `AvisoModeloDatos` en la pantalla de facturación, reutilizando el criterio ya aplicado en `ObraSocialDetail`/`PacienteDetail`/`ConductorDetail`/`VehiculoDetail`/`PresupuestoDetail`/hoja de ruta. Se agrupan en **un solo cartel** con los cinco puntos (no cinco carteles), para no tapar la pantalla. Las discrepancias 6 y 7 (menores) van solo en este documento. Motivo: que quien implemente `C-07` backend y la usuaria vean la ambigüedad al usar la pantalla, no solo leyendo este archivo.

### Decisión 15 — Inyección por context + estructura `features/facturacion/`
Contrato y mocks en `shared/` (reusables); pantallas y hooks específicos en `features/facturacion/`. `FacturaRepositoryContext` y `CobroRepositoryContext` inyectan los repositories; ninguna pantalla importa un mock directamente. El composition root de la feature (`FacturacionRoute.tsx`) monta además, **de solo lectura**, `PacienteRepositoryContext`, `ObraSocialRepositoryContext`, `PresupuestoRepositoryContext`, `AutorizacionRepositoryContext` y `DocumentoRepositoryContext` — mismo patrón que `PresupuestosRoute`/`HojaDeRutaRoute`. La feature se monta reemplazando el `element` de `/facturacion` en `router.tsx`; `routes.ts` no se toca. UI: listado + detalle, fila clickeable, "Editar" con `stopPropagation`. Componentes < ~200 líneas (subcomponentes extraídos: formulario, selector de días, panel de cobros, checklist, imprimible).

## Risks / Trade-offs

- **Divergencia estructural fuerte con el backend real (`C-07`)** — 5 de las 6 discrepancias exigen que el backend agregue estructura que el docx no tiene (`asistencia_prestacion`, `documento_factura`, `cantidad_km`, `fecha_estimada_cobro`, enum de estados). Si el docx resulta ser correcto y la KB no, buena parte del contrato cambia. → **Mitigación:** todas las discrepancias documentadas acá, en `04_modelo_de_datos.md §Discrepancias`, en `CHANGES.md §C-07` y con cartel en UI; el contrato está hablado con interfaces, así que el ajuste queda contenido en el adaptador de FE-8. **Confirmar con el dueño del docx ANTES del apply** (governance CRITICO).
- **Los tres plazos y su precedencia no están confirmados** — si el cliente dice que el plazo de la obra social gana sobre el amparo, o que el amparo es 30 y no 45, cambian los cálculos y las alertas de mora. → **Mitigación:** constantes en un único módulo + toda la lógica en una función pura con tests; cambiar el default o la precedencia es una edición de una línea y re-correr los tests. Documentado como Open Question de alta prioridad.
- **La alerta de cupo no bloquea** — una factura por encima del cupo puede emitirse y ser rechazada por la obra social, que es exactamente el costo que RN-FA-02 quiere evitar. → **Mitigación:** la alerta es visible y exige confirmación explícita (no un toast que se pierde); el resultado de `validarCupoFacturacion` queda disponible para que `C-11` lo muestre. Confirmar con el cliente si prefiere bloqueo duro.
- **`estadoDerivadoFactura` puede pelearse con una corrección manual del estado** — si la usuaria fuerza `cobrado` con saldo pendiente, el derivado dirá otra cosa. → **Mitigación:** el derivado se propone y se avisa la inconsistencia; no se sobrescribe silenciosamente la decisión de la usuaria. Documentado como Open Question (¿estados terminales?).
- **El catálogo de feriados es un fixture** — feriados de un solo año, sin feriados provinciales ni puentes turísticos. → **Mitigación:** se inyecta como parámetro, nunca se hardcodea; el backend puede reemplazarlo por una tabla o un servicio sin tocar la función pura ni los componentes.
- **`localStorage` sin versionado robusto** — si cambia la forma de `Factura`/`Cobro`, los datos viejos podrían romper la deserialización. → **Mitigación:** `schemaVersion` en el payload y re-siembra desde fixture ante mismatch (es solo un mock, sin dato de producción que preservar).
- **Fixtures acoplados a pacientes / obras sociales / autorizaciones existentes** — las facturas del fixture referencian ids que deben existir en `pacientesFixture`, `osecacFixture`, `presupuestosFixture` y `autorizacionesFixture` (incluyendo **al menos un paciente con `amparoJudicial: true`** y **al menos una autorización con cupos cargados**, si no las reglas de negocio no se pueden ejercitar en la UI). → **Mitigación:** requisito explícito en `tasks.md`; los selectores solo ofrecen lo que los repositories devuelven.
- **Volumen del change** — 10 capabilities es el change más grande del roadmap frontend. → **Mitigación:** `tasks.md` está ordenado para que el contrato y las funciones puras (secciones 1-3) sean una entrega verificable por sí sola, antes de tocar una sola pantalla; y la revisión humana de governance CRITICO puede aprobarse por bloques.

## Migration Plan

No aplica migración de datos (frontend + mock, sin backend).

**Precondición del apply (governance CRITICO, bloqueante):** aprobación humana explícita, punto por punto, de las Decisiones 3, 4, 6, 7, 9 y 10 (defaults sobre preguntas abiertas Alta) y de las Discrepancias 1 a 5 (impacto en el esquema del backend). Sin esa aprobación no se escribe código.

**Strict TDD:** todas las funciones puras de reglas de negocio (`renderDescripcionFactura`, `diasFacturables`, `cupoConsumido`, `validarCupoFacturacion`, `calcularFechaEstimadaCobro`, `estadoVencimientoFactura`, `calcularTotalFactura`, `saldoFactura`, `estadoDerivadoFactura`) se implementan **test-first**, con al menos un caso feliz y un caso borde cada una (triangulación).

**Camino de reemplazo futuro (FE-8, cuando `C-07` backend se archive):** escribir `SupabaseFacturaRepository`/`SupabaseCobroRepository` que cumplan las interfaces y sustituir los mocks en el composition root. Las funciones puras pueden quedar como espejo client-side o delegarse al backend; componentes, hooks y tipos no cambian.

## Open Questions

Todas de **prioridad Alta** salvo indicación, todas con un default ya fijado y aislado (constante o función pura) para poder revertirlas sin reescribir componentes. **Deben resolverse con el cliente en la revisión previa al apply.**

- **Identificador en la factura (IN-01, `10_preguntas_abiertas.md`)** — ¿el default por obra social es el N° de afiliado (como asume el fixture de `C-04`) o el DNI? Estructuralmente ya está resuelto (configurable por obra social, Decisión 3); falta el default confirmado.
- **Plazos 90 / 45 / 60 días** — ¿se confirman los tres valores? Y sobre todo: **¿qué gana, el amparo judicial (45) o el `plazoCobroDias` propio de la obra social?** Acá se decidió que gana el amparo (Decisión 7); la KB no lo dice explícitamente.
- **Integración con ARCA** — se implementa carga manual del comprobante como adjunto (Decisión 9). Confirmar si el cliente espera integración automática en Fase 1; si sí, define un change backend propio, no un cambio de estas pantallas.
- **Año / período en la facturación (RF-400)** — se decidió período estructurado (mes + año numéricos, Decisión 4). Confirmar que la obra social no exige un texto libre distinto del formateado por la plantilla.
- **¿La alerta de cupo excedido debe bloquear la emisión?** — acá avisa y pide confirmación (Decisión 6). RN-FA-02 y US-400 dicen "alertar", no "impedir".
- **Estados: ¿hay transiciones prohibidas o estados terminales?** — ¿una factura `cobrado` puede volver a `facturado`? ¿se puede anular una factura (el docx no tiene estado "anulada")? Acá se permite corregir el estado manualmente, con el derivado como propuesta (Decisión 10).
- **Días facturables: ¿los domingos nunca se facturan?** — la KB solo menciona feriados y sábados (RN-FA-03). Acá se excluyen domingos de la pre-selección, pero la usuaria puede marcarlos (Decisión 11). *(Prioridad media.)*
- **Feriados: ¿de dónde sale el calendario?** — acá es un fixture inyectable (Decisión 11). Confirmar si el backend lo va a servir desde una tabla, si hay feriados provinciales, y si los puentes turísticos cuentan. *(Prioridad media.)*
- **Nombres de campo con el backend (`C-07`)** — coordinar `dias`, `valor_km`, `cantidad_km`, `monto`, `estado`, `fecha_inicial`, `fecha_tope`, `fecha_estimada_cobro`, `tipo_comprobante`, `descripcion` antes de cerrar la interfaz, para minimizar el adaptador de FE-8. *(Interna, sin cartel en UI.)*
