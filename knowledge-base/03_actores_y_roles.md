# Actores y Roles

## Actores del sistema

| Actor | Descripción | Cómo interactúa |
|---|---|---|
| Administradora (Andrea) | Dueña de la operación. Acceso total a todos los módulos. | Diagrama recorridos, supervisa y gestiona toda la operación; asigna permisos al resto de las cuentas. |
| Facturación (Ariana) | Encargada de facturación y cobros. | Trabaja de forma remota. Requiere acceso a facturación, presupuestos, autorizaciones y datos asociados. |
| Operadoras (Diana, Romina) | Personal operativo, turnos mañana y tarde. | Carga de datos y gestión de recorridos según los permisos que se les asignen. |
| Conductores | Choferes de los vehículos. | **No operan el sistema.** Se registran como datos dentro del módulo Conductores, pero no acceden a la aplicación (reciben su recorrido en papel o por WhatsApp). |

## RBAC — Matriz de permisos

Cada cuenta tiene un **rol fijo** (`rol_enum`: `admin` / `empleado`), tal como lo define el modelo
real de la BD (`docs/core/Traslados-Modelo-Datos.docx`). `admin` (Andrea) tiene acceso total a todos
los módulos, sin pasar por chequeo de permisos. `empleado` (Ariana, Diana, Romina, y cualquier cuenta
nueva) tiene acceso configurable módulo por módulo mediante la matriz Cuenta → Módulos habilitados
(`modulos.permisos`, evaluada en runtime por `tiene_permiso()`), asignada de forma flexible por la
administradora (RF-002). La base de datos bloquea a nivel de trigger que una cuenta `empleado` se
autopromueva a `admin`. Toda cuenta nueva se crea como `empleado` por defecto (`handle_new_user()`);
el único `admin` del sistema se asigna a mano una única vez por SQL Editor (bootstrap, ver
`CHANGES.md` §C-02).

Todas las acciones (creación, modificación, eliminación) quedan registradas en un log de auditoría (RF-003: quién, qué y cuándo), y opcionalmente se registra hora de ingreso/egreso por cuenta (RF-004).

## Discrepancia con el docx — resuelta

**Resuelto 2026-07-28** (`CHANGES.md` §C-02): esta sección afirmaba antes que el sistema "no maneja
roles fijos ni predefinidos", contradiciendo el campo `Rol` (Administrador/Empleado) + "protección
contra autopromoción de rol" que describe el docx. Al releer el docx completo se confirmó que el docx
es correcto: el modelo real es rol fijo (`admin`/`empleado`) + permisos por módulo para `empleado`,
tal como quedó documentado arriba. Implementado y pusheado al proyecto Supabase real
(`pkryfoljypuzfifofdwp`) en `supabase/migrations/20260724100002_schema_usuarios.sql` y migraciones
relacionadas de C-02.

## Rutas públicas

No aplica: es un sistema interno de gestión, de uso exclusivo del personal de la empresa. No hay rutas de acceso público ni de cara a pacientes o conductores.
