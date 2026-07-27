# Arquitectura Propuesta

## Patrones aplicados

| Patrón | Dónde se usa | Por qué |
|---|---|---|
| SPA (Single Page Application) | Frontend React + TypeScript | RNF-01 (acceso vía navegador, sin instalación) y RNF-08 (responsive/mobile) |
| BaaS (Backend as a Service) | Supabase (auth + Postgres + storage) | Evita mantener infraestructura propia; el cliente no tiene servidor propio (alcance del proyecto) |
| RBAC flexible por módulo (no por rol fijo) | Gestión de usuarios y permisos | RN-GL-01: cada cuenta recibe acceso individual configurado por la administradora |
| Auditoría por evento (audit log) | Transversal a todos los módulos | RF-003, RN-GL-02: trazabilidad de quién hizo qué y cuándo |
| Configuración por entidad (checklist y plantilla por obra social) | Módulo Obras sociales | RN-FA-08: cada obra social tiene su propio checklist y formato de factura, no hay una lista única |

## Convenciones de UI (frontend)

Establecidas durante el rediseño visual de `obras-sociales-ui`, `vehiculos-ui` y `pacientes-ui` (2026-07-26), a partir de mockups del usuario e iteración directa. **Obligatorias para toda pantalla nueva o retocada** del frontend — no son solo para esos tres módulos, aplican también a conductores, presupuestos, facturación y hojas-de-ruta la próxima vez que se toquen.

### Listado: grid de tarjetas, no filas angostas

Patrón de listado establecido a partir de `vehiculos-ui` y `obras-sociales-ui` (FE-2), superando el listado de filas simples original:

- **Grid de tarjetas** (`grid grid-cols-1 md:grid-cols-2` o `md:grid-cols-3` según cuánta info tenga cada tarjeta — a criterio, no hay una regla fija de cuántas columnas), no una lista de filas de una sola línea. Cada tarjeta muestra **toda la info relevante de entrada** (stats con label chico arriba/valor abajo, chips de estado, chips de sub-listas como accesorios o checklist con truncado "+N más" a partir de un umbral), para no obligar a abrir el detalle solo para consultar un dato.
- **Buscador local** arriba del grid (`input type="search"`, estado local del componente, filtra por los campos más buscados — nombre/patente/DNI), cuando la lista puede crecer.
- **Tarjeta clickeable por completo**: el `onClick` va en el `<div>` de la tarjeta entera (no solo en un botón), con estilo hover (`hover:bg-surface-soft hover:border-border-strong`). El botón "Editar" explícito se mantiene por accesibilidad de teclado, con `event.stopPropagation()` en su `onClick`. Footer de la tarjeta con "Ver detalle" (link) + "Editar" (botón), ambos alineados a la derecha (`justify-end`) — ver "Botones de acción" más abajo.
- Referencia: `frontend/src/features/obras-sociales/ObrasSocialesList.tsx`, `frontend/src/features/vehiculos/VehiculosList.tsx`, `frontend/src/features/pacientes/PacientesList.tsx`.

### Detalle: resumen de solo lectura por defecto, nunca el form mezclado con el resto

- Al entrar al detalle de una entidad existente, se muestra un **resumen de solo lectura completo** de los datos generales (grid de stats con TODOS los campos editables del form, no solo 3 o 4 — mismo criterio de "toda la info visible" que en el listado) junto con las secciones relacionadas (mantenimiento, gastos, documentos, checklist, plantilla, etc.), y un botón **"Editar datos"** (alineado a la derecha del resumen) que revela el formulario general inline, en la misma pantalla — nunca como modal ni como pantalla separada.
- **Alta (entidad nueva)**: no hay resumen posible todavía, el formulario se muestra directo.
- **Al guardar con éxito** en modo edición, se vuelve automáticamente al resumen de solo lectura. Cancelar la edición también vuelve al resumen (no al listado).
- Referencia: `VehiculoDetail.tsx`, `ObraSocialDetail.tsx`, `PacienteResumen.tsx`/`PacienteDetail.tsx`.

### Secciones de datos sensibles/secundarios dentro del detalle: mismo criterio "solo lectura + Editar"

Para sub-secciones embebidas en el detalle (no la entidad principal, sino listas/registros anidados — CUD, personas a cargo, checklist documental, plantilla de factura): **nunca inputs editables inline por default**. Se muestran de solo lectura (chips/texto plano, nunca con estilo de input — ver más abajo) con un botón **"Editar"** puntual que revela el form para ESE registro. Motivo: pedido explícito del usuario tras ver que los datos ya cargados "parecían campos editables" cuando no correspondía tocarlos ahí.

