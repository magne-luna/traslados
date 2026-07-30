## Why

`auth-frontend-real` entregó `tienePermiso` / `usePermiso` con la jerarquía `read < write < admin` completa, pero **no los conectó a ninguna pantalla en nivel `write`** (su `design.md` §Open Questions punto 3). Hoy una cuenta con permiso **solo `read`** sobre `facturacion` entra a Presupuestos y a Facturación y ve *Crear* / *Editar* / *Guardar*, y también *Emitir factura* y *Registrar cobro*, plenamente interactivos; el intento recién falla después, en el servidor, contra la RLS.

**No es un agujero de seguridad**: la autorización efectiva la impone la RLS vía `modulos.tiene_permiso('facturacion', 'write')`, ya desplegada. Es una corrección de **experiencia de uso y consistencia** — aunque acá el callejón sin salida es más caro que en otros módulos, porque las acciones son operaciones de dinero (emitir, cobrar, corregir estado) y dejar que la cuenta las intente para que fallen después es especialmente confuso.

Este es el **tercero de cuatro changes** que cierran el hueco, uno por módulo real del backend. `gateo-obrasocial` ya construyó el mecanismo compartido; **este change solo lo consume**. Es el primer módulo que cubre **dos rutas** con un solo permiso, y el que concentra las **acciones de escritura que no son un CRUD limpio**.

## What Changes

Todo el cableado se hace con el mecanismo que ya existe (`usePuedeEscribir()`, envoltorio de solo lectura, prop opt-in en `Button`, aviso con `Alert`). **No se construye ni se modifica infraestructura compartida.**

### Ruta `/presupuestos`

- `PresupuestosList` (159): *Crear presupuesto* (`:54`), *Crear el primero* (`:76`), *Editar* por fila (`:140`) y su `<button>` nativo, visibles pero bloqueados sin `write`. La fila sigue navegando al detalle.
- `PresupuestoResumen` (65): *Editar* (`:59`) bloqueado sin `write`.
- `PresupuestoForm` (164): campos no editables y *Guardar* (`:158`) bloqueado. *Cancelar* (`:155`) sigue operativo.
- `PresupuestoDetail` (270): entrada a la edición de autorización (`:233`) bloqueada sin `write`.
- `AutorizacionForm` (232): campos no editables y *Guardar* (`:226`) bloqueado. *Cancelar* (`:223`) sigue operativo.
- `PresupuestosPage` (81): aviso de modo solo lectura.

### Ruta `/facturacion`

- `FacturasList` (191): *Nueva factura* (`:72`), *Crear la primera* (`:102`), *Editar* por fila (`:172`) y su `<button>` nativo, visibles pero bloqueados. La fila sigue navegando al detalle.
- `FacturaDetail` (223): *Editar* (`:172`) bloqueado sin `write`.
- `FacturaForm` (201) + `FacturaFormDatosBasicos` (62) + `FacturaFormEconomicos` (51): campos no editables y *Guardar* (`:197`) bloqueado con una sola inserción del envoltorio. *Cancelar* (`:196`) sigue operativo.
- `FacturaAccionesEmision` (52): *Emitir factura* (`:38`) y *Confirmar emisión* (`:46`) bloqueados sin `write`.
- `CobrosPanel` (178): *Registrar cobro* (`:170`), su `<button>` nativo y sus campos, inertes sin `write`.
- `FacturaCobrosSection` (65): *Aplicar* corrección de estado (`:59`) bloqueado sin `write`.
- `AsistenciasEditor` (125): edición de asistencias (`:119`), su `<button>` nativo y sus campos, inertes sin `write`.
- `DiasFacturablesSelector` (85): selección de días facturables inerte sin `write`.
- `FacturaDocumentos` (32): **carga y baja** de documentos bloqueadas; **consulta y descarga** siguen disponibles con `read`.
- `FacturacionPage` (88): aviso de modo solo lectura.

### Lectura preservada

`FacturaResumen` (165), `FacturaImprimible` (85), `AlertaCupo` (30) y `FacturaAvisoDiscrepancias` (20) son de solo lectura y **no se tocan**: deben seguir renderizándose completos con nivel `read`. La vista imprimible en particular es el caso donde bloquear de más sería más visible.

### No cambia

`tienePermiso`, `usePermiso`, la jerarquía de niveles, el gateo de navegación por `read`, el mecanismo compartido del change 1, ninguna policy de RLS, ninguna Edge Function, ninguna dependencia. Cero backend.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `permisos-modulo-frontend`: agrega **únicamente** el requisito de gateo de las pantallas de Presupuestos y Facturación. Los requisitos del mecanismo los aporta `gateo-obrasocial` y **no se repiten acá**.

