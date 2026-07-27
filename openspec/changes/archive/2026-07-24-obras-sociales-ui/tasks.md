## 1. Contrato de datos (tipos)

- [x] 1.1 Crear `frontend/src/shared/types/obraSocial.ts` con `TipoComprobante` (`'A' | 'B' | 'C'`), `ModalidadFacturacion` (`'por-prestacion' | 'general'`) y la interfaz `ObraSocial` (id, nombre, cuit, plazoCobroDias, tipoComprobante, modalidadFacturacion, admitePagosParciales, checklist, plantillaFactura). Sin `any`.
- [x] 1.2 Reutilizar `ChecklistItem` desde `shared/types/documento.ts` para el campo `checklist: ChecklistItem[]` (no crear un tipo paralelo).
- [x] 1.3 Definir `PlantillaCampo` (`{ id, etiqueta, origen, orden }`) y `PlantillaFactura` (`{ campos: PlantillaCampo[], identificadorOrigen }`), con `origen`/`identificadorOrigen` como unión de string literales (no `string` libre), habilitando el identificador de factura configurable (IN-01).
- [x] 1.4 Definir tipos de entrada `NuevaObraSocial` / `ActualizacionObraSocial` (payloads de create/update sin `id`).

## 2. Repository e implementación mock

- [x] 2.1 Crear `frontend/src/shared/lib/obrasSociales/ObraSocialRepository.ts` con la interfaz: `list()`, `getById(id)` (resuelve `null` si no existe), `create(data)`, `update(id, data)`.
- [x] 2.2 Crear `frontend/src/shared/lib/mocks/mockObraSocialRepository.ts` que cumpla la interfaz, persista en `localStorage` (con `schemaVersion`) y devuelva promesas con latencia simulada (helper `withLatency`, patrón de FE-1).
- [x] 2.3 Sembrar el fixture inicial de OSECAC con su checklist de RF-305 (RHC, prescripción, justificación, consentimiento, declaración de domicilio, mapa, presupuesto, CBU, habilitación, FIM) cuando no hay datos en localStorage; ninguna otra obra social con checklist predefinido.
- [x] 2.4 Manejar mismatch de `schemaVersion`: re-sembrar desde fixture en vez de romper la deserialización.

## 3. Hook de estado de la feature

- [x] 3.1 Crear un hook `useObrasSociales(repository)` que exponga `obrasSociales`, `loading`, `error`, `crear()`, `actualizar()` y recargue tras cada mutación (patrón de `useDocumentChecklist`).
- [x] 3.2 Definir el punto de composición/inyección del repository (context o prop del componente raíz de la feature) para que ninguna pantalla importe el mock directamente.

## 4. Pantalla CRUD

- [x] 4.1 Crear `frontend/src/features/obras-sociales/ObrasSocialesList.tsx`: listado con estados de carga/vacío/error, mostrando nombre, CUIT y tipo de comprobante (reusar primitivos del design-system).
- [x] 4.2 Crear el formulario de alta/edición (`ObraSocialForm.tsx`) con nombre, CUIT, plazo de cobro, tipo de comprobante A/B/C, modalidad de facturación y flag de pagos parciales.
- [x] 4.3 Validar campos requeridos (nombre y CUIT) en UI, bloqueando el guardado y señalando faltantes.
- [x] 4.4 Conectar create/update al hook y manejar el error del repository (mensaje visible, sin loading infinito).

## 5. Editor de checklist documental

- [x] 5.1 Crear `ChecklistEditor.tsx`: agregar, quitar y renombrar ítems, y alternar requerido/opcional, operando sobre `ChecklistItem[]` de la obra social.
- [x] 5.2 Implementar reorder por drag-and-drop nativo HTML5, con botones subir/bajar como fallback accesible.
- [x] 5.3 Persistir el orden y los cambios del checklist vía `update()`; obra social nueva (no OSECAC) arranca con checklist vacío.
- [x] 5.4 Reutilizar el renderer `DocumentChecklist` de FE-1 para previsualizar el checklist configurado, sin duplicar su modelo.

## 6. Editor de plantilla de factura

- [x] 6.1 Crear `PlantillaFacturaEditor.tsx`: agregar/quitar/reordenar campos dinámicos (`etiqueta`, `origen`, `orden`).
- [x] 6.2 Permitir configurar el `identificadorOrigen` (qué campo del paciente alimenta el identificador de factura), con default documentado y editable (IN-01).
- [x] 6.3 Persistir la plantilla por obra social vía `update()`; cada obra social conserva su propio conjunto de campos.

## 7. Integración y verificación

- [x] 7.1 Montar la feature de obras sociales en `App.tsx` (o el shell/routing existente) inyectando `mockObraSocialRepository`.
- [x] 7.2 Verificar `tsc --noEmit` sin errores y `oxlint` limpio (sin `any`, imports usados).
- [ ] 7.3 Verificar manualmente el flujo: crear obra social → configurar checklist con reorder → configurar plantilla → recargar y confirmar persistencia en localStorage; y que OSECAC aparece precargado en primer arranque. **NO realizado por el agente** (sin navegador disponible en este entorno) — pendiente de verificación manual por el usuario en `npm run dev`.
