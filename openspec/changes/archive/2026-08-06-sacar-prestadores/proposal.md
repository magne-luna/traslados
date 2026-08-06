## Why

Reunión con Andrea (Traslado Personalizado), Google Meet 2026-08-04 (`TODO-video-revision.txt`
§Prestadores, transcripción del resumen Fathom): **decisión explícita de la clienta** — la sección
de Prestadores no es necesaria. Traslado Personalizado (Andrea) es el único prestador real de la
operación; la tercerización con Uber/remis es mínima y no estructurada, no amerita un módulo de
gestión propio (alta/edición, vínculo N:N con Obra Social, selección por factura).

El TODO original dejaba la decisión condicionada a "confirmar con Enzo qué hacer con todo lo ya
construido (`prestadores-crud`, `factura-por-prestador`) antes de tocar nada — no asumir que hay
que borrarlo". Enzo (backend, 2026-08-06) confirmó: **remover Prestadores del sistema por
completo** — frontend ahora, migración de base redactada ahora pero **no aplicada** (la aplica él
mismo más adelante, mismo criterio que toda otra migración de este proyecto).

Cambio relacionado, confirmado en la misma conversación: en el wizard de Facturación, Paso 2
(visible cuando `ObraSocial.modalidadFacturacion === 'por-prestacion'`), el selector de Prestador
se reemplaza por **dos campos de texto libre** ("Nombre" y "Domicilio"), cargados a mano por
factura — sin entidad, sin repository, sin vínculo a Obra Social.

Esto revierte, en los hechos, dos changes ya implementados y (parcialmente) mergeados:
- `openspec/changes/prestadores-crud/` — CRUD completo de Prestador + vínculo N:N con Obra Social.
  Mergeado a `main` el 2026-08-02 **sin validar sus 5 supuestos con Andrea** (`CHANGES.md` §C-04).
- `openspec/changes/factura-por-prestador/` — selección de Prestador en el alta de factura +
  fijación de `tipoComprobante` desde el prestador elegido.

Ambas carpetas quedan **como registro histórico, sin tocar**: documentan lo que efectivamente se
construyó y cuándo, aunque hoy se remueva. `sacar-prestadores` es el change que lo revierte, no una
edición retroactiva de esos dos.

## What Changes

- **Frontend**: se borra el módulo `Prestadores` completo (pantallas, repository, tipos, mocks,
  fixtures) y todo punto de integración que dependía de él (selector en Facturación, panel de
  vínculo en Obras Sociales, ruta y entrada de navegación propias).
- **Facturación — Paso 2 del wizard**: `PrestadorSelector` se reemplaza por dos campos de texto
  libre ("Nombre"/"Domicilio") en `Factura` (`prestadorNombre?`/`prestadorDomicilio?`, flat,
  opcionales). `tipoComprobante` deja de fijarse/bloquearse por prestador — vuelve a ser 100%
  manual siempre (revierte el comportamiento que había introducido `factura-por-prestador`).
- **Backend**: migración nueva (`20260806180000_sacar_prestadores.sql`) que dropea
  `obra_social.obra_social_prestador` y `obra_social.prestadores` — **redactada, no aplicada**.
  Edge Function `supabase/functions/prestadores/` se borra del repo local; el deploy real en
  Supabase requiere una acción separada de Enzo (ver Impact).
