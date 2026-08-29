> **Modo TDD estricto.** Cada tarea de implementación va precedida de su tarea de test (RED antes
> que GREEN). Runner: `cd frontend && npm test` (**no** `npx vitest run` a secas: el script de
> `package.json` antepone `NODE_OPTIONS=--no-experimental-webstorage`, y sin ese flag
> `localStorage` queda `undefined` y fallan 170 tests por una causa inexistente). Chequeo de tipos:
> `cd frontend && npx tsc -b --noEmit` (**nunca** `tsc --noEmit` a secas — regla dura del proyecto).
> Prohibido `any`: si un tipo es genuinamente desconocido, `unknown` + estrechamiento.
>
> **Criterio de éxito transversal:** los tests de componente de cada dominio pasan **sin editarlos**,
> más allá de agregarles el provider. Si alguno necesita otro cambio, la API pública del hook cambió
> y se corrige el hook, no el test (`design.md` §D6/§D9).

## 0. Portones previos al código (bloqueantes)

> **Línea base capturada el 2026-08-29 sobre `feat/migracion-react-query`.**

- [x] 0.1 **CHECKPOINT D1 — RESUELTO (2026-08-29).** Se adopta `@tanstack/react-query` v5 con alcance
      de aplicación completa. Registrado en `design.md` §D1 con los tres motivos.
- [x] 0.2 **CHECKPOINT D8 — DESBLOQUEADO.** `paginacion-listados` está archivado
      (`archive/2026-08-12-paginacion-listados`). No hay bloqueo de orden.
- [x] 0.3 **CHECKPOINT R4 — RESUELTO (2026-08-29).** La usuaria eligió **1 minuto**, bajando desde
      los 5 propuestos. Acepta que, **solo en los cuatro dominios de referencia**, un alta hecha por
      otra persona tarde hasta 1 minuto en verse; los dominios transaccionales no tienen esta
      regresión. En el mismo movimiento se subió `gcTime` a 10 min (`design.md` §D3): acortar
      `staleTime` agrega requests pero NO devuelve la espera, porque mientras el dato siga en memoria
      la pantalla se pinta al instante y revalida en background. **Ya no bloquea la Fase 2.**
- [ ] 0.4 ⏸️ **Línea base de red — PENDIENTE DE LA USUARIA** (requiere DevTools, no automatizable).
      Recorrido fijo: Dashboard → Pacientes → Presupuestos → Facturación → Conductores → Dashboard,
      con Network filtrando `rest/v1`, anotando cuántas veces se piden `pacientes`, `vehiculos`,
      `conductores` y `obras_sociales`. Es el número contra el que se mide 6.4.
- [x] 0.5 **Línea base de tests capturada:** `npm test` → **3275 pasan, 1 falla** (284 archivos, 3276
      tests, ~125 s).
      - ⚠️ **Fallo preexistente, NO se arregla en este change** (regla §D9):
        `src/app/router.cuentas.test.tsx > con rol admin monta CuentasPage dentro del AppShell`.
        Relevante porque toca `App.tsx`/router, justo donde se monta el provider en 1.8: si después
        de 1.8 sigue fallando **igual**, es este mismo fallo, no una regresión.
      - ⚠️ **El comando correcto es `npm test`, NO `npx vitest run`.** El script de `package.json`
        antepone `NODE_OPTIONS=--no-experimental-webstorage`; sin ese flag, `localStorage` queda
        `undefined` y fallan 170 tests en 20 archivos por una causa que no existe. El
        `test_command` de `openspec/config.yaml` está incompleto en este punto.
