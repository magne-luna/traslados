# Visión y Objetivos

## Propósito del sistema

Centralizar en una única plataforma web toda la información operativa del servicio de traslado personalizado para personas con discapacidad que opera Andrea Pastor. Hoy los datos están fragmentados en planillas, carpetas por paciente (con subcarpetas por año) y anotaciones en papel, lo que dificulta el acceso rápido y confiable y genera duplicación de tareas y demoras entre las áreas de pacientes, facturación, cobros, asistencias y planificación de recorridos.

## Objetivos por actor

| Actor | Objetivo principal | Objetivos secundarios |
|---|---|---|
| Administradora (Andrea) | Tener control y trazabilidad total de la operación | Diagramar recorridos, supervisar todos los módulos, gestionar permisos |
| Facturación (Ariana) | Facturar y cobrar sin depender de archivos dispersos | Acceso remoto a presupuestos, autorizaciones y datos asociados |
| Operadoras (Diana, Romina) | Cargar datos y gestionar recorridos del día a día | Operar dentro de los permisos que les asigne la administradora |
| Conductores | Recibir su recorrido asignado | No operan el sistema (reciben el recorrido en papel o por WhatsApp) |

## Alcance v1.3

- Gestión de usuarios, permisos flexibles (sin roles fijos) y auditoría de acciones.
- Pacientes y fichas clínicas, con carga de documentos.
- Presupuestos y autorizaciones por obra social.
- Obras sociales y prestadores, con checklist de documentación configurable.
- Facturación, asistencias y cobros integrados en un mismo circuito.
- Vehículos y mantenimiento (RTO, VTV, gastos, compatibilidad con accesorios de movilidad).
- Conductores (solo como registro de datos, sin acceso al sistema).
- Hojas de ruta y recorridos, con sugerencia de orden por cercanía (no ruteo automático).
- Panel principal (dashboard) y reportes.
- Gestión documental transversal (carga, visualización y organización por entidad).

## Fuera de alcance (Fase 1)

- Aplicación o panel de acceso para conductores.
- Seguimiento/tracking de vehículos en tiempo real (el cliente ya cuenta con rastreo satelital propio).
- Optimización automática y total de rutas (el sistema solo ordena/propone; la decisión de ruta es del usuario).
- Automatización del valor del kilómetro del nomenclador (se carga manualmente).
- Ajuste retroactivo de valores de facturas ya emitidas (se cobra al valor de la fecha de facturación).

## Métricas de éxito

- Reducción del tiempo de armado de la hoja de ruta diaria.
- Disminución de rechazos de facturación por exceso sobre lo autorizado (RF-402).
- Alertas de vencimiento (CUD, mantenimiento, cobro) atendidas antes de que generen un problema operativo.
- Migración completa de los ~50-60 pacientes (más de 50 activos) sin pérdida de información.
