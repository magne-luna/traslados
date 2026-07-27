
Governance BAJO (`CHANGES.md §C-11`). Dominio de solo lectura y agregación: no crea entidades, no escribe datos, no toca backend ni RLS. **Autonomía plena** para ejecutar estas tasks mientras la suite quede en verde y `tsc` + `oxlint` queden limpios. Los umbrales numéricos se heredan de los módulos dueños y **no se redefinen acá** (design.md Decisión 10).

**Strict TDD**: todas las funciones puras de las secciones 3 y 4 se implementan **test-first** (RED → GREEN → triangulación con al menos un caso borde → REFACTOR). Antes de tocar cualquier archivo existente (sección 2 y 8), correr el safety net (`npm test` en `frontend/`) y registrar el baseline de tests en verde.

**Reglas duras del proyecto**: TypeScript strict, prohibido `any` (usar `unknown` + narrowing); solo clases utilitarias de Tailwind v4 sobre los tokens del `@theme` de `frontend/src/index.css`, prohibido `style={{}}` inline y `!important`; prohibido crear cliente Supabase, migraciones o RLS en este change; keys de lista por id estable, nunca índice de array; componentes < ~200 líneas; sin barrel exports.

**Regla propia de este change (design.md Decisión 5)**: ninguna regla de negocio de mora, CUD o mantenimiento se reimplementa. Se invocan `estadoVencimientoFactura`, `estadoCud`, `estadoServicePreventivo` y `estadoHabilitacion` de sus módulos dueños.

## 1. Safety net y contrato de tipos

- [x] 1.1 Correr `npm test` en `frontend/` y registrar el baseline de tests en verde (safety net previo a tocar `CobroRepository`, `mockCobroRepository` y `router.tsx`). **Baseline: 640/640 tests, 124 archivos, verde.**
- [x] 1.2 Crear `frontend/src/shared/types/reportes.ts` con `PeriodoMeses = 3 | 6 | 12` (unión cerrada, nunca `number`), importando —nunca redefiniendo— los tipos de `factura.ts`, `paciente.ts`, `vehiculo.ts` e `hojaDeRuta.ts`. Sin `any`.
- [x] 1.3 Definir `PuntoPeriodo` (`mes` 1-12, `anio`, `facturado`, `cobrado`, `diferencia`) y `SerieFacturadoVsCobrado` (`puntos: PuntoPeriodo[]` + totales del rango), documentando en el comentario las dos reglas de atribución (design.md Decisiones 2 y 3).
- [x] 1.4 Definir `ResumenAnual` (`anio`, totales de facturado/cobrado/diferencia, `facturasEmitidas`, `facturasSaldadas`, `meses: PuntoPeriodo[]` con las 12 entradas).
- [x] 1.5 Definir `FacturaEnMora` (`facturaId`, `pacienteId`, datos mínimos de presentación, `saldoPendiente`, `diasDeAtraso`) referenciando por id, sin embeber `Factura` ni `Paciente`.
- [x] 1.6 Definir `PacienteCudPorVencer` (`pacienteId`, apellido y nombre, `fechaVencimiento`, `estado: EstadoCud`) importando `EstadoCud` de `shared/lib/pacientes/estadoCud`.
- [x] 1.7 Definir `AlertaMantenimientoVehiculo` (`vehiculoId`, `patente`, y los motivos como colección tipada que distingue service preventivo —vencido / alerta intermedia— de habilitación VTV/RTO —vencida / por vencer—), de modo que un vehículo con dos motivos se represente una sola vez.
- [x] 1.8 Definir `ResumenDelDia` (`fecha`, `cantidadRecorridos`, `cantidadParadas`, `cantidadPacientes`) y el tipo de detalle por recorrido (vehículo, conductor, cantidad de paradas, si es manual).
- [x] 1.9 Comentar en el encabezado del archivo que **ninguno de estos tipos es una entidad**: son proyecciones derivadas, y ninguno requiere tabla nueva en el backend `C-11`.

## 2. Extensión del contrato de cobros (única modificación de interfaz existente)

- [x] 2.1 Agregar `list(): Promise<Cobro[]>` a `frontend/src/shared/lib/facturacion/CobroRepository.ts`, documentando que es aditiva (design.md Decisión 6) y para qué la necesita `C-11`. No tocar `listByFactura`, `create` ni `remove`.
- [x] 2.2 Test-first de la implementación: `list()` devuelve todos los cobros persistidos; array vacío cuando no hay ninguno; y coherencia con `listByFactura` (los cobros de una factura son exactamente los de `list()` con ese `facturaId`).
- [x] 2.3 Implementar `list()` en `frontend/src/shared/lib/mocks/mockCobroRepository.ts`, reutilizando la lectura de `localStorage` y la latencia simulada ya existentes, sin cambiar el `schemaVersion` ni el fixture.
- [x] 2.4 Correr la suite completa y verificar que ninguna pantalla ni test de `facturacion-ui` se rompió (la adición debe ser transparente). **643/643 verde (640 baseline + 3 nuevos).**

