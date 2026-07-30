## Why

`auth-frontend-real` entregó `tienePermiso` / `usePermiso` con la jerarquía `read < write < admin` completa, pero **no los conectó a ninguna pantalla en nivel `write`** (su `design.md` §Open Questions punto 3). El split de cuatro changes (`gateo-obrasocial`, `gateo-pacientes`, `gateo-facturacion`, `gateo-conductores`) cerró ese hueco módulo por módulo. Hoy una cuenta con permiso **solo `read`** sobre `pacientes` entra a `/hojas-de-ruta` y puede crear la hoja del día, dar de alta recorridos, reordenar paradas, cambiar vehículo y conductor y mover pasajeros entre recorridos con toda la interfaz plenamente interactiva; el intento recién falla después, en el servidor, contra la RLS.

**No es un agujero de seguridad**: la autorización efectiva la impone la RLS vía `modulos.tiene_permiso('pacientes', 'write')` sobre `pacientes.recorridos` y `pacientes.historial_recorridos`, ya desplegada. Es una corrección de **experiencia de uso y consistencia**.

### Por qué es un change propio y no parte de `gateo-conductores`

`/hojas-de-ruta` estaba en el alcance de `gateo-conductores` bajo la premisa de que la ruta pertenecía al módulo `conductores`. **Esa premisa es falsa.** La tarea 1.5 de ese change (verificación obligatoria del mapeo ruta→módulo antes de cablear) encontró que:

- `moduloDeRuta('/hojas-de-ruta')` en `frontend/src/app/routes.ts` devuelve **`'pacientes'`**, no `'conductores'`. Es una corrección deliberada y ya documentada en el propio archivo, con comentario fechado (`app/routes.ts:60-63`).
- La corrección está fundada en la RLS real: `pacientes.recorridos` y `pacientes.historial_recorridos` se gatean con `modulos.tiene_permiso('pacientes', …)` (`supabase/migrations/20260724100004_schema_pacientes.sql:144-148`), no con `'conductores'`.

`gateo-conductores` implementó `/conductores` y `/vehiculos` y **se detuvo** ante `/hojas-de-ruta` en vez de cablear contra el módulo equivocado. Se descopa esa ruta de aquel change y se atiende acá, con el módulo correcto. Este change **no es el quinto de un split de cuatro**: es el rescate del alcance mal atribuido de uno de esos cuatro.

Consecuencia práctica de la corrección, que este change asume como comportamiento deseado: **`/hojas-de-ruta` comparte permiso con `/pacientes`, no con `/conductores` ni `/vehiculos`.** Una cuenta con `write` sobre `conductores` y solo `read` sobre `pacientes` queda en solo lectura acá, aunque pueda editar conductores y vehículos. Es exactamente lo que hace el servidor.

## What Changes

Todo el cableado se hace con el mecanismo compartido que ya existe y ya está rodado en cinco pantallas (`usePuedeEscribir()`, `CamposSoloLectura`, la prop opt-in `requiereEscritura` de `Button`, `AvisoSoloLectura`). **No se construye ni se modifica infraestructura compartida.**

### Acciones que SÍ se gatean (persisten en `pacientes.recorridos`)

- `HojaDeRutaPage` (212): *Crear hoja de ruta para este día* (`:161`) → `crear()`.
- `NuevoRecorridoForm` (236): *Crear recorrido* (`:212`) → alta del recorrido, y **todos** los campos de sus bloques (`SelectorPaciente`, `PacienteTramoCampos`, selects de vehículo `:167` y conductor `:186`, checkbox *manual* `:202`, notas `:222`).
- `RecorridoCard` (234): *Sugerir orden* (`:144`) → `onUpdateRecorrido`; *Editar* (`:152`) → entrada al modo de edición, que es donde vive todo el resto de la escritura.
- `RecorridoCard` — **caminos de escritura que no pasan por un botón**: la textarea de notas (`:201-209`) persiste en `onBlur` vía `handleGuardarNotas`, y los selects de `RecorridoVehiculoConductor` (`:78`, `:97`) persisten **en el `onChange`**, sin confirmación. Los cubre el envoltorio de campos, no la prop de `Button`.
- `ParadasList` (110): *Subir* (`:78`), *Bajar* (`:87`) y el `<button>` nativo *Quitar* (`:96`) → `onReordenar` / `onQuitar`.
- `AsignacionPanel` (138): *Agregar pasajero* (`:129`) → `onAgregar`, y sus campos (`SelectorPaciente`, `PacienteTramoCampos`).
- `VistaGlobalHojaDeRuta` (147): *Mover* (`:137`) → `onReasignar`, y el `<select>` de recorrido destino (`:122`).

