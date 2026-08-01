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

## Insumos pendientes del cliente

- Logo (árbol de discapacidad) y colores de marca; fondo de pantalla de referencia.
- Planillas/Excel actuales con las columnas de datos (pueden venir sin datos de pacientes).
- Ejemplos de formato de facturación por obra social.
- Checklists de documentación de otras obras sociales, además de OSECAC.
- Hoja de recorrido actual y ejemplo de recorrido de un paciente en Google Maps.
- Video/pantallazo de cómo está organizada hoy la información (carpetas y PDF).

## Nota de proceso

Este documento (DRF v1.3) está en estado "en validación" al momento de generar esta KB (ver control de versiones, sección 0). Cualquier respuesta del cliente a los puntos de arriba probablemente derive en una v1.4 del DRF — conviene re-sincronizar esta base de conocimiento cuando eso ocurra.
