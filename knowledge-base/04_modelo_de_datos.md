# Modelo de Datos

## Dominios

- **Usuarios y auditoría**: cuentas del personal, permisos por módulo, log de acciones.
- **Pacientes**: fichas clínicas, direcciones, personas a cargo, documentación.
- **Obras sociales**: entidades pagadoras, checklist de documentación, presupuestos y autorizaciones.
- **Facturación y cobros**: facturas, asistencias/prestaciones, cobros y pagos parciales.
- **Flota**: vehículos, mantenimiento, gastos, conductores.
- **Operación diaria**: hojas de ruta y recorridos.

## ERD (descripción textual)

```
Usuario (cuenta) 1---N AuditLog

Paciente 1---N Direccion (catálogo de lugares reutilizables — el tramo ida/vuelta lo define cada Recorrido, no la Direccion)
Paciente 1---N PersonaACargo
Paciente 1---1 ObraSocial (obra social asignada)
Paciente 1---N DocumentoPaciente
Paciente 1---N Presupuesto
Presupuesto 1---1 Autorizacion (puede coincidir o ser menor, nunca mayor)

ObraSocial 1---1 ChecklistDocumentacion (configurable por obra social)
ObraSocial 1---1 PlantillaFacturacion

Paciente 1---N Factura
Factura 1---N Asistencia/Prestacion (se facturan íntegramente, el recorrido efectivo es independiente)
Factura 1---N Cobro (admite pagos parciales)
Factura 1---N DocumentoFactura

Vehiculo 1---N GastoVehiculo (evento con fecha y monto, sin frecuencia fija)
Vehiculo 1---N DocumentoVehiculo
Vehiculo 1---N MantenimientoRegistro (preventivo/correctivo, VTV, RTO)
Vehiculo 1---N Conductor (asignación semanal)
Conductor 1---N DocumentoConductor

HojaDeRuta 1---N Recorrido
Recorrido N---1 Vehiculo
Recorrido N---1 Conductor
Recorrido N---1 Paciente (por tramo, con dirección de ida y de vuelta independientes)
```

## Entidades

### Usuario (cuenta)
- Atributos: nombre, apellido, email, `rol` (`rol_enum`: `admin` / `empleado`, fijo — sin roles adicionales), `ingreso_at`/`egreso_at` (RF-004, derivados por trigger de `auth.users.last_sign_in_at` y `auth.audit_log_entries`).
- Relaciones: N registros en log de auditoría (`auditoria.logs`); N permisos por módulo (`modulos.permisos`) — solo aplica a cuentas `empleado`, un `admin` no necesita filas en `permisos` porque tiene acceso total.
- Constraint: `admin` tiene acceso total sin pasar por chequeo de `modulos.permisos`; una cuenta `empleado` no puede autopromoverse a `admin` (bloqueado por trigger a nivel de BD). Alta de cuentas únicamente vía Edge Function `create-user` (no hay registro público); toda cuenta nueva nace `empleado`, el único `admin` se asigna a mano una vez (bootstrap, ver `CHANGES.md` §C-02).

### Paciente
- Atributos: apellido(s), nombre(s), fecha de nacimiento, DNI, CUIL del titular, diagnóstico/condición, accesorio de movilidad (silla plegable/rígida, silla postural, andador, trípode), teléfono alternativo del responsable.
- Relaciones: N direcciones (domicilio, escuela, terapias, CISET — catálogo reutilizable, sin tramo propio), N personas a cargo, 1 obra social, N documentos, N presupuestos.
- Constraints: el identificador de afiliado varía según obra social (número de documento, alfanumérico, o CUIL del titular con sufijo /01, /02...) — el campo debe adaptarse.

### CUD (Certificado Único de Discapacidad)
- Atributos: número, fecha de emisión, fecha de vencimiento.
- Relaciones: pertenece a Paciente.
- Constraint: debe estar vigente; se requiere alerta de vencimiento próximo (RF-104).

### ObraSocial
- Atributos: nombre, checklist de documentación requerida (configurable, ej. OSECAC: RHC, prescripción, justificación, consentimiento, declaración de domicilio, mapa, presupuesto, CBU, habilitación, FIM), plantilla de descripción de factura, modalidad de facturación (por prestación vs. factura general), condiciones por prestador (plazo de cobro, tipo de comprobante A/B/C), si admite pagos parciales/por lote.

