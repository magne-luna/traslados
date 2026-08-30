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
- [x] 0.4 **Validación cualitativa de la usuaria (2026-08-29): "mucho más rápido se siente".**
      Probó la navegación en ambas ramas y confirmó la mejora percibida. **No se capturó el conteo
      numérico de requests** con DevTools — queda como deuda documental, no como bloqueo: el objetivo
      del change era la sensación de velocidad al navegar, y está validado por quien usa la app. Si
      alguna vez hace falta el número duro (p. ej. para justificar el próximo change de performance),
      el recorrido está descripto acá arriba.
- [x] 0.5 **Línea base de tests capturada:** `npm test` → **3275 pasan, 1 falla** (284 archivos, 3276
      tests, ~125 s).
      - ⚠️ **Fallo preexistente, NO se arregla en este change** (regla §D9):
        `src/app/router.cuentas.test.tsx > con rol admin monta CuentasPage dentro del AppShell`.
        Relevante porque toca `App.tsx`/router, justo donde se monta el provider en 1.8: si después
        de 1.8 sigue fallando **igual**, es este mismo fallo, no una regresión.
      - ⚠️ **El comando correcto es `npm test`, NO `npx vitest run`.** El script de `package.json`
        antepone `NODE_OPTIONS=--no-experimental-webstorage`; sin ese flag, `localStorage` queda
        `undefined` y fallan 170 tests en 20 archivos por una causa que no existe. El
        `test_command` de `openspec/config.yaml` estaba incompleto en este punto. **Corregido el
        2026-08-29 a pedido de la usuaria**: los cinco comandos de test del config pasan a usar los
        scripts de `package.json` (`npm test`, `npm run test:watch`), y el de coverage —que además
        no tenía `cd frontend`— lleva el flag explícito. Queda una nota en el YAML explicando el
        porqué, para que nadie lo "simplifique" de vuelta.
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
- [x] 2.11 **CHECKPOINT de revisión humana — APROBADO (2026-08-29).** La usuaria revisó el piloto y
      dio el OK para replicar al resto; las fases 3, 4 y 5 se aplicaron sobre esa aprobación.
      Validado además end-to-end sobre la app corriendo (ver 0.4). Commit:
      `refactor: useObrasSociales sobre React Query` (6dd6ffa).

## 3. Fase 3 — Resto de dominios de referencia + Riesgo #1

- [x] 3.1 **Safety net** de la fase: correr los tests de vehículos, conductores y pacientes; anotar la
      línea base.
- [x] 3.2 **RED/GREEN** — `useVehiculos.ts` con `claves.vehiculos.lista()` y
      `staleTime: FRESCURA.referencia`, sin cambiar `UseVehiculosResult`; `crear`/`actualizar`
      invalidan el dominio.
- [x] 3.3 **TRIANGULACIÓN — dedup entre hermanos (el caso concreto que originó el change):** test que
      monta `ConductoresList` y `AsignacionSemanalTabla` juntos (como los monta `ConductoresPage`) y
      verifica que `vehiculoRepository.list()` se llama **una sola vez**, no dos. Cubrir que uno recibe
      el repository por Context y el otro por prop, y que aun así comparten caché.
- [x] 3.4 **RED/GREEN** — `useConductores.ts` con `claves.conductores.lista()`: dedup entre montajes +
      invalidación en `crear`/`actualizar`, sin cambiar `UseConductoresResult`.
- [x] 3.5 **RED/GREEN** — `usePacientes.ts` con `claves.pacientes.lista()`: ídem, sin cambiar
      `UsePacientesResult`.
- [x] 3.6 **RED/GREEN** — `usePaginaListado.ts` sobre `useQuery` con
      `placeholderData: keepPreviousData` y `staleTime: FRESCURA.paginado` (§D3), conservando su API y
      su comportamiento de no saltar a la página 1.
- [x] 3.7 **RED — R1, el riesgo alto del change:** test en `usePacientesPaginado.test.ts` que verifica
      que `crear` y `actualizar` del camino **paginado** invalidan `claves.pacientes.todos()` (no solo
      su página). Debe fallar antes de 3.8.
