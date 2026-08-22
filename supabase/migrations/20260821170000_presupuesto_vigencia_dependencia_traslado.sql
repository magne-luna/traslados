-- Migration: presupuesto_vigencia_dependencia_traslado
-- Change: presupuestos-vigencia-datos-traslado-vista-previa (design.md D1, D2, D3, D4).
--
-- Qué agrega, en tres bloques conceptuales:
--   1. Vigencia del PEDIDO (`vigencia_desde`/`vigencia_hasta`): el período que el presupuesto
--      dice cubrir, separado de `fecha_emision` (cuándo se emitió el papel). Caso literal de la
--      usuaria: presupuesto emitido 30/12, vigente desde feb-2026.
--   2. Dependencia pedida (`con_dependencia`): booleano solo, ver D3 más abajo.
--   3. Datos de traslado (`origen_ida`..`dias_mensuales`): el bloque del formulario de la obra
--      social que hoy no tiene dónde persistirse (origen/destino ida y vuelta, horarios, km,
--      días de la semana, días mensuales negociados).
--
-- ⚠️ Por qué la vigencia (y todo este bloque) vive en `facturacion.presupuesto` y NO en
-- `facturacion.presupuesto_linea` (D1, decisión RESUELTA, 5 motivos en el design):
--   1. La causa del corte (vencimiento de CUD del paciente o de RNP del prestador) no es un
--      atributo de una prestación individual: corta TODO lo que se le facture a ese paciente por
--      ese prestador. Vigencia por línea permitiría estados imposibles (líneas del mismo
--      presupuesto con vigencias distintas por el mismo vencimiento).
--   2. La granularidad por prestación ya existe por otra vía: en modalidad `por-prestacion` cada
--      prestación YA tiene su propio presupuesto (`crear_presupuestos_lote` crea una fila por
--      prestación). Si una prestación necesita otra vigencia, ya se expresa hoy como otro
--      presupuesto — no hace falta una segunda forma de decir lo mismo.
--   3. `presupuesto_linea` solo existe en modalidad `general` (en `por-prestacion` no hay
--      líneas). Un campo que solo se puede cargar en una de las dos modalidades no es un campo
--      del dominio, es un accidente del modelo.
--   4. Chocaría con la vigencia de `facturacion.autorizacion`, que es de fila y 1:1 con el
--      PRESUPUESTO (no con la línea). Vigencia por línea obligaría a esa autorización a
--      responder a N vigencias con una sola fila — la misma ambigüedad 1:N que bloqueó el punto 7
--      del proposal (cardinalidad Autorización↔Presupuesto).
--   5. Simetría con la discrepancia #13 de la KB: un atributo persistido por línea convierte al
--      presupuesto en un agregado, exactamente la forma que #13 prohibió para `monto`.
--
-- ⚠️ Filas existentes: tras este ALTER, todo presupuesto ya creado queda con `vigencia_desde` y
-- `vigencia_hasta` en NULL. Esto es semánticamente CORRECTO, no un valor faltante a rellenar: esos
-- presupuestos se emitieron bajo el modelo anterior, que no tenía noción de vigencia. NULL acá
-- significa "sin vigencia cargada", no "vigencia desconocida" — no se fabrica un valor
-- retroactivo. Mismo criterio que ya usa `autorizacion.vigencia_desde`
-- (20260729130000_schema_autorizacion_monto_vigencia.sql) para las autorizaciones históricas.
--
-- Por qué `con_dependencia` es BOOLEAN NULLABLE y no `NOT NULL DEFAULT false` (D3, RESUELTA):
-- `NULL` = "no se cargó este dato" (presupuestos existentes y altas donde Andrea todavía no
-- completó el campo); `false` = "SD, decisión tomada explícitamente". Un default `false`
-- afirmaría "sin dependencia" para TODOS los presupuestos históricos, que es fabricar un dato que
-- nadie cargó — el mismo antipatrón que el proyecto viene corrigiendo en otros dominios
-- documentales (ver 20260818090000_add_autorizacion_archivo_meta.sql). El par pedido/concedido
-- vive en dos tablas: este `con_dependencia` es lo que Andrea PIDE; el de
-- `facturacion.autorizacion` (ver la migración hermana de este mismo change) es lo que la obra
-- social CONCEDE — misma forma que `monto`→`monto_autorizado` y `vigencia`→`vigencia_autorizada`.
-- Qué NO decide esta migración: qué le hace CD/SD al valor del km (Open Question 1 del design,
-- decide Andrea) — el km sigue siendo carga manual, `con_dependencia` no dispara ningún cálculo.
--
-- Por qué `dias_semana` es `TEXT[] NOT NULL DEFAULT '{}'` SIN `CHECK` que valide sus valores
-- (D2, sub-decisión de forma): mismo criterio ya escrito en el dominio de `RecorridoHabitual`
-- ("la cerradura la impone el tipo en TypeScript, no la base" — la columna real `dia_semana` de
-- `pacientes.recorridos` tampoco tiene CHECK). La validación de que cada elemento pertenezca a la
-- unión `DiaSemana` va en el mapping del frontend (Fase 5 de este change), no en SQL. `NOT NULL
-- DEFAULT '{}'` sí es una invariante de la columna (un array ausente y un array vacío deben ser
-- indistinguibles: "sin días cargados"), por eso es la única de las 13 columnas que no es
-- nullable en el sentido SQL — aunque semánticamente el `'{}'` cumple el mismo rol que NULL en
-- las demás.
--
-- Por qué NO hay una columna `viajes_mensuales` (D4, RESUELTA): los viajes mensuales se DERIVAN
-- de `dias_mensuales` (× 2 si hay vuelta cargada, × 1 si no) en una función pura del frontend
-- (`frontend/src/shared/lib/presupuestos/calculoViajes.ts`, Fase 4 de este change), nunca se
-- persisten. Guardarlos crearía una segunda fuente de verdad de `dias_mensuales` que puede
-- desincronizarse en cualquier edición — mismo criterio que `presupuesto-prestaciones` D6 aplicó
-- a "la suma de las líneas es el monto" (duplicarla en Postgres crea dos fuentes de verdad).
--
-- Sin RLS nueva (D7, RESUELTA): esta migración NO crea ninguna tabla, solo agrega columnas a
-- `facturacion.presupuesto`, que ya está cubierta por las policies "Read presupuesto" / "Write
-- presupuesto" (20260730140000_split_modulos_permisos.sql, gateadas por
-- `modulos.tiene_permiso('presupuestos', ...)`), que aplican a la fila completa, columnas nuevas
-- incluidas. La regla dura del proyecto ("toda tabla nueva define su RLS en el mismo change") se
-- cumple por vacuidad: no hay tabla nueva que gatear. Esto se deja escrito a propósito para que
-- un reviewer no lo lea como un olvido de RLS.
--
-- ⚠️ Esta migración se redacta como artefacto de diseño del change. NO se aplica desde el agente
-- (governance ALTO — datos de salud + facturación a obra social, no límite técnico): la aplica la
-- usuaria o Enzo con `supabase db push`, después de revisar. Ver tasks.md 3.5.
--
-- Rollback de esta migración: ver `openspec/changes/presupuestos-vigencia-datos-traslado-vista-previa/rollback-rpc-presupuesto.sql`
-- para el rollback de las RPC (que depende de esto). El de esta migración es un DROP COLUMN de
-- las 13 columnas; con filas reales que ya tengan vigencia o datos de traslado cargados, ese DROP
-- borra información de negocio que solo existía en papel (ver design.md §Rollback).

