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
- **Gap detectado post-`auth-frontend-real` → dividido en 4 changes, uno por módulo (2026-07-29)**: el análisis paraguas `gateo-escritura-formularios` (5 preguntas abiertas) fue resuelto por la usuaria y archivado (`openspec/changes/archive/2026-07-29-gateo-escritura-formularios-split/`), dividido en `gateo-obrasocial`, `gateo-pacientes`, `gateo-facturacion` y `gateo-conductores` — uno por módulo real del backend, cada uno revisable de forma independiente. Decisiones cerradas por la usuaria: deshabilitar nunca ocultar, sí al aviso visible de modo solo lectura, agrupación módulo→pantalla tal cual `seed_modulos.sql`, todas las acciones de escritura al nivel `write` (ninguna requiere `admin`). Contexto: `auth-frontend-real` entregó `tienePermiso`/`usePermiso` con la jerarquía `read < write < admin` completa pero **deliberadamente no la cableó en nivel `write` a ninguna pantalla**; hoy una cuenta con solo `read` sobre un módulo entra a la pantalla y ve los botones *Crear*/*Editar* y los formularios de alta/edición plenamente interactivos, y el intento de guardar recién falla después, en el servidor. **Nota de seguridad**: NO es un agujero — la autorización efectiva de escritura la impone la RLS vía `modulos.tiene_permiso(mod, 'write')`, ya desplegada en `20260724100003..100006`. **Governance: CRÍTICO** en los 4 — `/opsx:apply` requiere aprobación humana explícita antes de escribir código, y el cierre de cada uno requiere verificación manual con una cuenta real de solo `read` (a cargo de la usuaria).
  - **`gateo-obrasocial` (2026-07-29)**: ✅ **implementado** — primer change del split, construye el **mecanismo compartido** que consumen los otros tres sin modificarlo: contexto de permiso de escritura por ruta sembrado en `RequireAuth` (`shared/auth/PuedeEscribirContext.tsx`), hook `usePuedeEscribir()` sin argumentos (`shared/auth/usePuedeEscribir.ts`), y 3 primitivas de design system (`design-system/components.tsx`): `<CamposSoloLectura>` (envoltorio `<fieldset disabled>`), prop opt-in `requiereEscritura` en `Button`, y `<AvisoSoloLectura />`. Estrenado cableando los 8 puntos de escritura de `/obras-sociales` (listado, detalle, formulario, checklist documental y plantilla de factura), incluido el bloqueo de reordenamiento por arrastre en `ChecklistItemRow`/`PlantillaCampoRow` (los únicos 2 componentes `draggable` del proyecto — el `<fieldset disabled>` no los cubre, se condicionan aparte). Firma pública documentada en `shared/auth/PuedeEscribirContext.tsx` para que los otros 3 changes la consuman sin re-derivarla. Suite: 1013 → 1063 tests (+50), cero tests preexistentes editados, `tsc -b --noEmit` y `oxlint` limpios, cero `any`. **Falta**: verificación manual humana con una cuenta real de solo `read` contra el proyecto Supabase (a cargo de la usuaria — mismo patrón de cierre que `auth-frontend-real`).
  - **`gateo-pacientes` (2026-07-29)**: ✅ **implementado** — segundo change del split, **consume** el mecanismo compartido de `gateo-obrasocial` sin modificarlo. Cablea los ~13 puntos de escritura de `/pacientes` (la superficie más grande del split: 13 componentes, ~3000 líneas), la primera con **tres editores anidados en profundidad** (`CudFields`, `DireccionesEditor`, `PersonasACargoEditor`, colgando de `PacienteDetail` fuera de `PacienteForm`) y con **componente de documentos**: `PacientesList` (alta y edición por fila, más su `<button>` nativo "Ver detalle"), `PacienteResumen` ("Editar datos"), `PacienteForm` (un solo envoltorio cubre `PacienteDatosPersonalesFields`/`PacienteCoberturaFields`/`IdentificadorAfiliadoField` sin tocarles la firma), `CudFields` (4 puntos de escritura gateados, su *Cancelar* interno deliberadamente **no** gateado — no persiste nada), `DireccionesEditor` y `PersonasACargoEditor` (envoltorio único por editor, cubre sus `<button>` nativos), `PacienteDocumentos`/`PacienteDocumentosChecklist` (solo carga/baja gateada vía el `readOnly` ya existente de `DocumentChecklist`; consultar y descargar documentos ya cargados sigue disponible con `read`, nunca más restrictivo que la RLS), y `PacientesPage` (aviso de solo lectura, mismo componente/tono/texto que `ObraSocialesPage`). Verificado de punta a punta contra `RequireAuth` real que el permiso de otro módulo (`obra_social`) no habilita este. Suite: 1063 → 1101 tests (+38), cero tests preexistentes editados (confirmado por `git diff --stat`, 0 líneas eliminadas en los archivos de test tocados), `tsc -b --noEmit` y `oxlint` limpios, cero `any`, cero cambios en el mecanismo compartido ni en `supabase/`/`permisos.ts`/`usePermiso.ts`/`app/routes.ts` (confirmado por `git diff --stat` vacío). **Falta**: verificación manual humana con una cuenta real de solo `read` sobre `pacientes` (a cargo de la usuaria).
- **⚠️ Discrepancia con `docs/core/Traslados-Modelo-Datos.docx`** — **RESUELTA 2026-07-28**: el docx efectivamente describe un campo `Rol` fijo en Usuarios (Administrador con bypass total / Empleado con permisos por módulo) más "protección contra autopromoción de rol", confirmado al releer el docx completo — el docx manda en estructura, así que `03_actores_y_roles.md` queda desactualizado en este punto (pendiente de sincronizar).
- **Progreso backend (real, C-02, 2026-07-28)**: ✅ implementado y pusheado al proyecto Supabase real (`pkryfoljypuzfifofdwp`) — schemas `usuarios` (tabla + `rol_enum` admin/empleado + trigger anti-autopromoción + `handle_new_user()` siempre `empleado`, admin se asigna a mano una única vez por SQL Editor), `modulos` (catálogo + `permisos` + `tiene_permiso()`), `auditoria` (`logs` + `log_action()` trigger genérico, lectura para cualquier usuario autenticado por texto explícito del docx). Funciones Edge (service-role): `create-user` (único camino de alta de cuenta, no hay registro público) y `update-permisos` (admin-only, reemplazo completo del set de permisos de una cuenta existente — upsert de lo que se manda, borra el resto). Catálogo de módulos seedeado con los 4 módulos reales del docx (`pacientes`, `obra_social`, `facturacion`, `conductores` — no los 9 nombres de carpeta del frontend). RF-004 (ingreso/egreso, prioridad Media) también implementado: trigger sobre `auth.users.last_sign_in_at` para `ingreso_at`, trigger sobre `auth.audit_log_entries` (acción `logout`) para `egreso_at`. De paso se revisaron y corrigieron bugs de RLS/nombres de módulo en las migraciones draft de `obra_social`/`pacientes`/`facturacion`/`conductores` (existían sin commitear desde 2026-07-24) y se corrigió `20260727000001_create_buckets.sql` (`storage.create_bucket()` no es una función SQL invocable — se cambió a `INSERT INTO storage.buckets`). Detalle completo en `openspec/changes/C-02-usuarios-permisos-auditoria/`.

---

## FASE 1 — Núcleo de dominio compartido (paralelizable en 3 ramas)

> Con auth y RLS listos, tres dominios independientes entre sí pueden avanzar en paralelo: documentación transversal, obras sociales, y flota. Ninguno depende de los otros dos.

### [C-03] `gestion-documental-core`
- **Estado**: `[ ]` pendiente
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
- **Progreso frontend (mock, vía FE-1)**: ✅ `DocumentChecklist` reutilizable (`frontend/src/shared/components/DocumentChecklist.tsx`) + `DocumentoRepository`/`mockDocumentoRepository` (`frontend/src/shared/lib/documentos/`) con upload mock y latencia simulada. **Falta**: tabla `documento_{entidad}`, integración real con buckets, `audit_log`.

### [C-04] `obras-sociales-prestadores`
- **Estado**: `[ ]` pendiente
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
- **Progreso frontend (mock, vía FE-2)**: ✅ CRUD de obras sociales, editor de checklist (drag-and-drop + fallback accesible) y editor de plantilla de factura — implementado y archivado como `obras-sociales-ui` (`openspec/changes/archive/2026-07-24-obras-sociales-ui/`), 23/24 tasks completas (falta solo verificación manual en navegador, no bloqueante). Antes de escribir la migración real, coordinar con quien implemente el backend los nombres de campo de `ObraSocial` definidos en su `design.md` (mock en `localStorage`, checklist embebido en el tipo, plantilla de factura como `PlantillaCampo[]`, `identificadorOrigen` configurable por IN-01).
- **⚠️ Discrepancia con `docs/core/Traslados-Modelo-Datos.docx`** (señalizada con carteles `AvisoModeloDatos` en `ObraSocialDetail.tsx`, detalle en `04_modelo_de_datos.md`):
  - El docx no tiene `plazoCobroDias`/`modalidadFacturacion`/`admitePagosParciales`/`plantillaFactura` en absoluto (son reglas de negocio reales, RN-FA-07/08 — hay que sumarlas a la migración, no descartarlas).
  - El checklist en el docx es una tabla de vínculo ("Requisitos de la Obra Social") contra un catálogo compartido de Tipos de Documento, no un array embebido en `obra_social`.
  - Faltan en el frontend campos que sí están en el docx: Código, Dirección, Teléfono, Condición frente al IVA.
  - El docx agrega una entidad "Prestadores" (razón social, CUIT, dirección, teléfono) que no está en el scope de este change ni en la KB — evaluar si entra acá o en un change propio.

### [C-08] `vehiculos-mantenimiento`
- **Estado**: `[ ]` pendiente
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
- **Progreso frontend (mock, vía FE-2)**: ✅ CRUD de vehículos, selector de accesorios de movilidad, toggle habilitado/fuera de servicio, vista de mantenimiento (alertas de service y VTV/RTO), registro de gastos y checklist documental — implementado y archivado como `vehiculos-ui` (`openspec/changes/archive/2026-07-24-vehiculos-ui/`), 24/24 tasks completas, verificación manual en navegador confirmada por el usuario. Antes de escribir la migración real, coordinar con quien implemente el backend los nombres de campo de `Vehiculo` definidos en su `design.md` (mock en `localStorage`, `gastos`/`habilitaciones` embebidos en el tipo).
- **⚠️ Discrepancia con `docs/core/Traslados-Modelo-Datos.docx`** (señalizada con carteles `AvisoModeloDatos` en `VehiculoDetail.tsx`, detalle en `04_modelo_de_datos.md`):
  - En el docx, kilometraje actual y próximo vencimiento (por fecha o por km) viven en la tabla `mantenimiento_registro`, no embebidos en `vehiculo` — revisar si `kilometraje`/`kilometrajeUltimoService`/`fechaUltimoService` deberían ser columnas derivadas del último registro de mantenimiento en vez de campos propios.
  - VTV/RTO en el docx son solo ítems del catálogo genérico de documentos vehiculares, sin fecha de vencimiento propia (el vencimiento se rastrea vía mantenimiento) — distinto de `RegistroHabilitacion` en el frontend, que sí tiene `fechaVencimiento`.
  - Falta el campo `Notas` (observaciones sobre el vehículo) que sí está en el docx.
  - El docx ubica `gasto_vehiculo` bajo el módulo de permisos "facturacion", no "conductores" — importa para las RLS policies de este change.

---

## FASE 2 — Entidades dependientes

### [C-05] `pacientes-fichas-clinicas`
- **Estado**: `[ ]` pendiente
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
  - **Pendiente**: el número de afiliado acá es un valor único y actual; el docx lo modela como "Cobertura del Paciente", una entidad histórica (N coberturas por paciente con fecha desde/hasta) — sin historial de coberturas ni de obras sociales anteriores acá.
  - **Pendiente**: el docx separa "Direcciones" (catálogo: calle + tipo) de "Recorridos" (dirección inicial/final + día + hora); acá están fusionados en un solo tipo `Direccion` con `tramo` (ida/vuelta), un campo que no existe en el docx.
  - **Pendiente**: el CUD del docx tiene un campo booleano "Vigente" propio; acá se calcula al vuelo, no se persiste.

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
  - **Pendiente**: "Restricciones" acá es un catálogo cerrado (`RestriccionConductor[]`); en el docx es texto libre dentro de un único campo "Notas" junto con las observaciones — reconciliar con el punto 1 de arriba (catálogo cerrado pendiente de confirmar con el cliente) **y coordinar con Enzo (backend) antes de cerrar C-09**.
  - El docx modela la asignación semanal con **Fecha de inicio** y **Fecha de fin de semana** como dos campos de fecha independientes, no como la etiqueta ISO única del punto 5 de arriba.

---

## FASE 3 — Reglas de negocio de facturación y operación diaria (paralelizable en 2 ramas)

### [C-06] `presupuestos-autorizaciones`
- **Estado**: `[ ]` pendiente
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
  - **Bloqueante para cerrar la tabla `autorizacion`**: la Autorización no tiene ningún campo numérico comparable con el `Monto` del Presupuesto — RN-PA-01 ("autorización ≤ presupuesto, nunca mayor") no es directamente validable con el modelo real tal como está. El frontend agregó `montoAutorizado?` al contrato para poder validarla, pero falta decidir con backend/cliente si se suma `monto_autorizado` a la tabla o si la regla en realidad compara cupos (días/km), no dinero.
  - **Bloqueante para cerrar la tabla `autorizacion`**: no hay campo de vigencia retroactiva (RN-PA-02) — solo "Fecha de respuesta". El frontend agregó `vigenciaDesde?`, pendiente de que el backend sume `vigencia_desde`.
  - Menor: el Presupuesto del docx es un monto único (no "estimación anual por prestación"), y trae `obraSocialId` explícito que el ERD de la KB no dibujaba — se siguió el docx en ambos casos, sin cartel dedicado.

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
  - Menores, ya con cartel propio en la UI (agregado 2026-07-25, antes solo cubiertos por el cartel general): el orden de recogida y las coordenadas del mapa no existen en el docx (cartel en `RecorridoCard.tsx`); la franja horaria y las notas al pie del agregado `HojaDeRuta` tampoco existen en el docx (cartel en `HojaDeRutaPage.tsx`).

---

## FASE 4 — Facturación y cobros

### [C-07] `facturacion-asistencias-cobros`
- **Estado**: `[ ]` pendiente
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
  (`openspec/changes/facturacion-ui/`, pendiente de archivar), 61/61 tasks incluida la
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
- **Progreso frontend (mock, vía FE-7)**: ✅ implementado como `dashboard-ui` (`openspec/changes/dashboard-ui/`, pendiente de archivar), 59/60 tasks (9.5 verificación manual en navegador queda para el usuario, mismo patrón que FE-5/FE-6). Tipos de proyección (`PeriodoMeses`, `SerieFacturadoVsCobrado`, `ResumenAnual`, `FacturaEnMora`, `PacienteCudPorVencer`, `AlertaMantenimientoVehiculo`, `ResumenDelDia`) y 6 funciones puras test-first en `shared/lib/reportes/` (`periodosDelRango`, `facturadoVsCobrado`, `resumenAnual`, `facturasEnMora`, `cudPorVencer`, `alertasMantenimiento`, `resumenDelDia`), con `CobroRepository.list()` agregado de forma aditiva. Cero duplicación de reglas de negocio: invoca `estadoVencimientoFactura`/`estadoCud`/`estadoServicePreventivo`/`estadoHabilitacion` de sus módulos dueños en vez de reimplementarlas. `DashboardRoute` inyecta 6 repositorios mock de solo lectura (Factura, Cobro, Paciente, Vehículo, HojaDeRuta y Conductor — este último no anticipado en el design original, agregado para resolver nombre de conductor en el panel de recorridos) — verificado con test de espías que ningún `create`/`update`/`remove` se invoca nunca. Montado en `/` (`router.tsx`), reemplazando el placeholder. Suite en verde (640 baseline → 766 tests), `tsc -b` y `oxlint` limpios.
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
