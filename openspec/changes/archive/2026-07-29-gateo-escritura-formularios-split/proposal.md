## Why

`auth-frontend-real` entregó la maquinaria de permisos por módulo completa —`tienePermiso(rol, permisos, modulo, nivelMinimo)` con jerarquía `read < write < admin` y el hook público `usePermiso(modulo, nivelMinimo)`— pero **deliberadamente no la conectó a ninguna pantalla en nivel `write`** (ver `auth-frontend-real/design.md` §Open Questions punto 3, resuelto el 2026-07-29: *"Gateo de escritura por nivel: **solo el hook** `usePermiso()` en este change"*). Hoy `nivelMinimo: 'write'` no se invoca en ningún lugar del código: los dos únicos consumidores (`SidebarNav.tsx:45-47` y `RequireAuth.tsx:40`) piden `'read'`.

Consecuencia visible: una cuenta con permiso **solo `read`** sobre `pacientes` / `obra_social` / `facturacion` / `conductores` entra al módulo (correcto, tiene `read`) y ve los botones *Crear* / *Editar* y los formularios de alta y edición **plenamente interactivos**. Puede escribir en todos los campos y apretar *Guardar*; el intento recién falla después, en el servidor, contra la RLS. Es un callejón sin salida exactamente del tipo que el resto del gateo de permisos existe para evitar.

**Esto no es un agujero de seguridad.** La autorización efectiva la impone la RLS del servidor vía `modulos.tiene_permiso(mod, 'write')`, ya desplegada y funcionando en las migraciones `20260724100003..100006`. Un cliente parcheado no escribe ni una fila más de las que la RLS permite. Este change es una corrección de **experiencia de uso y consistencia**: cerrar el gateo de escritura del cliente para que la UI no ofrezca acciones que el servidor va a rechazar.

## What Changes

- **Contexto de permiso de escritura por ruta.** Un único punto de derivación (a partir del módulo de la ruta activa, que `moduloDeRuta()` en `app/routes.ts` ya resuelve, más `usePermiso(modulo, 'write')`) expone a todo el árbol de la pantalla si la cuenta activa puede escribir en ese módulo. Los subcomponentes de tercer y cuarto nivel (`DireccionesEditor`, `ChecklistEditor`, `AsistenciasEditor`, `ParadasList`, …) no reciben el módulo por prop ni lo vuelven a resolver: lo consumen del contexto.
- **Hook de consumo sin argumentos** para ese contexto, de modo que ningún componente de feature tenga que saber a qué módulo del backend pertenece la pantalla en la que vive.
- **Primitivas en el design system** para expresar "esta acción/este bloque requiere escritura", en lugar de repetir el condicional en ~40 componentes:
  - un envoltorio de solo-lectura para bloques de formulario completos (deshabilita de una vez todos los controles que contiene, sin tocar campo por campo);
  - un modo explícito y opt-in en `Button` para las acciones de escritura — *no* automático: `Cancelar`, `Volver al listado`, los conmutadores de vista de Hojas de Ruta y `Reintentar` son botones que una cuenta de solo lectura **debe** poder usar.
- **Indicador visible de modo solo lectura** en las pantallas de módulo, reutilizando `Alert` del design system, para que el estado deshabilitado tenga una explicación en pantalla en vez de parecer un bug (ver Open Question 2 — forma y ubicación a confirmar).
- **Cableado por módulo** de los ~40 componentes con acciones de escritura, agrupados por los 4 módulos reales del backend: `pacientes`, `obra_social`, `conductores` (Conductores + Vehículos + Hojas de Ruta) y `facturacion` (Presupuestos + Facturación).
- **Documentación explícita en el código** de que este gateo es UX y no frontera de seguridad, siguiendo el mismo comentario que ya llevan `permisos.ts` y `SidebarNav.tsx`.
- **No** cambia `tienePermiso`, ni `usePermiso`, ni la jerarquía de niveles, ni ninguna policy de RLS, ni el guard de navegación por `read`. Nada de eso se toca.

## Capabilities

### New Capabilities

Ninguna. Este change no introduce una capacidad nueva: completa una que ya está especificada a medias.

### Modified Capabilities

- `permisos-modulo-frontend`: agrega requisitos de **gateo de escritura en la interfaz**. La capability hoy especifica la carga de permisos, la jerarquía de niveles, el mapeo ruta→módulo, el hook `usePermiso` y el filtrado de navegación por `read` — pero no dice nada sobre qué debe pasar en pantalla cuando la cuenta tiene `read` y no `write`. Este delta cubre ese hueco: propagación del permiso de escritura por pantalla, estado de las acciones y los campos sin permiso, y visibilidad del modo solo lectura.

