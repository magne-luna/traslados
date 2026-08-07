# Funcionalidades

Organizadas por épica (= módulo del DRF) y luego por historia de usuario (US-NNN). Los IDs `RF-XXX` del documento original se listan como reglas relacionadas para trazabilidad completa.

## Épica 1: Gestión de usuarios, permisos y auditoría

### US-001 — Crear y administrar cuentas de usuario
**Como** administradora
**Quiero** crear cuentas con email y contraseña para el personal
**Para** que cada persona tenga acceso individual al sistema

**Criterios de aceptación**:
- [ ] Se puede crear una cuenta con email y contraseña.
- [ ] Se puede asignar a cada cuenta acceso individual a los módulos que corresponda, sin roles predefinidos.
- [ ] Se registra en auditoría quién creó, modificó o eliminó qué y cuándo.
- [ ] (Deseable) Se registra hora de ingreso/egreso por cuenta.
- [ ] El acceso remoto simultáneo desde distintas ubicaciones funciona sin conflictos.

**Reglas relacionadas**: RF-001 a RF-005, RN-GL-01, RN-GL-02

## Épica 2: Pacientes y fichas clínicas

### US-100 — Alta y edición de ficha de paciente
**Como** operadora o administradora
**Quiero** crear y editar la ficha de un paciente
**Para** tener toda su información centralizada

**Criterios de aceptación**:
- [ ] Se cargan datos personales (apellido(s), nombre(s), fecha de nacimiento, DNI, CUIL del titular, domicilio).
- [ ] Se cargan datos clínicos (diagnóstico y condición) y accesorios de movilidad.
- [ ] Se registra el CUD (número, emisión, vencimiento) con alerta de vencimiento próximo.
- [ ] Se asocia el paciente a su obra social, adaptando el identificador de afiliado según corresponda.
- [ ] Se registran una o más personas a cargo (nombre, apellido, DNI) y un teléfono alternativo.
- [ ] Se registran destinos habituales (escuela, terapias, centro educativo terapéutico) con días y horarios.
- [ ] Se puede consultar el historial de traslados del paciente.

**Reglas relacionadas**: RF-100 a RF-111, RN-ID-02

### US-101 — Direcciones múltiples e independientes por tramo
**Como** operadora
**Quiero** registrar más de una dirección por paciente, con ida y vuelta independientes
**Para** reflejar la realidad de traslados donde el regreso no es el mismo trayecto que la ida

**Criterios de aceptación**:
- [ ] Se pueden registrar múltiples direcciones (domicilio, escuela, terapias, CET).
- [ ] La dirección de ida y la de vuelta se modelan como datos independientes, sin asumir que la vuelta es el trayecto inverso.

**Reglas relacionadas**: RF-113, RF-708, RN-HR-02

### US-102 — Documentación del paciente y amparo judicial
**Como** operadora
**Quiero** adjuntar la documentación requerida por la obra social y marcar si hay amparo judicial
**Para** tener todo el respaldo necesario para facturar sin demoras

**Criterios de aceptación**:
- [ ] Se pueden adjuntar imágenes/PDF según el checklist de documentación de la obra social del paciente.
- [ ] Los documentos se organizan por paciente.
- [ ] Se puede marcar si la cobertura está respaldada por un amparo judicial, con campo de aclaración.
- [x] El checklist documental admite múltiples documentos por tipo (sin tope), sin sobrescribir el anterior al cargar uno nuevo — el vigente se distingue del resto (RN-FA-09, `pacientes-documentos-multiples`, 2026-08-06).
- [x] El checklist documental se instancia por actividad del paciente (escuela, terapia(s), club — no el domicilio), no una sola vez por paciente; los documentos de una actividad no se filtran a otra, y la documentación sin actividad asociada se conserva en un bloque general aparte (RN-FA-10, `documentos-checklist-por-actividad`, 2026-08-07).

**Reglas relacionadas**: RF-112, RF-114, RN-FA-04, RN-FA-09, RN-FA-10

## Épica 3: Presupuestos y autorizaciones

### US-200 — Registrar presupuesto y autorización por paciente/prestación
**Como** facturación
**Quiero** cargar el presupuesto anual y la autorización recibida de la obra social
**Para** controlar cuánto se puede facturar por paciente y por mes

