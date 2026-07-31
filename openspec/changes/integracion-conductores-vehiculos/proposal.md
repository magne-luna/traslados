## Why

El frontend de **Vehículos** y **Conductores** está completo y archivado en mock
(`vehiculos-ui` 2026-07-24, `vehiculo-mantenimiento-registro` 2026-07-31, `conductores-ui`
2026-07-24), pero las dos pantallas hablan con `mockVehiculoRepository` y `mockConductorRepository`:
fixtures en `localStorage` con latencia simulada. El backend ya existe como migración
(`supabase/migrations/20260724100006_schema_conductores.sql`: 7 tablas + RLS + triggers de
auditoría) y `20260730140000_split_modulos_permisos.sql` ya repartió sus policies entre los módulos
`conductores` y `vehiculos` — pero **ningún dato real llega a la pantalla**.

Este es el change **3 de la serie de integración por módulo** (fila 3 del §Plan de integración de
`CHANGES.md`), después de `integracion-pacientes` (código completo, pendiente de review de Enzo) y
`integracion-obra-social` (propose completo, pendiente de checkpoint). Copia el molde ya validado
por esos dos: mapeo puro separado del I/O, embeds de PostgREST en una sola consulta, escritura
multi-tabla atómica vía RPC **`SECURITY INVOKER`**, traducción de errores a castellano, y
discrepancias documentadas por triplicado en vez de resueltas a dedo.

**No es "construir la pantalla"** — eso ya está hecho. Es el cableado del repositorio real.

Van juntos C-08 y C-09 y no separados por una razón estructural, no de conveniencia: la tabla de
asignación semanal `conductores.conductores_vehiculos` es la bisagra entre los dos dominios, tiene
FK a `conductores.vehiculo`, y `ConductoresRoute.tsx` **ya monta hoy los dos providers** (el selector
de vehículo de la asignación consume `VehiculoRepository` de solo lectura). Integrar Conductores sin
Vehículos dejaría media pantalla contra Postgres y media contra `localStorage`.

## What Changes

- **Dos implementaciones reales nuevas**, cada una cumpliendo su interfaz existente **sin cambiar una
  sola firma** (`list`, `getById`, `create`, `update`):
  - `frontend/src/shared/lib/vehiculos/SupabaseVehiculoRepository.ts`
  - `frontend/src/shared/lib/conductores/SupabaseConductorRepository.ts`
- **Dos módulos de mapeo puro** (`vehiculoMapping.ts`, `conductorMapping.ts`): funciones puras
  fila-de-Postgres → dominio y dominio → filas, con type guards explícitos (nunca `any`, nunca `as`),
  testeables sin tocar red. Incluyen la reconstrucción de la unión discriminada
  `MantenimientoRegistro` (4 miembros) y la conversión semana ISO ↔ par de fechas.
- **El swap en sí cambia dos archivos de producto**: `VehiculosRoute.tsx` y `ConductoresRoute.tsx`
  (composition roots) pasan a inyectar los repositories reales. Ningún hook ni context se toca — es
  exactamente lo que el comentario de esos dos archivos viene anunciando desde `vehiculos-ui` /
  `conductores-ui`.
- **Pero sí se tocan pantallas, y no por el swap**: las resoluciones del checkpoint de governance
  (`tasks.md` 0.1, cerrado el 2026-07-31) cambian la forma del dominio en tres puntos y arrastran UI.
  **D3 → opción B**: `Vehiculo.habilitaciones` pasa a **derivarse** del historial de mantenimiento,
  así que `VehiculoDetail` y `VehiculoMantenimiento` dejan de tratarla como colección propia.
  **D6 → opción B**: `Conductor.restricciones` **se elimina del dominio** (todo va a `observaciones`
  ↔ `notas`, como el docx), así que `ConductorForm`, `ConductorDetail` y `ConductoresList` pierden el
  selector y los chips de restricciones. **Colisión semanal → bloqueo incondicional**: se elimina el
  override `permitirMultiple`, así que `AsignacionSemanalTabla` pierde su toggle y
  `validarAsignacionSemanal` su parámetro. Las tres cosas van en fases propias **sobre el mock**
  (`tasks.md` §2B, §2C y §2D), antes del swap y revertibles por separado.