### Controles que NO se gatean (no persisten nada) — el corazón del change

- **Los tres conmutadores de vista** de `HojaDeRutaPage`: *Armado* (`:131`), *Vista global* (`:135`), *Imprimir* (`:139`). Solo cambian estado local (`setVista`). Gatearlos encerraría a una cuenta con `read` en la vista de armado, sin poder ver la global ni la imprimible que su permiso **sí** la autoriza a ver.
- **El selector de fecha** de `HojaDeRutaPage` (`:111`). Solo cambia qué día se consulta (`setFecha`). Gatearlo dejaría a una cuenta de solo lectura encerrada en la hoja de hoy, sin poder consultar ningún otro día. Es el mismo error que los conmutadores, en un control que ni siquiera es un `Button` y que por eso es más fácil barrer con un envoltorio puesto de más.
- *Listo* de `RecorridoCard` (`:147`): sale del modo de edición, no persiste nada. Mismo criterio que *Cancelar* en el resto del split.

### Lectura preservada

`HojaDeRutaImprimible` (80), `RecorridoMapa` (51), `RecorridoStat` (26) y `RequisitosPaciente` (32) son de solo lectura y **no se tocan**: deben seguir renderizándose completos con nivel `read`. Los dos carteles `AvisoModeloDatos` de la pantalla tampoco cambian.

### Aviso de modo solo lectura

`AvisoSoloLectura` en `HojaDeRutaPage`, visible en **las tres vistas** (armado, global e imprimir), replicando el patrón de `ObraSocialesPage` / `PacientesPage` / `ConductoresPage` / `VehiculosPage`.

### No cambia

`tienePermiso`, `usePermiso`, la jerarquía de niveles, `app/routes.ts`, el gateo de navegación por `read`, el mecanismo compartido, ninguna policy de RLS, ninguna Edge Function, ninguna dependencia. Cero backend. Los repositorios de pacientes, vehículos y conductores que consume esta pantalla se usan **solo de lectura** (pueblan selectores): esta pantalla no escribe en esos módulos, y por eso su gateo se resuelve contra `pacientes` y nada más.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `permisos-modulo-frontend`: agrega **únicamente** el requisito de gateo de la pantalla de Hojas de Ruta bajo el módulo `pacientes`. Los requisitos del mecanismo los aporta `gateo-obrasocial` y **no se repiten acá**.

⚠️ **Ordenamiento de archivado**: `permisos-modulo-frontend` ya existe en `openspec/specs/` (`auth-frontend-real` archivado el 2026-07-29). Este delta asume los requisitos del mecanismo que aporta `gateo-obrasocial` (ya aplicado y archivado con `gateo-pacientes`), así que se archiva después de esos. Es **independiente** del archivado de `gateo-conductores` y de `gateo-facturacion`, siempre que el descope de `/hojas-de-ruta` en `gateo-conductores` esté hecho: los dos deltas no deben reclamar la misma pantalla.

## Impact

| Área | Archivos | Naturaleza |
|---|---|---|
| Hojas de Ruta — página | `HojaDeRutaPage` | Cableado (alta de hoja + aviso). Conmutadores y selector de fecha **intactos** |
| Hojas de Ruta — armado | `NuevoRecorridoForm`, `RecorridoCard`, `ParadasList`, `AsignacionPanel` | Cableado |
| Hojas de Ruta — vista global | `VistaGlobalHojaDeRuta` | Cableado |
| Campos anidados | `PacienteTramoCampos`, `SelectorPaciente`, `RecorridoVehiculoConductor` | **Sin cambios**: los cubre el envoltorio del formulario contenedor |
| Solo lectura | `HojaDeRutaImprimible`, `RecorridoMapa`, `RecorridoStat`, `RequisitosPaciente` | **Sin cambios** |
| Auth compartido / design system | `usePuedeEscribir.ts`, `PuedeEscribirContext.tsx`, `design-system/components.tsx` | **Sin cambios**: solo se consumen |
| Ruteo / permisos | `app/routes.ts`, `permisos.ts`, `usePermiso.ts`, `RequireAuth.tsx` | **Sin cambios**: el mapeo ya es correcto |
| Backend | `supabase/` | **Sin cambios** |
| Tests | `renderConSesion` ya permite declarar el escenario de permisos; su default mantiene verdes los tests existentes **sin editarlos** | Sin cambios esperados |

