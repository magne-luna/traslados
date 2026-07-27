## Why

Las obras sociales (entidades pagadoras) son un maestro del que dependen Pacientes (FE-3), Presupuestos (FE-4) y sobre todo Facturación (FE-6): cada factura arma su descripción y su checklist documental según lo que exige la obra social del paciente. Sin este maestro configurable no se puede avanzar con las entidades dependientes. Este change entrega la fase **FE-2 (rama Obras Sociales)** del `ROADMAP-FRONTEND.md` — el lado UI de `C-04 obras-sociales-prestadores` — construida como **frontend + mock**, siguiendo el contrato "tipos primero, mock después, Supabase al final" para no reescribir nada cuando el backend real (`C-04`) se archive.

## What Changes

- Se definen los **tipos TypeScript** de `ObraSocial` en `frontend/src/shared/types/`: nombre, CUIT del prestador (distinto del CUIL del paciente, RN-ID-01), plazo de cobro configurable, tipo de comprobante A/B/C (RN-FA-07), modalidad de facturación (por prestación vs. general), flag de pagos parciales/por lote, checklist documental configurable (RN-FA-08) y plantilla de descripción de factura.
- Se define la interfaz **`ObraSocialRepository`** (`list`, `getById`, `create`, `update`) — la UI nunca habla con Supabase directamente.
- Se agrega una **implementación mock** de `ObraSocialRepository` en `frontend/src/shared/lib/mocks/` con fixtures persistidos en `localStorage` y latencia simulada, para ejercitar loading/error states reales.
- Se construye la **pantalla CRUD** de obras sociales (alta / edición / listado).
- Se construye el **editor de checklist documental por obra social** con reorder (drag-and-drop), reutilizando el tipo `ChecklistItem` y el renderer de FE-1.
- Se construye el **editor de plantilla de descripción de factura** con campos dinámicos configurables por obra social.
- Solo el checklist de **OSECAC** se precarga como fixture (RF-305); el resto de obras sociales nace con checklist vacío/editable — NO se asume un checklist genérico único.
- **Fuera de alcance (NO se toca):** cliente Supabase real, migraciones SQL, RLS. Eso corresponde al change backend `C-04` real, en otra sesión.

## Capabilities

### New Capabilities
- `obra-social-contract`: contrato de datos del maestro Obras Sociales — tipos TypeScript de `ObraSocial` y sus sub-estructuras (checklist, plantilla de factura, condiciones por prestador), interfaz `ObraSocialRepository` e implementación mock con persistencia en `localStorage` y latencia simulada.
- `obra-social-crud`: pantalla de alta / edición / listado de obras sociales, con estados de carga y error contra el repository.
- `obra-social-checklist-editor`: editor del checklist de documentación por obra social, con agregar/quitar/renombrar ítems, marcar requerido/opcional y reordenar (drag-and-drop); OSECAC precargado, resto vacío.
- `obra-social-factura-template`: editor de la plantilla de descripción de factura por obra social, con campos dinámicos configurables (etiqueta, origen del dato, orden).

### Modified Capabilities
<!-- Ninguna: no existen specs previas en openspec/specs/. Es el primer maestro que se especifica. -->

## Impact

- **Código nuevo (frontend):**
  - `frontend/src/shared/types/obraSocial.ts` (tipos del dominio).
  - `frontend/src/shared/lib/obrasSociales/ObraSocialRepository.ts` (interfaz).
  - `frontend/src/shared/lib/mocks/mockObraSocialRepository.ts` (mock localStorage).
  - `frontend/src/features/obras-sociales/*` (pantallas CRUD, editor de checklist, editor de plantilla, hooks).
- **Reutiliza:** `ChecklistItem` (`frontend/src/shared/types/documento.ts`), primitivos del design-system (`Section`, `Chip`, `Button`), patrón repository+mock+hook establecido en FE-1 (`DocumentoRepository`).
- **Habilita (aguas abajo):** FE-3 Pacientes (select de obra social + identificador de afiliado adaptable), FE-4 Presupuestos, FE-6 Facturación (plantilla + checklist por obra social).
- **Sin impacto backend:** no crea tablas, RLS ni cliente Supabase. Cuando `C-04` backend se archive, se escribe `SupabaseObraSocialRepository` cumpliendo la misma interfaz y se inyecta sin tocar componentes (FE-8).
- **Preguntas abiertas de prioridad Alta que quedan mockeadas y configurables** (no bloquean, ver `10_preguntas_abiertas.md`): checklists de obras sociales distintas a OSECAC, significado de "FIM", y CUIL vs. CUIT como campos separados. Se implementa con el default documentado y campo configurable, nunca hardcodeado.