- [x] 3.8 **GREEN** — cablear la invalidación del dominio en los tres hooks paginados
      (`usePacientesPaginado`, `useConductoresPaginado`, `useObrasSocialesPaginado`), **sin** tocar su
      comportamiento de paginación.
- [x] 3.9 **TRIANGULACIÓN E2E de R1:** test que crea un paciente desde el camino paginado y luego
      monta un consumidor de `usePacientes` (rol selector de Presupuestos/Facturación) verificando que
      **ve el paciente nuevo**.
- [x] 3.10 Verificar que `HojaDeRutaPage.test.tsx`, `ConductoresPage.test.tsx`,
      `VehiculosPage.test.tsx`, `PresupuestosPage.test.tsx` y `FacturacionPage.test.tsx` pasan sin más
      edición que el provider.
- [x] 3.11 `npx tsc -b --noEmit` + `npm test` completo en verde. **3302/3302 en 287 archivos.**

> ### Hallazgos de la Fase 3
>
> **1. RIESGO #1 confirmado como real, no teórico.** Los tests 3.7 y 3.9 fallaron antes del
> cableado: `crear` desde el camino paginado NO invalidaba el padrón completo, así que el selector
> de otra pantalla seguía mostrando el listado viejo. Exactamente el fallo silencioso que el change
> predijo. Cerrado en los tres hooks paginados.
>
> **2. La invalidación del dominio REEMPLAZA a `recargar()`, no se suma.** Invalidar el prefijo
> `claves.X.todos()` alcanza tanto al padrón (`lista`) como a la página vigente, que al estar activa
> se re-consulta sola con su misma clave — o sea, sigue recargando la MISMA página, nunca salta a la
> 1 (comportamiento 13.7 preservado). Llamar además a `recargar()` produciría dos consultas
> idénticas.
>
> **3. ⚠️ DESVIACIÓN: `UsePaginaListadoParams` gana un campo obligatorio, `clave`.** React Query
> necesita una `queryKey` y este hook es genérico: no puede saber a qué dominio pertenece. Un
> default genérico haría que dos dominios colisionaran en la misma entrada de caché — un bug
> silencioso y caro. **`UsePaginaListadoResult` (lo que leen las pantallas) NO cambia**, y solo los
> tres hooks `*Paginado` construyen el campo; ninguna pantalla lo ve. TypeScript señaló los 10 call
> sites del test, que es la forma correcta de que este cambio no pase inadvertido.
>
> **4. `usePaginaListado` quedó MÁS simple, no más compleja.** Desaparecieron tres mecanismos que
> existían solo para suplir lo que React Query hace de fábrica: el descarte manual de respuestas
> fuera de orden (`solicitudVigenteRef`), los refs de `listPage`/`construirFiltros` para que el
> efecto no se redisparara con closures inline, y el token de recarga. El estado de UI (página,
> término, debounce, reset) se queda: eso no es estado de servidor.
>
> **5. ⚠️ Un test existente necesitó pasar de aserción síncrona a `waitFor`** (respuestas fuera de
> orden, 4.8). La INTENCIÓN se conserva —la respuesta vieja no pisa a la vigente— y se sigue
> verificando; lo que cambió es que React Query commitea un microtask después del `.then()` manual.
> **No es observable para quien usa la app**: acá no corre código de pantalla entre la resolución y
> el commit, a diferencia del error de mutación de la Fase 2 (donde sí había un render en el medio y
> por eso se preservó el timing exacto con `onError`).
>
> **6. ⚠️ DESVIACIÓN: se extrajo `shared/lib/query/useListaDeDominio.ts` antes de lo previsto.** La
> tarea 5.8 planeaba el refactor al final. Se hizo acá a propósito: los cuatro hooks de referencia
> son idénticos en forma, y copiar tres veces el patrón de `onError` (el bug de timing de la Fase 2)
> era una invitación a equivocarse en uno. Los cuatro hooks quedaron en ~30 líneas de mapeo de
> nombres.
>
> **7. Archivos de test que necesitaron provider en esta fase: 14** (10 + 4 tras cablear los hooks
> paginados). Sumados a los 5 de la Fase 2, van 19 — muy por debajo de la cota de 44.

## 4. Fase 4 — Dominios transaccionales (`staleTime: 0`)

