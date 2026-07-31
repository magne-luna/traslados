## Context

Corrección de modelo dentro de la rama **Vehículos y mantenimiento** (`C-08 vehiculos-mantenimiento`, lado frontend). El módulo ya está implementado y archivado como `vehiculos-ui` (`openspec/changes/archive/2026-07-24-vehiculos-ui/`, 24/24 tasks, verificado en navegador). Este change **no** agrega una feature nueva desde cero: repara un campo inventado y completa la entidad que faltaba.

Estado relevante hoy:
- `GastoVehiculo = { id, fecha, monto, descripcion?, categoria: CategoriaGasto }` con `CategoriaGasto = 'mantenimiento' | 'reparacion' | 'service'` — **valores sin fuente** (ni docx, ni KB, ni spec). `openspec/specs/vehiculo-gastos/spec.md` no menciona el campo.
- `Vehiculo` embebe `gastos: GastoVehiculo[]` y `habilitaciones: RegistroHabilitacion[]`; kilometraje/último service son campos propios de `Vehiculo`.
- Las alertas de RN-VE-03/04 se calculan al render con funciones puras (`shared/lib/mantenimiento/estadoServicePreventivo.ts`, `estadoHabilitacion.ts`) parametrizadas por `ahora`. **Ninguna se toca en este change.**
- `VehiculoDetail.tsx` ya tiene dos carteles `AvisoModeloDatos` sobre este dominio (kilometraje/habilitaciones embebidos; módulo de permisos de gastos).
- Mock en `localStorage` con `SCHEMA_VERSION = 2`; el comentario de v2 documenta que el bump anterior fue justamente por haber **agregado** `categoria` obligatorio.

Fuente estructural (`docs/core/Traslados-Modelo-Datos.docx`, extraído y verificado en esta sesión):
- `Gastos de Vehículo` → Vehículo, Monto, Fecha. Nada más.
- `Mantenimiento` → Vehículo, Categoría ("Tipo de intervención: gasto, mantenimiento preventivo o mantenimiento correctivo"), Fecha, Próximo vencimiento (fecha), Kilometraje actual, Próximo vencimiento (kilometraje). **Sin monto.**

Fuente de reglas (`knowledge-base/06_funcionalidades.md` L128-134, US-500; `05_reglas_de_negocio.md` RN-VE-03/04): preventivo = cambio de aceite/filtros + VTV + RTO; correctivo = alternador, batería, frenos, embrague, cubiertas, **etc.**

Restricciones duras del proyecto (`CLAUDE.md`): TypeScript strict, prohibido `any`; solo clases Tailwind v4, prohibido `style={{}}`; reusar `frontend/src/design-system/components.tsx` antes de escribir markup; verificar con `npx tsc -b --noEmit` dentro de `frontend/` (**nunca** `tsc --noEmit` a secas); toda discrepancia docx↔KB se documenta en los dos lugares + cartel `AvisoModeloDatos`, nunca se resuelve adivinando. **Strict TDD activo.** Governance: **MEDIO** (lógica de negocio de flota) — implementar con checkpoints y superficie de decisiones no obvias.

## Goals / Non-Goals

**Goals:**
- Eliminar `GastoVehiculo.categoria` y dejar el gasto exactamente como el docx: fecha + monto (+ `descripcion?` como texto libre).
- Modelar `MantenimientoRegistro` con la categoría real de **dos niveles**, tipada, sin `string` libre, y sin cerrar la lista de correctivos que la KB deja abierta con "etc.".
- Dar a `C-08` backend un contrato de `mantenimiento_registro` que no haya que reescribir (mismo criterio "tipos primero" de `vehiculos-ui`).
- Dejar la discrepancia trazada en los 3 lugares que exige la regla dura, aunque acá **sí** se resuelva el valor correcto (está confirmado contra el docx).