⚠️ **Dependencia de ordenamiento**: `permisos-modulo-frontend` todavía **no existe** en `openspec/specs/` — vive como delta dentro de `openspec/changes/auth-frontend-real/specs/`, porque ese change aún no está archivado (61/64 tareas). El delta de este change extiende esa capability y por lo tanto **debe archivarse después** de `auth-frontend-real`, o los deltas se sincronizan en orden.

## Impact

### Código afectado

| Área | Archivos | Naturaleza |
|---|---|---|
| Auth compartido | `frontend/src/shared/auth/` (nuevo contexto + hook; `RequireAuth.tsx` como punto de inyección) | Nuevo + modificación puntual |
| Design system | `frontend/src/design-system/components.tsx` (`Button`), nueva primitiva de solo-lectura | Extensión aditiva, retrocompatible |
| Pacientes | `PacientesList`, `PacienteResumen`, `PacienteForm`, `CudFields`, `DireccionesEditor`, `PersonasACargoEditor`, `PacienteDocumentos*` | Cableado |
| Obras Sociales | `ObrasSocialesList`, `ObraSocialDetail`, `ObraSocialForm`, `ChecklistEditor`, `PlantillaFacturaEditor` | Cableado |
| Conductores | `ConductoresList`, `ConductorDetail`, `ConductorForm`, `ConductorDocumentos`, `AsignacionSemanalTabla` | Cableado |
| Vehículos | `VehiculosList`, `VehiculoDetail`, `VehiculoForm`, `VehiculoDocumentos`, `GastosVehiculo`, `VehiculoMantenimiento` | Cableado |
| Hojas de Ruta | `HojaDeRutaPage`, `NuevoRecorridoForm`, `RecorridoCard`, `ParadasList`, `AsignacionPanel`, `VistaGlobalHojaDeRuta` | Cableado |
| Presupuestos | `PresupuestosList`, `PresupuestoResumen`, `PresupuestoForm`, `PresupuestoDetail`, `AutorizacionForm` | Cableado |
| Facturación | `FacturasList`, `FacturaDetail`, `FacturaForm`, `FacturaAccionesEmision`, `CobrosPanel`, `AsistenciasEditor`, `FacturaCobrosSection`, `FacturaDocumentos` | Cableado |
| Tests | `renderConSesion` (`shared/test/renderConSesion.tsx`) ya soporta declarar el escenario de permisos; los ~190 tests existentes asumen "admin con todos los permisos" (default del mock) y **no deben requerir cambios** | Sin cambios esperados |

**Fuera de alcance explícito**: `/cuentas` (se gobierna por rol `admin`, no por módulo — su gateo ya funciona por `requiereRolAdmin`), Dashboard `/` (agregación de solo lectura, sin módulo propio), `/design-system` (vitrina interna), `LoginPage` (pre-sesión).

### Backend / APIs / dependencias

Ninguno. Cero migraciones, cero cambios de RLS, cero Edge Functions, cero dependencias nuevas.

### Riesgo y gobernanza

- **Nivel de gobernanza: CRÍTICO** (dominio auth/permisos, según la tabla de Agent Governance del proyecto). Este change está autorizado hasta la etapa de *propuesta* (artefactos y análisis). **`/opsx:apply` requiere aprobación humana explícita antes de escribir una sola línea de código.**
- Riesgo funcional principal: **falso negativo** — deshabilitar por error una acción a una cuenta que sí tiene `write` (o al rol `admin`, que hace short-circuit en `tienePermiso`). Se mitiga con tests de las dos direcciones por cada comportamiento (cuenta con `write` → habilitado; cuenta con solo `read` → deshabilitado), que es el mínimo que exige el modo Strict TDD del proyecto.
- Riesgo secundario: deshabilitar de más y atrapar acciones inocentes (`Cancelar`, `Volver al listado`, cambios de vista, `Reintentar`). Se mitiga con el diseño opt-in — nunca automático sobre todos los botones.
- Riesgo de diseño (OWASP A04 *Insecure Design*): que alguien lea este gateo como la frontera de autorización. Se mitiga documentándolo en el código y en el spec con el mismo lenguaje que ya usan `permisos.ts` y `SidebarNav.tsx`.
- **Verificación manual humana**: igual que `auth-frontend-real`, el cierre de este change necesita una pasada manual end-to-end con una cuenta real de solo `read` contra el proyecto Supabase — a cargo de la usuaria, no automatizable con los mocks.

