## Context

Motivación y alcance: ver `proposal.md`. Estado actual relevante:

- `pacientes.recorrido` (`20260804100000_schema_hoja_de_ruta.sql`): `vehiculo_id`/`conductor_id`
  `NOT NULL` con FK `ON DELETE RESTRICT`. Es la única versión del schema en el repo (ninguna migración
  posterior la toca).
- `pacientes.historial_recorridos.id_vehiculo` (columna legacy, se usa como parada) ya es **nullable**
  (FK `ON DELETE SET NULL`, `20260724100006`). Las RPC la sincronizan con `recorrido.vehiculo_id`.
- `crear_hoja_de_ruta_completa` / `actualizar_hoja_de_ruta_completa` (`20260804110000_hoja_de_ruta_rpc.sql`,
  única versión; `SECURITY INVOKER`, `search_path = ''`) insertan recorridos con columnas explícitas y
  traducen `foreign_key_violation`/`not_null_violation` a `45304`. Las llama el frontend vía
  `supabase.rpc` — **no hay Edge Function** de hoja de ruta, así que el backend es solo `db push`.
- Frontend: `Recorrido.vehiculoId/conductorId: string` y ~10 consumidores los leen sin condición.
  `parseRecorridoRow` (`hojaDeRutaMapping.ts`) **descarta en silencio** cualquier fila sin
  `vehiculo_id`/`conductor_id`: sin tocarlo, un tercerizado se guardaría bien y desaparecería al
  releer.
- `hojaDeRutaMigrations.test.ts` ya testea migraciones como texto (`node:fs`): patrón reutilizable
  para TDD del `.sql` sin base.

## Goals / Non-Goals

**Goals:**
- Que "propio ⇒ vehículo + conductor; tercerizado ⇒ ninguno; remis ⇒ agencia" sea imposible de
  violar, tanto en la base (CHECK) como en el compilador (unión discriminada).
- Migración aditiva y compatible hacia atrás con el frontend desplegado.

**Non-Goals:**
- Costo del viaje, catálogo de agencias, nombre de la aplicación, reporte de deuda por agencia
  (preguntas abiertas del proposal).
- Tocar `pacientes.recorridos` (agenda habitual del paciente): no tiene vehículo; el tipo de
  transporte es del viaje del día, no del hábito.
- Capacidad del Uber/remis: no se valida (no hay dato).

## Decisions

### D1 — Modelo de datos: columna discriminante + agencia + CHECK de coherencia (recomendado)

```sql
ALTER TABLE pacientes.recorrido
  ADD COLUMN tipo_transporte TEXT NOT NULL DEFAULT 'propio'
    CHECK (tipo_transporte IN ('propio', 'aplicacion', 'remis')),
  ADD COLUMN agencia_remis TEXT,
  ALTER COLUMN vehiculo_id DROP NOT NULL,
  ALTER COLUMN conductor_id DROP NOT NULL,
  ADD CONSTRAINT recorrido_tipo_transporte_coherente CHECK (
    (tipo_transporte = 'propio'
       AND vehiculo_id IS NOT NULL AND conductor_id IS NOT NULL AND agencia_remis IS NULL)
    OR (tipo_transporte = 'aplicacion'
       AND vehiculo_id IS NULL AND conductor_id IS NULL AND agencia_remis IS NULL)
    OR (tipo_transporte = 'remis'
       AND vehiculo_id IS NULL AND conductor_id IS NULL AND btrim(agencia_remis) <> '')
  );
```

- `TEXT + CHECK` y no `CREATE TYPE ... AS ENUM`: es el patrón del repo (`tramo`, `condicion_iva`) y
  agregar un valor más adelante (ej. `particular`) es un `DROP/ADD CONSTRAINT`, no un `ALTER TYPE`
  que no corre dentro de transacción en todas las versiones.
