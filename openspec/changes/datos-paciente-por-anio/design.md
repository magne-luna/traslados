## Context

Estado actual relevado (2026-10-14):

| Dato | Dónde vive hoy | Cardinalidad |
|------|----------------|--------------|
| Nombre/apellido/DNI/CUIL/nacimiento | `pacientes.paciente` | 1 |
| Diagnóstico / condición | `pacientes.clinicos` (UNIQUE por paciente, `diagnostico JSONB`) | 1 |
| Obra social | `pacientes.paciente.obra_social_id` | 1 |
| Nº afiliado | `obra_social.coberturas_paciente` (N, `fecha_desde`/`fecha_hasta`, como el docx) — el repo escribe una fila nueva con `fecha_desde = hoy` en cada cambio y lee "la más reciente" | N (sin uso real del período) |
| CUD | `pacientes.cud` (N filas + `vigente`), el repo borra y reinserta → en la práctica 1 | 1 |
| Prestaciones | `pacientes.prestaciones` (catálogo propio, borrado lógico `activa`) | N, sin año |
| Destinos habituales | `pacientes.recorridos` (día + hora + dir. inicial/final) | N, sin año |
| Direcciones | `pacientes.direcciones` — referenciadas con `ON DELETE RESTRICT` por `recorridos`, `historial_recorridos`, `documentos.direccion_id` | N |

Lo que ya está "congelado" en el presupuesto (`facturacion.presupuesto`): `obra_social_id`,
`presupuesto_linea(prestacion_id, monto)`, origen/destino ida/vuelta como **texto**, km, valor km,
vigencia, días. La factura congela snapshots al emitir (`_shared/emisionSnapshots.ts`).
Consumidores de la "foto actual": `PresupuestoForm` (prestaciones activas, `paciente.obraSocialId`,
`construirDatosTrasladoDesdeRecorridos`), hojas de ruta (`recorridosHabitualesDelDia`),
edge function `facturar` (obra social desde `paciente.obra_social_id` ⚠️ y nº afiliado = cobertura
más reciente).

## Goals / Non-Goals

**Goals:**
- Que Andrea cargue 2027 ya, sin romper 2026 ni lo que está en cobro de 2025.
- Pestañas por año en la ficha ("carpetas").
- Cambio de obra social a mitad de año sin trucos.
- Cero pérdida de datos en la migración (columnas aditivas + backfill).
- Presupuestos/hojas/facturas toman los datos del año/período correcto.