### Plan de rollback

Cada fase (contexto/primitivas → módulo) es un commit independiente y aditivo. El contexto arranca en `true` por defecto para rutas sin módulo, así que revertir el cableado de un módulo deja ese módulo exactamente como está hoy (todo habilitado) sin romper el resto. Rollback total = revertir los commits en orden inverso; no hay estado persistido, ni migración, ni feature flag que limpiar.

### Dependencias entre changes

- **Depende de** `auth-frontend-real` (provee `usePermiso`, `tienePermiso`, `moduloDeRuta`, `RequireAuth`, `renderConSesion`) — en curso, 61/64.
- **Depende de** `C-02-usuarios-permisos-auditoria` (provee la matriz de permisos y `modulos.tiene_permiso()` en el servidor) — en curso, 14/16.
- **No bloquea** a ningún change del roadmap C-03..C-11. Los changes de módulo posteriores deberán consumir el contexto de escritura al construir sus pantallas nuevas, pero no dependen de que este esté cerrado.

## Open Questions — todas resueltas (2026-07-29)

1. **¿Ocultar o deshabilitar las acciones de escritura?** → **DESHABILITAR**, nunca ocultar. Las acciones de escritura (*Crear* / *Editar* / *Guardar*) siguen **visibles** en el DOM pero bloqueadas, y los campos quedan no editables. Se descarta el ocultamiento y también el criterio mixto: una acción que desaparece no le enseña a la cuenta qué permiso pedirle a la administradora.
2. **¿Indicador visible de "modo solo lectura"?** → **SÍ**. Toda pantalla con la escritura gateada muestra un aviso visible de modo solo lectura, para que un formulario entero deshabilitado no se lea como una aplicación rota.
3. **¿Alcance en un solo change o en dos?** → **CUATRO changes, uno por módulo real del backend**, cada uno proponible / aplicable / revisable de forma independiente (respeta el presupuesto de revisión de ~400 líneas de la convención de PRs encadenados del proyecto). Este change queda como el análisis paraguas del que se derivan los cuatro; ver §Split.
4. **Agrupación módulo→pantalla** → **CONFIRMADA tal cual está**: `conductores` gatea Conductores + Vehículos + Hojas de Ruta; `facturacion` gatea Presupuestos + Facturación. Misma agrupación que la RLS ya desplegada en `seed_modulos.sql`; no se toca.
5. **Acciones que no son un CRUD limpio** (emitir factura, registrar cobro, corregir estado de asistencia, reordenar paradas de hoja de ruta) → **nivel `write`, igual que el CRUD normal**. No requieren `admin`. Se mantiene la jerarquía simple; es revisable más adelante sin cambio estructural, porque `tienePermiso` ya soporta cualquier nivel mínimo sin modificarse.

## Split

Por la decisión 3, este change **no se implementa como tal**: se divide en cuatro changes, uno por módulo real del backend. El orden es una cadena de dependencia, no una preferencia:

| # | Change | Módulo | Pantallas | Depende de |
|---|---|---|---|---|
| 1 | `gateo-escritura-obra-social` | `obra_social` | `/obras-sociales` | — (**construye la plomería compartida**) |
| 2 | `gateo-escritura-pacientes` | `pacientes` | `/pacientes` | 1 |
| 3 | `gateo-escritura-facturacion` | `facturacion` | `/presupuestos`, `/facturacion` | 1 |
| 4 | `gateo-escritura-conductores` | `conductores` | `/conductores`, `/vehiculos`, `/hojas-de-ruta` | 1 |

El change 1 construye el mecanismo compartido (contexto en `RequireAuth`, `usePuedeEscribir()`, envoltorio de solo lectura, prop opt-in en `Button`, aviso de solo lectura) y lo estrena sobre la superficie más chica. Los changes 2, 3 y 4 solo consumen ese mecanismo y son **independientes entre sí** — pueden aplicarse en cualquier orden, o en paralelo, una vez cerrado el 1.

`obra_social` va primero porque es el único módulo de una sola ruta sin componente de documentos: 8 puntos de escritura contra los ~13 de `pacientes`, ~20 de `facturacion` y ~26 de `conductores`. Valida el patrón donde equivocarse cuesta menos.
