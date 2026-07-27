## Context

Fase **FE-7** del `ROADMAP-FRONTEND.md`, lado UI + mock de **`C-11 panel-principal-reportes`** (`CHANGES.md §Fase 5`, governance **BAJO**). Cierra el último `PlaceholderPage` del roadmap frontend: la ruta `/`.

**Estado actual del repo.** Las seis fases anteriores ya dejaron todo lo que este change necesita, y lo dejaron con la forma correcta:

| Fuente | Change / fase | Qué aporta al dashboard |
|---|---|---|
| `mockHojaDeRutaRepository` (`getByFecha`) | `hojas-de-ruta-ui` / FE-5 (`C-10`) | Recorridos del día |
| `mockFacturaRepository` (`list`) + `mockCobroRepository` | `facturacion-ui` / FE-6 (`C-07`) | Facturado, cobrado, mora |
| `mockPacienteRepository` (`list`) + `estadoCud` | `pacientes-ui` / FE-3 (`C-05`) | CUD por vencer |
| `mockVehiculoRepository` (`list`) + `estadoServicePreventivo` / `estadoHabilitacion` | `vehiculos-ui` / FE-2 (`C-08`) | Alertas de mantenimiento |

Las cuatro dependencias de `CHANGES.md §C-11` (`C-05`, `C-07`, `C-08`, `C-10`) están implementadas del lado frontend/mock. Las funciones de estado ya existentes comparten una convención clave que este change hereda entera: **son puras y reciben la fecha de referencia por parámetro** (`estadoCud(cud, hoy)`, `estadoHabilitacion({ fechaVencimiento, ahora })`, `estadoVencimientoFactura({ fechaFactura, hoy, estado })`), nunca leen el reloj adentro. Eso es lo que las hace testeables sin fake timers, y es el motivo por el que las cinco funciones de agregación de este change van a tener la misma firma.

**Restricciones del proyecto** (`CLAUDE.md` §Reglas Duras): TypeScript strict sin `any`; Tailwind v4 con tokens en el `@theme` de `frontend/src/index.css`, sin `style={{}}` ni `!important`; Conventional Commits; estructura desde `docs/core/Traslados-Modelo-Datos.docx` y reglas de negocio desde `knowledge-base/`; toda discrepancia documentada en los dos lugares (KB §Discrepancias + cartel `AvisoModeloDatos` en la pantalla). Strict TDD activo (`npm test` → `vitest run` en `frontend/`), suite hoy en verde con 640 tests.

**Naturaleza particular de este change.** Es el único del roadmap que **no introduce ninguna entidad**. Todo lo que produce es proyección derivada. Eso cambia dónde está el riesgo: no está en modelar mal el dominio, está en **fijar mal las reglas de atribución** (¿a qué mes pertenece una factura? ¿y un cobro?) y en **reimplementar reglas que ya existen** en vez de reutilizarlas. Las decisiones de abajo atacan esos dos riesgos.

---

## Goals / Non-Goals

**Goals:**

- Que la administradora vea en una sola pantalla, al abrir el sistema, los recorridos de hoy y las cuatro señales de alerta del negocio (US-800).
- Reglas de atribución **explícitas y testeadas** para facturado y cobrado por período — que la diferencia facturado/cobrado sea un número defendible ante un contador, no una suma ambigua.
- **Cero duplicación de reglas de negocio**: mora, CUD y mantenimiento se derivan llamando a las funciones puras que ya existen. Si mañana cambia `PLAZO_ALERTA_VENCIDA_DIAS`, el dashboard cambia solo.
- Una capa de agregación que sea **el contrato explícito de las vistas SQL / RPC** que el backend `C-11` va a escribir: misma entrada conceptual, misma salida, mismos casos borde ya testeados.
- Estados de carga / error / vacío por panel, y accesibilidad WCAG 2.1 AA (semántica antes que ARIA, foco visible, contraste 4.5:1).