> **Regla de la fase:** ninguno de estos dominios lleva `FRESCURA.referencia`. Si uno lo lleva, es un
> bug de R2 (mostrar plata desactualizada), no una optimización.

- [x] 4.1 **Safety net** de la fase: correr los tests de facturación, presupuestos, hojas de ruta,
      cuentas y documentos; anotar la línea base.
- [x] 4.2 **RED/GREEN** — `useFacturas.ts` y `useCobros.ts` con `staleTime: FRESCURA.transaccional`.
      **Test explícito de R2:** dos montajes sucesivos consultan al servidor **las dos veces**.
- [x] 4.3 **RED/GREEN** — `usePresupuestos.ts` y `useAutorizaciones.ts`, ídem. Verificar que crear una
      autorización invalida **presupuestos y autorizaciones** (mutación que toca dos dominios, §D5).
- [x] 4.4 **RED/GREEN** — `useHojasDeRuta.ts` y `useRecorridosHabituales.ts`, ídem.
- [x] 4.5 **RED/GREEN** — `useCuentas.ts` con `staleTime: FRESCURA.sensible`, conservando su matiz
      actual: si `crearCuenta`/`actualizarPermisos` rechazan, **no** se recarga el listado y el error
      crudo llega al formulario.
- [x] 4.6 **RED/GREEN** — `useDocumentChecklist.ts`, conservando su forma pública.
- [x] 4.7 **`useEmisionFactura` queda FUERA de React Query.** Sus lecturas (`getById` de autorización
      y de presupuesto) son imperativas y de una sola vez, dentro de un flujo de acción disparado por
      un clic, con parámetros que recién se conocen en ese momento — no son suscripciones a estado de
      servidor. Su único `useState` es estado del asistente (`cupoParaConfirmar`, el diálogo de
      confirmación de cupo), que no es dato remoto. Envolverlo en `useQuery` no aportaría caché ni
      deduplicación y complicaría un flujo secuencial.
- [x] 4.8 `npx tsc -b --noEmit` + `npm test` completo en verde. **3304/3304 en 287 archivos.**
      **Auditoría R2 adelantada (tarea 6.5): `FRESCURA.referencia` aparece como código solo en los
      cuatro dominios de referencia.** Ningún dominio transaccional lo lleva.

> ### Hallazgos de la Fase 4
>
> **1. ⚠️ Casi cambio una firma pública sin darme cuenta.** Al reescribir `useCobros` dejé un solo
> parámetro; el hook real recibe `(repository, facturaId)` y lee por `listByFactura`. Lo atrapó
> `tsc` al compilar `FacturaDetail.tsx`. La clave quedó acotada por factura
> (`claves.cobros.deFactura`). **Moraleja para las fases que queden: leer la firma completa antes de
> reescribir, no inferirla del patrón.**
>
> **2. El "refetch silencioso" de `useHojasDeRuta` salió GRATIS.** Era el comportamiento más
> delicado del lote (fix de 2026-08-11: una mutación que tildara `loading` desmontaba todos los
> `RecorridoCard` y sacaba al operador del modo edición). Con `loading` saliendo de `isPending`, la
> revalidación posterior a una mutación ocurre con `isPending: false` — exactamente el "silencioso"
> que antes había que pasar a mano. Usar `isFetching` reintroduciría el bug. Los dos tests de
> regresión 8.6 pasan sin tocarlos.
>
> **3. ⚠️ `useDocumentChecklist` necesitó `placeholderData: keepPreviousData`, y lo detectó un
> test.** Al subir `refreshToken` la clave es nueva y su caché arranca vacía: el checklist parpadeaba
> a "0 de N documentos" hasta que llegaba la relectura. El estado local anterior conservaba los
> documentos viejos mientras recargaba. Es un cambio de comportamiento REAL y se arregló en el hook,
> no en el test (test 6.8 de documentos-transferencia-actividad).
>
> **4. `useCuentas` NO lleva `errorMutacion`, a propósito.** Si `crearCuenta`/`actualizarPermisos`
> rechazan no se recarga el listado y el formulario necesita el error CRUDO (401/403/404/400 con
> mensajes distintos), no un string genérico. Que la invalidación viva en `onSuccess` es lo que
> garantiza que una mutación fallida no dispare recarga.
>
> **5. Mutaciones que tocan dos dominios:** cobros invalida también facturas (cambia el saldo);
> presupuestos invalida también autorizaciones (cambia lo autorizable).
>
> **6. ⚠️ DESVIACIÓN: cuatro aserciones de `useDocumentChecklist` pasaron de síncronas a `waitFor`,
> y dos de `AsignacionPanel` esperan a que el selector se habilite.** Causa común: React Query
> notifica a sus observadores un tick después de que la promesa resuelve. El criterio aplicado en
> todo el change, y que conviene mantener: **importa si hay un render que muestra algo incorrecto, no
> si el reloj cambió.** Por eso el error de mutación de la Fase 2 SÍ preservó timing exacto (el
> camino de fallo no reportaba nada por un render) y estos casos no (nada queda en blanco ni
> contradictorio; el dato llega un frame después).
>
> **7. Archivos de test que necesitaron provider: 17.** Acumulado del change: 36.