**Non-Goals:**
- Historial/versionado de diagnóstico, CUD, direcciones o personas a cargo (Andrea: "no es
  necesario el historial, es necesario poder editarlo").
- Agrupar el listado de Presupuestos por paciente (Stefano/Andrea acordaron dejarlo por presupuesto).
- Snapshot completo del paciente dentro del presupuesto (ver Decisión abierta DA-1).
- Viajes tercerizados y viajes sueltos (otras preguntas de la misma reunión).

## Decisions

### D1 — Anclar "por año" con una columna `anio` en las tablas hijas que varían (recomendado)

`pacientes.prestaciones` y `pacientes.recorridos` ganan `anio SMALLINT NOT NULL` (+ índice
`(paciente_id, anio)`, CHECK `anio BETWEEN 2020 AND 2100`). Las "carpetas" de la UI son un filtro
por `anio`, no una entidad.

Alternativas consideradas:

| | A. `anio` en hijas (**elegida**) | B. Entidad "legajo anual" `pacientes.paciente_anio` padre de prestaciones/recorridos/diagnóstico | C. `vigencia_desde/hasta` en cada hija |
|---|---|---|---|
| Migración | 2 `ADD COLUMN` + backfill, ids intactos | Tabla nueva + RLS + re-parent de FKs, crear un legajo por paciente | 4 `ADD COLUMN` + backfill |
| Modelo mental de Andrea ("carpetas por año") | Directo (filtro por año) | Directo (la carpeta es una fila) | Indirecto (rangos de fechas) |
| Mid-year (Ene–Jul / Ago–Dic) | Se resuelve en coberturas (D3), no en prestaciones | Igual que A | Nativo, pero en **todas** las tablas |
| Diagnóstico por año | No (queda en `clinicos`) | Sí, natural | Sí, con rangos |
| "Año existe aunque esté vacío" | Derivado (años con datos + actual + siguiente) | Explícito | Derivado |
| Costo UI/tests | Bajo | Medio-alto (CRUD del legajo, estados vacíos) | Alto (validar solapes en cada editor) |

Por qué A: es la que menos toca (los ids de prestaciones no cambian → `presupuesto_linea` y
`presupuesto.prestacion_id` siguen válidos), coincide con lo que Enzo propuso en la reunión ("que
cada prestación tenga asociada la fecha") y con lo que Andrea ve (pestañas). Si DA-2 decide
diagnóstico por año, se migra a B agregando `paciente_anio` sin deshacer A (el `anio` de las hijas
queda como la clave natural del legajo).

### D2 — Direcciones quedan comunes a todos los años

Las direcciones son el catálogo de lugares; lo que cambia por año es **a dónde va** (destinos
habituales, que sí tienen año). Hacer las direcciones por año obligaría a duplicarlas cada año y
rompe las FK `RESTRICT` de `historial_recorridos` y `documentos.direccion_id`. Una dirección que ya
no se usa puede dejarse sin destinos. (Ver DA-4 si Andrea quiere "ocultar" lugares viejos.)

### D3 — Obra social por período = `coberturas_paciente` con fechas reales

- Se reutiliza la tabla existente (estructura del docx: "Cobertura del Paciente" histórica), sin
  tabla nueva → sin RLS nueva (gate `obra_social`, ya existente).
- Constraint de no-solapamiento por paciente: `EXCLUDE USING gist (paciente_id WITH =,
  daterange(fecha_desde, fecha_hasta, '[]') WITH &&)` (requiere `btree_gist`; si Enzo prefiere no
  habilitar la extensión, trigger `BEFORE INSERT/UPDATE` equivalente). `fecha_desde` pasa a
  `NOT NULL` tras el backfill.
- Función SQL `obra_social.cobertura_vigente(paciente_id, fecha) returns coberturas_paciente`
  (STABLE, `SECURITY INVOKER` → respeta RLS) usada por front y edge functions.
- `paciente.obra_social_id` NO se borra: se mantiene como "obra social actual" para listados y
  filtros; se recalcula al guardar coberturas (en el repo/RPC, no trigger, para no esconder
  escrituras). Ver DA-3.
- La UI de coberturas reemplaza "un campo obra social + un campo afiliado" por una lista por año:
  OS, afiliado, desde, hasta. "Cambiar de obra social" = cerrar la vigente (hasta = día anterior) y
  abrir otra.

### D4 — Cómo cada módulo elige el año

```
Presupuesto:  anio = year(vigenciaDesde ?? fechaEmision)
              prestaciones = paciente.prestaciones[anio].activas
              destinos     = recorridos[anio]          -> construirDatosTrasladoDesdeRecorridos
              obraSocial   = cobertura_vigente(paciente, vigenciaDesde)   (se guarda en presupuesto.obra_social_id, como hoy)

Hoja de ruta: anio = year(fecha de la hoja) -> recorridosHabitualesDelDia(recorridos[anio], fecha)

Factura (edge `facturar`):
              obraSocial  = presupuesto.obra_social_id (vía autorizacion -> presupuesto)   ⚠️ hoy: paciente.obra_social_id
              nº afiliado = cobertura_vigente(paciente, periodo_mes de la autorización)  hoy: la más reciente
```

Hallazgo: `facturar` hoy toma la obra social del **paciente**, no del presupuesto. Con cambio de
OS, una factura de un presupuesto 2025 (OS A) saldría a nombre de OS B. Se corrige en este change
porque es exactamente el caso que lo dispara.

### D5 — "Preparar año copiando el anterior" en el frontend, no RPC

Copia = N inserts de prestaciones + N inserts de recorridos con `anio + 1`. Se hace desde el
repository con las APIs ya existentes (upsert de filas). Sin RPC: si falla a mitad, el año destino
queda parcialmente cargado y la acción se vuelve a ofrecer solo si sigue vacío — aceptable para un
paso manual y reversible. `ponytail:` si aparecen copias parciales en la práctica, pasar a RPC
transaccional `pacientes.copiar_anio(paciente_id, desde, hasta)`.

### D6 — Migración de datos existentes

Migración 1 (estructura + backfill, idempotente):
1. `ADD COLUMN anio SMALLINT` (nullable) en `prestaciones` y `recorridos`.
2. `UPDATE ... SET anio = 2026` (año por defecto, DA-5).
3. Prestaciones cuyo nombre matchea `\s(20\d\d)$` → `anio = <ese año>` y `nombre` sin el sufijo
   (solo si se aprueba DA-6; si no, solo el `anio`). El nombre original queda en
   `auditoria` (trigger existente) y el UPDATE inverso se documenta en el bloque Rollback.
4. `SET NOT NULL` + CHECK + índice.

Migración 2 (coberturas):
1. Pacientes con `obra_social_id` y sin ninguna cobertura de esa OS → insertar cobertura
   `(obra_social_id, num_afiliado NULL, fecha_desde = '2026-01-01', fecha_hasta NULL)`.
2. Coberturas con `fecha_desde` NULL → `'2026-01-01'`. Si hay varias filas del mismo paciente
   (creadas por ediciones sucesivas del afiliado), se conserva la más reciente abierta y las
   anteriores se cierran el día anterior a la siguiente → no quedan solapes.
3. `fecha_desde SET NOT NULL` + constraint de no-solapamiento + función `cobertura_vigente`.

Antes de escribir las migraciones se corre un **SELECT de diagnóstico** (cuántas prestaciones con
año en el nombre, cuántos pacientes sin cobertura, cuántas coberturas por paciente) contra la base
real — lo corre Enzo y se revisa con la usuaria.

Ninguna fila se borra; ningún id cambia.

### D7 — Discrepancia con el docx

`anio` en Prestaciones/Recorridos no está en `Traslados-Modelo-Datos.docx`. Se documenta en
`knowledge-base/04_modelo_de_datos.md` §Discrepancias, bullet en `CHANGES.md` y `AvisoModeloDatos`
en la ficha. Se reemplaza el aviso actual "acá no hay historial de coberturas" (deja de ser cierto).

## Decisiones abiertas (para la usuaria / Andrea — NO decididas)

- **DA-1 Snapshot vs. referencia viva en presupuestos viejos.** Recomendación: referencia viva
  alcanza, porque el presupuesto ya congela OS, prestaciones+montos, origen/destino (texto), km y
  vigencia, y las prestaciones/coberturas nunca se borran ni cambian de año. Lo que NO congela:
  nombre de la prestación (si se renombra, el presupuesto viejo muestra el nombre nuevo),
  diagnóstico y nº de afiliado. ¿Alcanza o se quiere snapshot (copiar nombre de prestación y
  afiliado al presupuesto)?
- **DA-2 Diagnóstico/condición: único editable o por año.** Andrea dijo que cambia cada 4–10 años y
  que no necesita historial; Stefano dijo "todo lo demás por año". Recomendación: único editable
  (la auditoría ya guarda los cambios). Si se quiere por año → alternativa B.
- **DA-3 Cambio de OS a mitad de año: ¿alcanza con coberturas con fechas?** Propuesta: sí; los
  presupuestos de cada tramo se crean con vigencias que caen dentro de cada cobertura. ¿Se quiere
  además un aviso si la vigencia de un presupuesto cruza el cambio de cobertura?
- **DA-4 Direcciones comunes vs. por año.** Propuesta: comunes (D2). ¿Andrea necesita ocultar
  lugares que ya no usa (ej. escuela anterior)? Si sí, `activa` en direcciones (change aparte).
- **DA-5 Año por defecto de lo ya cargado.** Propuesta: 2026. ¿Hay pacientes cuyos datos actuales
  son en realidad 2025 (amparos)?
- **DA-6 Renombrado automático "Hidroterapia 2027" → "Hidroterapia" (2027).** ¿Se aplica en la
  migración o se deja el nombre y solo se asigna el año?
- **DA-7 CUD.** Cambia el número en cada renovación. Propuesta: sigue siendo uno, editable (sin
  año). ¿Hace falta conservar el anterior (ej. para presupuestos de 2025)?
- **DA-8 Años visibles.** Propuesta: años con datos + actual + siguiente. ¿Hace falta poder abrir
  un año arbitrario (ej. cargar 2024 atrasado)?
- **DA-9 Presupuesto que cruza años** (vigencia 2026-07 a 2027-06). Propuesta: el año lo define
  `vigenciaDesde`. ¿Existe ese caso o las vigencias son siempre dentro del año calendario?

## Risks / Trade-offs

- [Prestaciones duplicadas por año] → mismo nombre en dos años = dos filas; aceptado (ya es el
  criterio de catálogo por paciente, D7 de `presupuesto-prestaciones`).
- [Constraint de no-solape falla al aplicar sobre datos sucios] → el paso 2 de la migración 2
  normaliza antes; el SELECT de diagnóstico previo lo detecta.
- [`btree_gist` no habilitado] → alternativa trigger, documentada.
- [Copia de año no transaccional] → ver D5.
- [Edge functions desplegadas con versión vieja] → orden obligatorio: `db push` → deploy
  `presupuestos`/`facturar` → front. El front tolera `anio` ausente tratando todo como año actual
  hasta que la columna exista (feature flag no hace falta: el mapping lee `anio ?? añoActual`).
- [Datos de menores] → sin tablas nuevas, RLS existente cubre; la función `cobertura_vigente` es
  `SECURITY INVOKER`.

## Migration Plan

1. (Enzo) Correr SELECT de diagnóstico, compartir resultado → resolver DA-5/DA-6.
2. (Agente) Escribir migraciones 1 y 2 con bloque Rollback; revisión de la usuaria.
3. (Enzo) `supabase db push`.
4. (Enzo) `supabase functions deploy presupuestos facturar`.
5. Front (PRs 2 y 3) se despliega después.

Rollback: `ALTER TABLE pacientes.prestaciones DROP COLUMN anio; ALTER TABLE pacientes.recorridos
DROP COLUMN anio;` + UPDATE inverso de nombres (desde auditoría) + `DROP CONSTRAINT` de solape y
`DROP FUNCTION cobertura_vigente`. Las coberturas insertadas por la migración 2 se identifican por
`fecha_desde = '2026-01-01' AND num_afiliado IS NULL` y creación en la fecha del push.