**Non-Goals:**

- **Cualquier escritura.** El dashboard no crea, edita ni borra nada. No hay formularios.
- Supabase real, vistas SQL, RPC, RLS, migraciones (todo eso es el backend `C-11`, FE-8).
- Exportación a PDF / Excel de los reportes, y envío por mail. No está en US-800.
- Gráficos con librería externa (Recharts, Chart.js, D3). Ver Decisión 8.
- Filtros cruzados, drill-down interactivo, comparación entre años, proyecciones o forecast.
- Rediseñar o tocar las pantallas de los módulos fuente. Se consumen tal cual.
- Entidades nuevas, migraciones o cambios de esquema de los tipos existentes.

---

## Decisions

### Decisión 1 — Capa de agregación como funciones puras en `shared/lib/reportes/`, no hooks ni queries

Cada reporte es una función pura en `frontend/src/shared/lib/reportes/` que recibe las colecciones **ya cargadas** más la fecha de referencia, y devuelve la proyección. No tocan repositorios, no tocan React, no leen `Date.now()`.

```
facturadoVsCobrado({ facturas, cobros, hoy, meses })   → SerieFacturadoVsCobrado
resumenAnual({ facturas, cobros, anio })               → ResumenAnual
facturasEnMora({ facturas, cobros, hoy })              → FacturaEnMora[]
cudPorVencer({ pacientes, hoy, umbralDias })           → PacienteCudPorVencer[]
alertasMantenimiento({ vehiculos, ahora })             → AlertaMantenimientoVehiculo[]
resumenDelDia(hojaDeRuta)                              → ResumenDelDia
```

**Por qué**: es exactamente el mismo patrón que `cupoConsumido` / `diasFacturables` / `sugerirOrdenPorCercania` — probado seis fases seguidas. Y hace que cada función sea el enunciado testeable de una vista SQL: `facturadoVsCobrado` es el `GROUP BY (anio_facturado, mes_facturado)` que el backend va a escribir, con sus casos borde ya fijados en tests.

**Alternativas descartadas**: (a) meter la agregación adentro de los hooks — mezcla I/O con reglas y obliga a montar componentes para testear una suma; (b) agregar métodos de reporte a los repositorios (`FacturaRepository.totalPorMes()`) — contamina un contrato CRUD estable con necesidades de una sola pantalla, y obligaría a modificar cuatro interfaces en vez de una.

### Decisión 2 — Regla de atribución del **facturado**: período estructurado + solo facturas emitidas

Una factura suma en el mes/año de **`mesFacturado` / `anioFacturado`** (el período que la factura cubre, campos estructurados que `facturacion-ui` agregó explícitamente "para el reporte anual de `C-11`"), y **solo si ya fue emitida** — estado `facturado`, `cobrado` o `pagado-parcialmente`. Una factura en `a-facturar` **no cuenta**: todavía no es plata facturada, es un borrador.

**Por qué el período y no la fecha de emisión**: el negocio piensa en meses de prestación ("¿cuánto facturamos de marzo?"), no en cuándo se imprimió el papel. Una factura de marzo emitida el 5 de abril es facturación de marzo. Además `fechaInicial`/`fechaTope` pueden cruzar el límite de mes, y usarlas obligaría a elegir arbitrariamente una de las dos o a prorratear.

**Por qué excluir `a-facturar`**: incluirlas inflaría el facturado con borradores y haría que la diferencia facturado−cobrado no signifique nada. El excluirlas queda como un scenario explícito del spec, no como un detalle de implementación.

**Alternativas descartadas**: atribuir por `fechaFactura` (fecha de emisión) — desalinea el reporte de cómo la administradora piensa el mes, y deja fuera del reporte a las facturas no emitidas *y* mueve una factura de marzo a abril; atribuir por `fechaInicial` — arbitrario cuando el período cruza meses.

### Decisión 3 — Regla de atribución del **cobrado**: `Cobro.fecha`, independiente del período de su factura

