## Context

Fase **FE-2 (rama Obras Sociales)** del `ROADMAP-FRONTEND.md`, lado UI de `C-04 obras-sociales-prestadores`. Es un maestro del que dependen Pacientes (FE-3), Presupuestos (FE-4) y Facturación (FE-6). Se construye frontend + mock: el backend real (`C-04`: tablas, RLS, cliente Supabase) es otra sesión.

Estado actual del frontend (ya existe, se reutiliza como patrón):
- Stack: React 19 + TypeScript strict + Tailwind v4 (Vite). Sin router ni librería de estado todavía; sin dependencia de drag-and-drop instalada.
- FE-1 estableció el patrón **contrato → mock → hook → componente presentacional**: `DocumentoRepository` (interfaz) + `mockDocumentoRepository` (in-memory) + `useDocumentChecklist` (hook de wiring) + `DocumentChecklist` (presentacional). El tipo `ChecklistItem` (`{ id, nombre, requerido }`) vive en `frontend/src/shared/types/documento.ts` y es reutilizable.
- Design system: primitivos en `frontend/src/design-system/components.tsx` (`Section`, `Chip`, `Button`, etc.) con estilo inline via `tokens.ts`.

Restricciones duras del proyecto: TypeScript strict, prohibido `any` (usar `unknown` + narrowing); prohibido crear cliente Supabase real / RLS en este change; Conventional Commits.

## Goals / Non-Goals

**Goals:**
- Contrato de datos `ObraSocial` + `ObraSocialRepository` que no haya que reescribir cuando llegue `C-04` backend.
- Mock con `localStorage` + latencia para loading/error states reales, OSECAC precargado.
- CRUD + editor de checklist con reorder + editor de plantilla de factura, reutilizando FE-1 y el design system.
- Todas las preguntas abiertas de prioridad Alta (checklists de otras OS, FIM, CUIL/CUIT, identificador de factura) quedan como dato configurable con default documentado.

**Non-Goals:**
- Cliente Supabase real, migraciones SQL, RLS (es `C-04` backend, FE-8).
- Integración con Pacientes/Facturación (esos son FE-3/FE-6; acá solo se deja el contrato listo para que los consuman).
- Router / navegación global (FE-0 lo definirá o ya lo mockea; acá se monta la feature de forma aislada).
- Validación fiscal real de CUIT (solo formato básico en UI).

## Decisions

### Decisión 1 — Persistencia del mock en `localStorage`, no in-memory
El mock documental de FE-1 es in-memory (se pierde al recargar). Para Obras Sociales se usa `localStorage` porque es un maestro que el usuario configura una vez y espera reencontrar entre recargas mientras prueba la UI. Se encapsula la (de)serialización dentro del mock; el resto de la app solo ve la interfaz.
- **Alternativa descartada:** in-memory como FE-1 — se perdería la configuración de checklist/plantilla en cada reload, empobreciendo la prueba de la UI. La interfaz es idéntica en ambos casos, así que la elección no filtra a los componentes.

### Decisión 2 — Reutilizar `ChecklistItem`, extender la `ObraSocial` con checklist embebido
El checklist de obra social usa el mismo `ChecklistItem` de `documento.ts` (misma forma: `id`, `nombre`, `requerido`). `ObraSocial` embebe `checklist: ChecklistItem[]` en vez de una entidad relacionada aparte, porque en el mock no hay joins y el checklist siempre se lee/escribe junto con la obra social (relación 1—1 en el ERD).
- **Alternativa descartada:** un `ChecklistRepository` separado — sobra-ingeniería para 1—1; el día del backend real la tabla puede ser separada y el `SupabaseObraSocialRepository` la ensambla, sin cambiar el tipo que ve la UI.

### Decisión 3 — Plantilla de factura como lista de campos dinámicos tipados
La plantilla se modela como `campos: PlantillaCampo[]` donde cada `PlantillaCampo` tiene `{ id, etiqueta, origen, orden }`. `origen` es una unión de string literales del origen del dato (p. ej. campo del paciente / valor manual), no `any` ni `string` libre, para mantener strict y habilitar el identificador configurable de factura (IN-01). Los valores admitidos de `origen` se documentan como default y quedan extensibles.
- **Alternativa descartada:** plantilla como string con placeholders (`"{afiliado} - {mes}"`) — más frágil, difícil de reordenar en UI y de tipar; los campos estructurados permiten drag-and-drop y validación.

