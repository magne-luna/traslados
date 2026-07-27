# Preguntas Abiertas

Extraídas literalmente de la sección 10 ("Supuestos y puntos a confirmar") y sección 11 ("Insumos pendientes del cliente") del DRF v1.3, más una inconsistencia detectada durante la generación de esta KB.

## Inconsistencias detectadas

### IN-01 — Identificador de paciente en la factura vs. identificador de afiliado en la ficha
**Documento A dice** (RF-106, ficha de paciente): el identificador de afiliado varía según la obra social (documento, alfanumérico, o CUIL del titular con sufijo).
**Documento B dice** (RF-400, sección 10): en la factura se debe confirmar si el identificador a usar es el DNI o el número de afiliado — no necesariamente el mismo campo que RF-106.
**Impacto**: si no se alinean ambos campos, la plantilla de factura por obra social podría generar un identificador distinto al que realmente pide cada entidad pagadora.
**Resolución propuesta**: definir explícitamente, por obra social, qué campo de la ficha del paciente alimenta el identificador de la factura (podría no ser el mismo para todas las obras sociales).

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

## Insumos pendientes del cliente

- Logo (árbol de discapacidad) y colores de marca; fondo de pantalla de referencia.
- Planillas/Excel actuales con las columnas de datos (pueden venir sin datos de pacientes).
- Ejemplos de formato de facturación por obra social.
- Checklists de documentación de otras obras sociales, además de OSECAC.
- Hoja de recorrido actual y ejemplo de recorrido de un paciente en Google Maps.
- Video/pantallazo de cómo está organizada hoy la información (carpetas y PDF).

## Nota de proceso

Este documento (DRF v1.3) está en estado "en validación" al momento de generar esta KB (ver control de versiones, sección 0). Cualquier respuesta del cliente a los puntos de arriba probablemente derive en una v1.4 del DRF — conviene re-sincronizar esta base de conocimiento cuando eso ocurra.