Un cobro suma en el mes en que **entró la plata** (`Cobro.fecha`), sin importar a qué período pertenece la factura que salda.

**Por qué**: es la única lectura de caja honesta, y es lo que hace que la "diferencia entre facturado y cobrado" (US-800) tenga sentido como indicador de mora agregada: si en marzo facturé 100 y cobré 20 de facturas viejas, la diferencia de marzo es +80 y eso es exactamente lo que hay que ver. Consecuencia aceptada y documentada: **las columnas de un mismo mes no son la misma factura** — el reporte muestra flujo, no conciliación factura por factura.

**Alternativa descartada**: atribuir el cobro al período de su factura (`mesFacturado` de la factura cobrada). Daría una conciliación por período pero destruiría la lectura de caja y volvería el reporte retroactivo — el mes de enero cambiaría de valor cada vez que entra un cobro viejo.

### Decisión 4 — Período configurable como unión cerrada `3 | 6 | 12`, contado hacia atrás desde el mes de la fecha de referencia

`PeriodoMeses = 3 | 6 | 12` (nunca `number` libre, misma disciplina que `EstadoFactura` o `AccesorioMovilidad`). El rango incluye el **mes en curso** y los N−1 anteriores, y se emiten **todos los meses del rango**, incluidos los que no tienen ni facturas ni cobros — con ceros, no ausentes.

**Por qué los meses vacíos con cero**: un mes sin datos es información (no se facturó), y omitirlo rompería la serie visualmente y obligaría a cada componente a rellenar huecos por su cuenta. La función `periodosDelRango({ hoy, meses })` que arma el eje se testea aparte, incluido el cruce de año (diciembre → enero).

**Alternativa descartada**: rango libre con dos date pickers. US-800 pide explícitamente "últimos 3, 6 o 12 meses"; un rango libre es más superficie de UI y de test para un requerimiento que nadie pidió.

### Decisión 5 — Las tarjetas de alerta **derivan**, no reimplementan

- **Mora** → `estadoVencimientoFactura({ fechaFactura, hoy, estado })` + saldo pendiente > 0, ambos de `shared/lib/facturacion/`. Una factura sin `fechaFactura` (nunca emitida) no puede estar en mora.
- **CUD** → `estadoCud(cud, hoy, umbralDias)` de `shared/lib/pacientes/`, tomando `'por-vencer'` y `'vencido'`. Paciente con `cud: null` se ignora.
- **Mantenimiento** → `estadoServicePreventivo(...)` + `estadoHabilitacion(...)` de `shared/lib/mantenimiento/`, un vehículo entra si cualquiera de las dos señales está en alerta, y la proyección dice **cuál** (o ambas). Vehículo `fuera-de-servicio` se incluye igual y se marca — es justamente lo que hay que ver.

**Por qué**: la regla de negocio tiene un solo dueño. Si el cliente confirma otro umbral, se toca la constante del módulo dueño y el dashboard se entera solo. Esto se hace verificable con un test que fuerza el borde exacto de cada umbral en vez de fijar el número en el dashboard.

**Alternativa descartada**: recalcular en el dashboard con sus propias constantes — dos fuentes de verdad para el mismo umbral, y el clásico bug de "la tarjeta dice 3 y la pantalla de facturación dice 4".

### Decisión 6 — `CobroRepository.list()`: la única modificación de contrato existente

Se agrega `list(): Promise<Cobro[]>` a `CobroRepository` y su implementación en `mockCobroRepository`. `listByFactura`, `create` y `remove` quedan intactos, así que `facturacion-ui` no se ve afectado.

**Por qué**: sin esto, agregar cobros por período obliga a llamar `listByFactura` una vez por factura (N+1). En el mock sería tolerable; como contrato hacia el backend sería una pésima señal, porque le estaría pidiendo a `C-11` que implemente el reporte con N queries. `list()` traduce directo a la vista agregada real.