- `ADD COLUMN ... DEFAULT` constante es solo metadata en PG ≥ 11 (sin rewrite). El CHECK nuevo
  valida las filas existentes: todas son `propio` con vehículo y conductor, así que pasa. La tabla es
  chica (un recorrido por vehículo por día), un `ADD CONSTRAINT` validado directo alcanza; no hace
  falta `NOT VALID` + `VALIDATE`.
- Las FK quedan igual (`ON DELETE RESTRICT`): NULL no se chequea contra la FK.
- El índice `idx_recorrido_vehiculo_id` sigue sirviendo; no hace falta índice por `tipo_transporte`
  ni por agencia mientras no exista el reporte por agencia (pregunta abierta 3).
- RLS: sin cambios (policies por fila de la tabla, cubren columnas nuevas). Auditoría: el trigger
  `auditoria.log_action` registra las columnas nuevas sin cambios.

**Alternativas consideradas:**

| Alternativa | Por qué no |
|---|---|
| A. `tercerizado BOOLEAN` + `tipo_tercerizado TEXT NULL` + `agencia_remis` | Dos columnas para un solo eje: admite estados sin sentido (`false` + `remis`) que el CHECK tendría que prohibir igual. Más condiciones, mismo resultado. Ventaja: mapea 1:1 con el checkbox de la UI — pero la UI puede derivarlo de `tipo_transporte !== 'propio'`. |
| B. Tabla 1:1 `pacientes.recorrido_tercerizado (recorrido_id PK/FK, tipo, agencia)` | No toca constraints de `recorrido`, pero sigue haciendo falta dropear los `NOT NULL` de vehículo/conductor; el CHECK "tercerizado ⇒ sin vehículo" cruzaría dos tablas (trigger, no CHECK). Embed extra en el select y RLS + auditoría nuevas. Más piezas sin beneficio. |
| C. Catálogo `agencia_remis` con FK | Decisión de la usuaria: texto libre por ahora. Camino de upgrade: crear tabla, poblar con `SELECT DISTINCT btrim(agencia_remis)`, agregar `agencia_remis_id` FK y migrar. Se activa con la pregunta abierta 4. |
| D. Vehículo/conductor "fantasma" ("Uber", "Remis París") en las tablas de flota | Cero cambio de schema, pero contamina flota (mantenimiento, documentos, asignación semanal, alertas, capacidad) y mezcla datos falsos con reales. Rechazada. |

### D2 — RPC: copia de la versión vigente con diff mínimo, en la misma migración

Nueva migración `supabase/migrations/2026MMDDHHMMSS_recorrido_tipo_transporte.sql` (timestamp > 
`20261014130000`) con el `ALTER TABLE` de D1 y el `CREATE OR REPLACE` de las dos funciones,
copiadas **literalmente** de `20260804110000_hoja_de_ruta_rpc.sql` (incluidos `SECURITY INVOKER`,
`SET search_path = ''`, `REVOKE`/`GRANT`, `COMMENT ON FUNCTION`) con solo estos cambios:

1. `INSERT INTO pacientes.recorrido (hoja_de_ruta_id, vehiculo_id, conductor_id, tipo_transporte,
   agencia_remis, manual, notas)` con `COALESCE(NULLIF(v_recorrido ->> 'tipo_transporte', ''),
   'propio')` y `NULLIF(btrim(v_recorrido ->> 'agencia_remis'), '')`.
2. `EXCEPTION WHEN check_violation THEN RAISE ... 'Revisá el tipo de transporte del recorrido.'
   USING ERRCODE = '45305'`, al lado del handler existente de `45304` (que no cambia: sigue cubriendo
   FK inexistente).
3. Paradas: `id_vehiculo` sigue siendo `v_vehiculo_id`, que para un tercerizado es `NULL` (la
   columna ya lo admite). Sin cambio de código, solo comentario.

Una sola migración (schema + funciones) porque deben aplicarse juntas: funciones nuevas sin columnas
fallan, columnas sin funciones nuevas ignoran el tipo de transporte. Firma de las funciones sin
cambio → `CREATE OR REPLACE` alcanza, sin `DROP FUNCTION`.