### Presupuesto / Autorizacion
- Atributos: estimación anual solicitada (Presupuesto) vs. respuesta de la obra social (Autorizacion — igual o menor, nunca mayor), cupo de días/km por mes, estado (pendiente, autorizada, judicializada, rechazada), vigencia (permite carga retroactiva, ej. autorizada en abril con vigencia desde enero).

### Factura
- Atributos: paciente/identificador (DNI o afiliado — a confirmar), domicilio, prestación, mes y año, cantidad de días, dependencia y retorno, valor del km (nomenclador, carga manual), cantidad de km, total, tipo de comprobante (A/B/C), estado (a facturar/pendiente, facturado, cobrado, pagado parcialmente), fecha estimada de cobro (plazo configurable, default 90 días; 45 días si tiene amparo judicial, contados desde la fecha de factura).
- Relaciones: N asistencias/prestaciones asociadas (se facturan íntegramente), N documentos adjuntos (comprobante ARCA, asistencia, CODEM, etc.), N cobros (pagos parciales).
- Constraint clave: el recorrido efectivo es independiente de las prestaciones facturadas (ej. un paciente con 5 prestaciones semanales puede concentrar 2 terapias en un mismo día); el sistema no deriva ni valida el recorrido a partir del número de prestaciones.

### Vehiculo
- Atributos: patente, modelo, tipo, capacidad (hasta 6 pasajeros), accesorios de movilidad compatibles (ej. Etios/Palio: silla plegable; Kangoo/camión: sillas rígidas/posturales; Peugeot Partner: capacidad reducida — chofer + un menor adelante + dos personas de contextura delgada), estado (habilitado/fuera de servicio), kilometraje.
- Relaciones: N documentos (cédula, VTV, RTO, seguro, fotos), N gastos (evento con fecha y monto), N registros de mantenimiento (preventivo cada 10.000 km o ~2-3 meses; VTV cada 6 meses; RTO — algunos vehículos requieren ambas habilitaciones).
- Constraint: no se puede asignar un paciente a un vehículo incompatible con su accesorio de movilidad (RF-502).

### Conductor
- Atributos: datos personales, perfil/restricciones (ej. conductores de mayor edad que no trasladan pacientes que requieren carga física), documentación (licencia de conducir).
- Relaciones: asignación semanal a un vehículo. No tiene cuenta de acceso al sistema.

### HojaDeRuta / Recorrido
- Atributos: fecha, franja horaria (aprox. 8:00-20:00), notas al pie.
- Relaciones: agrupa recorridos por vehículo/conductor, cada recorrido asocia pacientes con dirección de origen y destino independientes por tramo (no se asume que la vuelta es el trayecto inverso). Admite recorridos manuales sin frecuencia fija ni turno asignado (ej. hospitales puntuales).

## ⚠️ Discrepancias con el modelo de datos real (docs/core/Traslados-Modelo-Datos.docx)

Comparación hecha 2026-07-24 contra el docx entregado por MagneStudios (modelo funcional de la BD
real). Los puntos marcados como "cartel en UI" ya están señalizados con `AvisoModeloDatos` en las
pantallas correspondientes (Obras Sociales, Vehículos); el resto no tiene pantalla propia todavía,
así que queda anotado acá hasta que se construya esa feature.