**Alternativa descartada**: un `ReportesRepository` separado con métodos de agregación (`totalCobradoPorMes`). Metería la regla de agregación adentro del adaptador de datos, donde no se puede testear en aislamiento y donde el mock y el futuro Supabase podrían divergir en silencio. Con `list()` + función pura, la regla vive en un solo lado y la única diferencia entre mock y real es de dónde salen las filas.

### Decisión 7 — Carga independiente por panel, no una sola promesa

Cada panel (recorridos del día, tarjetas, facturado vs. cobrado, resumen anual) tiene su propio hook con su propio estado `cargando / error / datos`. Un `Promise.all` global se descarta.

**Por qué**: son cuatro lecturas sin relación entre sí. Que falle la lectura de facturas no tiene por qué borrar los recorridos de hoy, que es justamente lo que la administradora vino a ver. Cada panel muestra su propio error acotado ("No se pudieron cargar los datos de facturación") con el resto de la pantalla funcionando.

**Nota de eficiencia**: `facturadoVsCobrado`, `resumenAnual` y `facturasEnMora` consumen las **mismas** dos colecciones (`facturas`, `cobros`). Se cargan **una sola vez** en un hook compartido y las tres proyecciones se derivan de ese mismo par en memoria — un solo estado de carga para el bloque financiero, tres proyecciones puras sobre él. Nada de tres lecturas del mismo repositorio.

### Decisión 8 — Serie mensual dibujada con la grilla y los tokens de Tailwind v4, sin librería de gráficos

La serie facturado/cobrado se rinde como **tabla accesible + barras proporcionales** hechas con utilidades de Tailwind (ancho porcentual sobre el máximo del rango), no con un canvas ni un SVG generado por librería.

**Por qué**: (a) `RNF-05` del proyecto prioriza funcionalidad sobre estética; (b) sumar Recharts/D3 es una dependencia nueva, peso de bundle y una superficie de test que no tenemos cómo cubrir con RTL sin mocks frágiles; (c) una tabla con `<caption>`, `<th scope>` y valores numéricos es **más accesible** que un chart, y el mismo markup sirve de dato y de gráfico; (d) el patrón de "vista imprimible con utilidades `print:`" ya está establecido por `hojas-de-ruta-ui` y `facturacion-ui` — un chart en canvas ni siquiera imprimiría bien.

Los valores monetarios se formatean con `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })` en un helper único, y las columnas numéricas usan tabulares para que las cifras alineen.

**Alternativa descartada**: Recharts. Se reconsideraría si el cliente pide comparaciones interactivas o series largas, que hoy no están en US-800.

### Decisión 9 — Composition root propio en `DashboardRoute`, reutilizando los contexts existentes

`DashboardRoute.tsx` inyecta los cinco repositorios mock (todos de solo lectura) reutilizando los contexts de provider que cada feature ya expone (`FacturaRepositoryContext`, `CobroRepositoryContext`, y los equivalentes de paciente / vehículo / hoja de ruta), creando solo los que falten.

**Por qué**: es el mismo patrón de los siete changes anteriores y es lo que hace que FE-8 sea mecánico — cuando `C-11` backend entregue las vistas, se cambia qué implementación se inyecta acá y ningún componente se entera. Reutilizar los contexts existentes en vez de crear unos propios del dashboard evita tener dos providers distintos para el mismo repositorio en el mismo árbol.

### Decisión 10 — Umbrales del dashboard: se reutilizan los del módulo dueño; solo se declara lo que no tiene dueño

`shared/lib/reportes/constantes.ts` **no redefine** `PLAZO_ALERTA_VENCIDA_DIAS`, `DIAS_AVISO_HABILITACION`, `KM_SERVICE` ni el umbral de `estadoCud`: los importa o los deja resolver por default de la función dueña. Declara únicamente lo que es propio del dashboard y no existe en ningún otro lado:

