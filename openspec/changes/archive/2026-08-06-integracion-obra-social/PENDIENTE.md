# Pendiente (archivado 2026-08-06/07 con esto sin cerrar)

Este change se archivó en 69/70. Todo el backend está verificado en vivo (migraciones aplicadas,
RLS/SECURITY INVOKER confirmados, rollback atómico, audit log completo — ver `tasks.md` 1B.6/1B.8/
8.6/8.8). Lo único que falta es:

- **`8.5` — pase visual en navegador** (`npm run dev`), con 3 cuentas reales:
  - `obra_social: write` — alta, edición, **reordenar el checklist por drag-and-drop**, editar
    plantilla de factura.
  - `obra_social: read` — solo lectura, sin guardado fantasma, aviso de solo lectura de
    `gateo-obrasocial` visible.
  - Una cuenta con permiso de **otro** módulo (`pacientes`) — confirmar que no habilita esta
    pantalla en el router.

No hay nada de backend pendiente. Cuando se haga ese pase, marcar `8.5` en `tasks.md` y listo.