**Criterios de aceptación**:
- [ ] Se carga el presupuesto anual presentado por paciente/prestación.
- [ ] Se carga la autorización, que puede ser igual o menor al presupuesto (nunca mayor), con cupo de días y/o km por mes.
- [ ] Se manejan los estados: pendiente, autorizada, judicializada, rechazada.
- [ ] Se permite carga retroactiva de autorizaciones con vigencia anterior a la fecha de carga.
- [ ] Se adjunta la documentación del presupuesto enviado y la autorización recibida.

**Reglas relacionadas**: RF-200 a RF-205, RN-PA-01, RN-PA-02, RN-PA-03

## Épica 4: Obras sociales y prestadores

### US-300 — Configurar obra social y su checklist de documentación
**Como** administradora o facturación
**Quiero** dar de alta una obra social con sus condiciones y checklist propio
**Para** que cada factura y ficha respete lo que exige esa obra social puntual

**Criterios de aceptación**:
- [ ] Se puede cargar y administrar obras sociales/prestadores.
- [ ] Se registra plazo de cobro, tipo de comprobante (A/B/C) y demás condiciones particulares por prestador.
- [ ] Se define una plantilla de descripción de factura por obra social, con los datos complementarios que cada una pida.
- [ ] Se registra el CUIT de la empresa prestadora, separado del CUIL del titular del paciente.
- [ ] Se configura si la obra social requiere factura por prestación o factura general con detalle de días.
- [ ] Se configura el checklist de documentación requerido por obra social (respetando orden e ítems tal como los exige cada una).
- [ ] Se configura si la obra social admite pagos parciales o por lote.

**Reglas relacionadas**: RF-300 a RF-306, RN-ID-01, RN-FA-07, RN-FA-08

## Épica 5: Facturación, asistencias y cobros

### US-400 — Generar factura según plantilla de la obra social
**Como** facturación
**Quiero** armar la descripción de la factura según la plantilla de cada obra social
**Para** evitar rechazos por formato incorrecto

**Criterios de aceptación**:
- [ ] La descripción incluye: traslado especial a [paciente], identificador (DNI/afiliado), domicilio, prestación, mes y año, cantidad de días, dependencia y retorno, valor del km, cantidad de km y total.
- [ ] La cantidad de días y el valor del km se cargan manualmente (no se automatizan).
- [ ] Al facturar, si los días/km superan lo autorizado, el sistema alerta antes de continuar.
- [ ] Los feriados no se facturan (salvo ciertos sábados, según la prestación).
- [ ] Se manejan los estados: a facturar/pendiente, facturado, cobrado, pagado parcialmente.
- [ ] Al pasar a "facturado" se calcula la fecha estimada de cobro (90 días por defecto; 45 días si hay amparo judicial, desde la fecha de factura).
- [ ] Se alerta cuando una factura supera el plazo esperado de cobro (ej. 60 días) para revisar su estado en la Superintendencia.
- [ ] Se registran cobros y pagos parciales asociados a una o varias facturas.
- [ ] Las prestaciones/asistencias declaradas se facturan íntegramente; el recorrido efectivo diario es independiente y no se deriva de ellas.
- [ ] Se adjunta por factura: comprobante (ARCA), asistencia, CODEM y demás documentación de respaldo.
- [ ] Se puede imprimir/exportar la factura y su asistencia para subirlas al portal o enviarlas por mail a la obra social.

**Reglas relacionadas**: RF-400 a RF-411, RN-FA-01 a RN-FA-08

## Épica 6: Vehículos y mantenimiento

### US-500 — Alta de vehículo con capacidad y compatibilidad
**Como** administradora
**Quiero** registrar cada vehículo con su capacidad y accesorios compatibles
**Para** evitar asignar pacientes a un vehículo incompatible

**Criterios de aceptación**:
- [ ] Se cargan datos del vehículo (patente, modelo, tipo) y su capacidad (hasta 6 pasajeros).
- [ ] Se registra qué accesorios de movilidad admite cada vehículo.
- [ ] El sistema impide asignar un paciente a un vehículo incompatible con su accesorio.
- [ ] Se puede marcar un vehículo como fuera de servicio, excluyéndolo de las hojas de ruta mientras dure.
- [ ] Se configuran alertas de mantenimiento preventivo (cada 10.000 km o 2-3 meses) y de habilitaciones VTV (cada 6 meses) y RTO, quedando ambas registrables de forma independiente.
- [ ] El kilometraje se actualiza manualmente, con alerta intermedia a los 5.000 km y recordatorio periódico.
- [ ] Se registra un historial de mantenimiento correctivo (alternador, batería, frenos, embrague, cubiertas, etc.).
- [ ] Se adjunta documentación del vehículo (cédula, VTV, RTO, seguro, fotos).
- [ ] Se registra una tabla de gastos del vehículo, como evento con fecha y monto, sin frecuencia fija.

