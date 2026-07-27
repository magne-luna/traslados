## Context

Rama **Pacientes y fichas clínicas** de la fase **FE-3** del `ROADMAP-FRONTEND.md`, lado UI de `C-05 pacientes-fichas-clinicas`. El paciente es la entidad central: de su ficha dependen Presupuestos (FE-4), Hojas de Ruta (FE-5) y Facturación (FE-6). Se construye frontend + mock; el backend real (`C-05`: tablas, RLS, cliente Supabase) es otra sesión.

Estado actual del frontend (ya existe, se reutiliza como patrón, NO se recrea):
- Stack: React 19 + TypeScript strict + Tailwind v4 (Vite). Tokens semánticos en el bloque `@theme` de `frontend/src/index.css`; primitivos del design-system en `frontend/src/design-system/`.
- **FE-1** estableció el patrón **contrato → mock → hook → componente presentacional**: `DocumentoRepository` + `mockDocumentoRepository` + `useDocumentChecklist` + `DocumentChecklist`. `ChecklistItem`/`DocumentoAdjunto` viven en `shared/types/documento.ts`; `EntidadDocumental` ya incluye `'paciente'`.
- **FE-2** archivó `obras-sociales-ui` y `vehiculos-ui`: `ObraSocial`/`ObraSocialRepository`/`mockObraSocialRepository` (checklist configurable por obra social, `identificadorOrigen` de factura para IN-01), `Vehiculo`/`AccesorioMovilidad`/`mockVehiculoRepository`. El mock persiste en `localStorage` con `schemaVersion` + `withLatency` + fixture sembrado. Convención de UI: fila de listado clickeable + botón "Editar" con `stopPropagation`; detalle con resumen/editar separados.

Restricciones duras del proyecto: TypeScript strict, prohibido `any` (usar `unknown` + narrowing); prohibido crear cliente Supabase real / RLS en este change; Tailwind v4 utility classes, nunca `style={{}}` inline; Conventional Commits. Dominio con datos de salud y de menores de edad (CUD, personas a cargo).

## Goals / Non-Goals

**Goals:**
- Contrato de datos `Paciente` + `PacienteRepository` que no haya que reescribir cuando llegue `C-05` backend.
- Identificador de afiliado adaptable (RN-ID-02, IN-01) y direcciones ida/vuelta independientes (RN-HR-02) modelados explícitamente en el tipo y en el formulario.
- CUD con función pura de estado de vencimiento (RF-104), testeable, siguiendo el patrón `estadoHabilitacion`/`estadoServicePreventivo` de FE-2.
- Ficha completa (listado/detalle/edición) siguiendo la convención de UI de FE-2, reutilizando design-system, `DocumentChecklist` (FE-1) y `ObraSocialRepository` (FE-2).
- Documentación del paciente filtrada por el checklist de su obra social.

**Non-Goals:**
- Cliente Supabase real, migraciones SQL, RLS (es `C-05` backend, FE-8).
- Presupuestos/autorizaciones (FE-4), historial de traslados y validación de compatibilidad de vehículo con el accesorio de movilidad (FE-5 — acá solo se guarda el accesorio, no se valida contra vehículos).
- Router / navegación global (lo aporta FE-0 / AppShell; acá se monta la feature dentro del shell existente).
- Validación fiscal real de CUIL/DNI (solo formato básico en UI).

## Decisions

