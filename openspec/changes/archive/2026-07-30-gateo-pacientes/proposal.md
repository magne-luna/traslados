## Why

`auth-frontend-real` entregó `tienePermiso` / `usePermiso` con la jerarquía `read < write < admin` completa, pero **no los conectó a ninguna pantalla en nivel `write`** (su `design.md` §Open Questions punto 3). Hoy una cuenta con permiso **solo `read`** sobre `pacientes` entra a la pantalla y ve *Crear* / *Editar* y el formulario de alta y edición plenamente interactivos; el intento de guardar recién falla después, en el servidor, contra la RLS.

**No es un agujero de seguridad**: la autorización efectiva la impone la RLS vía `modulos.tiene_permiso('pacientes', 'write')`, ya desplegada. Es una corrección de **experiencia de uso y consistencia**.

Este es el **segundo de cuatro changes** que cierran el hueco, uno por módulo real del backend. `gateo-obrasocial` ya construyó el mecanismo compartido; **este change solo lo consume** y lo aplica a la pantalla de Pacientes. Es la primera superficie con **editores anidados en profundidad** (tres) y con **componente de documentos**, así que es donde el mecanismo se pone a prueba de verdad.

## What Changes

Todo el cableado se hace con el mecanismo que ya existe (`usePuedeEscribir()`, envoltorio de solo lectura, prop opt-in en `Button`, aviso con `Alert`). **No se construye ni se modifica infraestructura compartida.**

- `PacientesList` (178 líneas): *Crear paciente* (`:60`), *Crear el primero* (`:82`) y *Editar* por fila (`:159`) visibles pero bloqueados sin `write`, más su `<button>` nativo. La fila sigue navegando al detalle.
- `PacienteResumen`: *Editar* (`:116`) bloqueado sin `write`.
- `PacienteForm` (107 líneas): campos no editables y *Guardar* (`:101`) bloqueado sin `write`. *Cancelar* (`:98`) sigue operativo.
- Bloques de campos del formulario — `PacienteDatosPersonalesFields` (155), `PacienteCoberturaFields` (74), `IdentificadorAfiliadoField` (51) — cubiertos por el envoltorio de solo lectura sin tocar sus firmas.
- `CudFields` (173): los 5 puntos de escritura (`:53`, `:90`, `:93`, `:163`, `:166` — empezar edición, editar, quitar, cancelar edición interna, guardar) gateados sin `write`. Los datos del CUD siguen legibles.
- `DireccionesEditor` (130): agregar (`:123`), su `<button>` nativo y los campos, inertes sin `write`. Las direcciones siguen legibles.
- `PersonasACargoEditor` (211): agregar/editar (`:203`) y sus 3 `<button>` nativos, inertes sin `write`. Las personas a cargo siguen legibles.
- `PacienteDocumentos` (71) + `PacienteDocumentosChecklist` (20): la **carga y baja** de documentos bloqueada sin `write`; la **consulta y descarga** de documentos existentes sigue disponible con `read`.
- `PacientesPage` (62 líneas, switch lista/detalle): aviso de modo solo lectura, replicando el patrón fijado en `gateo-obrasocial`.

### No cambia

`tienePermiso`, `usePermiso`, la jerarquía de niveles, el gateo de navegación por `read`, el mecanismo compartido del change 1, ninguna policy de RLS, ninguna Edge Function, ninguna dependencia. Cero backend.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `permisos-modulo-frontend`: agrega **únicamente** el requisito de gateo de la pantalla de Pacientes. Los requisitos del mecanismo (permiso derivado de la ruta, acciones deshabilitadas pero visibles, acciones sin escritura preservadas, campos no editables, aviso visible, la constancia de que esto es UX y no frontera de seguridad) los aporta `gateo-obrasocial` y **no se repiten acá**.

