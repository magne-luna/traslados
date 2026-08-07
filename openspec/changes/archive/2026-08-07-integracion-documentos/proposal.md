## Why

`mockDocumentoRepository` es el **último mock transversal** del frontend: no pertenece a un módulo,
lo consumen **cinco** composition roots a la vez (Pacientes, Vehículos, Conductores, Facturación y
el catálogo del design system) y es la fila 8 —la última— del §Plan de integración de `CHANGES.md`:
*"Documentos (storage) | ⏳ pendiente | Buckets ya creados; falta reemplazar `mockDocumentoRepository`
(uploads simulados)"*. Hoy `upload()` guarda un `Map` en memoria con 350 ms de latencia fingida: el
archivo que la usuaria elige **nunca sale del navegador**, y al recargar la pantalla desaparece.

El backend que lo desbloquea (`C-03-gestion-documental-core`) está **implementado, pusheado y
verificado en vivo**. Verificación de esta sesión (`supabase db query --linked`, 2026-08-05, contra
el proyecto real — no contra las migraciones a ojo):

| Pieza de C-03 | Estado verificado en vivo |
|---|---|
| 4 buckets privados | ✅ `documentos-pacientes`, `documentos-vehiculos`, `documentos-conductores`, `documentos-facturas` |
| 16 policies de `storage.objects` (4 buckets × SELECT/INSERT/UPDATE/DELETE) | ✅ las 16 existen, todas gateadas por `modulos.tiene_permiso()` |
| `facturacion.documento_factura` + RLS + trigger de auditoría | ✅ existe, 2 policies, `trg_audit_documento_factura` |
| 3 `tipos_documento` seedeados | ✅ `comprobante ARCA`, `asistencia`, `CODEM` |

Del lado backend **no falta nada de lo que C-03 prometió**. Lo que este change descubre —y es lo que
más cambia su alcance respecto de lo que el enunciado de la fila 8 sugiere— es que "escribir el
`SupabaseDocumentoRepository` y swapear los 5 roots" **no es un swap mecánico**, por cuatro hallazgos
concretos y verificados.

### Hallazgo 1 — solo **una** de las cuatro entidades tiene hoy ids reales que la FK acepte

`DocumentoRepository` recibe `entidadId` desde la pantalla, y ese id viene del repository de la
entidad. Las cuatro tablas de destino tienen FK `NOT NULL … ON DELETE CASCADE` contra su entidad, así
que un id de fixture es un `23503` garantizado:

| Entidad | Repository inyectado hoy en el root | ¿`entidadId` es un UUID real de Postgres? |
|---|---|---|
| Paciente | `supabasePacienteRepository` (`PacientesRoute.tsx`) | ✅ **sí** |
| Vehículo | `mockVehiculoRepository` (`VehiculosRoute.tsx`) | ❌ no — `generateId('vehiculo')` |
| Conductor | `mockConductorRepository` (`ConductoresRoute.tsx`) | ❌ no |
| Factura | `mockFacturaRepository` (`FacturacionRoute.tsx`) | ❌ no — swap parcial deliberado de Enzo, 2026-08-05 |

Verificado por los tres lados: los cuatro `*Route.tsx` leídos directamente; `find` no devuelve
`SupabaseVehiculoRepository.ts` ni `SupabaseConductorRepository.ts` en ningún lado del árbol
(reconfirmado por `integracion-hojas-de-ruta` 0.2 el 2026-08-05); y el propio comentario de
`FacturacionRoute.tsx:17-20` dice que Factura y Cobro **siguen en mock a propósito** hasta que
`integracion-facturacion` (CRÍTICO, 5 aprobaciones pendientes) aterrice.

**Consecuencia:** este change puede volver real el repositorio de Documentos **para Pacientes**. Para
las otras tres entidades el repositorio queda escrito y testeado, pero **no inyectado** — es el
Checkpoint 0 de `design.md`.

### Hallazgo 2 — el schema real no tiene dos columnas que el contrato del frontend necesita

`DocumentoAdjunto` es `{ itemId, nombreArchivo, subidoEn }`. Contra el schema verificado en vivo
(`information_schema.columns`):

