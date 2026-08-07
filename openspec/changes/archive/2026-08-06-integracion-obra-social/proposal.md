## Why

El frontend de Obras Sociales está completo (CRUD, editor de checklist con drag-and-drop, editor de
plantilla de factura, gateo de escritura por permiso — archivado como `obras-sociales-ui`,
`openspec/changes/archive/2026-07-24-obras-sociales-ui/`, 23/24 tasks) pero **habla con
`mockObraSocialRepository`**: un fixture en `localStorage` con latencia simulada y un único
`buildOsecacFixture()` precargado.

Este es el change **2 de la serie de integración por módulo** (`CHANGES.md` §Plan de integración
Backend↔Frontend, fila 2: *"Obra Social (C-04) — ⏭️ siguiente, sin bloqueos"*), después de
`integracion-pacientes`. Va segundo porque Obra Social es el maestro del que cuelgan Pacientes
(`paciente.obra_social_id`, `obra_social.coberturas_paciente`), Presupuestos y Facturación: sin él
real, la ficha de un paciente real sigue apuntando a un id de `localStorage`.

**Hallazgo que corrige la premisa de arranque.** Contra lo que se asumía al abrir este change, el
schema `obra_social` **ya existe y está aplicado**:
`supabase/migrations/20260724100003_schema_obra_social.sql` crea `obra_social.obra_social`,
`obra_social.tipos_documento`, `obra_social.requisitos_os` y `obra_social.prestadores`, las cuatro
con RLS por `modulos.tiene_permiso('obra_social', …)` y triggers de auditoría. Lo que falta **no**
es el schema entero: son cuatro columnas de reglas de negocio, la tabla de la plantilla de factura,
el orden y la obligatoriedad del checklist, y las dos funciones de escritura atómica. Este change es
un **expand aditivo sobre un schema vivo**, no una creación desde cero.

## What Changes

### 1. Backend — dos migraciones aditivas sobre el schema `obra_social` existente

- **`supabase/migrations/20260731120000_obra_social_config_facturacion.sql`** (expand, aditivo,
  ninguna columna existente se altera ni se borra):
  - `obra_social.obra_social` gana `plazo_cobro_dias`, `modalidad_facturacion`,
    `admite_pagos_parciales` e `identificador_origen`. Son las reglas de negocio **RN-FA-07/08**
    y el default de **IN-01**, que el docx no tiene y que la KB sí exige — se suman a la base, no se
    descartan por ausencia en el docx (discrepancia 1 de `CHANGES.md` §C-04).
  - `obra_social.requisitos_os` (la tabla de vínculo del docx contra el catálogo compartido
    `tipos_documento`) gana `orden` y `requerido`. **RN-FA-08 dice que el orden es normativo** y hoy
    la tabla no tiene forma de expresarlo: sin esta columna el checklist vuelve del servidor en un
    orden arbitrario de Postgres.
  - **Tabla nueva `obra_social.campos_plantilla_factura`** (`obra_social_id`, `etiqueta`, `origen`,
    `orden`), con RLS + policies + trigger de auditoría + índice sobre la FK **en la misma
    migración** (regla dura del proyecto).
  - Índices faltantes sobre las FK ya existentes (`requisitos_os.obra_social_id`,
    `requisitos_os.tipo_documento_id`) — los usa cada listado.
- **`supabase/migrations/20260731120001_obra_social_rpc.sql`**: dos funciones **`SECURITY INVOKER`**,
  `obra_social.crear_obra_social_completa(jsonb) RETURNS uuid` y
  `obra_social.actualizar_obra_social_completa(uuid, jsonb) RETURNS uuid`. El alta y la edición de
  una obra social escriben en hasta 4 tablas (`obra_social`, `tipos_documento`, `requisitos_os`,
  `campos_plantilla_factura`) y PostgREST no da transacción entre requests. Mismo patrón exacto,
  y misma prohibición explícita de `SECURITY DEFINER`, que `pacientes.crear_paciente_completo`
  (`integracion-pacientes` D4, ya aplicada y verificada).

### 2. El checklist pasa a ser relacional (discrepancia 2 del docx, resuelta acá)

Hoy el frontend modela `ObraSocial.checklist: ChecklistItem[]` como array embebido. El docx —y el
schema real— lo modelan como tabla de vínculo `requisitos_os` contra el catálogo **compartido**
`tipos_documento`, que además es el mismo catálogo al que apunta
`pacientes.documentos.id_tipo_documento` con `ON DELETE RESTRICT`. **La persistencia pasa a ser
relacional; el tipo del frontend no cambia** — la traducción vive en el mapeo puro. Consecuencia
nueva y no obvia: editar el checklist de una obra social escribe en un catálogo compartido con
Pacientes (ver `design.md` D3, es un ⚠️ CHECKPOINT).

