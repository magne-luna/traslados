## Why

`auth-frontend-real` entregó `tienePermiso` / `usePermiso` con la jerarquía `read < write < admin` completa, pero **no los conectó a ninguna pantalla en nivel `write`** (su `design.md` §Open Questions punto 3). Hoy una cuenta con permiso **solo `read`** sobre `conductores` entra a Conductores y Vehículos y ve *Crear* / *Editar* / *Guardar* plenamente interactivos; el intento recién falla después, en el servidor, contra la RLS.

**No es un agujero de seguridad**: la autorización efectiva la impone la RLS vía `modulos.tiene_permiso('conductores', 'write')`, ya desplegada. Es una corrección de **experiencia de uso y consistencia**.

Este es el **cuarto y último de cuatro changes** que cierran el hueco, uno por módulo real del backend. `gateo-obrasocial` ya construyó el mecanismo compartido; **este change solo lo consume**.

> ⚠️ **Alcance corregido el 2026-07-30.** Este change nació cubriendo **tres** rutas —`/conductores`, `/vehiculos` y `/hojas-de-ruta`— bajo la premisa de que las tres resolvían el módulo `conductores`. La verificación obligatoria de la tarea 1.5 demostró que **esa premisa es falsa para `/hojas-de-ruta`**: `moduloDeRuta('/hojas-de-ruta')` devuelve `'pacientes'` (`frontend/src/app/routes.ts`, corrección deliberada y fechada), coherente con la RLS real —`pacientes.recorridos` y `pacientes.historial_recorridos` están gateadas por `modulos.tiene_permiso('pacientes', …)` en `supabase/migrations/20260724100004_schema_pacientes.sql`—. Por decisión de la usuaria, `/hojas-de-ruta` **queda fuera del alcance de este change** y se trata en un change separado, scopeado al módulo `pacientes`. Ver §Fuera de alcance.

## What Changes

Todo el cableado se hace con el mecanismo que ya existe (`usePuedeEscribir()`, envoltorio de solo lectura, prop opt-in en `Button`, aviso con `Alert`). **No se construye ni se modifica infraestructura compartida.**

### Ruta `/conductores`

- `ConductoresList` (190): *Crear conductor* (`:52`), *Crear el primero* (`:74`), *Editar* por fila (`:171`) y su `<button>` nativo, visibles pero bloqueados sin `write`. La fila sigue navegando al detalle.
- `ConductorDetail` (213): *Editar* (`:153`) bloqueado sin `write`.
- `ConductorForm` (210): campos no editables y *Guardar* (`:204`) bloqueado. *Cancelar* (`:201`) sigue operativo.
- `AsignacionSemanalTabla` (165): el envío de la asignación semanal (`:156`) y sus campos, inertes sin `write`. La tabla sigue legible.
- `ConductorDocumentos` (31): **carga y baja** bloqueadas; **consulta y descarga** siguen disponibles con `read`.
- `ConductoresPage` (48): aviso de modo solo lectura.

### Ruta `/vehiculos`

- `VehiculosList` (194): *Crear vehículo* (`:51`), *Crear el primero* (`:73`), *Editar* por fila (`:175`) y su `<button>` nativo, visibles pero bloqueados. La fila sigue navegando al detalle.
- `VehiculoDetail` (228): *Editar* (`:163`) bloqueado sin `write`.
- `VehiculoForm` (178): campos no editables y *Guardar* (`:172`) bloqueado. *Cancelar* (`:169`) sigue operativo.
- `GastosVehiculo` (185): el alta de gasto (`:178`) y sus campos, inertes sin `write`. Los gastos siguen legibles.
- `VehiculoMantenimiento` (131): las acciones de mantenimiento y sus campos, inertes sin `write`. El historial sigue legible.
- `VehiculoDocumentos` (23): mismo criterio que `ConductorDocumentos`.
- `VehiculosPage` (48): aviso de modo solo lectura.

### Lectura preservada

`ConductorDocumentos` y `VehiculoDocumentos` mezclan escritura y lectura: se gatean **carga y baja**, pero **consulta y descarga** siguen disponibles con nivel `read`, para no ser más restrictivos que la RLS.

### Fuera de alcance: `/hojas-de-ruta`

**Descoped el 2026-07-30**, después del hallazgo de la tarea 1.5. `/hojas-de-ruta` **no pertenece al módulo `conductores`**: `moduloDeRuta('/hojas-de-ruta')` resuelve `'pacientes'`, y la RLS real de `pacientes.recorridos` / `pacientes.historial_recorridos` confirma ese mapeo. Gatear esa pantalla bajo el permiso `conductores` habría codificado una premisa falsa.

- Ninguno de sus componentes se toca en este change: `HojaDeRutaPage`, `NuevoRecorridoForm`, `RecorridoCard`, `ParadasList`, `AsignacionPanel`, `VistaGlobalHojaDeRuta`, `PacienteTramoCampos`, `SelectorPaciente`, `RecorridoVehiculoConductor`, ni las vistas de solo lectura `HojaDeRutaImprimible`, `RecorridoMapa`, `RecorridoStat`, `RequisitosPaciente`.
- El gateo de esa ruta —incluida la regla de que **los tres conmutadores de vista NO se gatean**— se trata en un **change separado, scopeado al módulo `pacientes`**.
- `features/hojas-de-ruta/` quedó **intacta**: cero archivos tocados, línea base de tests sin variación.

### No cambia

`tienePermiso`, `usePermiso`, la jerarquía de niveles, el gateo de navegación por `read`, el mecanismo compartido del change 1, ninguna policy de RLS, ninguna Edge Function, ninguna dependencia. Cero backend.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `permisos-modulo-frontend`: agrega **únicamente** el requisito de gateo de las pantallas de Conductores y Vehículos. Los requisitos del mecanismo los aporta `gateo-obrasocial` y **no se repiten acá**; el requisito de Hojas de Ruta lo aporta el change separado del módulo `pacientes`.

