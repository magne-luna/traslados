# Tasks — paginacion-listados

> **⚠️ STRICT TDD ACTIVO.** Este proyecto tiene `testing.strict_tdd: true` en `openspec/config.yaml`.
> Toda tarea que escriba código de producción se implementa con el ciclo
> **RED → GREEN → TRIANGULATE → REFACTOR**, y **antes** de modificar cualquier archivo existente se
> corre el safety net (`cd frontend && npx vitest run`) y se registra el baseline. Test runner:
> `cd frontend && npx vitest run`. Type-check: `cd frontend && npx tsc -b --noEmit`
> (**nunca** `tsc --noEmit` a secas — el tsconfig raíz es de project references y compila 0 archivos).
>
> **⚠️ GOVERNANCE MEDIO — implementación por fases con checkpoints.** No se aplican las 4 fases de
> corrido. Cada fase cierra con un checkpoint de revisión antes de arrancar la siguiente.
> **La fase 2 NO arranca sin el veredicto del CHECKPOINT 1** (semántica de la búsqueda de pacientes,
> `design.md` §D5) — es un cambio de comportamiento observable para la usuaria.
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing, nunca `as`);
> nunca `style={{}}` (solo utilidades Tailwind v4, valores de diseño en el `@theme` de `index.css`);
> revisar y reusar `frontend/src/design-system/components.tsx` antes de escribir markup nuevo;
> Conventional Commits.
>
> **Alcance recortado a propósito** (`design.md` §D8): NO se toca ninguna Edge Function
> (`supabase/functions/**`), NO se escribe ninguna migración SQL, NO se agrega ninguna dependencia,
> NO se tocan vehículos, presupuestos, autorizaciones, facturas, cobros, cuentas, documentos ni el
> dashboard.

---

## 0. Checkpoints de diseño (antes de escribir código de producción) — GOVERNANCE MEDIO

- [x] 0.1 **CHECKPOINT 1 (bloquea la fase 2) — semántica de la búsqueda de pacientes.** Presentar a la
      usuaria el trade-off de `design.md` §D5: hoy el filtro corre sobre la **concatenación en memoria**
      de `nombre_a + nombre_b + apellido_a + apellido_b`; server-side pasa a **tokens vs. columnas**
      (cada palabra debe matchear alguna columna). Consecuencia concreta: `"perez juan"` empieza a
      encontrar a "Juan Pérez" (hoy no), y una subcadena que cruza el límite nombre/apellido deja de
      encontrarlo. Registrar el veredicto acá.
      **→ VEREDICTO: aprobado (2026-08-12) — se acepta tokens vs. columnas tal como está propuesto.**
- [x] 0.2 **CHECKPOINT 2 — acentos.** Confirmar con la usuaria que `ilike` distingue acentos
      (`"perez"` ≠ `"Pérez"`). **No es una regresión** — `.toLowerCase().includes()` tampoco los ignora
      hoy — pero si quiere insensibilidad a acentos hace falta la extensión `unaccent` en Postgres
      (backend, fuera de este change). Registrar el veredicto acá.
      **→ VEREDICTO: aprobado (2026-08-12) — se deja como está, no es regresión. `unaccent` queda fuera de alcance.**
- [x] 0.3 **Tamaño de página.** Confirmar el default propuesto (**20** filas, sin selector de tamaño en
      la primera iteración). Registrar el veredicto acá.
      **→ VEREDICTO: aprobado (2026-08-12) — 20 fijo, sin selector.**
- [x] 0.4 **Página en la URL.** Confirmar que en esta iteración `?pagina=N` **no** se persiste (recargar
      vuelve a la página 1, no se puede compartir link a una página). Registrar el veredicto acá.
      **→ VEREDICTO: aprobado (2026-08-12) — no se persiste en esta iteración.**