Antes de escribir el `.sql`, Enzo (o quien aplique) verifica en vivo que la definición real de
`pacientes.recorrido` y de las dos funciones coincide con el repo (`\d pacientes.recorrido`,
`pg_get_functiondef`) — en otros módulos el schema real fue por delante del repo.

### D3 — Tipo TS: unión discriminada, no campos nullable

```ts
export type TipoTransporte = 'propio' | 'aplicacion' | 'remis';

export type TransporteRecorrido =
  | { tipoTransporte: 'propio'; vehiculoId: string; conductorId: string }
  | { tipoTransporte: 'aplicacion' }
  | { tipoTransporte: 'remis'; agenciaRemis: string };

interface RecorridoBase { id: string; manual: boolean; notas?: string; paradas: ParadaRecorrido[] }
export type Recorrido = RecorridoBase & TransporteRecorrido;
export type NuevoRecorrido = Omit<RecorridoBase, 'id' | 'paradas'> & TransporteRecorrido
  & { paradas: NuevaParadaRecorrido[] };
```

- Alternativa: `vehiculoId: string | null` + `tipoTransporte` + `agenciaRemis?`. Diff más chico,
  pero `vehiculos.find((v) => v.id === recorrido.vehiculoId)` compila igual con `null` y termina en
  "Vehículo desconocido" en pantalla. Con la unión, `tsc -b` marca **cada** lectura sin narrowing:
  la lista de consumidores la da el compilador, no un grep.
- `NuevoRecorrido` se arma con intersección y no con `Omit<Recorrido, ...>` porque `Omit` sobre una
  unión no es distributivo y perdería el discriminante.
- Spreads de edición tipo `{ ...recorrido, vehiculoId }` dejan de compilar sobre la unión: se
  reemplazan por un helper que arma el transporte nuevo explícito.

### D4 — Un módulo puro compartido: `shared/lib/hojas-de-ruta/transporteRecorrido.ts`

Tres funciones puras, testeadas primero:
- `esPropio(r): r is Recorrido & { tipoTransporte: 'propio' }` — type guard para los consumidores
  que solo tienen sentido con vehículo (capacidad, accesorios, `sugerirRecorridoExistente`).
- `etiquetaTransporte(transporte, vehiculos, conductores): string` — "patente · modelo — Apellido,
  Nombre" / "Uber / aplicación" / "Remis · París". Un único `switch` exhaustivo (`never` en default)
  reemplaza el armado de etiqueta repetido en tarjeta, vista global, imprimible y dashboard.
- `validarTransporte(borrador): string | null` — mensaje de error en castellano o `null`; espejo de
  la CHECK de D1 para no esperar el round-trip (agencia vacía, propio sin vehículo/conductor).

Justificación de un archivo nuevo: hay ≥4 consumidores de la etiqueta; duplicar el `switch` en cada
uno es lo que hizo aparecer "Vehículo desconocido" en primer lugar.

### D5 — Mapping y repository

- `parseRecorridoRow`: lee `tipo_transporte` (default `'propio'` si falta, igual que la base) y
  devuelve la variante de la unión; descarta la fila solo si es incoherente (ej. `propio` sin
  vehículo) — mismo criterio de degradación que hoy.
- `toRecorridoRowInput`: siempre envía `tipo_transporte`; `vehiculo_id`/`conductor_id`/
  `agencia_remis` en `null` cuando no corresponden. `ParadaRowInput.id_vehiculo: string | null`.
- `SELECT_HOJA_DE_RUTA_CON_RECORRIDOS` agrega `tipo_transporte, agencia_remis`.
- Traducción de errores: `45305` → "Revisá el tipo de transporte del recorrido."
- Mock repository: no valida (hoy tampoco valida vehículo); solo hace falta que el fixture incluya un
  recorrido `aplicacion` y uno `remis` para que las pantallas en modo mock los muestren.

### D6 — UI

Reutiliza el patrón del checkbox "manual" que ya tiene `NuevoRecorridoForm` y componentes del design
system (`Input`, `Chip`, `AvisoModeloDatos`). Radios nativos `<input type="radio">` con Tailwind.

