# ROADMAP-FRONTEND — Secuencia de trabajo solo-frontend

> Complementa a [CHANGES.md](CHANGES.md) (que es el índice canónico, backend+frontend). Este archivo reordena el mismo alcance funcional para alguien que **solo toca `traslados-app/frontend/`** y quiere avanzar sin esperar a que exista base de datos real.
> No reemplaza a `CHANGES.md`: cuando el backend de un módulo esté listo (`C-0X` archivado), la tarea de integración de ese módulo (fase FE-8 acá) es la que cierra el círculo.

---

## La idea: contrato de datos primero, mock después, Supabase al final

Nada de lo que construyas acá debería tener que reescribirse cuando llegue el backend real. Para eso:

1. **Definí los tipos TypeScript ahora**, calcados de [knowledge-base/04_modelo_de_datos.md](knowledge-base/04_modelo_de_datos.md) (entidades: `Paciente`, `ObraSocial`, `Presupuesto`/`Autorizacion`, `Factura`, `Vehiculo`, `Conductor`, `HojaDeRuta`/`Recorrido`, etc.). Guardalos en `frontend/src/shared/types/`.
2. **Cada pantalla consume una interfaz (repositorio), nunca Supabase directamente.** Ej.: `PacienteRepository` con métodos `list()`, `getById()`, `create()`, `update()`. La pantalla no sabe si el dato viene de un mock o de Postgres.
3. **La implementación mock** vive en `frontend/src/shared/lib/mocks/` — fixtures en memoria (o `localStorage` para persistir entre reloads) que devuelven promesas con latencia simulada, para que la UI ya maneje loading/error states reales.
4. **Cuando el backend entregue el change correspondiente** (ver tabla de FASE 8 abajo), escribís la implementación real (`SupabasePacienteRepository`) que cumple la misma interfaz, y la inyectás — sin tocar componentes.

Esto también te blindea de los puntos que todavía están sin cerrar con el cliente (`knowledge-base/10_preguntas_abiertas.md`: CUIL/CUIT, identificador en factura, checklists de otras obras sociales) — el mock puede modelar ambas variantes y listo, el día que se confirme solo ajustás el tipo.

---

## FASE FE-0 — Setup y sistema de diseño ✅ completo

**Depende de**: nada. Arrancás hoy.

- ✅ Scaffold `frontend/` (Vite + React 19 + TypeScript strict), design system inicial (`frontend/src/design-system/`).
- ✅ Tailwind v4 como sistema de estilos real — **regla dura del proyecto** (ver `CLAUDE.md`/`AGENTS.md` §Reglas Duras): SIEMPRE clases utilitarias Tailwind, NUNCA `style={{}}` inline. Los valores de diseño viven en un bloque `@theme` en `frontend/src/index.css` (colores, spacing, tipografía, radios, sombras con nombres semánticos calcados de lo que antes era `tokens.ts`).
- ✅ Layout base: sidebar de navegación (colapsable en desktop, drawer off-canvas en mobile), routing con `react-router` v7 (`createBrowserRouter`), guard de rutas protegidas (`RequireAuth`) apuntando a un `useAuth()` **mockeado** (sesión falsa en memoria, sin roles). Implementado como change OPSX `app-shell-navegacion`, archivado en `openspec/changes/archive/2026-07-24-app-shell-navegacion/`.
- ✅ Capa de mocks: patrón establecido con `Repository` + implementación mock (`shared/lib/documentos/mockDocumentoRepository.ts` como referencia) — se repite en cada FE-N siguiente.
- ⏳ Pendiente (no bloqueante, sumar cuando se necesite): librería de componentes base genéricos `Table`, `FormField`, `Modal` — todavía no hicieron falta, cada FE-N los arma si los necesita.
- **Skills**: `react-best-practices`, `senior-frontend`, `frontend-ui-design`, `tailwind-design-system`, `ui-design-system`.

## FASE FE-1 — Componentes transversales reutilizables ✅ completo