- `PERIODOS_DISPONIBLES = [3, 6, 12]` — las opciones del selector, en un solo lugar.
- `MAX_ITEMS_TARJETA` — cuántos ítems se listan dentro de cada tarjeta antes del "ver todos" hacia el módulo fuente (evita que una tarjeta con 40 CUD vencidos coma la pantalla).
- `UMBRAL_CUD_DASHBOARD_DIAS` — se pasa explícito a `estadoCud` con el mismo valor que su default (60), como punto único de ajuste si el cliente pide que el dashboard avise antes que la ficha del paciente.

### Decisión 11 — Discrepancias con el docx: cartel agrupado, mismo patrón que `FacturaAvisoDiscrepancias`

`DashboardAvisoDiscrepancias.tsx` agrupa las cuatro discrepancias de abajo en un único `AvisoModeloDatos` al tope de la pantalla, en vez de sembrar un cartel por panel. **Por qué**: las cuatro comparten la misma causa raíz (el docx no modela nada de reportes) y el mismo destinatario (backend + dueño del docx); cuatro carteles separados serían ruido en la pantalla que justamente tiene que leerse de un vistazo. Es el patrón que `facturacion-ui` ya validó con sus cinco discrepancias.

---

## ⚠️ Discrepancias con `docs/core/Traslados-Modelo-Datos.docx`

Comparación hecha contra el docx entregado por MagneStudios (modelo conceptual de la BD real), áreas **3 Pacientes** (CUD), **5 Facturación** (Facturas, Cobros, Gastos de Vehículos) y **6 Conductores y Vehículos** (Mantenimiento). Todas se documentan además en `knowledge-base/04_modelo_de_datos.md §Discrepancias` y se señalizan en la UI con `AvisoModeloDatos` agrupado.

### Discrepancia 1 — El docx no modela **ninguna** vista, reporte ni agregación (NUEVA, estructural)

El docx describe siete áreas de entidades operativas y **cero** objetos de reporte: no hay vista, no hay tabla de resumen, no hay función agregadora. Es coherente con que sea un modelo *conceptual* de datos, y con que `CHANGES.md §C-11` diga "no requiere migraciones más allá de vistas SQL o funciones agregadoras" — pero significa que **el contrato de esas vistas no existe escrito en ningún lado**. Este change lo escribe: las seis funciones de `shared/lib/reportes/`, con sus tests de casos borde, **son** la especificación de lo que el backend `C-11` tiene que devolver. **Acción para backend `C-11`**: implementar las vistas/RPC contra estas firmas y estos casos borde, no contra una interpretación propia de US-800.

### Discrepancia 2 — La factura del docx no tiene **fecha de emisión** ni el estado `facturado`: sin ellos la mora no es calculable (KNOWN, promovida a bloqueante)

El docx modela en **Facturas**: `Descripción`, `Días`, `Valor del kilómetro`, `Monto`, `Estado` ("a facturar, cobrada, pagada parcialmente o **pendiente**"), `Fecha inicial / tope` y `Tipo de factura`. **No tiene fecha de emisión** y **no tiene el estado `facturado`**. `facturacion-ui` ya lo había marcado (sus Discrepancias 3 y 5) y agregó `Factura.fechaFactura` y `EstadoFactura = ... | 'facturado' | ...` del lado frontend. Para `C-11` esto deja de ser una comodidad: **la tarjeta de facturas en mora (RF-801/RF-406) es literalmente incalculable sin las dos cosas** — "vencida" se define como N días desde la emisión de una factura emitida y no saldada. **Acción para backend `C-11`/`C-07`**: confirmar `factura.fecha_factura` y el estado `facturado` antes de cerrar el esquema; si el docx se impusiera tal cual, RF-801 no se puede cumplir y hay que redefinir la regla de mora con el cliente.

### Discrepancia 3 — La factura del docx no tiene **período de atribución** estructurado (MENOR en `C-07`, promovida a estructural en `C-11`)