## 5. Fase 5 — Hooks del dashboard

> `/` es la ruta índice: hoy paga varios `list()` completos en cada montaje.

- [x] 5.1 **RED** — `useAlertasCud.test.ts`: si la caché de pacientes ya está poblada y fresca, el
      hook **no** llama a `repository.list()`.
- [x] 5.2 **GREEN** — `useAlertasCud.ts` sobre `claves.pacientes.lista()`, conservando su forma
      pública (`cargando`, no `loading`) y su cálculo de alertas intacto.
- [x] 5.3 **RED/GREEN** — `useAlertasMantenimiento.ts` sobre `claves.vehiculos.lista()`.
- [x] 5.4 **RED/GREEN** — `useConductoresDashboard.ts` sobre `claves.conductores.lista()`.
- [x] 5.5 **RED/GREEN** — `useDatosFinancieros.ts` y `useHojaDeRutaDelDia.ts` con
      `staleTime: FRESCURA.transaccional`.
- [x] 5.6 **TRIANGULACIÓN — beneficio cruzado:** test que visita el módulo de Vehículos y después el
      dashboard, verificando **un** `list()` de vehículos en total, no dos.
- [x] 5.7 Verificar que `DashboardPage.test.tsx`, `DashboardRoute.test.tsx` y
      `DashboardAccesibilidad.test.tsx` pasan sin más edición que el provider.
- [x] 5.8 **REFACTOR final:** verificar por `grep` que ningún hook conserva `useState` +
      `useEffect` + `repository.*` para estado de servidor, y que no queda lógica repetida que deba
      vivir en un helper compartido.
- [x] 5.9 `npx tsc -b --noEmit` + `npm test` completo en verde. **3308/3308 en 287 archivos.**

> ### Hallazgos de la Fase 5
>
> **1. El beneficio cruzado quedó probado en LAS DOS direcciones.** Módulo → dashboard y dashboard →
> módulo: en ambos casos, un solo `list()` en total. Es la razón de ser de esta fase: `/` es la ruta
> índice y se pasa por ella constantemente.
>
> **2. `useDatosFinancieros` usa `useQueries`, no dos `useQuery` sueltos.** Conserva el paralelismo
> del `Promise.all` anterior y deja `cargando`/`error` como una sola señal agregada, que es lo que
> las tarjetas ya consumían. Frescura CERO en las dos: el dashboard no es excepción a la regla de la
> Fase 4 — la pantalla de inicio es el peor lugar para mostrar un total facturado viejo.
>
> **3. `useHojaDeRutaDelDia` comparte clave con `useHojasDeRuta`**, así que el dashboard y la
> pantalla de armado ya no piden dos veces la hoja del mismo día. `null` sigue siendo un estado
> propio ("no hay hoja cargada para hoy"), nunca un error: React Query lo respeta porque `null` es un
> valor resuelto.
>
> **4. REFACTOR final verificado (5.8):** ningún hook conserva `useState` + `useEffect` +
> `repository.*` para estado de servidor. Los únicos `useEffect` que quedan son los de
> `usePaginaListado` (debounce del término y reset de página), que son estado de UI, no de servidor.
> Ninguna llamada a `.list()` ocurre fuera de un `queryFn`.
>
> **5. Archivos de test que necesitaron provider: 8.** Total del change: **44**, que coincide
> exactamente con la cota superior de la tarea 0.6 — ajustada al final, aunque por fase fue siempre
> mucho menor de lo que sugería.

