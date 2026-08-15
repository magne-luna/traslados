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
2. En el wizard de alta (`FacturaForm.tsx`), tras elegir el paciente (Paso 1), Facturación elige
   **una autorización pendiente de facturar** del paciente entre las que el sistema resuelve
   automáticamente (Paso 2 — change `facturacion-seleccion-autorizacion`, ya en producción):
   "pendiente" significa que la `Autorizacion` está en estado `autorizada` (no filtra por si ya
   tiene una factura del mismo mes — ver nota más abajo). Si el paciente no tiene ninguna
   autorización en ese estado, el sistema bloquea el avance y ofrece un link directo a Presupuestos
   para cargarla. La autorización elegida queda persistida en la factura (`autorizacionId`) y, en
   edición, se muestra de solo lectura — no se puede recambiar después del alta.
3. Si la autorización elegida es de modalidad `por-prestacion`, el campo "Prestación" de la factura
   **se deriva automáticamente** de esa autorización (mismo criterio que la etiqueta del selector) y
   queda bloqueado para edición manual; en modalidad `general` (o catálogo desactualizado) sigue
   siendo texto libre, sin cambios.
4. Se genera la descripción de factura según la plantilla configurada para la obra social del
   paciente (RF-400).
5. Se cargan manualmente cantidad de días y valor del km (nomenclador).
6. El sistema valida contra el cupo autorizado (días/km del mes) y alerta si se supera (RN-FA-02).
7. El sistema valida, además, el **monto acumulado del AÑO** contra `Autorizacion.montoAutorizado`
   de la autorización elegida: no compara el total de esta única factura mensual contra el monto
   autorizado, sino la suma de todas las facturas del año contra esa autorización (excluyendo la que
   se está editando) más la factura actual. Si no hay autorización elegida (facturas anteriores a
   este change) o la autorización no tiene monto cargado, no hay contra qué validar y el sistema lo
   informa sin bloquear.
8. Se excluyen feriados (salvo excepciones de sábado según prestación).
9. Se emite la factura (tipo de comprobante según obra social) y se adjunta la documentación de respaldo (comprobante ARCA, asistencia, CODEM).
10. El sistema calcula la fecha estimada de cobro (90 días por defecto, o 45 si hay amparo judicial).
11. Se registran cobros o pagos parciales a medida que ingresan.
12. Si se supera el plazo esperado (ej. 60 días), el sistema alerta para hacer seguimiento ante la Superintendencia.
13. Se imprime/exporta la factura y asistencia para subir al portal de la obra social o enviar por mail.

**Casos de error**:
- Paciente sin ninguna autorización en estado `autorizada` → bloquea el avance del wizard, con link a Presupuestos.
- Días/km facturados exceden lo autorizado → alerta antes de confirmar (RF-402).
- Monto acumulado del año (sumando la factura actual) excede `montoAutorizado` de la autorización elegida → alerta antes de confirmar (no bloquea la emisión).
- Factura vencida sin cobro registrado → alerta de cobro vencido (RF-406).

> **Nota (pregunta abierta)**: el sistema hoy **no impide ni detecta** elegir dos veces la misma
> autorización para facturar el mismo período — es un riesgo de negocio aceptado explícitamente, no
> un bug (ver `knowledge-base/10_preguntas_abiertas.md`, sección `facturacion-seleccion-autorizacion`).

### Ejemplos de uso

Dos casos ilustrativos del flujo completo, tal como los describió la usuaria — cubren el circuito
normal (Caso 1) y el circuito con amparo judicial + carga retroactiva (Caso 2).

#### Caso 1 — Juan Pérez, paciente de OSECAC (caso normal)

1. Autorización vigente: Juan tiene autorización de OSECAC para 2026, 20 días/mes, valor de km del
   nomenclador nacional (ej. $500/km).
2. Julio: se hicieron los traslados. 20 asistencias en julio (todos los días hábiles), 16 km por día
   (8km ida + 8km vuelta).
