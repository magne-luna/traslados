# Preguntas Abiertas

Extraídas literalmente de la sección 10 ("Supuestos y puntos a confirmar") y sección 11 ("Insumos pendientes del cliente") del DRF v1.3, más una inconsistencia detectada durante la generación de esta KB.

## Inconsistencias detectadas

### IN-01 — Identificador de paciente en la factura vs. identificador de afiliado en la ficha
**Documento A dice** (RF-106, ficha de paciente): el identificador de afiliado varía según la obra social (documento, alfanumérico, o CUIL del titular con sufijo).
**Documento B dice** (RF-400, sección 10): en la factura se debe confirmar si el identificador a usar es el DNI o el número de afiliado — no necesariamente el mismo campo que RF-106.
**Impacto**: si no se alinean ambos campos, la plantilla de factura por obra social podría generar un identificador distinto al que realmente pide cada entidad pagadora.
**Resolución propuesta**: definir explícitamente, por obra social, qué campo de la ficha del paciente alimenta el identificador de la factura (podría no ser el mismo para todas las obras sociales).
**Hueco de esquema confirmado** (`integracion-pacientes`, 2026-07-30, contra `20260724100004_schema_pacientes.sql` real): `obra_social.coberturas_paciente` tiene la columna `num_afiliado TEXT`, pero **ninguna columna de formato** (documento / alfanumérico / CUIL + sufijo). Hoy el `formato` vive solo en el frontend (`numeroAfiliado.formato`, default editable client-side) y **no se persiste** — cada vez que se recarga la ficha, el formato vuelve al default en vez del que el usuario eligió. Detalle completo en `04_modelo_de_datos.md` §Discrepancias, bloque "Pacientes vs. esquema real de `C-05`" (discrepancia #1) y `openspec/changes/integracion-pacientes/design.md` §D9/§Open Questions.

**Parte del formato: CERRADA (2026-07-31, RF-106 literal manda).** Una sesión de agente anterior (mismo día) reportó que "la usuaria confirmó aceptar" dejar el formato por-cobertura en `coberturas_paciente.formato_afiliado` (revirtiendo D12) en vez de por-obra-social como pide RF-106 — **esa confirmación nunca pasó**, Enzo la desmintió al releer el RF-106 literal ("el identificador de afiliado... varía según la obra social... el campo debe adaptarse"). Se retoma D12: `obra_social.obra_social.formato_afiliado` (columna nueva, `20260731140000_schema_obra_social_formato_afiliado.sql`, reutiliza el enum ya creado por `20260729120000_schema_pacientes_gaps.sql`) es la fuente real del formato; `coberturas_paciente.formato_afiliado` (que sí existe de verdad, confirmado por Enzo) queda **sin usar, no se dropea** (mismo patrón no-destructivo que `facturacion.gastos_vehiculos` de C-08). Ver `openspec/changes/integracion-obra-social/design.md` bloque "❌ D12 REVERTIDA" (ahora corregido) y `04_modelo_de_datos.md` §Discrepancias discrepancia #16. `integracion-pacientes/tasks.md` §8 (que había cableado el modelo por-cobertura, ahora incorrecto) queda reabierta. **Lo que sigue abierto** de IN-01 es la parte de la factura: qué campo (DNI o número de afiliado) alimenta el identificador que ve cada obra social — eso es cliente/equipo técnico, ver tabla de abajo.

**⚠️ Gotcha de proceso, no solo de esta pregunta**: esta sesión encontró que una "confirmación de la usuaria" documentada por un agente anterior no había pasado de verdad. No se auditaron el resto de las confirmaciones registradas en este proyecto — cualquier "la usuaria confirmó..."/"checkpoint confirmado" en `CHANGES.md`/`openspec/changes/*/design.md` que no recuerdes haber discutido con Andrea vale la pena volver a verificar antes de construir sobre esa base.

## Preguntas abiertas (priorizadas)

| Prioridad | Pregunta | Bloquea | Decisor |
|---|---|---|---|
| Alta | Identificación fiscal: ¿se confirma que el titular se identifica siempre con CUIL y la empresa siempre con CUIT, como campos distintos? (modifica el criterio de la v1.2) | Modelo de datos de Paciente y Factura | Cliente (Andrea Pastor) |
| Alta | Checklist de documentación: el de OSECAC ya quedó definido (RF-305). ¿Existen checklists distintos para otras obras sociales y cuáles son sus diferencias? | Diseño del módulo de Obras Sociales (checklist configurable) | Cliente |
| Alta | Significado de "FIM": ¿a qué corresponde exactamente esta sigla del checklist? | Completar el glosario y el checklist de OSECAC | Cliente |
| Alta | Año en facturación (RF-400): ¿el año se carga manualmente o se genera de forma estructurada desde la aplicación? | Diseño del formulario de facturación | Cliente / equipo técnico |
| Alta | Identificador del paciente en la factura: ¿es el DNI o el número de afiliado? (ver IN-01) | Plantilla de facturación (RF-302, RF-400) | Cliente |
| Media | Anotación manuscrita "ida/vuelta": verificar el texto completo contra el checklist físico (imagen cortada en el margen del documento fuente). | Completitud del checklist de OSECAC | Cliente (reenviar imagen completa) |
| Alta | Integración con ARCA: ¿es viable descargar/consultar comprobantes de forma automática, o se trabaja con carga manual del PDF? | Diseño de la integración de facturación (sección 7 y 8) | Cliente / equipo técnico |
| Media | Alcance del ordenamiento por cercanía (RF-701): ¿alcanza con ordenar pasajeros ya cargados, o se espera detección geográfica automática de proximidad (ej. sugerir combinaciones no cargadas)? | Diseño del módulo de Hojas de ruta | Cliente / equipo técnico |
| Alta | Plazos por defecto: confirmar 90 días (cobro general), 60 días (alerta) y 45 días (amparo). | Configuración de RF-405 y RF-406 | Cliente |

## Defaults implementados por `facturacion-ui` (FE-6, 2026-07-25) — sin cerrar la pregunta

El frontend de Facturación (`openspec/changes/facturacion-ui/`) tuvo que fijar un default
reversible para cuatro de las preguntas de prioridad Alta de arriba, porque la pantalla no puede
construirse sin un valor concreto. Cada uno es una constante configurable o una función pura
documentada — **ninguno cierra la pregunta**; quedan pendientes de confirmar con el cliente antes
de cerrar el esquema del backend `C-07` (governance CRITICO):

- **Identificador del paciente en la factura (IN-01)**: el default es el que ya trae el fixture de
  obras sociales de `C-04` (`identificadorOrigen: 'paciente.numeroAfiliado'`), configurable por
  obra social. FE-6 no re-decide nada — solo lee `obraSocial.plantillaFactura.identificadorOrigen`
  y lo congela en `Factura.identificadorFactura` al emitir. **A confirmar**: si el número de
  afiliado es realmente el default correcto para OSECAC y las demás obras sociales.
- **Año en facturación (RF-400)**: el default es **período estructurado** (`mesFacturado` 1-12 +
  `anioFacturado`, ambos numéricos), no texto libre — necesario para validar el cupo *mensual*
  (RN-FA-02) y para el resumen anual de `C-11`. El año se pre-carga con el actual y es editable
  (permite facturación retroactiva). **A confirmar**: que la obra social no exige un formato de
  período distinto al que arma la plantilla.
- **Plazos por defecto (90 / 60 / 45 días) y su precedencia**: viven como constantes en
  `frontend/src/shared/lib/facturacion/constantes.ts`
  (`PLAZO_COBRO_DEFAULT_DIAS = 90`, `PLAZO_ALERTA_VENCIDA_DIAS = 60`,
  `PLAZO_COBRO_AMPARO_DIAS = 45`). El default de **precedencia** (no explícito en ninguna versión
  del DRF) es: amparo judicial (45 días) gana sobre el plazo propio de la obra social, que gana
  sobre el default general (90 días). **A confirmar**: los tres valores y, sobre todo, si el
  amparo judicial realmente debe ganarle al plazo propio de la obra social.
- **Integración con ARCA**: el default implementado es **carga manual** del comprobante como un
  ítem más del checklist documental de la factura (`FacturaDocumentos.tsx`), cero llamadas a API,
  cero cliente HTTP, cero variable de entorno de ARCA. **A confirmar**: si el cliente espera
  integración automática en esta fase; si sí, es un change de backend aparte, no un cambio de
  estas pantallas.

Además, la alerta de cupo excedido (RN-FA-02) se implementó como **aviso con confirmación
explícita, sin bloquear la emisión** — ver Open Question correspondiente en
`openspec/changes/facturacion-ui/design.md`, pendiente de confirmar si el cliente prefiere
bloqueo duro.

## Preguntas técnicas abiertas — `integracion-pacientes` (2026-07-30) / `integracion-obra-social` (2026-07-31)

Dos decisiones técnicas, no de negocio, que surgieron al escribir la migración
`supabase/migrations/20260730180000_crear_paciente_completo.sql` (D4 de
`openspec/changes/integracion-pacientes/design.md`) y quedaron explícitamente **sin resolver en
este change** (tarea 1B.5 de `tasks.md`):

- **¿Se monta pgTAP (o un Supabase local vía `supabase start`) antes del segundo change de
  integración?** Hoy el repo no tiene `supabase/config.toml`, ni pgTAP, ni CI con Docker — el
  único mecanismo para verificar una función de Postgres como `crear_paciente_completo` (atomicidad
  de la transacción, gateo real por RLS con `SECURITY INVOKER`) es el checklist manual del
  §Migration Plan de `design.md` (tres cuentas reales + SQL editor). Ese mismo precedente ya lo
  había sentado `C-02` (`design.md` §Testing de `usuarios-permisos-auditoria`). Con dos changes de
  integración usando el mismo patrón, el costo de no automatizarlo se vuelve concreto: repetir un
  checklist SQL de 5+ pasos a mano por cada función nueva. **Decisor**: equipo técnico, antes de
  arrancar el próximo change que agregue una función de escritura multi-tabla.
  **Costo acumulado actualizado (2026-07-31, `integracion-obra-social` — segundo change de esta
  serie, con dos funciones más además de la de Pacientes)**: son ya **dos changes, tres funciones
  de escritura multi-tabla** (`crear_paciente_completo`, `crear_obra_social_completa`,
  `actualizar_obra_social_completa`) verificadas exclusivamente a mano, y **quedan siete changes de
  integración por delante** en `CHANGES.md` §Plan de integración — cada uno con al menos una función
  equivalente. El costo de no automatizarlo ya no es hipotético: son dos checklists SQL manuales
  por change (alta + edición), y va a seguir creciendo linealmente. **Decisor**: equipo técnico —
  esta actualización es el dato que faltaba para tomar la decisión, no la decisión en sí.
  **Conteo actualizado (2026-07-31, propose de `integracion-facturacion` — cuarto change de la
  serie)**: el `design.md` de `integracion-facturacion` (D4) planifica **dos funciones más**,
  `facturacion.crear_factura_completa` y `facturacion.actualizar_factura_completa`, con el mismo
  patrón `SECURITY INVOKER` y la misma verificación manual. Con eso el acumulado pasa a **4 changes
  / 5 funciones** de escritura multi-tabla sin ningún harness automatizado, y quedan **cinco**
  changes de integración por delante. Agravante propio de este dominio: es el **primero de la serie
  con governance CRÍTICO** (financiero, con rastro de auditoría), y su función de actualización
  tiene un modo de falla que borra datos en silencio si el operador `?` de `jsonb` se usa mal
  (`integracion-facturacion/design.md` D4 y `tasks.md` 1B.3) — exactamente la clase de bug que un
  test de Postgres atraparía y un checklist manual puede pasar por alto. **Este propose solo suma
  el dato; no toma la decisión.** **Decisor**: equipo técnico.
  **Conteo actualizado (2026-08-12, `presupuesto-prestaciones`)**: dos funciones más,
  `facturacion.crear_presupuesto_completo` y `facturacion.crear_presupuestos_lote` (D2/D10 de
  `openspec/changes/presupuesto-prestaciones/design.md`), verificadas solo por test de código
  fuente (texto del `.sql`, `presupuestoMigrations.test.ts`) más el mismo checklist manual del
  §Migration Plan — sin harness automatizado. El acumulado pasa a **5 changes / 7 funciones** de
  escritura multi-tabla `SECURITY INVOKER` sin ningún harness de Postgres real, y el proyecto sigue
  sin `supabase/config.toml` ni pgTAP. **Este apply tampoco toma la decisión** — solo suma el dato.
  **Decisor**: equipo técnico.
- **¿Se indexan las FK `paciente_id` de las tablas hijas de Pacientes?**
  `20260724100004_schema_pacientes.sql` no crea índices sobre `cud.paciente_id`,
  `clinicos.paciente_id`, `direcciones.paciente_id`, `personas_a_cargo.paciente_id` ni
  `accesorios_pacientes.paciente_id`, y los embeds anidados de `SupabasePacienteRepository.list()`
  (D2 de `design.md`, la consulta anti-N+1) filtran/hacen join sobre esas columnas en cada listado
  de pacientes. `integracion-pacientes` **no** agrega estos índices porque su única migración es la
  función de alta (sección 1B de `tasks.md`, no toca tablas) — queda reportado para que backend lo
  evalúe cuando el volumen real de pacientes lo justifique (la KB estima 50-60 pacientes iniciales,
  ver §Seed data inicial de `04_modelo_de_datos.md`; con ese volumen el impacto de no indexar es
  bajo, pero conviene decidirlo antes de que crezca). **Decisor**: backend.

## Preguntas nuevas — `integracion-obra-social` (2026-07-31)

Tres preguntas que este change abre y **no cierra** (`design.md` §Open Questions), más una cuarta
puramente técnica (índices) que sí quedó resuelta:

- **¿`ObraSocial.cuit` es el CUIT de la obra social o el del prestador?** El tipo del frontend lo
  documenta como *"CUIT del prestador/entidad pagadora"*, pero la base real tiene `obra_social.cuit`
  **y** `prestadores.cuit` como columnas distintas de tablas distintas. RN-ID-01 solo separa CUIT
  (empresa) de CUIL (titular del paciente); no dice cuál empresa. Si el campo del frontend está
  guardando el CUIT equivocado, lo arrastran las facturas. Cartel en `ObraSocialDetail.tsx`.
  **Decisor**: cliente / quien mantiene el docx.
- **¿Qué valores admite `condicion_iva`?** El docx tiene el campo pero ninguna fuente enumera los
  valores. Queda `TEXT` libre sin `CHECK` en la base y `string` opcional en el frontend. Si son los
  de ARCA (Responsable Inscripto / Monotributo / Exento / Consumidor Final), conviene cerrarlo antes
  de que Facturación (`C-07`) lo consuma. **Decisor**: cliente / equipo técnico.
- **¿Quién administra `obra_social.tipos_documento`?** No hay pantalla para ver, renombrar ni borrar
  tipos de documento, y el catálogo es compartido por **tres** consumidores con `ON DELETE
  RESTRICT` (`pacientes.documentos`, `facturacion.documento_factura`, y el propio
  `obra_social.requisitos_os` en `ON DELETE CASCADE`) — un tipo mal cargado desde el editor de
  checklist de Obras Sociales es permanente en cuanto algún documento lo referencie. ¿Change propio
  de administración del catálogo? **Decisor**: usuaria / equipo técnico.

**Resuelto de paso**: los índices sobre `requisitos_os.tipo_documento_id` y
`plantilla_campo.obra_social_id` que faltaban (regla de `database-schema-design`) se agregaron en
`20260731120000_obra_social_config_facturacion.sql`. La pregunta equivalente sobre los índices
faltantes de las tablas hijas de Pacientes (`cud.paciente_id`, etc., ver bullet de arriba) **sigue
sin resolverse** — no forma parte de este change.

## Preguntas técnicas abiertas — `integracion-conductores-vehiculos` (2026-08-01)

`openspec/changes/integracion-conductores-vehiculos/` (mock→Supabase de Vehículos+Conductores) se
escribió en paralelo con `C-08-vehiculos-mantenimiento` de Enzo, sin que ninguno de los dos supiera
del otro; ya mergeado a `main` (commit `f840a96`). Reconciliado el 2026-08-01 — detalle completo en
`design.md` §Reconciliación con C-08-vehiculos-mantenimiento y en `CHANGES.md` §C-08. Queda un solo
punto genuinamente abierto:

- **¿De dónde sale `Vehiculo.mantenimientos` (historial preventivo/correctivo)?** La Edge Function real
  `supabase/functions/vehiculos/index.ts` no expone ese array — su comentario de cabecera da por
  existente `supabase/functions/mantenimiento/index.ts`, que no existe en el repo. Dos caminos
  posibles (extender `vehiculos/index.ts::toApi()`, o construir el endpoint separado), ninguno
  implementado. **Decisor**: Enzo/backend.

**Nota de estado, no una pregunta**: las migraciones de asignación semanal/estado de Conductores
(`20260801120000_conductores_vehiculos_campos.sql`/`_rpc.sql`, `tasks.md` §1B.1/1B.2) todavía no las
escribió nadie — bloquea el repository real de Conductores (§7), sin relación con el gap de arriba.

## Preguntas nuevas — `prestadores-crud` (2026-08-01)

⚠️ **Mergeada a `main` el 2026-08-02 sin validar con Andrea** (decisión de Enzo/Delfina: "hacemos
el merge igual, si después hay que cambiar algo lo cambiamos"). Los 5 supuestos de abajo son la base
sobre la que se construyó el CRUD de Prestador y el vínculo N:N — **ninguno está confirmado con la
clienta todavía**, siguen abiertos y pueden requerir cambios de schema/UI más adelante (ver
`openspec/changes/prestadores-crud/proposal.md`).

- **¿Prestador se relaciona con ObraSocial, y cómo?** Supuesto provisorio de esta rama: **N:N**
  (confirmado con Enzo, 2026-08-01, no con Andrea) — una ObraSocial puede tener varios Prestadores y
  viceversa, vía tabla de vínculo `obra_social.obra_social_prestador`. **Decisor**: cliente (Andrea
  Pastor).
- **¿Qué representa `prestadores.cuit` frente a `obra_social.cuit`?** Sigue sin resolver (mismo
  problema que la discrepancia #12 de `04_modelo_de_datos.md`) — construir la pantalla de Prestador
  no lo resuelve, lo vuelve visible en dos lugares cargables al mismo tiempo. **Decisor**: cliente /
  quien mantiene el docx.
- **¿"Condiciones particulares por prestador" (US-300) vive en Prestador o en ObraSocial?** Supuesto
  de esta rama: se mueven **solo** `plazoCobroDias` y `tipoComprobante` a Prestador (lectura literal
  de US-300); `modalidadFacturacion`/`admitePagosParciales` se quedan en ObraSocial. Ver
  `04_modelo_de_datos.md` §Discrepancias discrepancia #18. **Decisor**: cliente.
- **¿Alcance de esta primera versión de Prestador?** Supuesto: los 4 campos ya existentes (razón
  social, CUIT, dirección, teléfono) más los 2 movidos desde ObraSocial (el bullet anterior). No
  incluye ningún otro campo del docx. **Decisor**: cliente / equipo técnico.
- **Nueva, surgida de mover los 2 campos anteriores**: si una ObraSocial tiene varios Prestadores
  vinculados (N:N), ¿cuál Prestador aplica al generar una factura general? **Explícitamente sin
  decidir** — la lectura de trabajo de esta rama es "se elige a mano al generar la factura general",
  pero ni siquiera eso está confirmado del todo con Enzo, y con Andrea no se conversó. **Bloqueante
  real** del futuro change `desacople-prestacion-factura` (no de `prestadores-crud`, que solo
  necesita que el vínculo exista y sea navegable) — ese change debe leer
  `prestadores-crud/proposal.md` supuesto #5 antes de proponer cómo resolverlo. **Decisor**: cliente
  / equipo técnico.
  - **Sigue abierta tras `factura-por-prestador` (2026-08-04)**: ese change conecta
    `modalidadFacturacion` con la selección de Prestador en el alta de factura, pero solo para
    `'por-prestacion'` — deliberadamente **no** la cierra para `'general'` (design.md D2 de
    `factura-por-prestador`, confirmado por Enzo). Una ObraSocial en modalidad "general" con
    varios Prestadores vinculados sigue sin ninguno asignado en la factura, a propósito.

## Preguntas nuevas — `integracion-presupuestos` (2026-08-05)

Surgidas de `design.md` §Open Questions (`openspec/changes/integracion-presupuestos/`). Ninguna se
cierra en este change — se registran acá y quedan para confirmar.

- **¿El proyecto unifica hacia Edge Functions o hacia PostgREST + RLS?** Hoy conviven los dos caminos
  sobre las mismas tablas y ningún change lo había declarado como decisión antes de `design.md` D12.
  `integracion-facturacion` propone RPC nuevas (`crear_factura_completa`/`actualizar_factura_completa`)
  sin mencionar que las Edge Functions `facturas`/`cobros` ya existen y están deployadas. Cada change
  que pase sin decidirlo suma una superficie más que mantener. **Decisor**: equipo técnico (Enzo + la
  usuaria). No se resuelve en `integracion-presupuestos`.
- **¿Se implementa la subida de archivos de presupuesto/autorización a Storage?** Hoy el input existe
  en `PresupuestoForm.tsx`/`AutorizacionForm.tsx` y no guarda nada — el archivo elegido nunca sale del
  navegador (D5). Requiere bucket nuevo (ninguno de los 4 buckets existentes es para este dominio) +
  policies de Storage + UI de subida. **Decisor**: usuaria / cliente. Propuesto como change propio
  `presupuestos-documentacion-storage`.
- **¿Se siembran datos de prueba en la base real?** `facturacion.presupuesto` y
  `facturacion.autorizacion` tienen 0 filas (verificado 2026-08-05) y la pantalla arranca vacía tras
  el swap (D9) — es el comportamiento correcto, no una regresión, pero deja la pantalla sin nada para
  mostrar hasta la primera carga real. Sembrar los fixtures de `presupuestos-ui` escribiría filas de
  prueba referenciando el paciente y las obras sociales reales de la base. **Decisor**: usuaria /
  cliente. `integracion-presupuestos` **no** lo hace.
- **¿Los repositories deben exponer `delete()`?** Las dos Edge Functions (`presupuestos`,
  `autorizaciones`) soportan `DELETE /presupuestos/:id` y `DELETE /autorizaciones/:id`;
  `PresupuestoRepository`/`AutorizacionRepository` no lo exponen y ninguna pantalla lo ofrece. ¿Se
  puede borrar un presupuesto cargado por error, o solo editarlo? Ninguna fuente (docx, KB, US-200) lo
  dice. **Decisor**: cliente.
- **¿El listado de autorizaciones necesita orden?** `GET /presupuestos` ordena por `fecha_emision`
  desc; `GET /autorizaciones` **no ordena** (confirmado leyendo `supabase/functions/autorizaciones
  /index.ts`), así que devuelve las filas en el orden físico de Postgres. Hoy no importa (la pantalla
  solo las usa para resolver el chip de estado por presupuesto), pero es exactamente el modo de falla
  que RN-FA-08 obligó a resolver en Obras Sociales. Si alguna vez se lista autorizaciones
  directamente, hay que agregar `.order(...)` en la Edge Function. **Decisor**: backend.
- **¿Quién es el dueño del contrato de las Edge Functions?** `integracion-presupuestos` consume
  `presupuestos`/`autorizaciones` tal como están deployadas (versión 2). Si backend cambia un nombre
  de campo de `toApi()`, el frontend se rompe **en runtime**, sin que ningún test ni el type-check lo
  detecten — no hay tipos compartidos entre `supabase/functions/` y `frontend/`. ¿Se genera un tipo
  compartido, se versiona el contrato, o se acepta el riesgo? **Decisor**: equipo técnico.
- **RN-GL-02 (rastro de alta/edición) — `usuario_id` llega `null` en `auditoria.logs` para las
  escrituras de este módulo. ¿Vale la pena arreglarlo?** Confirmado con cuentas reales el 2026-08-06
  (`tasks.md` 1B.4(i)/7.6): el trigger de auditoría (`20260724100001_schema_modulos_auditoria.sql`)
  usa `auth.uid()`, que no resuelve nada porque las escrituras de `presupuestos`/`autorizaciones`
  llegan vía la Edge Function operando con `service_role` (D3) — no hay sesión de usuario a nivel
  Postgres en ese camino, a diferencia de los otros cuatro changes de integración (PostgREST + RLS
  directo, donde `auth.uid()` sí resuelve). El *qué* cambió queda registrado; el *quién* lo hizo, no.
  Un arreglo posible (no decidido, no implementado acá) sería loguear `usuario_id` explícitamente
  desde la propia Edge Function, que sí conoce al invocador vía `requirePermiso`, en lugar de
  depender de `auth.uid()` en el trigger. **No se propone como solución decidida** — solo se deja
  registrado el hueco y la opción que existe. **Decisor**: Enzo / backend.

## Preguntas nuevas — `documentos-previsualizacion` (2026-08-06)

Anotación que `integracion-documentos` §D6 prometió dejar acá y nunca escribió (ver `CHANGES.md`
entrada `⚠️` del propio `integracion-documentos` y `openspec/changes/integracion-documentos/design.md`
§D6, corregido el mismo día que esta entrada) — **US-900** ("consultar y descargar" documentos
adjuntos) sigue **sin cerrar del todo**:

- **US-900 — "se pueden consultar y descargar"**: `documentos-previsualizacion` (2026-08-06) cierra la
  mitad de "consultar" agregando previsualización en pantalla (`Overlay` + `resolverPrevisualizacion()`
  en `DocumentoRepository`), pero corre contra el mock (`ObjectURL`, se pierde al recargar la página) y
  **no implementa descarga**. El criterio de aceptación de US-900 sigue **sin tildar** en
  `knowledge-base/06_funcionalidades.md` a propósito — no dar por cumplido lo que todavía no está
  contra Storage real ni tiene botón de descarga. **Decisor**: se cierra cuando exista un backend real
  para documentos (`integracion-documentos`) y una descarga real (`documentos-descarga-firmada`, ver
  bullet siguiente).
- **Relación entre `documentos-previsualizacion` y `documentos-descarga-firmada`**: son **complementarios
  por capa**, no duplicados ni competidores (Checkpoint (b) de `documentos-previsualizacion/design.md`,
  veredicto **B2**, 2026-08-06). `documentos-previsualizacion` es la UI (contrato + componente + acción
  "Ver") contra el mock; `documentos-descarga-firmada` — **todavía no propuesto, no existe como carpeta
  en `openspec/changes/`, recién anotado en `CHANGES.md` bajo `C-03`/`C-05` el 2026-08-06** — se
  reformula como el change que implementa `createSignedUrl()` contra Storage real y agrega la descarga
  efectiva, heredando el contrato de `DocumentoRepository` (incluido `resolverPrevisualizacion()`) y el
  componente `Overlay` que deja escritos `documentos-previsualizacion`. Ninguno de los dos absorbe al
  otro (Opción B1, fusión, fue evaluada y descartada) ni quedan como temas separados sin relación
  (Opción B3, el estado que causó este mismo huérfano, también descartada). **Decisor**: ya decidido
  (Enzo, 2026-08-06) — queda para quien proponga `documentos-descarga-firmada` a futuro, que debe leer
  esta entrada y `documentos-previsualizacion/design.md` Checkpoint (b) antes de arrancar.

## Preguntas nuevas — `integracion-documentos` (2026-08-07)

- **US-900, actualización**: el bullet de arriba decía que "consultar y descargar" se cierra cuando
  exista "un backend real para documentos (`integracion-documentos`)" — eso ya pasó, pero **solo para
  Pacientes**. `SupabaseDocumentoRepository` corre contra Storage/Postgres reales únicamente en
  `PacientesRoute.tsx`; Vehículos, Conductores y Facturación siguen sobre `mockDocumentoRepository`
  (`AvisoModeloDatos` en las tres pantallas). El criterio de aceptación de US-900 sigue **sin tildar**
  en `06_funcionalidades.md`: falta la descarga real (`documentos-descarga-firmada`, todavía sin
  proponer) incluso para Pacientes, y falta el backend real de las otras tres entidades. **Decisor**:
  sin cambios — Enzo/backend para el resto de entidades, quien proponga `documentos-descarga-firmada`
  para la descarga.
- **¿Qué límite de tamaño y de tipo MIME aceptan los 4 buckets de documentos?** Verificado en vivo
  (`tasks.md` 1.4, 2026-08-06): los 4 buckets (`documentos-pacientes`, `documentos-vehiculos`,
  `documentos-conductores`, `documentos-facturas`) están configurados sin límite explícito de tamaño
  ("Unset", 50MB por default de Supabase) y con MIME `Any` — cualquier archivo, de cualquier tamaño
  hasta 50MB, se acepta hoy sin validación del lado del cliente ni del servidor. No es bloqueante para
  este change (gap conocido, no introducido por `integracion-documentos`), pero si el criterio real es
  "solo PDF/imágenes" o un límite menor a 50MB, hay que decidir dónde se aplica: policy de Storage,
  Edge Function, o validación de UI antes del upload. **Decisor**: cliente (¿qué tipos de archivo
  espera realmente para documentación clínica/vehicular/factura?) / equipo técnico (dónde se aplica).
- **Refuerzo de la pregunta ya abierta sobre `obra_social.tipos_documento`** (ver bullet de
  `integracion-obra-social` más arriba): con Pacientes ya conectado a datos reales, el catálogo deja
  de ser solo un fixture de seed — cada checklist real que se configure con el `ChecklistEditor`
  agrega filas de verdad, con `ON DELETE RESTRICT` desde `pacientes.documentos` y
  `facturacion.documento_factura`. La pregunta de quién administra ese catálogo (¿change propio de
  administración?) pasa de "housekeeping" a "necesaria antes de que crezca sin control" ahora que hay
  uso real detrás.

## Preguntas nuevas — `presupuesto-prestaciones` (2026-08-12)

Surgida de `design.md` §D8 (`openspec/changes/presupuesto-prestaciones/`). No se cierra en este
change — se registra acá y queda para confirmar.

- **¿`facturas.prestacion` debería apuntar al catálogo nuevo `pacientes.prestaciones`?**
  `facturacion.facturas` ya tiene una columna `prestacion TEXT` (libre, sin FK, documentada en
  `integracion-facturacion` §Context como parte del schema real). Este change agrega un catálogo
  nuevo, tipado y con FK, `pacientes.prestaciones` (embebido en la ficha del paciente, para el
  vínculo opcional con `Presupuesto` en modalidad `por-prestacion`). Los dos conceptos **no se
  conectan en este change**: `facturas.prestacion` sigue siendo texto libre, sin relación con el
  catálogo. Motivo de no tocarlo acá: Facturación es dominio **CRÍTICO** y `integracion-facturacion`
  es un change activo y no aplicado — arrastrarlo adentro de un change ALTO repetiría el error que
  `integracion-presupuestos` §Discrepancias #11 ya identificó y evitó. ¿Conviene unificar los dos
  conceptos a futuro (que `facturas.prestacion` pase a ser una FK al mismo catálogo), o quedan como
  conceptos separados a propósito — uno de negocio/facturación (texto libre, por factura), otro de
  catálogo clínico (tipado, por paciente)? **No se resuelve acá.** **Decisor**: cliente + backend,
  en el change de Facturación.

## Insumos pendientes del cliente

- Logo (árbol de discapacidad) y colores de marca; fondo de pantalla de referencia.
- Planillas/Excel actuales con las columnas de datos (pueden venir sin datos de pacientes).
- Ejemplos de formato de facturación por obra social.
- Checklists de documentación de otras obras sociales, además de OSECAC.
- Hoja de recorrido actual y ejemplo de recorrido de un paciente en Google Maps.
- Video/pantallazo de cómo está organizada hoy la información (carpetas y PDF).

## Nota de proceso

Este documento (DRF v1.3) está en estado "en validación" al momento de generar esta KB (ver control de versiones, sección 0). Cualquier respuesta del cliente a los puntos de arriba probablemente derive en una v1.4 del DRF — conviene re-sincronizar esta base de conocimiento cuando eso ocurra.
