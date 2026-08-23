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
| 1 | Pacientes (C-05) | ✅ `integracion-pacientes` archivado (2026-08-07), 64/66 — solo falta un pase visual en navegador, ver `archive/2026-08-06-integracion-pacientes/PENDIENTE.md` | Ver bullet ✅ en §C-05 más abajo |
| 2 | Obra Social (C-04) | ✅ `integracion-obra-social` archivado (2026-08-07), 69/70 — solo falta un pase visual en navegador, ver `archive/2026-08-06-integracion-obra-social/PENDIENTE.md` | Ver bullet ✅ en §C-04 más abajo. Hallazgo del apply: el schema real ya tenía casi todo lo que `design.md` planeaba (nombres/tipos distintos). D12 (RN-ID-02) se revirtió y luego se restauró el mismo día — la "confirmación" que la revertía nunca pasó, ver §C-04 |
| 3 | Conductores + Vehículos (C-08/C-09) | 🔶 **reconciliado (2026-08-01), bloqueado en 1 gap** | `vehiculo-mantenimiento-registro` (ajuste de categorías, no swap de backend) ya se archivó (commit `501a525`). `openspec/changes/integracion-conductores-vehiculos/` (mock→Supabase de Vehículos+Conductores) se escribió en paralelo con `C-08-vehiculos-mantenimiento` de Enzo (ya mergeado a `main`, commit `f840a96`), sin que ninguno de los dos supiera del otro. **Vehículos**: reconciliado contra el backend real de Enzo (gasto, habilitaciones y kilometraje adoptan su implementación) — ver bullet ⚠️ en §C-08 más abajo, **bloqueado en un gap real** (falta fuente de datos para `mantenimientos`, necesita decisión de Enzo). **Conductores**: sin conflicto con lo que Enzo mergeó (confirmado, ninguna de sus 15 migraciones toca `conductores.conductores`/`conductores_vehiculos`); tanda de mapeo puro (`conductorMapping.ts`, `semanaIso.ts`) completa; el repository real (§7) queda bloqueado porque las migraciones de asignación semanal/estado (`20260801120000_conductores_vehiculos_campos.sql`/`_rpc.sql`) todavía no las escribió nadie |
| 4 | Facturación (C-07) | ✅ **swap real completo (`integracion-facturacion`, 2026-08-12)** — las 5 decisiones de governance de §0 aprobadas, migraciones aplicadas, `FacturacionRoute.tsx` lee/escribe contra `SupabaseFacturaRepository`/`SupabaseCobroRepository` reales; falta solo la verificación manual en navegador con las 3 cuentas (`tasks.md` §8). 🔶 Además, `facturacion-seleccion-autorizacion` (2026-08-13) en progreso: reemplaza el prestador de texto libre del paso 2 por selección de autorización pendiente (`facturas.autorizacion_id`, N:1); governance y tipos/mapeo completos, migraciones escritas sin aplicar, swap del wizard bloqueado hasta que se apliquen | Ver bullet ✅ en §C-07 más abajo. Discrepancias N1-N6 y salvedad D9 (cupo sobre fuente mixta, autorizaciones de fixture) documentadas, no bloquean el swap. N7 (nueva, `facturacion-seleccion-autorizacion`) documentada, no bloquea |
| 5 | Presupuestos (C-06) | ✅ **completo y archivado (2026-08-06)** (`integracion-presupuestos`, ahora en `openspec/changes/archive/2026-08-06-integracion-presupuestos/`) — las 8 secciones de `tasks.md` completas, `PresupuestosRoute.tsx` lee/escribe contra las Edge Functions reales | Verificación con 3 cuentas reales corrida por `curl` directo (no por navegador, decisión de la usuaria) y RN-GL-02 parcialmente cumplida (`usuario_id` null en auditoría, gap aceptado) — dos desviaciones deliberadas y documentadas, ver bullet ✅ en §C-06 más abajo |
| 6 | Hojas de Ruta (C-10) | 🔶 en progreso (apply `integracion-hojas-de-ruta`, 2026-08-04 — WU5a, documentación, completada) | Ver bullet ⚠️ en §C-10 más abajo |
| 7 | Dashboard (C-11) | ⏳ pendiente | Va último — agrega datos de todos los repos reales de arriba |
| 8 | Documentos (storage) | 🔶 **swap 2 de 3 (`documentos-vehiculos-conductores-facturacion`, 2026-08-16)** — Vehículos y Conductores conectados a Storage/Postgres reales; Facturación sigue en mock, bloqueada por decisión pendiente | `integracion-documentos` (2026-08-07) conectó **Pacientes** y dejó Vehículos/Conductores/Facturación a una línea de distancia (repository ya soportaba las 4 entidades, solo faltaba inyectarlo — bloqueado entonces porque ninguna de las tres tenía `entidadId` real). Esa precondición se cumplió con `integracion-conductores-vehiculos` (Vehículo 2026-08-10, Conductor 2026-08-11) e `integracion-facturacion` (2026-08-12). Este change habilitó **Vehículos y Conductores** (1 línea cada uno, `AvisoModeloDatos` de subida simulada retirado en ambos). **Facturación queda afuera a pedido explícito de la usuaria**: el 2026-08-15/16 el checklist de documentos de factura pasó a usar slugs propios (`'comprobante-arca'`, etc.) justo cuando `facturacion.tipos_documento` (catálogo UUID) se creó y la FK de `documento_factura` se repunteó a él — swapear hoy rompe con `22P02` (uuid inválido). Necesita veredicto entre 3 opciones (leer del catálogo real / UUIDs fijos hardcodeados / volver la columna a TEXT) antes de retomarse — ver `openspec/changes/documentos-vehiculos-conductores-facturacion/proposal.md` §Checkpoint A. Ver bullet en §C-03 más abajo |

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
- **Progreso backend (real, C-03, 2026-07-28)**: ✅ implementado y pusheado. Los patrones `documento_{entidad}` de Pacientes/Conductores/Vehículos ya existían de rebote (revisados y corregidos durante C-02). Lo que faltaba: `facturacion.documento_factura` (mismo patrón, FK a `obra_social.tipos_documento` compartido, con `comprobante ARCA`/`asistencia`/`CODEM` seedeados) y, más importante, **las políticas RLS de `storage.objects`** — los 4 buckets de C-01 tenían RLS habilitado sin ninguna política, o sea nadie podía subir/bajar nada todavía. Ahora cada bucket está gateado por `modulos.tiene_permiso()` según su módulo (`documentos-vehiculos` cae bajo `conductores`, no un módulo propio — **desactualizado desde el split de módulos del 30/07**: `integracion-documentos` encontró el 05/08 que la tabla real ya vivía bajo `vehiculos` mientras las policies seguían pidiendo `conductores`; repunteado el mismo día, detalle en el bullet de `integracion-documentos` abajo). Detalle en `openspec/changes/archive/2026-08-06-C-03-gestion-documental-core/`. ✅ **Archivado
  (2026-08-06)**, tasks 7/7 — verificación manual de RLS (upload permitido/rechazado según
  permiso `facturacion`, insert reflejado en `auditoria.logs`) hecha en vivo contra
  `pkryfoljypuzfifofdwp`. **Falta**: nada del lado backend — el componente de UI reutilizable (`DocumentChecklist`) ya existe como mock (FE-1), pendiente de que frontend lo conecte a Storage real.
