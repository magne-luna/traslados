# Traslados (Andrea Pastor)

## Idea
Sistema de gestión integral para un servicio de traslado personalizado de personas con discapacidad (cliente Andrea Pastor, vía Magne Studios). Reemplaza el proceso manual actual (planillas) para gestión de pacientes, obras sociales, vehículos/flota, conductores, hojas de ruta, presupuestos/autorizaciones y facturación/cobros.

## Objetivo
Sistema web (RNF-01, sin instalación cliente) que centralice pacientes, obras sociales, flota, hojas de ruta y facturación, priorizando funcionalidad sobre estética (RNF-05) y con manejo cuidadoso de datos sensibles de salud y de menores de edad (RNF-04).

## Stack Tecnológico
- **Frontend**: React 19 + TypeScript strict + Vite, Tailwind CSS v4 (SIEMPRE utility classes vía `@theme`, NUNCA `style={{}}` inline — regla dura), `react-router` v7.
- **Backend**: Supabase (Auth + PostgreSQL + Storage), RLS por módulo (permisos flexibles por cuenta, no roles fijos).
- **Integraciones**: Google Maps/Geometry API, Google Drive, ARCA (nivel de integración a confirmar).
- **Orquestación**: OPSX (openspec CLI) — `openspec/` vive en `traslados-app/`. Strict TDD activo (RED-GREEN-TRIANGULATE-REFACTOR) en toda implementación.
- **Rol del usuario**: frontend-only — no toca backend/DB. Prefiere hacer el testeo visual manual ella misma (no scripts de Playwright/headless).

## Estado Actual
- **2026-07-24**: FE-0, FE-1 y FE-2 completos y archivados.
  - FE-0: scaffold + design system Tailwind v4 + AppShell/routing/guard (`app-shell-navegacion`).
  - FE-1: `DocumentChecklist` reutilizable (documentos/checklist genérico).
  - FE-2: **Obras Sociales** (`obras-sociales-ui`) y **Vehículos y mantenimiento** (`vehiculos-ui`) — ambos CRUD completos, mock en localStorage, TDD estricto, archivados en `openspec/changes/archive/`.
  - `CHANGES.md` y `ROADMAP-FRONTEND.md` actualizados reflejando FE-2 ✅ completo.
- **2026-07-24 (misma noche)**: FASE FE-3 en curso.
  - `pacientes-ui` (C-05): proposal+design+specs+tasks completos y `apply` hecho (TDD estricto) — falta SOLO la 10.3 (verificación manual en navegador, la estaba haciendo el usuario cuando terminó la sesión) antes de `/opsx:archive pacientes-ui`.
  - `conductores-ui` (C-09): apareció ya propuesto y aplicado (46/46 tasks) por fuera de esta sesión de trabajo — hay más de una sesión de Claude Code corriendo en paralelo sobre este mismo repo. Sin archivar todavía.
  - Se detectó también actividad concurrente de un change `presupuestos-ui` (FE-4) corriendo en paralelo, por otro proceso — no gestionado desde esta sesión, solo detectado de refilón por un sub-agente.
  - Durante la verificación manual de `pacientes-ui`, el usuario encontró (vía los carteles `AvisoModeloDatos` ya presentes en la UI) discrepancias entre el modelo implementado y `docs/core/Traslados-Modelo-Datos.docx`. Se resolvieron 5: segundo nombre, segundo apellido, condición (separada de diagnóstico), teléfono/teléfono alternativo en Personas a Cargo, y accesorio de movilidad múltiple (antes `AccesorioMovilidad | null`, ahora `AccesorioMovilidad[]`). Quedan deliberadamente sin resolver (documentadas en KB + `CHANGES.md` + cartel en UI): historial de coberturas de obra social (`numeroAfiliado` como valor único vs. entidad histórica — depende de IN-01, sin confirmar con el cliente) y separar Direcciones de Recorridos (pertenece conceptualmente a FE-5, no a Pacientes).
- **Próximo**: usuario termina de verificar `pacientes-ui` en el navegador (recargar para que el mock re-siembre con el nuevo schema) → `/opsx:archive pacientes-ui`. Después: `conductores-ui` (ver si ya se puede archivar directamente o si también quiere pasar por la misma revisión vs. el docx) y seguir con Presupuestos/Autorizaciones (FE-4) o coordinar con la otra sesión para no pisarse.

