# Actores y Roles

## Actores del sistema

| Actor | Descripción | Cómo interactúa |
|---|---|---|
| Administradora (Andrea) | Dueña de la operación. Acceso total a todos los módulos. | Diagrama recorridos, supervisa y gestiona toda la operación; asigna permisos al resto de las cuentas. |
| Facturación (Ariana) | Encargada de facturación y cobros. | Trabaja de forma remota. Requiere acceso a facturación, presupuestos, autorizaciones y datos asociados. |
| Operadoras (Diana, Romina) | Personal operativo, turnos mañana y tarde. | Carga de datos y gestión de recorridos según los permisos que se les asignen. |
| Conductores | Choferes de los vehículos. | **No operan el sistema.** Se registran como datos dentro del módulo Conductores, pero no acceden a la aplicación (reciben su recorrido en papel o por WhatsApp). |

## RBAC — Matriz de permisos

El sistema **no maneja roles fijos ni predefinidos**. Cada cuenta de usuario recibe acceso individual por módulo, asignado de forma flexible por la administradora (RF-002). No existe una matriz Rol → Permiso cerrada; existe una matriz Cuenta → Módulos habilitados, configurable caso a caso.

Todas las acciones (creación, modificación, eliminación) quedan registradas en un log de auditoría (RF-003: quién, qué y cuándo), y opcionalmente se registra hora de ingreso/egreso por cuenta (RF-004).

## ⚠️ Discrepancia con el modelo de datos real (docs/core/Traslados-Modelo-Datos.docx)

El docx de MagneStudios describe un campo `Rol` en Usuarios con dos valores fijos — Administrador
(acceso total, sin pasar por chequeo de permisos) y Empleado (acceso según permisos por módulo) — y
una regla de seguridad explícita de "protección contra autopromoción de rol". Eso contradice la
afirmación de más arriba ("no maneja roles fijos ni predefinidos"). Todavía no hay código de
roles/permisos implementado (`AuthContext.tsx` es un mock sin roles, a propósito — eso lo resuelve
el backend real en FE-8), así que no hay nada que migrar en el frontend, pero hay que resolver esta
contradicción con quien armó el docx antes de diseñar las RLS policies: ¿el modelo es rol fijo +
permisos por módulo (como dice el docx), o solo permisos por módulo (como dice esta KB)?

## Rutas públicas

No aplica: es un sistema interno de gestión, de uso exclusivo del personal de la empresa. No hay rutas de acceso público ni de cara a pacientes o conductores.