- **Progreso frontend (mock, vía FE-1)**: ✅ `DocumentChecklist` reutilizable (`frontend/src/shared/components/DocumentChecklist.tsx`) + `DocumentoRepository`/`mockDocumentoRepository` (`frontend/src/shared/lib/documentos/`) con upload mock y latencia simulada. **Falta**: tabla `documento_{entidad}`, integración real con buckets, `audit_log`.
- **Refinamiento posterior (`pacientes-documentos-multiples`, 2026-08-06)**: la cardinalidad 1:1 original del mock (un solo `DocumentoAdjunto` por `itemId`, nunca documentada como decisión de diseño — artefacto de cómo quedó implementado FE-1 la primera vez) quedó levantada por feedback real de la clienta (Andrea Pastor): el checklist admite N documentos por ítem, se acumulan sin sobrescribirse ni tope de cantidad, con distinción visual del documento vigente vía `vigenciaDesde?: string` (mismo naming que `Autorizacion.vigenciaDesde`). Cambio puramente de frontend mock (tipo/componente/hook) — la tabla real `pacientes.documentos` ya soportaba múltiples filas sin migración. Governance CRÍTICO (mismo criterio que los `gateo-*`: pantalla del dominio Pacientes). ✅ **Archivado (2026-08-06)**, tasks 30/30 — verificación manual (múltiples documentos sin sobrescribir, "quitar" puntual, modo solo-lectura, sin regresión cruzada en Vehículos/Conductores/Facturas) confirmada por la usuaria en vivo. Delta spec sincronizada en `openspec/specs/paciente-documentos/spec.md`. Detalle en `openspec/changes/archive/2026-08-06-pacientes-documentos-multiples/`.
- **Refinamiento posterior (`documentos-previsualizacion`, 2026-08-06)**: agrega la acción "Ver" (previsualización en `Overlay`, sin descarga) al `DocumentChecklist` compartido, cableada en los cuatro puntos de montaje (Pacientes, Vehículos, Conductores, Facturas). Contrato nuevo en `DocumentoRepository`: `resolverPrevisualizacion(entidad, entidadId, documentoId): Promise<string | null>` — la interfaz pasa a tener **cuatro** métodos (`listByEntity`, `upload`, `remove`, `resolverPrevisualizacion`); `mockDocumentoRepository` es hoy el único implementador de producción, y corre íntegramente contra `ObjectURL` (mock, se descarta al recargar la página) — **no hay descarga real todavía**, ver el bullet siguiente (`documentos-descarga-firmada`) y la anotación en `knowledge-base/10_preguntas_abiertas.md`. Nuevo componente genérico `Overlay` en `frontend/src/design-system/components.tsx` (overlay centrado con backdrop, `role="dialog"`, foco/Escape/trampa de teclado). Governance CRÍTICO, confirmado explícitamente en `tasks.md` 0.1 (mismo criterio que `pacientes-documentos-multiples`: abre una superficie de lectura nueva sobre documentos clínicos). Detalle en `openspec/changes/documentos-previsualizacion/`.
- **Change futuro anotado, no propuesto todavía (`documentos-descarga-firmada`, 2026-08-06)**: no existe como carpeta en `openspec/changes/` — esta es la primera vez que queda registrado en este archivo. `integracion-documentos` §D6 lo mencionó (y prometió, sin cumplir, dejar esta misma anotación) como el change que implementaría `createSignedUrl()` + botón de descarga; `documentos-previsualizacion` (Checkpoint (b), veredicto **B2 — complementarios por capa**) lo reformula como el change que construye la **resolución real contra Storage + la descarga efectiva**, heredando el contrato de `DocumentoRepository` (incluido `resolverPrevisualizacion()`, ya escrito) y el componente `Overlay` que deja este change. Hasta que se proponga (`/opsx:propose documentos-descarga-firmada`), el criterio de aceptación de US-900 *"se pueden consultar y descargar"* sigue **sin tildar** en `knowledge-base/06_funcionalidades.md` (se consulta sobre mock, no se descarga).
- **Refinamiento posterior (`integracion-documentos`, 2026-08-07)**: swap parcial, mismo criterio de alcance que `C-05`/`C-04`/`C-06` (corte por entidad con `entidadId` real). `PacientesRoute.tsx` inyecta `SupabaseDocumentoRepository` real (`documentoMapping.ts` + repository, 61 tests) contra los 4 buckets de Storage + las 4 tablas reales de este change; Vehículos/Conductores/Facturación siguen con `mockDocumentoRepository` — muestran `AvisoModeloDatos` explicando que la subida sigue simulada hasta `integracion-conductores-vehiculos`/`integracion-facturacion`. Cinco checkpoints de diseño resueltos con veredicto de la usuaria (2026-08-05), incluido uno CRÍTICO (bucket `documentos-vehiculos` gateado por el módulo equivocado, ver corrección arriba). Hallazgo de la verificación manual §8.3: `tipoMime` nunca viajaba desde las tablas reales, así que "Ver" no podía previsualizar ningún documento real — arreglado con `inferirTipoMime()` (deriva el tipo de la extensión del nombre, sin columna nueva), aplica a las 4 entidades. Detalle completo en `knowledge-base/04_modelo_de_datos.md` §Discrepancias, bullet "Documentos vs. esquema real de `C-03`". Governance ALTO. ✅ **Archivado (2026-08-07)**, `tasks.md` §0-§8 completas (8/8), verificación manual con cuentas reales confirmada por la usuaria. Delta specs sincronizadas: capabilities nuevas `documento-contract`, `documento-repository-supabase`, `documento-avisos-modelo-datos` en `openspec/specs/`; nota actualizada en `openspec/specs/paciente-documentos/spec.md`. Detalle en `openspec/changes/archive/2026-08-07-integracion-documentos/`.
- **Refinamiento posterior (`documentos-checklist-por-actividad`, 2026-08-07)**: el checklist documental del paciente (dueño del tipo/componente/repository compartido que se modificó, este change) pasa a instanciarse **por actividad** (`Direccion` del paciente que no es el domicilio: escuela, terapia(s), club) en vez de una sola vez por paciente — feedback real de la clienta (Andrea Pastor), tercera vuelta sobre el mismo mock/contrato tras `pacientes-documentos-multiples` y `documentos-previsualizacion` de arriba. Contrato compartido gana un campo opcional `agrupacionId?: string` en `DocumentoAdjunto`/`DocumentoRepository.listByEntity`/`.upload` (Checkpoint (b), VEREDICTO: opción B); Vehículos/Conductores/Facturación pasan `undefined` y no cambian de comportamiento (verificado con tests dedicados, `tasks.md` §7). `DocumentChecklist.tsx` no cambia de contrato — la UI de N bloques por actividad se resuelve por composición en `PacienteDocumentos.tsx` (D1 de `design.md`). Además: bloque "General" para documentación sin actividad (Checkpoint (c)), progreso por actividad + total agregado (Checkpoint (f)), y advertencia/confirmación al quitar una dirección con documentación cargada (Checkpoint (e), delta nuevo sobre `paciente-direcciones`). A diferencia de `pacientes-documentos-multiples`, esta dimensión **no** tiene respaldo real en la base todavía — `pacientes.documentos` no tiene columna de dirección/actividad, ver `knowledge-base/04_modelo_de_datos.md` §Discrepancias, bullet "Documentación del paciente por actividad — sin columna real", y cartel `AvisoModeloDatos` en la sección de documentación de `PacienteDetail.tsx`. Governance CRÍTICO (mismo criterio que los dos refinamientos anteriores). ✅ **Archivado (2026-08-07)**, tasks 9/9 — todas las 9 secciones de `tasks.md` completas con verificación manual confirmada por la usuaria. **Bug real encontrado y corregido durante verificación (§9.2)**: `SupabaseDocumentoRepository.ts` ignoraba `agrupacionId` completamente (`listarDocumentos` no filtraba, `subirDocumento` ni siquiera aceptaba el parámetro), pese a que el mock sí aislaba. Arreglado con migración `20260807010000_documentos_direccion_id.sql` (columna `direccion_id`, `ON DELETE RESTRICT`) + mapeo real en `documentoMapping.ts`/`SupabaseDocumentoRepository.ts` (commit `9beda7d`). Además, feedback directo de la usuaria: se sacó la barra de progreso individual de cada instancia en Pacientes (nuevo prop `DocumentChecklist.mostrarProgreso`, default `true`, sin efecto en los otros 3 dominios) — solo queda el total agregado del encabezado. Detalle en `openspec/changes/archive/2026-08-07-documentos-checklist-por-actividad/`.
- **Refinamiento posterior (`documentos-transferencia-actividad`, propose 2026-08-10, apply parcial
  2026-08-10/11)**: ✅ **Archivado (2026-08-11)**, 91/103 tasks (§3/§4 — navegación 3.a —
  intencionalmente sin marcar, ver más abajo). Punto 3 de la Ronda 2 de feedback de la clienta
  (Andrea Pastor) — vincular la
  actividad seleccionada con su documentación, exportarla y transferir documentos entre
  actividades. **Contrato compartido gana un quinto método** `transferirAgrupacion(entidad,
  entidadId, documentoId, agrupacionDestino: string | undefined)` en `DocumentoRepository` — `UPDATE`
  de `direccion_id`, nunca toca Storage (D3); Vehículos/Conductores/Facturación no cambian de
  comportamiento (rechazan explícitamente, nunca llamado desde su UI). `DocumentChecklist.tsx` gana
  el prop opcional `onTransferir` (mismo mecanismo opt-in que `mostrarProgreso`), solo habilitado
  desde Pacientes. **Sin migración nueva**: `direccion_id` ya existía (bug-fix de
  `documentos-checklist-por-actividad` de arriba); la traza de cada transferencia queda en
  `auditoria.logs` por el trigger genérico `trg_audit_documentos` ya existente, sin cambios. **Alcance
  de esta pasada de apply, acotado por checkpoint abierto**: entraron 3.b (exportar) y 3.c
  (transferir) — ambas con veredicto confirmado por la usuaria, no provisorias. `3.b` tuvo su
  propia cadena de veredictos sobre "qué produce exportar" (vista imprimible → vista imprimible +
  `.zip` en paralelo → **REVERTIDO a solo `.zip`, 2026-08-11**, la usuaria no le encontró utilidad
  al resumen imprimible — ver `tasks.md` §0.2/§2/§11/§13/§14 del change): "Exportar" arma un `.zip`
  con los archivos reales de la actividad, sin una segunda acción de resumen/impresión. **3.a
  (navegación "marcar una actividad" → su documentación) queda explícitamente fuera**: el pedido
  original prometía un video de la clienta mostrando el flujo, y el video **no llegó**
  (`TODO-video-revision.txt`) — no se elige entre las tres lecturas posibles (acción explícita por
  fila / selección persistente / deep-link desde Hojas de Ruta) adivinando. Declarado en pantalla vía
  `AvisoPendienteCliente` (distinto de `AvisoModeloDatos`: es un requerimiento incompleto, no una
  discrepancia de modelo) en la sección de documentación de `PacienteDetail.tsx`. Governance CRÍTICO
  — primera operación del proyecto que muta la ubicación de un documento clínico ya cargado. Detalle
  completo, incluida la deuda detectada sobre el spec principal de `documento-contract` (desactualizado
  respecto del código desde `pacientes-documentos-multiples`), en
  `knowledge-base/04_modelo_de_datos.md` §Discrepancias. **Delta specs sincronizadas** (2026-08-11):
  capacidades nuevas `paciente-documentos-exportacion`/`paciente-documentos-transferencia`, más
  requisitos agregados en `documento-contract`/`paciente-documentos`/`documento-avisos-modelo-datos`
  en `openspec/specs/` — corregidos antes de fusionar (el delta spec de propose describía también la
  navegación 3.a como si estuviera implementada; se sacó esa parte de `paciente-documentos` y el
  requisito entero de `paciente-direcciones` no llegó a fusionarse, para no dejar un spec principal
  mintiendo sobre una funcionalidad que no existe). Detalle en
  `openspec/changes/archive/2026-08-11-documentos-transferencia-actividad/`.