- Si el registro es único (ej. CUD de un paciente): "Editar" revela el mismo form en el lugar, con "Cancelar"/"Guardar".
- Si es una lista (ej. personas a cargo, direcciones): cada fila tiene su "Editar" (si aplica) y "Quitar" (ícono de tacho) propios; el form de alta/edición vive debajo de la lista, siempre visible.
- Direcciones de paciente es la excepción sin "Editar" por fila (solo alta/baja) — el usuario no lo pidió para ese caso puntual; no asumir que todas las listas necesitan edición in-place sin preguntar.
- Referencia: `CudFields.tsx`, `PersonasACargoEditor.tsx`, `DireccionesEditor.tsx` (pacientes-ui); `ChecklistEditor.tsx`, `PlantillaFacturaEditor.tsx` (obras-sociales-ui).

### Formularios: grid de 2 columnas, botones a la derecha

- Todo formulario de datos generales pasa a `grid grid-cols-1 md:grid-cols-2 gap-md`. Campos largos (textarea, aclaraciones) usan `md:col-span-2` para no forzarlos a media columna. Checkboxes que acompañan a un select en la misma fila se alinean con `self-end pb-2`.
- **Botones de acción SIEMPRE alineados a la derecha** (`flex justify-end gap-sm`), orden **Cancelar → Guardar** (Cancelar primero/izquierda, Guardar al final/derecha, pegado al borde). Aplica a cualquier fila de acción "suelta" al final de un form o card (Guardar/Cancelar, Editar, Ver más, Eliminar).
  - Excepción: botones que son un control compuesto pegado a su propio input (ej. "+ Agregar" al lado de un campo "Nuevo ítem") — esos se quedan pegados al input, no se separan a la derecha del contenedor.
  - Excepción: acciones primarias de página en el header (ej. "+ Nuevo paciente" arriba a la derecha del título) — ya van a la derecha por el patrón `justify-between` título/acción, no por esta regla.
- Un `<div className="flex flex-col gap-md">` como contenedor padre estira a sus hijos al ancho completo por default (`align-items: stretch`) — cualquier botón/elemento que no deba ocupar todo el ancho necesita su propio wrapper `<div>` (ver ej. el fix del botón "Volver al listado" en los tres `*Detail.tsx`).

### Nunca emojis como ícono — siempre SVG vía `InlineIcon`

Regla dura de UI: ningún emoji (✅⛔⚠️📄 etc.) como ícono en pantalla. Siempre trazo SVG que herede color por `currentColor`.

- `InlineIcon` (`design-system/components.tsx`): ícono chico para uso inline en texto/filas/badges, 14px por default. `NavIcon` (ya existía) sigue siendo para navegación, 18px.
- `design-system/icons.tsx`: set de paths reutilizables ya armados — agregar ahí cualquier ícono nuevo en vez de escribir SVG suelto en el componente. Antes de crear uno nuevo, revisar si ya existe algo parecido (documento, reloj, calendario, credencial, casa, escuela, ubicación/pin, llave inglesa, moneda, velocímetro, flechas, tacho, ojo, arrastrar/reordenar, sello).
- Alcance: se aplicó a todos los archivos tocados en la sesión del rediseño; **no se tocaron retroactivamente** los emojis de módulos no tocados (ej. `ConductoresList.tsx` todavía tiene ✅/⛔) — corregir la próxima vez que se toque ese archivo, no de una.

### Componentes reutilizables agregados al design system

- **`SectionBadge`** (`tone: 'config'|'preview'`): rótulo de las dos columnas del patrón "Configuración | Vista previa" (ver checklist/plantilla de factura de obras-sociales-ui) — editor a la izquierda, resultado de solo lectura a la derecha, ambas columnas siempre visibles en simultáneo (nunca una detrás de un toggle, salvo pedido explícito en contrario).
- **`ProgressBar`** (`pct`, `kind`): barra de progreso genérica. Importante: **Tailwind no puede generar CSS de una clase armada en runtime** (`w-[${pct}%]` no compila a nada — el scanner de Tailwind necesita ver la clase como texto literal en el código fuente). `ProgressBar` ya resuelve esto internamente (redondea a múltiplos de 5 y resuelve por lookup contra una tabla estática) — nunca reinventar este patrón a mano en un componente nuevo, importar `ProgressBar`. Mismo criterio de lookup estático ya existía en `chipColors`/`Swatch`.
- **`Section`** ahora acepta un prop opcional `action?: ReactNode` — contenido alineado a la derecha del título (ej. un `Chip` de estado), backward-compatible con los usos que no lo pasan.
- **`Chip`**: `kind` es `SemanticStatus` (`success`|`warning`|`danger`|`info`|`secondary`), nunca inventar un kind nuevo — mapear el estado del dominio a uno de estos 5.

