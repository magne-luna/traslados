> **Modo TDD estricto.** Cada tarea de implementación va precedida de su tarea de test (RED antes
> que GREEN). Runner: `npm test` dentro de `frontend/`. Chequeo de tipos: `npx tsc -b --noEmit`
> dentro de `frontend/` (**nunca** `tsc --noEmit` a secas — regla dura del proyecto).
> Prohibido `any`: si un tipo es genuinamente desconocido, `unknown` + estrechamiento.

## 0. Portones previos al código (bloqueantes)

- [ ] 0.1 **CHECKPOINT D1 — decidir librería vs. primitivo propio.** Presentarle a la usuaria la
      tabla comparativa de `design.md` §D1 (peso en bundle vs. el LCP que originó la consulta,
      provider obligatorio en 26 archivos de test, precedente "cero dependencias" de
      `paginacion-listados` §7) y obtener un OK explícito. Si elige `@tanstack/react-query`,
      **detener el apply** y revisar `design.md` §D1/§D2/§D7 y la sección 1 de este tasks antes de
      seguir: el resto de las secciones (qué se cachea, cuándo se invalida, cómo se testea) sigue
      valiendo casi sin cambios.
- [ ] 0.2 **CHECKPOINT D8 — decidir el orden respecto de `paginacion-listados` (61/93, en curso).**
      Confirmar con la usuaria: (a) esperar a que cierre y aplicar todo, o (b) aplicar **solo la
      sección 1** ahora (código nuevo, sin consumidores, sin cambio de comportamiento) y diferir las
      secciones 2-4. Dejar la decisión anotada acá antes de tocar cualquier archivo compartido.
- [ ] 0.3 **CHECKPOINT R4 — confirmar la regresión de frescura.** Verificar con la usuaria que
      acepta que un alta hecha por **otra** persona (u otra pestaña) tarde hasta 5 minutos en verse,
      a cambio de eliminar los re-fetch. Confirmar también el valor del TTL (`design.md` §D3).
- [ ] 0.4 Capturar la **línea base de red**: recorrido fijo (Dashboard → Pacientes → Presupuestos →
      Facturación → Conductores → Dashboard) con DevTools → Network filtrando `rest/v1`, anotando
      cuántas veces se piden `pacientes`, `vehiculos`, `conductores` y `obras_sociales`. Es el
      número contra el que se mide el resultado en 5.4.
- [ ] 0.5 Capturar la **línea base de tests** (safety net): correr `npm test` completo y anotar el
      total de tests en verde. Si algo ya falla antes de tocar nada, reportarlo como fallo
      preexistente y **no** arreglarlo dentro de este change.

## 1. Fase 1 — Primitivo compartido (código nuevo, cero consumidores)

> Aplicable incluso con `paginacion-listados` abierto: no toca ningún archivo compartido y no
> cambia comportamiento observable.

- [ ] 1.1 Crear `frontend/src/shared/lib/cache/clavesCache.ts`: `ClaveCacheReferencia` como union de
      literales (`'pacientes' | 'vehiculos' | 'conductores' | 'obrasSociales'`) y la constante
      `TTL_LISTAS_REFERENCIA` (5 min en ms), exportadas desde un único lugar (`design.md` §D5/§D3).
- [ ] 1.2 **RED** — `cacheDeReferencia.test.ts`: primera solicitud sin dato en caché delega en el
      cargador y devuelve su resultado. Debe fallar porque el módulo no existe.
- [ ] 1.3 **GREEN** — `cacheDeReferencia.ts`: store de módulo con `EntradaCache<T>`
      (`datos`/`cargadoEn`/`enVuelo`/`error`) y `obtener(clave, cargar)`. Mínimo indispensable para
      pasar 1.2.
- [ ] 1.4 **TRIANGULACIÓN — dedup de peticiones concurrentes:** dos `obtener` de la misma clave con
      la petición en vuelo emiten **una sola** llamada al cargador y ambos reciben el mismo
      resultado. Agregar un tercer caso: un solicitante que llega después de que la promesa resolvió
      **no** se engancha a `enVuelo` (que ya es `null`).
