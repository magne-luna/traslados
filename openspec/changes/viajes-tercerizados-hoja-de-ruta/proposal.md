## Why

Cuando la flota propia no llega, Andrea resuelve el viaje con una **aplicación** (casi siempre Uber;
lo pagan en el momento y hacen un desglose diario) o con una de sus **agencias de remis** (hoy tres,
ej. París y RSM; van a cuenta corriente, pago quincenal o mensual, y necesitan saber a qué agencia le
deben cada viaje). Hoy la hoja de ruta no puede registrarlo: `pacientes.recorrido.vehiculo_id` y
`conductor_id` son `NOT NULL`, así que un viaje tercerizado no se puede cargar sin inventar un vehículo
o un conductor. Pedido de la reunión del 2026-10-07 (`vault/transcripcion-andrea.txt` 1:30:57–1:34:00,
`knowledge-base/10_preguntas_abiertas.md` §"Preguntas nuevas — reunión con Andrea (2026-10-07)" ítem 1).
Decisión de la usuaria (Delfina, 2026-10-14) sobre la UI y el alcance — ver "What Changes".

## What Changes

- Cada **recorrido** de la hoja de ruta gana un tipo de transporte: `propio` (default, igual que hoy),
  `aplicacion` o `remis`. Si es `remis`, lleva el **nombre de la agencia en texto libre** (sin catálogo).
- UI acordada por recorrido (alta y edición):
  ```
  ☑ Viaje tercerizado
     ( ) Uber / aplicación     (•) Remis: [agencia]
  ```
  Destildado por defecto → el recorrido funciona exactamente como hoy (vehículo + conductor
  obligatorios). Tildado → se elige Aplicación o Remis (Remis exige agencia); vehículo y conductor
  **no se muestran ni se validan**.
- Los recorridos tercerizados no pasan por la validación de capacidad ni de accesorios de movilidad
  (RN-VE-01): no hay vehículo propio contra el cual validar.
- Donde hoy se muestra "patente · modelo — conductor" (tarjeta del recorrido, vista global, hoja
  imprimible, panel del día del dashboard) un tercerizado muestra **"Uber / aplicación"** o
  **"Remis · <agencia>"**. En la vista global los tercerizados se agrupan aparte de la flota propia.
- **Base de datos (lo aplica Enzo)**: `pacientes.recorrido` gana `tipo_transporte` (`TEXT NOT NULL
  DEFAULT 'propio'` + CHECK de la unión) y `agencia_remis TEXT`; `vehiculo_id`/`conductor_id` pasan a
  nullable, con un CHECK que mantiene la coherencia "propio ⇒ vehículo + conductor, tercerizado ⇒ sin
  vehículo ni conductor, remis ⇒ agencia no vacía". Se redefinen `crear_hoja_de_ruta_completa` y
  `actualizar_hoja_de_ruta_completa` (copia de la versión vigente, diff mínimo) para leer las dos
  claves nuevas, con `propio` como default si la clave falta (el frontend actual sigue funcionando).
- **Migración de filas existentes**: ninguna acción de datos — el `DEFAULT 'propio'` deja todas las
  filas actuales como `propio`, y todas tienen vehículo + conductor, así que el CHECK valida.
- Nueva discrepancia con el docx (no tiene tipo de transporte ni agencia): se documenta en KB
  §Discrepancias + `CHANGES.md` + `AvisoModeloDatos` en la pantalla de hoja de ruta.
- **BREAKING (contrato TS interno)**: `Recorrido` deja de tener `vehiculoId`/`conductorId` siempre
  presentes; todo consumidor tiene que distinguir propio de tercerizado. No hay API pública externa.
- **Fuera de alcance**: el **costo** del viaje para el desglose diario/cuenta corriente (pendiente de
  Andrea), catálogo administrable de agencias, qué aplicación fue (Uber/Didi), reporte de deuda por
  agencia.

## Capabilities

### New Capabilities
- `recorrido-tercerizado`: registrar un recorrido de la hoja de ruta como tercerizado (aplicación o
  remis con agencia), su validación, su persistencia coherente en la base y cómo se muestra en
  tarjeta, vista global, hoja imprimible y asignación de pasajeros.