**Non-Goals:**
- **Migrar kilometraje/habilitaciones de `Vehiculo` a `MantenimientoRegistro`.** El docx los ubica en la tabla Mantenimiento, y ya hay cartel por eso, pero derivar `kilometraje`/`kilometrajeUltimoService`/`fechaUltimoService` del último registro del historial refactorizaría `estadoServicePreventivo`, `VehiculoMantenimiento`, `VehiculoForm`, el fixture y los consumidores de flota en Hojas de Ruta. Es un change propio; acá el historial se **suma al lado**, no reemplaza.
- Tocar las funciones puras de alertas ni sus specs (`vehiculo-mantenimiento` queda sin delta).
- Backend real: tablas `gasto_vehiculo`/`mantenimiento_registro`, RLS, cliente Supabase (es `C-08`).
- Campo `Notas` del vehículo (discrepancia distinta, ya documentada, fuera de alcance).
- Edición y borrado de registros de mantenimiento o de gastos: el alta es lo único que `vehiculos-ui` implementó (decisión explícita del usuario) y este change no cambia ese criterio.
- Vincular un `MantenimientoRegistro` correctivo con el `GastoVehiculo` que lo pagó (ver Open Questions — el docx no tiene esa FK y no se inventa).

## Decisions

### Decisión 1 — Dos entidades separadas, no un campo `categoria` sobre el gasto
`GastoVehiculo` queda `{ id, fecha, monto, descripcion? }` y la categorización se muda a `MantenimientoRegistro`. Motivo: es literalmente la estructura del docx, que manda en estructura por regla dura; el modelo anterior fusionaba dos tablas reales en una y para hacerlo tuvo que inventar tres valores de enum. Un gasto de combustible o de peaje no es una intervención de mantenimiento y no debería tener que elegir una categoría de mantenimiento para poder registrarse.
- **Alternativa descartada:** corregir solo los valores del enum (`'gasto' | 'preventivo' | 'correctivo'` sobre `GastoVehiculo`) sin crear la segunda entidad — más chico, pero seguiría contradiciendo al docx (el gasto no tiene categoría) y dejaría sin lugar los campos de próximo vencimiento por fecha/km, que son la mitad de la tabla `mantenimiento_registro`.

### Decisión 2 — Nivel 1 con los **tres** valores del docx, aunque la UI solo dé de alta dos
```ts
export type TipoIntervencion = 'gasto' | 'preventivo' | 'correctivo';
```
El docx enumera tres. El formulario de alta del historial ofrece solo `preventivo` y `correctivo`; un registro con `tipoIntervencion: 'gasto'` se **renderiza** (read-only, con chip propio) pero no se **crea** desde esta pantalla, porque crearlo duplicaría la entidad `Gastos de Vehículo` del mismo docx y permitiría cargar el mismo gasto en dos lados. Motivo: no se borra un valor que el docx nombra (el adaptador de `C-08` tiene que poder mapearlo), y a la vez no se habilita un camino de doble carga. Alinea con lo que confirmó el usuario ("serian **dos** tipos de categorias y dentro de ellas cada opcion").
- **Alternativa descartada:** `TipoIntervencion = 'preventivo' | 'correctivo'` — más simple, pero descarta en silencio un valor del campo Categoría del docx; si el backend inserta un registro `gasto`, el frontend no lo puede ni leer sin cambiar el tipo.
- El fixture siembra un registro `gasto` justamente para que el camino de lectura quede cubierto por test y no sea código muerto.

### Decisión 3 — Nivel 2 preventivo **cerrado**, nivel 2 correctivo **abierto por `'otro' + detalle`**
```ts
export type SubtipoPreventivo = 'cambio-aceite-filtros' | 'vtv' | 'rto';
export type SubtipoCorrectivoConocido = 'alternador' | 'bateria' | 'frenos' | 'embrague' | 'cubiertas';
export type SubtipoCorrectivo = SubtipoCorrectivoConocido | 'otro';
```
Asimetría deliberada:
- **Preventivo cerrado** porque la KB lo enumera sin "etc." y cada valor está atado a una regla codificada (cambio de aceite → RN-VE-03; VTV/RTO → RN-VE-04). Abrirlo permitiría un preventivo que ninguna regla sabe evaluar.
- **Correctivo abierto** porque la KB dice explícitamente "alternador, batería, frenos, embrague, cubiertas, **etc.**". Un enum cerrado haría inregistrable la primera intervención real que no esté en la lista (radiador, suspensión, caja) — y el patrón conocido del proyecto es que eso termina en un valor inventado, que es exactamente el bug que este change repara.
- La apertura es **`'otro'` + `detalle: string` obligatorio**, no `string` libre: se conserva el chequeo de tipos, los chips y el agrupamiento por sub-tipo conocido, y el texto libre queda confinado a un caso explícito y auditable ("cuántos 'otro' hay" es una señal directa de qué sub-tipo falta en el catálogo).
- **Alternativa descartada A:** `subtipo: string` libre en correctivo — pierde tipado, habilita typos y duplicados ("frenos" vs "Frenos"), y no permite chips ni filtros.
- **Alternativa descartada B:** enum correctivo cerrado — contradice el "etc." de la KB y garantiza que alguien vuelva a inventar un valor.