### 3. Los 4 campos del docx que faltaban en el frontend (discrepancia 3)

`ObraSocial` gana `codigo`, `direccion`, `telefono` y `condicionIva` — las cuatro columnas ya existen
en `obra_social.obra_social` y hoy **ninguna vía de la app puede completarlas**. Se suman al tipo, al
formulario y a la ficha. `mockObraSocialRepository` sube `SCHEMA_VERSION` 1 → 2.

### 4. Frontend — el swap

- **`SupabaseObraSocialRepository.ts`** nuevo en `frontend/src/shared/lib/obrasSociales/`, cumpliendo
  `ObraSocialRepository` **sin cambiarle una firma** (`list`, `getById`, `create`, `update`).
- **`obraSocialMapping.ts`** nuevo: todo el mapeo fila↔dominio como funciones puras con type guards
  sobre `unknown` (nunca `any`, nunca `as`), testeable sin red. Mismo criterio que
  `pacienteMapping.ts`.
- **Un solo archivo de producto cambia el cableado**: `ObraSocialesRoute.tsx` (composition root).
  Ningún componente, hook ni context de `features/obras-sociales/` se toca por el swap.
- **`mockObraSocialRepository` NO se borra**: sigue como doble de test y para desarrollo sin backend.

### 5. Lo que este change NO hace

- **NO incluye la entidad `Prestadores`.** La tabla `obra_social.prestadores` ya existe con RLS, pero
  no tiene tipo, repository, ruta ni pantalla: incluirla sería *construir una pantalla nueva*, no
  *conectar una existente*, que es exactamente el corte de esta serie de changes. Además el docx no
  define la relación Prestador↔ObraSocial y la KB no tiene ni una regla de negocio sobre Prestadores
  (solo la menciona como atributo suelto, "condiciones por prestador"). Se propone como change propio
  `prestadores-crud`. **Decisión documentada, no silenciada** — ver `design.md` D8.
- **NO resuelve ninguna pregunta abierta de prioridad Alta.** Identificación fiscal (RN-ID-01),
  checklists de otras obras sociales, "FIM" e IN-01 avanzan con el default ya documentado en la KB,
  **configurable en columna**, nunca hardcodeado ni bloqueante.
- **NO toca `obra_social.coberturas_paciente`** (es de Pacientes, ya integrada) ni ninguna migración
  existente. Cero Edge Functions. Cero `service_role`.
- **NO introduce TanStack Query** ni toca `useObrasSociales`.

## Capabilities

### New Capabilities
- `obra-social-repository-supabase`: implementación real de `ObraSocialRepository` contra el schema
  `obra_social` — mapeo bidireccional de las 4 tablas involucradas, checklist relacional ordenado
  contra el catálogo compartido `tipos_documento`, alta y edición atómicas vía funciones
  `SECURITY INVOKER`, traducción de errores de PostgREST a castellano, consumo (nunca duplicación) de
  las policies de RLS existentes, e inyección en el composition root.

### Modified Capabilities
- `obra-social-contract`: el tipo `ObraSocial` gana los 4 campos del docx (`codigo`, `direccion`,
  `telefono`, `condicionIva`); el requisito "Implementación mock del repository" deja de ser la
  implementación inyectada en la app; el contrato de errores del repository pasa a ser **normativo**
  porque ahora hay dos implementaciones que deben coincidir.
- `obra-social-checklist-editor`: la persistencia del checklist pasa de array embebido a tabla de
  vínculo contra un catálogo compartido. El orden pasa a ser una columna explícita (`orden`), no la
  posición en un array. Se agrega el requisito de que renombrar/agregar un ítem afecta un catálogo
  compartido con Pacientes.
- `obra-social-crud`: el alta y la edición pasan a capturar también los 4 campos del docx, y el alta
  pasa a ser una única operación atómica del servidor.

## Impact

**Código nuevo**
- `frontend/src/shared/lib/obrasSociales/obraSocialMapping.ts` + `.test.ts`
- `frontend/src/shared/lib/obrasSociales/SupabaseObraSocialRepository.ts` + `.test.ts`