### Decisión 4 — Reorder con drag-and-drop nativo HTML5, sin nueva dependencia
El reorder del checklist y de los campos de plantilla se implementa con la API nativa de drag-and-drop de HTML5 (`draggable`, `onDragStart/onDragOver/onDrop`), sin sumar `dnd-kit` ni `react-beautiful-dnd`. Motivo: la lista es corta (pocos ítems), la prioridad del proyecto es funcionalidad sobre estética (RNF-05), y evita inflar el bundle y el árbol de dependencias en un mock.
- **Alternativa descartada:** `@dnd-kit/core` — mejor accesibilidad y animaciones, pero es una dependencia extra para un maestro simple; se puede introducir después si la UX lo pide. Se deja como Open Question.

### Decisión 5 — Estructura de carpetas `features/obras-sociales/`
Siguiendo `08_arquitectura_propuesta.md` (estructura por feature) y el ROADMAP: contrato + mock en `shared/` (reusable por Pacientes/Facturación), pantallas y hooks específicos en `features/obras-sociales/`. El mock del repository va en `shared/lib/mocks/` como pide el enunciado (FE-1 lo puso en `shared/lib/documentos/`; para OS se respeta la ubicación `mocks/` del roadmap).

### Decisión 6 — Inyección del repository por props/context, no import directo
Las pantallas reciben el `ObraSocialRepository` por parámetro (prop del componente raíz de la feature o un context de la feature), nunca importan el mock directamente. Así el swap a Supabase en FE-8 es un cambio de un solo punto de composición.

## Risks / Trade-offs

- **Divergencia de campos con el backend real (`C-04`)** → El nombre/tipo de campos de `ObraSocial` podría no calzar con la tabla real. Mitigación: los campos salen directo de `04_modelo_de_datos.md §ObraSocial`; coordinar nombres antes de cerrar la interfaz (nota final del ROADMAP). Como la UI habla con la interfaz, un ajuste queda contenido en el adaptador.
- **Preguntas abiertas Alta sin cerrar (checklists de otras OS, FIM, CUIL/CUIT, identificador de factura)** → Riesgo de hardcodear una suposición. Mitigación: todo se modela como dato configurable con el default documentado en la KB; OSECAC es el único checklist precargado, el resto nace vacío.
- **Drag-and-drop nativo con UX pobre en móvil** → HTML5 DnD es flojo en touch. Mitigación: lista corta + se ofrecen botones subir/bajar como fallback accesible; migrar a `dnd-kit` queda como opción futura (Open Question).
- **`localStorage` sin versionado de esquema** → si cambia la forma de `ObraSocial`, los datos viejos en localStorage podrían romper la deserialización. Mitigación: guardar una `schemaVersion` en el payload y, ante mismatch, re-sembrar desde el fixture (es solo un mock, no hay dato de producción que preservar).

## Migration Plan

No aplica migración de datos (frontend + mock, sin backend). Camino de reemplazo futuro (FE-8, cuando `C-04` backend se archive): escribir `SupabaseObraSocialRepository` que cumpla `ObraSocialRepository`, inyectarlo en el punto de composición de la feature en lugar del mock. Componentes, hooks y tipos no cambian.

## Open Questions

- ¿Se adopta `@dnd-kit` para el reorder o alcanza con DnD nativo + botones subir/bajar? (decisión de UX, no bloquea el contrato).
- Confirmar con el cliente los checklists de obras sociales distintas a OSECAC, el significado de "FIM", y si CUIL (titular) y CUIT (prestador) son definitivamente campos separados (RN-ID-01). Mientras tanto: configurable + default documentado.
- Coordinar con backend los nombres exactos de campos de `ObraSocial` antes de que `C-04` cierre, para minimizar el trabajo del adaptador.