### Edición diferida a estado local (evita lag de ~700ms por letra)

**Bug real encontrado y corregido dos veces en la misma sesión** (`PlantillaCampoRow.tsx` de obras-sociales-ui, después replicado desde el diseño en `CudFields.tsx`/`PersonasACargoEditor.tsx` de pacientes-ui): un input que llama `onChange` (que persiste) en cada tecla, contra un repository mock con latencia artificial (`withLatency`, 350ms) + recarga completa de la lista tras cada mutación (otros 350ms), genera ~700ms de lag por letra tipeada — el input "se traba" porque su propio `value` depende del round-trip async completo.

**Regla**: cualquier campo de texto editable dentro de una fila/registro (no un form de alta con submit explícito, que ya está bien porque usa estado local del form) debe usar **estado local propio** para la edición y solo llamar al `onChange` que persiste **en un evento explícito** (blur, o un botón "Guardar" si la sección tiene modo edición) — nunca en cada `onChange` del input directo. Si aparece este patrón en otro módulo (conductores, vehículos, etc.) con el mismo síntoma, aplicar el mismo fix.

### `tsc -b`, no `tsc --noEmit` — ver Reglas Duras del CLAUDE.md

Regla de proceso crítica, documentada en detalle en `CLAUDE.md` — `npx tsc --noEmit` a secas en este repo compila **cero archivos** (tsconfig raíz es de project references). El comando correcto es `npx tsc -b --noEmit`.

## Estructura de directorios (propuesta inicial)

```
traslados/                     ← raíz del repo: KB, roadmap, openspec (planificación, no código)
└── traslados-app/             ← raíz del código de la aplicación
    ├── frontend/
    │   └── src/
    │       ├── features/
    │       │   ├── pacientes/
    │       │   ├── obras-sociales/
    │       │   ├── presupuestos-autorizaciones/
    │       │   ├── facturacion/
    │       │   ├── vehiculos/
    │       │   ├── conductores/
    │       │   ├── hojas-de-ruta/
    │       │   ├── dashboard/
    │       │   └── usuarios-y-permisos/
    │       ├── shared/
    │       │   ├── components/
    │       │   ├── hooks/
    │       │   └── lib/ (cliente Supabase, cliente Google Maps)
    │       └── pages/
    └── supabase/
        ├── migrations/
        └── storage/ (buckets: documentos-pacientes, documentos-vehiculos, documentos-conductores, documentos-facturas)
```

## Seguridad

- Autenticación: Supabase Auth (email + contraseña), sin acceso público — sistema interno de uso exclusivo del personal.
- Autorización: permisos por módulo asignados individualmente por cuenta (no roles fijos), implementables como Row Level Security (RLS) de Supabase sobre cada tabla/módulo.
- Validación de input: en frontend (formularios) y en backend (constraints de base de datos + RLS), dado que maneja datos sensibles de salud y de menores de edad (RNF-04).
- Trazabilidad: tabla de audit log transversal, registrando usuario, acción, entidad afectada y timestamp.
- Secrets management: variables de entorno para claves de Supabase y de Google Maps API, nunca expuestas en el bundle de frontend salvo las claves públicas necesarias (anon key, Maps API key restringida por dominio).

## Variables de entorno (a definir en detalle durante el desarrollo)

| Variable | Descripción | Sensible |
|---|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase | No |
| `SUPABASE_ANON_KEY` | Clave pública del cliente | No (pública por diseño, protegida por RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo backend/funciones) | Sí |
| `GOOGLE_MAPS_API_KEY` | Clave para geolocalización (RF-701) | Sí (restringir por dominio/IP) |
| `GOOGLE_DRIVE_CLIENT_ID` / `SECRET` | Integración con Drive de facturación existente | Sí |

## Nota sobre integración con ARCA

El nivel de integración (API automática vs. carga/descarga manual del comprobante) está pendiente de confirmar con el cliente — ver `10_preguntas_abiertas.md`. La arquitectura debe soportar ambos escenarios: almacenamiento del comprobante como documento adjunto (mínimo viable) y, si resulta factible, una integración más automatizada a futuro (alineado con RNF-06 de escalabilidad).
