## Why

El frontend de Presupuestos y Autorizaciones está completo (CRUD de presupuesto, formulario de
autorización con estado/cupos/vigencia retroactiva, validación RN-PA-01 como función pura — archivado
como `presupuestos-ui`, `openspec/changes/archive/2026-07-24-presupuestos-ui/`, 32/32 tasks) pero
**habla con `mockPresupuestoRepository` y `mockAutorizacionRepository`**: dos fixtures en
`localStorage` con latencia simulada.

Este es el change **5 de la serie de integración por módulo** (`CHANGES.md` §Plan de integración
Backend↔Frontend, fila 5: *"Presupuestos (C-06) — 🔴 bloqueado"*), después de `integracion-pacientes`,
`integracion-obra-social`, `integracion-conductores-vehiculos` e `integracion-facturacion`.

**Por qué deja de estar bloqueado, verificado el 2026-08-02 contra el proyecto real
`pkryfoljypuzfifofdwp`, no asumido:**

1. El backend de `C-06` cerró los **2 puntos que `CHANGES.md` marcaba como bloqueantes** y está
   **archivado** (`openspec/changes/archive/2026-08-01-C-06-presupuestos-autorizaciones/`):
   `facturacion.autorizacion.monto_autorizado` + trigger `facturacion.validar_autorizacion_monto`
   (RN-PA-01, rechaza duro si la autorización supera el presupuesto) y
   `facturacion.autorizacion.vigencia_desde` (RN-PA-02, carga retroactiva). Confirmado columna por
   columna contra `information_schema.columns`.
2. Las Edge Functions **`presupuestos` y `autorizaciones` están `ACTIVE`** (versión 2) en el proyecto
   real, con CRUD completo y un contrato de API **ya en camelCase, casi 1:1 con los tipos del
   dominio del frontend**.
3. Todas las migraciones hasta `20260801120000` están aplicadas (local == remote en
   `supabase migration list`).

**Hallazgo que define el enfoque de este change.** A diferencia de los cuatro changes de integración
anteriores —que hablan PostgREST + RLS directo y, cuando necesitan atomicidad multi-tabla, agregan
funciones RPC `SECURITY INVOKER`— acá **ya existe un backend deployado que expone exactamente estas
dos entidades**, y su contrato coincide casi campo por campo con `shared/types/presupuesto.ts`. Este
change **consume ese backend en vez de construir un segundo camino en paralelo** (ver `design.md` D2,
es un ⚠️ CHECKPOINT: es un apartamiento deliberado del patrón de la serie y tiene un costo de
seguridad que se documenta, no se esconde).

**Consecuencia directa: este change no necesita ninguna migración de schema.** El único `.sql` que
propone son **tres índices sobre FK** que hoy no existen — y que `integracion-facturacion` D10 dejó
explícitamente fuera de su alcance diciendo *"son de `C-06`"*.

## What Changes

### 1. Frontend — dos repositories reales contra las Edge Functions ya deployadas

- **`SupabasePresupuestoRepository.ts`** y **`SupabaseAutorizacionRepository.ts`** nuevos en
  `frontend/src/shared/lib/presupuestos/`, cumpliendo `PresupuestoRepository` (4 métodos) y
  `AutorizacionRepository` (5 métodos) **sin cambiarles una firma**.
- **`presupuestoMapping.ts`** y **`autorizacionMapping.ts`** nuevos: todo el mapeo API↔dominio como
  funciones puras con type guards sobre `unknown` (nunca `any`, nunca `as`), testeable sin red. Mismo
  criterio que `pacienteMapping.ts` / `obraSocialMapping.ts` / `prestadorMapping.ts`.
- **`edgeFunctionErrors.ts`** nuevo: traducción compartida de la respuesta de
  `supabase.functions.invoke` a `Error` con `.message` en castellano listo para UI. Es compartido
  porque **los dos** repositories lo necesitan idéntico, y porque `integracion-facturacion` va a
  necesitar el mismo helper si adopta las Edge Functions `facturas`/`cobros` (ver D12).