**Reglas relacionadas**: RF-500 a RF-508, RN-VE-01 a RN-VE-04

## Épica 7: Conductores

### US-600 — Alta de conductor y asignación semanal
**Como** administradora
**Quiero** registrar a los conductores y asignarles un vehículo por semana
**Para** planificar la operación sin darles acceso al sistema

**Criterios de aceptación**:
- [ ] Se cargan los conductores con sus datos, sin generar acceso al sistema.
- [ ] Se asigna vehículo por conductor, por semana.
- [ ] Se registran restricciones de perfil (ej. conductores que no trasladan pacientes con carga física por su edad).
- [ ] Se adjunta documentación del conductor (licencia de conducir, etc.).

**Reglas relacionadas**: RF-600 a RF-603, RN-GL-03

## Épica 8: Hojas de ruta y recorridos

### US-700 — Armado y edición de la hoja de ruta diaria
**Como** administradora u operadora
**Quiero** armar la hoja de ruta del día agrupando pasajeros por vehículo/conductor
**Para** organizar los traslados diarios sin perder flexibilidad de edición manual

**Criterios de aceptación**:
- [ ] Se cargan los viajes del día (aprox. 8:00-20:00), agrupados por vehículo/conductor según capacidad, combinando traslados.
- [ ] Se sugiere el orden de recogida por cercanía (geolocalización), como propuesta editable — no impone la ruta.
- [ ] Se pueden modificar recorridos individuales (agregar/quitar pasajero, ajustar por cancelaciones o cambios de horario) y el resto se reacomoda.
- [ ] Se pueden agregar notas al pie con aclaraciones o detalles (ej. combinaciones entre pasajeros).
- [ ] Se puede ver la vista global de todos los recorridos del día, para reasignar ante imprevistos (vehículo/conductor fuera de servicio).
- [ ] Al armar la hoja de ruta solo se consideran vehículos habilitados.
- [ ] Se puede imprimir o exportar la hoja de ruta para entregarla al conductor (papel o WhatsApp).
- [ ] Se pueden agregar recorridos manuales sin frecuencia fija ni turno asignado (traslados puntuales, ej. hospitales), sin generarse automáticamente desde una agenda.
- [ ] La dirección de ida y de vuelta se contemplan como datos independientes por tramo, verificables en cada traslado.

**Reglas relacionadas**: RF-700 a RF-708, RN-HR-01, RN-HR-02, RN-HR-03

## Épica 9: Panel principal (dashboard) y reportes

### US-800 — Panel de indicadores clave
**Como** administradora
**Quiero** ver de forma inmediata los recorridos del día y los indicadores clave
**Para** priorizar la información al iniciar la jornada

**Criterios de aceptación**:
- [ ] Se muestra de forma inmediata la hoja de ruta/recorridos del día.
- [ ] Se muestran tarjetas de resumen: facturas en mora, CUD por vencer, alertas de mantenimiento, etc.
- [ ] Se muestra la diferencia entre lo facturado y lo cobrado en un período configurable (últimos 3, 6 o 12 meses).
- [ ] Se genera un resumen anual por período que resuma facturación y cobros, para facilitar el cierre y la preparación de ganancias.

**Reglas relacionadas**: RF-800 a RF-803

## Épica 10: Gestión documental (transversal)

### US-900 — Carga y organización de documentos por entidad
**Como** cualquier usuario con permiso
**Quiero** adjuntar y consultar documentos organizados por entidad
**Para** tener acceso rápido a lo que hace falta presentar ante la obra social

**Criterios de aceptación**:
- [ ] Se pueden adjuntar imágenes y PDF en los módulos Pacientes, Vehículos, Conductores y Facturas.
- [ ] Se pueden consultar y descargar los documentos adjuntos cuando haga falta presentarlos.
- [ ] Los documentos se mantienen asociados a su registro (paciente, vehículo, conductor o factura) para acceso rápido.

**Reglas relacionadas**: RF-900 a RF-902