ALTER TABLE facturacion.presupuesto
  ADD COLUMN vigencia_desde     DATE,
  ADD COLUMN vigencia_hasta     DATE,
  ADD COLUMN con_dependencia    BOOLEAN,
  ADD COLUMN origen_ida         TEXT,
  ADD COLUMN destino_ida        TEXT,
  ADD COLUMN origen_vuelta      TEXT,
  ADD COLUMN destino_vuelta     TEXT,
  ADD COLUMN horario_entrada    TIME,
  ADD COLUMN horario_salida     TIME,
  ADD COLUMN km_ida             NUMERIC(10,2),
  ADD COLUMN km_vuelta          NUMERIC(10,2),
  ADD COLUMN dias_semana        TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN dias_mensuales     SMALLINT;

ALTER TABLE facturacion.presupuesto
  ADD CONSTRAINT presupuesto_vigencia_hasta_desde_check
  CHECK (vigencia_hasta IS NULL OR vigencia_desde IS NULL OR vigencia_hasta >= vigencia_desde);

COMMENT ON COLUMN facturacion.presupuesto.vigencia_desde IS
  'Desde cuándo cubre este presupuesto (lo PEDIDO), separado de fecha_emision (cuándo se emitió '
  'el papel). Vive en presupuesto, no en presupuesto_linea (D1: el corte por CUD/RNP no es de '
  'línea; ver cabecera de esta migración). NULL en filas existentes = "sin vigencia cargada", '
  'se emitieron bajo el modelo anterior — no fabricar un valor retroactivo.';

COMMENT ON COLUMN facturacion.presupuesto.vigencia_hasta IS
  'Hasta cuándo cubre este presupuesto (lo PEDIDO). CHECK presupuesto_vigencia_hasta_desde_check '
  'exige vigencia_hasta >= vigencia_desde cuando ambas están cargadas — invariante de FILA, no '
  'regla cruzada contra autorizacion (esa regla, "autorizada ⊆ presupuestada", va en la capa de '
  'aplicación, ver migración de autorizacion de este mismo change). NULL en filas existentes = '
  '"sin vigencia cargada", igual que vigencia_desde.';