- **Un solo archivo de producto cambia el cableado**: `PresupuestosRoute.tsx` (composition root).
  Ningún componente, hook ni context de `features/presupuestos/` se toca por el swap.
- **Los mocks NO se borran**: siguen como dobles de test y para desarrollo sin backend.

### 2. Los dos selectores del formulario pasan a datos reales, en el mismo commit

`PresupuestosRoute.tsx` inyecta hoy **cuatro** mocks: los dos propios más `mockPacienteRepository` y
`mockObraSocialRepository`, que alimentan los selectores de paciente y obra social del formulario.
`facturacion.presupuesto` tiene FK **`NOT NULL`** a `pacientes.paciente` y a
`obra_social.obra_social`: con selectores de fixture, **toda alta real falla con `23503`**. Los dos
repositories reales ya existen (`supabasePacienteRepository`, `supabaseObraSocialRepository`) y ya
están cableados en `PacientesRoute.tsx` / `ObraSocialesRoute.tsx`. Se swapean acá también — no es
alcance extra, es la condición para que el alta funcione (ver D8).

### 3. La documentación adjunta: el tipo del frontend no tiene contraparte en la base ⚠️ CHECKPOINT

`Presupuesto.archivo` / `Autorizacion.archivo` son `ArchivoAdjunto { nombre, cargadoEn }`. La base
tiene **una sola columna, `archivo_url TEXT`**, y las columnas `archivo_nombre`/`archivo_cargado_en`
fueron **dropeadas a propósito** por `20260730120000_revert_presupuesto_archivo_meta.sql`. Además
**no existe bucket de Storage** para presupuestos ni autorizaciones (`20260727000001_create_buckets.sql`
crea cuatro: pacientes, vehículos, conductores, facturas — ninguno acá) y **el formulario actual no
sube nada**: toma un `File` y guarda solo su nombre.

Este change **no implementa la subida a Storage** (sería construir una funcionalidad nueva, no
conectar una existente). Propone mapear `archivo_url` de forma no destructiva y señalizarlo con
`AvisoModeloDatos`, con tres opciones sobre la mesa para la usuaria (D5). **No se resuelve
unilateralmente.**

### 4. Base de datos — tres índices, ninguna tabla ni columna nueva

`supabase/migrations/20260802100000_presupuesto_autorizacion_indices.sql`: `CREATE INDEX IF NOT
EXISTS` sobre `facturacion.presupuesto.paciente_id`, `facturacion.presupuesto.obra_social_id` y
`facturacion.autorizacion.presupuesto_id`. Verificado el 2026-08-02 contra `pg_indexes`: el schema
`facturacion` sigue teniendo **exactamente sus 7 primary keys y ningún otro índice**.
`autorizacion.presupuesto_id` es la columna que filtra **cada** `getByPresupuestoId()`, es decir cada
vez que se abre el detalle de un presupuesto.

### 5. Lo que este change NO hace

- **NO agrega columnas ni tablas.** El schema de `C-06` está completo para lo que el frontend
  necesita, verificado columna por columna.
- **NO implementa la subida de archivos a Storage** (D5). Se propone como change propio,
  `presupuestos-documentacion-storage`, junto con el bucket y sus policies.
- **NO agrega `delete()`** a ninguno de los dos repositories, aunque las dos Edge Functions lo
  exponen: las interfaces no lo tienen y ninguna pantalla lo usa. Agregarlo sería funcionalidad
  nueva.
- **NO toca `frontend/src/features/facturacion/FacturacionRoute.tsx`**, que también importa
  `mockPresupuestoRepository`/`mockAutorizacionRepository` para la validación de cupo (RN-FA-02).
  Ese acoplamiento es el problema **D9 de `integracion-facturacion`** y se resuelve ahí. Este change
  lo deja **peor documentado que antes, no peor de hecho**: ver D11, es una nota de coordinación
  obligatoria.
