## Why

El frontend de Pacientes está completo (CRUD, ficha, direcciones, personas a cargo, CUD, documentos,
gateo de escritura por permiso, ~1272 tests en el repo) pero **habla con `mockPacienteRepository`**:
un fixture en `localStorage` con latencia simulada. El backend de Pacientes ya existe y está aplicado
(`supabase/migrations/20260724100004_schema_pacientes.sql`: 10 tablas + RLS por
`modulos.tiene_permiso('pacientes', …)` + triggers de auditoría), pero **ningún dato real llega a la
pantalla**: hoy solo Auth y Cuentas tienen integración real (relevamiento verificado 2026-07-30,
`ROADMAP-FRONTEND.md` §FASE FE-8).

Este es el change **1 de la serie de integración por módulo** (mismo patrón de split que
`gateo-obrasocial` / `gateo-pacientes` / `gateo-conductores` / `gateo-facturacion` /
`gateo-hojas-de-ruta`, los 5 archivados). Pacientes va primero porque es la entidad núcleo que
Presupuestos (FE-4), Hojas de Ruta (FE-5) y Facturación (FE-6) referencian: cerrar su contra-parte
real desbloquea el criterio de mapeo para todos los módulos que vienen después.

## What Changes

- **Nueva implementación real `SupabasePacienteRepository`** en
  `frontend/src/shared/lib/pacientes/SupabasePacienteRepository.ts`, que cumple la interfaz
  `PacienteRepository` existente **sin cambiarle una sola firma** (`list`, `getById`, `create`,
  `update`).
- **Nuevo módulo de mapeo puro** `frontend/src/shared/lib/pacientes/pacienteMapping.ts`: funciones
  puras fila-de-Postgres → `Paciente` y `Paciente` → filas, con type guards explícitos (nunca `any`,
  nunca `as`). Toda la lógica testeable sin tocar red.
- **Se cambia un solo archivo de producto**: `frontend/src/features/pacientes/PacientesRoute.tsx`
  (composition root) pasa a inyectar el repository real. Ningún componente, hook ni context de la
  feature se toca — es exactamente lo que el comentario de ese archivo viene anunciando desde
  `pacientes-ui`.
- **`mockPacienteRepository` NO se borra**: queda como doble de test y como implementación de
  respaldo para desarrollo sin backend. Deja de ser la implementación inyectada en producción.
- **Se documentan 11 discrepancias** entre el esquema real y el modelo del frontend siguiendo la
  convención `AvisoModeloDatos` del proyecto (nota en `knowledge-base/04_modelo_de_datos.md`
  §Discrepancias + bullet en `CHANGES.md` + cartel visible en la pantalla). **Ninguna se resuelve
  unilateralmente en código.** Las de mayor impacto:
  1. `IdentificadorAfiliado.formato` **no tiene columna** en la BD (solo
     `obra_social.coberturas_paciente.num_afiliado TEXT`) — IN-01 sigue abierta.
  2. El número de afiliado vive en el schema **`obra_social`**, gateado por el permiso
     `obra_social`, no `pacientes`: una cuenta con `pacientes: write` y sin `obra_social: read` no
     puede leer ni escribir ese campo.
  3. `pacientes.direcciones` no tiene `localidad`, `dias` ni `horario` (los dos últimos viven en
     `pacientes.recorridos`, hoy gateado por el módulo **`hojas_de_ruta`**).
  4. `clinicos.diagnostico` es `JSONB`, el frontend lo modela `string`.
  5. `paciente.amparo_judicial_aclaracion` no existe.
- **Una migración nueva, aditiva y reversible**: `supabase/migrations/20260730180000_crear_paciente_completo.sql`
  agrega la función `pacientes.crear_paciente_completo(jsonb) RETURNS uuid`, que hace el alta
  multi-tabla **atómica** en una sola transacción (revisión de `design.md` D4 confirmada por la
  usuaria el 2026-07-30, con aval de backend). Se declara **`SECURITY INVOKER`** a propósito: las
  policies de RLS existentes siguen evaluándose contra el usuario que llama, así que un usuario sin
  `modulos.tiene_permiso('pacientes','write')` no puede crear pacientes por esa vía.
  **`SECURITY DEFINER` está explícitamente prohibido** — bypassearía el gateo por módulo.
- **NO se crea ni se altera ninguna tabla, columna, tipo, policy ni Edge Function.** Fuera de esa
  función, el repository consume las policies de RLS existentes tal cual, con la `anon key` y la
  sesión del usuario. Cero `service_role`.
- **NO se introduce TanStack Query ni ninguna librería de data-fetching.** El proyecto no la tiene y
  el contrato de `usePacientes` (loading / error / recargar) se preserva íntegro.
- **Precondición operativa**: el schema `pacientes` debe estar en *Exposed schemas* del Data API del
  proyecto Supabase (no hay `supabase/config.toml` en el repo; `usuarios` y `modulos` ya fueron
  expuestos a mano para `auth-frontend-real`). Sin eso, `supabase.schema('pacientes')` falla con
  `PGRST106`. Se verifica antes de dar el change por hecho.

## Capabilities

