# Traslados (Andrea Pastor) — Instrucciones para Agentes

> Este archivo (y su copia `CLAUDE.md`) es lo PRIMERO que todo agente lee al entrar al repo.
> Generado a partir de `knowledge-base/` y `CHANGES.md`. No editar a mano sin re-sincronizar ambos archivos.

---

## Stack Tecnológico

| Capa | Tecnología | Notas |
|------|------------|-------|
| Frontend | React + TypeScript | Responsive (RNF-08), prioriza funcionalidad sobre estética (RNF-05) |
| Backend | Supabase | Auth, base de datos y storage de archivos |
| Base de datos | PostgreSQL (vía Supabase) | Centralizada en la nube, con respaldo (RNF-02) |
| Integraciones | Google Maps/Geometry API, Google Drive, ARCA | Nivel de integración con ARCA aún a confirmar |
| Despliegue | Web, sin instalación del lado del cliente | RNF-01 |

Detalle completo: [knowledge-base/02_descripcion_general.md](knowledge-base/02_descripcion_general.md)

---

## Base de Conocimiento

La fuente de verdad del dominio vive en `knowledge-base/`. **Leé el archivo relevante ANTES de implementar.**

| Archivo | Cuándo leerlo |
|---------|---------------|
| [01_vision_y_objetivos.md](knowledge-base/01_vision_y_objetivos.md) | Entender propósito y alcance |
| [03_actores_y_roles.md](knowledge-base/03_actores_y_roles.md) | Auth, permisos flexibles por módulo (sin roles fijos) |
| [04_modelo_de_datos.md](knowledge-base/04_modelo_de_datos.md) | Entidades, ERD, migraciones |
| [05_reglas_de_negocio.md](knowledge-base/05_reglas_de_negocio.md) | Reglas codificadas (RN-XX) |
| [06_funcionalidades.md](knowledge-base/06_funcionalidades.md) | Historias de usuario por épica |
| [07_flujos_principales.md](knowledge-base/07_flujos_principales.md) | Flujos E2E (alta paciente, hoja de ruta, facturación, mantenimiento) |
| [08_arquitectura_propuesta.md](knowledge-base/08_arquitectura_propuesta.md) | Patrones, estructura, env vars, seguridad, **convenciones de UI del frontend** (grid de tarjetas, botones a la derecha, íconos sin emoji, edición diferida, `SectionBadge`/`ProgressBar`) — leer antes de tocar cualquier pantalla nueva o rediseñar una existente |
| [10_preguntas_abiertas.md](knowledge-base/10_preguntas_abiertas.md) | ⚠️ Inconsistencias a resolver ANTES de codear |
| [docs/core/Traslados-Modelo-Datos.docx](docs/core/Traslados-Modelo-Datos.docx) | Modelo real de la BD (entregado por MagneStudios) — estructura/campos/entidades de cada change |

> ⚠️ Resolver (o al menos revisar) las preguntas de prioridad **Alta** de `10_preguntas_abiertas.md` antes de arrancar C-04, C-05, C-06 o C-07 (identificación fiscal CUIL/CUIT, checklists de otras obras sociales, identificador en factura, integración ARCA, plazos por defecto). Donde no haya respuesta del cliente, implementar con el valor por defecto documentado en la KB y dejar el campo **configurable**, nunca hardcodeado.

---

## Skills Disponibles

| Agente | Rol | Skills que carga |
|--------|-----|------------------|
| **Backend Core** (dominio clínico-financiero: pacientes, presupuestos, facturación) | Modelo de datos, RLS, reglas de negocio críticas | `supabase`, `supabase-postgres-best-practices`, `database-schema-design`, `api-design`, `security-review`, `test-driven-development` |
| **Backend Aux** (obras sociales y prestadores) | Configuración de checklist/plantilla por obra social | `database-schema-design`, `api-design`, `test-driven-development` |
| **Flota y operación** (vehículos, conductores, hojas de ruta) | Compatibilidad de vehículos, geolocalización | `google-maps-platform`, `database-schema-design`, `performance-optimization` |
| **Frontend** (todos los módulos, UI) | Componentes, formularios, dashboard | `react-best-practices`, `senior-frontend`, `frontend-ui-design`, `tailwind-design-system`, `ui-design-system` |
| **Documental / Reportes** | Carga de archivos, exportación de facturas/reportes | `google-drive`, `pdf-processing`, `xlsx-processing` |
| **QA / Testing** | Cobertura, pruebas E2E | `testing-strategy`, `test-driven-development`, `webapp-testing`, `playwright-cli` |
| **Infra** | Despliegue, CI/CD | `deployment` |
| **Orquestación** | OPSX / SDD | `openspec-propose`, `openspec-apply-change`, `openspec-archive-change`, `openspec-explore` |

Cargá la skill correspondiente al contexto ANTES de escribir código.

> Los compact rules de cada skill los resuelve el orquestador desde `.atl/skill-registry.md` (generado por `skill-registry`; no versionado — no está en el repo). Esta tabla solo mapea skill→rol.

---

## Roadmap de Changes