**Depende de**: FE-0. **Corresponde a**: `C-03` (gestion-documental-core) del lado UI.

- ✅ Componente genérico de carga/consulta de documentos (`DocumentoRepository` + `mockDocumentoRepository`, upload mock con latencia simulada).
- ✅ Renderer de checklist configurable (`DocumentChecklist.tsx`, lista ordenada de ítems con estado subido/faltante) — se reusa en Obras Sociales, Pacientes, Vehículos, Conductores y Facturas.
- **Leer antes**: `knowledge-base/06_funcionalidades.md` §Épica 10.

## FASE FE-2 — Maestros independientes (2 ramas en paralelo) ✅ completo

**Depende de**: FE-0/FE-1. **Corresponde a**: `C-04` (obras-sociales) y `C-08` (vehículos) del lado UI. No dependen entre sí.

### Obras Sociales ✅ completo (falta verificación manual)
- CRUD (alta/edición/listado), editor de checklist con drag-and-drop/reorder + fallback de botones accesible, editor de plantilla de descripción de factura (campos dinámicos por obra social, `identificadorOrigen` configurable).
- Change OPSX `obras-sociales-ui` implementado y archivado (`openspec/changes/archive/2026-07-24-obras-sociales-ui/`), 23/24 tasks — 17 test files / 78 tests pasando, `tsc`/`oxlint` limpios. Pendiente solo la 7.3 (verificación manual en navegador con `npm run dev`), no bloqueante.
- **Leer antes**: `06_funcionalidades.md` §Épica 4, `05_reglas_de_negocio.md` §RN-FA-07/08.

### Vehículos y mantenimiento ✅ completo
- CRUD de vehículos, selector de accesorios de movilidad compatibles, toggle habilitado/fuera de servicio.
- Vista de mantenimiento: alertas visuales de próximo cambio de aceite (10.000 km / 2-3 meses) y vencimiento VTV/RTO — calculado client-side sobre el mock.
- Registro de gastos del vehículo (tabla evento: fecha + monto).
- Change OPSX `vehiculos-ui` implementado y archivado (`openspec/changes/archive/2026-07-24-vehiculos-ui/`), 24/24 tasks — 15 test files / 72 tests pasando, `tsc`/`oxlint` limpios, verificación manual en navegador confirmada por el usuario.
- **Leer antes**: `06_funcionalidades.md` §Épica 6, `05_reglas_de_negocio.md` §RN-VE-01 a 04.

## FASE FE-3 — Entidades dependientes (2 ramas en paralelo)

**Depende de**: FE-2 (a nivel de mock: necesitás listas de obras sociales/vehículos para los selects). **Corresponde a**: `C-05` (pacientes) y `C-09` (conductores).

### Pacientes y fichas clínicas
- Ficha completa: datos personales, CUD (con alerta de vencimiento), accesorio de movilidad, obra social asignada, identificador de afiliado **como campo adaptable** (mockealo con 2-3 formatos distintos para no atarte a una sola forma).
- Direcciones múltiples con ida/vuelta como registros **independientes** (no autocompletar la vuelta desde la ida — es una regla de negocio, no solo de datos, RN-HR-02).
- Personas a cargo, teléfono alternativo, flag de amparo judicial.
- Documentos del paciente usando el componente de FE-1, filtrados por el checklist de su obra social.
- **Leer antes**: `06_funcionalidades.md` §Épica 2, `05_reglas_de_negocio.md` §RN-ID-01/02, `10_preguntas_abiertas.md` (IN-01 — puede cambiar el campo identificador).

### Conductores ✅ completo (falta verificación manual)
- Alta de conductor (sin pantalla de login — no tienen cuenta), asignación semanal a vehículo (con validación de colisión), perfil/restricciones, documentación (licencia/DNI/apto médico).
- Change OPSX `conductores-ui` implementado y archivado (`openspec/changes/archive/2026-07-24-conductores-ui/`), 45/46 tasks — 13 test files / 63 tests nuevos pasando, `tsc`/`oxlint` limpios. Pendiente solo la 8.3 (verificación manual en navegador con `npm run dev`), no bloqueante.
- 4 cartelitos `⚠️ Pendiente de confirmar con el cliente` visibles en la UI (catálogo de restricciones, excepción de doble asignación semanal, datos mínimos del alta, documentos a precargar) — nota espejo en `CHANGES.md` dentro del scope de `C-09`.
- **Leer antes**: `06_funcionalidades.md` §Épica 7.

