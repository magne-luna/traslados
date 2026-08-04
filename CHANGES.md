# CHANGES — Secuencia de Implementación

> Índice canónico de todos los changes del proyecto **Traslados** (Sistema de Gestión Integral para servicio de traslado personalizado de personas con discapacidad — cliente Andrea Pastor, Magne Studios).
> Cada change es atómico: un agente puede implementarlo en una sesión (~4-6 horas).
> **Leer este archivo antes de ejecutar cualquier `/opsx:propose`.**

Stack: React + TypeScript (frontend) · Supabase (auth + PostgreSQL + storage) · Google Maps/Geometry API · integración Google Drive · integración ARCA (nivel a confirmar).

---

## Cómo usar este documento

1. Identificá el próximo change pendiente (`[ ]`) respetando el orden de **Dependencias** y los **GATES de paralelismo**.
2. Leé los archivos listados en **"Leer antes"** de ese change — son la fuente de verdad del dominio.
3. Ejecutá `/opsx:propose C-NN-{nombre}` para generar proposal + design + tasks.
4. Implementá y luego `/opsx:archive` al completar.
5. Marcá el checkbox `[x]` de **Estado** en este archivo cuando el change quede archivado.

⚠️ **Antes de arrancar C-04, C-05, C-06 o C-07**: revisar `knowledge-base/10_preguntas_abiertas.md` — hay preguntas de **prioridad alta** sin cerrar con el cliente (identificación fiscal CUIL/CUIT, checklists de otras obras sociales además de OSECAC, identificador en factura DNI vs. afiliado, integración ARCA, plazos por defecto 90/60/45 días). Donde no haya respuesta, implementar con el valor por defecto documentado en la KB y dejar el campo configurable, nunca hardcodeado.

---

## Plan de integración Backend↔Frontend (swap de mocks)

> Objetivo actual (desde 2026-07-31): terminar de integrar con el backend real todo dominio que hoy corre sobre repositorio mock. El schema + RLS de Supabase ya existe para casi todos (relevamiento `traslados-app/estado-proyecto`, 2026-07-30); lo que falta en cada uno es escribir el `Supabase*Repository` concreto y cablearlo en el composition root (`*Route.tsx` — cada uno ya tiene el comentario "cuando exista SupabaseXRepository, este es el único archivo que cambia").
>
> No confundir con los changes C-NN de arriba (esos son "construir la pantalla"; esto es "conectarla al backend real" — en varios casos ya archivados como `*-ui` en mock, y ahora toca el swap).

> **Retomado por la usuaria (2026-07-31).** El plan había quedado pausado tras Obra Social (paso 1);
> la usuaria confirmó seguir. `Conductores + Vehículos` (fila 3) lo está llevando ella misma en una
> sesión de Claude Code aparte — no tocar ese change desde acá. `Facturación` (fila 4) se propuso en
> esta sesión y queda bloqueada en su propio portón de governance (§C-07) hasta que Enzo/backend
> decida las 5 preguntas — no avanzar al apply sin esas respuestas.

| Orden | Dominio | Estado | Notas |
|-------|---------|--------|-------|
| — | Auth / Cuentas | ✅ real | Ya integrado, no forma parte de este plan |
| 1 | Pacientes (C-05) | 🔶 código+migración+tests completos, **pendiente de revisión manual a cargo de Enzo/backend** antes de archivar | Ver bullet ⏳ en §C-05 más abajo |
| 2 | Obra Social (C-04) | 🔶 código+migraciones+tests completos (`integracion-obra-social`, 2026-07-31), **pendiente de aplicación de las migraciones y revisión manual a cargo de Enzo/backend** antes de archivar | Ver bullet ⏳ en §C-04 más abajo. Hallazgo del apply: el schema real ya tenía casi todo lo que `design.md` planeaba (nombres/tipos distintos). D12 (RN-ID-02) se revirtió y luego se restauró el mismo día — la "confirmación" que la revertía nunca pasó, ver §C-04 |
| 3 | Conductores + Vehículos (C-08/C-09) | 🔶 **reconciliado (2026-08-01), bloqueado en 1 gap** | `vehiculo-mantenimiento-registro` (ajuste de categorías, no swap de backend) ya se archivó (commit `501a525`). `openspec/changes/integracion-conductores-vehiculos/` (mock→Supabase de Vehículos+Conductores) se escribió en paralelo con `C-08-vehiculos-mantenimiento` de Enzo (ya mergeado a `main`, commit `f840a96`), sin que ninguno de los dos supiera del otro. **Vehículos**: reconciliado contra el backend real de Enzo (gasto, habilitaciones y kilometraje adoptan su implementación) — ver bullet ⚠️ en §C-08 más abajo, **bloqueado en un gap real** (falta fuente de datos para `mantenimientos`, necesita decisión de Enzo). **Conductores**: sin conflicto con lo que Enzo mergeó (confirmado, ninguna de sus 15 migraciones toca `conductores.conductores`/`conductores_vehiculos`); tanda de mapeo puro (`conductorMapping.ts`, `semanaIso.ts`) completa; el repository real (§7) queda bloqueado porque las migraciones de asignación semanal/estado (`20260801120000_conductores_vehiculos_campos.sql`/`_rpc.sql`) todavía no las escribió nadie |
| 4 | Facturación (C-07) | 🔶 propose completo (`integracion-facturacion`, 2026-07-31), **bloqueado en el portón de governance §0 de `tasks.md` — 5 decisiones a cargo de Enzo/backend** antes de poder aplicar | Ver bullet ⏳ en §C-07 más abajo para el detalle de las 5 decisiones |
| 5 | Presupuestos (C-06) | 🟢 propose completo y **portón de governance aprobado** (`integracion-presupuestos`, 2026-08-02) — listo para `/opsx:apply` | Los 2 puntos que lo bloqueaban están **resueltos** (`monto_autorizado` + trigger RN-PA-01, `vigencia_desde`) y `C-06` está archivado. Ver bullet ✅ en §C-06 más abajo |
| 6 | Hojas de Ruta (C-10) | 🔶 en progreso (apply `integracion-hojas-de-ruta`, 2026-08-04 — WU5a, documentación, completada) | Ver bullet ⚠️ en §C-10 más abajo |
| 7 | Dashboard (C-11) | ⏳ pendiente | Va último — agrega datos de todos los repos reales de arriba |
| 8 | Documentos (storage) | ⏳ pendiente | Buckets ya creados; falta reemplazar `mockDocumentoRepository` (uploads simulados) |

---

## Árbol de dependencias

```
C-01 foundation-setup
└── C-02 usuarios-permisos-auditoria
    ├── C-03 gestion-documental-core
    │   └── C-05 pacientes-fichas-clinicas ──┐
    ├── C-04 obras-sociales-prestadores ─────┤
    │                                        ├── C-06 presupuestos-autorizaciones
    │                                        │   └── C-07 facturacion-asistencias-cobros ──┐
    │                                        │                                             │
    └── C-08 vehiculos-mantenimiento                                                       │
        └── C-09 conductores                                                               │
            └── C-10 hojas-de-ruta-recorridos (necesita también C-05) ──────────────────────┤
                                                                                             │
                                                                    C-11 panel-principal-reportes
                                                                    (necesita C-05, C-07, C-08, C-10)
```

### Paralelismo por fase

```
GATE 0: C-01 ✓
  → C-02 usuarios-permisos-auditoria     [Agente A]   (único desbloqueado — todo lo demás depende de auth/RLS)

GATE 1: C-02 ✓                            ← FORK (3 ramas independientes)
  → C-03 gestion-documental-core          [Agente A]
  → C-04 obras-sociales-prestadores       [Agente B]
  → C-08 vehiculos-mantenimiento          [Agente C]

GATE 2: C-03 ✓, C-04 ✓ / C-08 ✓           ← FORK
  → C-05 pacientes-fichas-clinicas        [Agente A — necesita C-03 ✓ y C-04 ✓]
  → C-09 conductores                      [Agente C — necesita C-08 ✓]

GATE 3: C-05 ✓, C-09 ✓                    ← FORK
  → C-06 presupuestos-autorizaciones      [Agente A — necesita C-05 ✓ y C-04 ✓]
  → C-10 hojas-de-ruta-recorridos         [Agente C — necesita C-05 ✓, C-08 ✓ y C-09 ✓]

GATE 4: C-06 ✓
  → C-07 facturacion-asistencias-cobros   [Agente A — necesita C-06 ✓]

GATE 5: C-05 ✓, C-07 ✓, C-08 ✓, C-10 ✓
  → C-11 panel-principal-reportes         [Agente libre — dashboard agrega datos de todo lo anterior]
```

### Camino crítico (6 changes — mínimo irreducible)

```
C-01 → C-02 → C-04 → C-05 → C-06 → C-07*
```
*C-03 (gestión documental) corre en paralelo a C-04 y es igualmente indispensable antes de C-05 — ambos gatean C-05, pero al ejecutarse en paralelo no extienden el camino en tiempo de reloj. Se elige `C-07` (facturación/cobros) como último eslabón porque es el flujo de negocio de fin a fin sin el cual el sistema no reemplaza el proceso actual (planillas de cobro). El panel de reportes (C-11) queda fuera del camino crítico por regla: es agregación de datos ya existentes, no bloquea la operación real.

### Plan óptimo con 3 agentes

| Paso | Agente A (Backend Core / Dominio clínico-financiero) | Agente B (Backend Aux / Obras sociales) | Agente C (Flota y operación diaria) |
|------|-------------------------------------------------------|------------------------------------------|----------------------------------------|
| 1 | C-01 foundation-setup | — | — |
| 2 | C-02 usuarios-permisos-auditoria | — | — |
| 3 | C-03 gestion-documental-core | C-04 obras-sociales-prestadores | C-08 vehiculos-mantenimiento |
| 4 | C-05 pacientes-fichas-clinicas (espera B) | — (libre, apoya C-05 o adelanta docs de C-04) | C-09 conductores |
| 5 | C-06 presupuestos-autorizaciones | — (libre, apoya QA/documentación) | C-10 hojas-de-ruta-recorridos (espera A: C-05) |
| 6 | C-07 facturacion-asistencias-cobros | — | — |
| 7 | C-11 panel-principal-reportes (cualquiera libre) | — | — |

---

## FASE 0 — Fundación técnica

> Nada más puede empezar hasta que C-02 esté cerrado: toda tabla del sistema vive bajo RLS por módulo.

### [C-01] `foundation-setup`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Scaffold del frontend React + TypeScript (Vite o similar), estructura `src/features/*` por módulo según `08_arquitectura_propuesta.md` (pacientes, obras-sociales, presupuestos-autorizaciones, facturacion, vehiculos, conductores, hojas-de-ruta, dashboard, usuarios-y-permisos).
  - Proyecto Supabase inicial: configuración de `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` como variables de entorno (nunca en el bundle salvo anon key).
  - Carpeta `supabase/migrations/` y convención de numeración de migraciones.
  - Creación de los 4 buckets de storage: `documentos-pacientes`, `documentos-vehiculos`, `documentos-conductores`, `documentos-facturas` (privados, no públicos).
  - Cliente Supabase compartido (`shared/lib/supabaseClient.ts`) y cliente Google Maps (`shared/lib/googleMapsClient.ts`) con `GOOGLE_MAPS_API_KEY` restringida por dominio.
  - Layout base, routing protegido (placeholder de auth), lint/format/test runner configurados.
  - Tests: smoke test de conexión a Supabase, build sin errores.
- **Dependencias**: ninguna
- **Governance**: BAJO
- **Leer antes**:
  - `knowledge-base/08_arquitectura_propuesta.md` (completo — patrones, estructura de directorios, variables de entorno)
  - `knowledge-base/02_descripcion_general.md`
- **Progreso frontend (mock, vía `ROADMAP-FRONTEND.md` FE-0)**: ✅ scaffold, design system (Tailwind v4 + `@theme`), layout/shell/routing/guard de rutas con `useAuth()` mockeado — implementado y archivado como `app-shell-navegacion` (`openspec/changes/archive/2026-07-24-app-shell-navegacion/`). **Falta** todo lo backend: proyecto Supabase real, `supabase/migrations/`, 4 buckets, `supabaseClient.ts`/`googleMapsClient.ts` reales.

### [C-02] `usuarios-permisos-auditoria`
- **Estado**: `[~]` backend y frontend implementados (2026-07-28/29); pendiente solo la verificación manual end-to-end contra el proyecto real (bloqueada por la promoción de la cuenta admin de Andrea) antes de poder cerrarlo
- **Scope**:
  - Migración: tabla `usuarios` (o uso directo de `auth.users` de Supabase) + tabla `permisos_modulo` (cuenta → módulo habilitado, sin roles fijos — matriz Cuenta→Módulos, no Rol→Permiso).
  - Migración: tabla `audit_log` (usuario, acción, entidad afectada, timestamp) con trigger o wrapper de escritura reutilizable por todos los módulos futuros.
  - Auth: Supabase Auth con email + contraseña, sin registro público (altas las hace la administradora).
  - RLS base: políticas por tabla ligadas a `permisos_modulo`, patrón reutilizable para todas las tablas de dominio que se creen después.
  - Frontend: pantalla de login, gestión de cuentas (alta/edición de acceso por módulo) para la administradora, guard de rutas protegidas.
  - (Deseable) registro de hora de ingreso/egreso por cuenta.
  - Tests: creación de cuenta + asignación de módulos, bloqueo de acceso a módulo no habilitado (RLS), registro correcto en `audit_log` ante alta/edición/baja.