⚠️ **Ordenamiento de archivado**: `permisos-modulo-frontend` ya existe en `openspec/specs/` (`auth-frontend-real` fue archivado el 2026-07-29), así que no hay dependencia pendiente hacia atrás. Lo que sí importa: este delta asume los requisitos del mecanismo que aporta `gateo-obrasocial`, así que **debe archivarse después** de ese change.

## Impact

| Área | Archivos | Naturaleza |
|---|---|---|
| Pacientes | `PacientesList`, `PacienteResumen`, `PacienteForm`, `PacienteDetail`, `PacienteDatosPersonalesFields`, `PacienteCoberturaFields`, `IdentificadorAfiliadoField`, `CudFields`, `DireccionesEditor`, `PersonasACargoEditor`, `PacienteDocumentos`, `PacienteDocumentosChecklist`, `PacientesPage` | Cableado |
| Auth compartido / design system | — | **Sin cambios**: se consume el mecanismo del change 1 |
| Tests | `renderConSesion` ya permite declarar el escenario de permisos; su default mantiene verdes los tests existentes de pacientes **sin editarlos** | Sin cambios esperados |

**Fuera de alcance**: los otros tres módulos (sus propios changes), y cualquier modificación al mecanismo compartido — si hiciera falta tocarlo, es señal de que el change 1 quedó incompleto y se corrige allá, no acá.

**Backend/APIs/dependencias**: ninguno.

### Riesgo y gobernanza

- **Nivel de gobernanza: CRÍTICO** (dominio auth/permisos). **`/opsx:apply` requiere aprobación humana explícita antes de escribir código.**
- Riesgo principal: **falso negativo** — deshabilitar a quien sí puede escribir, sobre todo al rol `admin`, que short-circuita en `tienePermiso` sin consultar la matriz. Mitigado con un ciclo TDD propio.
- Riesgo específico de este módulo: es la superficie con **más editores anidados** (`CudFields`, `DireccionesEditor`, `PersonasACargoEditor`) y con **5 `<button>` nativos** que no son componentes `Button`. Si el envoltorio de solo lectura del change 1 no los cubre, se descubre acá. Mitigado con ciclos TDD por editor.
- Riesgo específico: confundir **consultar** un documento con **escribirlo**. Bloquear la descarga de un documento a una cuenta con `read` sería una regresión, no el objetivo. Mitigado con un ciclo TDD que verifica que la consulta sigue disponible.
- Riesgo de diseño (OWASP A04): que se lea este gateo como la frontera de autorización. Mitigado con el comentario explícito en el código y el requisito ya fijado por el change 1.
- **Verificación manual humana** con una cuenta real de solo `read`, a cargo de la usuaria.

### Plan de rollback

Revertir el commit devuelve la pantalla de Pacientes a su comportamiento actual (todo habilitado), sin afectar al mecanismo compartido ni a los otros módulos. No hay estado persistido, ni migración, ni feature flag.

### Dependencias entre changes

- **Depende de** `gateo-obrasocial` (mecanismo compartido: contexto en `RequireAuth`, `usePuedeEscribir()`, envoltorio de solo lectura, prop opt-in en `Button`, patrón del aviso).
- **Depende de** `auth-frontend-real` y `C-02-usuarios-permisos-auditoria` — ✅ ambos archivados (`archive/2026-07-29-auth-frontend-real/`, `archive/2026-07-29-C-02-usuarios-permisos-auditoria/`).
- **Independiente de** `gateo-facturacion` y `gateo-conductores`: los tres consumen el mismo mecanismo y no se pisan. Pueden ir en cualquier orden o en paralelo.
- Deriva del análisis paraguas archivado en `openspec/changes/archive/2026-07-29-gateo-escritura-formularios-split/`.

## Decisiones ya cerradas por la usuaria (2026-07-29)

No re-abrir sin hablar con ella: **deshabilitar nunca ocultar** · **sí al aviso visible** de solo lectura · **4 changes uno por módulo** · **agrupación módulo→pantalla** tal cual `seed_modulos.sql` · **todas las acciones de escritura al nivel `write`**, ninguna requiere `admin`.