- **Catálogo de módulos de permisos (4 → 7)** — decisión de UX, **NO pedido del cliente**
  (`openspec/changes/permisos-modulos-granulares/`, propose validado 2026-07-30): el docx nombra
  explícitamente 4 módulos de ejemplo (`pacientes`, `obra_social`, `facturacion`, `conductores`) y
  cada entidad del docx ("¿Quién puede ver/editar esto?") apunta a exactamente uno de esos 4 — esta
  es la segunda vez que el catálogo se revierte a esos 4 tras un primer intento fallido de 9 módulos
  por carpeta de frontend (`supabase/migrations/20260728120000_seed_modulos.sql`). Este change
  vuelve a separar 3 de los 4 en sub-módulos, esta vez a pedido directo de la usuaria (no de Andrea
  Pastor) para que la matriz de permisos sea 1:1 con las 7 pantallas del sidebar, no agrupada:
  `pacientes` → `pacientes` + `hojas_de_ruta` (nuevo), `facturacion` → `facturacion` +
  `presupuestos` (nuevo), `conductores` → `conductores` + `vehiculos` (nuevo); `obra_social` queda
  igual. `facturacion.gastos_vehiculos` permanece bajo `facturacion` (confirmado con la usuaria — es
  un gasto, no una operación sobre el vehículo). Migración de datos aditiva: ninguna cuenta pierde
  acceso a una pantalla que ya tenía (`modulos.permisos` se copia, nunca se mueve, del módulo padre
  al hijo). **No se resuelve la discrepancia contra el docx "borrándola"** — queda documentada acá y
  con cartel `AvisoModeloDatos` en la pantalla de Cuentas (`CuentaDetail.tsx`), a confirmar con
  quien mantiene el docx si el catálogo real del backend debe quedar en 4 o en 7 módulos.
- **Operación diaria / Recorridos**: esta KB modela `HojaDeRuta 1---N Recorrido` con cada Recorrido
  ligado a Vehículo + Conductor + Paciente. El docx no tiene entidad "Hoja de Ruta": tiene
  "Recorridos" (horario habitual recurrente del paciente, sin vehículo/conductor) e "Historial de
  Recorridos" (viaje efectivamente realizado, ligado a Paciente + Vehículo, **sin campo Conductor**).
  Si el docx es correcto, el sistema no podría auditar qué chofer hizo cada viaje puntual.
  **Decisión del frontend (change `hojas-de-ruta-ui`, FE-5/C-10, 2026-07-24):** se modela
  `HojaDeRuta` + `Recorrido` con `vehiculoId` **y `conductorId`** porque la regla de negocio y el
  flujo operativo real lo exigen (US-700, RN-VE-01/02, `06_funcionalidades.md §Épica 8`,
  `07_flujos_principales.md §Flujo 2`). La entidad "Hoja de Ruta" y el campo `conductor` son
  **agregados sobre el docx**, pendientes de confirmar con el dueño del docx antes de cerrar el
  esquema de las tablas `hoja_de_ruta`/`recorrido` en el backend C-10. Señalizado en la UI con
  `AvisoModeloDatos` en la pantalla de hoja de ruta. Menores, con cartel dedicado propio (agregado
  2026-07-25): el orden de recogida (`ParadaRecorrido.orden`) y las coordenadas del mapa
  (`coordenadaOrigen`, fixture) tampoco existen en el docx — cartel en `RecorridoCard.tsx`; la
  franja horaria y las notas al pie del agregado `HojaDeRuta` tampoco existen en el docx — cartel
  en `HojaDeRutaPage.tsx`.