## FASE FE-4 — Presupuestos y autorizaciones ✅ completo

**Depende de**: FE-3. **Corresponde a**: `C-06`.

- Formulario de presupuesto anual por paciente/prestación, formulario de autorización con estados (pendiente/autorizada/judicializada/rechazada).
- Validación **en UI** (espejo de la regla de negocio, aunque el backend la vaya a re-validar): bloquear/alertar si `autorización > presupuesto` (RN-PA-01). Cupo de días/km por mes visible y editable.
- Soporte de carga retroactiva (fecha de vigencia distinta a fecha de carga).
- **Leer antes**: `06_funcionalidades.md` §Épica 3, `05_reglas_de_negocio.md` §RN-PA-01 a 03.
- Change OPSX `presupuestos-ui` implementado y archivado (`openspec/changes/archive/2026-07-24-presupuestos-ui/`), 32/32 tasks, 397 tests nuevos del frontend en verde, `tsc`/`oxlint` limpios. Verificación manual en navegador confirmada por el usuario.
- 2 cartelitos `⚠️ Pendiente de confirmar con el cliente/backend` visibles en la UI (`montoAutorizado` y `vigenciaDesde` — campos que el docx no tiene en Autorización pero el frontend necesita para validar RN-PA-01/02) — detalle en `CHANGES.md` dentro del scope de `C-06`.

## FASE FE-5 — Hojas de ruta y recorridos (la más pesada de UI) ✅ completo

**Depende de**: FE-3, FE-2 (vehículos), FE-3 (conductores). **Corresponde a**: `C-10`.

- Armado de hoja de ruta del día: agrupar pasajeros por vehículo/conductor respetando capacidad.
- Integración de mapa: podés prototipar ya mismo con la **Maps Demo Key** de la skill `google-maps-platform` (no requiere billing ni proyecto de Cloud) — sugerencia de orden por cercanía como lista editable, nunca ruta impuesta (RN-HR-01).
- Edición manual: agregar/quitar pasajero, reacomodo del resto, notas al pie, recorridos manuales sin turno fijo.
- Vista global del día (todos los recorridos juntos) para reasignar ante imprevistos.
- Validación en UI: bloquear asignar un paciente a un vehículo con accesorio incompatible (RN-VE-01) — el dato de compatibilidad ya lo tenés de FE-2/FE-3.
- Exportación/vista imprimible de la hoja de ruta.
- Change OPSX `hojas-de-ruta-ui` implementado y archivado (`openspec/changes/archive/2026-07-25-hojas-de-ruta-ui/`), 34/34 tasks.
- Cartelitos `AvisoModeloDatos` visibles en la UI (`RecorridoCard.tsx`, `HojaDeRutaPage.tsx`) por los agregados sobre el docx (`conductorId` en `Recorrido`, entidad `HojaDeRuta`, orden/coordenadas del mapa, franja horaria y notas) — detalle en `CHANGES.md` dentro del scope de `C-10`.
- **Leer antes**: `06_funcionalidades.md` §Épica 8, `05_reglas_de_negocio.md` §RN-HR-01 a 03, `07_flujos_principales.md` §Flujo 2.

## FASE FE-6 — Facturación, asistencias y cobros ✅ completo

**Depende de**: FE-2 (obras sociales, plantilla), FE-3 (pacientes), FE-4 (cupo autorizado). **Corresponde a**: `C-07`.

