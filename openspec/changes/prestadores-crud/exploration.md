# Exploración: CRUD de Prestadores (`prestadores-crud`)

## Estado actual

**Schema real, verificado en `supabase/migrations/20260724100003_schema_obra_social.sql:28-34`:**

```sql
CREATE TABLE obra_social.prestadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razon_social TEXT NOT NULL,
    cuit TEXT NOT NULL UNIQUE,
    direccion TEXT,
    telefono TEXT
);
```

**RLS y policies** (mismo archivo, líneas 40 y 55-56), gateadas por el mismo módulo que Obra
Social, no uno propio:

```sql
ALTER TABLE obra_social.prestadores ENABLE ROW LEVEL SECURITY;
...
CREATE POLICY "Read prestadores" ON obra_social.prestadores FOR SELECT TO authenticated USING (modulos.tiene_permiso('obra_social', 'read'));
CREATE POLICY "Write prestadores" ON obra_social.prestadores FOR ALL TO authenticated USING (modulos.tiene_permiso('obra_social', 'write'));
```

Trigger de auditoría también presente (línea 66: `trg_audit_prestadores`).

**Sin FK — confirmado.** Grep de `prestador` sobre las 27 migraciones solo devuelve coincidencias
en `20260724100003_schema_obra_social.sql` (la creación original) y comentarios de
`20260729110000_schema_obra_social_facturacion_config.sql` que mencionan "prestador" en prosa, sin
ningún `ALTER TABLE ... ADD ... REFERENCES` sobre `prestadores` en ninguna migración existente. La
tabla está exactamente como se creó el 2026-07-24, intocada desde entonces.