3. Armar la factura: la operadora carga días (20, a mano mirando la planilla) y km/día (16, a mano).
   El sistema arma la descripción según la plantilla de OSECAC: "Traslado especial a Juan Pérez, DNI
   12.345.678, domicilio [X], prestación julio 2026, 20 días, dependencia y retorno, valor km $500,
   16 km/día, total $160.000".
4. Control automático: 20 días autorizados, se facturan exactamente 20 → sin alerta. Si se hubieran
   cargado 22 por error, el sistema avisa antes de que la obra social rechace la factura.
5. Se emite y pasa a "facturado": con comprobante ARCA adjunto, fecha estimada de cobro = fecha de
   factura + 90 días.
6. Espera de cobro: si pasan 60 días sin cobrarse, alerta para que Facturación (Ariana) revise el
   estado en la Superintendencia de Salud.
7. Cobro: llega el pago (a veces parcial o por lote con otros pacientes), se registra manualmente →
   pasa a "cobrado".

> El texto "dependencia y retorno" de la descripción es el que da la usuaria tal cual — el campo
> existe en el modelo de datos (`04_modelo_de_datos.md`), pero su significado exacto (más allá de
> ser un dato sí/no por paciente) sigue como **pregunta abierta**; este ejemplo es solo ilustrativo
> de cómo queda la descripción final, no resuelve esa pregunta.

#### Caso 2 — María Gómez, paciente con OSDE, autorización judicializada (caso con amparo + carga retroactiva)

1. Situación inicial (fines de 2025): María necesita traslados desde octubre 2025. Se presenta el
   presupuesto a OSDE, pero no responde — trámite trabado.
2. Se inicia amparo judicial (RF-114): se marca en la ficha "cobertura respaldada por amparo
   judicial", con detalle del expediente.
3. Los traslados se hacen igual: octubre-diciembre 2025, María viaja sin autorización formal, se
   registran las asistencias mes a mes.
4. Recién en marzo 2026 llega la autorización: la justicia falla a favor, OSDE emite autorización
   con vigencia retroactiva desde octubre 2025 (RF-203, carga retroactiva). Cupo: 15 días/mes.
5. Ahora se puede facturar todo lo atrasado: la operadora factura octubre/noviembre/diciembre 2025
   recién en marzo 2026, cada una con 15 días × 12 km × el valor del km VIGENTE en ese período (no
   el de marzo 2026 — no hay ajuste retroactivo de valores ya facturados, RF-403). El campo "año" de
   la descripción (RF-400) es clave: distingue que son prestaciones de 2025 aunque se facturen en
   2026.
6. Plazo de cobro: 45 días (no 90), por tener amparo judicial activo (RF-405) — circuito más corto.
7. Alerta si se atrasa: a los 60 días sin cobrar, misma alerta de RF-406 que cualquier otra factura.

#### Conexión con la selección de autorización (detalle técnico de hoy)

Los dos casos de arriba se apoyan, desde el `facturacion-seleccion-autorizacion`, en el Paso 2 del
wizard descripto en el punto 2 de este flujo: para Juan Pérez, la operadora elige entre las
autorizaciones pendientes de OSECAC; para María Gómez, elige la autorización judicializada de OSDE
(vigencia retroactiva octubre 2025) al facturar cada uno de los tres meses atrasados en marzo 2026 —
las tres facturas (octubre, noviembre, diciembre 2025) apuntan a la **misma** autorización.
Justamente por eso la validación del monto autorizado (punto 7 de este flujo) es clave en el Caso 2:
compara el **acumulado anual** de las tres facturas contra esa única autorización, no cada factura
mensual por separado — corrección de negocio confirmada por la usuaria (`Autorizacion.montoAutorizado`
de OSECAC/OSDE es un tope **anual**, no mensual). Cuando la autorización elegida es de modalidad
`por-prestacion` (frecuente en autorizaciones judicializadas con una prestación puntual autorizada
por el amparo), la "Prestación" de cada una de las tres facturas de María se deriva automáticamente
de esa autorización, sin que la operadora tenga que tipearla en cada una.

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