El docx colapsa el período en `Fecha inicial / tope` (dos fechas que pueden cruzar el límite de mes) y la descripción en un campo de texto. No hay mes/año estructurado. `facturacion-ui` agregó `mesFacturado` / `anioFacturado` anticipando este change (su Discrepancia 6, entonces catalogada como menor). Al construir el reporte queda claro que **sin un período canónico la pregunta "¿cuánto facturamos en marzo?" no tiene una respuesta única**: con solo `fechaInicial`/`fechaTope` hay que elegir arbitrariamente una de las dos o prorratear entre meses, y dos implementaciones razonables dan números distintos. **Acción para backend `C-11`/`C-07`**: agregar `factura.mes_facturado` / `factura.anio_facturado` (o declarar por escrito cuál de las dos fechas es la columna canónica de atribución) antes de escribir la vista del reporte.

### Discrepancia 4 — Las señales de alerta se **derivan en el cliente**; el docx las tiene **persistidas** (KNOWN, con riesgo de doble fuente de verdad)

Dos casos ya registrados por changes anteriores que este change vuelve visibles juntos en una misma pantalla:

- **CUD**: el docx tiene un booleano `Vigente` **persistido** en la entidad CUD; el frontend lo calcula al vuelo con `estadoCud` desde `fechaVencimiento` (ya anotado en la KB por `pacientes-ui`). Si el backend persiste `Vigente` y no lo recalcula, la tarjeta del dashboard y el flag de la BD **pueden contradecirse**.
- **Mantenimiento**: el docx tiene una entidad **Mantenimiento** con `Próximo vencimiento (fecha)` y `Próximo vencimiento (kilometraje)` **persistidos por intervención**; el frontend deriva el estado con `estadoServicePreventivo` desde `kilometraje` / `kilometrajeUltimoService` / `fechaUltimoService` embebidos en `Vehiculo` más las constantes `KM_SERVICE` / `MESES_SERVICE` (ya anotado por `vehiculos-ui`).

**Acción para backend `C-11`/`C-05`/`C-08`**: definir para cada una cuál manda — valor persistido o derivación — y dejarlo escrito. La postura del frontend es que **la derivación manda** (un valor persistido se desactualiza solo con el paso del tiempo, sin que nadie toque la fila), pero es una decisión que no corresponde tomar unilateralmente.

> **Ninguna de las cuatro se resuelve en este change.** Se documentan, se señalizan en la UI y quedan para confirmar con el cliente y con quien mantiene el docx.

---

## Risks / Trade-offs

- **[Reimplementar reglas ya existentes]** → Es el riesgo principal y el más fácil de cometer (copiar el umbral "60 días" al dashboard "para no importar nada"). Mitigación: Decisión 5 + tests de borde que fuerzan exactamente el día del umbral, y una tarea de verificación explícita de que `shared/lib/reportes/` **no** declara constantes que ya existen en los módulos fuente.
- **[Reglas de atribución discutibles]** → Facturado por período y cobrado por fecha de cobro (Decisiones 2 y 3) son elecciones defendibles pero no las únicas; un contador podría querer conciliación por factura. Mitigación: quedan como scenarios explícitos del spec y como texto visible en la UI ("Facturado por período de la factura · Cobrado por fecha de cobro"), para que quien lea el número sepa qué está leyendo. Cambiar la regla es cambiar una función pura y sus tests, no la pantalla.
- **[La mora depende de campos que el modelo real no tiene]** → Discrepancia 2. Mitigación: cartel `AvisoModeloDatos`, entrada en la KB, y una tarjeta que degrada con elegancia (si una factura no tiene `fechaFactura`, no entra en mora en vez de romper).
- **[Zonas horarias en la atribución por fecha]** → `Cobro.fecha` es ISO date; construir `new Date('2026-03-01')` da UTC y en `America/Argentina/Buenos_Aires` puede caer el mes anterior. Mitigación: comparar por componentes de fecha (año/mes parseados del string ISO) en vez de aritmética de `Date` para la atribución, con un test dedicado al cobro del día 1 y al del último día del mes. Es el mismo cuidado que `estadoVencimientoFactura` ya toma al normalizar con `T00:00:00.000Z`.
- **[Performance de agregación en cliente]** → Con volumen real (miles de facturas y cobros) agregar en el navegador deja de ser gratis. Mitigación: hoy es mock con decenas de registros y la agregación es O(n) en una sola pasada; a futuro FE-8 mueve el cálculo a una vista SQL, que es exactamente para lo que la Decisión 1 dejó la frontera trazada. Se memoiza la derivación con `useMemo` sobre el par `(facturas, cobros)` para no recalcular en cada render del selector de período.
- **[El dashboard como "pantalla que toca todo"]** → Al leer de cinco repositorios, es la pantalla que más se rompe cuando cambia cualquier tipo del dominio. Mitigación: solo lee, nunca escribe, y consume las interfaces (no las implementaciones); un cambio de tipo rompe en `tsc`, no en runtime.
- **[Tabla + barras en vez de gráfico]** → Menos vistoso que un chart. Trade-off aceptado explícitamente por `RNF-05` (funcionalidad sobre estética) y compensado en accesibilidad e impresión (Decisión 8).