## Decisiones Importantes
- **Convención de UI listado+detalle** (2026-07-24, aplicada a Vehículos y Obras Sociales, obligatoria para módulos futuros): fila de listado 100% clickeable (onClick en el `<li>`, botón "Editar" con `stopPropagation`); detalle de entidad existente muestra resumen de solo lectura + botón "Editar datos" que revela el form inline (nunca modal, nunca mezclado); vuelve al resumen al guardar/cancelar. Documentado en `knowledge-base/08_arquitectura_propuesta.md`.
- **Tailwind únicamente, nunca inline styles** — regla dura repetida por el usuario, ya reflejada en `CLAUDE.md` del proyecto.
- El proyecto real (código + openspec) vive en `traslados-app/`, no en la raíz del repo `Traslados/` (esa raíz solo tiene KB/roadmap de planificación en algunos casos históricos, pero el operativo es `traslados-app/`).
- Delegar siempre apply/archive de OPSX a sub-agentes (sonnet para apply, haiku para archive) seteando Strict TDD explícito en el prompt.
- **Regla dura nueva (2026-07-24, en `CLAUDE.md`/`AGENTS.md`)**: cada change se construye con dos fuentes de roles distintos — la **estructura** (tipos/campos/entidades/relaciones) sale de `docs/core/Traslados-Modelo-Datos.docx` (modelo real entregado por MagneStudios); las **reglas de negocio** salen de `knowledge-base/` (RN-XX). El docx manda en estructura, la KB manda en reglas de negocio. Ante discrepancia entre ambos (o entre el docx y una RN sin campo correspondiente): documentar en los dos lugares (`knowledge-base/04_modelo_de_datos.md` §Discrepancias + bullet `⚠️ Discrepancia con Traslados-Modelo-Datos.docx` en `CHANGES.md`) Y mostrar un cartel `AvisoModeloDatos` (componente en `design-system/components.tsx`) en la pantalla afectada — nunca resolver adivinando, dejarlo marcado para confirmar con el cliente/Enzo (backend).
- Frente a una lista larga de discrepancias, priorizar por costo de espera, no por tamaño: lo chico y sin ambigüedad se implementa ya; lo que depende de una pregunta abierta sin responder (ej. IN-01) o que pertenece conceptualmente a una fase futura (ej. Recorridos es de FE-5, no de Pacientes) se deja documentado nomás — implementarlo a ciegas ahora arriesga rehacerlo entero después.

## Notas del Agente
- **Gotcha de archive**: un sub-agent de archive (haiku) dejó el archive de `vehiculos-ui` a medias (solo movió `.openspec.yaml`, no el resto). Antes de dar un archive por cerrado, verificar con `openspec list --json` que el change ya no aparece activo — no confiar solo en el reporte del sub-agent.
- Al delegar apply, conviene mirar el CRUD ya implementado (`obras-sociales-ui`) como referencia de patrones (repository mock + hook + context + componentes) para que el sub-agent no reinvente la rueda.
- Cuando el usuario pide "que quede como convención" o "por escrito", el lugar correcto es `knowledge-base/08_arquitectura_propuesta.md` (patrones transversales), no un archivo nuevo.
- **Gotcha crítico de mocks — SIEMPRE bumpear `SCHEMA_VERSION`**: cada `mock*Repository.ts` (`frontend/src/shared/lib/mocks/`) persiste en `localStorage` con un `SCHEMA_VERSION` que, si no coincide con el guardado, dispara re-siembra automática desde el fixture. Un sub-agente cambió la forma de un campo persistido (`Paciente.accesorioMovilidad` de `AccesorioMovilidad | null` a `AccesorioMovilidad[]`) sin bumpear la constante → el `localStorage` viejo del usuario quedó con la forma vieja, y `paciente.accesorioMovilidad.map is not a function` explotó en el navegador en vivo. Fix: bumpear `SCHEMA_VERSION` (ya tenía test cubriendo el mismatch, no hizo falta ciclo TDD nuevo). Regla para el futuro: cualquier cambio de forma en un tipo persistido por un mock repository DEBE incluir el bump de versión como parte del mismo task — agregarlo explícito en el prompt del sub-agente, no asumir que lo va a recordar solo.
- Hay más de una sesión de Claude Code trabajando en este mismo repo en paralelo (se vieron `conductores-ui` y `presupuestos-ui` avanzar sin que esta sesión los tocara). Antes de asumir qué changes existen o su estado, correr `openspec list --json` — no confiar en lo que se recuerda de sesiones anteriores.