### Decisión 1 — Identificador de afiliado como estructura `{ formato, valor }`, formato de unión cerrada
El identificador de afiliado varía por obra social (RN-ID-02): número de documento, alfanumérico, o CUIL del titular con sufijo /01, /02. Se modela como `IdentificadorAfiliado = { formato: FormatoAfiliado; valor: string }` con `FormatoAfiliado = 'numero-documento' | 'alfanumerico' | 'cuil-con-sufijo'` (unión cerrada, **nunca** `string` libre ni un único formato hardcodeado). El `valor` es libre (el formato solo etiqueta/valida en UI). El fixture siembra pacientes con los tres formatos.
- Esto ancla el lado paciente de **IN-01**. FE-2 ya modeló el lado factura: `PlantillaFactura.identificadorOrigen: 'paciente.dni' | 'paciente.numeroAfiliado'` elige, por obra social, qué campo alimenta el identificador de la factura. Por eso `Paciente` expone **ambos**: `dni` y `numeroAfiliado` (este último es el `IdentificadorAfiliado` adaptable). Así la obra social decide cuál usar sin que el paciente lo prejuzgue.
- El formato por defecto al crear (`'numero-documento'`) se define como constante documentada y **editable en el form**, no como valor fijo incrustado en la lógica.
- **Alternativa descartada:** un solo campo `numeroAfiliado: string` — perdería la semántica del formato, imposible de validar/mostrar por obra social y ataría IN-01 a una única forma.

### Decisión 2 — Direcciones como lista de registros con `tramo`, sin autocompletar la vuelta
Cada dirección es un registro independiente `Direccion = { id, tipo, tramo, ...campos, dias?, horario? }` con `tramo: 'ida' | 'vuelta'` y `tipo: TipoDireccion` (`'domicilio' | 'escuela' | 'terapia' | 'ciset' | 'otro'`). `Paciente.direcciones: Direccion[]`. RN-HR-02 se modela **explícitamente**: la vuelta es un registro aparte y el editor **NO** deriva ni copia la ida en la vuelta — el usuario completa cada tramo a mano. Esto se refuerza con un test de que agregar/editar la ida deja la vuelta intacta.
- **Alternativa descartada:** una `Direccion` con `origen` + `destino` embebidos y un flag `vueltaIgualQueIda` — invita justamente al autocompletado que RN-HR-02 prohíbe; el modelo por tramo lo hace estructuralmente imposible de asumir.

### Decisión 3 — CUD con función pura `estadoCud(cud, hoy, umbralDias)`
El estado de vigencia se deriva con una función pura en `shared/lib/pacientes/estadoCud.ts` que devuelve `'vigente' | 'por-vencer' | 'vencido'`, recibiendo la fecha de referencia como parámetro (no lee `Date.now()` internamente) para ser determinística y testeable — mismo patrón que `estadoHabilitacion`/`estadoServicePreventivo` de FE-2. Umbral por defecto documentado (60 días), parametrizable. El componente de UI le pasa `new Date()` en el borde.
- **Alternativa descartada:** calcular el estado inline dentro del componente — no testeable en aislamiento y viola el patrón de funciones puras ya establecido.

### Decisión 4 — Obra social por referencia (`obraSocialId`), no embebida
`Paciente.obraSocialId: string | null`. El checklist y la plantilla se leen siempre del maestro de FE-2 vía `ObraSocialRepository.getById(obraSocialId)`. Así el checklist documental del paciente refleja la config vigente de la obra social sin copias desincronizadas.
- **Alternativa descartada:** embeber la `ObraSocial` en el `Paciente` — generaría datos duplicados y stale cuando se edite la obra social en FE-2.

### Decisión 5 — Mock `localStorage` + latencia + fixture, cumpliendo la interfaz (patrón FE-2)
`mockPacienteRepository` replica el patrón de `mockObraSocialRepository`: `STORAGE_KEY` propio, `SCHEMA_VERSION`, `withLatency`, `readStore/writeStore`, re-siembra desde fixture ante `localStorage` ausente/corrupto/mismatch de versión. `pacientesFixture.ts` siembra 2-3 pacientes con formatos de afiliado distintos, uno con amparo judicial, direcciones ida/vuelta de ejemplo y CUD con distintos estados de vencimiento (uno por vencer) para ejercitar la alerta.
- **Alternativa descartada:** in-memory — se perdería la ficha entre recargas, empobreciendo la prueba de la UI.