## 3. Capa de agregación — período y reportes financieros (Strict TDD, test-first)

- [x] 3.1 `periodosDelRango({ hoy, meses })` en `shared/lib/reportes/periodos.ts` → lista de `{ mes, anio }` del más antiguo al más reciente, incluyendo el mes de `hoy`. Pura, fecha por parámetro. Casos: 3/6/12 meses, cruce de año (diciembre → enero), y que la longitud siempre iguale `meses`.
- [x] 3.2 Helper de atribución por componentes de fecha (año/mes parseados del string ISO, sin aritmética de `Date`) para evitar el corrimiento de mes por zona horaria (design.md Risks). Casos: fecha del día 1 y del último día del mes en `America/Argentina/Buenos_Aires`.
- [x] 3.3 `facturadoVsCobrado({ facturas, cobros, hoy, meses })` en `shared/lib/reportes/facturadoVsCobrado.ts` → `SerieFacturadoVsCobrado`. Casos: un punto por mes del rango; mes sin movimiento emitido en cero; diferencia = facturado − cobrado, admitiendo negativos; totales del rango coincidentes con la suma de los puntos.
- [x] 3.4 Triangular la atribución del **facturado** (design.md Decisión 2): factura con `mesFacturado`/`anioFacturado` de marzo y `fechaFactura` de abril suma en marzo; factura con período fuera del rango no suma en ningún punto ni en los totales.
- [x] 3.5 Triangular la exclusión de borradores: factura en `a-facturar` no suma en ningún mes; facturas en `facturado`, `cobrado` y `pagado-parcialmente` del mismo mes suman las tres su monto completo.
- [x] 3.6 Triangular la atribución del **cobrado** (design.md Decisión 3): cobro de abril de una factura de enero suma en abril; dos cobros parciales de la misma factura en meses distintos suman cada uno en su mes sin duplicarse.
- [x] 3.7 `resumenAnual({ facturas, cobros, anio })` en `shared/lib/reportes/resumenAnual.ts` → `ResumenAnual` con los mismos criterios de atribución que 3.3. Casos: totales del año; conteo de facturas emitidas y saldadas; año sin datos con todo en cero; los 12 meses siempre presentes; suma del desglose igual a los totales.
- [x] 3.8 Triangular el aislamiento entre años: factura de diciembre cobrada en enero del año siguiente suma facturado en el primer año y cobrado en el segundo.
- [x] 3.9 `aniosConDatos({ facturas, cobros, hoy })` → años disponibles para el selector, derivados del período de las facturas y de la fecha de los cobros, incluyendo siempre el año de `hoy`. Casos: dos años con datos; sin datos (devuelve solo el año de `hoy`); orden estable y sin duplicados.
- [x] 3.10 Verificar que ningún módulo de `shared/lib/reportes/` importa React, un repositorio, un mock o `localStorage`, y que ninguno invoca `Date.now()` ni `new Date()` sin argumentos (test o verificación de imports, patrón de `noAcoplamientoHojaDeRuta.test.ts`).

## 4. Capa de agregación — alertas y resumen del día (Strict TDD, test-first)

- [x] 4.1 Crear `shared/lib/reportes/constantes.ts` con **solo** lo propio del dashboard: `PERIODOS_DISPONIBLES = [3, 6, 12]`, `MAX_ITEMS_TARJETA` y `UMBRAL_CUD_DASHBOARD_DIAS = 60`. Documentar que los demás umbrales se heredan de `shared/lib/facturacion/constantes.ts` y `shared/lib/mantenimiento/constantes.ts`.
- [x] 4.2 Verificar (test o revisión explícita) que `shared/lib/reportes/constantes.ts` **no** redeclara ningún valor ya existente en los módulos dueños.
- [x] 4.3 `facturasEnMora({ facturas, cobros, hoy })` invocando `estadoVencimientoFactura` y `saldoFactura` de `shared/lib/facturacion/`. Casos: factura `facturado` vencida con saldo entra; factura `cobrado` no entra; `pagado-parcialmente` vencida entra informando el **saldo**, no el monto total; factura `a-facturar` sin `fechaFactura` no entra y no rompe.
- [x] 4.4 Triangular la herencia del umbral: un test que fuerza el borde exacto de `PLAZO_ALERTA_VENCIDA_DIAS` (día anterior fuera, día del umbral dentro) importando la constante, nunca escribiendo `60` literal.
- [x] 4.5 `cudPorVencer({ pacientes, hoy, umbralDias })` invocando `estadoCud`. Casos: CUD dentro de la ventana (`por-vencer`); CUD vencido diferenciado; CUD vigente excluido; paciente con `cud: null` omitido sin error.
- [x] 4.6 `alertasMantenimiento({ vehiculos, ahora })` invocando `estadoServicePreventivo` y `estadoHabilitacion`. Casos: service vencido; alerta intermedia diferenciada de la crítica; VTV vencida y RTO por vencer evaluadas de forma independiente; vehículo con dos motivos aparece **una sola vez** enumerando ambos; vehículo sin alertas excluido.
- [x] 4.7 `resumenDelDia(hojaDeRuta)` → `ResumenDelDia`. Casos: conteo de recorridos, total de paradas sumando todos los recorridos, pacientes distintos contados una sola vez aunque aparezcan en ida y vuelta o en dos recorridos; hoja de ruta sin recorridos devuelve todo en cero.
- [x] 4.8 Verificar que ninguna función de esta sección muta las colecciones recibidas (test que compara la entrada antes y después).

