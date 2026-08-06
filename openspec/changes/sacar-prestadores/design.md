# Design — sacar-prestadores

Change de remoción, no de construcción: la mayoría de las decisiones son "borrar tal cual estaba"
— documentadas acá solo donde hay un checkpoint real (datos huérfanos, comportamiento que cambia)
o una interpretación del agente que conviene dejar explícita, siguiendo el mismo criterio que
`factura-por-prestador/design.md` usa para sus D1-D4.

## D1 — ⚠️ Checkpoint: datos huérfanos de `Prestador` (`plazoCobroDias`/`tipoComprobante`)

Antes de escribir la migración de `DROP TABLE`, había que confirmar que ningún dato de
`Prestador` necesitaba "volver" a `ObraSocial` (que es de donde `prestadores-crud` los había
sacado, sin confirmar con Andrea — ver `prestadores-crud/design.md` D3/D4). Investigado con grep
en vivo contra el código actual, antes de tocar nada:

- **`Prestador.plazoCobroDias`**: confirmado **muerto** — no se lee en ningún lugar fuera de las
  propias pantallas de Prestador (`PrestadorDetail.tsx`, `PrestadoresList.tsx`, ambas borradas por
  este change). `calcularFechaEstimadaCobro()` (`frontend/src/shared/lib/facturacion/
  calcularFechaEstimadaCobro.ts`) nunca tuvo un parámetro de plazo de Prestador — toma
  `plazoObraSocial: number | undefined`, y su único call site (`useEmisionFactura.ts`) ya pasaba
  `undefined` siempre, con un comentario explicando que el plazo "no tiene fuente funcionando
  todavía", cayendo en `PLAZO_COBRO_DEFAULT_DIAS` (90) incondicionalmente. **Conclusión: nada que
  mover, `plazoCobroDias` no tenía ningún destino de datos vivo que preservar.**
- **`Prestador.tipoComprobante`**: este SÍ estaba activamente leído — auto-completaba
  `values.tipoComprobante` en `FacturaForm.tsx` y motivaba `tipoComprobanteBloqueado` (el
  `<Select>` de tipo de comprobante quedaba de solo lectura mientras hubiera un Prestador
  elegido). Este cableado se resuelve con D2 de abajo: se remueve el lock completo, sin
  reemplazarlo por ningún auto-fill nuevo — vuelve a ser 100% manual, igual que ya era la
  modalidad `'general'`.
- **Nota aparte (informativa, fuera de scope de este change)**: la base real ya tiene columnas
  vestigiales `plazo_cobro_dias`/`tipo_comprobante` en `obra_social.obra_social`, agregadas por
  una migración **anterior** a Prestador (`20260729110000_schema_obra_social_facturacion_config.sql`,
  no por `prestadores-crud`). Nunca se dropearon cuando `prestadores-crud` agregó sus equivalentes
  del lado de `Prestador` (deferido a propósito, ver `20260801100000_prestadores_condiciones.sql`
  §D3: "no se crea ningún archivo DROP COLUMN para `obra_social.obra_social`"). Siguen sin uso
  desde el frontend hoy. **No se tocan en este change** — ni la migración de este change las
  dropea, ni el tipo/form de `ObraSocial` las vuelve a exponer. No hay nada que "restaurar": esas
  columnas nunca dejaron de existir en la base.

## D2 — Interpretación del agente: `tipoComprobanteBloqueado`/`faltaElegirPrestador`

Sin resolver por el cliente explícitamente (Enzo pidió "sacar Prestadores", no especificó el
detalle de estos dos flags) — decisión tomada por el agente, análoga a las que
`factura-por-prestador/design.md` marca como "Deliberadamente NO resuelve..." cuando haga falta
revisar:

- **`tipoComprobanteBloqueado` se elimina por completo.** Tipo de comprobante vuelve a ser
  **siempre editable a mano** — revierte al comportamiento de antes de `factura-por-prestador`
  (que ya era el comportamiento vigente en modalidad `'general'`, sin cambios). No hay ninguna
  fuente de auto-fill que lo reemplace: sin `Prestador`, no hay de dónde sacar un tipo de
  comprobante sugerido.