**Código modificado**
- `frontend/src/shared/types/obraSocial.ts` (4 campos nuevos, opcionales)
- `frontend/src/shared/lib/mocks/mockObraSocialRepository.ts` (`SCHEMA_VERSION` 1 → 2)
- `frontend/src/shared/lib/mocks/osecacFixture.ts` (4 campos nuevos)
- `frontend/src/features/obras-sociales/ObraSocialForm.tsx` + `validateObraSocialForm.ts`
- `frontend/src/features/obras-sociales/ObraSocialDetail.tsx` (campos + `AvisoModeloDatos`)
- `frontend/src/features/obras-sociales/ObraSocialesRoute.tsx` (**el swap**, única línea de cableado)
- `frontend/src/features/obras-sociales/ObraSocialesRoute.test.tsx` (doble inyectado)
- `frontend/src/features/obras-sociales/ChecklistEditor.tsx` (`AvisoModeloDatos` del catálogo
  compartido)

**Base de datos**
- `supabase/migrations/20260731120000_obra_social_config_facturacion.sql` (**nuevo**, aditivo)
- `supabase/migrations/20260731120001_obra_social_rpc.sql` (**nuevo**, dos funciones)
- **Las aplica la usuaria / backend (Enzo)**, no el agente: `supabase db push` requiere Docker o
  credenciales del proyecto real, que el sandbox no tiene (mismo bloqueo que 1B.3 de
  `integracion-pacientes`; ojo con el desfasaje de historial de migraciones ya anotado ahí).

**Documentación**
- `knowledge-base/04_modelo_de_datos.md` §Discrepancias (bloque "Obras Sociales vs. esquema real de
  `C-04`" + contrato de las dos funciones nuevas)
- `knowledge-base/10_preguntas_abiertas.md` (las 3 preguntas nuevas que abre este change)
- `CHANGES.md` §`C-04` (actualizar el bloque ⚠️: qué queda resuelto y qué no) y §Plan de integración
  (fila 2 → estado real)
- `ROADMAP-FRONTEND.md` §FE-8

**Sin impacto**
- `ObraSocialRepository.ts` (la interfaz), `useObrasSociales.ts`, `ObraSocialRepositoryContext.tsx`,
  `ObrasSocialesList.tsx`, `PlantillaFacturaEditor.tsx`, `ChecklistItemRow.tsx` — sin cambios.
- Ninguna migración existente se edita. `obra_social.prestadores` queda intacta y sin usar.
- Los 7 módulos restantes siguen en mock.

**Dependencias**
- Requiere (ya cumplido): `C-01`, `C-02` + `auth-frontend-real`, `permisos-modulos-granulares`
  (el módulo `obra_social` quedó igual en el split de 4→7), y
  `20260724100003_schema_obra_social.sql` aplicada.
- **No depende de que `integracion-pacientes` se archive.** Las dos tablas que comparten
  (`coberturas_paciente`, `tipos_documento`) no se modifican acá.
- Habilita: Facturación (C-07, fila 4 del plan de integración) y cierra el maestro que la ficha de
  Pacientes ya está leyendo real.

**Riesgo y rollback**
- Riesgo principal: **el checklist escribe en un catálogo compartido con Pacientes**
  (`tipos_documento`, `ON DELETE RESTRICT` desde `pacientes.documentos`). Un ítem mal escrito queda
  en el catálogo y, si algún documento de paciente ya lo referencia, **no se puede borrar**. Es un
  ⚠️ CHECKPOINT de diseño (D3), a confirmar con la usuaria antes de escribir código.
- Riesgo de seguridad: convertir cualquiera de las dos funciones a `SECURITY DEFINER` bypassearía el
  gateo por módulo. Mitigado en cuatro capas (design, cabecera de la migración, `COMMENT ON
  FUNCTION`, y un test automatizado del texto del `.sql` — el mismo de la tarea 3.12b de
  `integracion-pacientes`, que ya demostró funcionar).
- Riesgo operativo: si las migraciones no se aplican, el alta responde `PGRST202` y las columnas
  nuevas `PGRST204`. Mitigado: aplicarlas es tarea **bloqueante** del cableado, y ambos códigos
  tienen mensaje propio en castellano.
- **Rollback**: revertir `ObraSocialesRoute.tsx` al mock (un import y una prop). Las migraciones son
  aditivas: las columnas nuevas quedan con su `DEFAULT` y nadie las lee; las funciones sin llamador
  son inertes. Si se quisiera limpiar del todo: `DROP FUNCTION` × 2 + `DROP TABLE
  obra_social.campos_plantilla_factura` + `ALTER TABLE … DROP COLUMN` de las 4 columnas nuevas.
  **Ningún dato existente se transforma ni se borra en ningún paso.**