### Decisión 4 — `'otro'` exige `detalle` **en tiempo de compilación**, vía unión discriminada
```ts
interface MantenimientoRegistroBase {
  id: string;
  fecha: string;                     // ISO date — docx: Fecha
  kilometraje: number;               // docx: "Kilometraje actual" = odómetro al momento de la intervención
  proximoVencimientoFecha?: string;  // docx: Próximo vencimiento (fecha)
  proximoVencimientoKm?: number;     // docx: Próximo vencimiento (kilometraje)
  descripcion?: string;
}

export type MantenimientoRegistro =
  | (MantenimientoRegistroBase & { tipoIntervencion: 'preventivo'; subtipo: SubtipoPreventivo })
  | (MantenimientoRegistroBase & { tipoIntervencion: 'correctivo'; subtipo: SubtipoCorrectivoConocido })
  | (MantenimientoRegistroBase & { tipoIntervencion: 'correctivo'; subtipo: 'otro'; detalle: string })
  | (MantenimientoRegistroBase & { tipoIntervencion: 'gasto' });
```
Motivo: la invariante "si el sub-tipo es `otro`, el detalle es obligatorio" queda garantizada por `tsc`, no solo por una función de validación en runtime; y `tipoIntervencion: 'gasto'` no admite `subtipo`, que es lo que dice el docx (el nivel 2 solo existe dentro de las dos categorías de mantenimiento). El costo es un `switch` sobre `tipoIntervencion` en el render, que TypeScript verifica exhaustivo.
- **Alternativa descartada:** `{ tipoIntervencion; subtipo?; detalle? }` plano con validación solo en `validateMantenimientoForm` — más corto de escribir, pero permite construir en código un `otro` sin detalle o un `gasto` con sub-tipo de preventivo, y el mock/fixture son código.
- `MantenimientoRegistro` **no tiene `monto`**: el docx no lo tiene y el dinero es `gasto_vehiculo`. Registrar el costo de una intervención = un registro de mantenimiento + un gasto (ver Open Questions).

### Decisión 5 — El historial NO es la fuente de verdad de los vencimientos (todavía)
`proximoVencimientoFecha` / `proximoVencimientoKm` son informativos en el registro. El cálculo de alertas sigue leyendo `Vehiculo.kilometraje` + `kilometrajeUltimoService` + `fechaUltimoService` (service) y `Vehiculo.habilitaciones[].fechaVencimiento` (VTV/RTO). Motivo: separar **evento** (registro histórico: qué se hizo, cuándo, a qué km) de **estado** (validez actual: ¿está vencido hoy?) — el mismo criterio con el que `vehiculos-ui` decidió no persistir el estado de alerta (Decisión 3 de su design). Y así este change tiene **cero** riesgo de regresión sobre RN-VE-03/04.
- Consecuencia asumida: un preventivo con `subtipo: 'vtv'` y `proximoVencimientoFecha` puede contradecir `habilitaciones[].fechaVencimiento`. Es una duplicación real, se señaliza con `AvisoModeloDatos` y queda como Open Question para resolver junto al esquema de `C-08`, no acá.
- **Alternativa descartada:** derivar las alertas del último registro del historial — es el modelo correcto según el docx, pero arrastra el refactor completo descrito en Non-Goals y pondría en riesgo funcionalidad ya verificada por el usuario.

### Decisión 6 — `mantenimientos` embebido en `Vehiculo`, mutado vía `VehiculoRepository.update()`
Mismo patrón que `gastos` (Decisión 6 de `vehiculos-ui`): `Vehiculo.mantenimientos: MantenimientoRegistro[]`, sin repository propio. Motivo: el mock no hace joins, la relación 1—N se lee siempre junto al vehículo, y el día del backend real `SupabaseVehiculoRepository` ensambla la tabla separada sin que la UI cambie. Se evita además un segundo punto de inyección en el context.

