# Flujos Principales

## Flujo 1: Alta de paciente y asignación de obra social

**Disparador**: Ingreso de un nuevo paciente al servicio.
**Actor**: Operadora o administradora.

**Pasos**:
1. Operadora crea la ficha del paciente (datos personales, clínicos, CUD, accesorio de movilidad).
2. Operadora asocia al paciente su obra social; el sistema adapta el campo de identificador de afiliado según la obra social elegida.
3. Operadora carga las direcciones habituales (domicilio, escuela, terapias, CET), definiendo ida y vuelta de forma independiente.
4. Operadora registra personas a cargo y teléfono alternativo.
5. Operadora adjunta la documentación exigida por el checklist de esa obra social (DNI, CUD, CODEM, RHC, etc.).
6. Facturación carga el presupuesto anual para ese paciente/prestación y, al recibirla, la autorización de la obra social.

**Casos de error**:
- Obra social sin checklist configurado → bloquear la carga de documentación hasta configurarlo (Épica 4, US-300).
- Autorización cargada mayor al presupuesto → el sistema debe rechazar o alertar (RN-PA-01).

## Flujo 2: Armado de la hoja de ruta diaria

**Disparador**: Inicio de la jornada operativa (administradora u operadora arma el día).
**Actor**: Administradora u operadora.

**Pasos**:
1. Se cargan los viajes/traslados del día (aprox. 8:00-20:00).
2. El sistema agrupa pasajeros por vehículo/conductor según capacidad y compatibilidad de accesorios (RN-VE-01).
3. El sistema sugiere un orden de recogida por cercanía (Google Maps/Geometry), como propuesta editable.
4. El operador ajusta manualmente el orden, agrega o quita pasajeros, y resuelve cancelaciones o cambios de horario.
5. Se agregan notas al pie si hace falta aclarar combinaciones entre pasajeros.
6. Administradora revisa la vista global del día para detectar conflictos (vehículo/conductor fuera de servicio) y reasigna si es necesario.
7. Se imprime o exporta la hoja de ruta y se entrega al conductor (papel o WhatsApp).

**Casos de error**:
- Vehículo fuera de servicio asignado a un recorrido → excluir del listado de vehículos disponibles (RN-VE-02).
- Paciente con accesorio incompatible con el vehículo asignado → bloquear la asignación (RF-502).

## Flujo 3: Ciclo de facturación y cobro

**Disparador**: Cierre de mes o acumulación de prestaciones a facturar.
**Actor**: Facturación (remoto).

**Pasos**:
1. Facturación revisa las asistencias/prestaciones declaradas del período por paciente.
2. Se genera la descripción de factura según la plantilla configurada para la obra social del paciente (RF-400).
3. Se cargan manualmente cantidad de días y valor del km (nomenclador).
4. El sistema valida contra el cupo autorizado y alerta si se supera (RN-FA-02).
5. Se excluyen feriados (salvo excepciones de sábado según prestación).
6. Se emite la factura (tipo de comprobante según obra social) y se adjunta la documentación de respaldo (comprobante ARCA, asistencia, CODEM).
7. El sistema calcula la fecha estimada de cobro (90 días por defecto, o 45 si hay amparo judicial).
8. Se registran cobros o pagos parciales a medida que ingresan.
9. Si se supera el plazo esperado (ej. 60 días), el sistema alerta para hacer seguimiento ante la Superintendencia.
10. Se imprime/exporta la factura y asistencia para subir al portal de la obra social o enviar por mail.

**Casos de error**:
- Días/km facturados exceden lo autorizado → alerta antes de confirmar (RF-402).
- Factura vencida sin cobro registrado → alerta de cobro vencido (RF-406).

## Flujo 4: Mantenimiento y habilitación de vehículos

**Disparador**: Vencimiento próximo de VTV/RTO, o alcance de kilometraje de mantenimiento preventivo.
**Actor**: Administradora.

**Pasos**:
1. El sistema alerta por proximidad de cambio de aceite/filtros (10.000 km o 2-3 meses) o vencimiento de VTV (6 meses)/RTO.
2. Administradora actualiza kilometraje manualmente (con alerta intermedia a los 5.000 km).
3. Se realiza el mantenimiento o la habilitación correspondiente y se registra en el historial (preventivo o correctivo).
4. Se adjunta documentación actualizada (VTV, RTO, seguro).
5. Si el vehículo queda inhabilitado durante el proceso, se marca "fuera de servicio" y queda excluido de las hojas de ruta hasta reactivarlo.

**Casos de error**:
- Vehículo sin VTV/RTO vigente sigue apareciendo como disponible → debe excluirse automáticamente de la hoja de ruta (RN-VE-02, RN-VE-04).