- **NO reabre** el modelo de archivo único del docx (un "Archivo" por Presupuesto y por Autorización,
  **no** el patrón multi-documento `DocumentChecklist` de `C-03`). Ya está resuelto así en el schema
  real y en el contrato del frontend.
- **NO introduce TanStack Query** ni toca `usePresupuestos`/`useAutorizaciones`.
- **NO modifica las Edge Functions** `presupuestos`/`autorizaciones` ni las redeploya.

## Capabilities

### New Capabilities

- `presupuesto-repository-supabase`: implementación real de `PresupuestoRepository` contra la Edge
  Function `presupuestos` — mapeo bidireccional API↔dominio, `getById` que resuelve `null` ante 404,
  traducción de errores HTTP a castellano, y consumo (nunca duplicación) del gateo por módulo
  `presupuestos` que la función ya aplica.
- `autorizacion-repository-supabase`: implementación real de `AutorizacionRepository` contra la Edge
  Function `autorizaciones` — incluye `getByPresupuestoId` sobre `?presupuestoId=` con 404→`null`, el
  default de `estado` cuando la base lo devuelve nulo, y la traducción del rechazo del trigger
  RN-PA-01 a un mensaje de dominio.

### Modified Capabilities

- `presupuesto-contract`: el contrato de errores de ambos repositories pasa a ser **normativo**
  (ahora hay dos implementaciones que deben coincidir); las implementaciones mock dejan de ser lo que
  la app inyecta y pasan a ser explícitamente dobles de test; se documenta que `archivo` no tiene
  contraparte completa en la base.
- `presupuesto-crud`: los selectores de paciente y obra social pasan a resolverse contra los maestros
  reales, y guardar un presupuesto pasa a exigir que los dos ids existan de verdad; el archivo
  adjunto pasa a señalizarse como no persistido.
- `autorizacion-gestion`: `estado` pasa a tener un default del servidor; `montoAutorizado` y
  `vigenciaDesde` dejan de ser "campos que el frontend agrega sobre el docx" y pasan a ser columnas
  reales; `getByPresupuestoId` sobre un presupuesto sin autorización sigue resolviendo `null` aunque
  el servidor responda 404.
- `autorizacion-validacion-monto`: RN-PA-01 pasa a estar **realmente aplicada por el servidor**
  (trigger `validar_autorizacion_monto`), y la función pura del frontend pasa a ser explícitamente un
  espejo de UI, no el control. Se agrega el requisito de traducir el rechazo del trigger.

## Impact

**Código nuevo**

- `frontend/src/shared/lib/presupuestos/presupuestoMapping.ts` + `.test.ts`
- `frontend/src/shared/lib/presupuestos/autorizacionMapping.ts` + `.test.ts`
- `frontend/src/shared/lib/presupuestos/edgeFunctionErrors.ts` + `.test.ts`
- `frontend/src/shared/lib/presupuestos/SupabasePresupuestoRepository.ts` + `.test.ts`
- `frontend/src/shared/lib/presupuestos/SupabaseAutorizacionRepository.ts` + `.test.ts`

**Código modificado**

- `frontend/src/features/presupuestos/PresupuestosRoute.tsx` (**el swap**, los cuatro repositories)
- `frontend/src/features/presupuestos/PresupuestosRoute.test.tsx` (doble inyectado)
- `frontend/src/features/presupuestos/PresupuestoForm.tsx` (`AvisoModeloDatos` del archivo, D5)
- `frontend/src/features/presupuestos/AutorizacionForm.tsx` (`AvisoModeloDatos` del archivo, D5)
- `frontend/src/features/presupuestos/PresupuestoDetail.tsx` (`AvisoModeloDatos` de fuente real)

**Base de datos**

- `supabase/migrations/20260802100000_presupuesto_autorizacion_indices.sql` (**nuevo**, 3 índices,
  ninguna columna ni tabla)
- **La aplica la usuaria / Enzo (backend)**, no el agente. Es governance, no un límite técnico.

**Documentación**