---

## Migration Plan

No hay migración: es una pantalla nueva sobre una ruta que hoy muestra un placeholder.

1. Tipos y capa pura (`shared/types/reportes.ts`, `shared/lib/reportes/`) con sus tests — no toca nada existente.
2. `CobroRepository.list()` + implementación en el mock (única modificación de contrato; aditiva, sin romper consumidores).
3. Feature `features/dashboard/` con sus componentes y hooks.
4. Cambio de una línea en `router.tsx`: el `element` de `/` pasa de `PlaceholderPage` a `<DashboardRoute />`.
5. Documentación: KB §Discrepancias, `CHANGES.md §C-11`, `ROADMAP-FRONTEND.md` §FE-7.

**Rollback**: revertir el paso 4 devuelve el placeholder y deja el resto del código inerte; ningún dato se migra ni se pierde porque el dashboard no escribe.

---

## Open Questions

Ninguna bloquea el `apply` (governance **BAJO**), pero las cuatro primeras hay que llevarlas a la próxima conversación con el cliente / con quien mantiene el docx:

1. **¿Fecha de emisión y estado `facturado` entran al modelo real?** (Discrepancia 2). Si no, RF-801 (facturas en mora) hay que redefinirlo. Es la única pregunta con potencial de invalidar un requerimiento.
2. **¿Cuál es la columna canónica de atribución del facturado?** (Discrepancia 3). El frontend asume `mesFacturado`/`anioFacturado`.
3. **¿El `Vigente` del CUD y los "próximos vencimientos" del Mantenimiento se persisten o se derivan?** (Discrepancia 4). El frontend asume derivación.
4. **¿La diferencia facturado−cobrado que quiere ver la administradora es flujo de caja o conciliación por factura?** (Decisión 3). Se implementa flujo de caja; si resulta que quiere conciliación, cambia una función pura.
5. **Umbrales heredados sin confirmar** — `PLAZO_ALERTA_VENCIDA_DIAS = 60`, el umbral de CUD de 60 días, `KM_SERVICE` / `MESES_SERVICE` / `DIAS_AVISO_HABILITACION`: ya venían marcados como pendientes por `facturacion-ui`, `pacientes-ui` y `vehiculos-ui`. Este change **no los cambia ni los redefine**; solo hereda la pregunta.
6. **¿Hace falta exportar los reportes?** US-800 habla de "preparación de balances", lo que sugiere que sí en algún momento. Fuera de alcance acá; el patrón de vista imprimible de `hojas-de-ruta-ui` / `facturacion-ui` está listo para cuando se pida.
