## Why

`auth-frontend-real` entregó `tienePermiso` / `usePermiso` con la jerarquía `read < write < admin` completa, pero **no los conectó a ninguna pantalla en nivel `write`** (su `design.md` §Open Questions punto 3). Hoy una cuenta con permiso **solo `read`** sobre `conductores` entra a Conductores, Vehículos y Hojas de Ruta y ve *Crear* / *Editar* / *Guardar*, y también el armado completo de hojas de ruta, plenamente interactivos; el intento recién falla después, en el servidor, contra la RLS.

**No es un agujero de seguridad**: la autorización efectiva la impone la RLS vía `modulos.tiene_permiso('conductores', 'write')`, ya desplegada. Es una corrección de **experiencia de uso y consistencia**.

Este es el **cuarto y último de cuatro changes** que cierran el hueco, uno por módulo real del backend. `gateo-obrasocial` ya construyó el mecanismo compartido; **este change solo lo consume**. Es el módulo más grande del split: **tres rutas** bajo un solo permiso (~6800 líneas de código), y el que contiene el caso más delicado de todo el split — los conmutadores de vista de Hojas de Ruta, que **no deben gatearse** y que un gateo descuidado atraparía.

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

### Ruta `/hojas-de-ruta`

- `HojaDeRutaPage` (212): *Crear hoja* (`:161`) bloqueado sin `write`. **Los tres conmutadores de vista (`:131` armado, `:135` global, `:139` imprimir) NO se gatean** — no escriben nada.
- `NuevoRecorridoForm` (236): campos no editables y el alta de recorrido (`:212`) bloqueada sin `write`.
- `RecorridoCard` (234): *Sugerir orden* (`:144`), aceptar edición (`:147`) y entrar a editar (`:152`) bloqueados sin `write`.
- `ParadasList` (110): reordenar paradas (`:78`, `:87`) y su `<button>` nativo, bloqueados sin `write`. Las paradas siguen legibles.
- `AsignacionPanel` (138): la asignación (`:129`) y sus campos, inertes sin `write`.
- `VistaGlobalHojaDeRuta` (147): mover filas (`:137`) bloqueado sin `write`. La vista global sigue legible.
- `PacienteTramoCampos` (95), `SelectorPaciente` (30), `RecorridoVehiculoConductor` (113): campos cubiertos por el envoltorio de sus formularios contenedores.
- `HojaDeRutaPage`: aviso de modo solo lectura.

### Lectura preservada

`HojaDeRutaImprimible` (80), `RecorridoMapa` (51), `RecorridoStat` (26) y `RequisitosPaciente` (32) son de solo lectura y **no se tocan**: deben seguir renderizándose completos con nivel `read`.

### No cambia

`tienePermiso`, `usePermiso`, la jerarquía de niveles, el gateo de navegación por `read`, el mecanismo compartido del change 1, ninguna policy de RLS, ninguna Edge Function, ninguna dependencia. Cero backend.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `permisos-modulo-frontend`: agrega **únicamente** el requisito de gateo de las pantallas de Conductores, Vehículos y Hojas de Ruta. Los requisitos del mecanismo los aporta `gateo-obrasocial` y **no se repiten acá**.

⚠️ **Ordenamiento de archivado**: `permisos-modulo-frontend` ya existe en `openspec/specs/` (`auth-frontend-real` fue archivado el 2026-07-29), así que no hay dependencia pendiente hacia atrás. Este delta asume los requisitos del mecanismo que aporta `gateo-obrasocial`, así que **debe archivarse después** de ese change.

## Impact

| Área | Archivos | Naturaleza |
|---|---|---|
| Conductores | `ConductoresList`, `ConductorDetail`, `ConductorForm`, `AsignacionSemanalTabla`, `ConductorDocumentos`, `ConductoresPage` | Cableado |
| Vehículos | `VehiculosList`, `VehiculoDetail`, `VehiculoForm`, `GastosVehiculo`, `VehiculoMantenimiento`, `VehiculoDocumentos`, `VehiculosPage` | Cableado |
| Hojas de Ruta | `HojaDeRutaPage`, `NuevoRecorridoForm`, `RecorridoCard`, `ParadasList`, `AsignacionPanel`, `VistaGlobalHojaDeRuta`, `PacienteTramoCampos`, `SelectorPaciente`, `RecorridoVehiculoConductor` | Cableado |
| Solo lectura | `HojaDeRutaImprimible`, `RecorridoMapa`, `RecorridoStat`, `RequisitosPaciente` | **Sin cambios** |
| Auth compartido / design system | — | **Sin cambios**: se consume el mecanismo del change 1 |
| Tests | `renderConSesion` ya permite declarar el escenario de permisos; su default mantiene verdes los tests existentes **sin editarlos** | Sin cambios esperados |