**Fuera de alcance**: los otros cuatro módulos y sus pantallas; cualquier modificación al mecanismo compartido; cualquier modificación a `gateo-conductores` o a `gateo-pacientes`; el rediseño del armado de hojas de ruta (se gatea lo que ya existe, tal como está); la discrepancia ya documentada de `GastosVehiculo` (RLS real `facturacion`), que no toca esta pantalla.

**Backend/APIs/dependencias**: ninguno.

### Riesgo y gobernanza

- **Nivel de gobernanza: CRÍTICO** (dominio auth/permisos). **`/opsx:apply` requiere aprobación humana explícita antes de escribir una sola línea.**
- **Riesgo principal y razón de ser de este change: gatear por error los tres conmutadores de vista** (`:131`, `:135`, `:139`) o **el selector de fecha** (`:111`). Bloquear cualquiera de los cuatro sería una regresión de usabilidad causada por el propio arreglo: le quitaría a una cuenta con `read` acceso a datos que su permiso sí la autoriza a ver. Mitigado con ciclos TDD dedicados en las dos direcciones.
- Riesgo: **falso negativo** — deshabilitar a quien sí puede escribir, sobre todo al rol `admin`, que short-circuita en `tienePermiso` sin consultar la matriz. Mitigado con un ciclo TDD propio.
- Riesgo: **caminos de escritura que no pasan por un `Button`** — la textarea de notas que persiste en `onBlur` y los dos selects de `RecorridoVehiculoConductor` que persisten en `onChange`. La prop de `Button` no los alcanza; solo el envoltorio de campos. Mitigado con ciclos TDD que afirman que el repositorio mock **no recibe ninguna llamada**.
- Riesgo: **bloquear de más la lectura** — `HojaDeRutaImprimible` debe seguir renderizándose con `read`. Poder ver una hoja de ruta pero no imprimirla es un bug evidente. Mitigado con un ciclo TDD dedicado.
- Riesgo: **cablear contra el módulo equivocado** (repetir el error de origen). Mitigado con una tarea de verificación bloqueante de `moduloDeRuta('/hojas-de-ruta') === 'pacientes'` antes de escribir cualquier test, y con un grep de control que prohíbe que cualquier componente de la feature mencione un literal de módulo.
- Riesgo de diseño (OWASP A04 *Insecure Design*): que se lea este gateo como la frontera de autorización. Mitigado con el comentario explícito en el código nuevo y el requisito ya fijado por `gateo-obrasocial`.
- **Verificación manual humana** con una cuenta real de solo `read` sobre `pacientes`, a cargo de la usuaria. No es automatizable con mocks.

### Plan de rollback

Revertir el commit devuelve la pantalla a su comportamiento actual, sin afectar al mecanismo compartido ni a ningún otro módulo. `/hojas-de-ruta` es un árbol de componentes independiente. No hay estado persistido, ni migración, ni feature flag, ni SQL.

### Dependencias entre changes

- **Depende de** `gateo-obrasocial` (mecanismo compartido) — ✅ aplicado.
- **Depende de** `auth-frontend-real` y `C-02-usuarios-permisos-auditoria` — ✅ ambos archivados.
- **Depende de** el descope de `/hojas-de-ruta` en `gateo-conductores` (en curso en paralelo): dos deltas no pueden reclamar la misma pantalla.
- **Coherente con** `gateo-pacientes` — ✅ archivado (`archive/2026-07-30-gateo-pacientes/`): comparte módulo con este change. Las dos pantallas del módulo `pacientes` (`/pacientes` y `/hojas-de-ruta`) deben quedar en el mismo modo con la misma sesión.
- **Independiente de** `gateo-facturacion`.

## Decisiones ya cerradas por la usuaria

Las del split (2026-07-29), que este change hereda sin re-abrir:

1. **Deshabilitar nunca ocultar**: las acciones de escritura siguen visibles pero bloqueadas.
2. **Sí al aviso visible** de modo solo lectura.
3. **Todas las acciones de escritura al nivel `write`**, incluido *reordenar paradas de hoja de ruta*. **Ninguna requiere `admin`.**

Y la de este change (2026-07-30):

4. **`/hojas-de-ruta` se gatea con el módulo `pacientes`** y se atiende en un change propio, no dentro de `gateo-conductores` ni de `gateo-pacientes`. La decisión 4 original del split ("el módulo `conductores` gatea las tres rutas") queda **corregida** por el hallazgo de la tarea 1.5 y por la RLS real.