### Decisión 6 — Estructura de carpetas y punto de inyección
Contrato + función pura + mock en `shared/` (reusable por FE-4/5/6); pantallas y hooks en `features/pacientes/`. Siguiendo `08_arquitectura_propuesta.md` (estructura por feature) y la Decisión 5/6 de `obras-sociales-ui`: las pantallas reciben el `PacienteRepository` (y el `ObraSocialRepository`, y el `DocumentoRepository`) por inyección desde el punto de composición de la feature, **nunca** importan el mock directamente. Swap a Supabase en FE-8 = un solo punto de cambio.
- Hook `usePacientes(repository)` con `pacientes`, `loading`, `error`, `crear()`, `actualizar()`, recargando tras cada mutación (patrón `useDocumentChecklist`). Hooks con >2 valores devuelven un **objeto**, no array.

### Decisión 7 — Documentación del paciente reutiliza `DocumentChecklist` + `useDocumentChecklist`
La pestaña de documentos resuelve la obra social del paciente (`ObraSocialRepository.getById`), toma su `checklist: ChecklistItem[]` y lo pasa a `useDocumentChecklist('paciente', paciente.id, items, documentoRepository)` + `<DocumentChecklist />`. No se recrea nada del modelo documental. Estado vacío explícito cuando el paciente no tiene obra social o su checklist está vacío.

## Risks / Trade-offs

- **Divergencia de campos con el backend real (`C-05`)** → Los nombres/tipos de `Paciente` podrían no calzar con la tabla real. Mitigación: los campos salen directo de `04_modelo_de_datos.md §Paciente`; como la UI habla con la interfaz, el ajuste queda contenido en el adaptador `SupabasePacienteRepository`.
- **IN-01 sin cerrar (identificador de afiliado / de factura)** → Riesgo de hardcodear una forma. Mitigación: `formato` es unión cerrada extensible con default documentado y editable; el lado factura ya lo elige por obra social (FE-2). Queda como Open Question.
- **Datos sensibles (CUD, menores) sin RLS en este change** → La UI podría asumir acceso irrestricto y complicar el gateo por permiso en FE-8. Mitigación: CUD y personas a cargo se aíslan en secciones propias de la ficha, ocultables/deshabilitables por permiso sin reescribir el resto. Este change NO implementa el gateo (es FE-8), solo deja la costura.
- **`localStorage` sin versionado de esquema** → si cambia la forma de `Paciente`, los datos viejos podrían romper la deserialización. Mitigación: `schemaVersion` en el payload y re-siembra desde fixture ante mismatch (es solo mock).
- **Drag-and-drop de direcciones/personas** → No se requiere reorder aquí (a diferencia del checklist de FE-2); las listas usan alta/baja simple con key estable por id. Si más adelante se pide ordenar, se reusa el `reorder.ts` de FE-2.

## Migration Plan

No aplica migración de datos (frontend + mock, sin backend). Camino de reemplazo futuro (FE-8, cuando `C-05` backend se archive): escribir `SupabasePacienteRepository` que cumpla `PacienteRepository`, inyectarlo en el punto de composición de la feature en lugar del mock, y aplicar el gateo por permiso/RLS sobre las secciones sensibles (CUD, personas a cargo). Componentes, hooks, tipos y la función `estadoCud` no cambian.

## Open Questions

- Confirmar con el cliente el formato definitivo del identificador de afiliado por obra social y qué campo alimenta el identificador de la factura (IN-01). Mientras tanto: `formato` configurable + default documentado.
- Confirmar el umbral de "CUD por vencer" (se asume 60 días, alineable con la alerta de facturación).
- Confirmar si CUIL (titular) y CUIT (prestador) son definitivamente campos separados (RN-ID-01) — ya se modelan separados.
- Coordinar con backend los nombres exactos de campos de `Paciente` antes de que `C-05` cierre, para minimizar el adaptador.