### Decisión 7 — Los catálogos de etiquetas viven en un único módulo, como `categoriaGastoOptions` hacía
Se borra `categoriaGastoOptions.ts` y se crea `frontend/src/features/vehiculos/mantenimientoCategoriaOptions.ts` con: `TIPO_INTERVENCION_LABELS`, `TIPO_INTERVENCION_CHIP_KIND`, `SUBTIPO_PREVENTIVO_LABELS`, `SUBTIPO_CORRECTIVO_LABELS` y una función pura `subtiposDe(tipo)` que alimenta el segundo select en cascada. Motivo: un solo lugar que conozca el mapeo unión-literal → texto/color (criterio ya establecido) y una función pura trivialmente testeable en RED→GREEN antes de escribir el componente.

### Decisión 8 — `SCHEMA_VERSION` 2 → 3 con re-seed, no migración de payload
El `localStorage` guardado tiene gastos con `categoria`, propiedad que deja de existir. Se sube `SCHEMA_VERSION` a 3 y el mismatch re-siembra el fixture (camino ya implementado y especificado en `vehiculo-contract`). Motivo: es un mock, no hay dato de producción; escribir un migrador de payload sería trabajo tirado el día que llegue Supabase. Se documenta en el comentario del constante, igual que se hizo para v2.

### Decisión 9 — Reuso del design system, sin markup nuevo de estilos
`HistorialMantenimiento.tsx` se arma con `Table`/`Th`/`Td`/`Tr`, `Chip`, `SectionBadge`, `Field`/`Input`/`Select`, `Button requiereEscritura` y `CamposSoloLectura`, copiando la estructura de `GastosVehiculo.tsx` (tabla a la izquierda + form de alta a la derecha, `grid lg:grid-cols-[2fr_1fr]`). Motivo: regla dura de reuso del design system, y el gateo de escritura por módulo `vehiculos` (change `permisos-modulos-granulares`) ya funciona vía `requiereEscritura`/`CamposSoloLectura` — envolver el form nuevo con el mismo patrón lo deja gateado sin lógica de permisos propia. Accesibilidad: cada estado/categoría se comunica con **texto** en el chip además del color (WCAG AA, no depender del color).

## Risks / Trade-offs

- **Regresión al quitar un campo obligatorio del tipo** → cualquier construcción de `GastoVehiculo` que aún pase `categoria` rompe `tsc`, y cualquier test que la asierte falla. Mitigación: es el efecto deseado (el compilador enumera los call sites); `npx tsc -b --noEmit` + suite completa como safety net antes de tocar nada, y el borrado de `categoriaGastoOptions.ts` fuerza a que no queden importadores.
- **Un `AvisoModeloDatos` más en una pantalla que ya tiene dos** → riesgo de fatiga de carteles y de que se dejen de leer. Mitigación: el cartel nuevo va en la sección de Mantenimiento y se redacta acotado al punto pendiente (duplicación VTV/RTO entre `habilitaciones` y el historial); el cartel viejo de esa misma sección se **reescribe**, no se acumula, porque parte de lo que decía ("en el docx hay una tabla Mantenimiento aparte") deja de ser una discrepancia una vez que este change crea la entidad.
- **La unión discriminada de 4 miembros complica el form** → el estado del formulario tiene que representar "todavía no elegí sub-tipo" sin violar el tipo. Mitigación: el estado del form es un tipo laxo propio del componente (`{ tipoIntervencion; subtipo: string; detalle: string; ... }`) y `validateMantenimientoForm` es la función pura que lo estrecha a `MantenimientoRegistro`; el tipo estricto solo se construye al submit válido. Mismo patrón que `validateVehiculoForm`/`validateGastoForm`.
- **`'otro'` como fuga del catálogo** → si todo se carga como `otro`, el catálogo de nivel 2 pierde valor analítico. Mitigación: `otro` se ofrece último en el select y exige detalle; queda como métrica a revisar con el cliente (Open Questions) para promover sub-tipos frecuentes al catálogo.
- **Divergencia de nombres con el backend `C-08`** → `mantenimiento_registro` no existe todavía; los nombres de columna reales podrían no calzar. Mitigación: los campos salen 1:1 del docx (Fecha, Categoría, Kilometraje actual, Próximo vencimiento fecha/km) y la UI habla contra `VehiculoRepository`, así que un ajuste queda contenido en el adaptador. Coordinar antes de escribir la migración (ya está pedido en `CHANGES.md` §C-08).
- **Alcance percibido como "solo un enum"** → tentación de arreglar de paso el kilometraje/habilitaciones del docx. Mitigación: explícito como Non-Goal; si se toca, se abre un change propio.

