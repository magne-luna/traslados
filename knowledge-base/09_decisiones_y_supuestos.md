# Decisiones y Supuestos

## Decisiones documentadas

### DD-01 — Stack: React + TypeScript + Supabase
**Decisión**: Construir el frontend en React + TypeScript, con backend/base de datos/storage en Supabase (PostgreSQL).
**Contexto**: El cliente no tiene servidor propio ni quiere gestionar instalación; necesita una app web accesible desde cualquier dispositivo.
**Alternativas consideradas**: No se detallan alternativas evaluadas en el DRF; se documenta como propuesta directa del estudio (v1.3, sección 12).
**Justificación**: Tecnologías modernas y probadas por el estudio, con despliegue web sin necesidad de instalación ni servidor propio del lado del cliente.
**Trade-offs aceptados**: Dependencia de un proveedor externo (Supabase) para auth, base de datos y storage.

### DD-02 — Sin roles fijos, permisos flexibles por módulo
**Decisión**: El sistema no implementa roles predefinidos (admin/operador/facturación como roles cerrados); cada cuenta recibe acceso configurable módulo por módulo.
**Contexto**: El equipo es chico (Andrea, Ariana, Diana, Romina) y las responsabilidades pueden variar o superponerse.
**Alternativas consideradas**: RBAC clásico con roles fijos (implícitamente descartado por el cliente, según DRF sección 3: "El sistema no maneja roles fijos").
**Justificación**: Mayor flexibilidad operativa para un equipo pequeño donde los permisos pueden necesitar ajustarse caso a caso.
**Trade-offs aceptados**: Mayor complejidad de UI para administrar permisos granulares; menor "guardrail" por defecto que un RBAC con roles predefinidos.

### DD-03 — El sistema sugiere, no impone, el orden de la hoja de ruta
**Decisión**: La geolocalización (Google Maps/Geometry) se usa solo para sugerir el orden de recogida por cercanía; la ruta final la decide siempre el operador humano.
**Contexto**: La administradora conoce las calles y ya decide el camino manualmente; automatizar el ruteo completo está fuera de alcance de la Fase 1.
**Alternativas consideradas**: Ruteo automático completo (explícitamente descartado, ver sección 9 del DRF).
**Justificación**: El conocimiento local del operador es más confiable que un algoritmo genérico para este caso de uso, al menos en la Fase 1.
**Trade-offs aceptados**: No hay optimización automática de rutas; el ahorro de tiempo depende de que la sugerencia sea un buen punto de partida editable.

### DD-04 — Facturación y recorrido efectivo son independientes
**Decisión**: El sistema no deriva ni valida el recorrido diario a partir del número de prestaciones facturadas.
**Contexto**: Un paciente puede tener 5 prestaciones semanales autorizadas pero concentrar 2 terapias en el mismo viaje.
**Alternativas consideradas**: Derivar el recorrido automáticamente desde las prestaciones facturadas (rechazado por no reflejar la operación real).
**Justificación**: Modelar ambos conceptos por separado evita inconsistencias entre lo que se cobra y lo que efectivamente se trasladó.
**Trade-offs aceptados**: Requiere que el operador cargue el recorrido y la factura de forma independiente, sin una única fuente de verdad automática.

## Supuestos inferidos

### SU-01 — CUIL identifica al titular, CUIT a la empresa
**Supuesto**: El CUIL corresponde siempre al titular de la obra social (padre/madre/tutor o la persona con discapacidad), y el CUIT identifica exclusivamente a la empresa prestadora; ambos campos nunca se unifican.
**Origen**: DRF v1.3, sección 4 (glosario) y sección 10 (supuestos y puntos a confirmar) — el propio documento marca esto como un supuesto a confirmar con el cliente.
**Riesgo si es falso**: Errores de facturación si se mezclan los identificadores fiscales de paciente y empresa.
**Cómo validar**: Confirmar explícitamente con Andrea Pastor antes de fijar el modelo de datos de Paciente y Factura.

### SU-02 — El checklist de OSECAC es representativo pero no único
**Supuesto**: El checklist de documentación detallado para OSECAC (RHC, prescripción, justificación, consentimiento, declaración de domicilio, mapa, presupuesto, CBU, habilitación, FIM) sirve como plantilla base, pero otras obras sociales tendrán checklists distintos que aún no se relevaron.
**Origen**: DRF v1.3, RF-305 y sección 11 (insumos pendientes: "Checklists de documentación de otras obras sociales, además del OSECAC").
**Riesgo si es falso**: El módulo de checklist configurable por obra social podría no cubrir variaciones reales de otras entidades.
**Cómo validar**: Solicitar al cliente los checklists de las demás obras sociales que atiende antes de cerrar el diseño del módulo.

### SU-03 — El sistema usa un plazo de cobro configurable con defaults de 90/60/45 días
**Supuesto**: Por defecto, el plazo de cobro general es 90 días, la alerta de cobro vencido dispara a los 60 días, y el amparo judicial reduce el plazo a 45 días — todos configurables.
**Origen**: DRF v1.3, RF-405, RF-406 y sección 10 ("Plazos por defecto: confirmar 90 días (cobro general), 60 días (alerta) y 45 días (amparo)").
**Riesgo si es falso**: Alertas de cobro mal calibradas, generando ruido o falta de seguimiento real.
**Cómo validar**: Confirmar los tres valores exactos con el cliente antes de fijarlos como default en el sistema.

### SU-04 — El identificador de paciente en la factura aún no está definido
**Supuesto**: Se usará el DNI o el número de afiliado del paciente en la descripción de la factura, pero el DRF no cierra cuál de los dos.
**Origen**: DRF v1.3, sección 10 ("Identificador del paciente en la factura: confirmar si es DNI o número de afiliado").
**Riesgo si es falso**: La plantilla de factura por obra social podría requerir cambios si se define incorrectamente en el MVP.
**Cómo validar**: Confirmar con el cliente antes de fijar la plantilla de facturación (RF-400, RF-302).