⚠️ **Ordenamiento de archivado**: `permisos-modulo-frontend` ya existe en `openspec/specs/` (`auth-frontend-real` fue archivado el 2026-07-29), así que no hay dependencia pendiente hacia atrás. Este delta asume los requisitos del mecanismo que aporta `gateo-obrasocial`, así que **debe archivarse después** de ese change.

## Impact

| Área | Archivos | Naturaleza |
|---|---|---|
| Presupuestos | `PresupuestosList`, `PresupuestoResumen`, `PresupuestoForm`, `PresupuestoDetail`, `AutorizacionForm`, `PresupuestosPage` | Cableado |
| Facturación | `FacturasList`, `FacturaDetail`, `FacturaForm`, `FacturaFormDatosBasicos`, `FacturaFormEconomicos`, `FacturaAccionesEmision`, `CobrosPanel`, `FacturaCobrosSection`, `AsistenciasEditor`, `DiasFacturablesSelector`, `FacturaDocumentos`, `FacturacionPage` | Cableado |
| Solo lectura | `FacturaResumen`, `FacturaImprimible`, `AlertaCupo`, `FacturaAvisoDiscrepancias` | **Sin cambios** |
| Auth compartido / design system | — | **Sin cambios**: se consume el mecanismo del change 1 |
| Tests | `renderConSesion` ya permite declarar el escenario de permisos; su default mantiene verdes los tests existentes **sin editarlos** | Sin cambios esperados |

**Fuera de alcance**: los otros tres módulos, y cualquier modificación al mecanismo compartido.

**Backend/APIs/dependencias**: ninguno.

### Riesgo y gobernanza

- **Nivel de gobernanza: CRÍTICO** (dominio auth/permisos). **`/opsx:apply` requiere aprobación humana explícita antes de escribir código.**
- Riesgo principal: **falso negativo** — deshabilitar a quien sí puede escribir, sobre todo al rol `admin`, que short-circuita en `tienePermiso` sin consultar la matriz. Mitigado con un ciclo TDD propio.
- Riesgo específico de este módulo: las **acciones no-CRUD** (emitir, cobrar, corregir estado, asistencias) están dispersas en 5 componentes chicos y son fáciles de pasar por alto. La decisión 5 de la usuaria las fija todas al nivel `write`, ninguna requiere `admin`. Mitigado con un ciclo TDD por acción.
- Riesgo específico: **bloquear de más la lectura**. `FacturaImprimible` y `FacturaResumen` deben seguir renderizándose completos con `read`; bloquear la vista imprimible sería una regresión muy visible. Mitigado con un ciclo TDD dedicado a la lectura preservada.
- Riesgo específico: es el primer módulo de **dos rutas con un solo permiso**. Un gateo que funcione en `/facturacion` pero no en `/presupuestos` (o al revés) es un fallo silencioso. Mitigado con un ciclo TDD de coherencia entre las dos rutas.
- Riesgo de diseño (OWASP A04): que se lea este gateo como la frontera de autorización. Mitigado con el comentario explícito en el código y el requisito ya fijado por el change 1.
- **Verificación manual humana** con una cuenta real de solo `read`, a cargo de la usuaria.

### Plan de rollback

Revertir el commit devuelve Presupuestos y Facturación a su comportamiento actual, sin afectar al mecanismo compartido ni a los otros módulos. Como son dos rutas independientes en el código, revertir solo una de las dos también es viable. No hay estado persistido, ni migración, ni feature flag.

### Dependencias entre changes

- **Depende de** `gateo-obrasocial` (mecanismo compartido).
- **Depende de** `auth-frontend-real` y `C-02-usuarios-permisos-auditoria` — ✅ ambos archivados (`archive/2026-07-29-auth-frontend-real/`, `archive/2026-07-29-C-02-usuarios-permisos-auditoria/`).
- **Independiente de** `gateo-pacientes` y `gateo-conductores`. Pueden ir en cualquier orden o en paralelo.
- Deriva del análisis paraguas archivado en `openspec/changes/archive/2026-07-29-gateo-escritura-formularios-split/`.

## Decisiones ya cerradas por la usuaria (2026-07-29)

No re-abrir sin hablar con ella:

1. **Deshabilitar nunca ocultar**: las acciones de escritura siguen visibles pero bloqueadas.
2. **Sí al aviso visible** de modo solo lectura.
3. **4 changes, uno por módulo.**
4. **Agrupación módulo→pantalla confirmada**: el módulo `facturacion` gatea **Presupuestos y Facturación** a la vez, tal cual `seed_modulos.sql`. Una cuenta con solo `read` en `facturacion` queda en solo lectura en las dos pantallas.
5. **Todas las acciones de escritura al nivel `write`**, incluidas *emitir factura*, *registrar cobro* y *corregir estado de asistencia*. **Ninguna requiere `admin`.** Se mantiene la jerarquía simple; subir alguna a `admin` más adelante es un cambio de una línea en el call site, porque `tienePermiso` ya acepta cualquier nivel mínimo sin modificarse.