COMMENT ON COLUMN facturacion.presupuesto.con_dependencia IS
  'Dependencia PEDIDA por Andrea al presentar el presupuesto (CD/SD). NULLABLE a propósito, NO '
  '"NOT NULL DEFAULT false": NULL = "no se cargó este dato", false = "SD, decisión tomada". Un '
  'default false fabricaría "sin dependencia" para todo presupuesto histórico. Ver el par '
  'pedido/concedido con facturacion.autorizacion.con_dependencia en la migración hermana. Esta '
  'columna NO dispara ningún cálculo sobre el km (Open Question 1 del design, decide Andrea).';

COMMENT ON COLUMN facturacion.presupuesto.origen_ida IS
  'Origen del tramo de ida, tal como se escribió en el formulario de la obra social. Texto '
  'declarado, SIN FK a pacientes.direcciones ni a pacientes.recorridos: es una declaración '
  'congelada a la fecha del presupuesto, no el estado actual del paciente (D2 — RecorridoHabitual '
  'tiene ciclo de vida opuesto, cambiar el domicilio del paciente no debe reescribir '
  'retroactivamente presupuestos ya presentados/autorizados). Prefill opcional (copy-on-create, '
  'sin FK) desde los RecorridoHabitual vigentes del paciente, vía UI — Fase 8 de este change.';

COMMENT ON COLUMN facturacion.presupuesto.destino_ida IS
  'Destino del tramo de ida. Mismo criterio que origen_ida: texto declarado, sin FK, copy-on-create '
  'opcional desde RecorridoHabitual (D2).';

COMMENT ON COLUMN facturacion.presupuesto.origen_vuelta IS
  'Origen del tramo de vuelta, si el presupuesto declara retorno (RecorridoHabitual no tiene esta '
  'noción: es N filas de un solo trayecto). NULL = sin tramo de vuelta cargado; junto con '
  'destino_vuelta/km_vuelta determina "tieneVuelta" para calculoViajes.ts (D4) — no es una columna '
  'booleana aparte, se deriva de que estos campos estén cargados.';

COMMENT ON COLUMN facturacion.presupuesto.destino_vuelta IS
  'Destino del tramo de vuelta. Mismo criterio que origen_vuelta.';

COMMENT ON COLUMN facturacion.presupuesto.horario_entrada IS
  'Horario de entrada declarado en el formulario de la obra social. RecorridoHabitual.hora usa '
  '''HH:MM'' en TS con una sola hora por fila; acá el bloque necesita entrada Y salida en un '
  'mismo registro, por eso no se reusa esa tabla (D2, motivo 2: la forma no coincide y forzarla '
  'pierde datos).';

COMMENT ON COLUMN facturacion.presupuesto.horario_salida IS
  'Horario de salida declarado. Mismo criterio que horario_entrada.';

COMMENT ON COLUMN facturacion.presupuesto.km_ida IS
  'Kilómetros del tramo de ida, carga manual (04_modelo_de_datos.md: "nomenclador, carga '
  'manual"). Este change guarda el dato tal como se carga; no automatiza ningún multiplicador por '
  'con_dependencia (Open Question 1 del design, decide Andrea).';

COMMENT ON COLUMN facturacion.presupuesto.km_vuelta IS
  'Kilómetros del tramo de vuelta, carga manual. NULL junto con origen_vuelta/destino_vuelta = '
  'sin tramo de vuelta cargado (ver origen_vuelta).';

COMMENT ON COLUMN facturacion.presupuesto.dias_semana IS
  'Conjunto de días de la semana declarados (ej. lunes/miércoles/viernes), NOT NULL DEFAULT ''{}'' '
  '— un array vacío y "sin días cargados" son el mismo hecho, por eso es la única de las 13 '
  'columnas de esta migración que no es nullable en el sentido SQL. SIN CHECK que valide los '
  'valores: mismo criterio que pacientes.recorridos.dia_semana (la cerradura la impone el tipo '
  'DiaSemana en TypeScript, no la base — la validación de forma va en el mapping del frontend, '
  'Fase 5 de este change). TEXT[] y no una tabla hija: es un conjunto acotado de 7 valores, una '
  'tabla hija exigiría RLS/auditoría/índice nuevos para expresar lo mismo que un array.';

COMMENT ON COLUMN facturacion.presupuesto.dias_mensuales IS
  'Cantidad de días mensuales NEGOCIADA con la obra social, tal como figura en el formulario — '
  'NO es "días hábiles del mes" calculado del calendario; derivarlo inventaría el dato (D2). A '
  'partir de este número, frontend/src/shared/lib/presupuestos/calculoViajes.ts deriva '
  'viajesMensuales (× 2 si hay vuelta, × 1 si no) y kmMensuales EN VIVO, sin persistirlos: NO '
  'existe (ni va a existir) una columna viajes_mensuales — sería una segunda fuente de verdad de '
  'este mismo número, que se desincroniza en cualquier edición (D4, mismo criterio que '
  'presupuesto-prestaciones D6 aplicó al total de las líneas vs. el monto).';
