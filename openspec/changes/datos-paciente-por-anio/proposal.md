## Why

Andrea organiza cada paciente como carpetas por año (Paciente → 2025 / 2026 / 2027): 2025 puede
seguir en cobro (amparos), 2026 está en curso y 2027 se prepara **ahora** (presupuestos a
presentar a mediados de octubre; 60 días hábiles de autorización desde el 1/1). Hoy el modelo es
"una sola foto" del paciente: las prestaciones del año que viene se cargan con el año en el nombre
("Hidroterapia 2027", "TO 2027"), los destinos habituales no distinguen año y la obra social es una
sola (`paciente.obra_social_id`), aunque un paciente puede cambiar de obra social a mitad de año
(Ene–Jul OS A, Ago–Dic OS B). Fuente: reunión 2026-10-07, min 6:12–18:00 y 31:00–38:12;
`knowledge-base/10_preguntas_abiertas.md` §"Preguntas nuevas — reunión con Andrea" ítem 2.

## What Changes

- **Datos fijos del paciente** (nunca por año, sin cambios de estructura): nombre(s), apellido(s),
  DNI, CUIL, fecha de nacimiento.
- **Prestaciones por año**: `pacientes.prestaciones` gana `anio SMALLINT NOT NULL`. La ficha muestra
  y edita las prestaciones del año elegido; el presupuesto solo ofrece las del año de su vigencia.
- **Destinos habituales por año**: `pacientes.recorridos` gana `anio SMALLINT NOT NULL`. Presupuesto
  (datos de traslado) y hoja de ruta (sugerencia del día) usan los del año correspondiente.
- **Obra social por período**: se reutiliza `obra_social.coberturas_paciente` (ya modela N
  coberturas con `fecha_desde`/`fecha_hasta`, tal como el docx). La ficha muestra, por año, las
  coberturas que se solapan con ese año; un cambio de OS a mitad de año = cerrar una cobertura y
  abrir otra. El presupuesto deriva la obra social de la cobertura vigente en su `vigencia_desde`
  (hoy la toma de `paciente.obra_social_id`). `paciente.obra_social_id` queda como "obra social
  actual" derivada, sin borrarse.
- **Ficha con pestañas por año** (las "carpetas"): años = los que tienen datos + año actual + año
  siguiente. Acción "Preparar <año> copiando <año anterior>" que duplica prestaciones y destinos
  habituales (no presupuestos).
- **Diagnóstico/condición, CUD, direcciones, accesorios, personas a cargo**: siguen siendo del
  paciente, editables (Andrea: "no hace falta historial, hace falta poder editarlo"). Queda como
  decisión abierta (ver design.md §Decisiones abiertas).
- **Migración de datos existentes sin pérdida**: filas actuales → `anio = 2026`; prestaciones cuyo
  nombre termina en el año ("... 2027") → `anio = 2027` con el sufijo removido (sujeto a
  confirmación). Pacientes con `obra_social_id` y sin cobertura → se crea la cobertura abierta.
- Listado de Presupuestos: **sin cambios** (sigue por presupuesto, filtrable por paciente).
- Discrepancia docx↔KB documentada (el docx no tiene `anio` en Prestaciones/Recorridos) en
  `knowledge-base/04_modelo_de_datos.md` §Discrepancias, `CHANGES.md` y `AvisoModeloDatos`.

No hay cambios **BREAKING** de API pública: todas las columnas nuevas son aditivas con backfill.

## Capabilities

### New Capabilities
- `paciente-datos-por-anio`: separación datos fijos vs. datos por año del paciente — prestaciones y
  destinos habituales por año, coberturas por período, pestañas por año en la ficha, copiar año
  anterior, migración de datos existentes.

### Modified Capabilities
- `presupuesto-crud`: el formulario toma prestaciones, destinos habituales y obra social del año /
  fecha de vigencia del presupuesto, no de la "foto actual" del paciente.
- `hoja-de-ruta-armado`: los destinos habituales sugeridos para un día son los del año de esa fecha.

## Impact

- **Base (lo aplica Enzo)**: 2 migraciones nuevas (columnas `anio` + índices + backfill; data fix de
  coberturas) y posible ajuste de `crear_paciente_completo` / `crear_presupuesto_completo` si
  validan prestaciones. Sin tablas nuevas → sin RLS nueva (las policies existentes cubren columnas
  nuevas). Edge functions afectadas: `presupuestos` (lectura de prestaciones), `facturar`
  (número de afiliado: cobertura vigente en el período facturado, no "la más reciente").
- **Frontend**: `shared/types/{prestacion,recorridoHabitual,paciente}.ts`,
  `shared/lib/pacientes/*` (mapping + repos), `features/pacientes/PacienteDetail.tsx` (+ nuevo
  selector de año), `PrestacionesEditor`, `RecorridosHabitualesEditor`, `PacienteCoberturaFields`,
  `features/presupuestos/PresupuestoForm.tsx`, `features/hojas-de-ruta/*` /
  `shared/lib/hojas-de-ruta/recorridosHabitualesDelDia.ts`.
- **Docs**: `knowledge-base/04_modelo_de_datos.md`, `knowledge-base/10_preguntas_abiertas.md`,
  `CHANGES.md`, `docs/PENDIENTE-ENZO.md`.
- **Dependencias**: se apoya en `presupuesto-prestaciones` (prestaciones por paciente),
  `presupuesto-vigencia`, `integracion-hojas-de-ruta` y `facturacion-seleccion-autorizacion`
  (todos ya implementados). No bloquea otros changes activos.
- **Governance**: HIGH/CRITICAL (datos de salud de menores + facturación + cambio de esquema):
  migraciones y data fix se revisan con la usuaria antes de escribirse; `db push` y deploy los hace
  Enzo.
- **Rollback**: columnas aditivas → `DROP COLUMN anio` en ambas tablas revierte; el data fix de
  nombres de prestaciones guarda el nombre original en la auditoría (`auditoria.log_action`) y se
  documenta el UPDATE inverso en la migración.
- **Tamaño estimado**: M–L — ~2 migraciones, 2 edge functions tocadas, ~10–12 archivos de frontend;
  3 PRs encadenados, ~4–6 días de trabajo con TDD.