- **Documentación**: `CHANGES.md` recibe una entrada nueva (append) y una nota de corrección sobre
  el estado real de las migraciones de `prestadores-crud` (ver Impact — hallazgo de esta
  investigación, las migraciones SÍ están aplicadas contra el proyecto real, no "escritas sin
  aplicar" como decía el texto anterior).

## Capabilities

### Removed Capabilities

- `prestador-crud`: alta/edición/listado de Prestador y su vínculo N:N con Obra Social
  (`prestadores-crud`). Ya no existe ninguna pantalla, repository ni tipo de dominio para
  `Prestador`.
- `factura-prestador-seleccion`: selección condicional de Prestador en el alta de factura según
  `ObraSocial.modalidadFacturacion`, y fijación (solo lectura) de `tipoComprobante` desde el
  prestador elegido (`factura-por-prestador`). Reemplazada por texto libre sin entidad — ver D2 de
  `design.md`.

### Modified Capabilities

- `factura-crud`: `Factura.prestadorId?: string` se reemplaza por dos campos flat
  `prestadorNombre?: string` / `prestadorDomicilio?: string`, texto libre, sin referencia a
  ninguna entidad.
- `factura-contract`: el contrato de `NuevaFactura`/`ActualizacionFactura` refleja el cambio de
  campos de arriba.

### New Capabilities

Ninguna — este change solo remueve/simplifica.

## Impact

**Código borrado**
- `frontend/src/features/prestadores/` (módulo completo: 10 archivos, ver `tasks.md`).
- `frontend/src/shared/types/prestador.ts`.
- `frontend/src/shared/lib/prestadores/` (repository + mapping + tests).
- `frontend/src/shared/lib/mocks/mockPrestadorRepository.ts` (+ test) y `prestadoresFixture.ts`.
- `frontend/src/features/facturacion/PrestadorSelector.tsx` (+ test).
- `supabase/functions/prestadores/`.

**Código editado** — ver `tasks.md` para la lista completa con descripción por archivo.

**Migración**
- `supabase/migrations/20260806180000_sacar_prestadores.sql` — dropea
  `obra_social.obra_social_prestador` y `obra_social.prestadores`. **Redactada, NO aplicada** —
  Enzo la aplica manualmente cuando esté listo.

**Hallazgo crítico de esta investigación (afecta cómo se enmarca la migración)**: `CHANGES.md`
(§C-04, bullet `prestadores-crud`) decía que la migración `20260801100000_prestadores_condiciones.sql`
estaba "escrita, no aplicada". Verificado contra el proyecto Supabase real (`pkryfoljypuzfifofdwp`,
`supabase db query --linked`): **las tres migraciones de `prestadores-crud`
(`20260801100000`, `20260801110000`, `20260801120000`) SÍ están aplicadas** —
`supabase_migrations.schema_migrations` las tiene registradas, y hay datos reales sembrados
(`obra_social.prestadores`: 2 filas, `obra_social.obra_social_prestador`: 3 filas, coincidiendo
con la migración de seed). La Edge Function `prestadores` también está deployada y activa. Esto
significa que `20260806180000_sacar_prestadores.sql` es una reversión real de estado productivo,
no un "deshacer algo que nunca llegó a existir" — ver D3 de `design.md` y la corrección agregada a
`CHANGES.md`.

**Acciones de Enzo — ✅ ambas ejecutadas el 2026-08-06**:
1. `supabase db push --linked` — aplicó `20260806180000_sacar_prestadores.sql` contra
   `pkryfoljypuzfifofdwp`, borrando los datos reales (2 prestadores, 3 vínculos).
2. `supabase functions delete prestadores --project-ref pkryfoljypuzfifofdwp` — dio de baja la
   función ya deployada.

**Fuera de scope** (ver D1 de `design.md`, checkpoint resuelto): las columnas vestigiales
`plazo_cobro_dias`/`tipo_comprobante` en `obra_social.obra_social` (de una migración anterior a
Prestador, `20260729110000_schema_obra_social_facturacion_config.sql`) — no se tocan.

**Dependencias / changes relacionados**
- Revierte en la práctica `openspec/changes/prestadores-crud/` y
  `openspec/changes/factura-por-prestador/` — ambas carpetas quedan sin modificar, como registro
  histórico de lo que se construyó.
- No depende de ningún change abierto.

**Riesgo y rollback**
- Riesgo medio: toca un flujo crítico (Facturación, dominio fiscal) pero de forma reductiva
  (elimina condicionales, no agrega lógica nueva). La migración es la única acción irreversible
  real, y queda explícitamente sin aplicar hasta que Enzo la corra.
- Rollback de frontend: revertir los archivos de "Código borrado"/"Código editado" (commits
  atómicos, sin `git add`/`git commit` hechos por este change).
- Rollback de base: la migración no aplicada no tiene rollback que hacer; una vez aplicada, un
  rollback real requeriría recrear `obra_social.prestadores`/`obra_social_prestador` desde backup
  (no hay `DOWN` automático para un `DROP TABLE`).