| Entidad | Tabla | Columna del `itemId` | `created_at` (→ `subidoEn`) | `nombre_archivo` |
|---|---|---|---|---|
| paciente | `pacientes.documentos` | `id_tipo_documento` **UUID** → `obra_social.tipos_documento` | ✅ | ❌ |
| vehículo | `conductores.documentacion_vehiculo` | `tipo_documento` **TEXT** libre | ✅ | ❌ |
| conductor | `conductores.documentacion_conductores` | `tipo_documento` **TEXT** libre | ❌ **falta** | ❌ |
| factura | `facturacion.documento_factura` | `id_tipo_documento` **UUID** → catálogo compartido | ✅ | ❌ |

Dos problemas distintos, los dos reales:
- **`nombre_archivo` no existe en ninguna de las cuatro.** Solo hay `archivo_url TEXT`. Pero
  `DocumentChecklist.tsx:70` lo **muestra en pantalla** (`{doc.nombreArchivo} · {fecha}`).
- **`documentacion_conductores` no tiene `created_at`** — es la única de las cuatro sin él (las otras
  tres sí). Sin esa columna, `subidoEn` de un documento de conductor no tiene de dónde salir.

Ninguna de las dos se resuelve adivinando: es el Checkpoint 2 de `design.md`.

### Hallazgo 3 — el bucket `documentos-vehiculos` y su tabla están gateados por **módulos distintos**

Verificado en vivo, `pg_policies`:

```
storage.objects "Write documentos-vehiculos"   → modulos.tiene_permiso('conductores', 'write')
conductores.documentacion_vehiculo "Write …"   → modulos.tiene_permiso('vehiculos',   'write')
```

No es un descuido de C-03: sus policies de storage son del `20260729100001`, y el split de módulos
que movió las 6 tablas de vehículos de `conductores` a `vehiculos`
(`20260730140000_split_modulos_permisos.sql`) es **del día siguiente** y no tocó `storage.objects`.
El propio C-03 lo dejó escrito en su cabecera: *"documentos-vehiculos -> conductores (vehiculo vive
bajo ese modulo, no uno propio)"* — cierto cuando se escribió, falso desde el split.

**Efecto concreto:** una cuenta con `vehiculos: write` y sin `conductores: write` puede insertar la
fila en `documentacion_vehiculo` pero **no puede subir el archivo al bucket** (y al revés). Es decir:
el primer upload real de un vehículo falla a mitad de camino para el perfil de permisos más natural.
Es el Checkpoint 3 de `design.md`, y es el único hallazgo que exige tocar seguridad ya aplicada.

### Hallazgo 4 — hoy no hay ningún checklist configurado, así que "conectar el repository" no alcanza para ver el efecto

`obra_social.requisitos_os` tiene **0 filas** (verificado en vivo) y `obra_social.tipos_documento`
tiene solo las **3** que seedeó C-03 (`comprobante ARCA`, `asistencia`, `CODEM`, ninguna vinculada a
ninguna obra social). Como `PacienteDocumentosChecklist` y `FacturaDocumentos` derivan sus `items` del
checklist de la obra social (`ChecklistItem.id` **es** el `tipos_documento.id`, ver
`obraSocialMapping.parseRequisitoRow`), hoy **el checklist de todo paciente renderiza vacío** — con
mock o con Supabase, da igual. Las 4 tablas de documentos también están en 0 filas.

No es un bloqueo de código: `ChecklistEditor` ya escribe `requisitos_os` contra el backend real desde
`integracion-obra-social`. Pero **sí condiciona la verificación manual**: sin configurar antes al
menos un checklist en una obra social real, el apply no tiene nada que probar. Queda como tarea
explícita y bloqueante en §8 de `tasks.md`, no como sorpresa de QA.

## What Changes

- **Dos archivos nuevos** en `frontend/src/shared/lib/documentos/`, mismo molde que las cinco
  implementaciones reales anteriores de la serie (mapeo puro separado del I/O):
  - `documentoMapping.ts` — traducción fila↔dominio + construcción de la clave de Storage, todo puro
    y testeable sin red, con type guards explícitos (nunca `any`, nunca `as`).
  - `SupabaseDocumentoRepository.ts` — cumple `DocumentoRepository` **sin cambiar una firma**
    (`listByEntity`, `upload`, `remove`), contra Supabase Storage (4 buckets) + las 4 tablas de
    persistencia.