```
NuevoRecorridoForm / edición en RecorridoCard
  [ ] Viaje tercerizado ──tildado──▶ ( ) Uber / aplicación   ( ) Remis: [_______]
        │                               └─ oculta selects de vehículo/conductor
        └─destildado──▶ selects de vehículo y conductor (igual que hoy)
```

- `NuevoRecorridoForm`: estado local `tercerizado` + `tipo` + `agencia`; el submit arma el
  `NuevoRecorrido` de la variante correcta. Con tercerizado tildado no se calcula ni se muestra la
  sugerencia de recorrido existente (solo tiene sentido para propios) ni el aviso de "ningún vehículo
  compatible". Default del radio al tildar: `aplicacion` (el caso más frecuente según Andrea).
- `RecorridoCard` / `RecorridoVehiculoConductor`: en lectura muestra `etiquetaTransporte`; en
  edición, el mismo control de tercerizado; los selects solo para `propio`.
- `AsignacionPanel` y `VistaGlobalHojaDeRuta`: la validación de capacidad y accesorios corre solo si
  `esPropio(destino)`. `AsignacionPanel.vehiculo` pasa a opcional.
- `VistaGlobalHojaDeRuta`: dos grupos, "Flota propia" y "Tercerizados", con `etiquetaTransporte`.
- `HojaDeRutaImprimible` y `RecorridosDelDiaPanel`: encabezado con `etiquetaTransporte`.
- `HojaDeRutaPage`: amplía el `AvisoModeloDatos` existente con la nueva discrepancia (tipo de
  transporte y agencia no existen en el docx).

## Risks / Trade-offs

- [Frontend desplegado antes que la migración] → el select pide `tipo_transporte` y PostgREST
  devuelve error: la hoja de ruta no carga. **Mitigación**: orden obligatorio en
  `docs/PENDIENTE-ENZO.md` (migración → recién después mergear/deployar el frontend); el frontend no
  se mergea a `main` hasta que Enzo confirme el `db push`.
- [Migración aplicada y frontend viejo] → sin riesgo: el frontend viejo no envía `tipo_transporte`,
  la RPC usa `'propio'`, y el select viejo no pide las columnas nuevas.
- [Schema real distinto del repo] → verificación en vivo antes de escribir el `.sql` (D2).
- [Rollback con tercerizados cargados] → volver a `NOT NULL` fallaría. **Mitigación**: el rollback
  de la cabecera borra o convierte primero esas filas, y se documenta que pierde el dato de
  tercerizado; mientras no haya filas tercerizadas, el rollback es `DROP CONSTRAINT` + `DROP COLUMN`
  + `SET NOT NULL` + re-aplicar las funciones de `20260804110000`.
- [Agencia en texto libre con variantes de tipeo] → aceptado por decisión de la usuaria; ver
  alternativa C para el upgrade.
- [Tercerizado sin validar capacidad/accesorios] → intencional (no hay dato), documentado como
  RN-HR-05.

## Migration Plan

1. (Enzo) Verificar en vivo `pacientes.recorrido` y las dos funciones contra el repo.
2. (Enzo) `supabase db push` con la migración nueva. No hay Edge Function que deployar.
3. (Enzo) Verificar: `SELECT tipo_transporte, count(*) FROM pacientes.recorrido GROUP BY 1` → solo
   `propio`; la hoja de ruta actual sigue cargando y guardando con el frontend viejo.
4. (Delfina) Mergear/deployar el frontend.
5. Prueba de humo: crear un recorrido "Remis · París" y uno "Uber / aplicación", recargar, verlos en
   tarjeta, vista global, imprimible y dashboard.

Rollback: ver Risks. Frontend: revert del merge (solo seguro si no hay filas tercerizadas, o si se
revierte también la base).

## Open Questions

Diferibles sin cambiar specs ni tareas (detalle en `proposal.md`): costo del viaje, nombre de la
aplicación, reporte de deuda por agencia, catálogo de agencias.