⚠️ **Ordenamiento de archivado**: `permisos-modulo-frontend` ya existe en `openspec/specs/` (`auth-frontend-real` fue archivado el 2026-07-29), así que no hay dependencia pendiente hacia atrás. Este delta asume los requisitos del mecanismo que aporta `gateo-obrasocial`, así que **debe archivarse después** de ese change.

## Impact

| Área | Archivos | Naturaleza |
|---|---|---|
| Conductores | `ConductoresList`, `ConductorDetail`, `ConductorForm`, `AsignacionSemanalTabla`, `ConductorDocumentos`, `ConductoresPage` | Cableado |
| Vehículos | `VehiculosList`, `VehiculoDetail`, `VehiculoForm`, `GastosVehiculo`, `VehiculoMantenimiento`, `VehiculoDocumentos`, `VehiculosPage` | Cableado |
| Hojas de Ruta | `features/hojas-de-ruta/` completo | **Sin cambios**: descoped, va al change del módulo `pacientes` |
| Auth compartido / design system | — | **Sin cambios**: se consume el mecanismo del change 1 |
| Tests | `renderConSesion` ya permite declarar el escenario de permisos; su default mantiene verdes los tests existentes **sin editarlos** | Sin cambios esperados |

**Fuera de alcance**: la ruta `/hojas-de-ruta` (módulo `pacientes`, change separado), los otros tres módulos, y cualquier modificación al mecanismo compartido.

**Backend/APIs/dependencias**: ninguno.

### Riesgo y gobernanza

- **Nivel de gobernanza: CRÍTICO** (dominio auth/permisos). **`/opsx:apply` requiere aprobación humana explícita antes de escribir código.**
- Riesgo principal: **falso negativo** — deshabilitar a quien sí puede escribir, sobre todo al rol `admin`, que short-circuita en `tienePermiso` sin consultar la matriz. Mitigado con un ciclo TDD propio.
- Riesgo específico: son **dos rutas con un solo permiso**. Un gateo que funcione en una y no en la otra es un fallo silencioso. Mitigado con un ciclo TDD de coherencia entre las dos.
- Riesgo específico: **bloquear de más la lectura** — la consulta y la descarga de documentos de conductor y de vehículo deben seguir disponibles con `read`, igual que la RLS. Mitigado con un ciclo TDD dedicado.
- Riesgo de diseño (OWASP A04): que se lea este gateo como la frontera de autorización. Mitigado con el comentario explícito en el código y el requisito ya fijado por el change 1.
- **Des-alineación conocida, no resuelta acá**: `GastosVehiculo` está gateado en la RLS real por el módulo `facturacion` (`facturacion.gastos_vehiculos`), no `conductores`. Ya documentado con `AvisoModeloDatos` en `VehiculoDetail.tsx` desde antes de este change; se cableó por continuidad con el resto de `/vehiculos` y queda señalado, no resuelto. Ver tarea 4.1.
- **Verificación manual humana** con una cuenta real de solo `read`, a cargo de la usuaria.

### Plan de rollback

Revertir los commits devuelve las dos pantallas a su comportamiento anterior, sin afectar al mecanismo compartido ni a los otros módulos. Como son dos árboles de componentes independientes, y los commits van separados por ruta, revertir solo una de las dos también es viable. No hay estado persistido, ni migración, ni feature flag.

### Dependencias entre changes

- **Depende de** `gateo-obrasocial` (mecanismo compartido).
- **Depende de** `auth-frontend-real` y `C-02-usuarios-permisos-auditoria` — ✅ ambos archivados (`archive/2026-07-29-auth-frontend-real/`, `archive/2026-07-29-C-02-usuarios-permisos-auditoria/`).
- **Independiente de** `gateo-pacientes` y `gateo-facturacion`. Pueden ir en cualquier orden o en paralelo.
- **Relacionado con** el change separado de `/hojas-de-ruta` bajo el módulo `pacientes`, que recoge el alcance descoped acá. No hay dependencia de orden entre ambos: tocan árboles de componentes disjuntos y módulos de permiso distintos.
- Deriva del análisis paraguas archivado en `openspec/changes/archive/2026-07-29-gateo-escritura-formularios-split/`.

## Decisiones ya cerradas por la usuaria

No re-abrir sin hablar con ella:

**2026-07-29**

1. **Deshabilitar nunca ocultar**: las acciones de escritura siguen visibles pero bloqueadas.
2. **Sí al aviso visible** de modo solo lectura.
3. **4 changes, uno por módulo.**
4. **Agrupación módulo→pantalla**: el módulo `conductores` gatea **Conductores y Vehículos** a la vez. Una cuenta con solo `read` en `conductores` queda en solo lectura en las dos pantallas simultáneamente. ⚠️ **Corregido el 2026-07-30**: esta decisión incluía originalmente Hojas de Ruta, sobre la premisa de que `seed_modulos.sql` la agrupaba bajo `conductores`. La verificación de la tarea 1.5 mostró que la ruta resuelve `'pacientes'` y que la RLS real coincide. La parte de Hojas de Ruta queda **anulada acá** y se trata en el change de `pacientes`.
5. **Todas las acciones de escritura al nivel `write`**. **Ninguna requiere `admin`.**

**2026-07-30**

6. **`/hojas-de-ruta` sale del alcance de este change** y se trata en un change separado, scopeado al módulo `pacientes`. No se corrige `app/routes.ts`: el mapeo actual es deliberado y coincide con la RLS.