## 5. Hooks de carga y composition root

- [x] 5.1 Crear los contexts de inyección que falten para el dashboard, **reutilizando** los que las features existentes ya exponen (`FacturaRepositoryContext`, `CobroRepositoryContext` y equivalentes de paciente, vehículo, conductor y hoja de ruta). No duplicar un provider ya existente. **Los cinco ya existían (FacturaRepositoryContext, CobroRepositoryContext, PacienteRepositoryContext, VehiculoRepositoryContext, HojaDeRutaRepositoryContext) — no se creó ninguno nuevo, se reutilizan tal cual.**
- [x] 5.2 `useDatosFinancieros()`: lee `FacturaRepository.list()` y `CobroRepository.list()` **una sola vez** y expone `{ facturas, cobros, cargando, error }`. Test: una sola invocación de cada repositorio aunque haya tres consumidores.
- [x] 5.3 `useHojaDeRutaDelDia(fecha)`: lee `getByFecha`, expone estado de carga, error y el caso `null` (sin hoja de ruta cargada) como estado propio, no como error.
- [x] 5.4 `useAlertasCud()` y `useAlertasMantenimiento()`: leen `PacienteRepository.list()` y `VehiculoRepository.list()` con su propio estado de carga/error independiente. **Implementados como hooks propios de solo lectura (sin `crear`/`actualizar`), no como wrappers de `usePacientes`/`useVehiculos`, para que sea estructuralmente imposible que el dashboard escriba.**
- [x] 5.5 Memoizar con `useMemo` las derivaciones de `facturadoVsCobrado`, `resumenAnual` y `facturasEnMora` sobre el par `(facturas, cobros)`, para que cambiar el selector de período o de año no recalcule lo que no cambió ni dispare lecturas nuevas. **Implementado en `useReportesFinancieros.ts`, verificado con spies (cambiar período no recalcula resumen/mora; cambiar año no recalcula serie/mora).**
- [x] 5.6 Crear `frontend/src/features/dashboard/DashboardRoute.tsx` como composition root que inyecta los repositorios mock de solo lectura y renderiza `DashboardPage`. Ningún componente hijo importa nada de `shared/lib/mocks/`. **Se inyectan seis repositorios, no cinco: `RecorridosDelDiaPanel` necesita resolver el nombre del conductor por id (spec dashboard-recorridos-del-dia), gap detectado durante el apply — ver `useConductoresDashboard.ts` — así que se agrega `ConductorRepository` de solo lectura junto a los cinco previstos en design.md Decisión 9.**
- [x] 5.7 Test de la garantía de solo lectura: renderizar el dashboard completo con repositorios espía y verificar que **no** se invocó ningún `create`, `update` ni `remove`.

## 6. Componentes de presentación