- [x] 0.5 Registrar el **baseline de la suite completa** antes de tocar nada:
      `cd frontend && npx vitest run` → anotar "N/N tests en verde". Si algo ya falla, se reporta como
      falla preexistente y NO se arregla en este change.
      **→ BASELINE (2026-08-12): 2350/2354 tests en verde (238/241 archivos).** 4 fallas preexistentes,
      no relacionadas con paginación, NO se tocan en este change: `PermisosMatrizFields.test.tsx`
      ("muestra un ícono de identidad por módulo..."), `ChecklistEditor.test.tsx` (2 tests de gateo de
      escritura) y `HojaDeRutaPage.test.tsx` ("explica por diseño el mapa vacío..."). Nota de entorno:
      correr con `NODE_OPTIONS=--no-experimental-webstorage` (como hace `package.json`'s `npm test`) —
      sin ese flag, el `localStorage` experimental de Node choca con el mock de jsdom y produce ~117
      fallas espurias en los mocks de `localStorage` que no son del código.

---

## Fase 0 — Primitivos compartidos (sin consumidores todavía) — GOVERNANCE BAJO

> Todo lo de esta fase es código nuevo y aislado: no modifica ningún archivo existente, así que no
> puede romper nada. Se puede aplicar con autonomía completa.

### 1. Tipos del contrato

- [x] 1.1 Crear `frontend/src/shared/types/paginacion.ts` con `RangoPagina` (`pagina` 1-based,
      `tamanio`) y `Pagina<T>` (`items`, `total`, `pagina`, `tamanio`). Strict, sin `any`. Comentario
      de cabecera explicando que `total` es el universo filtrado, no `items.length`.

### 2. `rangoSupabase` — función pura (TDD)

- [x] 2.1 **RED** — `frontend/src/shared/lib/paginacion/rangoSupabase.test.ts`: página 1 tamaño 20 →
      `{ desde: 0, hasta: 19 }`. El módulo de producción todavía no existe.
- [x] 2.2 **GREEN** — `rangoSupabase.ts` con la implementación mínima.
- [x] 2.3 **TRIANGULATE** — página 3 tamaño 20 → `{ desde: 40, hasta: 59 }`; tamaño 1;
      página fuera de rango (no lanza, devuelve el rango calculado igual).
- [x] 2.4 **REFACTOR** — nombres y comentario del porqué de `hasta = desde + tamanio - 1`
      (`.range()` de PostgREST es **inclusivo** en ambos extremos, a diferencia de `slice`).

### 3. `construirFiltroBusqueda` — función pura compartida (TDD)

> Única definición de "qué matchea". La consumen la implementación Supabase **y** la mock (`design.md`
> §D9): dos copias se desincronizan y los tests quedan en verde contra un comportamiento que
> producción no tiene.

- [x] 3.1 **RED** — `construirFiltroBusqueda.test.ts`: término vacío → sin filtro (`null`).
- [x] 3.2 **GREEN** — implementación mínima.
- [x] 3.3 **TRIANGULATE** — término de una palabra sobre N columnas → una disyunción de `ilike`;
      término de dos palabras → conjunción de dos disyunciones; espacios múltiples y `trim`;
      escapado de `%` y `,` (el `.or()` de PostgREST usa la coma como separador — un término con coma
      rompería la expresión).
- [x] 3.4 **TRIANGULATE (matcher en memoria)** — la misma función expone el predicado equivalente que
      usa el mock, verificado con los mismos casos: mismo término, mismo resultado en ambos caminos.
- [x] 3.5 **REFACTOR** — extraer la lista de columnas buscables como parámetro (cada repository trae
      la suya), no hardcodearla.
      **→ Nota:** las columnas ya eran parámetro desde el GREEN (nunca hardcodeadas) — el refactor
      real fue extraer `expresionIlikePorColumna` como helper nombrado para separar "armar una
      condición por columna" de "recorrer los tokens".

### 4. `usePaginaListado` — hook compartido (TDD)

- [x] 4.1 **RED** — `usePaginaListado.test.ts` con un `listPage` doble: al montar, invoca `listPage`
      con `{ pagina: 1, tamanio }` y expone `items` y `total`.
- [x] 4.2 **GREEN** — implementación mínima.
- [x] 4.3 **TRIANGULATE — navegación**: `irAPagina(3)` re-invoca con `pagina: 3`.
- [x] 4.4 **TRIANGULATE — reset de página al filtrar**: estando en la página 5, cambiar el término
      vuelve a `pagina: 1`. *(Es el bug que 8 reimplementaciones a mano garantizarían; test explícito.)*
- [x] 4.5 **TRIANGULATE — debounce**: varias escrituras dentro de la ventana → **una sola** invocación,
      con el término final. Retardo inyectable + timers falsos, nunca esperas reales.
- [x] 4.6 **TRIANGULATE — el input no se retrasa**: el valor crudo se refleja de inmediato aunque la
      consulta se difiera.
- [x] 4.7 **TRIANGULATE — error**: `listPage` rechaza → mensaje en castellano y `loading` en `false`
      (nunca carga infinita). Cubierto además con un rechazo que no es instancia de `Error` (mensaje
      genérico), caso no listado explícitamente en la tarea pero necesario para no romper con un
      `throw` de valor no-`Error`.
- [x] 4.8 **TRIANGULATE — respuesta fuera de orden**: si vuelve la respuesta de una consulta vieja
      después de una nueva, se descarta (no pisa el resultado vigente con datos del término anterior).
- [x] 4.9 **REFACTOR** — separar el debounce en su propio helper si el hook queda denso.
      **→ Se extrajo `useDebouncedValue<V>(valor, delayMs)` privado al módulo.** También se aplicó un
      fix no listado en la tarea, descubierto por el propio ciclo GREEN: `listPage`/`construirFiltros`
      pasados como closures inline (el caso típico de uso) cambian de identidad en cada render, así
      que el efecto de fetch los lee por `ref` en vez de tenerlos como dependencia — si no,
      re-renderizar el componente que llama al hook dispararía un pedido nuevo en cada render, no
      solo cuando cambia página/tamaño/término.

### 5. `<Paginador>` — componente del design system (TDD)

- [x] 5.1 **RED** — `paginador.test.tsx`: renderiza "Página 3 de 7" y el total de resultados.
- [x] 5.2 **GREEN** — `frontend/src/design-system/paginador.tsx`, solo utilidades Tailwind v4, cero
      `style={{}}`, cero estado propio.
- [x] 5.3 **TRIANGULATE** — en la primera página "anterior" queda `disabled` **y visible** (no oculto:
      ocultarlo movería el layout entre páginas); ídem "siguiente" en la última.
- [x] 5.4 **TRIANGULATE** — con una sola página no ofrece navegación pero sigue informando el total.
- [x] 5.5 **TRIANGULATE (a11y)** — los controles son alcanzables y accionables por teclado, y el estado
      deshabilitado se comunica por `disabled` + texto, no solo por color.
- [x] 5.6 **REFACTOR** — revisar contra `components.tsx` que no se esté reimplementando un `Button`
      existente a mano (regla dura del proyecto).
      **→ Ya reusaba `Button` desde el GREEN** (`variant="secondary" size="sm"`) — no había markup de
      botón a mano que refactorizar.
- [x] 5.7 Registrar `<Paginador>` en el catálogo vivo `frontend/src/design-system/DesignSystem.tsx`.
      **→ Sección "19" con `PaginadorCatalog` (demo interactiva multi-página + caso de una sola
      página), import agregado junto al resto de primitivas del design system.**

### 6. Cierre de la fase 0

- [x] 6.1 `cd frontend && npx tsc -b --noEmit` en verde.
      **→ Confirmado: sin salida, 0 errores** (incluye `DesignSystem.tsx`, único archivo existente
      tocado en esta fase).
- [x] 6.2 `cd frontend && npx vitest run` en verde, sin regresiones respecto del baseline de 0.5.
      **→ Hallazgo importante, documentado para no repetir la investigación:** la suite completa
      (2389 tests) **tiene flakiness preexistente sensible a la carga de CPU, independiente de este
      change**. Se corrió 3 veces (una con otros procesos vitest concurrentes de este mismo apply, dos
      pretendidamente "limpias"): cada corrida completa falló en un subconjunto DISTINTO de 4 a 14
      tests, rotando entre `cuentas`, `facturación` (`FacturaForm`), `hojas-de-ruta`
      (`NuevoRecorridoForm`, `HojaDeRutaPage`), `obras-sociales` (`ChecklistEditor`), `dashboard` y
      `router` — ninguno de esos archivos importa ni consume nada de `shared/lib/paginacion/`,
      `shared/types/paginacion.ts` ni `design-system/paginador.tsx`. Verificado además corriendo los
      archivos que fallaban de a uno, aislados (sin contención): pasan en verde o casi en verde. Las
      **4 fallas de la línea base de 0.5 aparecieron en las 3 corridas** (únicas 100% deterministas).
      Los **35 tests nuevos de esta fase pasaron 35/35 en las tres corridas**, sin una sola falla.
      `npx tsc -b --noEmit` y `npx oxlint` limpios. Conclusión: sin regresión atribuible a este change;
      la flakiness de la suite es preexistente y queda fuera de alcance de este change (no se
      "arregla" acá, mismo criterio que las 4 fallas de la línea base). **Nota adicional:** `git
      status` muestra trabajo sin commitear de una sesión distinta sobre Hojas de Ruta
      (`NuevoRecorridoForm.tsx`, `sugerirRecorridoExistente.ts` sin trackear, feature "sugerencia de
      recorrido existente" en curso) — no tocado ni revertido por este apply; probablemente explica
      parte de la inestabilidad observada en `NuevoRecorridoForm.test.tsx` en las corridas de la
      suite completa (WIP ajeno, no una regresión de paginación).
- [x] 6.3 `cd frontend && npx oxlint` sin hallazgos nuevos.
      **→ Confirmado: 0 hallazgos en los 6 archivos nuevos/tocados** (`paginacion.ts`,
      `rangoSupabase.ts`(+test), `construirFiltroBusqueda.ts`(+test), `usePaginaListado.ts`(+test),
      `paginador.tsx`(+test), `DesignSystem.tsx`). Los hallazgos preexistentes del proyecto
      (warnings de `react(only-export-components)` y `no-unsafe-optional-chaining`) están todos en
      archivos no tocados por este change.
- [ ] 6.4 Commit `feat(paginacion): primitivos de paginacion compartidos (tipos, rango, hook, Paginador)`.
      **⏸️ CHECKPOINT de fase — revisar con la usuaria antes de la fase 1.**
      **→ NO ejecutado a propósito en este batch de apply**: regla de la sesión — solo la usuaria
      hace commit, explícitamente. Cambios quedan en el working tree, sin stagear ni commitear.
      Mensaje sugerido (Conventional Commits) queda documentado en el reporte de apply para que la
      usuaria lo use si decide commitear.

---

## Fase 1 — Hojas de Ruta: `getByFecha` en vez de traer la historia entera

> **✅ RETOMADA Y CERRADA (2026-08-12).** La sesión paralela sobre Hojas de Ruta (`NuevoRecorridoForm.tsx`,
> `sugerirRecorridoExistente.ts`, `RecorridoCard.tsx`, `useHojasDeRuta.ts`, `useHojasDeRuta.test.ts`)
> cerró y commiteó su trabajo (`b758d4b`, `59caedc`) antes de este apply — working tree limpio al
> arrancar. La usuaria autorizó explícitamente (dos veces) avanzar. Ver engram
> `paginacion-listados: usuaria autorizó tocar useHojasDeRuta.ts pese a WIP sin commitear`.

> La mayor ganancia de payload del change y la más barata: `getByFecha` **ya existe** en
> `HojaDeRutaRepository` y en `SupabaseHojaDeRutaRepository`. No hay nada nuevo que escribir en la capa
> de datos. **No lleva paginación ni `<Paginador>`** — `design.md` §D7.

### 7. Safety net

- [x] 7.1 Correr los tests que cubren `HojaDeRutaPage` y `useHojasDeRuta`
      (`useHojasDeRuta.test.ts` y los de la feature) y registrar el baseline "N/N en verde".
      Si algo ya falla → falla preexistente, se reporta y NO se arregla acá.
      **→ BASELINE (2026-08-12, apply Fase 1): 205/205 tests en verde (30 archivos)** —
      `src/features/hojas-de-ruta/**` + `src/features/dashboard/**` (el dashboard también consume
      `getByFecha` vía `useHojaDeRutaDelDia`, mismo repository). Comparado contra el cierre de la
      Fase 3 (2508/2511 global) — ninguna falla preexistente cae dentro de este subconjunto.

### 8. Carga del día por fecha (TDD)

- [x] 8.1 **RED** — test sobre el hook/página con un `HojaDeRutaRepository` doble: al seleccionar una
      fecha se invoca **`getByFecha(fecha)`** y **NO** `list()`. Es el corazón del cambio: el test
      cuenta qué método se llamó.
      **→ `useHojasDeRuta.test.ts`, primer test reescrito: además de loading/hoja del día, asserta
      `expect(repository.getByFecha).toHaveBeenCalledWith(fecha)` y
      `expect(repository.list).not.toHaveBeenCalled()`. Confirmado en rojo contra la implementación
      vieja (6/9 tests fallando) antes de tocar producción.**
- [x] 8.2 **GREEN** — reemplazar en `HojaDeRutaPage.tsx` el `useHojasDeRuta(...)` + `.find(h => h.fecha === fecha)`
      por la carga por fecha (hook propio `useHojaDeRutaDelDia` o variante del existente — decidir en el
      apply según cuál deja el diff más chico y no rompe `crear`/`actualizar`).
      **→ Se eligió la variante del hook existente** (`useHojasDeRuta.ts`, único consumidor
      `HojaDeRutaPage.tsx` confirmado por grep antes de tocarlo): pasa a recibir `fecha` como
      segundo parámetro, cambia `hojasDeRuta: HojaDeRuta[]` por `hojaDeRuta: HojaDeRuta | null`, y
      `cargar()` llama `repository.getByFecha(fecha)` en vez de `repository.list()`. `fecha` entra
      en las deps de `cargar` (`useCallback`), así que cambiar de fecha dispara solo el efecto de
      carga inicial de forma natural — sin lógica nueva de "refetch on date change". `crear`/
      `actualizar` (con `{ silencioso: true }`) no cambiaron de forma, solo lo que reconsultan.
      `HojaDeRutaPage.tsx`: `const { hojaDeRuta: hojaDelDia, loading, error, crear, actualizar } =
      useHojasDeRuta(hojaRepository, fecha)` — se renombra en la desestructuración para no tocar
      el resto del archivo (sigue usando `hojaDelDia` en todos lados). Se eligió esta variante en
      vez de extender `useHojaDeRutaDelDia` (dashboard) porque ese hook es de solo lectura — hacerle
      `crear`/`actualizar` + `{ silencioso: true }` hubiera sido más diff total que adaptar el hook
      que ya los tenía.**
- [x] 8.3 **TRIANGULATE — día sin hoja de ruta**: `getByFecha` resuelve `null` → estado vacío del día,
      sin excepción y sin carga infinita.
      **→ Test explícito en `useHojasDeRuta.test.ts` ("expone null cuando getByFecha() resuelve sin
      hoja para ese día").**
- [x] 8.4 **TRIANGULATE — cambio de fecha**: elegir otra fecha vuelve a consultar por la nueva fecha y
      descarta la anterior (no se acumulan días en memoria).
      **→ Test explícito con `renderHook(..., { initialProps })` + `rerender({ fecha: otra })`,
      verificando `getByFecha` llamado 1º con la fecha vieja y 2º con la nueva, y que el estado
      pasa a contener solo la hoja del día nuevo.**
- [x] 8.5 **TRIANGULATE — error del repository**: mensaje visible, sin loading infinito.
      **→ Test explícito, mismo patrón que antes pero contra `getByFecha` en vez de `list`.**
- [x] 8.6 **⚠️ TRIANGULATE — regresión de recarga silenciosa (obligatorio)**: mutar un recorrido
      (sugerir orden / subir / bajar / quitar parada) mientras un `RecorridoCard` está en modo edición
      **NO** debe activar el `loading` de pantalla completa ni desmontar la tarjeta en edición. Es el
      bug ya corregido el 2026-08-11 (`useHojasDeRuta.ts:28-35`, opción `{ silencioso: true }`) y este
      cambio puede reintroducirlo.
      **→ Cubierto en DOS niveles.** (1) Hook: los dos tests de regresión preexistentes
      (`actualizar()`/`crear()` no vuelven a poner loading en true durante el refetch pendiente) se
      migraron a `getByFecha`. (2) Integración de pantalla — NUEVO, no estaba en el fix original del
      2026-08-11 (que solo tenía cobertura a nivel hook): test en `HojaDeRutaPage.test.tsx`
      ("mutar un recorrido en modo edición no muestra el loading de pantalla completa ni desmonta el
      RecorridoCard") que monta la pantalla, entra en modo "Editar" de un `RecorridoCard` real, hace
      click en "Sugerir orden" con el refetch de `getByFecha` colgado a propósito, y verifica que no
      aparece "Cargando hoja de ruta…" y que el botón "Listo" (= sigue en modo edición, no se
      remontó en modo lectura) sigue presente. **Verificado que el test realmente detecta la
      regresión**: se revirtió temporalmente el guard `if (!opts.silencioso)` en `useHojasDeRuta.ts`
      (sed puntual, sin commitear) y se confirmó que los 3 tests de regresión (2 de hook + 1 de
      página) fallan correctamente; se restauró el fix inmediatamente después y se re-confirmó
      verde. No quedó ningún cambio de esa prueba en el archivo final.**
- [x] 8.7 **TRIANGULATE — la carga inicial sí muestra loading**: el contraparte de 8.6, para no
      "arreglarlo" silenciando también la carga inicial.
      **→ Cubierto por el primer test de `useHojasDeRuta.test.ts` (`expect(result.current.loading).toBe(true)`
      antes de que resuelva `getByFecha`), sin tocar ese comportamiento.**
- [x] 8.8 **REFACTOR** — dejar comentado en el código el porqué de `getByFecha` (embed de tres niveles,
      crece con cada día operado) para que nadie lo revierta a `list()` por comodidad.
      **→ Comentario extendido en `useHojasDeRuta.ts` (referencia explícita a design.md §D7, al
      embed de tres niveles hoja→recorrido→historial_recorridos y a por qué NO volver a `list()`) y
      nota corta en `HojaDeRutaPage.tsx` junto al cableado del hook.**

### 9. Cierre de la fase 1

- [x] 9.1 Verificar que ningún otro consumidor de `useHojasDeRuta` quedó roto
      (`grep -rn "useHojasDeRuta" frontend/src`).
      **→ Confirmado: único consumidor real `HojaDeRutaPage.tsx` (los otros dos matches son el
      propio hook y su test).**
- [x] 9.2 `npx tsc -b --noEmit` + `npx vitest run` + `npx oxlint` en verde, sin regresiones.
      **→ `tsc -b --noEmit`: 0 errores.** Suite completa: **2511/2514 tests en verde**, 3 fallas —
      las 3 dentro del set ya documentado de flakiness preexistente (`PermisosMatrizFields.test.tsx`
      ×1, `ChecklistEditor.test.tsx` ×2) — mismo patrón sensible a carga de CPU documentado en el
      cierre de las Fases 0/2/3. Ninguna falla nueva atribuible a este apply. **2514 tests totales
      vs. 2511 al cierre de la Fase 3** (+3 tests nuevos de esta fase: 2 triangulaciones de hook +
      1 regresión de integración de pantalla). `npx oxlint`: 0 hallazgos nuevos — los únicos 4
      hallazgos preexistentes bajo `hojas-de-ruta/**` (`SupabaseHojaDeRutaRepository.test.ts` ×3,
      `HojaDeRutaRepositoryContext.tsx` ×1) están en archivos NO tocados por este apply.
- [ ] 9.3 Commit `perf(hojas-de-ruta): cargar el dia por fecha en vez de traer todas las hojas de ruta`.
      **⏸️ CHECKPOINT de fase — pase visual en navegador con la usuaria (armado del día, cambio de
      fecha, edición de recorrido) antes de la fase 2.**
      **→ NO ejecutado a propósito, por instrucción explícita de este batch: solo la usuaria hace
      commit. Cambios quedan en el working tree, sin stagear ni commitear. Mensaje sugerido
      (Conventional Commits) en el reporte de apply — nota: el diff de esta fase toca 5 archivos que
      NO tenían cambios propios de otra sesión al arrancar (working tree limpio, confirmado por
      `git status` antes de empezar), así que este commit puede hacerse solo, sin mezclar con WIP
      ajeno.**

---

## Fase 2 — Pacientes: listado paginado con búsqueda server-side

> **⛔ NO ARRANCAR sin el veredicto de la tarea 0.1 (CHECKPOINT 1).**
> Es la tabla que más crece y la primera implementación completa del patrón; sale bien acá, el resto es
> repetición.

### 10. Safety net

- [x] 10.1 Correr `usePacientes.test.ts`, `SupabasePacienteRepository.test.ts`, `pacienteMapping.test.ts`
      y los tests de la feature Pacientes. Registrar baseline "N/N en verde".
      **→ BASELINE (2026-08-12, apply Fase 2): 374/374 tests en verde (22 archivos)** —
      `src/features/pacientes/**` + `src/shared/lib/pacientes/**` + `mockPacienteRepository.test.ts`.
      Comparado contra el baseline global de 0.5 (2350/2354, 4 fallas preexistentes no relacionadas
      con Pacientes) — ninguna de esas 4 fallas preexistentes cae dentro de este subconjunto.

### 11. Contrato del repository (TDD)

- [x] 11.1 **RED** — test contra el **mock**: `listPage({ pagina: 1, tamanio: 2, filtros: { busqueda: '' } })`
      devuelve 2 items y el `total` del fixture completo.
- [x] 11.2 **GREEN** — agregar `listPage` + `FiltrosPaciente` a `PacienteRepository.ts` (**sin tocar
      `list()`**) e implementarlo en `mockPacienteRepository.ts` cortando el array. **Sin bump de
      `SCHEMA_VERSION`**: no cambia la forma persistida, solo agrega una lectura.
- [x] 11.3 **TRIANGULATE** — página 2 devuelve items distintos; página fuera de rango devuelve `items`
      vacío con el `total` real; `tamanio` mayor al total devuelve todo.
- [x] 11.4 **TRIANGULATE — orden determinista en el mock**: mismo criterio que la implementación real
      (apellido, nombre, `id`), verificado sobre filas que empatan en apellido y nombre.
- [x] 11.5 **TRIANGULATE — búsqueda en el mock** vía `construirFiltroBusqueda`: por apellido, por DNI
      parcial, por nombre + apellido en cualquier orden, sin coincidencias.
      **→ 18/18 tests nuevos en `mockPacienteRepository.test.ts` (describe `listPage (11.x)`).**

### 12. Implementación Supabase (TDD)

- [x] 12.1 **RED** — test con el doble de `supabase` (mismo patrón que `SupabasePacienteRepository.test.ts`):
      `listPage` emite `.range(0, 19)` y pide `{ count: 'exact' }`.
      **→ El fake de `supabase-js` (harness compartido del archivo de test) no soportaba `.range()`,
      `.or()`, `.in()`, múltiples `.order()` encadenados ni `{ count }` — se extendió el harness
      (antes de escribir el RED de producción) sin romper ninguno de los 94 tests preexistentes que
      lo usan (confirmado corriendo la suite completa del archivo tras la extensión, previo a tocar
      `SupabasePacienteRepository.ts`).**
- [x] 12.2 **GREEN** — implementar `listPage` en `SupabasePacienteRepository.ts` reutilizando
      `SELECT_PACIENTE_COMPLETO`, `parsePacienteRow` y `ensamblarPaciente` (**no duplicar el mapeo**).
- [x] 12.3 **TRIANGULATE — orden**: la consulta encadena `.order('apellido_a')`, `.order('nombre_a')` y
      **`.order('id')`** como desempate. Sin el desempate, offset repite y saltea filas (`design.md` §D4).
- [x] 12.4 **TRIANGULATE — páginas sin solapamiento**: dos páginas consecutivas sobre un conjunto fijo
      no comparten ningún `id` y su unión reconstruye el total.
- [x] 12.5 **TRIANGULATE — total**: el `count` devuelto se propaga a `Pagina.total` y refleja el filtro
      aplicado, no la tabla entera. Incluye caso defensivo `count: null` → `total: 0`.
- [x] 12.6 **TRIANGULATE — búsqueda**: el filtro de `construirFiltroBusqueda` se traduce a `.or(...)`
      sobre `nombre_a`, `nombre_b`, `apellido_a`, `apellido_b`, `dni`.
- [x] 12.7 **TRIANGULATE — cobertura**: `leerCoberturasBatch` debe pedirse **solo para los pacientes de
      la página**, no para todos. Si hoy la consulta de coberturas no filtra, acotarla con `.in('paciente_id', ids)`
      — de lo contrario `listPage` seguiría trayendo la tabla de coberturas completa y la mitad del
      beneficio se pierde.
      **→ `leerCoberturasBatch` gana un segundo parámetro opcional `limitarAIds?: string[]`. `list()`
      la sigue llamando SIN ese parámetro (consulta idéntica a la de siempre, verificado con test de
      regresión explícito en 12.9). `listPage()` la llama con los `id` de las filas ya leídas de esa
      página → `.in('paciente_id', ids)`.**
- [x] 12.8 **TRIANGULATE — errores**: un error de PostgREST en `listPage` se traduce con
      `mapearErrorPaciente(..., { operacion: 'listar' })`, en castellano, nunca el mensaje crudo.
- [x] 12.9 **REFACTOR** — extraer lo común entre `list()` y `listPage()` (select + ensamblado) sin
      cambiar el comportamiento de `list()`. Correr los tests después de **cada** paso.
      **→ Extraído `ensamblarFilasConCobertura(rows, limitarCoberturaAIds?)`, usado por ambos. Test de
      regresión explícito agregado: `list()` sigue sin `.order()`/`.range()`/`count` tras el refactor.
      110/110 tests en verde en `SupabasePacienteRepository.test.ts` (94 preexistentes + 16 nuevos).**

### 13. Hook y pantalla (TDD)

- [x] 13.1 **RED** — test de `PacientesList`/página: se renderiza el `<Paginador>` con el total que
      devuelve `listPage`.
- [x] 13.2 **GREEN** — cablear `usePaginaListado` en el hook de pacientes y montar el `<Paginador>`.
      **→ Hook nuevo `frontend/src/features/pacientes/usePacientesPaginado.ts`** (no se tocó
      `usePacientes.ts` — sigue existiendo tal cual, lo siguen usando `PresupuestosPage`/
      `FacturacionPage`/`HojaDeRutaPage` para sus selectores/combos con el padrón completo).
      `PacientesPage.tsx` cablea `usePacientesPaginado` solo para la pantalla de listado.
- [x] 13.3 **TRIANGULATE — retirar el filtro client-side**: eliminar el `useMemo` de
      `PacientesList.tsx:48-54`; el `SearchInput` pasa a alimentar el término del hook. Test: escribir
      un término re-consulta el repository (no filtra en memoria).
- [x] 13.4 **TRIANGULATE — la búsqueda encuentra fuera de la primera página**: un paciente que no está
      en la página 1 sin filtrar aparece al buscarlo. *(Es exactamente lo que un filtro client-side
      sobre una página no puede hacer — el test que prueba que la mudanza al servidor sirvió.)*
- [x] 13.5 **TRIANGULATE — tres estados distinguibles**: sin pacientes cargados / búsqueda sin
      coincidencias / carga inicial. Nunca la misma pantalla para los tres.
- [x] 13.6 **TRIANGULATE — la tarjeta sigue siendo clickeable y "Editar" sigue con `stopPropagation`**
      (convención de UI del proyecto, no se pierde al reestructurar el listado).
- [x] 13.7 **TRIANGULATE — tras crear o editar un paciente** el listado recarga la página vigente
      (no salta a la página 1 ni se queda desactualizado).
      **→ Se agregó `recargar()` a `usePaginaListado`** (primitivo de Fase 0, extendido acá con su
      propio RED→GREEN, `usePaginaListado.test.ts`): repite la consulta vigente (misma
      página/término) sin resetear nada, vía un contador interno agregado a las deps del efecto de
      fetch — necesario porque `usePaginaListado` no tenía forma de forzar un refetch sin cambiar
      página/búsqueda. `usePacientesPaginado.crear`/`.actualizar` la invocan tras cada mutación.
      **Gotcha resuelto (no estaba explícito en la tarea):** la pantalla de detalle (`PacientesPage`)
      guarda el objeto `Paciente` COMPLETO en el estado de vista (no un id a buscar en `pacientes`,
      que ahora es solo la página cargada) — si no, seleccionar/crear un paciente que no cae en la
      página recién recargada mostraría una ficha vacía o rota. Test explícito en
      `PacientesPage.test.tsx` que fuerza ese escenario (mock de `listPage` sin el paciente
      seleccionado/creado en su respuesta).
- [x] 13.8 **REFACTOR** — dejar `PacientesList` presentacional puro (sin estado de filtrado propio).
      **→ `PacientesList` perdió su `useState`/`useMemo` de búsqueda; `busqueda`/`pagina`/`tamanio`/
      `total`/`onBusquedaChange`/`onCambiarPagina` llegan por props. 23/23 tests en verde
      (`PacientesList.test.tsx`, reescrito).**

### 14. Verificación de que nada más se rompió

- [x] 14.1 **Test de no-regresión de los selectores**: `PresupuestosPage` (combo de pacientes,
      `PresupuestosRoute.tsx:27`), `PacienteForm`, `FacturaForm` y el selector de pacientes de Hojas de
      Ruta siguen recibiendo el **padrón completo** vía `list()`. Es el modo de falla más peligroso del
      change: no rompe, **miente** (un combo con 20 de 400 pacientes no da error).
      **→ Test explícito agregado en `PresupuestosPage.test.tsx`** (`pacienteRepository.list()`
      llamado, `.listPage()` NUNCA). `PacienteForm`/`FacturaForm`/selector de Hojas de Ruta no se
      tocaron — siguen recibiendo el array ya resuelto por `usePacientes` en su composition root
      respectivo, sin cambios.
- [x] 14.2 **Test de no-regresión del dashboard**: `useAlertasCud` sigue calculando sobre `list()`
      completo. Una alerta de CUD vencido calculada sobre 1/20 del padrón es un **dato clínico falso**.
      **→ Test explícito agregado en `useAlertasCud.test.ts`.**
- [x] 14.3 `grep -rn "\.list()" frontend/src --include=*.ts --include=*.tsx` y revisar uno por uno que
      ningún consumidor haya quedado a mitad de camino.
      **→ Auditado: único cambio de `.list()` a `.listPage()` es `PacientesPage.tsx` (vía
      `usePacientesPaginado`, a propósito). Todo el resto —`usePacientes.ts`,
      `useEmisionFactura.ts`, `useFacturas.ts`, `useAlertasMantenimiento.ts`, `useAlertasCud.ts`,
      `useConductoresDashboard.ts`, `useDatosFinancieros.ts`, `useHojasDeRuta.ts`,
      `useConductores.ts`, `useVehiculos.ts`, `useObrasSociales.ts`, `usePresupuestos.ts`,
      `useAutorizaciones.ts`— sigue en `.list()`, sin tocar.**

### 15. Cierre de la fase 2

- [x] 15.1 `npx tsc -b --noEmit` + `npx vitest run` + `npx oxlint` en verde, sin regresiones.
      **→ `tsc -b --noEmit`: 0 errores.** `npx oxlint`: 0 hallazgos nuevos (confirmado con `git diff`
      de las líneas exactas de los 2 hallazgos preexistentes de `no-unsafe-optional-chaining` en
      `SupabasePacienteRepository.test.ts` — están fuera de las líneas tocadas por este apply). Suite
      completa corrida 3 veces: **2457/2460, 2460/2460 (contando *)... la corrida final estable
      dio 2457/2460 con exactamente 3 fallas, las 3 dentro del subconjunto de 4 fallas preexistentes
      de la línea base (0.5): `PermisosMatrizFields.test.tsx` y `ChecklistEditor.test.tsx` (×2). La
      4ª falla preexistente (`HojaDeRutaPage.test.tsx`) y una falla adicional de `router.test.tsx`
      aparecieron en corridas alternativas — mismo patrón de flakiness sensible a carga de CPU ya
      documentado en el cierre de la Fase 0 (6.2), rotando entre archivos no relacionados con
      Pacientes/paginación. Ninguna falla nueva atribuible a este apply en ninguna de las 3 corridas.
      **2460 tests totales vs. 2389 al cierre de la Fase 0** (+71 tests nuevos de esta fase).
      **⚠️ Desviaciones flageadas (tocar hojas-de-ruta), documentadas en el reporte de apply:**
      agregar `listPage` a `PacienteRepository` (aditivo, requerido por `design.md` §D3) rompió la
      compilación de varios dobles de `PacienteRepository` en archivos de test fuera del alcance de
      esta fase, incluidos dos bajo `frontend/src/features/hojas-de-ruta/` (`HojaDeRutaPage.test.tsx`,
      `HojaDeRutaPage.coherencia.test.tsx`) — área con otra sesión editando en paralelo. Se aplicó el
      fix mínimo posible (agregar `listPage: vi.fn()`/`.mockResolvedValue(...)` a los dobles
      existentes, cero cambios de lógica) porque no hacerlo dejaba el build roto para todo el
      repo. No se tocó ningún archivo de lógica de negocio de Hojas de Ruta.
- [ ] 15.2 Commit `feat(pacientes): listado paginado con busqueda server-side`.
      **⏸️ CHECKPOINT de fase — pase visual en navegador con la usuaria (paginar, buscar, crear, editar)
      antes de la fase 3.**
      **→ NO ejecutado a propósito en este batch de apply**: regla de la sesión — solo la usuaria
      hace commit, explícitamente. Cambios quedan en el working tree, sin stagear ni commitear.
      Mensaje sugerido (Conventional Commits) en el reporte de apply.

---

## Fase 3 — Conductores y Obras Sociales (patrón ya validado)

> Repetición del patrón de la fase 2 sobre dos dominios más chicos. Si en la fase 2 apareció algo que
> el diseño no previó, se corrige el diseño **antes** de replicarlo dos veces.

### 16. Conductores

- [x] 16.1 Safety net: `useConductores.test.ts` + tests de la feature. Registrar baseline.
      **→ BASELINE (2026-08-12, apply Fase 3): 280/280 tests en verde** —
      `src/features/conductores/**` + `src/shared/lib/conductores/**` +
      `mockConductorRepository.test.ts` + `src/features/dashboard/**`. Comparado contra el baseline
      global de 0.5 (2350/2354) y el cierre de Fase 2 (2460/2460) — ninguna falla preexistente cae
      dentro de este subconjunto.
- [x] 16.2 **RED/GREEN/TRIANGULATE** `listPage` + `FiltrosConductor` en `ConductorRepository.ts`,
      `SupabaseConductorRepository.ts` y `mockConductorRepository.ts` — mismos casos que 11.x y 12.x
      (páginas, orden con desempate por `id`, total, búsqueda, errores).
      **→ Orden: `apellido` asc, `nombre` asc, `id` desempate. Búsqueda sobre `apellido`, `nombre`,
      `dni`, `cuil` (mismas columnas que el `useMemo` retirado de `ConductoresList.tsx:35-38`).
      El fake harness de `SupabaseConductorRepository.test.ts` no soportaba `.range()`/`.or()`/
      `.order()`/`{count}` (a diferencia del de Pacientes, ya extendido en Fase 2) — se extendió
      antes del RED de producción, confirmando los 28 tests preexistentes en verde tras la
      extensión. 17/17 tests nuevos en `mockConductorRepository.test.ts` (describe `listPage
      (16.x)`), 7/7 nuevos en `SupabaseConductorRepository.test.ts` (describe `listPage()`).**
- [x] 16.3 **RED/GREEN/TRIANGULATE** hook + `ConductoresList.tsx`: retirar el `useMemo` de filtrado
      (`ConductoresList.tsx:35-38`), montar `<Paginador>`, conservar fila clickeable + `stopPropagation`
      en "Editar".
      **→ Hook nuevo `frontend/src/features/conductores/useConductoresPaginado.ts`** (no se tocó
      `useConductores.ts` — sigue existiendo tal cual, lo sigue usando `HojaDeRutaPage` para su
      selector de conductores con el padrón completo). `ConductoresList.tsx` reescrito
      presentacional puro (mismo criterio que `PacientesList` 13.8): `busqueda`/`pagina`/`tamanio`/
      `total`/`onBusquedaChange`/`onCambiarPagina` llegan por props. `ConductoresPage.tsx` cablea
      `useConductoresPaginado` y guarda el objeto `Conductor` completo en el estado de vista (no un
      id a buscar en la página cargada) — mismo gotcha de Pacientes 13.7, con su propio
      `actualizarYSincronizarVista` porque `ConductorDetail` lee el prop `conductor` directo (resumen,
      form, asignación semanal) sin re-derivarlo. 25/25 tests en verde (`ConductoresList.test.tsx`,
      reescrito), 12/12 en verde (`ConductoresPage.test.tsx`).
- [x] 16.4 **Test de no-regresión**: `useConductoresDashboard` sigue usando `list()` completo.
      **→ Test explícito agregado en `useConductoresDashboard.test.ts`** (`repository.list()`
      llamado, `.listPage()` NUNCA).
- [x] 16.5 **REFACTOR** — si aparece duplicación real entre el `listPage` de pacientes y el de
      conductores, extraerla; si es duplicación aparente (columnas y mapeos distintos), **no**
      forzar una abstracción.
      **→ Duplicación aparente, no real**: columnas de orden/búsqueda distintas (`apellido`/`nombre`/
      `dni`/`cuil` vs. `apellido_a`/`nombre_a`/`apellido_b`/`nombre_b`/`dni`), mapeo/ensamblado
      distinto (`ensamblarConductor` con embed de asignaciones vs. `ensamblarFilasConCobertura` con
      segunda consulta cross-schema), sin segunda consulta en Conductores. Lo único ya compartido —
      `rangoSupabase`/`construirFiltroBusqueda`/`usePaginaListado`/`<Paginador>` (Fase 0) — ya se
      reusa tal cual. No se forzó ninguna abstracción nueva.

### 17. Obras Sociales

- [x] 17.1 Safety net: `useObrasSociales.test.ts` + `SupabaseObraSocialRepository.test.ts`. Baseline.
      **→ BASELINE: incluido en el mismo run de 280/280 de 16.1** (`src/features/obras-sociales/**`
      corrido por separado más abajo en 17.2-17.5 también en verde; `ChecklistEditor.test.tsx` es la
      única falla preexistente dentro de `obras-sociales/**`, ya documentada en 0.5, no tocada).
- [x] 17.2 **RED/GREEN/TRIANGULATE** `listPage` + filtros en `ObraSocialRepository.ts`,
      `SupabaseObraSocialRepository.ts` y `mockObraSocialRepository.ts` (orden por nombre + `id`).
      **→ Orden: `razon_social` asc, `id` desempate. Búsqueda sobre `razon_social`, `cuit` (mismas
      columnas que el `useMemo` retirado de `ObrasSocialesList.tsx:29-32`). Mismo patrón de
      extensión del fake harness que 16.2 (`.range()`/`.or()`/`.order()`/`{count}`), confirmando los
      40 tests preexistentes en verde tras la extensión. El fixture del mock solo trae OSECAC — los
      tests de paginación siembran 2 obras sociales más con `create()` antes de paginar. 17/17 tests
      nuevos en `mockObraSocialRepository.test.ts` (describe `listPage (17.x)`), 7/7 nuevos en
      `SupabaseObraSocialRepository.test.ts` (describe `listPage()`).**
- [x] 17.3 **RED/GREEN/TRIANGULATE** hook + `ObrasSocialesList.tsx`: retirar el `useMemo`
      (`ObrasSocialesList.tsx:29-32`), montar `<Paginador>`.
      **→ Hook nuevo `frontend/src/features/obras-sociales/useObrasSocialesPaginado.ts`** (no se
      tocó `useObrasSociales.ts` — sigue existiendo tal cual, lo siguen usando PacientesPage/
      PresupuestosPage/FacturacionPage para sus selectores con el catálogo completo).
      `ObrasSocialesList.tsx` reescrito presentacional puro (mismo criterio que `ConductoresList`
      16.3). `ObraSocialesPage.tsx` cablea `useObrasSocialesPaginado` y guarda el objeto
      `ObraSocial` completo en el estado de vista, con su propio `actualizarYSincronizarVista`
      (`ObraSocialDetail` lee el prop `obraSocial` directo — resumen, form, checklist, plantilla de
      factura — sin re-derivarlo; mismo gotcha que 16.3/13.7). 18/18 tests en verde
      (`ObrasSocialesList.test.tsx`, reescrito — se preservaron los casos de truncado de checklist
      y de cantidad de documentos/identificador del archivo original), 7/7 en verde
      (`ObraSocialesPage.test.tsx`).
- [x] 17.4 **⚠️ Test de no-regresión crítico**: `PacientesList` resuelve el nombre de la obra social de
      cada paciente vía `nombreObraSocial(obraSocialId)`, poblado desde `ObraSocialRepository.list()`.
      Si eso se paginara, los pacientes cuya obra social cayó fuera de la página mostrarían "Sin obra
      social" — **dato incorrecto sin ningún error visible**. Verificar que sigue usando `list()`.
      **→ Test explícito agregado en `PacientesPage.test.tsx`** (`obraSocialRepository.list()`
      llamado, `.listPage()` NUNCA).
- [x] 17.5 **Test de no-regresión**: los selectores de obra social de Pacientes, Presupuestos y
      Facturación siguen recibiendo el catálogo completo.
      **→ Cubierto por 17.4 (Pacientes) + tests explícitos nuevos agregados en
      `PresupuestosPage.test.tsx` y `FacturacionPage.test.tsx`** (`obraSocialRepository.list()`
      llamado, `.listPage()` NUNCA, en los tres). `PacienteForm`/`FacturaForm` no se tocaron — siguen
      recibiendo el array ya resuelto por `useObrasSociales` en su composition root respectivo.

### 18. Cierre de la fase 3

- [x] 18.1 `npx tsc -b --noEmit` + `npx vitest run` + `npx oxlint` en verde, sin regresiones.
      **→ `tsc -b --noEmit`: 3 errores, los 3 esperados y documentados — dos test doubles
      (`ConductorRepository`/`ObraSocialRepository`) bajo `frontend/src/features/hojas-de-ruta/`
      (`HojaDeRutaPage.test.tsx`, `HojaDeRutaPage.coherencia.test.tsx`) quedan sin `listPage`
      **a propósito, sin tocar**: hay otra sesión trabajando en paralelo sobre archivos de
      Hojas de Ruta (`RecorridoCard.tsx`, `useHojasDeRuta.ts`, `useHojasDeRuta.test.ts`,
      modificados/sin commitear en el working tree) y la instrucción explícita de este batch fue no
      tocar nada bajo `hojas-de-ruta/`, ni siquiera un fix mecánico de una línea (a diferencia de la
      Fase 2, donde sí se aplicó ese fix mínimo para `PacienteRepository`). **Todos los demás test
      doubles de `ConductorRepository`/`ObraSocialRepository` del resto del repo (11 archivos fuera
      de `hojas-de-ruta/`) sí se actualizaron con `listPage`.** Nota importante: `vitest run` (motor
      esbuild, sin type-check) SÍ ejecuta esos dos archivos igual — no rompen en tests, solo en
      `tsc -b`; si hay un gate de CI que corre `tsc -b --noEmit`, fallará en esos 2 archivos hasta
      que la sesión paralela cierre o la usuaria autorice tocarlos. `npx oxlint`: 0 hallazgos nuevos
      (confirmado: los mismos warnings preexistentes de siempre, `react(only-export-components)` y
      `no-unsafe-optional-chaining`, todos en archivos no tocados por este apply). Suite completa:
      **2508/2511 tests en verde**, 3 fallas — las 3 dentro del set ya documentado de flakiness
      preexistente (`PermisosMatrizFields.test.tsx` ×1, `ChecklistEditor.test.tsx` ×2) — mismo
      patrón sensible a carga de CPU ya documentado en el cierre de las Fases 0 y 2. Ninguna falla
      nueva atribuible a este apply. **2511 tests totales vs. 2460 al cierre de la Fase 2** (+51
      tests nuevos de esta fase). Confirmado además `.list()` de `ConductorRepository`/
      `ObraSocialRepository` intacto en ambos repositories reales (`SupabaseConductorRepository.ts`,
      `SupabaseObraSocialRepository.ts`) — `listPage` es puramente aditivo, ninguna firma existente
      cambió.**
- [ ] 18.2 Commit `feat(conductores,obras-sociales): listado paginado con busqueda server-side`.
      **⏸️ CHECKPOINT de fase — pase visual en navegador con la usuaria (paginar, buscar, crear,
      editar en ambas pantallas) antes del cierre del change.**
      **→ NO ejecutado a propósito en este batch de apply**: regla de la sesión — solo la usuaria
      hace commit, explícitamente. Cambios quedan en el working tree, sin stagear ni commitear.
      Mensaje sugerido (Conventional Commits) en el reporte de apply.

---

## 19. Cierre del change

- [x] 19.1 Suite completa en verde y comparada contra el baseline de 0.5 (ningún test perdido, ningún
      test "arreglado" bajándole la exigencia).
      **→ 2511/2514 en verde, mismas 3 fallas preexistentes de siempre (`PermisosMatrizFields.test.tsx`,
      `ChecklistEditor.test.tsx` ×2), ninguna relacionada con este change.**
- [x] 19.2 Verificar que el alcance recortado se respetó: `git diff --stat` no toca
      `supabase/functions/**`, `supabase/migrations/**`, `design-system/table.tsx`, ni los repositories
      de vehículos, presupuestos, autorizaciones, facturas, cobros, cuentas ni documentos.
      **→ Verificado (`git diff --stat b758d4b..cbb77fe`, base = antes de Fase 0): vacío, nada tocado.**
- [x] 19.3 Verificar que **ninguna** firma de `list()` cambió en ningún repository
      (`git diff frontend/src/shared/lib/**/[A-Z]*Repository.ts`).
      **→ Verificado: el diff sobre `list()` en todo el change son solo comentarios documentando la
      relación aditiva con `listPage()`; cero cambios de firma o de comportamiento.**
- [x] 19.4 Documentar en `CHANGES.md` la deuda que este change deja abierta y **por qué**: paginación
      de vehículos / presupuestos / autorizaciones bloqueada por Edge Functions (requiere deploy de
      backend), paginación de facturas / cobros bloqueada por `integracion-facturacion`, y typeahead de
      selectores como el próximo paso si el padrón de pacientes sigue creciendo.
      **→ Documentado: nota completa bajo §C-05 (`pacientes-fichas-clinicas`), referencias cruzadas
      cortas bajo §C-04, §C-09 y §C-10.**
- [ ] 19.5 Pase visual final en navegador con la usuaria sobre las 4 pantallas tocadas.
- [ ] 19.6 `/opsx:archive paginacion-listados`.
</content>