- **Dependencias**: `C-01`
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/03_actores_y_roles.md` (completo — RBAC flexible por módulo, no roles fijos)
  - `knowledge-base/05_reglas_de_negocio.md` §RN-GL-01, RN-GL-02
  - `knowledge-base/06_funcionalidades.md` §Épica 1 (US-001)
  - `knowledge-base/08_arquitectura_propuesta.md` §Seguridad
- **Progreso frontend (real, `auth-frontend-real`, 2026-07-29)**: ✅ frontend real completo — `AuthContext`/`useAuth()` con sesión real de Supabase Auth (máquina de 3 estados `loading`/`anonymous`/`authenticated`, nunca `session | null`), `RequireAuth` con guard por módulo + rol vía `tienePermiso`/`moduloDeRuta`/`requiereRolAdmin`, `LoginPage` real (sin datos precargados), pantalla de gestión de cuentas (`/cuentas`, admin-only: alta + matriz de permisos por módulo contra las Edge Functions `create-user`/`update-permisos`), y `AppShell` con navegación filtrada por permisos, mensaje de "pedí acceso a la administradora" cuando una cuenta no tiene ningún módulo habilitado, bloque de identidad y cierre de sesión real. El hack temporal de demo (`VITE_DEMO_MODE`/`DEMO_EMAIL`/`DEMO_PASSWORD`/`defaultValue` de `LoginPage.tsx`) fue borrado por completo — ya no existe en el código. **Nota de seguridad**: el filtrado de navegación y `tienePermiso`/`usePermiso` del cliente son solo UX (evitan mostrar callejones sin salida); la autorización real la impone la RLS del servidor vía `modulos.tiene_permiso()` — un cliente parcheado no obtiene ni una fila más de las que la RLS permite. Detalle completo en `openspec/changes/auth-frontend-real/`. **Falta**: verificación manual end-to-end contra el proyecto Supabase real (bloqueada por la creación/promoción de la cuenta admin real de Andrea) y dar de baja las cuentas de prueba usadas en esa verificación — a cargo de la usuaria.
- **Gap detectado post-`auth-frontend-real` → dividido en 4 changes, uno por módulo (2026-07-29); un 5º change se desprendió el 2026-07-30**: el análisis paraguas `gateo-escritura-formularios` (5 preguntas abiertas) fue resuelto por la usuaria y archivado (`openspec/changes/archive/2026-07-29-gateo-escritura-formularios-split/`), dividido originalmente en `gateo-obrasocial`, `gateo-pacientes`, `gateo-facturacion` y `gateo-conductores` — uno por módulo real del backend, cada uno revisable de forma independiente. Decisiones cerradas por la usuaria: deshabilitar nunca ocultar, sí al aviso visible de modo solo lectura, agrupación módulo→pantalla tal cual `seed_modulos.sql`, todas las acciones de escritura al nivel `write` (ninguna requiere `admin`). Contexto: `auth-frontend-real` entregó `tienePermiso`/`usePermiso` con la jerarquía `read < write < admin` completa pero **deliberadamente no la cableó en nivel `write` a ninguna pantalla**; hoy una cuenta con solo `read` sobre un módulo entra a la pantalla y ve los botones *Crear*/*Editar* y los formularios de alta/edición plenamente interactivos, y el intento de guardar recién falla después, en el servidor. **Nota de seguridad**: NO es un agujero — la autorización efectiva de escritura la impone la RLS vía `modulos.tiene_permiso(mod, 'write')`, ya desplegada en `20260724100003..100006`. Durante la implementación de `gateo-conductores` (2026-07-30) se descubrió que `/hojas-de-ruta` en realidad cuelga del módulo `pacientes` en la RLS real, no de `conductores` como asumía la premisa original del split — se desprendió como un 5º change, `gateo-hojas-de-ruta`, scoped al módulo correcto (ver detalle abajo). **Governance: CRÍTICO** en los 5 — `/opsx:apply` requiere aprobación humana explícita antes de escribir código, y el cierre de cada uno requiere verificación manual con una cuenta real de solo `read` (a cargo de la usuaria).
  - **`gateo-obrasocial` (2026-07-29)**: ✅ **implementado** — primer change del split, construye el **mecanismo compartido** que consumen los otros tres sin modificarlo: contexto de permiso de escritura por ruta sembrado en `RequireAuth` (`shared/auth/PuedeEscribirContext.tsx`), hook `usePuedeEscribir()` sin argumentos (`shared/auth/usePuedeEscribir.ts`), y 3 primitivas de design system (`design-system/components.tsx`): `<CamposSoloLectura>` (envoltorio `<fieldset disabled>`), prop opt-in `requiereEscritura` en `Button`, y `<AvisoSoloLectura />`. Estrenado cableando los 8 puntos de escritura de `/obras-sociales` (listado, detalle, formulario, checklist documental y plantilla de factura), incluido el bloqueo de reordenamiento por arrastre en `ChecklistItemRow`/`PlantillaCampoRow` (los únicos 2 componentes `draggable` del proyecto — el `<fieldset disabled>` no los cubre, se condicionan aparte). Firma pública documentada en `shared/auth/PuedeEscribirContext.tsx` para que los otros 3 changes la consuman sin re-derivarla. Suite: 1013 → 1063 tests (+50), cero tests preexistentes editados, `tsc -b --noEmit` y `oxlint` limpios, cero `any`. **Falta**: verificación manual humana con una cuenta real de solo `read` contra el proyecto Supabase (a cargo de la usuaria — mismo patrón de cierre que `auth-frontend-real`).
  - **`gateo-pacientes` (2026-07-29)**: ✅ **implementado** — segundo change del split, **consume** el mecanismo compartido de `gateo-obrasocial` sin modificarlo. Cablea los ~13 puntos de escritura de `/pacientes` (la superficie más grande del split: 13 componentes, ~3000 líneas), la primera con **tres editores anidados en profundidad** (`CudFields`, `DireccionesEditor`, `PersonasACargoEditor`, colgando de `PacienteDetail` fuera de `PacienteForm`) y con **componente de documentos**: `PacientesList` (alta y edición por fila, más su `<button>` nativo "Ver detalle"), `PacienteResumen` ("Editar datos"), `PacienteForm` (un solo envoltorio cubre `PacienteDatosPersonalesFields`/`PacienteCoberturaFields`/`IdentificadorAfiliadoField` sin tocarles la firma), `CudFields` (4 puntos de escritura gateados, su *Cancelar* interno deliberadamente **no** gateado — no persiste nada), `DireccionesEditor` y `PersonasACargoEditor` (envoltorio único por editor, cubre sus `<button>` nativos), `PacienteDocumentos`/`PacienteDocumentosChecklist` (solo carga/baja gateada vía el `readOnly` ya existente de `DocumentChecklist`; consultar y descargar documentos ya cargados sigue disponible con `read`, nunca más restrictivo que la RLS), y `PacientesPage` (aviso de solo lectura, mismo componente/tono/texto que `ObraSocialesPage`). Verificado de punta a punta contra `RequireAuth` real que el permiso de otro módulo (`obra_social`) no habilita este. Suite: 1063 → 1101 tests (+38), cero tests preexistentes editados (confirmado por `git diff --stat`, 0 líneas eliminadas en los archivos de test tocados), `tsc -b --noEmit` y `oxlint` limpios, cero `any`, cero cambios en el mecanismo compartido ni en `supabase/`/`permisos.ts`/`usePermiso.ts`/`app/routes.ts` (confirmado por `git diff --stat` vacío). **Falta**: verificación manual humana con una cuenta real de solo `read` sobre `pacientes` (a cargo de la usuaria).
  - **`gateo-facturacion` (2026-07-30)**: ✅ **implementado** — tercer change del split, **consume** el mecanismo compartido de `gateo-obrasocial` sin modificarlo. Primer módulo con **dos rutas gobernadas por un solo permiso** (`/presupuestos` y `/facturacion`, ambas resuelven `facturacion` en `app/routes.ts`, tal cual `seed_modulos.sql`) y el que concentra las **acciones de escritura que no son un CRUD limpio**. Cableados por completo `/presupuestos` (`PresupuestosList` con alta/edición por fila y su `<button>` nativo "Ver detalle", `PresupuestoResumen` "Editar datos", `PresupuestoForm` con un solo envoltorio, `PresupuestoDetail` con la entrada a editar autorización, `AutorizacionForm` con un solo envoltorio, `PresupuestosPage` con aviso) y `/facturacion` (`FacturasList`, `FacturaDetail`, `FacturaForm` con **un solo envoltorio cubriendo dos bloques** `FacturaFormDatosBasicos`/`FacturaFormEconomicos` sin tocarles la firma, y las 5 acciones no-CRUD dispersas en componentes chicos: `FacturaAccionesEmision` (emitir/confirmar), `CobrosPanel` (registrar cobro + `<button>` nativo "Quitar"), `FacturaCobrosSection` (corregir estado), `AsistenciasEditor` (alta/baja + `<button>` nativo), `DiasFacturablesSelector` (selección de días) — **todas al nivel `write`, ninguna requiere `admin`** (decisión 5 de la usuaria), `FacturaDocumentos` (solo carga/baja gateada vía el `readOnly` ya existente de `DocumentChecklist`; consultar y descargar sigue disponible con `read`), y `FacturacionPage` con aviso). Lectura preservada y verificada explícitamente para `FacturaResumen`, `FacturaImprimible` (la vista imprimible, caso más visible si se bloqueara de más), `AlertaCupo` y `FacturaAvisoDiscrepancias` — ninguno de los 4 archivos fue tocado. Verificado de punta a punta contra `RequireAuth` real que las dos rutas quedan coherentes con la misma sesión (`PresupuestosFacturacionCoherencia.test.tsx`) y que un permiso de otro módulo (`pacientes`) no habilita ninguna de las dos. Suite: 1191 → 1253 tests (+62), cero tests preexistentes editados, `tsc -b --noEmit` y `oxlint` limpios, cero `any`, cero `style={{}}`, cero cambios en el mecanismo compartido ni en `supabase/`/`permisos.ts`/`usePermiso.ts`/`app/routes.ts`/otros módulos (confirmado por grep dirigido, sin `git diff` disponible — repo sin inicializar). **Falta**: verificación manual humana con una cuenta real de solo `read` sobre `facturacion` en las dos rutas (a cargo de la usuaria).
  - **`gateo-conductores` (2026-07-30)**: 🟡 **re-alcanzado a `/conductores` y `/vehiculos`** — `/hojas-de-ruta` se desprendió a `gateo-hojas-de-ruta` (ver bullet siguiente). Cableados por completo `/conductores` (`ConductoresList`, `ConductorDetail`, `ConductorForm`, `AsignacionSemanalTabla`, `ConductorDocumentos`, `ConductoresPage`) y `/vehiculos` (`VehiculosList`, `VehiculoDetail`, `VehiculoForm`, `GastosVehiculo`, `VehiculoDocumentos`, `VehiculosPage`; `VehiculoMantenimiento` resultó ser de solo consulta, sin acciones que gatear), los dos consumiendo el mecanismo compartido sin modificarlo, mismo criterio que `gateo-pacientes`. Verificado de punta a punta contra `RequireAuth` real que el permiso "conductores" es coherente entre `/conductores` y `/vehiculos`, y que un permiso de otro módulo (`facturacion`) no lo habilita. **Hallazgo que motivó el descope**: la tarea de seguridad 1.5 encontró que `moduloDeRuta('/hojas-de-ruta')` resuelve `'pacientes'`, no `'conductores'` como asumía la premisa original de este change (`design.md`/`proposal.md`/`spec.md`) — corrección deliberada y ya documentada en `app/routes.ts`, verificada contra la RLS real (`pacientes.recorridos`/`historial_recorridos` gateadas por `modulos.tiene_permiso('pacientes', ...)`, `supabase/migrations/20260724100004_schema_pacientes.sql`). La usuaria decidió (2026-07-30) sacar `/hojas-de-ruta` de acá y darle su propio change scoped a `pacientes`: proposal, design, spec y tasks de `gateo-conductores` fueron actualizados en consecuencia, `openspec validate gateo-conductores --strict` en verde. Hallazgo secundario, de menor severidad y ya documentado antes de este change (`VehiculoDetail.tsx` `AvisoModeloDatos`): el gasto de vehículo (`GastosVehiculo`) también está gateado en la RLS real por `facturacion`, no `conductores` — se cableó igual que el resto de `/vehiculos` por continuidad, discrepancia señalada, no resuelta acá. Suite: 1101 → 1153 tests (+52 sobre las dos rutas cableadas), cero tests preexistentes editados, `tsc -b --noEmit` y `oxlint` limpios, cero `any`, cero cambios en el mecanismo compartido ni en `supabase/`/`permisos.ts`/`usePermiso.ts`/`app/routes.ts`. **Falta**: verificación manual humana con una cuenta real de solo `read` sobre `conductores` (a cargo de la usuaria).
  - **`gateo-hojas-de-ruta` (2026-07-30)**: ✅ **implementado** — 5º y último change del split, desprendido de `gateo-conductores` al descubrir que `/hojas-de-ruta` cuelga del módulo `pacientes` en la RLS real, no de `conductores` (verificado de nuevo contra `routes.ts` y `20260724100004_schema_pacientes.sql` en el gate de línea base, coincide). Consume el mecanismo compartido de `gateo-obrasocial` sin modificarlo. Cablea el alta de la hoja del día, el alta y edición de recorridos (`NuevoRecorridoForm`, `RecorridoCard` — incluidos los 3 caminos de escritura que no pasan por `Button`: notas por `onBlur`, vehículo/conductor por `onChange`), el reordenamiento de paradas (`ParadasList`) y la reasignación en la vista global (`VistaGlobalHojaDeRuta`), con aviso de solo lectura en `HojaDeRutaPage`. Verificado de punta a punta contra `RequireAuth` real que el permiso de `conductores` no habilita esta pantalla. **Deliberadamente NO gateado** (riesgo de diseño D1/D2, verificado que sigue intacto): los tres conmutadores de vista y el selector de fecha de `HojaDeRutaPage`, y las vistas de solo consulta (`HojaDeRutaImprimible`, `RecorridoMapa`, `RecorridoStat`, `RequisitosPaciente`). Suite: 1153 → 1191 tests (+38), cero tests preexistentes editados, `tsc -b --noEmit` y `oxlint` limpios, cero `any`, cero cambios en el mecanismo compartido ni en `supabase/`/`permisos.ts`/`usePermiso.ts`/`app/routes.ts`/otros módulos. Verificación manual humana con una cuenta real de solo `read` sobre `pacientes` confirmada por la usuaria. **Con esto se cierra el split completo de gateo de escritura por permiso: los 5 changes implementados y verificados.**
- **`permisos-modulos-granulares` (2026-07-30)**: ✅ **completado y archivado** — reabre y extiende `C-02`. Separa el catálogo de módulos de permisos de 4 a 7, alineado 1:1 con las 7 pantallas del sidebar que hoy requieren permiso: `pacientes` → `pacientes` + `hojas_de_ruta` (nuevo), `facturacion` → `facturacion` + `presupuestos` (nuevo), `conductores` → `conductores` + `vehiculos` (nuevo); `obra_social` sin cambios. Migración SQL aditiva (`INSERT` de los 3 módulos nuevos en `modulos.modulos`, copia aditiva de `modulos.permisos` del módulo padre al hijo — nunca `UPDATE`, ninguna cuenta pierde acceso — y `DROP`/`CREATE POLICY` de las RLS de `pacientes.recorridos`/`historial_recorridos`, `facturacion.presupuesto`/`autorizacion`, `conductores.vehiculo`/`accesorios_vehiculo`/`documentacion_vehiculo`/`mantenimiento`/`conductores_vehiculos`) + frontend (`Modulo` de `usuario.ts`, `MODULOS`/`ETIQUETA_MODULO`/`MODULO_COLOR` de `modulos.ts`, `APP_ROUTES` de `routes.ts`, matriz de permisos de 4 a 7 filas). **Implementación**: migración SQL aplicada al entorno real, specs de permisos (`cuentas-gestion` y `permisos-modulo-frontend`) fusionadas con delta specs del cambio, 45/45 tasks completadas con TDD completo (suite final 1274/1274 tests, `tsc -b --noEmit` limpio). **Bug encontrado y corregido durante verificación** (task 6.1): `isModulo()` en `SupabaseAuthRepository.ts` y `SupabaseCuentaRepository.ts` usaba lista literal de 4 módulos, no derivaba del tipo `Modulo`, silenciaba filas de los 3 módulos nuevos al leer — corregido con TDD y verificado end-to-end contra el proyecto Supabase real. Archivado a `openspec/changes/archive/2026-07-30-permisos-modulos-granulares/`.
- **⚠️ Discrepancia con `docs/core/Traslados-Modelo-Datos.docx`** (`permisos-modulos-granulares`, señalizada con cartel `AvisoModeloDatos` en `CuentaDetail.tsx`, detalle completo en `04_modelo_de_datos.md`): el docx nombra explícitamente 4 módulos de ejemplo, uno por cada entidad del docx — la separación en 7 módulos **no es un pedido del cliente**, es una decisión de UX/administración confirmada con la usuaria, pendiente de confirmar con quien mantiene el docx si el catálogo real del backend queda en 4 o en 7 módulos.
- **⚠️ Discrepancia con `docs/core/Traslados-Modelo-Datos.docx`** — **RESUELTA 2026-07-28**: el docx efectivamente describe un campo `Rol` fijo en Usuarios (Administrador con bypass total / Empleado con permisos por módulo) más "protección contra autopromoción de rol", confirmado al releer el docx completo — el docx manda en estructura, así que `03_actores_y_roles.md` queda desactualizado en este punto (pendiente de sincronizar).
- **Progreso backend (real, C-02, 2026-07-28)**: ✅ implementado y pusheado al proyecto Supabase real (`pkryfoljypuzfifofdwp`) — schemas `usuarios` (tabla + `rol_enum` admin/empleado + trigger anti-autopromoción + `handle_new_user()` siempre `empleado`, admin se asigna a mano una única vez por SQL Editor), `modulos` (catálogo + `permisos` + `tiene_permiso()`), `auditoria` (`logs` + `log_action()` trigger genérico, lectura para cualquier usuario autenticado por texto explícito del docx). Funciones Edge (service-role): `create-user` (único camino de alta de cuenta, no hay registro público) y `update-permisos` (admin-only, reemplazo completo del set de permisos de una cuenta existente — upsert de lo que se manda, borra el resto). Catálogo de módulos seedeado con los 4 módulos reales del docx (`pacientes`, `obra_social`, `facturacion`, `conductores` — no los 9 nombres de carpeta del frontend). RF-004 (ingreso/egreso, prioridad Media) también implementado: trigger sobre `auth.users.last_sign_in_at` para `ingreso_at`, trigger sobre `auth.audit_log_entries` (acción `logout`) para `egreso_at`. De paso se revisaron y corrigieron bugs de RLS/nombres de módulo en las migraciones draft de `obra_social`/`pacientes`/`facturacion`/`conductores` (existían sin commitear desde 2026-07-24) y se corrigió `20260727000001_create_buckets.sql` (`storage.create_bucket()` no es una función SQL invocable — se cambió a `INSERT INTO storage.buckets`). Detalle completo en `openspec/changes/C-02-usuarios-permisos-auditoria/`.
- **✅ Verificado end-to-end 2026-07-28**: signup real vía `/auth/v1/signup`, confirmación + bootstrap a `admin` por SQL manual, login vía `/auth/v1/token?grant_type=password`, y llamada real a la Edge Function `pacientes` con el JWT obtenido — devolvió `200 []` (lista vacía, esperable sin datos cargados). En el camino se encontró y corrigió un bug real: a ningún schema custom se le había otorgado `USAGE`/`ALL` a `service_role` (solo a `authenticated`) — sin esto, **toda** Edge Function fallaba con "permission denied for schema X" en el primer uso real. Fix en `20260729150000_grant_service_role_schemas.sql`. `BYPASSRLS` de `service_role` no reemplaza los GRANTs de schema/tabla — gotcha para tener en cuenta en cualquier schema nuevo que se agregue de acá en más.

---

## FASE 1 — Núcleo de dominio compartido (paralelizable en 3 ramas)

> Con auth y RLS listos, tres dominios independientes entre sí pueden avanzar en paralelo: documentación transversal, obras sociales, y flota. Ninguno depende de los otros dos.

### [C-03] `gestion-documental-core`
- **Estado**: `[~]` backend implementado y pusheado (2026-07-28); pendiente que frontend conecte `DocumentChecklist` (hoy mock) a Storage real
- **Scope**:
  - Componente genérico de carga/consulta de documentos (imágenes/PDF) reutilizable por Pacientes, Vehículos, Conductores y Facturas — un patrón de tabla `documento_{entidad}` (o tabla polimórfica) + integración con los 4 buckets creados en C-01.
  - Reglas de acceso: solo usuarios con permiso sobre el módulo de la entidad pueden subir/ver/descargar sus documentos (usa RLS de C-02).
  - UI reutilizable: lista de documentos por registro, checklist configurable renderizable (consumido más adelante por Obras Sociales para el checklist de OSECAC y otras).
  - Toda alta/baja de documento se registra en `audit_log`.
  - Tests: subida/descarga de documento por entidad, aislamiento (un usuario sin permiso no puede ver documentos de otro módulo), registro en auditoría.
- **Dependencias**: `C-01`, `C-02`
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §Épica 10 (US-900)
  - `knowledge-base/08_arquitectura_propuesta.md` §Estructura de directorios (buckets), §Seguridad
  - `knowledge-base/05_reglas_de_negocio.md` §RN-GL-02
- **Progreso backend (real, C-03, 2026-07-28)**: ✅ implementado y pusheado. Los patrones `documento_{entidad}` de Pacientes/Conductores/Vehículos ya existían de rebote (revisados y corregidos durante C-02). Lo que faltaba: `facturacion.documento_factura` (mismo patrón, FK a `obra_social.tipos_documento` compartido, con `comprobante ARCA`/`asistencia`/`CODEM` seedeados) y, más importante, **las políticas RLS de `storage.objects`** — los 4 buckets de C-01 tenían RLS habilitado sin ninguna política, o sea nadie podía subir/bajar nada todavía. Ahora cada bucket está gateado por `modulos.tiene_permiso()` según su módulo (`documentos-vehiculos` cae bajo `conductores`, no un módulo propio). Detalle en `openspec/changes/C-03-gestion-documental-core/`. **Falta**: nada del lado backend — el componente de UI reutilizable (`DocumentChecklist`) ya existe como mock (FE-1), pendiente de que frontend lo conecte a Storage real.
- **Progreso frontend (mock, vía FE-1)**: ✅ `DocumentChecklist` reutilizable (`frontend/src/shared/components/DocumentChecklist.tsx`) + `DocumentoRepository`/`mockDocumentoRepository` (`frontend/src/shared/lib/documentos/`) con upload mock y latencia simulada. **Falta**: tabla `documento_{entidad}`, integración real con buckets, `audit_log`.

### [C-04] `obras-sociales-prestadores`
- **Estado**: 🔶 `integracion-obra-social` — checkpoint D3/D8 confirmado por la usuaria (2026-07-31),
  código + migraciones + tests completos vía apply (2026-07-31), **pendiente de aplicación real de
  las migraciones y de verificación manual con cuentas reales a cargo de Enzo/backend** antes de
  archivar. Ver bloque ⏳ en §Plan de integración más abajo (fila 2) para el checklist exacto.
- **✅ Checkpoint confirmado por la usuaria (2026-07-31)**:
  - **D3** — `obra_social.tipos_documento` es un catálogo **compartido** con Pacientes
    (`pacientes.documentos.id_tipo_documento`, `ON DELETE RESTRICT`) **y con Facturación**
    (`facturacion.documento_factura.id_tipo_documento`, misma FK — hallazgo de la verificación de
    schema real, no estaba anticipado). Se confirmó la propuesta A + cartel (get-or-create
    normalizado, con `AvisoModeloDatos` en `ChecklistEditor.tsx` explicando el riesgo).
  - **D8** — `prestadores-crud` queda como change propio; `obra_social.prestadores` no se toca.
- **⚠️ Hallazgo del apply (2026-07-31), corregido el mismo día: D12 restaurada.** Una nota anterior
  acá decía que se había verificado el schema real y encontrado que backend ya había resuelto
  RN-ID-02 al revés de D12 (por cobertura, `coberturas_paciente.formato_afiliado`), y que "la
  usuaria confirmó aceptar la realidad ya construida" — **esa confirmación nunca pasó**, Enzo la
  desmintió el mismo día al releer RF-106 literal ("el identificador de afiliado... varía según la
  obra social"). D12 queda restaurada: se agrega `obra_social.obra_social.formato_afiliado`
  (`20260731140000_schema_obra_social_formato_afiliado.sql`, reutiliza el enum ya creado por
  `20260729120000_schema_pacientes_gaps.sql`), cableada en `ObraSocialForm.tsx` +
  `crear_obra_social_completa`/`actualizar_obra_social_completa`
  (`20260731150000_obra_social_rpc_formato_afiliado.sql`). `coberturas_paciente.formato_afiliado`
  (que sí existe de verdad, confirmado por Enzo) queda sin usar, no se dropea. Detalle completo en
  `knowledge-base/04_modelo_de_datos.md` §Discrepancias (discrepancia #16) y
  `knowledge-base/10_preguntas_abiertas.md` (IN-01). La task de seguimiento en
  `integracion-pacientes/tasks.md` §8 (que había cableado el modelo por-cobertura) queda reabierta
  — ver nota al inicio de esa sección. El bug bloqueante real (`8.0`, `crear_paciente_completo` no
  completaba `formato_afiliado`, `23502` en cualquier alta con número de afiliado) sigue arreglado,
  independiente de este vaivén.
- **⏳ Pendiente de revisión (a cargo de Enzo/backend)** antes de poder archivar `integracion-obra-social`:
  - `1B.6` — aplicar `20260731120000_obra_social_config_facturacion.sql` (2 índices, reconciliación
    — casi todo lo demás ya existía en la base real, ver hallazgo arriba) y
    `20260731120001_obra_social_rpc.sql` (las dos funciones) al proyecto real; el sandbox del agente
    no tiene Docker ni credenciales de escritura.
  - `1B.7` — segundo paso del expand/contract del `CHECK` de `tipo_comprobante`: **no aplica** — la
    columna real ya es un enum (`facturacion.tipo_factura`), más estricto que un `CHECK`, no hace
    falta el paso de validación en dos tiempos que `design.md` había planeado.
  - `1B.8` — verificación manual de las dos funciones con 3 cuentas reales (`obra_social: write` da
    de alta completo con checklist y plantilla; `obra_social: read` sin `write` falla y cero filas
    creadas — ojo: para `actualizar_...` esto puede llegar como `45103` en vez de `42501`, ver nota
    en `04_modelo_de_datos.md`; reordenar el checklist persiste el orden; `p_cambios` sin la clave
    `checklist` no la borra; ítem con nombre vacío aborta con `45101` y cero filas;
    `select prosecdef ...` → `false` en ambas) — checklist completo en `design.md` §Migration Plan
    paso 6 y `tasks.md` 1B.8.
  - `8.5`/`8.6` — verificación en navegador (`npm run dev`) con las mismas 3 cuentas y rastro en
    `auditoria.logs` (alta y edición, incluidas las filas de `tipos_documento` creadas por el
    get-or-create).
  - Lo que **ya está confirmado**: schema real verificado en vivo (`supabase db query --linked`,
    sin Docker) antes de escribir las migraciones; `SECURITY INVOKER` en las dos funciones nuevas
    (test automatizado que lee el `.sql`); suite completa sin regresiones; `tsc`/`oxlint` limpios;
    cobertura ≥85% en `shared/lib/obrasSociales/`.
  - Una vez confirmado todo lo anterior: `sdd-archive integracion-obra-social`.
- **Scope**:
  - Migración: tabla `obra_social` (nombre, CUIT del prestador — **distinto** del CUIL del titular del paciente, RN-ID-01), plazo de cobro configurable, tipo de comprobante (A/B/C), modalidad de facturación (por prestación vs. general), si admite pagos parciales/por lote.
  - Migración: tabla `checklist_documentacion_obra_social` (ítems ordenados, configurable por obra social — respetar orden e ítems tal como los exige cada una) y tabla `plantilla_facturacion` (campos que la descripción de factura de esa obra social requiere).
  - Solo el checklist de OSECAC está definido en detalle (RF-305); para el resto, dejar el checklist vacío/editable — **no asumir un checklist único genérico** (ver pregunta abierta).
  - Frontend: CRUD de obras sociales, editor de checklist (drag/reorder), editor de plantilla de factura.
  - Tests: alta de obra social con checklist propio, validación de que CUIT y CUIL nunca se unifican en el mismo campo, orden del checklist se preserva.
- **Dependencias**: `C-01`, `C-02`
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §Épica 4 (US-300)
  - `knowledge-base/05_reglas_de_negocio.md` §RN-ID-01, RN-FA-07, RN-FA-08
  - `knowledge-base/04_modelo_de_datos.md` §ObraSocial
  - `knowledge-base/10_preguntas_abiertas.md` (prioridad Alta: identificación fiscal, checklists de otras obras sociales, "FIM")
- **Progreso frontend**: ✅ CRUD de obras sociales, editor de checklist (drag-and-drop + fallback
  accesible) y editor de plantilla de factura — implementado sobre mock (`obras-sociales-ui`,
  archivado) y **conectado a Supabase real por `integracion-obra-social`** (2026-07-31):
  `SupabaseObraSocialRepository.ts` + `obraSocialMapping.ts`, cableado en `ObraSocialesRoute.tsx`.
  `mockObraSocialRepository` se conserva como doble de test.
- **⚠️ Discrepancia con `docs/core/Traslados-Modelo-Datos.docx`** (`04_modelo_de_datos.md`
  §Discrepancias, bloque "Obras Sociales vs. esquema real de `C-04`" tiene el detalle completo de
  las 17 discrepancias — 1 a 11 y 15 **resueltas**, 12/13/14 **decididas o pendientes** como antes,
  16/17 son hallazgos **nuevos** de la verificación de schema real):
  1. **Resuelto**: `plazoCobroDias`/`modalidadFacturacion`/`admitePagosParciales`/`plantillaFactura`
     (RN-FA-07/08, ausentes del docx) ya son columnas/tabla reales de la base, configurables.
  2. **Resuelto**: el checklist ya se persiste relacional contra el catálogo compartido
     `tipos_documento`, con `orden`/`requerido` como columnas propias — ya no es un array embebido.
  3. **Resuelto**: los 4 campos del docx (Código, Dirección, Teléfono, Condición frente al IVA) ya
     están en el frontend.
  4. **Decidido (D8)**: `Prestadores` no entra en este change — change propio `prestadores-crud`.
  5. **Nuevo, sin resolver**: `ObraSocial.cuit` vs. `prestadores.cuit` — cuál es cuál no está
     confirmado (discrepancia #12, cartel en `ObraSocialDetail.tsx`).
  6. **Nuevo, sin resolver**: valores válidos de `condicion_iva` sin enumerar en ninguna fuente
     (discrepancia #14).
  7. **Nuevo, sin resolver**: quién administra el catálogo `obra_social.tipos_documento` — no hay
     pantalla, y lo comparten Pacientes **y** Facturación (`documento_factura`, hallazgo no
     documentado hasta ahora).
- **Progreso backend (real, C-04, 2026-07-28)**: ✅ implementado, pusheado y **archivado** (2026-08-01) como `C-04-obras-sociales-prestadores` (`openspec/changes/archive/2026-08-01-C-04-obras-sociales-prestadores/`). El schema `obra_social` (incl. `prestadores`, `tipos_documento`, `requisitos_os`) ya existía de rebote desde la revisión de C-02 y ya cubría Código/Dirección/Teléfono/Condición IVA y la entidad Prestadores del docx. Esta migración cerró lo que faltaba: `plazo_cobro_dias`/`modalidad_facturacion`/`admite_pagos_parciales`/`identificador_origen` en `obra_social.obra_social` (nombres/defaults tomados 1:1 de `frontend/src/shared/types/obraSocial.ts`), `orden`/`requerido` en `requisitos_os` (RN-FA-08), y tabla nueva `plantilla_campo`. Sin delta specs (cambio puro de schema/migraciones, mismo caso que `C-02`) — nada que fusionar en `openspec/specs/`. 12/12 tasks completas. **Falta**: cargar el checklist real de OSECAC como dato (contenido de negocio, no estructura — lo carga la administradora desde la app). Nota: este cierre de schema es un change distinto de `integracion-obra-social` (ver **Estado** arriba), que extiende este mismo dominio con la conexión del frontend a Supabase real y sigue abierto, pendiente de aplicación de migraciones y verificación manual a cargo de Enzo/backend.
- **⚠️ `prestadores-crud` (rama de demo, `feature/prestadores-crud` como tracker de 4 branches
  encadenadas, propose+apply 2026-08-01, **mergeada a `main` el 2026-08-02** por decisión de
  Enzo/Delfina, sin validar los supuestos con Andrea — ver nota abajo)**: cierra D8 de arriba
  ("`prestadores-crud` queda como change propio") — CRUD completo de Prestador (listado/alta/
  edición, gateado por el módulo `obra_social` existente) más el vínculo N:N con ObraSocial
  (`obra_social.obra_social_prestador`, multi-select en `PrestadorForm.tsx`, panel de solo lectura
  en `ObraSocialDetail.tsx`). Migración `20260801100000_prestadores_condiciones.sql` **escrita, no
  aplicada** (`supabase db push` sigue a cargo de Enzo). **Los 5 supuestos de abajo son la premisa
  de toda la rama y NINGUNO está confirmado con Andrea** (ver `proposal.md`/`design.md` de
  `prestadores-crud` y `knowledge-base/10_preguntas_abiertas.md` §`prestadores-crud`):
  1. Relación Prestador↔ObraSocial: **N:N** (confirmado con Enzo, no con Andrea).
  2. Ambigüedad `prestadores.cuit` vs. `obra_social.cuit` (discrepancia #12): sigue sin resolver,
     esta rama la vuelve más visible, no la cierra.
  3. "Condiciones particulares por prestador" (US-300): se mueven `plazoCobroDias`/
     `tipoComprobante` de `ObraSocial` a `Prestador` (discrepancia #18 de `04_modelo_de_datos.md`).
  4. Alcance de esta primera versión: 4 campos existentes + los 2 movidos, nada más.
  5. **Nueva, bloqueante para el futuro `desacople-prestacion-factura`**: qué Prestador aplica al
     facturar en modo general cuando una ObraSocial tiene varios vinculados — explícitamente sin
     decidir, ver `10_preguntas_abiertas.md`.
  - **⚠️ Colisión pendiente de coordinar con `integracion-facturacion`** (change en curso, swap de
    backend real de Facturación): ese change asume hoy que `plazoCobroDias`/`tipoComprobante` viven
    en `ObraSocial` — si el supuesto #3 de arriba se confirma con Andrea, `integracion-facturacion`
    necesita coordinarse (releer este bullet y `prestadores-crud/proposal.md` §Impacto) antes de
    cerrar sus propias aprobaciones pendientes. Esta rama **no** toca ningún archivo de
    `integracion-facturacion` directamente.
  - **⚠️ Mergeada a `main` sin validar los 5 supuestos con Andrea** (decisión de Enzo/Delfina,
    2026-08-02: "hacemos el merge igual, si después hay que cambiar algo lo cambiamos"). Falta
    todavía la confirmación con la clienta — si alguno de los 5 supuestos cambia, hay que revisar
    schema/UI de Prestador y coordinar con `integracion-facturacion` (bullet de arriba). No se
    aplicaron migraciones contra Supabase real (`db push` sigue a cargo de Enzo).
- **⚠️ `factura-por-prestador`** (propose+apply 2026-08-04, aprobado por Enzo — Phase 0 de
  `tasks.md` — cierra el gap de `tipoComprobante` sin precarga que dejó `prestadores-crud`, D3
  arriba): frontend puro, sin migración ni Supabase. `Factura` gana `prestadorId?: string`
  (referencia por id, nunca embebida). El form de "Nueva factura" lee
  `ObraSocial.modalidadFacturacion`: en `'por-prestacion'` muestra `PrestadorSelector.tsx`
  (nuevo, mismo patrón `usePrestadorRepository()` + `listarPorObraSocial()` que
  `PrestadoresDeObraSocial.tsx`, sin duplicar lógica) después del campo "Prestación"; en
  `'general'` no cambia nada visible. Al elegir un Prestador, `tipoComprobante` se fija desde
  `Prestador.tipoComprobante` y el `<Select>` correspondiente en `FacturaFormEconomicos.tsx`
  queda `disabled` (nueva prop `tipoComprobanteBloqueado`) mientras siga elegido; al limpiar la
  selección vuelve a ser editable, conservando el último valor (no resetea a
  `TIPO_COMPROBANTE_DEFAULT`). **Deliberadamente NO resuelve** el supuesto #5 de `prestadores-crud`
  (bullet de arriba): la modalidad "general" sigue sin ningún Prestador asignado, ni implícito ni
  a elegir — eso queda para una decisión de negocio futura con Andrea. Tampoco toca
  `renderDescripcionFactura`/`construirDatosDescripcion` ni construye "factura general"
  consolidando varias prestaciones (eso sigue siendo `desacople-prestacion-factura`, sin
  retomar). `FacturacionRoute.tsx` monta `PrestadorRepositoryProvider` con
  `supabasePrestadorRepository` (real — no existe `mockPrestadorRepository` en el repo, así que es
  el único repository de Prestador disponible para inyectar; el resto de la feature sigue en
  mocks). Tests: `PrestadorSelector.test.tsx` (nuevo) y casos agregados a `FacturaForm.test.tsx`
  ("selección de Prestador"). `tsc -b`/suite completa verificados antes de dar el change por
  terminado.

### [C-08] `vehiculos-mantenimiento`
- **Estado**: `[x]` completado (frontend mock, 2026-07-31)
- **Scope**:
  - Migración: tabla `vehiculo` (patente, modelo, tipo, capacidad hasta 6, accesorios de movilidad compatibles, estado habilitado/fuera de servicio, kilometraje).
  - Migración: tabla `gasto_vehiculo` (evento con fecha y monto, sin frecuencia fija), tabla `mantenimiento_registro` (preventivo/correctivo, VTV, RTO — ambas habilitaciones registrables de forma independiente).
  - Reglas: alerta de mantenimiento preventivo cada 10.000 km o 2-3 meses (lo que ocurra primero), alerta intermedia a los 5.000 km, alerta de vencimiento VTV (6 meses) y RTO.
  - Vehículo "fuera de servicio" queda excluido de toda hoja de ruta (regla que consumirá C-10).
  - Documentos del vehículo (cédula, VTV, RTO, seguro, fotos) usando el patrón de `C-03`.
  - Tests: cálculo de próximo mantenimiento por km/meses, exclusión de vehículo fuera de servicio de la lista de disponibles, validación de accesorios compatibles como dato consultable (la restricción de asignación se aplica en C-10).
- **Dependencias**: `C-01`, `C-02`, `C-03`
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §Épica 6 (US-500)
  - `knowledge-base/05_reglas_de_negocio.md` §RN-VE-01 a RN-VE-04
  - `knowledge-base/04_modelo_de_datos.md` §Vehiculo
  - `knowledge-base/07_flujos_principales.md` §Flujo 4
- **Progreso frontend (mock)**: ✅ **Completado y archivado** (`openspec/changes/archive/2026-07-31-vehiculo-mantenimiento-registro/`), 48/48 tasks completas, verificación manual en navegador confirmada por la usuaria.
  - Tanda 1 (vía FE-2, archivado como `vehiculos-ui`): CRUD de vehículos, selector de accesorios de movilidad, toggle habilitado/fuera de servicio, vista de mantenimiento (alertas de service y VTV/RTO), registro de gastos y checklist documental (24/24 tasks).
  - Tanda 2 (vía `vehiculo-mantenimiento-registro`, 2026-07-31): categorización de gastos/mantenimiento alineada al docx — se eliminó `GastoVehiculo.categoria` (valores inventados, sin fuente) y se creó la entidad `MantenimientoRegistro` (`Vehiculo.mantenimientos[]`) con la categoría real de dos niveles (tipo de intervención + sub-tipo), historial con alta validada, `mockVehiculoRepository` `SCHEMA_VERSION` 2 → 3. Specs deltados y mergeados en `openspec/specs/vehiculo-{contract,gastos,mantenimiento-historial}/spec.md` (24/24 tasks). Detalle completo en `04_modelo_de_datos.md` §Discrepancias.
- **⚠️ Discrepancia con `docs/core/Traslados-Modelo-Datos.docx`** (señalizada con carteles `AvisoModeloDatos` en `VehiculoDetail.tsx`, detalle en `04_modelo_de_datos.md`):
  - ~~En el docx, kilometraje actual y próximo vencimiento (por fecha o por km) viven en la tabla `mantenimiento_registro`, no embebidos en `vehiculo`~~ — **parcialmente resuelto** por `vehiculo-mantenimiento-registro` (2026-07-31): la tabla Mantenimiento del docx ahora existe en el frontend como `MantenimientoRegistro`/`Vehiculo.mantenimientos[]`, con sus propios campos de kilometraje y próximo vencimiento por registro. **Sigue pendiente**: `kilometraje`/`kilometrajeUltimoService`/`fechaUltimoService` de `Vehiculo` no se derivan del historial (decisión explícita, ver design.md de ese change) — el vehículo sigue teniendo su propio kilometraje embebido, y el vencimiento VTV/RTO queda duplicado entre `habilitaciones[].fechaVencimiento` y `MantenimientoRegistro.proximoVencimientoFecha`.
  - VTV/RTO en el docx son solo ítems del catálogo genérico de documentos vehiculares, sin fecha de vencimiento propia (el vencimiento se rastrea vía mantenimiento) — distinto de `RegistroHabilitacion` en el frontend, que sí tiene `fechaVencimiento`.
  - Falta el campo `Notas` (observaciones sobre el vehículo) que sí está en el docx.
  - El docx ubica `gasto_vehiculo` bajo el módulo de permisos "facturacion", no "conductores" — importa para las RLS policies de este change.
  - **Categoría de mantenimiento en dos niveles** (nuevo, `vehiculo-mantenimiento-registro`): el campo Categoría del docx en la entidad Mantenimiento combina nivel 1 (gasto/preventivo/correctivo) con el sub-tipo de US-500 — el frontend ya lo modela tipado como unión discriminada; el nombre de columna real de `mantenimiento_registro` para nivel 1 + nivel 2 queda a definir con el backend `C-08`.
  - `gasto_vehiculo` no tiene campo de categoría (confirmado contra el docx); `mantenimiento_registro` no tiene monto — el importe de una intervención se carga como un gasto aparte, sin FK entre ambas tablas (el docx no la tiene).
  - `GastoVehiculo.descripcion` es un agregado del frontend (no existe en el docx) — a confirmar si el backend lo suma a `gasto_vehiculo`.
- **✅ RESUELTO (2026-08-01)** — discrepancia backend/frontend detectada en merge 2026-07-31: el
  punto de arriba (frontend, `vehiculo-mantenimiento-registro`) describía `gasto_vehiculo`/
  `mantenimiento_registro` como dos tablas reales separadas, sin FK. Reconciliado contra
  `openspec/changes/C-08-vehiculos-mantenimiento/` de Enzo, ya mergeado a `main` (commit `f840a96`):
  **la versión de Enzo es la que va** — los gastos viven como filas `categoria = 'gasto'` dentro de
  `conductores.mantenimiento` (columnas `monto`/`descripcion`/`categoria_gasto` de
  `20260730110000_schema_vehiculo_gaps.sql`), no en `facturacion.gastos_vehiculos` (que queda
  muerta/sin usar, no se dropea). Ver `openspec/changes/integracion-conductores-vehiculos/design.md`
  §Reconciliación con C-08-vehiculos-mantenimiento (D9/D11) para el detalle completo.
- **✅ RESUELTO (2026-08-01) — Habilitaciones VTV/RTO**: el design de `integracion-conductores-vehiculos`
  había decidido (D3, opción B) NO crear tabla propia — derivar habilitaciones del historial de
  mantenimiento client-side. Enzo creó exactamente la tabla que esa decisión descartaba:
  `conductores.habilitaciones_vehiculo(id, vehiculo_id, tipo, fecha_emision, fecha_vencimiento)`
  (`20260730110000_schema_vehiculo_gaps.sql`, RLS corregida en
  `20260730150000_fix_habilitaciones_vehiculo_modulo.sql`). Se adopta la tabla real de Enzo como
  fuente de verdad — `derivarHabilitaciones()` queda superada para el repository real (sigue viva
  como función solo del lado mock, sin motivo para tocarla).
- **✅ RESUELTO (2026-08-01) — Kilometraje**: el plan quería `kilometraje NOT NULL DEFAULT 0` más dos
  columnas persistidas nuevas (`kilometraje_ultimo_service`/`fecha_ultimo_service`). Realidad: Enzo
  ya agregó `kilometraje` (nullable, sin default — distinto de lo planeado) y
  `kilometrajeUltimoService`/`fechaUltimoService` se **derivan** en la Edge Function del último
  registro `categoria='preventivo'` de `mantenimiento`, nunca como columnas propias. Se adopta la
  forma de Enzo.
- **⚠️ GAP ABIERTO — necesita decisión de Enzo (detectado 2026-08-01)**: la Edge Function
  `supabase/functions/vehiculos/index.ts` de Enzo devuelve `gastos` y `habilitaciones` derivadas,
  pero **no expone ningún array de eventos de mantenimiento** (sin historial preventivo/correctivo).
  Su propio comentario de cabecera dice *"preventivo/correctivo se gestionan por separado en
  `supabase/functions/mantenimiento/index.ts`"* — **ese archivo no existe** en el repo. Gap real: la
  pantalla ya shippeada `VehiculoMantenimiento.tsx` (consume `Vehiculo.mantenimientos`, campo
  obligatorio) no tiene hoy ninguna fuente de datos real. Dos caminos posibles, **sin decidir**:
  (a) extender `toApi()` de `vehiculos/index.ts` para devolver también las filas crudas de
  mantenimiento (requiere sumar las columnas `subtipo`/`detalle` que el D4 de
  `integracion-conductores-vehiculos` necesita y que hoy no existen en el schema de Enzo), o
  (b) construir el endpoint separado `supabase/functions/mantenimiento/index.ts`. Detalle completo en
  `openspec/changes/integracion-conductores-vehiculos/design.md` §Reconciliación, bloque "Gap
  abierto". **Bloquea** §5/§4B de `integracion-conductores-vehiculos/tasks.md` hasta que Enzo elija
  un camino.
- **⚠️ GAP ABIERTO — `estado` con doble conversión (detectado en batch 4B, 2026-08-01)**: la Edge
  Function ya devuelve `estado` convertido a la forma de dominio (`'fuera-de-servicio'`, con guión),
  pero `parseEstadoVehiculo` (§4) todavía espera el valor crudo de la base (con espacio) y ante un
  valor desconocido degrada silenciosamente a `'habilitado'`. Un vehículo real fuera de servicio
  podría mostrarse como habilitado si §5 pasa la respuesta de la Edge Function sin ajustar esto
  antes. Bloquea §5 igual que el gap de mantenimientos. Detalle en `design.md` §Reconciliación.
- **⚠️ GAP ABIERTO — `notas` no viaja (detectado en batch 4B, 2026-08-01)**: `toApi()` de
  `vehiculos/index.ts` nunca incluye la clave `notas` en la respuesta, aunque el campo existe en el
  dominio y en la base (`Vehiculo.notas`, §2). En producción este campo siempre volvería
  `undefined`. Sin decidir con Enzo si `toApi()` debe sumarlo.
- **✅ Adoptado (2026-08-01) — patrón de acceso**: el design asumía PostgREST + RPC directo con RLS
  por tabla como frontera de enforcement; la realidad es que la Edge Function de Enzo hace un único
  chequeo grueso `tiene_permiso('vehiculos', nivel)` y de ahí en más usa un cliente service-role
  (legítimo — la regla dura del proyecto es que la service-role key nunca vive en frontend, y acá
  sigue viviendo solo en la Edge Function; es una granularidad de permiso distinta, no una violación).
  `SupabaseVehiculoRepository.ts` (no construido todavía) va a llamar la Edge Function vía
  `supabase.functions.invoke()`, mismo patrón que ya usa
  `frontend/src/shared/lib/cuentas/SupabaseCuentaRepository.ts` (el único repository del repo que ya
  hace esto — `SupabaseObraSocialRepository.ts` sigue siendo PostgREST directo, no es precedente acá).
- **Progreso backend (real, C-08, 2026-07-30)**: ✅ implementado, pendiente deploy.
  **Decisión confirmada con Enzo** sobre el punto de arriba: los gastos del vehículo viven en
  `conductores.mantenimiento` (`categoria = 'gasto'`, tal cual el docx modela una única
  "Categoría / Tipo de intervención"), no en `facturacion.gastos_vehiculos` — esa tabla queda sin
  usar (no se dropea). `kilometrajeUltimoService`/`fechaUltimoService` quedan **derivados** del
  último registro `preventivo` de `mantenimiento` (nunca columnas propias, para no tener 2
  fuentes de verdad) — resuelve el primer punto de la discrepancia de arriba.
  `habilitaciones_vehiculo` (tabla nueva) resuelve el segundo punto (VTV/RTO con vencimiento
  propio, distinto de `documentacion_vehiculo`). Edge Functions `vehiculos` (habilitaciones,
  gastos y `accesoriosCompatibles` embebidos con reemplazo completo) y `vehiculo-documentos`
  (mismo patrón que `pacientes-documentos`). Detalle en
  `openspec/changes/C-08-vehiculos-mantenimiento/`. **Falta**: `supabase db push` + deploy de
  las 2 funciones (requiere OK explícito); una Edge Function para registrar mantenimiento
  preventivo/correctivo cuando el frontend tenga esa pantalla (hoy no existe, `gasto`/
  `kilometrajeUltimoService` son los únicos casos con consumidor real); el campo `Notas` (3er
  punto de la discrepancia) queda igual de pendiente que antes, del lado frontend.

---

## FASE 2 — Entidades dependientes

### [C-05] `pacientes-fichas-clinicas`
- **Estado**: 🔶 `integracion-pacientes` implementado (2026-07-30/31) — código, migración y tests
  completos; **pendiente de revisión manual antes de archivar**. Ver `openspec/changes/integracion-pacientes/tasks.md`
  para el detalle tarea por tarea.
- **⏳ Pendiente de revisión (a cargo de Enzo/backend)** antes de poder archivar `integracion-pacientes`:
  - `1.3` — consulta de humo (`select id from pacientes.paciente limit 1`) autenticado con una cuenta
    real vía PostgREST/la app (no desde el SQL editor, que conecta como superusuario y no ejercita RLS).
  - `1B.4` — verificación manual de `pacientes.crear_paciente_completo` con 3 cuentas reales
    (`pacientes: write` da de alta completo; `pacientes: read` sin `write` falla `42501` y cero filas;
    `pacientes: write` sin `obra_social: write` con afiliado cargado falla `42501` y rollback total) —
    checklist completo en `openspec/changes/integracion-pacientes/design.md` §Migration Plan paso 4.
  - `7.5`-`7.8` — verificación en navegador (`npm run dev`) con las mismas 3 cuentas, rastro en
    `auditoria.logs`, prueba de rollback (volver `PacientesRoute.tsx` al mock y reaplicar), y
    reconfirmar `select prosecdef from pg_proc where proname = 'crear_paciente_completo';` → `false`.
  - Lo que **ya está confirmado**: migración aplicada al proyecto real vía SQL Editor (2026-07-30),
    `SECURITY INVOKER` verificado, suite completa en 1385/1385 tests (0 regresiones), `tsc`/`oxlint`
    limpios, cobertura ≥85% en `shared/lib/pacientes/`.
  - Una vez confirmado todo lo anterior: `sdd-archive integracion-pacientes`.
- **Scope**:
  - Migración: tabla `paciente` (apellido(s), nombre(s), fecha de nacimiento, DNI, CUIL del titular, diagnóstico/condición, accesorio de movilidad, teléfono alternativo del responsable), FK a `obra_social`.
  - Campo identificador de afiliado **adaptable por obra social** (documento, alfanumérico, o CUIL + sufijo /01, /02...) — implementar como campo flexible, no columna fija única (RN-ID-02).
  - Migración: tabla `cud` (número, fecha emisión, fecha vencimiento) con alerta de vencimiento próximo; tabla `direccion_paciente` (domicilio/escuela/terapias/CISET, ida y vuelta como registros independientes, nunca inferidos uno del otro); tabla `persona_a_cargo`.
  - Documentación del paciente usando el patrón de `C-03`, filtrada por el checklist de la obra social asignada (`C-04`).
  - Campo/flag de amparo judicial con aclaración (impacta plazo de cobro en `C-07`).
  - Historial de traslados del paciente (placeholder — se completa cuando exista `C-10`).
  - Tests: alta de paciente con identificador de afiliado según 3 formatos distintos de obra social, alerta de CUD por vencer, direcciones ida/vuelta como registros independientes.
- **Dependencias**: `C-02`, `C-03`, `C-04`
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §Épica 2 (US-100, US-101, US-102)
  - `knowledge-base/04_modelo_de_datos.md` §Paciente, §CUD
  - `knowledge-base/05_reglas_de_negocio.md` §RN-ID-01, RN-ID-02
  - `knowledge-base/07_flujos_principales.md` §Flujo 1
  - `knowledge-base/10_preguntas_abiertas.md` §IN-01 e identificación fiscal (prioridad Alta — puede modificar este modelo)
- **⚠️ Discrepancia con `docs/core/Traslados-Modelo-Datos.docx`** (detalle en `04_modelo_de_datos.md`). Revisada manualmente en `pacientes-ui` (vía carteles `AvisoModeloDatos`) el 2026-07-24; el usuario confirmó sumar campos al frontend en dos tandas antes de archivar ese change — 5 de 7 puntos **ya resueltos ahí**, quedan pendientes solo para el backend real de este change (`C-05`):
  - ~~Faltan segundo nombre y segundo apellido~~ — resuelto en `pacientes-ui`: `Paciente.segundoNombre`/`segundoApellido` (opcionales).
  - ~~Diagnóstico y Condición son dos campos de una entidad aparte en el docx~~ — resuelto en `pacientes-ui`: `Paciente.condicion` (opcional) agregado junto a `diagnostico`, sin crear la entidad "Datos Clínicos" aparte (evaluar al construir el modelo real de `C-05` si conviene separarla).
  - ~~"Teléfono alternativo" está en `Paciente` acá; en el docx pertenece a Personas a Cargo~~ — resuelto en `pacientes-ui`: se sacó de `Paciente` y se sumó `PersonaACargo.telefono`/`telefonoAlternativo` (opcionales).
  - ~~"Accesorio de movilidad" acá admite uno solo; el docx permite varios por paciente (tabla de vínculo, igual que en `C-08`)~~ — resuelto en `pacientes-ui` (segunda tanda): `Paciente.accesorioMovilidad` pasó a `AccesorioMovilidad[]` (multi-selección, mismo patrón de checkboxes que `VehiculoForm`/`C-08`).
  - ~~el número de afiliado acá es un valor único y actual; el docx lo modela como "Cobertura del Paciente"~~ — resuelto en el backend real (2026-07-28): `obra_social.coberturas_paciente` ya es histórica (N por paciente, `fecha_desde`/`fecha_hasta`), y esa migración le sumó `formato_afiliado`.
  - ~~el docx separa "Direcciones" de "Recorridos"~~ — resuelto en el backend real (2026-07-28): `pacientes.direcciones` (catálogo) y `pacientes.recorridos` (día/hora + FK a 2 direcciones) ya son tablas separadas, sin el campo `tramo` que fusiona ambos conceptos en el mock del frontend.
  - ~~el CUD del docx tiene un campo booleano "Vigente" propio~~ — resuelto en el backend real (2026-07-28): `pacientes.cud.vigente` ya se persiste (no se deriva).
- **Progreso backend (real, C-05, 2026-07-28)**: ✅ implementado y pusheado. La estructura completa (`paciente`, `cud`, `clinicos`, `accesorios_pacientes`, `personas_a_cargo`, `direcciones`, `recorridos`, `historial_recorridos`, `documentos`, `coberturas_paciente`) ya existía de rebote desde C-02. Esta migración cerró los 3 gaps de arriba contra el contrato ya testeado del frontend (`shared/types/paciente.ts`): `amparo_judicial_aclaracion`, `formato_afiliado` en `coberturas_paciente`, y `localidad`/`dias`/`horario` + enum `tipo_direccion` en `direcciones`. `historial_recorridos` sigue como placeholder hasta que exista C-10, tal como scopeaba este change.
- **⚠️ Discrepancia con `Traslados-Modelo-Datos.docx`** (cableado del repository real, `integracion-pacientes`, 2026-07-30): al conectar `SupabasePacienteRepository.ts` contra `20260724100004_schema_pacientes.sql` aparecieron 11 discrepancias adicionales (más allá de las 3 ya resueltas arriba el 2026-07-28), ya documentadas en detalle en `04_modelo_de_datos.md` §Discrepancias, bloque "Pacientes vs. esquema real de `C-05`" — remitir ahí para el listado completo. Resumen de impacto en backend:
  - **Columnas que el backend debería agregar**: `direcciones.localidad`, `amparo_judicial_aclaracion` (en `paciente` o en `clinicos`) — ambas ya sumadas por la migración del 2026-07-28 de arriba, a confirmar que coinciden con lo que `integracion-pacientes` necesita.
  - **Preguntas abiertas sin decidir acá**: si `paciente.domicilio` es la columna legacy o la canónica frente a `direcciones` (hoy coexisten, y solo se lee, nunca se escribe, desde este change); si la cobertura de obra social debe modelarse como histórica (N filas con `fecha_desde`/`fecha_hasta`, como ya está en la base) o colapsarse a una sola actual (como asume hoy el frontend, que usa la más reciente e ignora el resto).
  - La función de alta `pacientes.crear_paciente_completo` (`SECURITY INVOKER` a propósito, ver `04_modelo_de_datos.md`) es el contrato de escritura real de este módulo desde ahora.

### [C-09] `conductores`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Migración: tabla `conductor` (datos personales, perfil/restricciones — ej. no traslada pacientes con carga física por edad), **sin cuenta de acceso al sistema** (no crea usuario en `auth.users`).
  - Migración: tabla `asignacion_semanal` (conductor ↔ vehículo, por semana), FK a `vehiculo` (`C-08`).
  - Documentación del conductor (licencia de conducir, etc.) usando el patrón de `C-03`.
  - Tests: asignación semanal sin colisión (un conductor no queda asignado a dos vehículos la misma semana salvo que se permita explícitamente), conductor no genera fila en `auth.users`.
- **Dependencias**: `C-02`, `C-03`, `C-08`
- **Governance**: BAJO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §Épica 7 (US-600)
  - `knowledge-base/05_reglas_de_negocio.md` §RN-GL-03
  - `knowledge-base/04_modelo_de_datos.md` §Conductor
  - `knowledge-base/03_actores_y_roles.md` (conductor no opera el sistema)
- **⚠️ Discrepancia/pendiente de UI** (`conductores-ui`, señalizada con carteles `Chip kind="warning"` en `ConductorForm.tsx` y `AsignacionSemanalTabla.tsx`, y una nota en `ConductorDocumentos.tsx`; detalle en `openspec/changes/conductores-ui/design.md` Open Questions, o su ubicación en `openspec/changes/archive/` una vez archivado): quien implemente este change en el backend debe confirmar con el cliente antes de cerrar el modelo real —
  1. Catálogo cerrado de restricciones de perfil: la KB solo documenta explícitamente "no traslada pacientes que requieren carga física" (`no-carga-fisica`); falta confirmar si hay otras restricciones tipables (horarias, tipo de vehículo, zona) o alcanza con esa + observación libre.
  2. Si la excepción "salvo que se permita explícitamente" (un conductor en dos vehículos la misma semana) es un caso real, o la colisión debe bloquearse siempre. El frontend la implementó con un override explícito (`permitirMultiple`) apagado por defecto.
  3. Campos personales mínimos obligatorios del alta: el frontend tomó apellido + nombre + documento como obligatorios y el resto (teléfono, fecha de nacimiento, domicilio, CUIL) opcional.
  4. Documentos a precargar en el checklist del conductor: el frontend sembró licencia de conducir (requerida), DNI y apto médico como ejemplo.
  5. (Interna, sin cartel en UI) Coordinar los nombres exactos de campos de `Conductor`/`AsignacionSemanal` y si la semana se guarda como etiqueta ISO `YYYY-Www` (elegido por el frontend) o como fecha de inicio de semana, antes de cerrar la interfaz del repository real.
- **⚠️ Discrepancia con `docs/core/Traslados-Modelo-Datos.docx`** (señalizada con carteles `AvisoModeloDatos` en `ConductorDetail.tsx`, detalle en `04_modelo_de_datos.md`):
  - ~~Faltan campos que sí están en el docx: Domicilio, CUIL (acá solo hay Documento/DNI) y **Estado** (operando / fuera de servicio)~~ — resuelto 2026-07-24: se sumaron `Conductor.domicilio`, `Conductor.cuil` y `Conductor.estado` al frontend.
  - ~~**Pendiente**: "Restricciones" acá es un catálogo cerrado (`RestriccionConductor[]`); en el docx es texto libre dentro de un único campo "Notas" junto con las observaciones — reconciliar con el punto 1 de arriba (catálogo cerrado pendiente de confirmar con el cliente) **y coordinar con Enzo (backend) antes de cerrar C-09**.~~ — **RESUELTO por decisión de diseño D6-B** (`integracion-conductores-vehiculos/design.md`, opción B elegida): `Conductor.restricciones` desaparece por completo del dominio, todo pasa a un único campo `notas`/`observaciones` de texto libre, alineado 1:1 al docx. Costo asumido: `C-10` pierde el filtro computable por restricción (RN-GL-03 pasa a ser lectura humana, no validación automática).
  - El docx modela la asignación semanal con **Fecha de inicio** y **Fecha de fin de semana** como dos campos de fecha independientes, no como la etiqueta ISO única del punto 5 de arriba.
  - **Bloqueante para §7 (repository real de Conductores), no relacionado con Vehículos**: las migraciones de asignación semanal/estado planeadas en `integracion-conductores-vehiculos/tasks.md` §1B.1/1B.2 (`20260801120000_conductores_vehiculos_campos.sql` y `_rpc.sql`) **no existen todavía en ningún lado** — ni en esta rama, ni en lo que Enzo mergeó. Alguien tiene que escribirlas y aplicarlas antes de poder avanzar el repository real de Conductores.

---

## FASE 3 — Reglas de negocio de facturación y operación diaria (paralelizable en 2 ramas)

### [C-06] `presupuestos-autorizaciones`
- **Estado**: `[~]` backend implementado y pusheado (2026-07-29), incl. Edge Functions `presupuestos`/`autorizaciones` (2026-07-30); pendiente verificación manual y que frontend reemplace el mock
- **Scope**:
  - Migración: tabla `presupuesto` (estimación anual por paciente/prestación) y tabla `autorizacion` (respuesta de la obra social — igual o menor al presupuesto, **nunca mayor**; cupo de días/km por mes; estado: pendiente/autorizada/judicializada/rechazada; vigencia con soporte de carga retroactiva).
  - Validación dura: rechazar o alertar si `autorizacion > presupuesto` (RN-PA-01).
  - Documentación adjunta de presupuesto enviado y autorización recibida, usando el patrón de `C-03`.
  - El cupo mensual autorizado queda expuesto como dato consumible por `C-07` (control de facturación, RN-PA-03).
  - Tests: rechazo de autorización mayor al presupuesto, carga retroactiva de autorización con vigencia previa a la fecha de carga, cambio de estado pendiente→autorizada→judicializada→rechazada.
- **Dependencias**: `C-04`, `C-05`
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §Épica 3 (US-200)
  - `knowledge-base/05_reglas_de_negocio.md` §RN-PA-01, RN-PA-02, RN-PA-03
  - `knowledge-base/04_modelo_de_datos.md` §Presupuesto / Autorizacion
  - `knowledge-base/07_flujos_principales.md` §Flujo 1 (caso de error: autorización > presupuesto)
- **Progreso frontend (mock, vía FE-4)**: ✅ completo y archivado 2026-07-24 como `presupuestos-ui` (`openspec/changes/archive/2026-07-24-presupuestos-ui/`), 32/32 tasks incluida la verificación manual en navegador. Contrato de tipos, mocks con `localStorage`, hooks, pantallas de Presupuesto/Autorización y validación RN-PA-01 (`validarAutorizacion`) implementados y testeados (397 tests del frontend en verde, `tsc`/`oxlint` limpios). **Falta**: coordinar con backend los 2 puntos bloqueantes de abajo antes de cerrar la tabla `autorizacion` real de `C-06` — governance ALTO.
- **⚠️ Discrepancia con `docs/core/Traslados-Modelo-Datos.docx`** (detalle completo en `openspec/changes/presupuestos-ui/design.md` §Discrepancias, cartel `AvisoModeloDatos` implementado en `PresupuestoForm.tsx`/`AutorizacionForm.tsx`):
  - Documentación adjunta: el docx modela un solo campo "Archivo" por Presupuesto y por Autorización, NO el patrón multi-documento `DocumentChecklist` de `C-03` que este scope asume arriba.
  - ~~**Bloqueante**: la Autorización no tiene ningún campo numérico comparable con el `Monto` del Presupuesto~~ — resuelto: se sumó `monto_autorizado` (nullable, agregado real de negocio) + trigger `validar_autorizacion_monto` que rechaza duro si supera el presupuesto (RN-PA-01).
  - ~~**Bloqueante**: no hay campo de vigencia retroactiva (RN-PA-02)~~ — resuelto: se sumó `vigencia_desde`.
  - Menor: el Presupuesto del docx es un monto único (no "estimación anual por prestación"), y trae `obraSocialId` explícito que el ERD de la KB no dibujaba — se siguió el docx en ambos casos, sin cartel dedicado.
- **Progreso backend (real, C-06, 2026-07-28)**: ✅ implementado, pusheado y **archivado** (2026-08-01) como `C-06-presupuestos-autorizaciones` (`openspec/changes/archive/2026-08-01-C-06-presupuestos-autorizaciones/`). `presupuesto`/`autorizacion` ya existían de rebote desde C-02 (documentación adjunta correctamente modelada como archivo único, no patrón multi-doc de C-03, per docx). Esta migración cerró los 2 puntos bloqueantes de arriba: `monto_autorizado` + trigger `validar_autorizacion_monto` (RN-PA-01) y `vigencia_desde` (RN-PA-02). Sin delta specs (cambio puro de schema/migraciones, mismo caso que `C-02`) — nada que fusionar en `openspec/specs/`. 7/7 tasks completas.
- **🔶 Propose completo del swap de backend** (`integracion-presupuestos`, 2026-08-02):
  `proposal.md` + `design.md` (13 decisiones D1-D13) + `tasks.md` + 6 delta specs
  (`presupuesto-repository-supabase` y `autorizacion-repository-supabase` nuevas;
  `presupuesto-contract`/`presupuesto-crud`/`autorizacion-gestion`/`autorizacion-validacion-monto`
  modificadas). Estado del backend **verificado en vivo el 2026-08-02** (solo lectura, CLI linkeado):
  `monto_autorizado`/`vigencia_desde` aplicadas, trigger RN-PA-01 vivo, Edge Functions
  `presupuestos`/`autorizaciones` `ACTIVE` (v2), policies gateadas por el módulo `presupuestos`,
  `presupuesto`/`autorizacion` con **0 filas** y las 3 FK del dominio **sin índice**.
  **Decisión de arquitectura del change (D2)**: a diferencia de los cuatro changes de integración
  anteriores, este consume las **Edge Functions ya deployadas** vía `supabase.functions.invoke`
  (precedente: `SupabaseCuentaRepository`) en vez de PostgREST + RLS. Consecuencia: **cero SQL de
  lógica** — el único `.sql` del change son 3 índices sobre FK, los mismos que
  `integracion-facturacion` D10 dejó fuera diciendo *"son de `C-06`"*.
- **✅ Portón de governance aprobado por la usuaria (2026-08-02)** — `tasks.md` §0, gobernanza ALTO,
  las 5 decisiones que bloqueaban el apply:
  - **D2** — Edge Functions deployadas (`supabase.functions.invoke`), no PostgREST + RLS. Aparta a
    este módulo del patrón de la serie.
  - **D3** — aceptado: el portón de autorización es el `requirePermiso('presupuestos', …)` de la Edge
    Function, RLS queda como segunda capa (adentro de la función se opera con `service_role`). Ya
    estaba deployado por `C-06`, faltaba la aprobación del lado del frontend.
  - **D5 (mayor riesgo funcional del change)** — el adjunto. `Presupuesto.archivo`/
    `Autorizacion.archivo` (`{nombre, cargadoEn}`) no tienen contraparte: la base solo tiene
    `archivo_url`, las columnas de metadatos las dropeó a propósito `20260730120000`, **no hay bucket
    de Storage** para este dominio y el formulario **no sube nada**. **Decidido: opción A** — mapeo
    no destructivo + `AvisoModeloDatos`, sin tocar el input. La subida real de Storage queda como
    change propio futuro `presupuestos-documentacion-storage`.
  - **D7b** — aprobados los 3 índices (`presupuesto.paciente_id`, `presupuesto.obra_social_id`,
    `autorizacion.presupuesto_id`) **sin `CONCURRENTLY`**; se aparta de una regla dura de
    `database-schema-design`, justificado en que las dos tablas tienen 0 filas — condición a
    re-verificar inmediatamente antes de aplicar (1B.1).
  - **D11** — confirmado: Presupuestos se swapea primero y `FacturacionRoute.tsx` queda en mocks
    (fuera de alcance, es su D9), así que en el medio la app tiene **dos fuentes distintas para la
    misma entidad**. A cambio, la trampa de RLS que ese change anotó queda **cerrada y verificable**:
    confirmado contra `pg_policies` que las cuatro policies gatean por `presupuestos` y no por
    `facturacion`, y con el transporte de D2 un perfil con `facturacion` sin `presupuestos` recibe un
    **403 explícito** en vez de 0 filas en silencio.
  - **Listo para `/opsx:apply integracion-presupuestos`.**
- **⚠️ Hallazgo de arquitectura abierto (D12)**: el proyecto tiene **dos backends en paralelo sobre
  las mismas tablas** —Edge Functions (`C-04`…`C-07`, `service_role` + `requirePermiso`) y
  PostgREST + RLS + RPC (los changes de integración)— y **ningún change lo declaró como decisión**.
  En particular, `integracion-facturacion` propone crear `crear_factura_completa`/
  `actualizar_factura_completa` sin mencionar que las Edge Functions `facturas` y `cobros` ya están
  deployadas (verificado: la cadena "Edge Function" no aparece en su `proposal.md` ni en su
  `design.md`). `integracion-presupuestos` **declara el hallazgo y no lo resuelve** — unificar es un
  change transversal. **Decisor**: equipo técnico.

### [C-10] `hojas-de-ruta-recorridos`
- **Estado**: `[x]` completado (FE-5 frontend-only, 2026-07-25)
- **Scope**:
  - Migración: tabla `hoja_de_ruta` (fecha, franja horaria ~8:00-20:00, notas al pie) y tabla `recorrido` (FK a `vehiculo`, `conductor`, `paciente`; dirección de origen y destino independientes por tramo, **nunca asumir que la vuelta es el trayecto inverso**).
  - Validación dura: bloquear asignación de paciente a vehículo con accesorio de movilidad incompatible (RN-VE-01, ya modelado en `C-08`/`C-05`).
  - Agrupación de pasajeros por vehículo/conductor según capacidad; solo vehículos habilitados aparecen disponibles (excluye "fuera de servicio", `C-08`).
  - Integración Google Maps/Geometry API: sugerencia de orden de recogida por cercanía como **propuesta editable**, nunca ruta impuesta (RN-HR-01).
  - Edición manual de recorridos (agregar/quitar pasajero, reacomodo del resto), soporte de recorridos manuales sin frecuencia fija ni turno (ej. hospitales puntuales).
  - Vista global del día para reasignar ante imprevistos (vehículo/conductor fuera de servicio).
  - Exportación/impresión de hoja de ruta (PDF o vista imprimible para entregar en papel o WhatsApp).
  - Tests: bloqueo de asignación incompatible, exclusión de vehículo fuera de servicio, reordenamiento manual sin perder recorridos ya cargados, direcciones ida/vuelta persistidas como registros independientes.
- **Dependencias**: `C-05`, `C-08`, `C-09`
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §Épica 8 (US-700)
  - `knowledge-base/05_reglas_de_negocio.md` §RN-HR-01, RN-HR-02, RN-HR-03, RN-VE-01, RN-VE-02
  - `knowledge-base/04_modelo_de_datos.md` §HojaDeRuta / Recorrido
  - `knowledge-base/07_flujos_principales.md` §Flujo 2
  - `knowledge-base/10_preguntas_abiertas.md` (prioridad Media: alcance del ordenamiento por cercanía RF-701)
- **⚠️ Discrepancia con `docs/core/Traslados-Modelo-Datos.docx`** (detalle en `04_modelo_de_datos.md`): el docx no tiene entidad "Hoja de Ruta" — solo "Recorridos" (horario habitual del paciente, sin vehículo/conductor) e "Historial de Recorridos" (viaje realizado, ligado a Paciente + Vehículo, **sin campo Conductor**). Si el docx es correcto, no se podría auditar qué chofer hizo cada viaje puntual con el modelo tal como está documentado — resolver antes de migrar `hoja_de_ruta`/`recorrido` tal como los describe este change. **Decisión ya tomada en el lado frontend** (change `hojas-de-ruta-ui`, FE-5, 2026-07-25): se modela `conductorId` en `Recorrido` porque la regla de negocio lo exige (RN-VE-01/02); tanto la entidad `hoja_de_ruta` como el campo `conductor` en `recorrido` son agregados sobre el docx y **deben coordinarse con quien implemente el backend de `C-10`** (confirmar con el dueño del docx) **antes de cerrar el esquema de las tablas `hoja_de_ruta`/`recorrido`**.
  - **Resuelto (2026-08-04, apply `integracion-hojas-de-ruta`, WU5a — detalle completo en
    `04_modelo_de_datos.md` §Discrepancias, bloque "Hoja de Ruta / Recorrido vs. esquema real de
    `C-10`"):** dónde vive el agregado queda cerrado con la **repropuesta de
    `pacientes.historial_recorridos` como paradas** + dos tablas nuevas de agrupación
    (`hoja_de_ruta`/`recorrido`), y `conductor_id NOT NULL` queda confirmado en el esquema
    (`recorrido.conductor_id`), heredando la decisión ya tomada del lado frontend (RN-VE-01/02) — ya
    no es condición para cerrar el esquema, queda registrada como discrepancia resuelta con nota de
    decisión. **Sigue abierto**: `Vehículo`/`Conductor` todavía mock (swap parcial, CP0 —
    `HojaDeRutaRoute.tsx` queda con tres imports reales y dos mock) hasta que aterrice
    `integracion-conductores-vehiculos`, y la confirmación de fondo con el dueño del docx queda como
    verificación manual en `openspec/changes/integracion-hojas-de-ruta/tasks.md` 7.4.
  - Menores, ya con cartel propio en la UI (agregado 2026-07-25, antes solo cubiertos por el cartel general): el orden de recogida y las coordenadas del mapa no existen en el docx (cartel en `RecorridoCard.tsx`); la franja horaria y las notas al pie del agregado `HojaDeRuta` tampoco existen en el docx (cartel en `HojaDeRutaPage.tsx`).

---

## FASE 4 — Facturación y cobros

### [C-07] `facturacion-asistencias-cobros`
- **Estado**: `[~]` backend implementado y pusheado (2026-07-30); falta verificación manual y que frontend reemplace el mock
- **Scope**:
  - Migración: tabla `factura` (identificador del paciente — **definir por obra social si es DNI o N° de afiliado, ver pregunta abierta**; domicilio, prestación, mes/año, cantidad de días, dependencia y retorno, valor del km — nomenclador de carga manual, cantidad de km, total, tipo de comprobante A/B/C, estado: a facturar/facturado/cobrado/pagado parcialmente).
  - Migración: tabla `asistencia_prestacion` (se facturan íntegramente; el recorrido efectivo de `C-10` es independiente y no se deriva de acá, RN-FA-01) y tabla `cobro` (admite pagos parciales, N por factura).
  - Generación de la descripción de factura según la `plantilla_facturacion` de la obra social del paciente (`C-04`).
  - Validación dura: alertar si días/km facturados superan el cupo autorizado (`C-06`, RN-FA-02, RN-PA-03).
  - Exclusión de feriados en el cálculo (salvo sábados según prestación — regla configurable, no uniforme, RN-FA-03).
  - Cálculo de fecha estimada de cobro: **90 días por defecto desde fecha de factura; 45 días si hay amparo judicial** (confirmar con cliente, ver pregunta abierta) — ambos valores configurables, no hardcodeados.
  - Alerta de factura vencida sin cobro (ej. 60 días — confirmar) para seguimiento ante la Superintendencia.
  - Documentación adjunta por factura (comprobante ARCA, asistencia, CODEM) usando el patrón de `C-03`. Integración con ARCA: implementar **como adjunto manual del comprobante** (mínimo viable) dejando la arquitectura abierta a una integración automática futura (nivel de automatización aún sin confirmar con el cliente).
  - Exportación/impresión de factura + asistencia para subir al portal de la obra social o enviar por mail.
  - Tests: alerta al superar cupo autorizado, cálculo correcto de fecha estimada de cobro (caso general y caso amparo judicial), exclusión de feriados, transición completa de estados a facturar→facturado→cobrado→pagado parcialmente.
- **Dependencias**: `C-04`, `C-05`, `C-06`, `C-03`
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §Épica 5 (US-400)
  - `knowledge-base/05_reglas_de_negocio.md` §RN-FA-01 a RN-FA-08
  - `knowledge-base/04_modelo_de_datos.md` §Factura
  - `knowledge-base/07_flujos_principales.md` §Flujo 3
  - `knowledge-base/08_arquitectura_propuesta.md` §Nota sobre integración con ARCA
  - `knowledge-base/10_preguntas_abiertas.md` (prioridad Alta: identificador en factura DNI/afiliado, integración ARCA, plazos por defecto 90/60/45 días, año en facturación manual vs. estructurado)
- **⚠️ Discrepancia con `docs/core/Traslados-Modelo-Datos.docx`** (detalle completo en
  `04_modelo_de_datos.md` §Facturación y Cobros, y en `openspec/changes/facturacion-ui/design.md`
  §Discrepancias): 5 puntos con impacto en el esquema de este change, todos con `AvisoModeloDatos`
  agrupado en la UI del frontend (mock, ver bullet de progreso abajo). El backend debe absorberlos
  **antes de cerrar el esquema**: (1) no existe la tabla `asistencia_prestacion` (la KB modela
  `Factura 1---N Asistencia/Prestacion`, el docx no tiene ninguna entidad de asistencias); (2) no
  existe `documento_factura` (`Factura` no tiene ningún campo/tabla de adjuntos — Presupuesto y
  Autorización sí tienen un campo "Archivo" único cada uno); (3) no existe `fecha_estimada_cobro`
  en `factura` (el docx solo tiene "Fecha inicial / tope", ambiguo respecto del plazo de cobro);
  (4) no existe `cantidad_km` en `factura` (el docx solo tiene "Valor del kilómetro" y "Monto");
  (5) el enum de `estado` del docx ("a facturar, cobrada, pagada parcialmente, pendiente") no
  incluye `facturado`, necesario como disparador del cálculo de fecha estimada de cobro.
- **Progreso frontend (mock, vía FE-6)**: ✅ implementado como `facturacion-ui`
  (**archivado**, `openspec/changes/archive/2026-07-27-facturacion-ui/`), 61/61 tasks incluida la
  verificación estructural de RN-FA-01 (cero acoplamiento con
  `hojaDeRuta.ts`/`HojaDeRutaRepository`). Contrato
  de tipos (`Factura`, `AsistenciaPrestacion`, `Cobro`, `EstadoFactura`), 9 funciones puras de
  reglas de negocio test-first (descripción según plantilla, días facturables con exclusión de
  feriados, cupo consumido/validación, fecha estimada de cobro con precedencia amparo/obra
  social/default, vencimiento, total, saldo, estado derivado), mocks con `localStorage` y
  fixtures, formulario con selector de días facturables y alerta de cupo persistente,
  circuito de estados con confirmación explícita (no bloqueante) ante exceso de cupo, panel de
  cobros con corrección manual de estado, checklist documental (`FacturaDocumentos`) y vista
  imprimible sin librería de PDF — todo montado en `/facturacion`. **Falta**: coordinar con
  backend los 5 puntos de la discrepancia de arriba antes de cerrar el esquema de `factura`,
  `asistencia_prestacion`, `cobro` y `documento_factura` (governance CRITICO), y confirmar con el
  cliente los defaults de `10_preguntas_abiertas.md` (identificador DNI/afiliado, plazos 90/45/60
  y su precedencia, integración ARCA, período estructurado). Verificación manual en navegador
  confirmada por el usuario 2026-07-25.
- **Progreso backend (real, C-07, 2026-07-30)**: ✅ implementado, pendiente deploy. Cerró los 3
  puntos de la discrepancia de arriba (`asistencia_prestacion`, `cantidad_km`,
  `fecha_estimada_cobro`) más 6 campos adicionales que el discrepancy log no tenía listados pero
  el contrato real de `Factura` sí exige (`prestacion`, `mes_facturado`/`anio_facturado`,
  `dependencia_y_retorno`, `domicilio_id`, `identificador_origen`/`identificador_valor`). Edge
  Functions `facturas` (asistencias embebidas con reemplazo completo, mapeo de `estado` porque el
  enum de la base todavía tiene `'pendiente'`) y `cobros` (sin `PATCH`, `CobroRepository` no lo
  tiene). Detalle en `openspec/changes/C-07-facturacion-asistencias-cobros/`. **Falta**:
  `supabase db push` + deploy de las 2 funciones (requiere OK explícito), y confirmar con el
  cliente los defaults de `10_preguntas_abiertas.md` antes de implementar la validación de cupo y
  el cálculo de fecha estimada de cobro como lógica de servidor (hoy son funciones puras del
  frontend, no replicadas acá).
- **🔶 Propose completo del swap de backend** (`integracion-facturacion`, 2026-07-31):
  `proposal.md` + `design.md` (14 decisiones D1-D14) + `tasks.md` + 5 delta specs
  (`factura-repository-supabase` nueva, `factura-contract`/`factura-estados-circuito`/
  `factura-cupo-validacion`/`cobro-registro` modificadas). Los 4 defaults de negocio de
  `10_preguntas_abiertas.md` se **heredan sin cerrarlos** (identificador de factura, período
  estructurado, plazos 90/60/45, ARCA manual) — la usuaria confirmó ese criterio antes del propose.
- **⏳ Pendiente de decisión (a cargo de Enzo/backend)** antes de que `integracion-facturacion` pueda
  pasar a apply — portón de governance §0 de `tasks.md`, gobernanza CRITICO, ninguna tarea corre sin
  esto:
  - **D3** — agregar `facturacion.facturas.fecha_factura DATE` (nullable). Única modificación de
    schema del change. Requiere además coordinación previa con Enzo para confirmar que no está
    planeada con otro nombre — el schema real viene por delante del repo desde hace tres changes
    seguidos (mismo patrón que el hallazgo de `formato_afiliado` de `integracion-obra-social`, ver
    §C-04 — y ojo con confundir "verificado contra el schema real" con "confirmado por el
    cliente", son cosas distintas, ver la corrección de esa misma sección).
  - **D4** — crear dos funciones RPC `SECURITY INVOKER` (`crear_factura_completa`,
    `actualizar_factura_completa`) para las altas/ediciones atómicas multi-tabla.
  - **D6** — si el swap de `CobroRepository` entra en este mismo change o queda aparte. `design.md`
    argumenta que es obligatorio (no opcional): con cobros en fixture y facturas reales, ningún
    cobro matchea ninguna factura.
  - **D9 (mayor riesgo funcional del change)** — la validación de cupo (RN-FA-02) queda operando
    sobre fuente mixta: facturas reales × autorizaciones de fixture, porque `C-06` (Presupuestos)
    sigue bloqueado. Tres opciones en `design.md` D9: **A.** fuente mixta + cartel visible
    (propuesta), **B.** desactivar la alerta hasta que `C-06` esté integrado, **C.** arrastrar el
    swap de `autorizacion` a este change. Hallazgo asociado, no es parte de esta decisión pero
    la motiva: las policies reales de `facturacion.presupuesto`/`autorizacion` están gateadas por
    el permiso `presupuestos`, no `facturacion` como dice el comentario de la migración commiteada
    — un perfil con `facturacion: read/write` sin `presupuestos: read` ve **0 autorizaciones en
    silencio**, dejando RN-FA-02 desactivada de hecho. Queda anotado como bloqueante a resolver en
    `integracion-presupuestos`.
  - **D10** — crear los 6 índices que faltan sobre las FK de `facturacion` sin `CONCURRENTLY`
    (se aparta de una regla dura de `database-schema-design`), justificado en que las 6 tablas
    tienen 0 filas hoy — condición a re-verificar inmediatamente antes de aplicar la migración.

---

## FASE 5 — Cierre y visibilidad

### [C-11] `panel-principal-reportes`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Vista de dashboard: hoja de ruta/recorridos del día en primer plano (`C-10`).
  - Tarjetas de resumen: facturas en mora (`C-07`), CUD por vencer (`C-05`), alertas de mantenimiento (`C-08`).
  - Reporte de diferencia entre facturado y cobrado en período configurable (3/6/12 meses).
  - Resumen anual por período (facturación + cobros) para cierre y preparación de balances.
  - Solo lectura/agregación — no introduce entidades nuevas, no requiere migraciones más allá de vistas SQL o funciones agregadoras.
  - Tests: cálculo correcto de diferencia facturado/cobrado por período, agregación anual, tarjetas reflejan datos reales de los módulos fuente.
  - ⚠️ Discrepancia con `Traslados-Modelo-Datos.docx` (1/4, **nueva/estructural**): el docx **no modela ninguna vista, reporte ni agregación** — describe siete áreas de entidades operativas y cero objetos de reporte. Las funciones puras de `frontend/src/shared/lib/reportes/` y sus tests son el contrato que las vistas SQL / RPC de `C-11` deben cumplir.
  - ⚠️ Discrepancia con `Traslados-Modelo-Datos.docx` (2/4, **known promovida a bloqueante**): la factura del docx no tiene **fecha de emisión** ni el estado **`facturado`**, y la tarjeta de facturas en mora (RF-801/RF-406) necesita las dos. Sin ellas RF-801 no se puede cumplir: confirmar `factura.fecha_factura` y el enum de estado con quien mantiene el docx, o redefinir la regla de mora con el cliente.
  - ⚠️ Discrepancia con `Traslados-Modelo-Datos.docx` (3/4, **menor en C-07 promovida a estructural**): la factura del docx no tiene **período de atribución estructurado** (solo `Fecha inicial / tope`, que pueden cruzar el límite de mes), así que "¿cuánto facturamos en marzo?" no tiene respuesta única. El frontend atribuye por `mesFacturado`/`anioFacturado`; el backend debe agregar `mes_facturado`/`anio_facturado` o declarar cuál fecha es la columna canónica.
  - ⚠️ Discrepancia con `Traslados-Modelo-Datos.docx` (4/4, **known, doble fuente de verdad**): el docx **persiste** el booleano `Vigente` del CUD y los "Próximo vencimiento (fecha/km)" de Mantenimiento; el frontend los **deriva** con `estadoCud` / `estadoServicePreventivo` / `estadoHabilitacion`. Si el backend persiste y no recalcula, la tarjeta y la BD pueden contradecirse. Postura del frontend: manda la derivación — a confirmar con `C-05`/`C-08`.
  - Las cuatro se señalizan con `AvisoModeloDatos` agrupado en la pantalla de Dashboard y están detalladas en `openspec/changes/dashboard-ui/design.md` §Discrepancias y en `knowledge-base/04_modelo_de_datos.md` §Discrepancias.
- **Dependencias**: `C-05`, `C-07`, `C-08`, `C-10`
- **Governance**: BAJO
- **Progreso frontend (mock, vía FE-7)**: ✅ implementado como `dashboard-ui` (**archivado**, `openspec/changes/archive/2026-07-26-dashboard-ui/`), 60/60 tasks (9.5 verificación manual en navegador confirmada). Tipos de proyección (`PeriodoMeses`, `SerieFacturadoVsCobrado`, `ResumenAnual`, `FacturaEnMora`, `PacienteCudPorVencer`, `AlertaMantenimientoVehiculo`, `ResumenDelDia`) y 6 funciones puras test-first en `shared/lib/reportes/` (`periodosDelRango`, `facturadoVsCobrado`, `resumenAnual`, `facturasEnMora`, `cudPorVencer`, `alertasMantenimiento`, `resumenDelDia`), con `CobroRepository.list()` agregado de forma aditiva. Cero duplicación de reglas de negocio: invoca `estadoVencimientoFactura`/`estadoCud`/`estadoServicePreventivo`/`estadoHabilitacion` de sus módulos dueños en vez de reimplementarlas. `DashboardRoute` inyecta 6 repositorios mock de solo lectura (Factura, Cobro, Paciente, Vehículo, HojaDeRuta y Conductor — este último no anticipado en el design original, agregado para resolver nombre de conductor en el panel de recorridos) — verificado con test de espías que ningún `create`/`update`/`remove` se invoca nunca. Montado en `/` (`router.tsx`), reemplazando el placeholder. Suite en verde (640 baseline → 766 tests), `tsc -b` y `oxlint` limpios.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §Épica 9 (US-800)
  - `knowledge-base/04_modelo_de_datos.md` (referencias cruzadas Factura/Vehiculo/Paciente/Recorrido)

---

## Resumen

| # | Change | Fase | Governance | Dependencias |
|---|--------|------|------------|---------------|
| C-01 | foundation-setup | 0 | BAJO | — |
| C-02 | usuarios-permisos-auditoria | 0 | CRITICO | C-01 |
| C-03 | gestion-documental-core | 1 | ALTO | C-01, C-02 |
| C-04 | obras-sociales-prestadores | 1 | MEDIO | C-01, C-02 |
| C-08 | vehiculos-mantenimiento | 1 | ALTO | C-01, C-02, C-03 |
| C-05 | pacientes-fichas-clinicas | 2 | CRITICO | C-02, C-03, C-04 |
| C-09 | conductores | 2 | BAJO | C-02, C-03, C-08 |
| C-06 | presupuestos-autorizaciones | 3 | ALTO | C-04, C-05 |
| C-10 | hojas-de-ruta-recorridos | 3 | ALTO | C-05, C-08, C-09 |
| C-07 | facturacion-asistencias-cobros | 4 | CRITICO | C-04, C-05, C-06, C-03 |
| C-11 | panel-principal-reportes | 5 | BAJO | C-05, C-07, C-08, C-10 |

**11 changes en 6 fases. Camino crítico: 6 changes (`C-01 → C-02 → C-04 → C-05 → C-06 → C-07`). Gates de paralelismo: 5.**

**Primer change recomendado**: `C-01` (foundation-setup).

Para arrancar: `/opsx:propose C-01-foundation-setup`

---

## ⚠️ Checklist de seguridad — antes de lanzar a producción

Pendiente de que Enzo lo haga a mano en el dashboard de Supabase (no automatizable desde acá).
Recordar cerca del final del proyecto, antes del go-live real — hay datos de salud de personas
con discapacidad de por medio, esto no es opcional.

- [ ] Deshabilitar el signup público (`Authentication > Settings` → apagar "Enable email
      signups"). Quedó habilitado a propósito durante el desarrollo para poder testear
      login end-to-end (2026-07-28) — hay que cerrarlo antes de producción.
- [ ] Activar 2FA en la cuenta de Supabase que administra el proyecto (no la de la app).
- [ ] Revisar restricciones de red (`Settings > Database > Network Restrictions`), si el
      plan lo permite.
- [ ] Borrar la cuenta de prueba `andrea.test@gmail.com` (creada 2026-07-28 para testear
      login, bootstrapeada a `admin`) una vez exista la cuenta real de Andrea.
- [ ] Confirmar que el connection string/password de la base (pooler URL) nunca se compartió
      ni se commiteó — es distinto de las API keys.