- `knowledge-base/04_modelo_de_datos.md` §Discrepancias (bloque nuevo "Presupuestos/Autorizaciones vs.
  esquema real de `C-06`") + el contrato de las dos Edge Functions
- `knowledge-base/10_preguntas_abiertas.md` (las preguntas nuevas que abre este change)
- `CHANGES.md` §`C-06` (bullet de estado) y §Plan de integración (fila 5)
- `ROADMAP-FRONTEND.md` §FE-8

**Sin impacto**

- `PresupuestoRepository.ts` / `AutorizacionRepository.ts` (las interfaces), `usePresupuestos.ts`,
  `useAutorizaciones.ts`, los dos `*RepositoryContext.tsx`, `PresupuestosList.tsx`,
  `PresupuestoResumen.tsx`, `validatePresupuestoForm.ts`, `validarAutorizacion.ts`,
  `cupoAutorizado.ts` — sin cambios.
- `FacturacionRoute.tsx` y toda `features/facturacion/` — explícitamente fuera de alcance (D11).
- Ninguna Edge Function se edita ni se redeploya. Ninguna migración existente se toca.

**Dependencias**

- Requiere (ya cumplido y verificado el 2026-08-02): `C-01`, `C-02` + `auth-frontend-real`,
  `permisos-modulos-granulares` (el módulo `presupuestos` existe como módulo propio desde
  `20260730140000_split_modulos_permisos.sql`), `C-06` archivado, y las dos Edge Functions `ACTIVE`.
- Requiere (ya cumplido): `integracion-pacientes` e `integracion-obra-social` — no que estén
  archivados, sino que `supabasePacienteRepository` y `supabaseObraSocialRepository` existan, que es
  el caso.
- **No depende de `integracion-facturacion`** y no lo bloquea. Sí exige una nota de coordinación
  bidireccional (D11).
- Habilita: cerrar la fila 5 del plan de integración y quitarle a `integracion-facturacion` D9 la
  mitad "autorizaciones de fixture" de su problema de fuente mixta.

**Riesgo y rollback**

- Riesgo principal: **la base real tiene 0 presupuestos y 0 autorizaciones** (verificado 2026-08-02),
  y solo **1 paciente** y **3 obras sociales**. Al cablear, la pantalla queda vacía y el formulario
  ofrece un paciente y tres obras sociales. No es un bug: es el estado real del sistema. Se anticipa
  para que no se lea como regresión (ver D9).
- Riesgo de seguridad **heredado, no introducido**: las dos Edge Functions verifican el permiso a
  nivel aplicación (`requirePermiso` → `modulos.tiene_permiso('presupuestos', …)`) y después operan
  con un cliente **`service_role`**, que bypassea RLS. Para este módulo, **RLS deja de ser el portón
  y pasa a ser segunda capa**. Es una decisión de `C-06`, ya deployada; este change la **documenta y
  la somete a confirmación** (D2/D3), no la introduce ni la cambia.
- Riesgo funcional: el rechazo del trigger RN-PA-01 llega como un `400` con el texto crudo de
  Postgres (`RN-PA-01: monto_autorizado (…) no puede superar el presupuesto (…)`), porque la Edge
  Function hace `jsonResponse(400, { error: error.message })`. Sin traducción, ese texto se pinta tal
  cual en la UI. Mitigado por D7, con test dedicado.
- Riesgo operativo: si el índice de `autorizacion.presupuesto_id` no se aplica, nada se rompe — solo
  cada apertura de detalle hace un seq scan. Es el único ítem del change cuyo no-cumplimiento no
  produce un error visible, y por eso se anota explícitamente.
- **Rollback**: revertir `PresupuestosRoute.tsx` a los cuatro mocks (cuatro imports y cuatro props).
  La app vuelve al fixture al instante y los archivos nuevos quedan inertes (nadie los importa). Los
  tres índices son puramente aditivos: `DROP INDEX` × 3 si se quisiera limpiar. **Ningún dato
  existente se transforma ni se borra en ningún paso.**
