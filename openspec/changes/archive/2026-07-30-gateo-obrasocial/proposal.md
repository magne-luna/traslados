## Why

`auth-frontend-real` entregó la maquinaria de permisos por módulo completa —`tienePermiso(rol, permisos, modulo, nivelMinimo)` con jerarquía `read < write < admin` y el hook `usePermiso(modulo, nivelMinimo)`— pero **deliberadamente no la conectó a ninguna pantalla en nivel `write`** (su `design.md` §Open Questions punto 3: *"Gateo de escritura por nivel: **solo el hook** `usePermiso()` en este change"*). Hoy `nivelMinimo: 'write'` no se invoca en ningún lugar del código: los dos únicos consumidores (`SidebarNav.tsx:45-47` y `RequireAuth.tsx:40`) piden `'read'`.

Consecuencia: una cuenta con permiso **solo `read`** sobre un módulo entra a su pantalla (correcto, tiene `read`) y ve los botones *Crear* / *Editar* y los formularios de alta y edición **plenamente interactivos**. Puede escribir en todos los campos y apretar *Guardar*; el intento recién falla después, en el servidor, contra la RLS.

**No es un agujero de seguridad.** La autorización efectiva la impone la RLS vía `modulos.tiene_permiso(mod, 'write')`, ya desplegada en las migraciones `20260724100003..100006`. Un cliente parcheado no escribe ni una fila más. Es una corrección de **experiencia de uso y consistencia**.

Este es el **primero de cuatro changes** que cierran ese hueco, uno por módulo real del backend. Además de cablear su propio módulo, **este change construye el mecanismo compartido** que los otros tres consumen. `obra_social` va primero porque es la superficie más chica donde estrenarlo: única ruta, sin componente de documentos, 8 puntos de escritura contra los ~13 de `pacientes`, ~20 de `facturacion` y ~26 de `conductores`. Validar el patrón donde equivocarse cuesta menos.

## What Changes

### Mecanismo compartido (lo consumen los otros tres changes)

- **Contexto de permiso de escritura por ruta**, derivado del módulo de la ruta activa (que `moduloDeRuta()` en `app/routes.ts` ya resuelve) cruzado con `usePermiso(modulo, 'write')`, y sembrado en un único punto: `RequireAuth`, que ya está en el camino de todas las rutas protegidas.
- **Hook `usePuedeEscribir()` sin argumentos**, para que ningún componente de feature tenga que saber a qué módulo del backend pertenece la pantalla en la que vive.
- **Envoltorio de solo lectura en el design system** sobre `<fieldset disabled>` nativo: deshabilita de una vez todos los controles descendientes, incluidos los de subcomponentes anidados que el envoltorio no conoce.
- **Prop opt-in de escritura en `Button`**: declara que la acción escribe. **Nunca automática** — `Cancelar`, `Volver al listado`, los conmutadores de vista y `Reintentar` deben seguir funcionando para una cuenta de solo lectura.
- **Aviso visible de modo solo lectura**, reutilizando `Alert` de `design-system/feedback.tsx`, para que un formulario entero deshabilitado no se lea como una aplicación rota.
- **Bloqueo del reordenamiento por arrastre**, que `<fieldset disabled>` **no** cubre: un `<li draggable>` sigue arrastrándose dentro de un fieldset deshabilitado. Hay exactamente dos componentes con `draggable` en todo el proyecto (`ChecklistItemRow.tsx:39` y `PlantillaCampoRow.tsx:53`) y los dos son de este módulo, así que el hueco se descubre y se cierra acá.

### Cableado del módulo `obra_social` (ruta `/obras-sociales`)

- `ObrasSocialesList`: *Crear obra social* (`:41`), *Crear la primera* (`:58`) y *Editar* por fila (`:136`) deshabilitados sin `write`. La fila sigue navegando al detalle.
- `ObraSocialDetail`: *Editar* (`:133`) deshabilitado sin `write`.
- `ObraSocialForm`: los 8 campos (`Field`/`Input`/`Select` de `design-system/form`) no editables y *Guardar* (`:157`) deshabilitado sin `write`. *Cancelar* (`:154`) sigue operativo.
- `ChecklistEditor` (`:80`) + `ChecklistItemRow`: agregar, editar el nombre, reordenar (botones `:69`/`:78`/`:87` **y** arrastre) y eliminar, todo inerte sin `write`. El checklist sigue **legible**.
- `PlantillaFacturaEditor` (`:139`) + `PlantillaCampoRow`: mismo criterio, incluidos sus 3 botones nativos y su arrastre.
- `ObraSocialesPage`: aviso de modo solo lectura cuando la cuenta no tiene `write` sobre `obra_social`.

### No cambia