- **Una tabla de configuración por entidad** (`documentoMapping.ts`, `Record<EntidadDocumental, …>`
  congelado): schema, tabla, columna de FK, columna del `itemId`, bucket y módulo. Es la pieza que
  absorbe la heterogeneidad del Hallazgo 2 sin ensuciar el repository ni la UI.
- **El swap toca UN solo composition root**: `frontend/src/features/pacientes/PacientesRoute.tsx`
  pasa a inyectar `supabaseDocumentoRepository`. **`VehiculosRoute.tsx`, `ConductoresRoute.tsx` y
  `FacturacionRoute.tsx` se quedan en `mockDocumentoRepository`** — no por falta de repository, sino
  porque sus entidades todavía son fixture (Hallazgo 1). Cuando cada una se vuelva real, el cambio es
  **una línea por archivo**.
- **`DesignSystem.tsx` se queda en mock, por diseño y para siempre**: es el catálogo vivo del design
  system, con un `entidadId` inventado (`'p1'`) y un checklist demo hardcodeado. Conectarlo a
  Supabase escribiría basura en la base cada vez que alguien abre `/design-system`.
- **Una migración nueva, 100% aditiva** (escrita en el apply, aplicada por la usuaria/Enzo — nunca por
  el agente):
  - `ALTER TABLE … ADD COLUMN nombre_archivo TEXT` en las 4 tablas de documentos (Checkpoint 2).
  - `ALTER TABLE conductores.documentacion_conductores ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW()`
    — alinea la única tabla de las 4 que no lo tenía.
  - `DROP POLICY` + `CREATE POLICY` × 4 sobre `storage.objects` para repuntar el bucket
    `documentos-vehiculos` del módulo `conductores` al módulo `vehiculos` (Checkpoint 3). **Es el
    único punto de este change que toca una superficie de permisos ya aplicada** — no se escribe sin
    veredicto explícito.
- **Ninguna tabla nueva, ningún bucket nuevo, ninguna RPC nueva.** A diferencia del resto de la serie,
  acá **no hace falta `SECURITY INVOKER`**: cada operación escribe una sola tabla, así que no hay
  transacción multi-tabla que emular. Lo que sí hay —y es la decisión técnica central— es que
  **Storage y Postgres no comparten transacción**: `upload` y `remove` necesitan un orden de
  operaciones con compensación explícita (`design.md` D4).
- **El mock NO se borra.** Sigue como doble de test de ~25 archivos de test y como implementación
  inyectada en los 4 roots que no swapean.
- **Se documentan las discrepancias nuevas** por la vía de siempre: nota en
  `knowledge-base/04_modelo_de_datos.md` §Discrepancias, bullet en `CHANGES.md` §C-03, y
  `AvisoModeloDatos` en pantalla donde aplique. Ninguna se resuelve unilateralmente en código.

### Lo que este change explícitamente NO hace

- **No construye ninguna pantalla ni cambia el contrato de UI.** `DocumentChecklist.tsx`,
  `useDocumentChecklist.ts`, `DocumentoRepository.ts` y `shared/types/documento.ts` **no se tocan**.
  Es un swap de capa de datos, no un cambio de producto.
- **No implementa descarga de documentos.** `US-900` pide *"consultar y **descargar** los documentos
  adjuntos"*, pero `DocumentChecklist` **hoy no tiene botón de descarga** (solo Subir / Reemplazar /
  Quitar) — la descarga nunca existió, ni en mock. Agregarla exige URL firmadas
  (`createSignedUrl`, buckets privados) **más** un cambio de UI, y ese cambio de UI está fuera del
  alcance de "reemplazar el mock". Queda como change propio propuesto:
  `documentos-descarga-firmada` (`design.md` D6 y Open Questions).
