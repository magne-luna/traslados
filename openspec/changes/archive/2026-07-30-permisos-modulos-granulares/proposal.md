## Why

El sistema de permisos hoy tiene 4 módulos reales (`pacientes`, `obra_social`, `facturacion`, `conductores`), pero el sidebar muestra 7 pantallas gateadas: cada módulo agrupa más de una pantalla (`pacientes` también gatea Hojas de Ruta, `facturacion` también gatea Presupuestos, `conductores` también gatea Vehículos). El usuario pidió separar cada pantalla en su propio módulo porque es más prolijo para el sistema y más fácil para el administrador asignar permisos por pantalla en vez de por grupo.

Este pedido **revierte una decisión ya tomada y archivada** en `openspec/changes/archive/2026-07-29-C-02-usuarios-permisos-auditoria`, que fijó los 4 módulos alineados 1:1 con `docs/core/Traslados-Modelo-Datos.docx` (fuente de verdad estructural del proyecto). La migración `supabase/migrations/20260728120000_seed_modulos.sql` documenta además haber revertido explícitamente un primer intento de usar 9 módulos por carpeta de feature del frontend, por la misma razón: el docx nombra 4 módulos, y cada entidad del docx ("¿Quién puede ver/editar esto?") apunta a exactamente uno de esos 4.

No es un pedido del cliente (Andrea Pastor) — es una preferencia de UX/administración confirmada con el usuario en esta conversación. Por la regla dura del proyecto sobre discrepancias docx↔KB, este cambio se documenta como una discrepancia intencional contra el docx, no se resuelve adivinando.

## What Changes

- Separar el catálogo de módulos de 4 a 7, alineado 1:1 con las 7 pantallas del sidebar que hoy requieren permiso: `pacientes`, `hojas_de_ruta` (nuevo, separado de `pacientes`), `obra_social`, `conductores`, `vehiculos` (nuevo, separado de `conductores`), `facturacion`, `presupuestos` (nuevo, separado de `facturacion`).
- `facturacion.gastos_vehiculos` permanece bajo el módulo `facturacion` (decisión confirmada con el usuario — es un gasto, no una operación sobre el vehículo en sí).
- **BREAKING**: cambia el dominio de valores del tipo `Modulo` (frontend) y de `modulos.modulos.tipo_modulo` (backend). Las policies RLS de las tablas de recorridos, presupuestos/autorizaciones y vehículos pasan a exigir el módulo nuevo en vez del módulo padre.
- Migración de datos: toda fila existente en `modulos.permisos` para `pacientes`, `facturacion` o `conductores` se copia al módulo hijo nuevo correspondiente con el mismo `nivel_acceso`, para que ninguna cuenta pierda acceso a una pantalla que ya tenía el día que se aplique la migración.
- La matriz de permisos del frontend (`MatrizPermisos.tsx`) pasa de mostrar 4 filas a 7 filas, una por módulo, sin agrupar.
- Se elimina la necesidad de `SUBMODULOS_MODULO` (el texto aclaratorio "incluye X e Y") porque cada módulo pasa a ser 1:1 con una pantalla.
- Se documenta la discrepancia contra `docs/core/Traslados-Modelo-Datos.docx` en `knowledge-base/04_modelo_de_datos.md` §Discrepancias y se agrega el componente `AvisoModeloDatos` en la pantalla de Cuentas, según la regla dura del proyecto.

### Rollback

Si hace falta revertir: mantener la migración de datos como una operación reversible (INSERT, no UPDATE destructivo, sobre `modulos.permisos`) permite un DELETE selectivo de las filas de los 3 módulos nuevos sin perder las filas originales de los módulos padre, que nunca se tocan. Las policies RLS viejas quedan documentadas en la migración anterior para poder reaplicarse. El tipo `Modulo` del frontend y `MatrizPermisos.tsx` requieren revertir el commit de código si se decide dar marcha atrás.

## Capabilities

### New Capabilities

(ninguna — este cambio reconfigura una capability existente, no introduce una nueva)

### Modified Capabilities

- `permisos-modulo-frontend`: el requisito "Carga de los permisos de la cuenta activa" deja de exigir exactamente los 4 módulos seedeados; pasa a exigir los 7 módulos nuevos. El requisito "Mapeo declarativo de ruta a módulo" deja de agrupar rutas bajo un módulo padre — cada ruta apunta a su propio módulo.
- `route-guard`: el guard de rutas (`RequireAuth`) deja de resolver el módulo agrupado por `moduloDeRuta()` y pasa a resolver el módulo 1:1 de cada ruta nueva.
- `cuentas-gestion`: el requisito de la matriz de permisos deja de decir "los cuatro módulos del sistema" y pasa a exigir los 7 módulos, sin agrupar.

## Impact

- **Backend (Supabase)**: nueva migración SQL — `INSERT` de 3 módulos nuevos en `modulos.modulos`, migración de datos de `modulos.permisos` (copiar filas del módulo padre al módulo hijo), reescritura de policies RLS en `pacientes.recorridos`/`pacientes.historial_recorridos` (→ `hojas_de_ruta`), `facturacion.presupuesto`/`facturacion.autorizacion` (→ `presupuestos`), `conductores.vehiculo`/`conductores.accesorios_vehiculo`/`conductores.documentacion_vehiculo`/`conductores.mantenimiento`/`conductores.conductores_vehiculos` (→ `vehiculos`).
- **Frontend — tipos**: `frontend/src/shared/types/usuario.ts` (`Modulo`: 4 → 7 valores).
- **Frontend — permisos**: `frontend/src/features/cuentas/modulos.ts` (`MODULOS`, `ETIQUETA_MODULO`, `MODULO_COLOR` a 7 entradas; se elimina `SUBMODULOS_MODULO`; `MODULO_COLOR` tiene solo 5 tonos de `SemanticStatus` disponibles — hay que decidir repetir tonos o extender el design system).
- **Frontend — routing**: `frontend/src/app/routes.ts` (`APP_ROUTES` y `moduloDeRuta()`, cada ruta apunta a su propio módulo).
- **Frontend — UI**: `frontend/src/features/cuentas/MatrizPermisos.tsx`, `PermisosMatrizFields.tsx`, `CuentaForm.tsx` (la matriz crece de 4 a 7 filas).
- **Tests**: `modulos.test.ts`, `PermisosMatrizFields.test.tsx`, `MatrizPermisos.test.tsx`, `routes.test.ts`, `router.cuentas.test.tsx`, `AppShell.test.tsx`, `router.test.tsx`.
- **Documentación**: `knowledge-base/04_modelo_de_datos.md` §Discrepancias (nueva entrada), `CHANGES.md` (bullet de discrepancia en este change).
- **Dependencias**: este change no bloquea ni es bloqueado por ningún change activo del roadmap (no hay changes activos en este momento); reabre y extiende el change ya archivado `C-02-usuarios-permisos-auditoria`.