`tienePermiso`, `usePermiso`, la jerarquía de niveles, el gateo de navegación por `read`, ninguna policy de RLS, ninguna Edge Function, ninguna dependencia. Cero backend.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `permisos-modulo-frontend`: agrega los requisitos del **mecanismo de gateo de escritura en la interfaz** (permiso derivado de la ruta, acciones de escritura deshabilitadas pero visibles, acciones sin escritura preservadas, campos no editables, arrastre bloqueado, aviso visible) **más** el requisito de gateo de la pantalla de Obras Sociales. Los otros tres changes del split agregan únicamente su requisito de pantalla, sin repetir los del mecanismo.
  - **MODIFICA** el requisito existente *"El control de permisos del cliente no sustituye a la RLS"* para extenderlo explícitamente al gateo de escritura (hoy habla solo del control de permisos en general) y para fijar que la jerarquía de niveles tiene **una sola** implementación, `tienePermiso`. Se modifica en vez de agregar un requisito paralelo casi idéntico.

✅ **Ordenamiento resuelto**: `permisos-modulo-frontend` ya existe en `openspec/specs/permisos-modulo-frontend/spec.md` con sus 6 requisitos, porque `auth-frontend-real` fue archivado (`openspec/changes/archive/2026-07-29-auth-frontend-real/`). Este delta extiende esa capability directamente, sin dependencia de archivado pendiente.

## Impact

| Área | Archivos | Naturaleza |
|---|---|---|
| Auth compartido | `frontend/src/shared/auth/` (contexto + hook nuevos), `RequireAuth.tsx` (punto de inyección) | Nuevo + modificación puntual |
| Design system | `design-system/components.tsx` (`Button`), envoltorio de solo lectura nuevo | Extensión aditiva y retrocompatible |
| Obras Sociales | `ObrasSocialesList`, `ObraSocialDetail`, `ObraSocialForm`, `ChecklistEditor`, `ChecklistItemRow`, `PlantillaFacturaEditor`, `PlantillaCampoRow`, `ObraSocialesPage` | Cableado |
| Tests | `renderConSesion` ya permite declarar el escenario de permisos; su default (admin con todos los permisos) mantiene verdes los ~190 tests existentes **sin editarlos** | Sin cambios esperados |

**Fuera de alcance**: los otros tres módulos (sus propios changes), `/cuentas` (gateada por rol `admin`, ya funciona), Dashboard (agregación de solo lectura sin módulo propio), `/design-system`, `LoginPage`.

**Backend/APIs/dependencias**: ninguno.

### Riesgo y gobernanza

- **Nivel de gobernanza: CRÍTICO** (dominio auth/permisos, tabla de Agent Governance del proyecto). **`/opsx:apply` requiere aprobación humana explícita antes de escribir una sola línea de código.**
- Riesgo principal: **falso negativo** — deshabilitar por error a quien sí puede escribir, sobre todo al rol `admin`, que short-circuita en `tienePermiso` y puede no tener ninguna fila en la matriz de permisos. Mitigado con un ciclo TDD propio para ese caso.
- Riesgo secundario: deshabilitar de más y atrapar acciones inocentes (`Cancelar`, `Volver al listado`). Mitigado con el diseño opt-in.
- Riesgo de diseño (OWASP A04 *Insecure Design*): que se lea este gateo como la frontera de autorización. Mitigado con un requisito propio en el spec y el mismo comentario que ya llevan `permisos.ts` y `SidebarNav.tsx`.
- **Verificación manual humana**: con una cuenta real de solo `read` contra el proyecto Supabase, a cargo de la usuaria. Mismo patrón de cierre que `auth-frontend-real`.

### Plan de rollback

Revertir el commit devuelve la pantalla de Obras Sociales a su comportamiento actual (todo habilitado). El contexto arranca en `true` para rutas sin módulo y el fallback fuera del proveedor también es `true`, así que revertir solo el cableado y dejar el mecanismo no rompe nada. No hay estado persistido, ni migración, ni feature flag que limpiar.

### Dependencias entre changes

- **Depende de** `auth-frontend-real` (provee `usePermiso`, `tienePermiso`, `moduloDeRuta`, `RequireAuth`, `renderConSesion`) — ✅ **archivado** (`archive/2026-07-29-auth-frontend-real/`).
- **Depende de** `C-02-usuarios-permisos-auditoria` (matriz de permisos y `modulos.tiene_permiso()` en el servidor) — ✅ **archivado** (`archive/2026-07-29-C-02-usuarios-permisos-auditoria/`).
- **Bloquea a** `gateo-pacientes`, `gateo-facturacion` y `gateo-conductores`: los tres consumen el mecanismo compartido que se construye acá. Entre ellos son independientes y pueden ir en cualquier orden o en paralelo una vez cerrado este.
- Deriva del análisis paraguas archivado en `openspec/changes/archive/2026-07-29-gateo-escritura-formularios-split/`.

## Decisiones ya cerradas por la usuaria (2026-07-29)

No re-abrir sin hablar con ella:

1. **Deshabilitar, nunca ocultar**: las acciones de escritura siguen visibles en el DOM pero bloqueadas.
2. **Sí al indicador visible** de modo solo lectura.
3. **Cuatro changes, uno por módulo**, cada uno revisable de forma independiente.
4. **Agrupación módulo→pantalla confirmada** tal cual la tiene `seed_modulos.sql`.
5. **Todas las acciones de escritura al nivel `write`**, ninguna requiere `admin`.