- [ ] 1.5 **TRIANGULACIÓN — TTL:** con `vi.useFakeTimers`, una segunda solicitud dentro del TTL NO
      llama al cargador; pasado el TTL, SÍ. Verificar que el vencimiento se cuenta desde la carga y
      que leer desde memoria **no** extiende la vigencia (spec, escenario "el plazo se cuenta desde
      la carga").
- [ ] 1.6 **TRIANGULACIÓN — revalidación en background:** con dato vencido presente, `obtener`
      devuelve el dato cacheado de inmediato **y** dispara la consulta; al resolver, los suscriptores
      reciben el dato nuevo. Sin dato en memoria, en cambio, no hay nada que devolver de entrada.
- [ ] 1.7 **TRIANGULACIÓN — errores:** (a) fallo sin dato en caché ⇒ entrada con `error` y `datos`
      en `null`; (b) fallo de revalidación **con** dato en caché ⇒ el dato **se conserva** y además
      se expone `error`; (c) tras cualquier fallo, `enVuelo` vuelve a `null` para que el siguiente
      intento realmente reintente; (d) los N solicitantes enganchados a una petición fallida reciben
      todos el mismo error.
- [ ] 1.8 Implementar `invalidar(clave)`: borra la entrada y notifica suscriptores. **Test:** tras
      invalidar, la siguiente solicitud llama al cargador aunque el TTL no hubiera vencido; y las
      otras tres claves quedan intactas (spec, "la invalidación no arrastra otros dominios").
- [ ] 1.9 Implementar `suscribir(clave, listener)` + `snapshot(clave)`. **Test de estabilidad
      referencial (R6):** dos llamadas consecutivas a `snapshot` sin cambios de estado devuelven
      **la misma referencia**; solo un cambio real produce un objeto nuevo. Sin este test, un
      `getSnapshot` que construye objetos nuevos manda a React a un bucle infinito de render.
- [ ] 1.10 Implementar `limpiarCacheDeReferencia()` (vacía todas las entradas y suscripciones) y
      registrarla en un `beforeEach` global de `frontend/src/test/setup.ts`. **Test de aislamiento
      (R3):** un test que puebla la caché no deja rastro para el siguiente.
- [ ] 1.11 **REFACTOR** del store: extraer helpers puros (`estaVencida(entrada, ahora, ttl)`,
      construcción de entradas) y dejar la lógica de concurrencia legible. Tests en verde después de
      **cada** paso.
- [ ] 1.12 **RED** — `useListaCacheada.test.ts`: el hook devuelve `{ datos, loading, error,
      recargar }` y refleja el resultado del store para una clave dada.
- [ ] 1.13 **GREEN** — `useListaCacheada.ts` sobre `useSyncExternalStore` (`design.md` §D2/§D7), con
      la firma isomorfa a `useQuery`: `{ clave, cargar, ttlMs? }`.
- [ ] 1.14 **TRIANGULACIÓN del hook:** (a) dos componentes suscritos a la misma clave se
      re-renderizan ambos cuando el dato llega; (b) al desmontar se cancela la suscripción y **no**
      se llama a `setState` sobre un componente desmontado; (c) `recargar()` fuerza la consulta
      ignorando el TTL y reinicia la vigencia para **todos** los consumidores del dominio (spec,
      "refresco explícito a pedido").
- [ ] 1.15 `npx tsc -b --noEmit` y `npm test` en verde. Commit: `feat: caché compartida de listas de
      referencia (primitivo)`.

## 2. Fase 2 — Primer dominio de punta a punta: `obrasSociales`

> El más estático, pedido por 4 pantallas, con el hook más simple. Valida el diseño completo
> —incluida la invalidación cruzada— antes de replicar.

- [ ] 2.1 **Safety net:** correr `useObrasSociales.test.ts` y `ObraSocialesPage.test.tsx` y anotar el
      conteo en verde. Cualquier fallo previo se reporta, no se arregla acá.
- [ ] 2.2 **RED** — en `useObrasSociales.test.ts`: dos montajes sucesivos del hook (desmontando en
      el medio, como hace react-router al navegar) llaman a `repository.list()` **una sola vez**.
- [ ] 2.3 **GREEN** — reescribir el cuerpo de `useObrasSociales.ts` delegando en `useListaCacheada`
      con la clave `'obrasSociales'`. **La interfaz `UseObrasSocialesResult` NO cambia** — misma
      forma, mismos nombres de campo (`design.md` §D7, spec "la API pública de los consumidores no
      cambia").
- [ ] 2.4 **RED** — `crear` y `actualizar` invalidan la clave `'obrasSociales'` antes de recargar.
- [ ] 2.5 **GREEN** — cablear la invalidación en `crear`/`actualizar`.
- [ ] 2.6 **TRIANGULACIÓN — invalidación cruzada (el requisito que justifica el change):** test que
      monta un consumidor A (rol pantalla de Obras Sociales), crea una obra social, desmonta, monta
      un consumidor B (rol selector de otra pantalla) y verifica que B **ve la obra social nueva**
      sin esperar al TTL.
- [ ] 2.7 **TRIANGULACIÓN — sin parpadeo:** con dato vencido en memoria, el hook expone `loading` en
      `false` y los datos cacheados en el primer render, y actualiza cuando llega la revalidación.
- [ ] 2.8 Verificar que `ObraSocialesPage.test.tsx`, `PacientesPage.test.tsx`,
      `FacturacionPage.test.tsx` y `PresupuestosPage.test.tsx` **siguen pasando sin editarlos**. Si
      alguno requiere edición, documentar exactamente por qué (es señal de que la API pública sí
      cambió y hay que corregir 2.3, no el test).
- [ ] 2.9 `npx tsc -b --noEmit` + `npm test` completo en verde.
- [ ] 2.10 **CHECKPOINT de revisión humana.** Mostrar el diff de la fase, el conteo de requests
      antes/después para obras sociales, y confirmar que se replica a los otros tres dominios.
      Commit: `refactor: useObrasSociales lee de la caché compartida`.

## 3. Fase 3 — Dominios restantes

- [ ] 3.1 **Safety net** de la fase: correr los tests de vehículos, conductores y pacientes; anotar
      la línea base.
- [ ] 3.2 **RED** — `useVehiculos.test.ts`: dos montajes sucesivos ⇒ un solo `list()`; `crear` y
      `actualizar` invalidan `'vehiculos'`.
- [ ] 3.3 **GREEN** — migrar `useVehiculos.ts` a `useListaCacheada` con clave `'vehiculos'`, sin
      cambiar `UseVehiculosResult`.
- [ ] 3.4 **TRIANGULACIÓN — dedup entre hermanos (el caso concreto que originó el change):** test que
      monta `ConductoresList` y `AsignacionSemanalTabla` juntos (como los monta `ConductoresPage`) y
      verifica que `vehiculoRepository.list()` se llama **una sola vez**, no dos. Cubrir también que
      uno recibe el repository por Context y el otro por prop, y que aun así comparten caché
      (`design.md` §D5).
- [ ] 3.5 **RED/GREEN** — `useConductores.ts` con clave `'conductores'`: dedup entre montajes +
      invalidación en `crear`/`actualizar`, sin cambiar `UseConductoresResult`.
- [ ] 3.6 **RED/GREEN** — `usePacientes.ts` con clave `'pacientes'`: dedup entre montajes +
      invalidación en `crear`/`actualizar`, sin cambiar `UsePacientesResult`.
- [ ] 3.7 **RED — R1, el riesgo alto del change:** test en `usePacientesPaginado.test.ts` que
      verifica que `crear` y `actualizar` del camino **paginado** invalidan la clave `'pacientes'`
      (spec, escenario "una mutación hecha desde una pantalla paginada también invalida"). Debe
      fallar antes de 3.8.
- [ ] 3.8 **GREEN** — cablear `invalidar('pacientes')` en `usePacientesPaginado.crear/actualizar`,
      **sin** tocar su comportamiento de paginación (sigue recargando la misma página vía
      `listPage`, nunca salta a la página 1).
- [ ] 3.9 **TRIANGULACIÓN E2E de R1:** test que crea un paciente desde el camino paginado y luego
      monta un consumidor de `usePacientes` (rol selector de Presupuestos/Facturación) verificando
      que **ve el paciente nuevo**.
- [ ] 3.10 Verificar que `HojaDeRutaPage.test.tsx`, `ConductoresPage.test.tsx`,
      `VehiculosPage.test.tsx`, `PresupuestosPage.test.tsx` y `FacturacionPage.test.tsx` siguen
      pasando **sin editarlos**.
- [ ] 3.11 `npx tsc -b --noEmit` + `npm test` completo en verde. Commits separados por dominio.

## 4. Fase 4 — Hooks del dashboard

> `/` es la ruta índice: hoy paga tres `list()` completos en cada montaje (`design.md` §D6).

- [ ] 4.1 **RED** — `useAlertasCud.test.ts`: si la caché de `'pacientes'` ya está poblada y fresca,
      el hook **no** llama a `repository.list()`.
- [ ] 4.2 **GREEN** — `useAlertasCud.ts` lee por la caché con la clave `'pacientes'`, conservando su
      forma pública y su cálculo de alertas intacto.
- [ ] 4.3 **RED/GREEN** — `useAlertasMantenimiento.ts` con clave `'vehiculos'`.
- [ ] 4.4 **RED/GREEN** — `useConductoresDashboard.ts` con clave `'conductores'`.
- [ ] 4.5 **TRIANGULACIÓN — beneficio cruzado:** test que visita el módulo de Vehículos y después el
      dashboard, verificando **un** `list()` de vehículos en total, no dos.
- [ ] 4.6 Verificar que `DashboardPage.test.tsx`, `DashboardRoute.test.tsx` y
      `DashboardAccesibilidad.test.tsx` siguen pasando sin editarlos.
- [ ] 4.7 **REFACTOR final:** revisar que los siete hooks migrados no repitan lógica que deba vivir
      en `useListaCacheada`, y que no quede ninguna llamada directa a `list()` de los cuatro
      dominios de referencia fuera de la caché (`grep` de `.list()` como verificación).
- [ ] 4.8 `npx tsc -b --noEmit` + `npm test` completo en verde. Commit: `refactor: el dashboard lee
      las listas de referencia desde la caché compartida`.

## 5. Verificación y cierre

- [ ] 5.1 `npm run lint` (oxlint) sin nuevos hallazgos.
- [ ] 5.2 `npx tsc -b --noEmit` y `npm test` completo: **cero** regresiones respecto de la línea base
      de 0.5. Toda diferencia en el conteo de tests debe estar justificada por tests **agregados**
      en este change.
- [ ] 5.3 Confirmar que **ningún** archivo de pantalla (`*Page.tsx`, `*List.tsx`, `*Detail.tsx`,
      `*Form.tsx`), `*Route.tsx`, `*RepositoryContext.tsx` ni ninguna interfaz de repository quedó
      modificado (`git diff --name-only`). Si alguno lo está, es una desviación del diseño y hay que
      justificarla o revertirla.
- [ ] 5.4 Repetir el recorrido de 0.4 con DevTools → Network y **comparar el conteo de requests
      `rest/v1` antes/después**. Anotar el número en el reporte de cierre: es la evidencia de que el
      change hizo lo que dice.
- [ ] 5.5 Confirmar explícitamente que **no** se agregó ninguna dependencia a `frontend/package.json`
      (si se resolvió 0.1 a favor del primitivo propio), y que la caché **no** persiste nada en
      `localStorage`/`sessionStorage`/IndexedDB (spec, "la caché es de sesión y vive solo en
      memoria").
- [ ] 5.6 Dejar registrado en el reporte de cierre: el TTL elegido, el gatillo de migración a
      TanStack Query (`design.md` §D1) y la advertencia operativa de R1 ("todo camino de mutación
      nuevo sobre un dominio de referencia debe invalidar su clave"), para que quien agregue
      funcionalidad después no lo descubra por un dato viejo en un selector.
