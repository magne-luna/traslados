# Pendiente (archivado 2026-08-06/07 con esto sin cerrar)

Este change se archivó en 64/66. Todo el backend está verificado en vivo (migraciones aplicadas,
RLS/SECURITY INVOKER confirmados, rollback atómico, audit log de alta y edición — ver `tasks.md`
1.3/1B.4/7.6/7.7/7.8). De paso se encontró y corrigió un bug real bloqueante (`tipo_lugar` sin cast
en `crear_paciente_completo`, ver `20260807000000_crear_paciente_completo_tipo_lugar_cast.sql`).
Lo que falta:

- **`7.5` — pase visual en navegador** (`npm run dev`), con 3 cuentas reales:
  - `pacientes: write` — alta, edición, borrado de dirección.
  - `pacientes: read` — solo lectura, sin guardado fantasma.
  - `pacientes: read` **sin** `obra_social: read` — el número de afiliado se ve vacío y con
    cartel, la ficha carga igual.
- **`1B.5` — decisión diferida, no bloqueante**: montar un harness de pgTAP para testear funciones
  de Postgres en vez de verificación manual. Queda registrada en
  `knowledge-base/10_preguntas_abiertas.md` para no repetir el checklist manual en cada change de
  integración. No es necesaria para dar este change por cerrado.

No hay nada de backend pendiente. Cuando se haga el pase visual, marcar `7.5` en `tasks.md` y listo.