### New Capabilities
- `paciente-repository-supabase`: implementación real de `PacienteRepository` contra el schema
  `pacientes` de Supabase — mapeo bidireccional de las 6 tablas involucradas, alta multi-tabla
  atómica vía la función `SECURITY INVOKER` `pacientes.crear_paciente_completo`, traducción de
  errores de PostgREST a mensajes de UI en castellano, consumo (nunca duplicación) de las policies de
  RLS, e inyección en el composition root.

### Modified Capabilities
- `paciente-contract`: el requisito "Implementación mock del repository" cambia de estatus — el mock
  sigue existiendo pero deja de ser la implementación inyectada en la app; se agrega el requisito de
  que exista una implementación real y de que el punto de composición sea el único lugar que elige
  entre ambas. El contrato de errores del repository (qué lanza y con qué forma) pasa a ser
  normativo, porque ahora hay dos implementaciones que deben coincidir.
- `paciente-direcciones`: los requisitos de persistencia de direcciones cambian frente al esquema
  real — `localidad`, `dias` y `horario` no tienen columna. Se especifica qué se persiste, qué se
  degrada y cómo se señaliza, sin cambiar la regla de negocio RN-HR-02 (ida y vuelta independientes,
  sin autocompletar).

## Impact

**Código nuevo**
- `frontend/src/shared/lib/pacientes/pacienteMapping.ts` + `.test.ts`
- `frontend/src/shared/lib/pacientes/SupabasePacienteRepository.ts` + `.test.ts`

**Código modificado**
- `frontend/src/features/pacientes/PacientesRoute.tsx` (única línea de producto que cambia)
- `frontend/src/features/pacientes/PacientesRoute.test.tsx` (ajuste del doble inyectado)
- `frontend/src/features/pacientes/PacienteDetail.tsx` (carteles `AvisoModeloDatos` nuevos)
- `frontend/src/features/pacientes/DireccionesEditor.tsx` (cartel `AvisoModeloDatos`)

**Documentación**
- `knowledge-base/04_modelo_de_datos.md` §Discrepancias (bloque nuevo "Pacientes vs. esquema real")
- `CHANGES.md` (bullet ⚠️ en `C-05`)
- `ROADMAP-FRONTEND.md` §FE-8 (fila `C-05` → ✅)

**Base de datos**
- `supabase/migrations/20260730180000_crear_paciente_completo.sql` (**nuevo**) — una sola función
  `SECURITY INVOKER`. No crea ni altera tablas, columnas, tipos, policies ni datos. Rollback:
  `DROP FUNCTION IF EXISTS pacientes.crear_paciente_completo(jsonb);`.
- **La aplica la usuaria**, no el agente: correr `supabase db push` requiere Docker o credenciales
  del proyecto real, que el sandbox no tiene (mismo bloqueo que la tarea 2.7 de
  `permisos-modulos-granulares`).

**Sin impacto**
- Ninguna migración existente se edita.
- `PacienteRepository.ts`, `shared/types/paciente.ts`, `usePacientes.ts`,
  `PacienteRepositoryContext.tsx` — las firmas y los tipos del dominio quedan intactos.
- Los otros 8 módulos siguen en mock. Este change no los toca.

**Dependencias**
- Requiere (ya cumplido): `C-01` foundation-setup (cliente Supabase), `C-02` +
  `auth-frontend-real` (sesión real y `modulos.tiene_permiso`), la migración de `C-05`
  (`20260724100004_schema_pacientes.sql`), y `permisos-modulos-granulares` (28/28, ya movió
  `pacientes.recorridos` al módulo `hojas_de_ruta`).
- Habilita: `integracion-obras-sociales` (el `obraSocialId` y `coberturas_paciente` se cruzan),
  y después Presupuestos / Hojas de Ruta / Facturación, que referencian `paciente.id` real.
- No bloquea ni es bloqueado por ningún change activo.

**Riesgo y rollback**
- Riesgo principal (resuelto por D4): el alta de un paciente escribe en 7 tablas y PostgREST **no
  ofrece transacción multi-request** — hecho como N inserts, un fallo a mitad deja una ficha
  incompleta. Se resuelve con la función atómica: una sola transacción, sin estado parcial posible.
- Riesgo nuevo que introduce esa función: si alguien la convirtiera a `SECURITY DEFINER`, el gateo
  por módulo quedaría bypasseado por completo. Mitigación: la prohibición está escrita en `design.md`
  D4, en la cabecera de la migración y en el `COMMENT ON FUNCTION` que queda visible en la base, más
  una verificación manual con una cuenta sin `pacientes: write`.
- Riesgo operativo: si la migración no se aplica, el alta responde `PGRST202`. Mitigación: aplicarla
  es tarea bloqueante del cableado en `PacientesRoute.tsx`, y ese código tiene su propio mensaje.
- Riesgo secundario: una cuenta sin `obra_social: read` ve el número de afiliado vacío. Mitigación:
  degradación explícita, nunca un error genérico ni un dato inventado (D3).
- **Rollback**: revertir `PacientesRoute.tsx` a `mockPacienteRepository` (un import y una prop). Los
  archivos nuevos quedan inertes: nadie más los importa. La migración no hace falta revertirla (una
  función que nadie llama es inerte); si se quiere limpiar, un `DROP FUNCTION` alcanza. Ningún dato
  se borra ni se transforma en la BD.