- **`faltaElegirPrestador` se renombra a `faltaCompletarPrestador`** y cambia su condición:
  `obraSocial?.modalidadFacturacion === 'por-prestacion' && (!values.prestadorNombre?.trim() ||
  !values.prestadorDomicilio?.trim())`. Sigue gateando lo mismo que antes (el paso 2→3 del wizard,
  y la vista previa de la descripción) pero ahora exige que **ambos** campos de texto libre estén
  completos, no una selección de entidad. Mismo criterio de "no dejar avanzar con datos a medias"
  que ya regía, aplicado al nuevo shape de datos.

Si en el futuro se decide que estos dos campos deberían tener alguna validación de formato
(dirección real, etc.) o dejar de ser obligatorios, es una decisión de negocio nueva — este change
no la anticipa.

## D3 — ⚠️ Hallazgo: drift entre `CHANGES.md` y el estado real de la base

`CHANGES.md` (§C-04, bullet `prestadores-crud`) afirma que
`20260801100000_prestadores_condiciones.sql` está "escrita, no aplicada". **Verificado falso** con
`supabase db query --linked` contra el proyecto real (`pkryfoljypuzfifofdwp`, 2026-08-06):

- `supabase_migrations.schema_migrations` tiene registradas `20260801100000`, `20260801110000` y
  `20260801120000` — las tres migraciones de `prestadores-crud`.
- Datos reales confirman el aplicado: `obra_social.prestadores` tiene 2 filas, `obra_social.
  obra_social_prestador` tiene 3 filas — coincide exactamente con el seed de
  `20260801120000_seed_obras_sociales_prestadores.sql`.
- La Edge Function `prestadores` está deployada y **ACTIVE** (slug `prestadores`, mismo project
  ref).

**Consecuencia práctica**: `20260806180000_sacar_prestadores.sql` no es un "por-las-dudas" sobre
una migración hipotética — es una reversión real de un estado ya productivo, con datos reales que
se van a borrar el día que Enzo la aplique. Se agregó una nota de corrección en `CHANGES.md` junto
al texto original (sin borrar el texto original — es historia real de lo que se creyó en su
momento), y el `proposal.md` de este change documenta el hallazgo en su sección de Impact.

## D4 — Paso 2 del wizard: dos campos de texto libre, sin validación de formato

`PrestadorSelector` (un `<Select>` poblado por repository) se reemplaza por dos `<Field>`/`<Input>`
de texto libre ("Nombre", "Domicilio") — mismo patrón que el resto de los campos de texto libre de
`FacturaForm.tsx` (ver `FacturaFormDatosBasicos.tsx`, campo "Prestación" como referencia directa:
mismo `Field`/`Input` del design system, mismo `set()` genérico). Sin validación de formato más
allá de "no vacío" (cubierto por `faltaCompletarPrestador`, D2) — no hay entidad de negocio detrás
que valide CUIT, razón social, etc.; es dato de texto libre cargado a mano por factura, tal como
Enzo lo pidió. Viven en `Factura` como campos flat opcionales (`prestadorNombre?`/
`prestadorDomicilio?`), mismo estilo que el resto de `factura.ts` (nunca un objeto anidado — el
propio tipo ya usa ese criterio para `pacienteId`/`domicilioId`, aunque ahí sea referencia y acá
sea texto: la consistencia es "flat", no "por referencia").

## D5 — Qué NO cambia

- El resto del wizard (Paso 1 — Paciente, Paso 3 — el resto de los campos): sin cambios de
  estructura, solo se les quita la dependencia de `Prestador` donde la tenían indirectamente
  (`tipoComprobanteBloqueado` ya no llega como prop a `FacturaFormEconomicos.tsx`).
  `renderDescripcionFactura`/`construirDatosDescripcion`: sin cambios — nunca dependieron de
  `Prestador`.
- El circuito de estados de Factura, cupo, cobros, impresión, documentos: sin cambios — ninguno de
  estos leía nada de `Prestador`.
- Las columnas vestigiales `plazo_cobro_dias`/`tipo_comprobante` de `obra_social.obra_social`: ver
  D1, fuera de scope explícito.
- `facturacion.tipo_factura` (enum compartido, usado también por `factura.tipo` real): la
  migración de este change dropea las TABLAS `obra_social.prestadores`/
  `obra_social.obra_social_prestador`, nunca el enum — está compartido y otras tablas dependen de
  él.
- `openspec/changes/prestadores-crud/` y `openspec/changes/factura-por-prestador/`: quedan tal
  cual están, como registro histórico. Este change no las edita ni las archiva — documentan lo que
  se construyó, en su momento, aunque hoy se remueva.