- **Los mocks NO se borran**: quedan como dobles de test y como implementación de respaldo para
  desarrollo sin backend. Dejan de ser la implementación inyectada.
- **Una migración nueva, aditiva y reversible** (`20260801120000_conductores_vehiculos_campos.sql`)
  que cierra los huecos entre el esquema real y lo que las dos pantallas ya muestran. Hoy faltan
  columnas para datos que la UI **ya edita**:
  - `conductores.vehiculo`: `kilometraje`, `kilometraje_ultimo_service`, `fecha_ultimo_service`
    (RN-VE-03, US-500 — el kilometraje se actualiza a mano y dispara las alertas).
  - `conductores.mantenimiento`: `subtipo`, `detalle`, `descripcion` — la categoría de dos niveles
    que `vehiculo-mantenimiento-registro` ya modeló y validó contra el docx; hoy la base solo tiene
    el nivel 1 (`categoria`).
  - `facturacion.gastos_vehiculos`: `descripcion`.
  - `pacientes.accesorios`: `UNIQUE (tipo)` + seed idempotente de los 5 accesorios de movilidad de
    `AccesorioMovilidad` (hoy el catálogo está vacío: sin él, `accesoriosCompatibles` no se puede
    escribir y RN-VE-01 no tiene contra qué validar).
  - `conductores.conductores_vehiculos`: `ADD CONSTRAINT uq_conductor_semana UNIQUE (conductor_id,
    fecha_init)` — hace **imposible** que un conductor tenga dos vehículos la misma semana, a nivel
    de base y no de aplicación (pendiente #2 de C-09, resuelto por bloqueo incondicional).
  - `conductores.conductores`: **ninguna columna nueva**. El checkpoint D6 se resolvió por el docx
    literal — las restricciones de perfil se escriben en `notas`, que ya existe.
  - Habilitaciones VTV/RTO: **ninguna tabla nueva**. El checkpoint D3 se resolvió por derivarlas de
    `conductores.mantenimiento` (filas `preventivo` + subtipo `vtv`/`rto`), que es lo que dice el
    docx y elimina la duplicación de vencimientos en la causa raíz.
  - **Este change, por lo tanto, no crea ninguna tabla**: solo columnas aditivas sobre tablas que ya
    existen, dos `UNIQUE`, un `CHECK` y un seed.
- **Cuatro funciones `SECURITY INVOKER`** (`crear_/actualizar_vehiculo_completo`,
  `crear_/actualizar_conductor_completo`): guardar un vehículo escribe hasta 4 tablas y guardar un
  conductor hasta 2, y PostgREST **no da transacciones entre requests**. **`SECURITY DEFINER` está
  explícitamente prohibido** — bypassearía el gateo por módulo.
- **Se documentan las discrepancias nuevas** siguiendo la convención del proyecto (nota en
  `knowledge-base/04_modelo_de_datos.md` §Discrepancias + bullet en `CHANGES.md` C-08/C-09 + cartel
  `AvisoModeloDatos` en la pantalla). **Ninguna se resuelve unilateralmente en código.** Las de mayor
  impacto:
  1. **Las dos pantallas cruzan cuatro módulos de permisos, no uno.** `conductores.conductores` está
     gateada por `conductores`; `vehiculo`, `accesorios_vehiculo`, `mantenimiento`,
     `documentacion_vehiculo` **y `conductores_vehiculos`** por `vehiculos`; el catálogo
     `pacientes.accesorios` por `pacientes`; y `facturacion.gastos_vehiculos` por `facturacion`.
     Consecuencia concreta y hoy invisible: una cuenta con `conductores: write` y sin
     `vehiculos: read` ve **todos los conductores con la grilla de asignación vacía** y no puede
     guardar ninguna asignación semanal.
  2. `Conductor.restricciones` era un catálogo cerrado en el frontend y el docx lo tiene como texto
     libre dentro del mismo campo `Notas` que las observaciones (pendiente #1 de C-09 en
     `CHANGES.md`). **Resuelto a favor del docx**: el catálogo se elimina del dominio. Costo asumido
     por la usuaria: `C-10` no va a poder filtrar conductores automáticamente por restricción
     (RN-GL-03 pasa a lectura humana). Se documenta como decisión, no como deuda.
  3. `AsignacionSemanal.semana` es una etiqueta ISO `'2026-W30'`; la base tiene `fecha_init` y
     `fecha_fin_semana` como dos fechas (pendiente #5 de C-09).
  4. `RegistroHabilitacion` (VTV/RTO con `fechaEmision`/`fechaVencimiento`) no tenía tabla, y su
     vencimiento estaba duplicado con `MantenimientoRegistro.proximoVencimientoFecha` (pendiente #2
     del bloque de `vehiculo-mantenimiento-registro`). **Resuelto**: se derivan del historial, la
     duplicación desaparece. Se documenta el cambio de fuente de verdad, no la duplicación.
  5. `conductores.vehiculo.notas` existe en la base y **no tiene campo en el frontend** — hoy nace
     `NULL` para siempre (discrepancia ya registrada en C-08, se resuelve acá).
- **NO se toca el swap de documentos.** `documentacion_vehiculo` y `documentacion_conductores`
  existen, pero la UI las consume vía el `DocumentoRepository` **compartido** con Pacientes y
  Facturas, cuyo swap es la fila 8 del plan de integración. Ver D8.
- **NO se introduce TanStack Query** ni ninguna librería de data-fetching. El contrato de
  `useVehiculos` / `useConductores` (`loading` / `error` / `recargar` / `crear` / `actualizar`) se
  preserva íntegro.
- **Precondición operativa**: el schema `conductores` debe estar en *Exposed schemas* del Data API
  del proyecto Supabase. Sin eso, `supabase.schema('conductores')` falla con `PGRST106`.

## Capabilities

### New Capabilities
- `vehiculo-repository-supabase`: implementación real de `VehiculoRepository` contra el schema
  `conductores` — mapeo bidireccional de `vehiculo`, `accesorios_vehiculo` (× el catálogo
  cross-schema `pacientes.accesorios`), `mantenimiento` y `facturacion.gastos_vehiculos`;
  reconstrucción de la unión discriminada `MantenimientoRegistro`; escritura multi-tabla atómica vía
  RPC `SECURITY INVOKER`; degradación explícita (nunca dato inventado) cuando la cuenta no tiene los
  permisos cruzados de `pacientes` o `facturacion`; traducción de errores de PostgREST a castellano;
  e inyección en el composition root.
- `conductor-repository-supabase`: ídem para `ConductorRepository` contra `conductores.conductores` y
  `conductores.conductores_vehiculos`, con la conversión pura semana ISO ↔ `fecha_init` /
  `fecha_fin_semana` y la degradación explícita cuando falta `vehiculos: read`.

### Modified Capabilities
- `vehiculo-contract` y `conductor-contract`: el requisito "implementación mock con persistencia en
  localStorage" cambia de estatus — el mock sigue existiendo pero deja de ser la implementación
  inyectada, y el punto de composición pasa a ser el único lugar que elige entre ambas. El contrato
  de errores del repository pasa a ser **normativo**, porque ahora hay dos implementaciones que deben
  coincidir. `vehiculo-contract` además suma `Vehiculo.notas` y pasa `Vehiculo.habilitaciones` a
  **campo derivado** (mismo tipo, otro origen: se calcula del historial, no se persiste).
- `conductor-asignacion-semanal`: la asignación pasa a persistirse como dos fechas, no como etiqueta;
  el selector de vehículo pasa a depender de un permiso distinto del de la pantalla; y la colisión
  semanal pasa a **bloquearse siempre, sin excepción** — el override `permitirMultiple` **se
  elimina** (nunca se usó: está apagado por defecto desde `conductores-ui`) y la barrera real pasa a
  ser el constraint `uq_conductor_semana`, no una validación client-side bypassable.
- `vehiculo-mantenimiento-historial`: la categoría de dos niveles pasa a tener columnas reales
  (`categoria` + `subtipo` + `detalle`), y el requisito "el historial no es la fuente de verdad de
  los vencimientos" **se invierte para VTV/RTO** (pasan a derivarse del historial) y **se mantiene
  para el service preventivo**, que sigue calculándose de los campos propios del vehículo.
- `conductor-contract` y `conductor-crud`: `Conductor.restricciones` y el selector tipado de
  restricciones de perfil **se eliminan**; queda `observaciones` como único campo libre del perfil.
- `vehiculo-gastos`: los gastos pasan a vivir en otro schema y **bajo otro módulo de permisos**
  (`facturacion`); se especifica qué se muestra y qué se degrada cuando la cuenta no lo tiene.

## Impact

**Código nuevo**
- `frontend/src/shared/lib/vehiculos/vehiculoMapping.ts` + `.test.ts`
- `frontend/src/shared/lib/vehiculos/SupabaseVehiculoRepository.ts` + `.test.ts`
- `frontend/src/shared/lib/conductores/conductorMapping.ts` + `.test.ts`
- `frontend/src/shared/lib/conductores/SupabaseConductorRepository.ts` + `.test.ts`
- `frontend/src/shared/lib/conductores/semanaIso.ts` + `.test.ts` (conversión ISO ↔ fechas, pura)
- `frontend/src/shared/lib/mantenimiento/derivarHabilitaciones.ts` + `.test.ts` (D3-B: función pura
  que arma `Vehiculo.habilitaciones` desde el historial; la usan el mock y la real)

**Código modificado**
- `frontend/src/features/vehiculos/VehiculosRoute.tsx` y `ConductoresRoute.tsx` (**el corte real**)
- sus `*.test.tsx` (ajuste del doble inyectado)
- `frontend/src/shared/types/vehiculo.ts` (`Vehiculo.notas?`) y `mockVehiculoRepository`
  (`SCHEMA_VERSION` 3 → 4) + fixture + `VehiculoForm.tsx` / `VehiculoDetail.tsx`
- **D3-B**: `VehiculoDetail.tsx` (deja de persistir `habilitaciones`) y `VehiculoMantenimiento.tsx`
  (estado vacío que explica de dónde salen), + `vehiculosFixture.ts` coherente con la derivación
- **D6-B**: `shared/types/conductor.ts` (se elimina `restricciones` y la unión
  `RestriccionConductor`), `ConductorForm.tsx`, `ConductorDetail.tsx`, **`ConductoresList.tsx`**,
  `conductoresFixture.ts` + `mockConductorRepository` (`SCHEMA_VERSION` 2 → 3), y sus tests
- **Colisión semanal**: `shared/lib/conductores/validarAsignacionSemanal.ts` pierde el parámetro
  `permitirMultiple` y pasa a rechazar toda colisión **incondicionalmente**;
  `AsignacionSemanalTabla.tsx` pierde su `useState`, su toggle "Permitir múltiple" y el
  `AvisoPendienteCliente` que anunciaba la pregunta como abierta. **Los tipos de payload no
  cambian**: sin override no hay flag que llevar hasta la RPC
- `frontend/src/features/vehiculos/VehiculoDetail.tsx` y
  `frontend/src/features/conductores/ConductorDetail.tsx` (carteles `AvisoModeloDatos` reescritos)

**Código eliminado**
- `frontend/src/features/conductores/restriccionConductorOptions.ts` (D6-B: sin catálogo no hay
  etiquetas que mapear)

**Documentación**
- `knowledge-base/04_modelo_de_datos.md` §Discrepancias (bloque nuevo "Vehículos y Conductores vs.
  esquema real de C-08/C-09")
- `CHANGES.md` (bullets ⚠️ en `C-08` y `C-09`, fila 3 del §Plan de integración)
- `ROADMAP-FRONTEND.md` §FE-8

**Base de datos**
- `supabase/migrations/20260801120000_conductores_vehiculos_campos.sql` (**nuevo**, expand aditivo) y
  `supabase/migrations/20260801120001_conductores_vehiculos_rpc.sql` (**nuevo**, 4 funciones
  `SECURITY INVOKER`). Ninguna migración existente se edita.
- **Las aplica la usuaria / Enzo**, no el agente: `supabase db push` requiere Docker o credenciales
  del proyecto real (mismo bloqueo que `integracion-pacientes` y `integracion-obra-social`).

**Sin impacto**
- `VehiculoRepository.ts`, `ConductorRepository.ts`, `useVehiculos.ts`, `useConductores.ts` y los dos
  contexts quedan intactos. **`shared/types/conductor.ts` ya no está en esta lista**: D6-B le saca
  `restricciones` (ver Código modificado).
- `mockDocumentoRepository` sigue siendo el de documentos en las dos pantallas (D8).
- Los otros 6 módulos siguen en mock.

**Dependencias**
- Requiere (ya cumplido): `C-01` foundation-setup, `C-02` + `auth-frontend-real`, la migración
  `20260724100006_schema_conductores.sql`, y `permisos-modulos-granulares` (que creó el módulo
  `vehiculos` y movió 5 tablas a él).
- No depende de `integracion-obra-social` ni de `integracion-pacientes`: no comparte ninguna tabla
  con ellos salvo el catálogo `pacientes.accesorios`, que **lee** y —por primera vez— **siembra**.
- Habilita: `C-10` hojas-de-ruta (necesita `vehiculo.id` y `conductor.id` reales, la exclusión de
  vehículos fuera de servicio de RN-VE-02 y la compatibilidad de accesorios de RN-VE-01) y la fila 4
  del plan de integración (Facturación, que comparte `facturacion.gastos_vehiculos`).
- **Coordinación**: `vehiculo-mantenimiento-registro` ya está archivado (2026-07-31), así que el
  bloqueo de "no tocar `features/vehiculos/` desde otro agente" que avisaba `CHANGES.md` ya no rige.
  Reconfirmarlo con la usuaria antes de empezar.

**Riesgo y rollback**
- Riesgo principal: **el gateo cruzado de cuatro módulos** (punto 1 de discrepancias). Una cuenta que
  hoy funciona sobre mock puede quedar con pantallas a medias contra la base real, sin ningún error
  visible — porque RLS **filtra filas, no devuelve error**. Mitigación: degradación explícita y
  señalizada en la UI (nunca dato inventado, nunca error genérico), y verificación manual con
  cuentas reales de las 4 combinaciones de permisos como tarea bloqueante.
- Riesgo de datos: el catálogo `pacientes.accesorios` se siembra desde este change y lo comparte
  Pacientes (`accesorios_pacientes`). Un valor mal escrito queda en un catálogo compartido.
  Mitigación: el seed es exactamente la unión cerrada `AccesorioMovilidad`, con `ON CONFLICT DO
  NOTHING` sobre un `UNIQUE (tipo)` nuevo — no hay texto libre en juego.
- Riesgo de seguridad: si alguna de las 4 funciones se convirtiera a `SECURITY DEFINER`, el gateo por
  módulo quedaría bypasseado. Mitigación en cuatro capas: la decisión escrita (D9), el bloque ⚠️ en
  la cabecera de la migración, el `COMMENT ON FUNCTION` visible en la base, y un test automatizado
  que lee el `.sql` con `node:fs`.
- Riesgo operativo: si las migraciones no se aplican, la pantalla responde `PGRST204` (columna
  inexistente) y `PGRST202` (función inexistente). Mitigación: aplicarlas es tarea **bloqueante** del
  cableado, y los dos códigos tienen mensaje propio en castellano.
- Riesgo heredado: el desfasaje del historial de migraciones que registró `integracion-pacientes`
  (§1B.3) — un `supabase db push` puede fallar con "ya existe". Mitigación: verificar el historial
  **antes** de escribir migraciones nuevas.
- **Rollback**: revertir `VehiculosRoute.tsx` y `ConductoresRoute.tsx` a los mocks (un import y una
  prop cada uno). Los archivos nuevos quedan inertes. Las migraciones no hace falta revertirlas
  (columnas nuevas con `DEFAULT`, funciones sin llamador); si se quiere limpiar, `DROP FUNCTION` × 4
  + `ALTER TABLE … DROP COLUMN`. **Ningún dato existente se transforma ni se borra en ningún paso.**