## Migration Plan

Sin migración de datos (frontend + mock). Orden de aplicación, pensado para no dejar el árbol en un estado intermedio roto:

1. **Documentación primero** (`04_modelo_de_datos.md`, `CHANGES.md`) — la regla dura pide dejar la discrepancia marcada antes de resolverla en código.
2. **Tipos** (`vehiculo.ts`): quitar `CategoriaGasto`/`GastoVehiculo.categoria` y sumar `MantenimientoRegistro` + `Vehiculo.mantenimientos` en el mismo commit. A partir de acá `tsc` señala todos los call sites roto — se arreglan antes de commitear.
3. **Catálogos + validación** (funciones puras, TDD) → **mock/fixture** (`SCHEMA_VERSION` 3) → **UI** (`GastosVehiculo` sin categoría, `HistorialMantenimiento` nuevo) → **wiring + cartel** en `VehiculoDetail`.
4. **Verificación**: suite completa sin regresiones, `npx tsc -b --noEmit` limpio, `npm run lint`, y verificación manual en navegador (limpiar `localStorage` para ejercitar el re-seed de v3).

Camino futuro (`FE-8`, cuando `C-08` backend se archive): `SupabaseVehiculoRepository` ensambla `mantenimientos` desde `mantenimiento_registro` y `gastos` desde `gasto_vehiculo`; los tipos y componentes de este change no cambian.

Governance MEDIO: implementar con checkpoints. Las decisiones 2, 3 y 5 son las no obvias y se suben al usuario antes de `apply` (ver Open Questions).

## Open Questions

1. **Nivel 1 con dos valores o con tres.** El docx dice "gasto, mantenimiento preventivo o mantenimiento correctivo"; el usuario dijo "**dos** tipos de categorias". La Decisión 2 concilia (tres en el tipo, dos en el alta). ¿Se confirma, o el usuario prefiere que `gasto` desaparezca también del tipo? — **decisión no obvia, confirmar antes de `apply`.**
2. **Sub-tipos correctivos a precargar en el catálogo.** Se toman los 5 que nombra la KB (alternador, batería, frenos, embrague, cubiertas) + `otro`. ¿Hay otros que la administradora registre seguido y convenga tipar de entrada (radiador, suspensión, caja, escape, embrague hidráulico)?
3. **VTV/RTO duplicados.** Con `SubtipoPreventivo` incluyendo `vtv`/`rto`, el vencimiento de una habilitación podría quedar escrito en `Vehiculo.habilitaciones[].fechaVencimiento` y en `MantenimientoRegistro.proximoVencimientoFecha`. Este change deja `habilitaciones` como única fuente para las alertas (Decisión 5) y señaliza la duplicación. ¿Se resuelve en un change propio antes o después de la migración de `C-08`?
4. **Vínculo mantenimiento ↔ gasto.** El docx no tiene FK entre `mantenimiento_registro` y `gasto_vehiculo`: una reparación de frenos que costó $X se carga dos veces, sin relación. ¿Debería `MantenimientoRegistro` tener un `gastoId?` (o `gasto_vehiculo` un `mantenimiento_id?`)? **No se inventa acá** — a confirmar con quien mantiene el docx antes de cerrar el esquema de `C-08`.
5. **`descripcion?` en `GastoVehiculo`.** El docx da al gasto solo Vehículo/Monto/Fecha; `descripcion` es un agregado del frontend (viene de `vehiculos-ui`) y es lo que soporta el "combustible, peajes, reparaciones menores" del docx como texto libre. Este change lo **conserva**. ¿Se confirma como campo real de `gasto_vehiculo` para el backend, o el backend lo va a dejar afuera?
6. **Edición/borrado del historial.** El alta es lo único que hay (criterio heredado). ¿Hace falta corregir o eliminar un registro de mantenimiento mal cargado, o alcanza con dar de alta el correcto?