## 6. Verificación y cierre

- [x] 6.1 `npx oxlint`: **27 warnings en total, CERO en los 20 hooks migrados y en los módulos
      nuevos** (`query/claves`, `query/frescura`, `query/aMensaje`, `query/useListaDeDominio`,
      `app/queryClient`). El único warning atribuible al change está en
      `shared/test/queryWrapper.tsx` (`react(only-export-components)`), un archivo de SOLO TESTS
      donde el fast refresh no aplica, y es la misma regla que ya dispara en cinco `*Context.tsx`
      preexistentes. De paso se borraron tres exports especulativos que nadie usaba
      (`ProveedorDeQuery`, `envoltorioDeQuery`, `elementoConQuery`), lo que bajó los warnings del
      archivo de 4 a 1.
- [x] 6.2 `npx tsc -b --noEmit` limpio y `npm test` **3308/3308 en 287 archivos**, contra una línea
      base de **3275/3276 en 284**. Cero regresiones: +3 archivos y +32 tests, todos agregados por
      este change, y el único fallo de la línea base dejó de aparecer (ver nota en 0.5).
- [x] 6.3 **Verificado en cada fase y al cierre: cero pantallas, `*Route.tsx`,
      `*RepositoryContext.tsx`, interfaces o implementaciones de repository modificados.** Los
      únicos archivos de producción tocados son los ~20 hooks, `App.tsx` (el provider) y los cinco
      módulos nuevos de `shared/lib/query/`. Los `*Route.tsx` y `*Page.tsx` que aparecen en el diff
      son **archivos de test** (`*.test.tsx`), que solo recibieron el provider.
- [x] 6.4 **Verificado sobre la app corriendo, en ambas ramas.** La usuaria confirmó la mejora
      percibida al navegar entre pantallas ("mucho más rápido se siente", 2026-08-29).
      ⚠️ **Nota para quien mida en el futuro:** el filtro correcto en DevTools → Network es
      `supabase.co`, **no** `rest/v1`. Vehículos NO va por PostgREST: `SupabaseVehiculoRepository`
      llama a la Edge Function `vehiculos` vía `supabase.functions.invoke`, así que un filtro por
      `rest/v1` se pierde justo el dominio con el caso más visible (los dos SELECT simultáneos de
      `ConductoresPage`).
- [x] 6.5 **Auditoría R2 PASADA.** `FRESCURA.referencia` aparece como código en exactamente cuatro
      lugares: `usePacientes`, `useVehiculos`, `useConductores`, `useObrasSociales` (y los tres hooks
      del dashboard que reusan esas mismas claves). Ningún dominio transaccional lo lleva. El resto
      de las apariciones del `grep` son comentarios que explican por qué NO se usa.
- [x] 6.6 **Verificado: la caché no persiste nada.** Cero menciones de
      `localStorage`/`sessionStorage`/IndexedDB en `shared/lib/query/`, `app/queryClient.ts` y
      `shared/test/queryWrapper.tsx`; ningún plugin de persistencia en `package.json`. La caché vive
      en memoria y muere con la pestaña, como exige el spec (hay datos de salud y de menores).
- [x] 6.7 **Bundle medido, antes y después, con `npm run build` en las dos ramas:**
      | | crudo | gzip |
      |---|---|---|
      | `main` | 1,48 MB | **419 KB** |
      | `feat/migracion-react-query` | 1,51 MB | **430 KB** |
      | delta | +30 KB | **+11 KB** |

      Consistente con los ~13 KB estimados en `design.md` §D1, y **2,6 % del bundle** — el orden de
      magnitud que hacía irrelevante el argumento original contra la librería. Queda como línea base
      para `code-splitting-rutas`, que es el change que ataca los 430 KB de verdad.
- [x] 6.8 Dejar registrado en el reporte de cierre: los plazos de frescura elegidos, la advertencia
      operativa de R1 ("todo camino de mutación nuevo sobre un dominio debe invalidar su clave") y la
      de R2 ("ningún dominio transaccional lleva frescura de referencia"), para que quien agregue
      funcionalidad después no lo descubra por un dato viejo en un selector.