- **Prestadores**: el docx tiene una entidad propia "Prestadores" (razón social, CUIT, dirección,
  teléfono) bajo el área Obra Social. Esta KB solo la menciona como atributo suelto ("condiciones por
  prestador"), no como tabla. Sumarla como entidad cuando se construya C-04.
- **Documento de Factura** — resuelto-en-frontend 2026-07-25 (`facturacion-ui`, FE-6, ver detalle
  completo más abajo): esta KB asume `Factura 1---N DocumentoFactura` (comprobante ARCA, CODEM,
  etc.). El docx no tiene esa tabla — Presupuesto y Autorización tienen un campo "Archivo" único
  cada uno, pero Factura no tiene ningún adjunto. El frontend implementó el checklist multi-documento
  (`FacturaDocumentos.tsx`, entidad `'factura'` de `EntidadDocumental`) con cartel `AvisoModeloDatos`;
  **el backend `C-07` sigue teniendo que crear la tabla `documento_factura`** antes de cerrar el
  esquema.
- **Plazo de cobro (90 días / 45 con amparo)** — resuelto-en-frontend 2026-07-25 (`facturacion-ui`,
  FE-6, ver detalle completo más abajo): sin campo explícito en Factura del docx (cartel en UI en
  Obras Sociales, ver `ObraSocialDetail`, y ahora también en Facturación). Regla de negocio real
  (RN-FA-04, RF-406), implementada como constantes configurables (`PLAZO_COBRO_DEFAULT_DIAS`,
  `PLAZO_COBRO_AMPARO_DIAS`, `PLAZO_ALERTA_VENCIDA_DIAS`) y función pura
  (`calcularFechaEstimadaCobro`), **pendiente de confirmar los tres valores y la precedencia
  amparo/obra social con el cliente** antes de sumar el campo a la BD.
- **Checklist / plantilla de factura / modalidad de facturación**: cartel en UI (Obras Sociales). En
  el docx el checklist es una tabla de vínculo contra un catálogo de Tipos de Documento, no un array
  embebido; `plazoCobroDias`, `modalidadFacturacion`, `admitePagosParciales` y `plantillaFactura` no
  existen en el docx en absoluto.
- **Vehículo — kilometraje/habilitaciones**: cartel en UI (Vehículos). En el docx viven en la tabla
  Mantenimiento (kilometraje actual + próximo vencimiento por fecha/km), no embebidos en Vehículo.
- **Gastos de Vehículo**: cartel en UI (Vehículos). En el docx el módulo de permisos que controla el
  acceso es "facturacion", no "conductores" — importa para las RLS policies.
- **Conductor**: cartel en UI (`ConductorDetail`). ~~Faltan campos que sí están en el docx:
  Domicilio, CUIL (acá solo hay Documento/DNI) y Estado (operando / fuera de servicio)~~ — resuelto
  2026-07-24: los 3 campos se sumaron al frontend (`Conductor.domicilio`, `Conductor.cuil`,
  `Conductor.estado`). Queda pendiente: "Restricciones" acá es un catálogo cerrado
  (`RestriccionConductor[]`); en el docx es texto libre dentro de un único campo "Notas" junto con
  las observaciones — a coordinar con Enzo (backend) antes de cerrar C-09: decidir si se mantiene
  estructurado o se funde en un campo de texto.
- **Asignación de Conductores a Vehículos**: cartel en UI (`ConductorDetail`, sección Flota). Acá la
  semana se guarda como etiqueta ISO (`semana: '2026-W30'`); el docx tiene Fecha de inicio y Fecha de
  fin de semana como dos campos de fecha independientes.
- **Paciente**: cartel en UI (`PacienteDetail`). ~~Faltan segundo nombre y segundo apellido (el docx
  los separa del primero, ambos opcionales). "Diagnóstico" y "Condición" son dos campos de una
  entidad aparte en el docx ("Datos Clínicos"); acá están fundidos en Paciente y falta el campo
  Condición. "Teléfono alternativo" está en Paciente acá; en el docx pertenece a Personas a
  Cargo.~~ — resuelto 2026-07-24: `Paciente.segundoNombre` y `Paciente.segundoApellido` (opcionales)
  sumados; `Paciente.condicion` (opcional) sumado junto a `diagnostico` sin crear la entidad
  "Datos Clínicos" aparte (fuera de alcance); `telefonoAlternativo` se sacó de `Paciente` y
  `PersonaACargo` ganó `telefono`/`telefonoAlternativo` (ambos opcionales). ~~"Accesorio de
  movilidad" acá admitía uno solo (`AccesorioMovilidad | null`); el docx permite varios por paciente
  (tabla de vínculo, igual que Vehículo-Accesorio).~~ — resuelto 2026-07-24 (segunda tanda):
  `Paciente.accesorioMovilidad` pasó a `AccesorioMovilidad[]` (array vacío = ninguno), con selector
  de multi-selección en `PacienteForm` (mismo patrón de checkboxes que `VehiculoForm`) y lista de
  chips en el resumen. Queda pendiente: el número de afiliado acá es un valor único y actual; el
  docx lo modela en "Cobertura del Paciente", una entidad histórica (N coberturas por paciente con
  fecha desde/hasta) — acá no hay historial de coberturas ni de obras sociales anteriores.
- **CUD**: cartel en UI. El docx guarda un campo booleano "Vigente" propio del CUD; acá se calcula
  al vuelo (`estadoCud`) a partir de la fecha de vencimiento, no se persiste.
- **Personas a Cargo**: ~~cartel en UI. Falta Teléfono / Teléfono alternativo, que sí están en el
  docx para esta entidad (`PersonaACargo` acá solo tiene nombre, apellido y DNI).~~ — resuelto
  2026-07-24: `PersonaACargo.telefono` y `PersonaACargo.telefonoAlternativo` (ambos opcionales)
  sumados; el cartel se sacó de `PacienteDetail` (esa entidad ya no tiene discrepancia pendiente
  contra el docx).
- **Direcciones / Recorridos**: cartel en UI (`PacienteDetail`, sección Direcciones). El docx separa
  "Direcciones" (catálogo: calle + tipo de lugar) de "Recorridos" (entidad aparte: dirección
  inicial/final + día de la semana + hora). Acá están fusionados en un solo tipo `Direccion` con
  `dias`/`horario` opcionales que no existen en el docx.
  ~~y un campo `tramo` (ida/vuelta) que no existe en el docx~~ — resuelto 2026-07-26: `tramo` se
  sacó de `Direccion` (vivía fijo en la dirección, obligando a duplicar un mismo lugar físico —ej.
  el domicilio— para cubrir ida y vuelta, sin que nada lo usara realmente para filtrar). RN-HR-02
  (independencia ida/vuelta) se sigue cumpliendo en `ParadaRecorrido.tramo` (hojaDeRuta.ts), que ya
  elige origen/destino de forma independiente por parada sin derivar uno del otro — `Direccion`
  queda como catálogo de lugares reutilizables, sin tramo propio.
- **Presupuesto / Autorización** (detalle completo en `openspec/changes/presupuestos-ui/design.md`
  §Discrepancias, propose validado 2026-07-24): el docx modela Presupuesto como un `Monto` único +
  Fecha de emisión + un solo Archivo (NO "estimación anual por prestación" como decía esta KB), y
  Autorización con Estado + Fecha de respuesta + cupos días/km + un solo Archivo (NO la tabla
  `DocumentChecklist` multi-documento que asumía `CHANGES.md` §C-06). Dos huecos con impacto en
  backend, **pendientes de confirmar antes de cerrar la tabla `autorizacion`**: (1) la Autorización
  no tiene ningún campo numérico comparable con el `Monto` del Presupuesto, así que RN-PA-01
  ("autorización ≤ presupuesto, nunca mayor") no es directamente validable con el modelo real — el
  frontend agregó `Autorizacion.montoAutorizado?` para poder validarla, pendiente de que el backend
  sume `monto_autorizado` o reinterprete la regla sobre cupos; (2) la Autorización solo tiene "Fecha
  de respuesta", sin campo de vigencia retroactiva (RN-PA-02) — el frontend agregó
  `Autorizacion.vigenciaDesde?`, pendiente de que el backend sume `vigencia_desde`. Cartel en UI
  implementado 2026-07-24 (Decisión 7 de `design.md`) con `AvisoModeloDatos` en
  `PresupuestoForm.tsx` (archivo único) y `AutorizacionForm.tsx` (archivo único, `montoAutorizado`
  y `vigenciaDesde`) — los 3 puntos siguen **pendientes de confirmar con backend** antes de cerrar
  la tabla `autorizacion` de `C-06`.

- **Facturación y Cobros** (detalle completo en `openspec/changes/facturacion-ui/design.md`
  §Discrepancias, propose validado 2026-07-25): comparación entre esta sección y
  `docs/core/Traslados-Modelo-Datos.docx §5 Facturación` (entidades **Facturas** y **Cobros**).
  Cinco discrepancias con impacto en el esquema del backend `C-07`, todas señalizadas con
  `AvisoModeloDatos` agrupado en la pantalla de Facturación:
  1. **`AsistenciaPrestacion` no existe en el docx** (nueva): el docx no tiene ninguna entidad de
     asistencias/prestaciones en el área Facturación. El frontend la agrega, embebida en `Factura`
     (sin repository propio), para poder persistir lo declarado (RN-FA-01) y exportar "factura +
     asistencia" (US-400). **El backend debe crear la tabla `asistencia_prestacion`.**
  2. **Documentos por factura no existen en el docx** (known, ver bullet arriba) — **el backend
     debe crear `documento_factura`.**
  3. **`fecha_estimada_cobro` no existe en el docx** (known, ver bullet arriba): el docx solo tiene
     "Fecha inicial / tope", ambiguo respecto de si "tope" es el fin del período o el límite de
     cobro. El frontend agrega `fechaEstimadaCobro?` **además de** `fechaInicial`/`fechaTope`, que
     se conservan como el período facturado. **El backend debe agregar `fecha_estimada_cobro` a
     `factura`.**
  4. **`cantidad_km` no existe en el docx** (nueva): el docx solo tiene "Valor del kilómetro"
     (tarifa) y "Monto" (total), no la cantidad de km — sin ella no se puede validar el cupo
     mensual de km (RN-FA-02, RN-PA-03) ni derivar el total. **El backend debe agregar
     `cantidad_km` a `factura`.**
  5. **El enum de `estado` diverge** (nueva): el docx enumera "a facturar, cobrada, pagada
     parcialmente o pendiente" — sin `facturado`. Sin ese estado no hay disparador para calcular
     la fecha estimada de cobro (US-400: "al pasar a facturado se calcula..."). El frontend adopta
     `EstadoFactura = 'a-facturar' | 'facturado' | 'cobrado' | 'pagado-parcialmente'`, tratando el
     `pendiente` del docx como sinónimo de `a-facturar`. **El backend debe alinear el enum de
     `estado`.**

  Dos discrepancias menores, sin cartel dedicado (documentadas solo acá): (6) los campos
  estructurados de la descripción (`prestacion`, `mesFacturado`, `anioFacturado`,
  `dependenciaYRetorno`, `domicilioId`, `identificadorFactura`) no existen en el docx, que colapsa
  todo en un único campo de texto "Descripción" — el frontend persiste ambos (estructurados +
  texto renderizado y congelado); (7) `Cobro.id` es un agregado sobre el docx (React exige keys
  estables por id). Las cinco discrepancias con impacto backend deben coordinarse con quien
  mantiene el docx **antes** de cerrar el esquema de `factura`, `asistencia_prestacion`, `cobro` y
  `documento_factura` (governance CRITICO, `CHANGES.md §C-07`).

- **Panel principal y reportes** (detalle completo en `openspec/changes/dashboard-ui/design.md`
  §Discrepancias, propose validado 2026-07-25): comparación entre US-800 (`06_funcionalidades.md`
  §Épica 9) y `docs/core/Traslados-Modelo-Datos.docx` (áreas 3 Pacientes/CUD, 5 Facturación,
  6 Conductores y Vehículos/Mantenimiento). `C-11` no introduce ninguna entidad —es agregación de
  solo lectura— así que las discrepancias no son de campos faltantes sino de **qué se puede
  calcular con el modelo real**. Las cuatro se señalizan con `AvisoModeloDatos` agrupado en la
  pantalla de Dashboard:
  1. **El docx no modela ninguna vista, reporte ni agregación** (nueva, estructural): describe
     siete áreas de entidades operativas y cero objetos de reporte. Es coherente con que sea un
     modelo conceptual, pero deja el contrato de las vistas sin escribir en ningún lado. Las seis
     funciones puras de `frontend/src/shared/lib/reportes/` y sus tests **son** esa especificación.
     **El backend `C-11` debe implementar sus vistas SQL / RPC contra esas firmas y esos casos
     borde**, no contra una interpretación propia de US-800.
  2. **Sin fecha de emisión ni estado `facturado`, la mora no es calculable** (known —
     Discrepancias 3 y 5 de `facturacion-ui`— promovida a bloqueante): "factura en mora" (RF-801,
     RF-406) se define como N días desde la emisión de una factura emitida y no saldada, y el docx
     no tiene **ninguna** de las dos cosas. **Si el docx se impusiera tal cual, RF-801 no se puede
     cumplir**: hay que confirmar `factura.fecha_factura` y el estado `facturado` con quien
     mantiene el docx, o redefinir la regla de mora con el cliente.
  3. **Sin período de atribución estructurado, "cuánto facturamos en marzo" no tiene respuesta
     única** (menor en `C-07` —Discrepancia 6—, promovida a estructural en `C-11`): el docx
     colapsa el período en `Fecha inicial / tope`, dos fechas que pueden cruzar el límite de mes.
     Con solo esas dos, atribuir el facturado a un mes obliga a elegir arbitrariamente una o a
     prorratear, y dos implementaciones razonables dan números distintos. El frontend atribuye por
     `mesFacturado`/`anioFacturado`. **El backend debe agregar `factura.mes_facturado` /
     `factura.anio_facturado`, o declarar por escrito cuál de las dos fechas es la columna canónica
     de atribución**, antes de escribir la vista del reporte.
  4. **Señales de alerta derivadas en el cliente vs. persistidas en el docx** (known, con riesgo de
     doble fuente de verdad): el docx persiste un booleano `Vigente` en CUD y los "Próximo
     vencimiento (fecha/kilometraje)" en la entidad Mantenimiento; el frontend los deriva al vuelo
     con `estadoCud`, `estadoServicePreventivo` y `estadoHabilitacion`. Si el backend persiste esos
     valores y no los recalcula, **la tarjeta del dashboard y la fila de la BD pueden
     contradecirse** (un valor persistido se desactualiza solo con el paso del tiempo). Postura del
     frontend: **manda la derivación** — pendiente de confirmar con `C-05` / `C-08` / el dueño del
     docx, no se resuelve unilateralmente.

  Ninguna de las cuatro se resuelve en `dashboard-ui`: el change es governance BAJO y de solo
  lectura, así que se documentan, se señalizan en la UI y quedan para confirmar. Las tres primeras
  tienen impacto directo en el esquema del backend (`C-11`, `C-07`).

- **Pacientes vs. esquema real de `C-05`** (detalle completo en
  `openspec/changes/integracion-pacientes/design.md` §D9, propose validado 2026-07-30): comparación
  entre el tipo `Paciente` del frontend y `20260724100004_schema_pacientes.sql` (el schema real ya
  aplicado en el proyecto Supabase, no solo el docx), hecha al conectar el repository real
  (`SupabasePacienteRepository.ts`) en lugar del mock. Once discrepancias, **ninguna resuelta acá**
  — todas quedan pendientes de confirmar con el cliente o con quien mantiene
  `docs/core/Traslados-Modelo-Datos.docx`, señalizadas con `AvisoModeloDatos` agrupado en
  `PacienteDetail.tsx` (y uno propio en `DireccionesEditor.tsx` para las de dirección):
  1. **`numeroAfiliado.formato`** no tiene columna — es la misma pregunta abierta IN-01 de
     `10_preguntas_abiertas.md`, ahora con el hueco de esquema confirmado. Default editable
     client-side, no se persiste.
  2. **`numeroAfiliado.valor`** vive en `obra_social.coberturas_paciente.num_afiliado`, otro schema,
     gateado por el módulo `obra_social` — si la cuenta no tiene `obra_social: read`, el valor se
     lee degradado (vacío, con cartel), nunca se inventa ni se bloquea la ficha.
  3. **`Direccion.localidad`** no tiene columna — no se persiste, se pierde al recargar.
  4. **`Direccion.dias` / `.horario`** no tienen columna en `direcciones`; el docx los modela en
     `pacientes.recorridos` (`dia_semana`/`hora`), una tabla gateada por el módulo `hojas_de_ruta`,
     no por `pacientes` — no se persisten desde esta ficha.
  5. **`pacientes.direcciones.numero`** existe en la base pero no tiene campo propio en el
     frontend — se concatena a `calle` al leer; al escribir viaja siempre `null` (no se inventa un
     parseo de altura desde el texto combinado).
  6. **`pacientes.paciente.domicilio`** es una columna suelta que duplica la relación
     `direcciones` — se lee para no perderla, nunca se escribe desde este change.
  7. **`diagnostico`** es `string` en el frontend y `clinicos.diagnostico JSONB` en la base — se lee
     como cadena JSON, objeto `{ texto }` o `null`, normalizado siempre a `string`; se escribe como
     JSON string.
  8. **`amparoJudicialAclaracion`** no tiene columna — no se persiste.
  9. **`cud: Cud | null`** en el frontend vs. `pacientes.cud` 1:N con columna `vigente` en la base:
     cardinalidad y derivado-vs-persistido en conflicto. Se usa la fila de `vencimiento` más
     reciente; `vigente` se ignora deliberadamente (ya había cartel sobre esto).
  10. **`fechaNacimiento`, `cuilTitular`, `PersonaACargo.dni`** son requeridos en el frontend pero
      las columnas son NULLables en la base (nullabilidad invertida) — `NULL` se mapea a `''` al
      leer, nunca se descarta el paciente ni se lanza error.
  11. **`accesorioMovilidad: AccesorioMovilidad[]`** (unión cerrada en el frontend) vs.
      `pacientes.accesorios.tipo TEXT` libre + tabla de vínculo N:N — los `tipo` conocidos se
      mapean, los desconocidos se descartan en silencio (con cartel); escribir un accesorio
      inexistente en el maestro aborta el alta con un error accionable en vez de guardar basura.

  **Columnas que el backend debería agregar** para cerrar los puntos 1, 3 y 8 (ver también
  `CHANGES.md` §`C-05`): `coberturas_paciente.formato_afiliado` (o derivarlo de
  `obra_social.identificadorOrigen`, sin decidir acá), `direcciones.localidad`,
  `amparo_judicial_aclaracion` (en `paciente` o en `clinicos`, a definir).

  **Además**, la función `pacientes.crear_paciente_completo` (alta atómica, ver más abajo en esta
  misma sección) documenta el contrato de escritura real; el punto 9 y el punto 11 tienen
  consecuencias directas sobre esa función (`vigente` no se escribe nunca; un `tipo` de accesorio
  inexistente en el maestro hace abortar la transacción completa con `45001`).

### Función de alta: `pacientes.crear_paciente_completo` (contrato de escritura del módulo Pacientes)

Migración `supabase/migrations/20260730180000_crear_paciente_completo.sql`
(`openspec/changes/integracion-pacientes/`, D4). Es el **único** camino de alta multi-tabla del
módulo Pacientes: un solo `POST /rpc/crear_paciente_completo` con un único argumento `jsonb`, que
inserta atómicamente `paciente`, `clinicos`, `cud`, `direcciones` (`numero` siempre `NULL`, ver
discrepancia #5 arriba), `personas_a_cargo`, `accesorios_pacientes` (resolviendo `tipo →
accesorio_id`, aborta con `45001` si el tipo no está en el maestro) y, condicionalmente,
`obra_social.coberturas_paciente` (solo si vienen `num_afiliado` y `obra_social_id`). Nunca se hace
la secuencia insert-por-insert con borrado compensatorio: PostgREST corre el `rpc()` dentro de una
transacción, así que un fallo a mitad de camino deja **cero** filas escritas en cualquiera de las 7
tablas, sin estado parcial posible.

**`SECURITY INVOKER` a propósito, no un descuido.** La función corre con los privilegios y las RLS
policies de quien la llama, no del owner. Esto es intencional y es lo que hace que el gateo por
módulo (`modulos.tiene_permiso('pacientes','write')`, ejercido vía las policies de
`pacientes.paciente` y las demás tablas) siga aplicando **dentro** de la función exactamente igual
que si el frontend hiciera los inserts uno por uno. Convertirla a `SECURITY DEFINER` haría que
corriera con los privilegios del owner (superusuario) y **bypassearía por completo** ese gateo:
cualquier cuenta autenticada, tenga o no permiso de escritura sobre Pacientes (o sobre Obras
Sociales, para la cobertura), podría crear pacientes reales. Es el riesgo de seguridad más serio
que introduce `C-05`/`integracion-pacientes`. La migración deja `REVOKE ALL ... FROM PUBLIC` y
`FROM anon`, más `GRANT EXECUTE ... TO authenticated` únicamente, y un `COMMENT ON FUNCTION` con la
misma advertencia visible desde el dashboard de Supabase sin tener que abrir el archivo de
migración. Quien lea esta sección de la KB sin abrir `20260730180000_crear_paciente_completo.sql`
tiene que quedar advertido igual: **no cambiar `SECURITY INVOKER` por `SECURITY DEFINER` bajo
ninguna circunstancia**, ni siquiera "temporalmente para probar" — es el chequeo de seguridad final
antes de archivar el change (`security-review`, ver `tasks.md` 7.8).

## Seed data inicial

Migración inicial estimada: 50-60 pacientes (más de 50 activos), con su documentación asociada, a definir en detalle a partir de las planillas/Excel y estructura de carpetas actuales que aporte el cliente (ver `10_preguntas_abiertas.md` e `11` en `01_vision_y_objetivos.md` sección insumos pendientes).
