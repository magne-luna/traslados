# Tasks — facturacion-listado-comprobantes

> **Solo frontend, solo lectura, aditivo.** Facturación es dominio de governance crítica: este
> change no toca emisión, tipos, backend, migraciones ni reglas de negocio — solo agrega una
> pantalla que lista datos ya existentes. La usuaria (Enzo) lo pidió explícitamente el 2026-08-31.
>
> **⚠️ STRICT TDD.** RED → GREEN → TRIANGULATE → REFACTOR.
> Test runner: `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run`
> Type-check: `cd frontend && npx tsc -b --noEmit`
>
> **Reglas duras** (`CLAUDE.md`): nunca `any`; nunca `style={{}}` (Tailwind v4); reusar
> `design-system/` (`Table`/`Th`/`Td`/`Tr`, `EmptyState`, `Button`, `Chip`, `Alert`,
> `VolverAlListadoLink`); Conventional Commits.

## 1. `ComprobantesEmitidosList.tsx` (nuevo, presentacional puro)

- [x] 1.1 (RED) test: con facturas mixtas, solo lista las que tienen `cae`; cada fila muestra
      número de comprobante (`{tipo} 0001-00000007`), CAE y período.
- [x] 1.2 (RED) test: sin ninguna factura con `cae` → `EmptyState`, sin `<table>`.
- [x] 1.3 (RED) test: `arcaAmbiente === 'homologacion'` → la fila marca "prueba / sin valor fiscal".
- [x] 1.4 (RED) test: fila con `comprobantePdfUrl` → botón "Ver PDF" llama `onVerComprobante(factura)`;
      fila sin `comprobantePdfUrl` → sin botón.
- [x] 1.5 (RED) test: `error` prop no nulo → `Alert` visible y la tabla sigue renderizada.
- [x] 1.6 (RED) test: click en la fila → `onSelect(factura)`.
- [x] 1.7 (GREEN) implementar el componente hasta verde.
- [x] 1.8 (REFACTOR) revisar contra `FacturasList.tsx` / `FacturaResumen.tsx` (formato de número,
      chip de ambiente), mantener bajo ~150 líneas.

## 2. `FacturacionPage.tsx` — view nueva

- [x] 2.1 (RED) test: botón "Comprobantes emitidos" del listado navega a la pantalla nueva y
      muestra ahí las facturas emitidas del repo.
- [x] 2.2 (RED) test: "Ver PDF" en esa pantalla llama `emisionRepository.verComprobante` con la
      clave y abre la URL; si rechaza, se ve el error.
- [x] 2.3 (GREEN) `View` gana `{ kind: 'comprobantes' }`; handler `verComprobante` + estado de
      error local; branch de render.
- [x] 2.4 (REFACTOR) el handler es el mismo patrón que `FacturaDetail.verComprobante` — no
      duplicar lógica de más de la necesaria.

## 3. `FacturasList.tsx` — botón de navegación

- [x] 3.1 (RED) test: con `onVerComprobantes` definido, la cabecera muestra "Comprobantes emitidos"
      y al clickearlo lo invoca; sin la prop, el botón no aparece.
- [x] 3.2 (GREEN) prop opcional + botón `variant="secondary"` (sin `requiereEscritura`).

## 4. Verificación final

- [x] 4.1 `npx tsc -b --noEmit` limpio.
- [x] 4.2 `npx vitest run src/features/facturacion` verde.
- [x] 4.3 Sincronizar `openspec/specs/factura-comprobante-pdf/spec.md` con los requisitos ADDED.
- [ ] 4.4 Commit `feat(facturacion): apartado para ver los comprobantes emitidos y su PDF` (pendiente — lo hace Enzo).
