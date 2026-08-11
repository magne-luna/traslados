# Reglas de Negocio

Cada regla tiene un código único `RN-{DOMINIO}-{NN}` para trazabilidad. Extraídas del DRF v1.3 (secciones 4, 5 y 10).

## Dominio: Identificación fiscal (RN-ID)

- **RN-ID-01**: El CUIL identifica al titular de la obra social (padre/madre/tutor o la persona con discapacidad); el CUIT identifica a la empresa prestadora. Son campos distintos y **no deben unificarse** (supuesto a confirmar con el cliente, ver `10_preguntas_abiertas.md`).
- **RN-ID-02**: El identificador de afiliado en la ficha del paciente varía según la obra social (número de documento, alfanumérico, o CUIL del titular con sufijo /01, /02...) — el campo debe adaptarse por obra social (RF-106).

## Dominio: Presupuestos y autorizaciones (RN-PA)

- **RN-PA-01**: La autorización de la obra social puede coincidir con el presupuesto o ser menor; **nunca puede ser mayor** al presupuesto solicitado.
- **RN-PA-02**: Las autorizaciones pueden cargarse con vigencia retroactiva (ej. autorizada en abril, habilita facturar traslados de enero a marzo).
- **RN-PA-03**: El cupo mensual autorizado (días/km por mes) es la base para el control de facturación — no se puede facturar por encima de lo autorizado sin generar alerta (ver RN-FA-02).

## Dominio: Facturación y cobros (RN-FA)

- **RN-FA-01**: Las prestaciones/asistencias declaradas se facturan íntegramente (coinciden con lo facturado); el recorrido efectivo es independiente y no se deriva ni valida a partir del número de prestaciones declaradas — ej. un paciente con 5 prestaciones semanales puede concentrar 2 terapias en un mismo día.
- **RN-FA-02**: Al facturar, si los días/km superan lo autorizado para ese paciente, el sistema debe alertar (ej. "tenés autorizados 20, estás facturando 22") para evitar el rechazo y la demora posterior.
- **RN-FA-03**: Los feriados no se facturan; ciertos sábados sí se facturan, según la prestación (regla configurable, no uniforme).
- **RN-FA-04**: La fecha estimada de cobro se calcula según un plazo configurable (por defecto 90 días) desde la fecha de factura. Si el paciente tiene amparo judicial, el plazo por defecto es de 45 días, contados desde la fecha de factura (no desde la prestación ni la autorización).
- **RN-FA-05**: El valor del kilómetro (nomenclador nacional) lo fija el Estado, no la empresa, y se carga manualmente por el usuario — no se automatiza (fuera de alcance Fase 1).
- **RN-FA-06**: Los ajustes de valores de facturas ya emitidas no son retroactivos: se cobra al valor vigente a la fecha de facturación (fuera de alcance Fase 1).
- **RN-FA-07**: El tipo de comprobante (A, B o C) depende de la obra social/empresa receptora.
- **RN-FA-08**: El checklist de documentación requerido para facturar es configurable por obra social (no es una lista única fija); el orden y los ítems deben respetarse en la interfaz tal como los exige cada obra social.
  - ⚠️ **Discrepancia sin confirmar (`documentos-checklist-items-por-actividad`, 2026-08-10/11)**: esta
    RN describe UN eje de configuración (por obra social). El frontend agrega, además, un eje **por
    tipo de actividad** (global, no por obra social — `obra_social.requisitos_actividad`), que se
    combina de forma aditiva con lo que describe esta regla. Es un supuesto del **equipo**, no
    feedback textual de Andrea Pastor — ver `04_modelo_de_datos.md` §Discrepancias. Esta RN sigue
    siendo verdad tal como está escrita (el eje por obra social no cambió); **no se reescribe** hasta
    que haya veredicto real, en cuyo caso se agrega RN-FA-11 en vez de tocar esta.
- **RN-FA-09**: El checklist documental admite múltiples documentos por tipo/ítem — no se sobrescribe al cargar uno nuevo, se acumula, sin tope de cantidad. Cuando conviven varios documentos del mismo tipo (ej. autorizaciones con vigencia agosto-julio que se renuevan y se solapan durante la transición), se distingue cuál es el vigente del resto (feedback real de la clienta, `pacientes-documentos-multiples`, 2026-08-06).
- **RN-FA-10**: El checklist documental del paciente se instancia **por actividad** (cada dirección del paciente que no sea el domicilio: escuela, terapia, club), no una sola vez por paciente — dos actividades del mismo tipo (ej. dos terapias) tienen checklists independientes y distinguibles por descripción, y un documento cargado en una no aparece ni afecta a las demás. La documentación que no corresponde a ninguna actividad (ej. CUD, DNI) se conserva en un bloque general separado (feedback real de la clienta, `documentos-checklist-por-actividad`, 2026-08-07).
  - ⚠️ **Discrepancia sin confirmar (`documentos-checklist-items-por-actividad`, 2026-08-10/11)**: esta
    RN dice que cada actividad instancia el MISMO checklist (feedback real de la clienta) — no dice
    nada sobre que el CONTENIDO del checklist varíe según el tipo de actividad. El frontend ahora
    permite configurar ítems propios por tipo (escuela/terapia/CET/otro), que se suman al checklist de
    la obra social en cada bloque; el default es vacío (comportamiento idéntico al de hoy). Es un
    supuesto del **equipo**, sin veredicto textual de Andrea Pastor — ver `04_modelo_de_datos.md`
    §Discrepancias. Esta RN sigue siendo verdad; **no se reescribe** hasta que haya veredicto real, en
    cuyo caso se agrega RN-FA-11 en vez de tocar esta.

## Dominio: Vehículos y mantenimiento (RN-VE)

- **RN-VE-01**: No se puede asignar un paciente a un vehículo incompatible con su accesorio de movilidad (silla plegable/rígida, silla postural, andador, trípode) — validación obligatoria para evitar errores humanos.
- **RN-VE-02**: Un vehículo marcado como fuera de servicio (en reparación) no puede usarse en las hojas de ruta mientras dure la inhabilitación.
- **RN-VE-03**: El mantenimiento preventivo (cambio de aceite/filtros) se controla cada 10.000 km o ~2-3 meses (lo que ocurra primero).
- **RN-VE-04**: Las habilitaciones VTV (cada 6 meses) y RTO son independientes y ambas deben poder registrarse — algunos vehículos requieren RTO además de la VTV, otros solo VTV.

## Dominio: Hojas de ruta (RN-HR)

- **RN-HR-01**: El sistema no arma la ruta automáticamente; su función es ayudar a ordenar los pasajeros de cada recorrido (sugerencia editable por geolocalización), dejando siempre la decisión y edición manual a cargo del operador.
- **RN-HR-02**: La dirección de ida y la de vuelta se modelan como datos independientes por tramo (origen y destino); no se asume que la vuelta es el trayecto inverso a la ida.
- **RN-HR-03**: Se admite el armado de recorridos manuales sin frecuencia fija ni turno asignado (ej. traslados puntuales a hospitales), sin que se generen automáticamente desde una agenda.

## Dominio: Excepciones globales (RN-GL)

- **RN-GL-01**: El sistema no maneja roles fijos predefinidos; cada cuenta de usuario recibe acceso individual a los módulos que la administradora le asigne, de forma flexible.
- **RN-GL-02**: Toda acción de creación, modificación o eliminación debe quedar registrada en el log de auditoría (quién, qué y cuándo).
- **RN-GL-03**: Los conductores no acceden al sistema; se registran únicamente como datos dentro del módulo Conductores.