- [x] 0.6 **Alcance en tests medido (R5):** **44 archivos** de test montan componentes que consumen
      hooks a migrar y usan `render` pelado (lista completa abajo). Es una **cota superior**: el grep
      matchea menciones del componente, no montajes efectivos, y varios reciben los datos por props
      sin tocar el hook. El número real se confirma empíricamente en la Fase 2, cuando los que
      necesiten provider fallen con "No QueryClient set".
      - Reparto: 12 archivos usan `renderConSesion` y quedan cubiertos gratis por 1.10; 24 usan
        `renderHook` y se cubren con `renderHookConQuery` (1.9); estos 44 son el resto.
      - **Los 44 archivos** (rutas relativas a `frontend/src/`):
        `design-system/`: feedback, form, layout, paginador ·
        `features/conductores/`: AsignacionSemanalTabla, ConductorDetail, ConductorDocumentos,
        ConductoresList ·
        `features/cuentas/`: CuentasPage, CuentasPage.accessibility ·
        `features/dashboard/`: DashboardAccesibilidad, DashboardPage, DashboardRoute ·
        `features/facturacion/`: FacturaDetail, FacturaDocumentos, FacturaForm, FacturacionPage ·
        `features/hojas-de-ruta/`: AsignacionPanel, HojaDeRutaPage, HojaDeRutaRoute,
        NuevoRecorridoForm, RecorridoCard, RecorridoMapa, SelectorRecorridoHabitual ·
        `features/obras-sociales/`: ObraSocialDetail, ObraSocialesPage, ObrasSocialesList ·
        `features/pacientes/`: CudFields, DireccionesEditor, PacienteDocumentos, PacienteForm,
        PacientesList, PersonasACargoEditor ·
        `features/presupuestos/`: AutorizacionForm, PresupuestoDetail, PresupuestoForm,
        PresupuestoResumen, PresupuestosList, PresupuestosPage ·
        `features/vehiculos/`: GastosVehiculo, VehiculoDetail, VehiculoDocumentos ·
        `shared/components/`: DocumentChecklist, VistaPreviaArchivo
- [x] 0.7 **Rama creada:** `feat/migracion-react-query`. La migración deja el árbol a medio migrar
      durante las fases 2-5, con ambos patrones conviviendo (`design.md` §D8).

## 1. Fase 1 — Fundación (código nuevo, cero consumidores)

> No toca ningún hook existente y no cambia comportamiento observable.

- [x] 1.1 `npm i @tanstack/react-query` en `frontend/`. Verificar que la versión instalada es v5 y que
      declara compatibilidad con React 19.
- [x] 1.2 Crear `frontend/src/shared/lib/query/frescura.ts`: constante `FRESCURA` con las cuatro
      clases (`referencia` 1 min, `transaccional` 0, `paginado` 0, `sensible` 0), tipada con
      `as const` (`design.md` §D3).
- [x] 1.3 **RED** — `claves.test.ts`: la clave de lista de un dominio comparte prefijo con la de
      página, de modo que invalidar el prefijo del dominio alcance a ambas. Debe fallar: el módulo no
      existe.
- [x] 1.4 **GREEN** — `frontend/src/shared/lib/query/claves.ts` con la jerarquía
      `[dominio] → [dominio,'lista'] → [dominio,'pagina',query]` para todos los dominios
      (`design.md` §D4). Sin literales sueltos en ningún otro archivo.
- [x] 1.5 **TRIANGULACIÓN de claves:** (a) dos dominios distintos nunca comparten prefijo;
      (b) dos consultas paginadas con filtros distintos producen claves distintas; (c) con los mismos
      argumentos, la clave es estable entre llamadas.