- Formulario de factura que arma la descripción según la plantilla dinámica de la obra social del paciente (de FE-2).
- Alerta en UI si días/km cargados superan el cupo autorizado (RN-FA-02) — mockeá el cupo desde FE-4.
- Exclusión visual de feriados en el selector de días facturables.
- Cálculo de fecha estimada de cobro (90 días default / 45 si amparo judicial — dejalo como constante configurable, no hardcodeada, porque son valores aún sin confirmar con el cliente).
- Estados del circuito (a facturar → facturado → cobrado → pagado parcialmente) y registro de cobros/pagos parciales.
- Change OPSX `facturacion-ui` implementado y **archivado** (`openspec/changes/archive/2026-07-27-facturacion-ui/`), 61/61 tasks — governance CRITICO, aprobado punto por punto por el usuario. Suite del frontend en verde (640 tests), `tsc`/lint limpios. Verificación manual en navegador confirmada por el usuario.
- Cartel `AvisoModeloDatos` agrupado (`FacturaAvisoDiscrepancias.tsx`, visible en `FacturaDetail`) con las 5 discrepancias de impacto backend — detalle en `CHANGES.md` dentro del scope de `C-07`. Coordinar con backend/cliente los puntos abiertos antes de cerrar el esquema.
- **Leer antes**: `06_funcionalidades.md` §Épica 5, `05_reglas_de_negocio.md` §RN-FA-01 a 08, `10_preguntas_abiertas.md` (varias preguntas Alta afectan esta pantalla).

## FASE FE-7 — Panel principal y reportes ✅ completo

**Depende de**: todo lo anterior (agrega datos de los demás módulos, mockeados). **Corresponde a**: `C-11`.

- Dashboard: recorridos del día en primer plano, tarjetas de resumen (facturas en mora, CUD por vencer, alertas de mantenimiento), diferencia facturado vs. cobrado por período configurable, resumen anual.
- Es la pantalla más fácil de mockear bien porque solo agrega datos que ya vas a tener de los módulos anteriores.
- Capa de agregación pura en `shared/lib/reportes/` (períodos, facturado vs. cobrado, resumen anual, facturas en mora, CUD por vencer, alertas de mantenimiento, resumen del día), sin duplicar reglas de negocio: reutiliza `estadoVencimientoFactura`/`estadoCud`/`estadoServicePreventivo`/`estadoHabilitacion` de sus módulos dueños. `CobroRepository` gana `list()` de forma aditiva (no rompe `facturacion-ui`).
- Change OPSX `dashboard-ui` implementado y **archivado** (`openspec/changes/archive/2026-07-26-dashboard-ui/`), 59/60 tasks — governance BAJO. Suite del frontend en verde, `tsc`/lint limpios. Verificación manual en navegador confirmada por el usuario.
- Cartel `AvisoModeloDatos` agrupado (`DashboardAvisoDiscrepancias.tsx`, visible al tope del Dashboard) con las 4 discrepancias de impacto backend — detalle en `CHANGES.md` dentro del scope de `C-11`. Coordinar con backend/cliente los puntos abiertos antes de cerrar el esquema de las vistas SQL / RPC.
- **Leer antes**: `06_funcionalidades.md` §Épica 9 (US-800), `04_modelo_de_datos.md` (referencias cruzadas Factura/Vehículo/Paciente/Recorrido).

---

## FASE FE-8 — Integración real (a medida que el backend entregue cada change)

No es una fase que arrancás vos sola/o de una — se va haciendo módulo por módulo, cuando la persona de backend cierra (archiva) el `C-0X` correspondiente:

| Backend archivado | Reemplazás el mock de... | Estado |
|---|---|---|
| `C-01` foundation-setup | Cliente Supabase real disponible (`shared/lib/supabaseClient.ts`) | ✅ Completado (2026-07-27) |
| `C-02` usuarios-permisos-auditoria | ✅ **Completado** (`auth-frontend-real`, 2026-07-29) — `useAuth()` mock → Supabase Auth real (sesión de 3 estados); guard de rutas con permisos reales (`tienePermiso`/`moduloDeRuta`/`requiereRolAdmin`); pantalla de gestión de cuentas y matriz de permisos; navegación del `AppShell` filtrada por permisos + cierre de sesión real. Además, el split "gateo de escritura por permiso" (5 changes: `gateo-obrasocial`, `gateo-pacientes`, `gateo-conductores`, `gateo-facturacion`, `gateo-hojas-de-ruta`, todos archivados el 2026-07-30) cableó `usePuedeEscribir()`/`<CamposSoloLectura>` en todos los módulos de dominio. El change `permisos-modulos-granulares` (en curso, 27/28 tareas) extiende el catálogo de 4 a 7 módulos — es el único change activo del repo hoy. | ✅ Auth/permisos real de punta a punta |
| `C-03` gestion-documental-core | Upload mock → buckets reales de Storage | 🔶 Swap parcial (`integracion-documentos`, 2026-08-07) — `SupabaseDocumentoRepository.ts` + `documentoMapping.ts` por TDD estricto, `PacientesRoute.tsx` ya cableado al repository real. Vehículos/Conductores/Facturación siguen con `mockDocumentoRepository` (esas entidades no tienen `entidadId` real todavía) — `AvisoModeloDatos` en las tres pantallas avisa que la subida sigue simulada. Suite completa sin regresiones, `tsc`/`oxlint` limpios. **No marcar ✅ hasta que Vehículos/Conductores/Facturación conecten** (`integracion-conductores-vehiculos`/`integracion-facturacion`) **y hasta la verificación manual de `tasks.md` §8**. |
| `C-04` obras-sociales-prestadores | `ObraSocialRepository` mock → Supabase | 🔶 En progreso (`integracion-obra-social`, 2026-07-31) — `SupabaseObraSocialRepository.ts` + `obraSocialMapping.ts` por TDD estricto, `ObraSocialesRoute.tsx` ya cableado al repository real (sección 5 hecha). Migraciones (`20260731120000`/`20260731120001`) redactadas y revisadas, **no aplicadas todavía** — `1B.6`/`1B.8` pendientes de Enzo/backend, ver `CHANGES.md` §C-04. Suite completa sin regresiones, `tsc`/`oxlint` limpios, cobertura ≥85% en `shared/lib/obrasSociales/`. Hallazgo relevante: el schema real ya tenía casi todas las columnas/tabla que se iban a agregar (nombres distintos de los planeados) y contradice la decisión D12 sobre dónde vive el formato del identificador de afiliado (RN-ID-02) — ver `knowledge-base/04_modelo_de_datos.md` §Discrepancias. **No marcar ✅ hasta que 1B.6/1B.8 se confirmen.** |
| `C-08` vehiculos-mantenimiento | `VehiculoRepository` mock → Supabase | 🔶 Swap real completo (`integracion-conductores-vehiculos`, commit `9ae79d6`, 2026-08-10) — `SupabaseVehiculoRepository.ts` + `vehiculoMapping.ts` por TDD estricto, `VehiculosRoute.tsx`/`HojaDeRutaRoute.tsx` cableados al repository real. Reconciliado contra el backend real de Enzo (gasto, kilometraje, patrón de acceso vía Edge Function); habilitaciones VTV/RTO derivadas del historial de mantenimiento (D3 opción B, revertido 2026-08-10 tras probar la tabla propia de Enzo sin pantalla para escribirla — ver `knowledge-base/04_modelo_de_datos.md` §Discrepancias); gap de mantenimientos cerrado el mismo día. Bug real encontrado y corregido el 2026-08-16 (doble conversión de `estado` ocultaba vehículos fuera de servicio). Gap que sigue abierto: `Vehiculo.notas` no viaja por la Edge Function. **Falta**: `integracion-conductores-vehiculos` §9/§10 (documentación y verificación manual) antes de archivar. |
| `C-05` pacientes-fichas-clinicas | `PacienteRepository` mock → Supabase | 🔶 Implementado (`integracion-pacientes`, 2026-07-30/31), pendiente de revisión manual — `SupabasePacienteRepository.ts` + `pacienteMapping.ts` por TDD estricto, migración `pacientes.crear_paciente_completo` **aplicada al proyecto real y verificada `SECURITY INVOKER`**, `PacientesRoute.tsx` ya cableado al repository real (sección 4 hecha). Suite completa 1385/1385 tests, `tsc`/`oxlint` limpios, cobertura ≥85%. **Falta** (a cargo de Enzo/backend, ver `CHANGES.md` §C-05): tareas `1.3`, `1B.4` y `7.5`-`7.8` de `openspec/changes/integracion-pacientes/tasks.md` antes de archivar. Límites de persistencia conocidos: 11 discrepancias contra el schema real, ninguna resuelta unilateralmente — ver `knowledge-base/04_modelo_de_datos.md` §Discrepancias, bloque "Pacientes vs. esquema real de `C-05`". |
| `C-09` conductores | `ConductorRepository` mock → Supabase | 🔶 Swap real completo (`integracion-conductores-vehiculos`, commit `ce2dd02`, 2026-08-11) — `SupabaseConductorRepository.ts` + `conductorMapping.ts`/`semanaIso.ts` por TDD estricto, `ConductoresRoute.tsx` cableado al repository real. Sin conflicto con lo que Enzo mergeó. Restricciones de perfil → texto libre en `observaciones` (D6-B, catálogo estructurado eliminado); colisión de asignación semanal bloqueada siempre vía constraint (`uq_conductor_semana`); semana ISO persistida como dos fechas (D7). Quedan abiertos, del lado cliente: campos obligatorios del alta y checklist de documentos — ver `CHANGES.md` §C-09. **Falta**: `integracion-conductores-vehiculos` §9/§10 antes de archivar. |
| `C-06` presupuestos-autorizaciones | `PresupuestoRepository`/`AutorizacionRepository` mock → Supabase | ✅ **Completado y archivado** (`integracion-presupuestos`, cerrado 2026-08-06, ahora en `openspec/changes/archive/2026-08-06-integracion-presupuestos/`) — `SupabasePresupuestoRepository.ts`/`SupabaseAutorizacionRepository.ts` + `presupuestoMapping.ts`/`autorizacionMapping.ts` por TDD estricto, `PresupuestosRoute.tsx` cableado a los cuatro repositories reales (los dos propios más `supabasePacienteRepository`/`supabaseObraSocialRepository` para los selectores del formulario, D8). Migración de 3 índices sobre FK aplicada por la usuaria/Enzo. Suite completa sin regresiones, `tsc`/`oxlint` limpios, cobertura ≥85% en `shared/lib/presupuestos/`. Verificación con 3 cuentas reales corrida el 2026-08-06 (`1B.4`/`7.6`). **Dos desviaciones deliberadas, no ocultas** (ver `CHANGES.md` §C-06 para el detalle completo): (1) la verificación de `7.5` se hizo por `curl` directo contra las Edge Functions con tokens reales, no clickeando el navegador — decisión explícita de la usuaria, no probó el comportamiento que vive solo en el componente React; (2) RN-GL-02 queda parcialmente cumplida — `usuario_id` llega `null` en `auditoria.logs` para las escrituras de este módulo (gap conocido y aceptado, decisor Enzo/backend, ver `knowledge-base/10_preguntas_abiertas.md`). |
| `C-10` hojas-de-ruta-recorridos | `HojaDeRutaRepository` mock → Supabase | 🔶 En progreso (`integracion-hojas-de-ruta`, 2026-08-04) — `SupabaseHojaDeRutaRepository.ts` + `hojaDeRutaMapping.ts` por TDD estricto, `HojaDeRutaRoute.tsx` cableado al repository real (swap parcial: `HojaDeRuta`/`Paciente` reales, `Vehículo`/`Conductor` siguen mock). Migraciones propuestas, **no aplicadas todavía** — a cargo de Enzo/backend, ver `CHANGES.md` §C-10. **No marcar ✅ hasta verificación manual.** |
| `C-07` facturacion-asistencias-cobros | `FacturaRepository`/`CobroRepository` mock → Supabase | 🔶 Swap real completo (`integracion-facturacion`, 2026-08-12) — `SupabaseFacturaRepository.ts`/`SupabaseCobroRepository.ts` + `facturaMapping.ts` por TDD estricto, migración `facturacion.facturas.fecha_factura` + dos funciones `SECURITY INVOKER` (`crear_factura_completa`/`actualizar_factura_completa`) + 6 índices sobre FK aplicadas por Enzo, `FacturacionRoute.tsx` ya cableado a los repositories reales (sección 5 de `tasks.md`, un solo archivo tocado). Suite completa sin regresiones nuevas propias de este change (2648 tests), `tsc -b`/`oxlint` limpios. Tres carteles `AvisoModeloDatos` reconciliados contra el schema real (`FacturaAvisoDiscrepancias.tsx`, `FacturaDocumentos.tsx`, `AlertaCupo.tsx`) — el de `AlertaCupo.tsx` avisa que el cupo sigue comparándose contra autorizaciones de **fixture** (D9 opción A, ver `CHANGES.md` §C-06 para el bloqueante de RLS heredado). **Falta**: verificación manual en navegador con las 3 cuentas (`tasks.md` §8) antes de archivar — **no marcar ✅ hasta esa verificación**.<br><br>🔶 **`facturacion-electronica-arca` (2026-08-28)** — "Emitir factura" pasa a obtener un CAE real de ARCA vía la Edge Function `facturar` + el miniserver `arca-miniserver`. Aplicado y verificado: campos fiscales en `Factura` + `facturaMapping`, cliente de emisión (`SupabaseEmisionRepository` + tabla D9 + mock), Edge Function completa (`deno check`/`deno test` limpios), enum `condicion_iva` (`CondicionIvaArca`), `FacturaResumen`/`FacturaImprimible` muestran el comprobante. **3 migraciones aplicadas a producción.** **Bloqueado**: el swap de `useEmisionFactura` (§5) y el flujo de rechazo dependen del deploy de la Edge Function (`supabase functions deploy` da 403 — cuenta sin rol Owner en la org). Branch `feat/facturacion-electronica-arca`. Decisiones de la usuaria: IVA 21 % por dentro, `obra_social.cuit` = CUIT de la OS (cierra #12), `condicion_iva` enum (cierra #14). |
| `C-11` panel-principal-reportes | Queries agregadas mock → vistas/RPC reales de Supabase | ⏳ Pendiente — `DashboardRoute.tsx` agrega datos de los 6+ repos mock de arriba, no hay vistas/RPC agregadas todavía |

Relevamiento verificado 2026-07-30: **hoy solo Auth/Cuentas tienen integración real**. El schema, RLS y Edge Functions del resto de los dominios ya existen del lado backend (10 migraciones aplicadas al repo), pero ningún otro `*Repository` real fue escrito todavía — cada composition root (`*Route.tsx`) sigue inyectando su mock, con el comentario "cuando exista `SupabaseXRepository`, este es el único archivo que cambia" ya dejado como guía.

Como cada pantalla habla con una interfaz y no con Supabase directamente, este reemplazo es mecánico: no tocás componentes ni lógica de UI, solo el adaptador de datos.

---

## Orden recomendado (resumen)

```
FE-0 (setup) → FE-1 (documental) → FE-2 (obras sociales + vehículos, en paralelo)
  → FE-3 (pacientes + conductores, en paralelo) → FE-4 (presupuestos)
  → FE-5 (hojas de ruta) → FE-6 (facturación) → FE-7 (dashboard)
  → FE-8 (integración real, continua, en paralelo a todo lo anterior a medida que backend entrega)
```

## Nota

Coordiná con quien lleve el backend los **nombres de campos y tipos** antes de cerrar cada `Repository` interface, sobre todo en Pacientes y Facturas — son los dos módulos con preguntas abiertas de prioridad Alta (`knowledge-base/10_preguntas_abiertas.md`) que pueden cambiar la forma del dato.