- **Refinamiento posterior (`documentos-checklist-items-por-actividad`, ✅ Archivado
  2026-08-11)**: el checklist documental del paciente (dueño del tipo/componente/repository
  compartido que se modificó, este change) gana un segundo eje de configuración: ítems propios
  **por tipo de actividad** (escuela, escuela especial, terapia, CET, otro — global, no por obra
  social). Tabla nueva `obra_social.requisitos_actividad` (RLS + auditoría en la misma migración,
  FK al catálogo compartido `obra_social.tipos_documento`, mismo criterio de get-or-create
  normalizado que `requisitos_os`). **`DocumentChecklist.tsx` y el contrato compartido
  `DocumentoRepository` NO cambian** — se resuelve enteramente por composición en
  `PacienteDocumentos.tsx`.
  **Revisión en vivo (2026-08-11, tras probar en el navegador)**: el diseño original (`propose`,
  2026-08-10) sumaba los ítems de la obra social con los del tipo de actividad, deduplicados
  (función pura `combinarItemsDeActividad`). Probando la pantalla real, la usuaria pidió lo
  contrario: cada bloque de actividad muestra **únicamente** sus ítems propios del tipo — **sin
  fusión** con los de la obra social, que quedan exclusivos del bloque "General".
  `combinarItemsDeActividad` se eliminó por quedar sin uso. Efecto colateral aceptado: un tipo sin
  ítems configurados muestra un bloque vacío con mensaje explícito ("Todavía no hay documentación
  configurada para este tipo de actividad...") en vez de heredar los de la obra social como antes
  — el comportamiento **ya no** es idéntico al de antes del change cuando no hay nada configurado
  (a diferencia de lo que decía el diseño original). Documentos ya cargados contra un ítem que
  salió de la lista de un bloque (típicamente por esta reversión) no se pierden: aparecen en la
  sección "Otros documentos" de `DocumentChecklist.tsx` (guard de `documentos-transferencia-actividad`,
  coordinado entre ambos changes, ver bullet de arriba). **Origen del supuesto: el EQUIPO
  (hipótesis de la usuaria), no feedback textual de Andrea Pastor** — a diferencia de los tres
  refinamientos hermanos anteriores de esta pantalla. Governance CRÍTICO (mismo criterio que los
  refinamientos anteriores, y este va más lejos: tabla nueva con RLS propia). Detalle completo,
  incluida la discrepancia sin confirmar, en `knowledge-base/04_modelo_de_datos.md` §Discrepancias
  y las notas `⚠️` sobre RN-FA-08/RN-FA-10 en `05_reglas_de_negocio.md`. Pantalla de
  administración propia en `/documentacion-por-actividad` (capability nueva
  `checklist-por-tipo-actividad`, gateada por el mismo módulo `obra_social` que ya gatea
  `requisitos_os` — reusa `ChecklistEditor`/`ChecklistItemRow` sin tocarlos). **Pendiente**: tarea
  9.4 (verificación de permisos con dos cuentas reales) quedó sin hacer a propósito, anotada como
  deuda técnica antes de confiar en la RLS de `requisitos_actividad` en producción con usuarios
  reales de permisos mixtos. Detalle en
  `openspec/changes/archive/2026-08-11-documentos-checklist-items-por-actividad/`.
- **Refinamiento posterior (`integracion-documentos-autorizaciones`, propose+apply 2026-08-18)**: ✅
  **archivado 2026-08-21**, 19/20 tasks; 5.2 (verificación manual con 2 cuentas reales read/write)
  marcado como pendiente de la usuaria, deliberadamente no bloqueante para archivar. Cierra el último
  pendiente declarado de carga de archivos: el adjunto de la autorización (`AutorizacionForm.tsx:97-102`)
  vivía solo en el estado de React y nunca viajaba al servidor — reportado por la clienta como
  "no funciona la carga de archivos" en Autorizaciones, pero **no era un bug**: estaba escrito como
  requisito en `openspec/specs/autorizacion-repository-supabase/spec.md` (*"MUST NOT enviar un
  `archivoUrl` para un archivo recién elegido"*) y anunciado en pantalla vía `AvisoModeloDatos`.
  Replica el patrón de este change (`C-03`) y de `integracion-documentos`: bucket privado nuevo
  **`documentos-autorizaciones`** (`public = false`, el **quinto**) + 4 policies de `storage.objects`
  gateadas por `modulos.tiene_permiso('presupuestos', …)` — módulo existente desde
  `20260730140000_split_modulos_permisos.sql`, el mismo que ya gatea `facturacion.autorizacion`, no
  se creó uno nuevo (5 buckets confirmados `public=false` en producción, `pkryfoljypuzfifofdwp`,
  2026-08-18). **Sin tabla `documento_autorizacion` y sin `DocumentChecklist`**: a diferencia de
  Pacientes/Vehículos/Conductores/Facturas, el docx modela **un solo "Archivo"** por autorización.
  **Hallazgo que corrigió un supuesto del proposal** (`design.md`, "Hallazgo bloqueante"): las
  columnas `archivo_nombre`/`archivo_cargado_en` **no** estaban aplicadas —
  `20260730120000_revert_presupuesto_archivo_meta.sql` las había dropeado a propósito de
  `facturacion.presupuesto` **y** `facturacion.autorizacion` el mismo día que se crearon. Este change
  **reabre esa decisión solo para `facturacion.autorizacion`** (D4 de `design.md`; `presupuesto`
  queda sin tocar, es alcance de un change hermano futuro) con una migración nueva
  (`20260818090000_add_autorizacion_archivo_meta.sql`), no la revertida. La Edge Function
  `autorizaciones` se extendió (`toApi`/`toDb`) para leer/escribir `archivoNombre`/`archivoCargadoEn`
  junto con `archivoUrl` (deploy confirmado en producción 2026-08-18). Repository
  (`SupabaseAutorizacionRepository.uploadArchivo`/`removeArchivo`, orden compensado UPLOAD→PATCH→
  DELETE viejo, D3/D5) y frontend (`AutorizacionForm.tsx` sube directo al elegir el archivo, retiró
  el `AvisoModeloDatos` de "todavía no se guarda en el servidor") implementados con TDD estricto,
  suite completa en verde (Node 24.14.0 — bug de entorno Node 26+jsdom documentado y evitado, no
  corregido, fuera de alcance). **Fuera de alcance**: la descarga/previsualización firmada del
  adjunto, que sigue dependiendo de `documentos-descarga-firmada` (todavía sin proponer, ver bullet
  arriba) — checkpoint abierto con la usuaria; hoy se muestra nombre + fecha reales, no se abre el
  archivo. Sin conflicto de archivos con los changes en curso: `presupuesto-prestaciones` declaró
  "Sin impacto" sobre `AutorizacionForm.tsx`/`autorizacionMapping.ts`/`facturacion.autorizacion`
  (solape indirecto: su D2 migra Edge Function → RPC, coordinar el orden de apply si se extiende a
  `autorizaciones`), y `facturacion-seleccion-autorizacion` solo **lee** autorizaciones. Governance
  **ALTO** — tocó RLS y acceso a documentación de obra social; confirmación humana explícita recibida
  sobre bucket privado (G1) y gateo por `presupuestos` (G2) antes de escribir/aplicar el SQL (G3,
  alcance de la descarga, queda declarado fuera de alcance arriba). Discrepancia `archivo_url` guarda
  la **clave del objeto en el bucket, no una URL absoluta** — mismo criterio que los otros dominios
  documentales — documentada en `knowledge-base/04_modelo_de_datos.md` §Discrepancias. Detalle en
  `openspec/changes/archive/2026-08-21-integracion-documentos-autorizaciones/`.

### [C-04] `obras-sociales-prestadores`
- **Estado**: ✅ `integracion-obra-social` — 69/70 tasks. Migraciones confirmadas aplicadas y
  verificación con cuentas reales completa (2026-08-06/07, ver bloque abajo). Solo falta un pase
  visual en navegador (drag-and-drop del checklist, editor de plantilla) — nada de backend
  pendiente. Ver `tasks.md` 8.5.
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
- **✅ Verificación completa (2026-08-06/07)**, contra `pkryfoljypuzfifofdwp` vía REST/RPC con JWTs
  reales de la usuaria:
  - `1B.6` — confirmado aplicado (`select proname, prosecdef from pg_proc` → ambas funciones,
    `prosecdef = false`).
  - `1B.7` — no aplica (columna real ya es enum, más estricto que un `CHECK`).
  - `1B.8` — los 6 puntos del checklist verificados en vivo: alta con checklist completo `200`;
    `read` sin `write` → `42501`, 0 filas; `actualizar_...` sobre fila oculta por RLS → **`45103`**
    (confirmado, no `42501` directo — exactamente como anticipaba la nota de `04_modelo_de_datos.md`);
    reorder del checklist persiste; `p_cambios` sin `checklist` no lo borra; ítem sin nombre →
    `45101`, 0 filas (rollback atómico).
  - `8.5` — parcial: la parte de permisos/backend queda cubierta por `1B.8`; falta el pase visual
    (drag-and-drop, editor de plantilla) en navegador.
  - `8.6`/`8.8` — audit log (`INSERT`/`UPDATE`/`DELETE` con `usuario_id` correcto, incluidas las
    filas de `tipos_documento` del get-or-create) y seguridad (`SECURITY INVOKER`, `anon` sin
    `EXECUTE`, 15 advisors preexistentes sin hallazgos nuevos) confirmados.
  - Datos de prueba (obra social + 2 tipos de documento) borrados al terminar.
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
- **Progreso backend (real, C-04, 2026-07-28)**: ✅ implementado, pusheado y **archivado** (2026-08-01) como `C-04-obras-sociales-prestadores` (`openspec/changes/archive/2026-08-01-C-04-obras-sociales-prestadores/`). El schema `obra_social` (incl. `prestadores`, `tipos_documento`, `requisitos_os`) ya existía de rebote desde la revisión de C-02 y ya cubría Código/Dirección/Teléfono/Condición IVA y la entidad Prestadores del docx. Esta migración cerró lo que faltaba: `plazo_cobro_dias`/`modalidad_facturacion`/`admite_pagos_parciales`/`identificador_origen` en `obra_social.obra_social` (nombres/defaults tomados 1:1 de `frontend/src/shared/types/obraSocial.ts`), `orden`/`requerido` en `requisitos_os` (RN-FA-08), y tabla nueva `plantilla_campo`. Sin delta specs (cambio puro de schema/migraciones, mismo caso que `C-02`) — nada que fusionar en `openspec/specs/`. 12/12 tasks completas. **Falta**: cargar el checklist real de OSECAC como dato (contenido de negocio, no estructura — lo carga la administradora desde la app). Nota: este cierre de schema es un change distinto de `integracion-obra-social` (ver **Estado** arriba), que extiende este mismo dominio con la conexión del frontend a Supabase real y ya está archivado (2026-08-07), 69/70, con backend verificado en vivo.
- **⚠️ `prestadores-crud` (rama de demo, `feature/prestadores-crud` como tracker de 4 branches
  encadenadas, propose+apply 2026-08-01, **mergeada a `main` el 2026-08-02** por decisión de
  Enzo/Delfina, sin validar los supuestos con Andrea — ver nota abajo)**: cierra D8 de arriba
  ("`prestadores-crud` queda como change propio") — CRUD completo de Prestador (listado/alta/
  edición, gateado por el módulo `obra_social` existente) más el vínculo N:N con ObraSocial
  (`obra_social.obra_social_prestador`, multi-select en `PrestadorForm.tsx`, panel de solo lectura
  en `ObraSocialDetail.tsx`). Migración `20260801100000_prestadores_condiciones.sql` **escrita, no
  aplicada** (`supabase db push` sigue a cargo de Enzo).

  ⚠️ **Corrección (2026-08-06)**: al investigar para `sacar-prestadores` se confirmó que estas
  migraciones (`20260801100000`, `20260801110000`, `20260801120000`) SÍ habían sido aplicadas
  contra el proyecto Supabase real (`pkryfoljypuzfifofdwp`) — la nota de arriba de "no aplicada"
  era incorrecta. `supabase_migrations.schema_migrations` las tiene registradas y hay datos reales
  sembrados (`obra_social.prestadores`: 2 filas, `obra_social.obra_social_prestador`: 3 filas). Ver
  el bullet `sacar-prestadores` más abajo y
  `openspec/changes/archive/2026-08-06-sacar-prestadores/design.md` D3.

  **Los 5 supuestos de abajo son la premisa
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
- **✅ `sacar-prestadores`** (2026-08-06, decisión de Andrea en reunión del 2026-08-04 —
  `TODO-video-revision.txt` §Prestadores — confirmada por Enzo el 2026-08-06): revierte por
  completo `prestadores-crud` y `factura-por-prestador` de arriba. Andrea (Traslado Personalizado)
  es la única prestadora real de la operación; la tercerización con Uber/remis es mínima y no
  estructurada — no amerita un módulo de gestión propio. Ver
  `openspec/changes/archive/2026-08-06-sacar-prestadores/{proposal,design,tasks}.md`.
  - **Frontend, borrado completo**: `features/prestadores/` (10 archivos), `shared/types/
    prestador.ts`, `shared/lib/prestadores/` (5 archivos), `shared/lib/mocks/
    mockPrestadorRepository.ts`+test, `shared/lib/mocks/prestadoresFixture.ts`,
    `features/facturacion/PrestadorSelector.tsx`+test, ruta `/prestadores` y su ícono de nav.
  - **Facturación, Paso 2 del wizard**: el selector de Prestador se reemplaza por dos campos de
    texto libre ("Nombre"/"Domicilio"), sin entidad ni repository — `Factura.prestadorId?: string`
    pasa a `prestadorNombre?: string`/`prestadorDomicilio?: string` (flat). `tipoComprobanteBloqueado`
    se elimina: tipo de comprobante vuelve a ser siempre editable a mano, revirtiendo el
    comportamiento que había introducido `factura-por-prestador`. `faltaElegirPrestador` se
    renombra a `faltaCompletarPrestador`, gateando ahora sobre ambos campos de texto completos.
  - **Checkpoint de datos huérfanos (resuelto, ver design.md D1)**: `Prestador.plazoCobroDias`
    nunca tuvo un consumidor real fuera de sus propias pantallas (ya borradas) —
    `calcularFechaEstimadaCobro` siempre recibió `plazoObraSocial: undefined`. Nada que mover de
    vuelta a `ObraSocial`. `Prestador.tipoComprobante` sí estaba activamente leído — se resuelve
    quitando el lock, no con un auto-fill nuevo. Las columnas vestigiales
    `plazo_cobro_dias`/`tipo_comprobante` de `obra_social.obra_social` (anteriores a Prestador, de
    `20260729110000_schema_obra_social_facturacion_config.sql`) quedan fuera de scope, sin tocar.
  - **Backend**: `supabase/migrations/20260806180000_sacar_prestadores.sql` — dropea
    `obra_social.obra_social_prestador` y `obra_social.prestadores`. **Aplicada el 2026-08-06**
    vía `supabase db push --linked` (Enzo). No dropea `facturacion.tipo_factura` (enum compartido).
    `supabase/functions/prestadores/` se borra localmente y la función deployada en Supabase se dio
    de baja el mismo día con `supabase functions delete prestadores --project-ref
    pkryfoljypuzfifofdwp`.
  - `openspec/changes/prestadores-crud/` y `openspec/changes/factura-por-prestador/` se archivaron
    (2026-08-06) como **dropped** — `openspec/changes/archive/2026-08-06-prestadores-crud-dropped/`
    y `openspec/changes/archive/2026-08-06-factura-por-prestador-dropped/` — registro histórico de
    lo que se construyó, sin mergear sus specs delta a `openspec/specs/` (describirían una entidad
    que ya no existe).
  - `tsc -b --noEmit` limpio, suite completa verificada, `grep -rni "prestador"` sin restos de la
    entidad `Prestador` en `frontend/src`/`supabase/functions` (quedan `prestadorNombre`/
    `prestadorDomicilio` y comentarios de historia, ambos esperados) antes de dar el change por
    terminado.
- **Refinamiento posterior (`paginacion-listados`, 2026-08-12)**: `ObrasSocialesList` pasa a
  listado paginado server-side, mismo patrón que Pacientes (ver detalle completo en la nota
  equivalente de `C-05` más abajo). `listPage()` aditivo sobre `ObraSocialRepository`, `list()`
  intacto. Sin checkpoint de semántica de búsqueda — filtra pocas columnas, sin ambigüedad
  relevante.

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
  `openspec/changes/archive/2026-08-06-C-08-vehiculos-mantenimiento/` de Enzo, ya mergeado a `main` (commit `f840a96`):
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
  `openspec/changes/archive/2026-08-06-C-08-vehiculos-mantenimiento/`. ✅ **Deploy confirmado
  (2026-08-06)**: migración `20260730110000_schema_vehiculo_gaps.sql` aplicada contra el proyecto
  Supabase real (`pkryfoljypuzfifofdwp`, `supabase migration list --linked` con local == remote) y
  ambas funciones (`vehiculos`, `vehiculo-documentos`) `ACTIVE` (`supabase functions list`). Queda
  pendiente: una Edge Function para registrar mantenimiento preventivo/correctivo cuando el
  frontend tenga esa pantalla (hoy no existe, `gasto`/`kilometrajeUltimoService` son los únicos
  casos con consumidor real); el campo `Notas` (3er punto de la discrepancia) queda igual de
  pendiente que antes, del lado frontend.

---

## FASE 2 — Entidades dependientes

### [C-05] `pacientes-fichas-clinicas`
- **Estado**: ✅ `integracion-pacientes` — 64/66 tasks. Verificación completa contra
  `pkryfoljypuzfifofdwp` (2026-08-07, ver bloque abajo). Solo falta un pase visual en navegador
  (`tasks.md` 7.5) y una decisión explícitamente diferida sobre montar pgTAP (`1B.5`, no
  bloqueante) — nada de backend pendiente.
- **✅ Verificación completa (2026-08-07)**, vía REST/RPC con JWTs reales de la usuaria:
  - `1.3` — consulta de humo autenticada vía PostgREST (no SQL Editor) → sin `PGRST106`.
  - **🐛 Bug bloqueante encontrado y corregido**: `crear_paciente_completo` (vigente desde
    `20260806160000_reparar_direcciones_lat_lng.sql`, heredado sin cambios desde la primera versión
    a través de 5 reescrituras) nunca casteaba `tipo_lugar` al enum `pacientes.tipo_direccion` en el
    INSERT de `direcciones` — **cualquier alta con al menos una dirección con tipo cargado fallaba
    con `42804`**, nadie lo había agarrado porque ninguna verificación anterior hizo una llamada
    real end-to-end. Fix aplicado con confirmación explícita de la usuaria:
    `supabase/migrations/20260807000000_crear_paciente_completo_tipo_lugar_cast.sql` (aditiva, mismo
    patrón de siempre, único cambio real un `::pacientes.tipo_direccion` explícito).
  - `1B.4` — los 6 puntos verificados post-fix: alta completa (7 tablas, incluida cobertura) `200`;
    `pacientes: read` sin `write` → `42501`, 0 filas; `pacientes: write` sin `obra_social: write`
    con afiliado cargado → `42501` sobre `coberturas_paciente`, 0 pacientes (rollback total);
    accesorio inexistente → `45001`, 0 filas; `prosecdef = false`; audit log completo.
  - `7.5` — parcial: backend/permisos cubierto por `1B.4`/`7.6`; falta el pase visual.
  - `7.6` — audit log de alta (las 7 tablas) y de una edición (`UPDATE` con `datos_viejos`/
    `datos_nuevos` completos) confirmados, ambos con `usuario_id` correcto.
  - `7.7` — rollback probado: `PacientesRoute.tsx` revertido a mock, suite verde (157/157), reaplicado,
    `git diff` contra el estado previo vacío.
  - `7.8` — `SECURITY INVOKER` y `anon` sin `EXECUTE` reconfirmados post-fix.
  - Datos de prueba (pacientes + cobertura) borrados al terminar.
- **`personas-a-cargo-parentesco` (2026-08-05)**: agregado directo (sin change OPSX propio, pedido
  puntual de la usuaria) — `PersonaACargo.parentesco` (unión cerrada `padre|madre|tutor_legal|otro`,
  `<select>` obligatorio, `PersonasACargoEditor.tsx`). Columna `pacientes.personas_a_cargo.parentesco`
  agregada NULLable (migración `20260805130000_personas_a_cargo_parentesco.sql`), RPC
  `crear_paciente_completo` actualizada para persistirla, mapeo (`pacienteMapping.ts`) y `update()`
  (upsert genérico ya existente) cubiertos. **✅ Aplicado y verificado (2026-08-05)**: `supabase db
  push --include-all` (junto con el índice pendiente de `integracion-presupuestos`,
  `20260802100000_presupuesto_autorizacion_indices.sql`), `supabase migration list` confirma
  local/remoto sincronizados, y `supabase db advisors --linked --type security` antes/después dio
  exactamente los mismos 8 hallazgos preexistentes (ninguno nuevo sobre `personas_a_cargo` ni
  `crear_paciente_completo`, que sigue `SECURITY INVOKER`). **⚠️ Discrepancia con el docx** (no
  modela este campo): ver `knowledge-base/04_modelo_de_datos.md` §Discrepancias, entrada "Personas a
  Cargo", y cartel `AvisoModeloDatos` en `PacienteDetail.tsx`.
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
- **Refinamiento posterior (`pacientes-documentos-multiples`, 2026-08-06)**: la pantalla Pacientes → Documentos (dueña de este change, `C-05`) pasó a admitir múltiples documentos por ítem del checklist en vez de uno solo — feedback real de la clienta (Andrea Pastor). Ver detalle completo en la nota equivalente de `C-03` (dueño del tipo/componente compartido que se modificó) más arriba; sin cambio de schema, `pacientes.documentos` ya soportaba la cardinalidad.
- **Refinamiento posterior (`documentos-previsualizacion`, 2026-08-06)**: la pantalla Pacientes → Documentos (dueña de este change, `C-05`) suma el botón "Ver" para previsualizar cada documento adjunto sin salir de la pantalla, contra el mock (`ObjectURL`) — sin descarga real todavía. Ver detalle completo en la nota equivalente de `C-03` (dueño del tipo/componente/repository compartido que se modificó) más arriba; mismo governance CRÍTICO, sin cambio de schema.
- **Refinamiento posterior (`documentos-checklist-por-actividad`, 2026-08-07)**: la pantalla Pacientes → Documentos (dueña de este change, `C-05`) pasa a instanciar el checklist documental por actividad (escuela, terapia(s), club — el domicilio no) en vez de una sola vez por paciente, con bloque general para documentación sin actividad y advertencia/confirmación al quitar una dirección con documentos cargados. Ver detalle completo en la nota equivalente de `C-03` (dueño del tipo/componente/repository compartido que se modificó) más arriba; a diferencia de los dos refinamientos anteriores, esta dimensión **no** tiene columna real en `pacientes.documentos` todavía (cartel `AvisoModeloDatos` en pantalla), mismo governance CRÍTICO.
- **Refinamiento posterior (`documentos-transferencia-actividad`, propose 2026-08-10, apply parcial
  2026-08-10/11)**: la pantalla Pacientes → Documentos (dueña de este change, `C-05`) gana un botón
  "Exportar" por bloque de actividad (arma un `.zip` con los archivos reales) y la acción
  "Transferir" por documento (reasignar a otra actividad o a "General", con confirmación explícita y
  refresco de ambos bloques afectados sin recargar). Ver detalle completo en la nota equivalente de
  `C-03` (dueño del contrato/componente compartido que se modificó) más arriba. **La navegación
  "marcar una actividad → su documentación" (3.a del mismo pedido) queda fuera de esta pasada**,
  bloqueada por un video de la clienta que no llegó — cartel `AvisoPendienteCliente` en pantalla,
  distinto del `AvisoModeloDatos` del bullet anterior (acá no hay discrepancia de modelo, hay un
  requerimiento incompleto). **Revertido (2026-08-11)**: "Exportar" tuvo, por un rato el mismo día,
  una vista imprimible ("Ver resumen"/"Imprimir", con embebido del documento vigente de cada ítem
  cargado) en paralelo al `.zip` — la usuaria decidió sacarla por completo ("siento que no tiene
  utilidad"), quedando solo el `.zip` como acción de exportación. Detalle de la cadena de
  veredictos en `tasks.md` §0.2/§2/§11/§13/§14 del change. Mismo governance CRÍTICO.
- **Refinamiento posterior (`documentos-checklist-items-por-actividad`, ✅ Archivado
  2026-08-11)**: la pantalla Pacientes → Documentos (dueña de este change, `C-05`) suma un segundo
  eje de configuración documental por tipo de actividad. **Revisión en vivo (2026-08-11)**: el
  diseño original fusionaba, en cada bloque de actividad, los ítems propios del tipo con los de la
  obra social (`+N ítems propios de esta actividad`); tras probar en el navegador, la usuaria pidió
  que cada bloque muestre **solo** sus ítems propios, sin fusión — el bloque "General" sigue
  exclusivo de la obra social, sin cambios. Un tipo sin ítems configurados muestra ahora un mensaje
  explícito ("Todavía no hay documentación configurada...") en vez de heredar los de la obra social
  — **ya no** es "idéntico al comportamiento de antes" cuando no hay nada configurado, a diferencia
  de lo previsto en el diseño original. `DocumentChecklist.tsx` no cambió en ningún momento. Ver
  detalle completo (tabla, RLS, pantalla de administración, cadena de revisión) en la nota
  equivalente de `C-03` (dueño del tipo/componente/repository compartido) más arriba. El porcentaje
  de avance de pacientes ya completos **va a bajar** (y con más fuerza que en el diseño original:
  documentos ya cargados contra un ítem de la obra social dentro de un bloque de actividad quedan
  huérfanos, no solo diluidos) el día que se configure algún ítem por tipo — no es un bug, avisado
  a la usuaria antes de archivar (`tasks.md` 9.6). Mismo governance CRÍTICO que los cuatro
  refinamientos anteriores de esta pantalla, y el que va más lejos de los cinco: crea tabla nueva
  con RLS propia sobre documentación de salud, apoyada en una regla de negocio sin confirmar (ver
  nota `⚠️` en `05_reglas_de_negocio.md` RN-FA-08/RN-FA-10). **Pendiente**: tarea 9.4 (verificación
  de permisos con dos cuentas reales) sin hacer a propósito, deuda técnica anotada.
- **Refinamiento posterior (`paginacion-listados`, propose+apply 2026-08-12)**: `PacientesList`/
  `PacientesPage` (dueña de este change) pasan a listado paginado server-side (`.range()` +
  `count: 'exact'`, 20 por página, sin selector de tamaño) con búsqueda por tokens contra
  `nombre_a`/`nombre_b`/`apellido_a`/`apellido_b`/`dni` (AND de ORs — cambia la semántica del
  buscador: `"perez juan"` ahora encuentra a "Juan Pérez" aunque antes no, y una subcadena que
  cruza el límite nombre/apellido deja de matchear; veredicto de la usuaria: aceptado). `listPage()`
  se agregó **aditivo** a `PacienteRepository` — `list()` sigue igual, sin params, porque selectores
  de formulario (`PresupuestosRoute.tsx`, `PacienteForm`, `FacturaForm`) y cálculos de dashboard
  (`useAlertasCud`, `useDatosFinancieros`) necesitan el padrón completo, no una página; paginar ahí
  habría producido alertas clínicas silenciosamente incorrectas. Mismo patrón replicado en
  Conductores y Obras Sociales (ver notas en `C-09` y `C-04`) y en Hojas de Ruta con una solución
  distinta (ver nota en `C-10`, no es paginación). **Deuda que deja abierta, documentada a
  propósito**: Vehículos/Presupuestos/Autorizaciones NO se paginaron — pasan por Edge Functions
  (`supabase/functions/vehiculos`, `/presupuestos`, `/autorizaciones`) que hoy no aceptan
  `limit`/`offset`/`count`, paginarlas requiere editar y redesplegar esas functions (fuera del
  alcance de un change de frontend, deploy a cargo de la usuaria/Enzo). Facturas/Cobros tampoco —
  `FacturacionRoute.tsx` sigue con `mockFacturaRepository` sobre `localStorage`; el swap real es
  `integracion-facturacion`, bloqueado en su propio portón de governance (§C-07 arriba); cuando se
  desbloquee, `SupabaseFacturaRepository` debería nacer ya con `listPage` para no repetir este
  trabajo. Cuentas quedó afuera por padrón chico y pantalla solo-admin (más riesgo que beneficio
  hoy). **Próximo paso sugerido si el padrón de pacientes sigue creciendo**: typeahead/autocomplete
  server-side para los selectores que hoy siguen usando `list()` completo. Página 20 fija sin
  selector y `?pagina=N` sin persistir en la URL, ambos por decisión explícita de la usuaria, a
  reevaluar con uso real. Detalle completo en `openspec/changes/paginacion-listados/design.md`.
- **Refinamiento posterior (`catalogo-accesorios-movilidad`, propose+apply 2026-08-16)**: el
  catálogo de accesorios de movilidad (dueño de este change, `C-05`, tabla `pacientes.accesorios`)
  pasa de semilla estática a **catálogo gestionable** — baja la discrepancia #11 de
  `04_modelo_de_datos.md` §Discrepancias (unión cerrada en el frontend vs. `tipo` libre): el nuevo
  selector reutilizable `AccesoriosMovilidadSelector` (feature `pacientes`, usado por el form de
  Paciente y el de Vehículo `C-08`) permite alta/edición/baja lógica inline del catálogo, gateado
  por `pacientes:write`. Migración `20260816090000_catalogo_accesorios_icono_activa.sql` (aditiva,
  **la aplica la usuaria/Enzo**): columnas `icono` (clave del design system, backfill `icono = tipo`)
  y `activa` (baja lógica), y ampliación de la policy de LECTURA del catálogo a los módulos
  `vehiculos`/`conductores` (docx: catálogo compartido por el Área de Conductores) — la escritura
  sigue SOLO para `pacientes`; sin RPC ni Edge Function (plan recortado). Frontend: 7 consumidores
  migrados de la lista estática `ACCESORIO_MOVILIDAD_LABELS` a `labelAccesorio(tipo)`/`iconoAccesorioMap`,
  se elimina `accesorioMovilidadOptions.ts`; vehículo/forma de pago intactos. **✅ completado y
  archivado (2026-08-15)** — 25/25 tasks, `openspec archive` nativo, specs delta fusionadas a
  `openspec/specs/` (incluye `catalogo-accesorios-movilidad` nueva). Detalle en
  `openspec/changes/archive/2026-08-15-catalogo-accesorios-movilidad/`.

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
- **Refinamiento posterior (`paginacion-listados`, 2026-08-12)**: `ConductoresList` pasa a listado
  paginado server-side, mismo patrón que Pacientes (detalle completo en la nota equivalente de
  `C-05` más arriba). `listPage()` aditivo sobre `ConductorRepository`, `list()` intacto. Sin
  checkpoint de semántica de búsqueda.

---

## FASE 3 — Reglas de negocio de facturación y operación diaria (paralelizable en 2 ramas)

### [C-06] `presupuestos-autorizaciones`
- **Estado**: `[x]` completo — backend implementado, pusheado y archivado (2026-08-01, ver bullet
  "Progreso backend" abajo) y frontend swapeado a Supabase real, verificado y archivado
  (`integracion-presupuestos`, 2026-08-06, ver bullet ✅ más abajo). Dos desviaciones deliberadas
  respecto del plan original (verificación por `curl` en vez de navegador, RN-GL-02 parcial) quedan
  documentadas y aceptadas, no son blockers.
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
- **✅ Completo y archivado** (`integracion-presupuestos`, cerrado 2026-08-06): las 8 secciones de
  `tasks.md` (0 — governance, 1 — precondiciones, 1B — migración de 3 índices e índices aplicados por
  la usuaria/Enzo, 2 — mapeos puros, 3 — repositories + traducción de errores, 4 — **el swap real**
  (`PresupuestosRoute.tsx` reemplazó los cuatro mocks por
  `supabasePresupuestoRepository`/`supabaseAutorizacionRepository`/`supabasePacienteRepository`/
  `supabaseObraSocialRepository`), 5 — carteles `AvisoModeloDatos`, 6 — documentación, 7 —
  verificación) están **completas**. Suite completa sin regresiones, `tsc -b`/`oxlint` limpios,
  cobertura ≥85% en `shared/lib/presupuestos/`. **`FacturacionRoute.tsx` no se tocó** (D11, confirmado
  por grep). **La pantalla lee/escribe datos reales** — arranca con los 2 presupuestos de prueba
  dejados a propósito (ver más abajo), no con 0 filas como preveía D9 originalmente, pero no es una
  regresión. Archivado en `openspec/changes/archive/2026-08-06-integracion-presupuestos/`; los 6
  delta specs quedaron fusionados en `openspec/specs/{presupuesto,autorizacion}-*/spec.md`.
  - **⚠️ Dos desviaciones deliberadas respecto del plan original — decisión explícita de la usuaria,
    no ocultas**:
    1. **`tasks.md` 7.5** ("verificación manual en el navegador" con 3 cuentas reales) **no se hizo
       clickeando la pantalla**: se verificó el mismo contrato (alta/edición/lectura por rol,
       `403` explícito para `facturacion` sin `presupuestos`, mensaje de RN-PA-01 traducido) por
       `curl` directo contra las Edge Functions con tokens de sesión reales de las 3 cuentas —
       detalle completo en `tasks.md` 1B.4. La usuaria juzgó esto suficiente (2026-08-06) y decidió
       no hacer la pasada adicional por el navegador. **Lo que esto NO prueba**: comportamiento que
       vive solo en el componente React (que el ítem de menú desaparezca para la cuenta sin permiso,
       que el botón de guardar de una cuenta `read` no dé una falsa sensación de éxito).
    2. **RN-GL-02 (rastro de alta/edición) parcialmente cumplida**: `auditoria.logs` registra el
       *qué* (INSERT/UPDATE con `datos_nuevos` correctos) pero `usuario_id` llega `null` en las
       escrituras de este módulo — el trigger de auditoría usa `auth.uid()`, que no resuelve nada
       cuando la escritura llega vía la Edge Function operando con `service_role` (D3). Es un gap
       **conocido, aceptado y documentado, no un blocker** — ver
       `knowledge-base/04_modelo_de_datos.md` §Discrepancias #14 y `10_preguntas_abiertas.md`,
       decisor nombrado **Enzo/backend**.
  - **⚠️ Datos de prueba reales dejados a propósito en producción** (decisión de la usuaria,
    2026-08-06, no revertida): los presupuestos `dd72b2a8-0002-4ea9-b60a-7d4d763e68af` (monto 16000)
    y `8dd7904b-7e2a-4ac2-9795-db6080a21342` (monto 20000), con sus autorizaciones asociadas, son
    filas reales creadas durante 1B.4 y siguen en la base real — no son de un ambiente de prueba
    aparte.
  - **⚠️ Permiso modificado en producción durante la prueba, no revertido**: a
    `facturacion@pastor.com` se le retiró `presupuestos: write` durante la verificación de 1B.4(c)
    (para probar el caso "cuenta de facturación sin acceso a presupuestos") y la usuaria decidió
    dejarlo así — esa cuenta hoy **no tiene** `presupuestos: write` en producción.
- **⚠️ Hallazgo de arquitectura abierto (D12)**: el proyecto tiene **dos backends en paralelo sobre
  las mismas tablas** —Edge Functions (`C-04`…`C-07`, `service_role` + `requirePermiso`) y
  PostgREST + RLS + RPC (los changes de integración)— y **ningún change lo declaró como decisión**.
  En particular, `integracion-facturacion` propone crear `crear_factura_completa`/
  `actualizar_factura_completa` sin mencionar que las Edge Functions `facturas` y `cobros` ya están
  deployadas (verificado: la cadena "Edge Function" no aparece en su `proposal.md` ni en su
  `design.md`). `integracion-presupuestos` **declara el hallazgo y no lo resuelve** — unificar es un
  change transversal. **Decisor**: equipo técnico.
- **⛔ BLOQUEANTE heredado de `integracion-facturacion` D9 (registrado acá 2026-08-13, sin resolver)**:
  la migración commiteada `20260724100005_schema_facturacion.sql` crea las policies de
  `facturacion.presupuesto`/`facturacion.autorizacion` con `tiene_permiso('facturacion', …)`, pero la
  base real las tiene con **`tiene_permiso('presupuestos', …)`** — verificado dos veces contra
  `pg_policies` (`integracion-facturacion` 1.3, y de nuevo por este mismo `integracion-presupuestos`,
  D11 arriba, que lo confirma "cerrado y verificable" **para su propio transporte**: como
  `PresupuestosRoute.tsx` habla con las Edge Functions `presupuestos`/`autorizaciones` — D2,
  `service_role` + `requirePermiso` — un perfil con `facturacion` sin `presupuestos` recibe un `403`
  explícito ahí, no 0 filas). **Eso no cierra la trampa para Facturación**:
  `SupabaseFacturaRepository`/`AlertaCupo.tsx` (`C-07`) no hablan con esas Edge Functions — si en el
  futuro `AlertaCupo.tsx` pasara a leer `presupuesto`/`autorizacion` directo por PostgREST (como hace
  hoy con el resto de sus lecturas), un perfil con `facturacion: read/write` y sin `presupuestos: read`
  va a ver **0 autorizaciones en silencio, sin ningún error** — el modo de falla "policy de SELECT
  faltante → 0 filas silenciosas". **Bloqueante a resolver antes de integrar Presupuestos/Autorizaciones
  de verdad con Facturación**: hoy la validación de cupo de Facturación (`AlertaCupo.tsx`, RN-FA-02)
  sigue operando sobre fuente mixta — facturas reales × autorizaciones de **fixture**
  (`integracion-facturacion` D9 opción A, cartel `AvisoModeloDatos` visible, sección 6 de `tasks.md` de
  ese change) — así que el modo de falla todavía no se disparó en producción, pero queda latente para
  quien cablee esa pantalla a Postgres real. **Decisor**: backend (Enzo) — corregir las policies para
  que coincidan con la migración commiteada (`facturacion`), o documentar `presupuestos` como el módulo
  correcto y ajustar el comentario de la migración; en cualquier caso, decidir explícitamente antes de
  que `AlertaCupo.tsx` deje de usar el fixture.
- **🔶 Reapertura post-archivo (`presupuesto-prestaciones`, propose+apply 2026-08-12)**: `C-06` se
  reabre **parcialmente**, solo para agregar el vínculo opcional presupuesto↔prestación — la
  decisión de `monto` único de este bullet **no se reabre** (ver
  `knowledge-base/04_modelo_de_datos.md` §Discrepancias, entrada nueva sobre
  `presupuesto.prestacion_id`, que cita la #13 sin editarla). Tres PRs encadenadas: (1) catálogo
  nuevo `pacientes.prestaciones` (tabla + `PrestacionesEditor.tsx` + sección en `PacienteDetail.tsx`),
  (2) columna `facturacion.presupuesto.prestacion_id` (nullable, aditiva) + dos funciones Postgres
  `SECURITY INVOKER` (`crear_presupuesto_completo`, `crear_presupuestos_lote`) reemplazando el CRUD
  directo del Edge Function, (3) bifurcación de `PresupuestoForm.tsx` por
  `ObraSocial.modalidadFacturacion` (`por-prestacion`: multi-select + alta en lote atómica;
  `general`: líneas de prestación + monto sumadas en frontend, sin persistir el desglose). La
  relación Autorización↔Presupuesto sigue 1:1 sin cambios. Detalle completo en
  `openspec/changes/presupuesto-prestaciones/design.md`.
- **⚠️ Discrepancia con Traslados-Modelo-Datos.docx — REAPERTURA #13 (`facturacion-cambios-ui`
  WU1, decisión usuaria 2026-08-16)**: la modalidad `general` **sí persiste ahora su desglose por
  prestación** en la tabla nueva `facturacion.presupuesto_linea` (migración
  `20260816110000_presupuesto_lineas.sql`, FK N:1 a `presupuesto` ON DELETE CASCADE y a
  `pacientes.prestaciones` ON DELETE RESTRICT, RLS espejo de "Read/Write presupuesto",
  `trg_audit_presupuesto_linea`, alta vía `p_lineas` en `crear_presupuesto_completo` y `lineas`
  opcionales por ítem del lote, códigos 45401-45403 intactos + 45404 nuevo). El bullet anterior
  ("la decisión de `monto` único no se reabre") queda parcialmente superado: `monto` sigue siendo
  un importe único (en `general`, la suma del desglose), pero el desglose ya no se descarta. La
  entrada de la KB sobre `presupuesto.prestacion_id` y la #13 de §Discrepancias se actualizan en
  `knowledge-base/04_modelo_de_datos.md`; `AvisoModeloDatos` de `PresupuestoResumen.tsx`
  actualizado en el mismo WU. **Pendiente de confirmar con la usuaria** al aplicar la migración
  (`supabase db push`).
- **🔶 Reapertura post-archivo (`presupuestos-vigencia-datos-traslado-vista-previa`, propose+apply
  2026-08-21, ✅ archivado 2026-08-22, 8/10 tasks)**: pendientes 0.6 (G4, pregunta a Andrea sobre
  CD/SD, no bloqueante) y 10.4 (verificación manual con 2 cuentas reales), ambas diferidas por
  decisión explícita de la usuaria. `C-06` se reabre de nuevo, esta vez para agregar vigencia, dependencia (par
  pedido/concedido, no solo del lado del presupuesto) y el bloque de datos de traslado del
  formulario de la obra social, más el tipo MIME del adjunto de autorización y la vista previa de
  ese adjunto (extracción de `ContenidoPreview`/`DocumentChecklist.tsx` a
  `VistaPreviaArchivo.tsx`, reusable). **No reabre la #13** (desglose por prestación) ni toca
  `monto`/`monto_autorizado`/la cardinalidad 1:1 Autorización↔Presupuesto. 13 columnas nuevas en
  `facturacion.presupuesto`, 3 en `facturacion.autorizacion`, `CREATE OR REPLACE` de
  `crear_presupuesto_completo`/`crear_presupuestos_lote` (mismas 2 funciones que reabrió
  `presupuesto-prestaciones`). Bloqueada por orden hasta que `presupuesto-prestaciones` (D9,
  bifurcación de `PresupuestoForm.tsx` en `simple`/`general`/`por-prestacion`) estuviera aplicado.
  Detalle completo en
  `openspec/changes/archive/2026-08-22-presupuestos-vigencia-datos-traslado-vista-previa/design.md`.
- **⚠️ Discrepancia con Traslados-Modelo-Datos.docx** (detalle completo en
  `openspec/changes/archive/2026-08-22-presupuestos-vigencia-datos-traslado-vista-previa/design.md` §Discrepancias):
  cinco campos/bloques nuevos, ninguno en el docx, cada uno con su propio cartel
  `AvisoModeloDatos`:
  1. `presupuesto.vigencia_desde` / `vigencia_hasta` (`PresupuestoForm.tsx`, `PresupuestoResumen.tsx`).
  2. `autorizacion.vigencia_hasta` (`AutorizacionForm.tsx`) — completa el par pedido/concedido que
     ya había abierto `vigencia_desde` (bullet ✅ más arriba, "el frontend agregó
     `Autorizacion.vigenciaDesde?`").
  3. `presupuesto.con_dependencia` / `autorizacion.con_dependencia` (`PresupuestoForm.tsx`,
     `AutorizacionForm.tsx`) — el docx solo tiene "dependencia y retorno" como texto libre en
     **Factura**, no un booleano pedido/concedido acá.
  4. Bloque completo de datos de traslado, 10 columnas (`PresupuestoForm.tsx`,
     `PresupuestoResumen.tsx`) — replica el formulario en papel de la obra social; deliberadamente
     **no reusa** `RecorridoHabitual` (ciclo de vida distinto, design.md D2).
  5. `autorizacion.archivo_tipo_mime` (`AutorizacionForm.tsx`).

  Las 5 quedan documentadas también en `knowledge-base/04_modelo_de_datos.md` §Discrepancias, sin
  reabrir la #13. **Nota de reapertura post-archivo**: si en el futuro se necesita confirmar contra
  el docx real (no solo documentar la discrepancia), este bullet es el punto de entrada — mismo
  criterio que las reaperturas anteriores de `C-06` (`presupuesto-prestaciones`,
  `facturacion-cambios-ui` WU1).
- **⚠️ Reapertura post-archivo (`autorizacion-mensual`, propose+apply 2026-08-22)**: `C-06` se reabre
  de nuevo — esta vez para romper la cardinalidad 1:1 Autorización↔Presupuesto que las reaperturas
  anteriores de esta sección habían dejado explícitamente intacta (bullet
  `presupuestos-vigencia-datos-traslado-vista-previa` arriba: *"no toca... la cardinalidad 1:1
  Autorización↔Presupuesto"*). Pedido verbatim de Andrea, punto 7 de la llamada del 2026-08-21:
  *"Una autorización por mes, no una sola por presupuesto: el valor del km cambia mes a mes, así que
  cada mes llega una autorización distinta con su propio monto."* Columna aditiva
  `facturacion.autorizacion.periodo_mes DATE` (`CHECK` día-1, nullable = modelo anterior, sin
  backfill) + índice único parcial `(presupuesto_id, periodo_mes) WHERE periodo_mes IS NOT NULL`.
  **Sin `DROP CONSTRAINT`**: verificado que `presupuesto_id` nunca tuvo `UNIQUE`
  (`20260724100005_schema_facturacion.sql:26-34`) — el 1:1 era convención de aplicación
  (`.maybeSingle()` + `getByPresupuestoId(): Promise<Autorizacion | null>`), no un constraint de
  schema. `getByPresupuestoId` se **reemplaza** (no convive) por `listByPresupuestoId(): Promise<Autorizacion[]>`;
  el `404` de "sin autorización" pasa a `200 []`.
  **Levanta dos decisiones de `facturacion-seleccion-autorizacion` que asumían el 1:1**, ambas
  verificadas línea por línea antes de citarlas:
  1. `facturacion-seleccion-autorizacion/design.md:82` (tabla de atributos de su D1, columna
     `UNIQUE`) — cita verbatim, confirmada: *"La relación es N:1: cupoMensualDias/cupoMensualKm son
     un cupo mensual recurrente y cupoConsumido ya suma facturas por período. Una autorización
     genera una factura por mes. Un UNIQUE haría imposible facturar el segundo mes."* Con
     `autorizacion-mensual` ya no hay "el mes recurrente" de una única autorización: cada mes es su
     propia fila, y `cupoConsumido`/`montoConsumido` pasan a leerse **por mes** (D8) sin que cambie
     una línea de esa función — las dos semánticas (anual para legacy, mensual para filas con
     `periodo_mes`) conviven en el mismo código.
  2. El supuesto 0..1 de `AutorizacionRepository.getByPresupuestoId(): Promise<Autorizacion | null>`,
     confirmado en `facturacion-seleccion-autorizacion/design.md:9-11,27-30` (*"un paciente puede
     tener varias autorizaciones vigentes al mismo tiempo, sin importar la modalidad"*, sobre la base
     de que cada presupuesto tiene **0..1** autorización). ⚠️ **Corrección al brief original de este
     change**: la línea `:124` que se le atribuía a la cita *"NO cambia la relación
     Autorización↔Presupuesto. Sigue siendo 1:1, sin excepciones"* **no existe verbatim en el archivo**
     (verificado con `grep -rn "1:1" facturacion-seleccion-autorizacion/` → sin resultados; la línea
     124 real de ese `design.md` corresponde al "Riesgo asumido" de su D2, sobre RPC de facturas, sin
     relación con esta cita). El supuesto real que se levanta es el tipo de retorno 0..1 citado
     arriba, no una frase textual inexistente — `autorizacion-mensual/design.md` D5 lo reemplaza por
     `listByPresupuestoId(): Promise<Autorizacion[]>`.
  **No reabre la #13** (desglose por prestación) ni el `monto`/`monto_autorizado` como importes
  únicos por fila. Detalle completo en `openspec/changes/autorizacion-mensual/design.md` D1-D12,
  gates de governance G1-G6 en `proposal.md`. Bloqueante externo (Andrea): Open Questions 1 y 2
  sobre RN-PA-01 por mes y sobre la vigencia contenida en el mes, `knowledge-base/10_preguntas_abiertas.md`.

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
- **Refinamiento posterior (`paginacion-listados`, 2026-08-12)**: a diferencia de las otras tres
  pantallas de este change (ver nota completa en `C-05`), `HojaDeRutaPage` **no se paginó** —
  design.md §D7 razona que no es un listado, es la vista de **un solo día**, y hoy la resuelve
  trayendo `useHojasDeRuta()` → `list()` (embed de 3 niveles hoja→recorrido→historial_recorridos
  sobre **toda la historia**) + `.find(h => h.fecha === fecha)` para quedarse con uno. Pasa a
  `getByFecha(fecha)`, que ya existía en `HojaDeRutaRepository`/`SupabaseHojaDeRutaRepository` —
  la lectura más cara de la app resuelta sin escribir código nuevo en la capa de datos. Preserva el
  refetch `{ silencioso: true }` de `crear`/`actualizar` (fix `59caedc`, "el refetch post-mutación
  no debe sacar al operador del modo edición") con test de regresión explícito a nivel hook e
  integración.

---

## FASE 4 — Facturación y cobros

### [C-07] `facturacion-asistencias-cobros`
- **Estado**: `[~]` backend implementado y pusheado (2026-07-30); swap de frontend a datos reales
  completo (`integracion-facturacion`, 2026-08-12, ver bullet ✅ más abajo) — falta la verificación
  manual con las tres cuentas reales en navegador (`tasks.md` §8 de `integracion-facturacion`)
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
- **⚠️ Discrepancia con `docs/core/Traslados-Modelo-Datos.docx` — reescrito 2026-08-12 contra la
  realidad verificada, ya no contra datos mock** (detalle completo en `04_modelo_de_datos.md`
  §Discrepancias, bloque "Facturación vs. esquema real de `C-07`", y en `openspec/changes/
  integracion-facturacion/design.md` D12): de los 5 puntos originales, **4 ya estaban cerrados en
  la base real antes de que este change empezara** — (1) `asistencia_prestacion` existe (FK
  `ON DELETE CASCADE`, RLS, auditoría); (2) `documento_factura` existe (doble FK, RLS, auditoría —
  el schema está resuelto, lo que falta es el swap del repository, ver D8 más abajo); (3)
  `fecha_estimada_cobro` existe como columna propia de `facturas`; (4) `cantidad_km` existe como
  columna propia de `facturas`. El quinto queda **parcial**: (5) el enum `estado_factura` **sí**
  tiene `facturado`, pero además conserva `pendiente` — un literal que el frontend nunca modeló, se
  resuelve por mapeo client-side (`estadoDesdeBase`/`estadoHaciaBase`), no por schema. Este change
  además documenta **6 discrepancias nuevas** (N1-N6 en `design.md` D12) descubiertas al verificar
  el schema real: `fecha_factura` faltante (N1, resuelta acá — ver D3 más abajo), el enum
  (N2, ver punto 5), nullability amplia (N3, absorbida en el mapeo, reportada a backend),
  `presupuesto`/`autorizacion` gateadas por el módulo `presupuestos` en vez de `facturacion` (N4,
  ver §C-06 más abajo), FK sin índice (N5, 6 índices agregados por este change), y 10+ columnas/2
  tablas del schema real aplicadas fuera del historial de migraciones del repo (N6, elevado a
  `10_preguntas_abiertas.md`).
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
- **✅ Wizard de alta de factura archivado** (`facturacion-wizard-paciente-prestador`, 2026-08-05):
  convierte el alta de factura en un flujo por etapas (Paciente → Obra social/Prestador → resto),
  sin tocar lógica de negocio, datos persistidos ni comportamiento de edición (la edición de una
  factura existente sigue mostrando todo el formulario junto, sin wizard). 138/138 tests de
  facturación en verde, `tsc -b --noEmit` limpio, verificación manual en navegador confirmada por
  la usuaria y uso real confirmado por Enzo. Archivado en
  `openspec/changes/archive/2026-08-05-facturacion-wizard-paciente-prestador/`.
- **Progreso backend (real, C-07, 2026-07-30)**: ✅ implementado, pendiente deploy. Cerró los 3
  puntos de la discrepancia de arriba (`asistencia_prestacion`, `cantidad_km`,
  `fecha_estimada_cobro`) más 6 campos adicionales que el discrepancy log no tenía listados pero
  el contrato real de `Factura` sí exige (`prestacion`, `mes_facturado`/`anio_facturado`,
  `dependencia_y_retorno`, `domicilio_id`, `identificador_origen`/`identificador_valor`). Edge
  Functions `facturas` (asistencias embebidas con reemplazo completo, mapeo de `estado` porque el
  enum de la base todavía tiene `'pendiente'`) y `cobros` (sin `PATCH`, `CobroRepository` no lo
  tiene). Detalle en `openspec/changes/archive/2026-08-06-C-07-facturacion-asistencias-cobros/`.
  ✅ **Deploy confirmado (2026-08-06)**: migración `20260730100000_schema_factura_gaps.sql`
  aplicada contra el proyecto Supabase real (`pkryfoljypuzfifofdwp`, `supabase migration list
  --linked` con local == remote) y ambas funciones (`facturas`, `cobros`) `ACTIVE` (`supabase
  functions list`). Queda pendiente: confirmar con el cliente los defaults de
  `10_preguntas_abiertas.md` antes de implementar la validación de cupo y el cálculo de fecha
  estimada de cobro como lógica de servidor (hoy son funciones puras del frontend, no replicadas
  acá).
- **🔶 Propose completo del swap de backend** (`integracion-facturacion`, 2026-07-31):
  `proposal.md` + `design.md` (14 decisiones D1-D14) + `tasks.md` + 5 delta specs
  (`factura-repository-supabase` nueva, `factura-contract`/`factura-estados-circuito`/
  `factura-cupo-validacion`/`cobro-registro` modificadas). Los 4 defaults de negocio de
  `10_preguntas_abiertas.md` se **heredan sin cerrarlos** (identificador de factura, período
  estructurado, plazos 90/60/45, ARCA manual) — la usuaria confirmó ese criterio antes del propose.
- **✅ Apply completo (`integracion-facturacion`, 2026-08-12)**: las 5 decisiones de governance
  (D3, D4, D6, D9, D10, ver detalle histórico más abajo) fueron aprobadas y ejecutadas. Migraciones
  aplicadas (`facturacion.facturas.fecha_factura` agregada, dos funciones `SECURITY INVOKER`
  `crear_factura_completa`/`actualizar_factura_completa`, 6 índices sobre FK sin `CONCURRENTLY`),
  `facturaMapping.ts` + `SupabaseFacturaRepository.ts` + `SupabaseCobroRepository.ts`
  implementados, y **el swap real de `FacturacionRoute.tsx` está hecho** — la pantalla de
  Facturación lee y escribe contra Postgres real, ya no contra `mockFacturaRepository`/
  `mockCobroRepository`. Los 3 carteles de discrepancia (`FacturaAvisoDiscrepancias.tsx`,
  `FacturaDocumentos.tsx`, `AlertaCupo.tsx`) están reconciliados contra el schema real (sección 6
  de `tasks.md`). D9 se resolvió con la opción **A** (fuente mixta + `AvisoModeloDatos` en
  `AlertaCupo.tsx`) — la alerta de cupo sigue operando sobre autorizaciones de fixture hasta que
  `integracion-presupuestos` se cablee acá, ver bullet siguiente y §C-06 más abajo. Queda pendiente
  únicamente la verificación manual en navegador con las tres cuentas reales (`tasks.md` §8).
- **🔶 En progreso — `facturacion-seleccion-autorizacion`** (propose 2026-08-13, mismo dominio
  CRÍTICO, gobernanza propia aprobada 2026-08-13): reemplaza el paso 2 del wizard de alta de
  factura ("Obra social / Prestador", dos `Input` de texto libre sin entidad detrás) por la
  **selección explícita de una autorización pendiente de facturar** del paciente elegido en el
  paso 1, derivada client-side (`PresupuestoRepository.list()` + `AutorizacionRepository
  .getByPresupuestoId()`, mismo patrón O(N) que ya paga hoy `resolverCupoAutorizado`, sin
  endpoints ni métodos de repository nuevos). Agrega `facturas.autorizacion_id UUID REFERENCES
  facturacion.autorizacion(id)` (nullable, **sin `UNIQUE`**: la relación es **N:1** — una
  autorización habilita varias facturas en el tiempo, una por período, coherente con que
  `cupoMensualDias`/`cupoMensualKm` son un cupo mensual recurrente) y reemplaza
  (`CREATE OR REPLACE FUNCTION`) las dos RPC vivas de facturación para leer/escribir ese vínculo.
  `AlertaCupo`/`resolverCupoAutorizado` dejan de adivinar la autorización (la primera con cupo
  cargado) y pasan a derivar el cupo de la autorización **elegida**. De paso retira
  `prestadorNombre`/`prestadorDomicilio` del alta (remanente sin columna real del change ya
  revertido `sacar-prestadores`, no una discrepancia con el docx). **Riesgo aceptado y explícito**:
  no hay control de doble facturación del mismo período — el picker no lleva lógica de período, se
  confía en que la usuaria no elige la misma autorización dos veces para el mismo mes; es una
  asunción de negocio confirmada con la usuaria, documentada como riesgo, no como garantía del
  sistema (ver `10_preguntas_abiertas.md`). Discrepancia N7 documentada en
  `04_modelo_de_datos.md` §Discrepancias. **Estado a la fecha**: governance (§0) y tipos/mapeo
  aditivos (§2) completos con TDD (340 tests verdes); migraciones escritas pero **no aplicadas**
  (§1B, las aplica la usuaria/Enzo); el swap real del wizard (§3) sigue **bloqueado** hasta que se
  apliquen. Detalle completo en `openspec/changes/facturacion-seleccion-autorizacion/`.
- **Historial de la decisión de governance (a cargo de Enzo/backend, ya resuelto)** — portón §0 de
  `tasks.md`, gobernanza CRITICO, las 5 decisiones que bloqueaban el apply:
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
    - **⚠️ Nota de coordinación (`integracion-presupuestos`, 2026-08-05 — no toca
      `integracion-facturacion/`, que sigue con su propio portón de governance CRÍTICO sin abrir)**:
      esta D9 **cambia de forma** una vez que `integracion-presupuestos` termine de cablearse. (1)
      Las autorizaciones **dejan de ser fixture** del lado de Presupuestos — ya son reales desde el
      2026-08-05 (`PresupuestosRoute.tsx`), así que la "fuente mixta" pasa a ser "Facturación en
      mock, Presupuestos real" en vez de "las dos en mock". (2) **La trampa de RLS que este bullet
      anota queda verificada y cerrada**: confirmado contra `pg_policies` que las cuatro policies de
      `facturacion.presupuesto`/`autorizacion` gatean por el módulo `presupuestos`, no `facturacion`
      (detalle en `knowledge-base/04_modelo_de_datos.md` §Presupuesto/Autorizacion), y con las Edge
      Functions un perfil con `facturacion` sin `presupuestos` recibe un **403 explícito** en vez de
      0 filas en silencio. (3) El remedio de esta D9 pasa a ser, literalmente, **cambiar dos líneas**
      de `FacturacionRoute.tsx` (inyectar
      `supabasePresupuestoRepository`/`supabaseAutorizacionRepository`, ya escritos y exportados por
      `integracion-presupuestos`) en vez de elegir entre las opciones A/B/C originales de esta D9.
      **Ojo**: `1B.4` de `integracion-presupuestos` (verificación con cuentas reales del gateo de
      permisos) todavía no se corrió — el punto (2) está verificado por lectura de `pg_policies`, no
      por comportamiento observado en producción con una cuenta real.
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
  - ⚠️ Discrepancia con `Traslados-Modelo-Datos.docx` (2/4, **actualizada 2026-08-13,
    `integracion-facturacion`, queda A MITAD**): el estado **`facturado`** ya existía en el enum real
    de `facturacion.estado_factura` **antes de este change** (no era un hueco de schema, ver
    `04_modelo_de_datos.md` §Discrepancias bloque "Facturación vs. esquema real de `C-07`", punto 5);
    lo que sí faltaba de verdad era **`facturas.fecha_factura`** (fecha de emisión), agregada recién
    por `integracion-facturacion` (D3, `ALTER TABLE ... ADD COLUMN fecha_factura DATE`, nullable, sin
    default). El dato ya existe en la base real y sobrevive a un recargar (swap de
    `SupabaseFacturaRepository` hecho). **Lo que sigue faltando** es que `C-11` (todavía en mock,
    `dashboard-ui`) lea `fecha_factura`/`estado` reales para calcular RF-801 — hoy la tarjeta de
    facturas en mora sigue sobre el repositorio mock del propio `dashboard-ui`, no sobre
    `SupabaseFacturaRepository`. Cierra del todo cuando `C-11` haga su propio swap de backend.
  - ⚠️ Discrepancia con `Traslados-Modelo-Datos.docx` (3/4, **CERRADA 2026-08-13,
    `integracion-facturacion`**): la factura del docx no tenía **período de atribución estructurado**
    (solo `Fecha inicial / tope`), pero el schema real de `facturacion.facturas` **sí** tiene
    `mes_facturado`/`anio_facturado` como columnas propias (verificado contra
    `information_schema.columns`, `integracion-facturacion` tarea 1.3) — mapeadas 1:1 a
    `mesFacturado`/`anioFacturado` del frontend por `parseFacturaRow`. "¿Cuánto facturamos en marzo?"
    ya tiene respuesta única sobre datos reales; falta únicamente que `C-11` los consuma (mismo gap
    que el punto 2/4 de arriba).
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