### Modified Capabilities
- `hoja-de-ruta-contract`: el tipo `Recorrido` deja de exigir `vehiculoId`/`conductorId` siempre;
  pasa a llevar el tipo de transporte y solo el recorrido `propio` referencia vehículo y conductor.
- `dashboard-recorridos-del-dia`: el detalle por recorrido identifica al tercerizado por su tipo
  (y agencia), no por vehículo/conductor.

## Impact

**Backend (lo aplica Enzo — `supabase db push`, sin Edge Functions involucradas: la hoja de ruta
escribe vía RPC directo):**
- `supabase/migrations/<timestamp>_recorrido_tipo_transporte.sql` (nuevo): `ALTER TABLE
  pacientes.recorrido` + redefinición de las dos funciones. RLS y auditoría de la tabla no cambian
  (las columnas nuevas quedan cubiertas por las policies existentes). Rollback documentado en la
  cabecera (solo seguro mientras no haya filas tercerizadas).
- `docs/PENDIENTE-ENZO.md`: entrada nueva con orden de pasos y cómo probar.

**Frontend (~17 archivos de producción + sus tests):**
- `shared/types/hojaDeRuta.ts`
- `shared/lib/hojas-de-ruta/`: `transporteRecorrido.ts` (nuevo: etiqueta + validación + guard),
  `hojaDeRutaMapping.ts`, `SupabaseHojaDeRutaRepository.ts`, `sugerirRecorridoExistente.ts`,
  `hojaDeRutaMigrations.test.ts`
- `shared/lib/mocks/`: `hojasDeRutaFixture.ts`, `mockHojaDeRutaRepository.ts`
- `features/hojas-de-ruta/`: `NuevoRecorridoForm.tsx`, `RecorridoCard.tsx`,
  `RecorridoVehiculoConductor.tsx`, `AsignacionPanel.tsx`, `VistaGlobalHojaDeRuta.tsx`,
  `HojaDeRutaImprimible.tsx`, `HojaDeRutaPage.tsx`
- `features/dashboard/RecorridosDelDiaPanel.tsx`

**Docs:** `knowledge-base/04_modelo_de_datos.md` (§HojaDeRuta/Recorrido + §Discrepancias),
`05_reglas_de_negocio.md` (nueva RN-HR-05), `10_preguntas_abiertas.md` (ítem 1 → decidido + abiertas
restantes), `CHANGES.md`, `docs/PENDIENTE-ENZO.md`.

**Total**: ~23 archivos (1 migración + ~17 frontend de producción + 5 docs), más tests.

**Dependencias**: construye sobre `integracion-hojas-de-ruta` (schema + RPC de `20260804100000`/
`20260804110000`, ya en producción). Sin dependencia con los changes abiertos. **Orden de deploy
obligatorio**: migración de Enzo **antes** que el frontend (el frontend nuevo lee `tipo_transporte`
en el select; contra la base vieja, PostgREST rechaza la consulta y la hoja de ruta no carga). La
migración sí es compatible hacia atrás con el frontend actual.

**Tamaño estimado**: M — ~1 día de frontend con TDD + ~1-2 h de backend (migración + verificación en
vivo de que el schema real coincide con el repo antes de escribir el `.sql`). Governance
**MEDIUM-HIGH**: cambia constraints de un módulo productivo.

## Preguntas abiertas (Andrea)

1. **Costo del viaje** (fuera de alcance): ¿por recorrido o por pasajero? ¿Se carga en la hoja de ruta
   o en otro módulo de gastos ("eso ya entra en la parte de finanzas", 1:34:00)?
2. **¿Se anota qué aplicación fue?** En la reunión dijo que lo anotan "como Uber" aunque sea otra; por
   ahora `aplicacion` sin nombre. Si hace falta, se agrega un texto libre igual que la agencia.
3. **Reporte de deuda por agencia (cuenta corriente)**: ¿alcanza con verlo en la hoja del día o
   necesita un listado por agencia y período? Depende de (1).
4. **Catálogo de agencias**: hoy texto libre (decisión 2026-10-14). Si aparecen variantes de tipeo
   ("Paris"/"París") que rompan el reporte de (3), se migra a catálogo.