El plan de implementación completo está en [CHANGES.md](CHANGES.md). Resumen:

- **Total**: 11 changes en 6 fases (foundation-setup, usuarios-permisos-auditoria, gestion-documental-core, obras-sociales-prestadores, vehiculos-mantenimiento, pacientes-fichas-clinicas, conductores, presupuestos-autorizaciones, hojas-de-ruta-recorridos, facturacion-asistencias-cobros, panel-principal-reportes).
- **Camino crítico** (6): `C-01 → C-02 → C-04 → C-05 → C-06 → C-07`.
- **Primer change**: `C-01` (foundation-setup).

**Antes de cualquier `/opsx:propose`**: leé [CHANGES.md](CHANGES.md), identificá las dependencias del change y los archivos de "Leer antes".

---

## Reglas Duras (específicas del proyecto)

> Reglas **globales** ya definidas en `~/.claude/CLAUDE.md` (orquestador OPSX, governance por dominio, Strict TDD, protocolo de engram): el proyecto las **hereda**, no se repiten acá.

Confirmadas con el usuario para este proyecto (stack React + TypeScript + Supabase, dominio con datos de salud y de menores de edad):

- **NUNCA** usar `any` en TypeScript → tipar estricto (`tsconfig` en modo `strict`); si un tipo es genuinamente desconocido, modelarlo como `unknown` y angostarlo.
- **SIEMPRE** usar clases utilitarias de Tailwind CSS v4 para estilar componentes React → **NUNCA** `style={{}}` inline. Los valores de diseño (color, spacing, tipografía, radios) viven en un bloque `@theme` de `frontend/src/index.css`, no como objeto JS consumido por inline styles.
- **SIEMPRE** revisar `frontend/src/design-system/components.tsx` (catálogo vivo en `DesignSystem.tsx`) antes de escribir markup nuevo en cualquier pantalla → reusar los componentes existentes (`Button`, `Chip`, `Section`, `Input`, `Alert`, `Card`, `Table`, etc.) en vez de reimplementar estilos Tailwind a mano. Aplica a toda persona o agente que toque el frontend, no solo a quien mantiene el design system.
- **NUNCA** dejar una tabla con datos sensibles (pacientes, CUD, documentación, facturación) sin Row Level Security → toda tabla nueva en Supabase debe definir sus policies de RLS en el mismo cambio que la crea.
- **NUNCA** usar la `SUPABASE_SERVICE_ROLE_KEY` desde código de frontend → esa clave solo se usa en backend/Edge Functions; el cliente de frontend siempre usa la `anon key` protegida por RLS.
- **SIEMPRE** verificar tipos con `npx tsc -b --noEmit` (dentro de `frontend/`) → **NUNCA** `npx tsc --noEmit` a secas. El `tsconfig.json` raíz del frontend es de "project references" (`{"files": [], "references": [...]}`); `tsc --noEmit` sin `-b` sobre ese archivo compila **cero archivos** y siempre reporta 0 errores sin importar qué tan roto esté el código (confirmado empíricamente: una propiedad inventada en un objeto tipado no generaba ningún error). `tsc -b --noEmit` es literalmente lo que corre `npm run build` (menos el `vite build`), y es el único chequeo real.
- **Conventional Commits** para todos los mensajes de commit (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, etc.).
- **SIEMPRE** construir cada change siguiendo dos fuentes con roles distintos, nunca una sola: la **estructura** (tipos, campos, entidades, relaciones) sale de `docs/core/Traslados-Modelo-Datos.docx` (modelo real de la BD, entregado por MagneStudios); las **reglas de negocio** (validaciones, defaults, qué pasa si tal cosa) salen de `knowledge-base/` (RN-XX). El docx manda en estructura, la KB manda en reglas de negocio.
- **SIEMPRE** documentar cualquier discrepancia entre el docx y la KB (o una regla de negocio de la KB sin campo/tabla correspondiente en el docx) en los dos lugares a la vez, nunca resolverla adivinando:
  1. **Documentación**: nota en `knowledge-base/04_modelo_de_datos.md` §Discrepancias y bullet `⚠️ Discrepancia con Traslados-Modelo-Datos.docx` en el change correspondiente de `CHANGES.md`.
  2. **UI**: cartel visible con el componente `AvisoModeloDatos` (`frontend/src/design-system/components.tsx`) en la pantalla donde aplica, para que quien vea la app (incluido backend) la note sin tener que leer la KB.
  Dejar la discrepancia marcada para confirmar con el cliente o con quien mantiene el docx — no resolverla unilateralmente en el código.

---

## Flujo de Trabajo

```
1. Leer la KB relevante (knowledge-base/)        → entender el dominio
2. Identificar el change en CHANGES.md           → respetar dependencias
3. /opsx:propose C-NN-nombre                     → proposal + design + specs + tasks
4. Implementar las tasks (cargando skills)       → respetando las reglas duras
5. /opsx:archive C-NN-nombre + marcar [x]        → cerrar el change
```

Aplicar TODAS las reglas duras en cada paso. Ante conflicto entre la KB y este archivo, las reglas duras prevalecen.