- [x] 6.1 `RecorridosDelDiaPanel.tsx`: resumen de la jornada (recorridos, paradas, pacientes), lista de recorridos con patente del vehículo y nombre del conductor resueltos por id, marca de recorrido manual, y enlace a `/hojas-de-ruta`. Estados de carga, error y "sin hoja de ruta cargada para hoy" explícitos.
- [x] 6.2 Manejar la referencia no resoluble: un recorrido cuyo `vehiculoId` o `conductorId` no existe se muestra igual con un texto de referencia no disponible, sin romper el panel.
- [x] 6.3 `TarjetaResumen.tsx`: componente genérico de tarjeta (título, conteo total destacado, lista acotada a `MAX_ITEMS_TARJETA`, enlace al módulo de origen, estado vacío afirmativo, estado de carga y de error propios). Keys por id estable.
- [x] 6.4 `TarjetasAlertas.tsx`: compone las tres tarjetas (mora, CUD, mantenimiento) sobre `TarjetaResumen`, con enlaces a `/facturacion`, `/pacientes` y `/vehiculos`. Severidad comunicada con texto o etiqueta además del color.
- [x] 6.5 Helper único de formato de moneda con `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })` en `shared/lib/reportes/formato.ts`, con su test. Ningún componente formatea montos a mano.
- [x] 6.6 `FacturadoVsCobradoPanel.tsx`: selector de período (3/6/12 desde `PERIODOS_DISPONIBLES`), tabla accesible con `<caption>` y `<th scope>`, barras proporcionales al máximo del rango con utilidades de Tailwind (sin `style={{}}`), y la nota visible de las reglas de atribución. Estados de carga, error y vacío.
- [x] 6.7 `ResumenAnualPanel.tsx`: selector de año desde `aniosConDatos`, totales destacados (facturado, cobrado, diferencia, emitidas, saldadas) y desglose de los 12 meses como tabla accesible. Estados de carga, error y vacío.
- [x] 6.8 `DashboardAvisoDiscrepancias.tsx`: un único `AvisoModeloDatos` agrupado con las 4 discrepancias de `design.md §Discrepancias` (sin vistas en el docx; mora dependiente de `fechaFactura` y del estado `facturado` inexistentes; período de atribución no estructurado; CUD y mantenimiento derivados vs. persistidos).
- [x] 6.9 `DashboardPage.tsx`: compone el cartel, el panel del día en primer plano, las tarjetas y los dos paneles de reporte, con regiones semánticas y encabezados. Mantener el archivo < ~200 líneas extrayendo sub-componentes.
- [x] 6.10 Verificar responsive: las tablas de reporte se desplazan dentro de su propio contenedor con `overflow-x`, y la página no genera scroll horizontal en viewport angosto.

## 7. Accesibilidad y verificación de reglas duras

- [x] 7.1 Test de navegación por teclado: todos los controles (selectores de período y año) y los enlaces de tarjetas y paneles son alcanzables en orden lógico y tienen foco visible.
- [x] 7.2 Test de estructura semántica: cada panel es una región con su encabezado, y la información numérica está disponible como texto, no solo como barra.
- [x] 7.3 Verificar contraste de las etiquetas de severidad de las tarjetas contra los tokens del design system (4.5:1 texto normal, 3:1 elementos de UI).
- [x] 7.4 Verificar en todo `features/dashboard/` y `shared/lib/reportes/` que no hay `any`, ni `style={{}}` inline, ni `!important`, ni índices de array como key, ni barrel exports.

## 8. Montaje en el router

- [x] 8.1 Reemplazar en `frontend/src/app/router.tsx` el `element` de la ruta `/` (hoy `PlaceholderPage`) por `<DashboardRoute />`, sumando la entrada a `ROUTE_ELEMENTS` y extendiendo el comentario de composición con la fase FE-7 / `C-11`, igual que hicieron las fases anteriores.
- [x] 8.2 Verificar que `frontend/src/app/routes.ts` **no cambió** (paths, etiquetas e íconos idénticos) y que el guard de autenticación sigue cubriendo la raíz sin excepciones.
- [x] 8.3 Test de integración de la ruta: acceder a `/` autenticada renderiza el dashboard dentro del shell, no el placeholder.

## 9. Documentación de discrepancias y cierre

- [x] 9.1 Agregar a `knowledge-base/04_modelo_de_datos.md` §Discrepancias el bloque de `C-11` con las 4 discrepancias de `design.md`, indicando para cada una la acción pendiente del backend y a quién hay que confirmársela.
- [x] 9.2 Agregar al bloque `### [C-11]` de `CHANGES.md` los bullets `⚠️ Discrepancia con Traslados-Modelo-Datos.docx` correspondientes, con el mismo contenido que el cartel de la UI.
- [x] 9.3 Actualizar `ROADMAP-FRONTEND.md` §FASE FE-7 marcándola como implementada, con el detalle de qué quedó pendiente (verificación manual en navegador) y el puntero al change, siguiendo el formato usado en FE-5 y FE-6.
- [x] 9.4 Correr `npm test`, `npx tsc -b` y `npm run lint` en `frontend/`: suite completa en verde, sin errores de tipos ni advertencias de lint, y verificar que el conteo de tests creció respecto del baseline de 1.1.
- [x] 9.5 Verificar manualmente en el navegador la pantalla completa: recorridos del día, las tres tarjetas, el selector de período (3/6/12), el selector de año y el cartel de discrepancias.