**Cero Prestador en frontend — confirmado.** Grep case-insensitive de `prestador` en
`frontend/src/` da 5 archivos, y los 5 son menciones en comentarios/prosa sobre la ambigüedad del
CUIT, no un tipo/repository real: `shared/types/obraSocial.ts:64-68` (JSDoc del campo `cuit`),
`ObraSocialDetail.tsx:188-196` (el `AvisoModeloDatos` de la discrepancia #12),
`ObraSocialDetail.test.tsx`, `osecacFixture.ts`, `ObraSocialRepository.ts` (comentarios de
contexto equivalentes). No hay `Prestador` como tipo, repository, ruta ni pantalla en ningún lado.
Nada que duplicar.

**Grep de `prestador_id`/`prestadorId` en todo el repo: cero resultados.** Ningún consumidor real
(ni `Factura`, ni ningún otro tipo) referencia Prestador. Cero acoplamiento existente que
gestionar.

**Decisión previa — `openspec/changes/integracion-obra-social/design.md` D8, leída completa.**
Confirma exactamente lo anterior y añade tres razones para dejarlo fuera de ese change: (1) es
"construir pantalla nueva" vs. "conectar pantalla existente" (naturaleza distinta de trabajo), (2)
no hay ni una `RN-` ni una US con criterio de aceptación específico sobre Prestadores en la KB, (3)
la relación Prestador↔ObraSocial no está definida en ninguna fuente (ni FK, ni docx).

## Patrón de referencia a espejar: `ObraSocial` end-to-end (ya implementado y aplicado)

Estructura de archivos exacta a replicar para Prestador:

```
frontend/src/shared/lib/obrasSociales/
  ObraSocialRepository.ts          — interfaz: list/getById/create/update
  obraSocialMapping.ts             — mapeo puro fila↔dominio, type guards sobre unknown
  SupabaseObraSocialRepository.ts  — implementación real, I/O únicamente
  obraSocialMapping.test.ts / SupabaseObraSocialRepository.test.ts

frontend/src/features/obras-sociales/
  ObraSocialRepositoryContext.tsx  — Context + Provider
  useObrasSociales.ts               — hook con loading/error
  ObraSocialesRoute.tsx             — composition root (único lugar que conoce Supabase)
  ObraSocialesPage.tsx              — decide list vs. detail, monta el gateo (AvisoSoloLectura)
  ObrasSocialesList.tsx             — grid de tarjetas, búsqueda local, estados vacío/error/loading
  ObraSocialDetail.tsx              — ficha + form embebido
  ObraSocialForm.tsx + validateObraSocialForm.ts
```

Puntos concretos verificados:

- **Interfaz** (`ObraSocialRepository.ts:7-13`): `list()/getById()/create()/update()`, `getById`
  resuelve `null` en vez de lanzar cuando no existe o RLS filtra.
- **Mapeo puro** (`obraSocialMapping.ts:31-78`): `isRecord()` como único type guard base,
  `readOptionalString()`, sets de valores válidos + defaults documentados con comentario de por
  qué (nunca hardcodeados "a ciegas"), filas hijas malformadas se descartan en silencio en vez de
  romper el registro completo.
- **Repository real**: solo I/O — arma el `select`, chequea `error`, delega el mapeo. Traducción
  de errores PostgREST→`Error` en castellano centralizada (`mapearErrorObraSocial`), nunca
  propaga `error.message` crudo.
- **Composition root** (`ObraSocialesRoute.tsx`): un único archivo importa la implementación
  Supabase concreta; el resto de la feature (13 componentes) solo conoce la interfaz.
- **Gateo RLS-driven en la UI**: `ObraSocialesPage.tsx` monta `<AvisoSoloLectura />` una sola vez a
  nivel de página; `Button` usa la prop `requiereEscritura` para deshabilitarse client-side cuando
  el usuario no tiene `write`. La defensa real sigue siendo la policy — el gateo de UI es solo UX.
- **Form**: estado controlado plano, sin librería de formularios (YAGNI explícito en el comentario
  de `ObraSocialForm.tsx` — "React Hook Form/Zod serían sobre-ingeniería" para pocos campos).
  Prestador con 4 campos (razón social, CUIT, dirección, teléfono) encaja directamente en este
  mismo criterio.

## Enfoque de CRUD: RPC atómica no hace falta

`obra_social.prestadores` no tiene tablas hijas (a diferencia de `obra_social.obra_social`, que
coordina hasta 4 tablas vía `crear_obra_social_completa`/`actualizar_obra_social_completa`). Sin
colecciones hijas no hay problema de atomicidad multi-request que resolver: un alta o edición de
Prestador es un único `INSERT`/`UPDATE` sobre una sola fila plana.

Hay precedente directo en el propio repo para este caso más simple: `SupabasePacienteRepository.ts`
hace un `.update()` PostgREST directo (sin RPC) para los campos propios y planos de `paciente`,
mientras que el alta completa (que sí toca colecciones hijas) usa RPC. Es la misma distinción que
aplica acá: **create/update de Prestador puede ser PostgREST directo (`.insert()`/`.update()`),
sin función `SECURITY INVOKER` custom**, salvo que el diseño futuro descubra una necesidad real de
coordinación (por ejemplo, si Andrea confirma que un Prestador debe vincularse a una o más
ObraSocial en el mismo alta — ver preguntas abiertas).

## Módulo de permisos y navegación: sin slot reservado, y no hace falta uno nuevo

El catálogo real de 7 módulos de negocio (`modulos.modulos`, tras el split de
`20260730140000_split_modulos_permisos.sql`) es: `pacientes`, `hojas_de_ruta`, `obra_social`,
`facturacion`, `presupuestos`, `conductores`, `vehiculos`. No existe ni un módulo `prestadores` ni
un ícono reservado en `frontend/src/app/routes.ts`/`navIcons.tsx`.

Esto no es una laguna a llenar con un módulo nuevo — es una restricción real: la policy de
`prestadores` ya está fija a `tiene_permiso('obra_social', ...)`. Agregar un módulo `prestadores`
nuevo no cambiaría nada salvo que además se reescribiera la RLS de una tabla ya en producción, sin
ninguna razón que lo justifique. La única opción coherente con el schema real es: **la pantalla de
Prestador se gatea con el módulo `obra_social` ya existente**, igual que hoy lo hace
`/obras-sociales`.

Queda para la fase de diseño si la pantalla vive en una ruta propia (`/prestadores`) o como
pestaña/sección dentro de `/obras-sociales` — es una decisión de UX, no de permisos.

## RN-ID-01 / US-300: no obligan a que Prestador duplique campos de ObraSocial

- **RN-ID-01**: *"El CUIL identifica al titular... el CUIT identifica a la empresa prestadora."*
  Solo distingue CUIT de CUIL — no dice cuál tabla (`obra_social.cuit` o `prestadores.cuit`) es "la
  empresa prestadora", y está marcada explícitamente como "supuesto a confirmar con el cliente".
- **US-300**, épica *"Obras sociales y prestadores"*: *"Se registra plazo de cobro, tipo de
  comprobante (A/B/C) y demás condiciones particulares por prestador"* y *"Se registra el CUIT de
  la empresa prestadora"*. Pero `plazoCobroDias`, `tipoComprobante`, `modalidadFacturacion` y
  `admitePagosParciales` **ya están implementados como columnas de `obra_social.obra_social`**, no
  de `obra_social.prestadores`.

**Lectura más probable**: la KB usa "prestador" en el sentido coloquial de "la empresa que le
facturamos" (= la obra social como entidad pagadora), no como referencia a la tabla `prestadores`
del docx. **No hay evidencia en ninguna fuente de que `prestadores` deba tener su propio
`plazoCobroDias`/`tipoComprobante` propio** — construir eso sería adivinar.

## La ambigüedad del CUIT (#12): construir Prestador CRUD no la resuelve, la vuelve más visible

Hoy `ObraSocialDetail.tsx` muestra un único CUIT (`obra_social.cuit`) con un cartel de advertencia.
Si se construye la pantalla de Prestador, **habrá dos CUITs completables y visibles
simultáneamente en la app** sin que ninguna fuente diga cuál es "el CUIT del prestador/entidad
pagadora" que menciona el docx. La ambigüedad no se resuelve — se vuelve más concreta y más urgente
de confirmar.

## Preguntas abiertas para Andrea (no se responden acá)

1. **¿Cuál es la relación entre `Prestador` y `ObraSocial`?** Sin FK en la base, sin definición en
   el docx. ¿1:N, N:N, o ninguna relación estructural (dos catálogos independientes)? Bloquea si el
   diseño debe incluir un selector/vínculo en la UI o si Prestador es un maestro totalmente aislado
   en esta primera versión.
2. **¿Qué representa realmente `prestadores.cuit` frente a `obra_social.cuit`?** (discrepancia
   #12). Construir la pantalla no la resuelve — la vuelve visible en dos lugares a la vez.
3. **¿"condiciones particulares por prestador" de US-300 ya está resuelto por los campos que hoy
   viven en `obra_social.obra_social`, o el negocio espera que `prestadores` tenga su propia copia
   de `plazoCobroDias`/`tipoComprobante`/etc.?** Ninguna fuente lo pide hoy; si Andrea confirma que
   sí, es una migración nueva más una `RN-` nueva a documentar en la KB antes de codear.
4. **¿El alcance de esta primera versión son solo los 4 campos ya existentes** (razón social, CUIT,
   dirección, teléfono) **o Andrea espera campos adicionales** que hoy no están en ningún lado?

## Recomendación para la fase de propuesta

- CRUD de Prestador como maestro simple e independiente, espejando el patrón de archivos de
  `ObraSocial` **sin** capa RPC — `.insert()`/`.update()` directos de PostgREST.
- Gatear la nueva ruta con `modulo: 'obra_social'` (ya existente) — no crear ni sembrar un módulo
  `prestadores` nuevo.
- No tocar el schema de `obra_social.prestadores` (mantenerlo en sus 4 columnas actuales) salvo que
  Andrea confirme una relación o campos adicionales.
- Dejar las 4 preguntas abiertas explícitas en `proposal.md`/`design.md` como checkpoint bloqueante
  antes de `tasks.md`, mismo patrón que D3/D8 de `integracion-obra-social`.
- Rama de demo (`feature/prestadores-crud`) — conviene que la propuesta deje explícito que el
  checkpoint de las preguntas 1 y 3 puede resolverse durante esa misma demo con Andrea.

## Riesgos

- Si se construye la relación Prestador↔ObraSocial sin confirmación de Andrea, cualquier modelo
  (FK, tabla de vínculo) sería una adivinanza.
- Si Andrea confirma que `prestadores` necesita sus propias `plazoCobroDias`/`tipoComprobante`, eso
  implica una migración nueva y una regla de negocio (`RN-PR-xx`) que hoy no existe en la KB.
- La ambigüedad del CUIT (#12) queda más visible tras este change, lo que puede generar confusión
  operativa real si no se aclara antes de que el equipo empiece a cargar datos de producción.
- Rama de demo fresca sobre `main`: si Andrea pide cambios estructurales después de ver la demo,
  conviene mantener el primer corte deliberadamente pequeño (los 4 campos actuales, sin relación).

## Listo para propuesta

Sí, con las 4 preguntas abiertas como checkpoint explícito antes de `tasks.md`.