- **No vuelve reales Vehículo, Conductor ni Factura.** Son `integracion-conductores-vehiculos`
  (bloqueado en 1 gap) e `integracion-facturacion` (CRÍTICO, 5 aprobaciones pendientes). Este change
  deja los tres puntos de inyección listos.
- **No normaliza el catálogo de tipos de documento.** Que `pacientes.documentos`/`documento_factura`
  usen una FK UUID y `documentacion_*` un TEXT libre es la forma real del schema; unificarlas es un
  cambio de modelo, no de adaptador (Checkpoint 1, opción B, descartada).
- **No crea pantalla de administración de `obra_social.tipos_documento`.** Ya está anotado como
  pregunta abierta propia en `knowledge-base/10_preguntas_abiertas.md` (*"¿Quién administra
  `obra_social.tipos_documento`?"*), con `ON DELETE RESTRICT` desde tres consumidores.
- **No siembra checklists.** Configurar el checklist de una obra social real es dato, no código, y lo
  hace la usuaria con el `ChecklistEditor` que ya existe y ya es real.
- **No introduce TanStack Query** ni cambia el manejo de estado de `useDocumentChecklist`.
- **No escribe ni aplica migraciones en este propose.** El sandbox no tiene Docker ni credenciales de
  escritura; `supabase db push` lo corre la usuaria/Enzo, después de resueltos los checkpoints.

## Capabilities

### New Capabilities
- `documento-repository-supabase`: implementación real de `DocumentoRepository` contra Supabase
  Storage (4 buckets privados) y las 4 tablas de persistencia heterogéneas; tabla de configuración
  por entidad; construcción determinista de la clave de Storage; semántica de reemplazo de `upload`
  con compensación explícita entre Storage y Postgres; traducción de errores de PostgREST **y de
  Storage** a castellano; inyección en `PacientesRoute.tsx`.

### Modified Capabilities
- `documento-contract`: el requisito "implementación mock en memoria" cambia de estatus — el mock
  sigue existiendo pero deja de ser la única implementación; el contrato de errores y la semántica de
  reemplazo de `upload` pasan a ser **normativos**, porque a partir de acá hay dos implementaciones
  que tienen que coincidir.

### Documented Limitations
- `documento-avisos-modelo-datos`: Vehículos, Conductores y Facturación siguen sobre uploads
  simulados; se documenta en pantalla con `AvisoModeloDatos` como limitación transitoria, no como
  comportamiento final.

## Impact

**Código nuevo**
- `frontend/src/shared/lib/documentos/documentoMapping.ts` + `.test.ts`
- `frontend/src/shared/lib/documentos/SupabaseDocumentoRepository.ts` + `.test.ts`

**Código modificado**
- `frontend/src/features/pacientes/PacientesRoute.tsx` (**el swap**: una línea de import + una prop)
- `frontend/src/features/pacientes/PacientesRoute.test.tsx` (si existe; si no, se crea el smoke test
  del composition root, mismo patrón `vi.hoisted` + `vi.mock` de `PacientesRoute.test.tsx`/
  `HojaDeRutaRoute.test.tsx`)
- `frontend/src/features/vehiculos/VehiculoDocumentos.tsx`,
  `frontend/src/features/conductores/ConductorDocumentos.tsx`,
  `frontend/src/features/facturacion/FacturaDocumentos.tsx` (`AvisoModeloDatos`: upload simulado
  mientras la entidad siga en mock). En `FacturaDocumentos.tsx` **además se corrige un cartel
  desactualizado**: hoy dice *"El backend `C-07` debe crear `documento_factura`"* y esa tabla
  **ya existe** desde C-03 (verificada en vivo).

**Base de datos**
- Migración nueva (**expand aditivo**, timestamp a definir al aplicar): `nombre_archivo TEXT` × 4
  tablas, `created_at TIMESTAMPTZ DEFAULT NOW()` en `documentacion_conductores`, y el repunte de las
  4 policies del bucket `documentos-vehiculos` a `vehiculos`.
- **Ninguna migración existente se edita. Ninguna columna se altera ni se borra. Ninguna migración se
  escribe ni se aplica en este propose.**

**Sin impacto**
- `DocumentoRepository.ts` (la interfaz), `useDocumentChecklist.ts`, `DocumentChecklist.tsx`,
  `shared/types/documento.ts`, `vehiculoDocumentosItems.ts`, `conductorDocumentosItems.ts`,
  `ChecklistEditor.tsx` — sin cambios de forma.
- `mockDocumentoRepository.ts` — sin cambios, sigue inyectado en 4 de los 5 roots.
- `DesignSystem.tsx` — sigue en mock por diseño.
- `PresupuestoForm.tsx`/`AutorizacionForm.tsx` — usan archivo único, **no** `DocumentChecklist`
  (Discrepancia ya documentada en `CHANGES.md` §C-06); su subida a Storage es el change propio
  `presupuestos-documentacion-storage` ya anotado en `10_preguntas_abiertas.md`.

**Dependencias**
- Requiere (ya cumplido y verificado en vivo 2026-08-05): `C-01` (buckets), `C-02` +
  `auth-frontend-real` + `permisos-modulos-granulares` (módulos `pacientes`/`vehiculos`/
  `conductores`/`facturacion`), **`C-03` completo** (16 policies de storage + `documento_factura`).
- Requiere (ya cumplido): `integracion-pacientes` — reusa `supabasePacienteRepository` para que
  `entidadId` sea un UUID real.
- **No requiere** `integracion-conductores-vehiculos` ni `integracion-facturacion` para aplicarse,
  pero **sí limita** a qué entidades puede llamar "reales" (Checkpoint 0).
- Habilita: cerrar la fila 8 —la última— del §Plan de integración de `CHANGES.md`, y `C-11`
  panel-principal-reportes si alguna vez reporta completitud documental.

**Riesgo y rollback**
- **Riesgo principal (seguridad, y el único que toca algo ya aplicado)**: el repunte de las 4 policies
  del bucket `documentos-vehiculos` de `conductores` a `vehiculos` **le quita acceso al bucket a toda
  cuenta que hoy tenga `conductores` y no tenga `vehiculos`**. Por el `INSERT … SELECT` aditivo del
  split (`20260730140000` §2) toda cuenta que tenía `conductores` recibió también `vehiculos`, así que
  en la práctica no debería perder nadie — **pero eso vale solo para las cuentas existentes al momento
  del split**, no para las creadas después a mano. Mitigación: auditar `modulos.permisos` **antes** de
  aplicar (tarea bloqueante 2.4) y no aplicar sin veredicto de la usuaria/Enzo.
- **Riesgo de consistencia**: Storage y Postgres no comparten transacción. Un fallo entre el upload
  del archivo y el insert de la fila deja un objeto huérfano (archivo sin fila) o —peor— una fila sin
  archivo. Mitigado por el orden de operaciones + compensación de `design.md` D4: **el archivo se
  sube primero y la fila se escribe última**, de modo que el único residuo posible sea un objeto
  huérfano invisible para la UI, nunca una fila que apunte a un archivo inexistente.
- **Riesgo de datos sensibles**: son documentos clínicos de pacientes (CUD, certificados) y de menores
  de edad. Mitigado en tres capas que **no** se relajan: buckets privados (`public: false`), RLS por
  módulo en `storage.objects` y en la tabla, y `anon key` únicamente — **nunca**
  `SUPABASE_SERVICE_ROLE_KEY` desde el frontend. Este change no crea ninguna superficie de lectura
  nueva: no genera URLs firmadas ni públicas (D6).
- **Riesgo operativo**: si la migración no se aplica, `nombre_archivo` responde `PGRST204` y el alta
  falla. Mitigado con mensaje propio en castellano por código.
- **Rollback**: revertir `PacientesRoute.tsx` al mock (un import y una prop) — los archivos nuevos
  quedan inertes. La migración es aditiva: `ALTER TABLE … DROP COLUMN` × 5 y volver a aplicar
  `DROP/CREATE POLICY` apuntando a `conductores` (definición original literal en
  `20260729100001_storage_objects_rls.sql`). **Ningún dato existente se transforma ni se borra** — las
  4 tablas están en 0 filas y el bucket tiene 1 solo objeto (verificado en vivo).