**Fuera de alcance**: los otros tres módulos, y cualquier modificación al mecanismo compartido.

**Backend/APIs/dependencias**: ninguno.

### Riesgo y gobernanza

- **Nivel de gobernanza: CRÍTICO** (dominio auth/permisos). **`/opsx:apply` requiere aprobación humana explícita antes de escribir código.**
- Riesgo principal: **falso negativo** — deshabilitar a quien sí puede escribir, sobre todo al rol `admin`, que short-circuita en `tienePermiso` sin consultar la matriz. Mitigado con un ciclo TDD propio.
- **Riesgo más específico de todo el split**: gatear por error los **tres conmutadores de vista** de `HojaDeRutaPage` (`:131`, `:135`, `:139`). No escriben nada; bloquearlos dejaría a una cuenta con `read` encerrada en la vista de armado sin poder ver la global ni la imprimible. Es el ejemplo canónico que justificó que la prop de `Button` sea opt-in y nunca automática. Mitigado con un ciclo TDD dedicado.
- Riesgo específico: es el módulo de **tres rutas con un solo permiso**. Un gateo que funcione en dos y no en la tercera es un fallo silencioso. Mitigado con un ciclo TDD de coherencia entre las tres.
- Riesgo específico: es la superficie más grande del split (~6800 líneas, 22 componentes a cablear). Mitigado con el orden de las tareas: las dos rutas más convencionales primero, Hojas de Ruta al final.
- Riesgo específico: **bloquear de más la lectura** — `HojaDeRutaImprimible` debe seguir renderizándose con `read`. Mitigado con un ciclo TDD dedicado.
- Riesgo de diseño (OWASP A04): que se lea este gateo como la frontera de autorización. Mitigado con el comentario explícito en el código y el requisito ya fijado por el change 1.
- **Verificación manual humana** con una cuenta real de solo `read`, a cargo de la usuaria.

### Plan de rollback

Revertir el commit devuelve las tres pantallas a su comportamiento actual, sin afectar al mecanismo compartido ni a los otros módulos. Como son tres árboles de componentes independientes, revertir solo una de las tres rutas también es viable. No hay estado persistido, ni migración, ni feature flag.

### Dependencias entre changes

- **Depende de** `gateo-obrasocial` (mecanismo compartido).
- **Depende de** `auth-frontend-real` y `C-02-usuarios-permisos-auditoria` — ✅ ambos archivados (`archive/2026-07-29-auth-frontend-real/`, `archive/2026-07-29-C-02-usuarios-permisos-auditoria/`).
- **Independiente de** `gateo-pacientes` y `gateo-facturacion`. Pueden ir en cualquier orden o en paralelo, aunque **conviene dejar este para el final**: es el más grande y el que más se beneficia de que el patrón ya esté rodado en los otros tres.
- Deriva del análisis paraguas archivado en `openspec/changes/archive/2026-07-29-gateo-escritura-formularios-split/`.

## Decisiones ya cerradas por la usuaria (2026-07-29)

No re-abrir sin hablar con ella:

1. **Deshabilitar nunca ocultar**: las acciones de escritura siguen visibles pero bloqueadas.
2. **Sí al aviso visible** de modo solo lectura.
3. **4 changes, uno por módulo.**
4. **Agrupación módulo→pantalla confirmada**: el módulo `conductores` gatea **Conductores, Vehículos y Hojas de Ruta** a la vez, tal cual `seed_modulos.sql`. Una cuenta con solo `read` en `conductores` queda en solo lectura en las tres pantallas simultáneamente.
5. **Todas las acciones de escritura al nivel `write`**, incluido *reordenar paradas de hoja de ruta*. **Ninguna requiere `admin`.**