- [x] 1.6 **RED/GREEN** — `aMensaje.ts`: traduce `unknown` a `string` en castellano, replicando
      exactamente el `toErrorMessage` que hoy repiten los hooks (incluido el fallback "Ocurrió un
      error inesperado."). Test con `Error`, con string suelto y con `null`.
- [x] 1.7 Crear `frontend/src/app/queryClient.ts`: `crearQueryClient()` (factory) + singleton de
      producción, con los defaults de `design.md` §D2 (`staleTime: 0`, `refetchOnWindowFocus: false`,
      `refetchOnReconnect: false`, `retry: 1`, mutaciones sin retry).
- [x] 1.8 Montar `QueryClientProvider` en `App.tsx`, **por encima** de `AuthProvider` (§D2). Verificar
      que `App.test.tsx` (si existe) y los tests de router siguen en verde.
- [x] 1.9 Crear `frontend/src/shared/test/queryWrapper.tsx` con `crearQueryClientDeTest()`
      (`retry: false`, `gcTime: 0`, `staleTime: 0`) y `renderHookConQuery` (§D7).
- [x] 1.10 Incorporar el provider dentro de `renderConSesion` con un `QueryClient` **nuevo por
      llamada**, de modo que los 12 archivos que ya lo usan queden cubiertos sin editarlos.
- [x] 1.11 **Test de aislamiento (R3):** dos tests consecutivos que usan la misma clave no comparten
      dato; el segundo observa caché vacía y su mock recibe la consulta. Debe fallar si se comparte
      una única instancia de `QueryClient`.
- [x] 1.12 **Test de la trampa del retry (D7):** un `queryFn` que rechaza resuelve a estado de error
      **sin** reintentos y sin colgar el test.
- [x] 1.13 `npx tsc -b --noEmit` + `npm test` en verde. **Resultado: 3291/3291 en 287 archivos**
      (línea base 3275/3276 en 284) — +3 archivos y +15 tests, todos agregados por esta fase, y el
      único fallo de la línea base dejó de aparecer (ver nota en 0.5). Cero regresiones.
      Commit: `feat: fundación de React Query (client, claves, frescura, helpers de test)`.

## 2. Fase 2 — Piloto de punta a punta: `obrasSociales`

> El más estático, pedido por 4 pantallas, con el hook más simple. Valida el diseño completo antes de
> replicar.

- [x] 2.1 **Safety net:** correr `useObrasSociales.test.ts` y `ObraSocialesPage.test.tsx`; anotar el
      conteo en verde. Cualquier fallo previo se reporta, no se arregla acá.
- [x] 2.2 **RED** — en `useObrasSociales.test.ts`: dos montajes sucesivos del hook (desmontando en el
      medio, como hace react-router al navegar) llaman a `repository.list()` **una sola vez**.
- [x] 2.3 **GREEN** — reescribir el cuerpo de `useObrasSociales.ts` con `useQuery`, clave
      `claves.obrasSociales.lista()` y `staleTime: FRESCURA.referencia`. **`UseObrasSocialesResult` NO
      cambia** — misma forma, mismos nombres de campo (§D6).
- [x] 2.4 **TRIANGULACIÓN de las tres traducciones (§D6):** (a) `error` llega como `string`, con el
      mismo texto que antes; (b) sin datos, el hook expone `[]` y nunca `undefined`; (c) `loading`
      mapea a `isPending` — con dato cacheado vencido, `loading` es `false` mientras revalida.
- [x] 2.5 **RED** — `crear` y `actualizar` invalidan `claves.obrasSociales.todos()`.
- [x] 2.6 **GREEN** — cablear ambas mutaciones con `useMutation` + `onSuccess` (§D5), conservando el
      comportamiento actual de propagación de error al formulario.
- [x] 2.7 **TRIANGULACIÓN — invalidación cruzada (el requisito que justifica el change):** test que
      monta un consumidor A (rol pantalla de Obras Sociales), crea una obra social, desmonta, monta un
      consumidor B (rol selector de otra pantalla) y verifica que B **ve la obra social nueva** sin
      esperar al vencimiento.
- [x] 2.8 **TRIANGULACIÓN — sin parpadeo:** con dato vencido en memoria, el primer render expone
      `loading: false` y los datos cacheados, y actualiza cuando llega la revalidación.
- [x] 2.9 Verificar que `ObraSocialesPage.test.tsx`, `PacientesPage.test.tsx`,
      `FacturacionPage.test.tsx` y `PresupuestosPage.test.tsx` pasan **sin más edición que el
      provider**. Si alguno requiere otro cambio, documentar por qué y corregir 2.3.
- [x] 2.10 `npx tsc -b --noEmit` + `npm test` completo en verde. **3295/3295 en 287 archivos**
      (+4 respecto de la Fase 1, todos agregados acá). Cero regresiones.

> ### Hallazgos de la Fase 2 (leer antes de replicar a los otros dominios)
>
> **1. El alcance real en tests fue 5 archivos, no 44.** La cota superior de 0.6 sobreestimaba por
> 9x: el `grep` matcheaba menciones del componente, no montajes efectivos, y la mayoría recibe los
> datos por props sin tocar el hook. Los que fallaron con `No QueryClient set` fueron
> `FacturacionPage`, `FacturacionRoute`, `PresupuestosPage`, `PresupuestosRoute` y `PacientesPage`
> —las cuatro pantallas que consumen el padrón de obras sociales, más una ruta—, con 8 llamadas a
> `render` pelado en total. **Para los dominios siguientes, esperar un número igual de chico.**
>
> **2. ⚠️ El estado de error de `useMutation` commitea UN TICK DESPUÉS de que `mutateAsync`
> rechaza.** Medido, no supuesto: justo tras el `await`, `mutacion.error` todavía es `null`; un tick
> después tiene el error. La implementación anterior lo seteaba sincrónicamente en el `catch` antes
> de relanzar, así que una pantalla que renderiza el error inmediatamente después de `await crear()`
> lo veía en el mismo render. **Leerlo de `mutacion.error` cambia ese timing y deja la pantalla en
> blanco por un render** — lo detectó un test existente, sin editarlo.
> **Patrón obligatorio para todos los dominios**: el error de mutación va a un `useState` seteado en
> `onError` (que corre ANTES de que la promesa rechace) y limpiado en `onMutate`. No es "el hook
> guardando estado de servidor": es estado de presentación de un error de escritura.
>
> **3. Las opciones por query ganan sobre los defaults del `QueryClient`.** El `staleTime:
> FRESCURA.referencia` que declara el hook NO lo pisa el `staleTime: 0` del cliente de test. Por eso
> los tests de dedup funcionan sin configurar nada especial en el cliente.
>
> **4. `renderConQuery(ui)` es el reemplazo directo de `render(ui)`** en tests de componente. Mismo
> uso, mismo retorno, cliente nuevo por llamada.
- [ ] 2.11 **CHECKPOINT de revisión humana.** Mostrar el diff de la fase, el conteo de requests
      antes/después para obras sociales, y confirmar que se replica al resto. Commit:
      `refactor: useObrasSociales sobre React Query`.

## 3. Fase 3 — Resto de dominios de referencia + Riesgo #1

- [ ] 3.1 **Safety net** de la fase: correr los tests de vehículos, conductores y pacientes; anotar la
      línea base.
- [ ] 3.2 **RED/GREEN** — `useVehiculos.ts` con `claves.vehiculos.lista()` y
      `staleTime: FRESCURA.referencia`, sin cambiar `UseVehiculosResult`; `crear`/`actualizar`
      invalidan el dominio.
- [ ] 3.3 **TRIANGULACIÓN — dedup entre hermanos (el caso concreto que originó el change):** test que
      monta `ConductoresList` y `AsignacionSemanalTabla` juntos (como los monta `ConductoresPage`) y
      verifica que `vehiculoRepository.list()` se llama **una sola vez**, no dos. Cubrir que uno recibe
      el repository por Context y el otro por prop, y que aun así comparten caché.
- [ ] 3.4 **RED/GREEN** — `useConductores.ts` con `claves.conductores.lista()`: dedup entre montajes +
      invalidación en `crear`/`actualizar`, sin cambiar `UseConductoresResult`.
- [ ] 3.5 **RED/GREEN** — `usePacientes.ts` con `claves.pacientes.lista()`: ídem, sin cambiar
      `UsePacientesResult`.
- [ ] 3.6 **RED/GREEN** — `usePaginaListado.ts` sobre `useQuery` con
      `placeholderData: keepPreviousData` y `staleTime: FRESCURA.paginado` (§D3), conservando su API y
      su comportamiento de no saltar a la página 1.
- [ ] 3.7 **RED — R1, el riesgo alto del change:** test en `usePacientesPaginado.test.ts` que verifica
      que `crear` y `actualizar` del camino **paginado** invalidan `claves.pacientes.todos()` (no solo
      su página). Debe fallar antes de 3.8.
- [ ] 3.8 **GREEN** — cablear la invalidación del dominio en los tres hooks paginados
      (`usePacientesPaginado`, `useConductoresPaginado`, `useObrasSocialesPaginado`), **sin** tocar su
      comportamiento de paginación.
- [ ] 3.9 **TRIANGULACIÓN E2E de R1:** test que crea un paciente desde el camino paginado y luego
      monta un consumidor de `usePacientes` (rol selector de Presupuestos/Facturación) verificando que
      **ve el paciente nuevo**.
- [ ] 3.10 Verificar que `HojaDeRutaPage.test.tsx`, `ConductoresPage.test.tsx`,
      `VehiculosPage.test.tsx`, `PresupuestosPage.test.tsx` y `FacturacionPage.test.tsx` pasan sin más
      edición que el provider.
- [ ] 3.11 `npx tsc -b --noEmit` + `npm test` completo en verde. Commits separados por dominio.

## 4. Fase 4 — Dominios transaccionales (`staleTime: 0`)

> **Regla de la fase:** ninguno de estos dominios lleva `FRESCURA.referencia`. Si uno lo lleva, es un
> bug de R2 (mostrar plata desactualizada), no una optimización.

- [ ] 4.1 **Safety net** de la fase: correr los tests de facturación, presupuestos, hojas de ruta,
      cuentas y documentos; anotar la línea base.
- [ ] 4.2 **RED/GREEN** — `useFacturas.ts` y `useCobros.ts` con `staleTime: FRESCURA.transaccional`.
      **Test explícito de R2:** dos montajes sucesivos consultan al servidor **las dos veces**.
- [ ] 4.3 **RED/GREEN** — `usePresupuestos.ts` y `useAutorizaciones.ts`, ídem. Verificar que crear una
      autorización invalida **presupuestos y autorizaciones** (mutación que toca dos dominios, §D5).
- [ ] 4.4 **RED/GREEN** — `useHojasDeRuta.ts` y `useRecorridosHabituales.ts`, ídem.
- [ ] 4.5 **RED/GREEN** — `useCuentas.ts` con `staleTime: FRESCURA.sensible`, conservando su matiz
      actual: si `crearCuenta`/`actualizarPermisos` rechazan, **no** se recarga el listado y el error
      crudo llega al formulario.
- [ ] 4.6 **RED/GREEN** — `useDocumentChecklist.ts`, conservando su forma pública.
- [ ] 4.7 Revisar `useEmisionFactura.ts`: es estado de flujo del asistente, no de servidor. Decidir y
      **documentar acá** si queda fuera de React Query (recomendado) o si alguna de sus lecturas entra.
- [ ] 4.8 `npx tsc -b --noEmit` + `npm test` completo en verde. Commits separados por dominio.

## 5. Fase 5 — Hooks del dashboard

> `/` es la ruta índice: hoy paga varios `list()` completos en cada montaje.

- [ ] 5.1 **RED** — `useAlertasCud.test.ts`: si la caché de pacientes ya está poblada y fresca, el
      hook **no** llama a `repository.list()`.
- [ ] 5.2 **GREEN** — `useAlertasCud.ts` sobre `claves.pacientes.lista()`, conservando su forma
      pública (`cargando`, no `loading`) y su cálculo de alertas intacto.
- [ ] 5.3 **RED/GREEN** — `useAlertasMantenimiento.ts` sobre `claves.vehiculos.lista()`.
- [ ] 5.4 **RED/GREEN** — `useConductoresDashboard.ts` sobre `claves.conductores.lista()`.
- [ ] 5.5 **RED/GREEN** — `useDatosFinancieros.ts` y `useHojaDeRutaDelDia.ts` con
      `staleTime: FRESCURA.transaccional`.
- [ ] 5.6 **TRIANGULACIÓN — beneficio cruzado:** test que visita el módulo de Vehículos y después el
      dashboard, verificando **un** `list()` de vehículos en total, no dos.
- [ ] 5.7 Verificar que `DashboardPage.test.tsx`, `DashboardRoute.test.tsx` y
      `DashboardAccesibilidad.test.tsx` pasan sin más edición que el provider.
- [ ] 5.8 **REFACTOR final:** verificar por `grep` que ningún hook conserva `useState` +
      `useEffect` + `repository.*` para estado de servidor, y que no queda lógica repetida que deba
      vivir en un helper compartido.
- [ ] 5.9 `npx tsc -b --noEmit` + `npm test` completo en verde. Commit:
      `refactor: el dashboard lee desde React Query`.

## 6. Verificación y cierre

- [ ] 6.1 `npx oxlint` sin nuevos hallazgos.
- [ ] 6.2 `npx tsc -b --noEmit` y `npm test` completo: **cero** regresiones respecto de la línea
      base de 0.5. Toda diferencia en el conteo debe estar justificada por tests **agregados** en este
      change.
- [ ] 6.3 Confirmar por `git diff --name-only` que **ningún** archivo de pantalla (`*Page.tsx`,
      `*List.tsx`, `*Detail.tsx`, `*Form.tsx`), `*Route.tsx`, `*RepositoryContext.tsx` ni ninguna
      interfaz o implementación de repository quedó modificado. Si alguno lo está, es una desviación
      del diseño: justificarla o revertirla.
- [ ] 6.4 Repetir el recorrido de 0.4 con DevTools → Network y **comparar el conteo de requests
      `rest/v1` antes/después**. Anotar el número en el reporte de cierre: es la evidencia de que el
      change hizo lo que dice.
- [ ] 6.5 **Auditoría de R2:** `grep` de `FRESCURA.referencia` — debe aparecer **solo** en los cuatro
      dominios de referencia. Cualquier otro uso es un bug de frescura sobre datos transaccionales.
- [ ] 6.6 Confirmar que la caché **no** persiste nada en `localStorage`/`sessionStorage`/IndexedDB y
      que no se instaló ningún plugin de persistencia (spec, "la caché es de sesión y vive solo en
      memoria").
- [ ] 6.7 Medir el bundle después del change (`npm run build`, tamaño de `dist/assets/index-*.js`) y
      anotar el delta. Se espera ~+13 KB gzip; sirve de línea base para `code-splitting-rutas`.
- [ ] 6.8 Dejar registrado en el reporte de cierre: los plazos de frescura elegidos, la advertencia
      operativa de R1 ("todo camino de mutación nuevo sobre un dominio debe invalidar su clave") y la
      de R2 ("ningún dominio transaccional lleva frescura de referencia"), para que quien agregue
      funcionalidad después no lo descubra por un dato viejo en un selector.
