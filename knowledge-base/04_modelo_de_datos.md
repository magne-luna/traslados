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
- Relaciones: N direcciones (domicilio, escuela, terapias, CET — catálogo reutilizable, sin tramo propio), N personas a cargo, 1 obra social, N documentos, N presupuestos.
- Constraints: el identificador de afiliado varía según obra social (número de documento, alfanumérico, o CUIL del titular con sufijo /01, /02...) — el campo debe adaptarse.
- ⚠️ **Documentación por actividad, sin respaldo real en la base** (`documentos-checklist-por-actividad`,
  2026-08-07, ver §Discrepancias): en el frontend, la documentación del paciente pasa a agruparse por
  actividad (`Direccion` del paciente cuyo `tipo` no es `'domicilio'`: escuela, terapia(s), club), a
  diferencia de la cardinalidad múltiple por ítem (RN-FA-09), que la base real ya soportaba sin
  migración. Detalle completo en §Discrepancias.

### CUD (Certificado Único de Discapacidad)
- Atributos: número, fecha de emisión, fecha de vencimiento.
- Relaciones: pertenece a Paciente.
- Constraint: debe estar vigente; se requiere alerta de vencimiento próximo (RF-104).

### ObraSocial
- Atributos: nombre, código, dirección, teléfono, condición frente al IVA (los 4 últimos
  integrados al frontend por `integracion-obra-social`, C-04, 2026-07-31 — ver §Discrepancias),
  checklist de documentación requerida (configurable, ej. OSECAC: RHC, prescripción, justificación,
  consentimiento, declaración de domicilio, mapa, presupuesto, CBU, habilitación, FIM; **persistido
  relacional** contra el catálogo compartido `obra_social.tipos_documento`, no como array embebido),
  plantilla de descripción de factura, modalidad de facturación (por prestación vs. factura
  general), si admite pagos parciales/por lote.
  - ⚠️ **Plazo de cobro y tipo de comprobante (A/B/C) se movieron a Prestador** (change
    `prestadores-crud`, propuesto y aplicado en frontend 2026-08-01, **provisorio — SIN confirmar
    con Andrea**, ver §Discrepancias y `10_preguntas_abiertas.md`). Las columnas gemelas
    `obra_social.obra_social.plazo_cobro_dias`/`.tipo_comprobante` siguen existiendo en la base
    (nadie las dropea sin confirmación — D3 de `prestadores-crud/design.md`) pero quedan
    vestigiales: el frontend ya no las lee ni las escribe desde `ObraSocialForm.tsx`.
- Relaciones: **N:N con Prestador** (tabla de vínculo `obra_social.obra_social_prestador`, ver
  entidad `Prestador` abajo) — provisorio, mismo change, sin confirmar con Andrea.

### Prestador
- ⚠️ **Entidad nueva en el frontend, change `prestadores-crud` (propuesto y aplicado 2026-08-01,
  rama de demo, provisorio — SIN confirmar con Andrea).** `obra_social.prestadores` existe en la
  base real desde el 2026-07-24 (creada por `integracion-obra-social`) pero sin ninguna vía de alta
  en la app hasta este change.
- Atributos: razón social, CUIT (**ambigüedad sin resolver** frente a `obra_social.cuit`, ver
  §Discrepancias discrepancia #12), dirección (opcional), teléfono (opcional), **más** plazo de
  cobro y tipo de comprobante (A/B/C) — movidos desde `ObraSocial` (lectura literal de US-300:
  "se registra plazo de cobro, tipo de comprobante... y demás condiciones particulares **por
  prestador**"), provisorio.
- Relaciones: **N:N con ObraSocial** vía `obra_social.obra_social_prestador` (PK compuesta
  `(obra_social_id, prestador_id)`, ambas FK `ON DELETE CASCADE`, sin columna propia — la fila no
  guarda ningún dato además del par). El multi-select de edición vive en `PrestadorForm.tsx`; el
  panel de solo lectura vive en `ObraSocialDetail.tsx`. Escritura por diff (no reemplazo total),
  no atómica (dos requests PostgREST sin transacción) — aceptado en esta rama de demo porque el
  vínculo todavía no alimenta ninguna factura.
- **Sin resolver, explícitamente fuera de alcance de este change**: si una ObraSocial tiene varios
  Prestadores vinculados, ¿cuál aplica al generar una factura general? Ver
  `10_preguntas_abiertas.md`.

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
  un gasto, no una operación sobre el vehículo) — **nota 2026-08-01**: esa confirmación describía la
  ubicación del módulo de permisos, no la tabla de destino real; ver discrepancia "Gastos de
  Vehículo" más abajo, donde se aclara que `facturacion.gastos_vehiculos` terminó sin usar. Migración de datos aditiva: ninguna cuenta pierde
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
- **Prestadores** — **decidido 2026-07-31, change propio** (`integracion-obra-social` D8): el docx
  tiene una entidad propia "Prestadores" (razón social, CUIT, dirección, teléfono) bajo el área
  Obra Social; la tabla `obra_social.prestadores` ya existe en la base con RLS, pero no tiene tipo,
  repository, ruta ni pantalla del lado del frontend. **No entra en `C-04`**: es "construir una
  pantalla nueva" (con su CRUD, tests y gateo), no "conectar una existente" (que es el corte de la
  serie de changes de integración backend↔frontend). Tampoco hay ninguna regla de negocio (`RN-`)
  sobre Prestadores en esta KB, ni una FK entre `prestadores` y `obra_social` en la migración que
  defina la relación (1:N, N:N, o ninguna). Se propone como change propio `prestadores-crud`.
- **Documento de Factura** — resuelto-en-frontend 2026-07-25 (`facturacion-ui`, FE-6, ver detalle
  completo más abajo): esta KB asume `Factura 1---N DocumentoFactura` (comprobante ARCA, CODEM,
  etc.). El docx no tiene esa tabla — Presupuesto y Autorización tienen un campo "Archivo" único
  cada uno, pero Factura no tiene ningún adjunto. El frontend implementó el checklist multi-documento
  (`FacturaDocumentos.tsx`, entidad `'factura'` de `EntidadDocumental`) con cartel `AvisoModeloDatos`.
  **Actualización 2026-08-07 (`integracion-documentos`, ver bullet "Documentos vs. esquema real de
  `C-03`" más abajo)**: la tabla `documento_factura` **ya existe** desde `C-03` — lo que sigue
  pendiente no es el schema, sino que `Factura` conecte a datos reales (`FacturacionRoute.tsx` sigue
  en `mockFacturaRepository`, swap parcial de Enzo del 2026-08-05); el cartel de la pantalla se
  actualizó para reflejar esto.
- **Plazo de cobro (90 días / 45 con amparo)** — resuelto-en-frontend 2026-07-25 (`facturacion-ui`,
  FE-6, ver detalle completo más abajo): sin campo explícito en Factura del docx (cartel en UI en
  Obras Sociales, ver `ObraSocialDetail`, y ahora también en Facturación). Regla de negocio real
  (RN-FA-04, RF-406), implementada como constantes configurables (`PLAZO_COBRO_DEFAULT_DIAS`,
  `PLAZO_COBRO_AMPARO_DIAS`, `PLAZO_ALERTA_VENCIDA_DIAS`) y función pura
  (`calcularFechaEstimadaCobro`), **pendiente de confirmar los tres valores y la precedencia
  amparo/obra social con el cliente** antes de sumar el campo a la BD.
- **Checklist / plantilla de factura / modalidad de facturación** — **resuelto 2026-07-31**
  (`integracion-obra-social`, C-04, ver bloque dedicado más abajo "Obras Sociales vs. esquema real
  de C-04"): el checklist ya se persiste relacional contra `obra_social.tipos_documento` (con
  `orden`/`requerido` como columnas propias de `requisitos_os`), y `plazoCobroDias`,
  `modalidadFacturacion`, `admitePagosParciales` y `plantillaFactura.campos`/`identificadorOrigen`
  ya son columnas/tabla reales de la base — no existen en el docx, pero son reglas de negocio
  reales (RN-FA-07/08) que se sumaron a la migración, no se descartaron por ausencia en el docx.
- **Vehículo — kilometraje/habilitaciones**: cartel en UI (Vehículos). En el docx viven en la tabla
  Mantenimiento (kilometraje actual + próximo vencimiento por fecha/km), no embebidos en Vehículo.
  **Actualización 2026-08-01** (reconciliación con `C-08-vehiculos-mantenimiento` de Enzo, ya
  mergeado a `main`, commit `f840a96`, ver
  `openspec/changes/integracion-conductores-vehiculos/design.md` §Reconciliación): el backend real
  terminó en un punto intermedio, ni el docx puro ni lo que este change tenía planeado. Habilitaciones
  VTV/RTO SÍ quedaron en tabla propia, `conductores.habilitaciones_vehiculo(id, vehiculo_id, tipo,
  fecha_emision, fecha_vencimiento)` (`20260730110000_schema_vehiculo_gaps.sql`) — exactamente la
  tabla que este change había decidido (D3, opción B) NO crear, prefiriendo derivar del historial de
  mantenimiento. **Actualización 2026-08-10 (versión final)**: se adoptó la tabla de Enzo por un
  tiempo, pero nunca se construyó ninguna pantalla para escribir en ella y la usuaria prefirió no
  duplicar la carga con un mantenimiento preventivo VTV/RTO — se volvió a D3 opción B, la tabla de
  Enzo queda sin consumidor real. Kilometraje: `kilometraje`
  quedó como columna propia del vehículo (nullable, sin default), pero
  `kilometrajeUltimoService`/`fechaUltimoService` SÍ se derivan — de la Edge Function, a partir del
  último registro `categoria='preventivo'` de `mantenimiento` — al revés de lo que planeaba este
  change (las tres iban a ser columnas propias). Se adopta la forma real de Enzo.
- **Gastos de Vehículo**: cartel en UI (Vehículos). En el docx el módulo de permisos que controla el
  acceso es "facturacion", no "conductores" — importa para las RLS policies. **Actualización
  2026-08-01**: en la implementación real de Enzo (`C-08-vehiculos-mantenimiento`,
  `20260730110000_schema_vehiculo_gaps.sql`) el gasto no es una tabla propia — es una fila de
  `conductores.mantenimiento` con `categoria = 'gasto'` — y queda gateado por `vehiculos`/
  `conductores`, no por `facturacion`. Esto contradice la lectura del docx de este mismo bullet y
  también la confirmación de la usuaria citada arriba en "Catálogo de módulos de permisos" (que
  asumía `facturacion.gastos_vehiculos` como tabla real bajo el módulo `facturacion`) — ambas
  confirmaciones se hicieron en paralelo, sin que ninguna supiera de la otra. Se adopta el
  esquema real de Enzo: `facturacion.gastos_vehiculos` queda sin usar (no se dropea).
- **Categoría de gasto inventada / entidad Mantenimiento faltante** — resuelto parcialmente en
  frontend 2026-07-31 (`openspec/changes/vehiculo-mantenimiento-registro/design.md`): `vehiculos-ui`
  había agregado `GastoVehiculo.categoria: 'mantenimiento' | 'reparacion' | 'service'`, valores **sin
  fuente** (ni en el docx, ni en esta KB, ni en el spec `vehiculo-gastos` vigente en ese momento). El
  docx tiene **dos entidades separadas**: "Gastos de Vehículo" (Vehículo, Monto, Fecha — sin
  categoría) y "Mantenimiento" (Vehículo, Categoría — "gasto, mantenimiento preventivo o
  mantenimiento correctivo" —, Fecha, Próximo vencimiento fecha, Kilometraje actual, Próximo
  vencimiento km). Este change: (1) quita `categoria` de `GastoVehiculo`, dejándolo igual al docx;
  (2) crea `MantenimientoRegistro` embebido en `Vehiculo.mantenimientos[]` con la categoría real de
  **dos niveles** — nivel 1 tipado con los tres valores del docx (`gasto | preventivo | correctivo`,
  aunque el alta de esta pantalla solo ofrece los dos de mantenimiento), nivel 2 de US-500
  (`knowledge-base/06_funcionalidades.md` L128-134): preventivo cerrado (cambio de aceite/filtros,
  VTV, RTO), correctivo abierto por `'otro' + detalle` (alternador, batería, frenos, embrague,
  cubiertas, + escape de catálogo). Señalizado con `AvisoModeloDatos` reescrito en la sección
  Mantenimiento de `VehiculoDetail.tsx`. Queda **pendiente de confirmar** (no se resuelve acá, ver
  design.md Open Questions 1, 3, 4 y 5):
  1. Si `TipoIntervencion` debería perder el valor `'gasto'` en vez de mantenerlo de solo lectura.
  2. ~~La duplicación del vencimiento VTV/RTO entre `Vehiculo.habilitaciones[].fechaVencimiento` y
     `MantenimientoRegistro.proximoVencimientoFecha`.~~ — **CERRADA (2026-08-10)**: se probó
     `conductores.habilitaciones_vehiculo` como tabla propia (2026-08-01, ver "Actualización" vieja
     de este punto) pero sin ninguna pantalla para escribirla, y se revirtió — `habilitaciones` se
     deriva de `mantenimientos` (`derivarHabilitaciones`), una sola fuente real. La tabla de Enzo
     queda en la base sin consumidor. Ver bullet "Vehículo — kilometraje/habilitaciones" más arriba
     y "Vehículos y Conductores vs. esquema real de `C-08/C-09`" más abajo.
  3. Si `MantenimientoRegistro` debería tener un `gastoId?` (o `GastoVehiculo` un `mantenimientoId?`)
     para vincular la intervención correctiva con el gasto que la pagó — el docx no tiene esa FK.
  4. ~~Si `GastoVehiculo.descripcion` (agregado del frontend, no está en el docx) queda como campo
     real de `gasto_vehiculo` en el backend.~~ — **CERRADA**: sí, `conductores.mantenimiento.descripcion
     TEXT` es columna real (`20260730110000_schema_vehiculo_gaps.sql`), no hay `gasto_vehiculo`
     separada (D9/D11 SUPERSEDED, ver `design.md`).
- ~~**Mantenimientos sin fuente en la API real** — GAP ABIERTO, necesita decisión de Enzo (detectado
  2026-08-01, reconciliación de `integracion-conductores-vehiculos` contra `C-08-vehiculos-mantenimiento`
  ya mergeado, commit `f840a96`): la Edge Function `supabase/functions/vehiculos/index.ts` devuelve
  `gastos` y `habilitaciones` (derivadas), pero no expone ningún array de eventos de mantenimiento
  preventivo/correctivo.~~ — **RESUELTO (2026-08-10)**: Enzo eligió el camino (a) (extender `toApi()`).
  Migración `20260810120000_vehiculo_mantenimiento_subtipo_detalle.sql` sumó las columnas
  `subtipo`/`detalle` que el modelo de dos niveles del frontend necesitaba; `toApi()` expone
  `mantenimiento` (singular, coincide con el embed real) con `replaceMantenimientos()` wireado en
  POST/PATCH. `SupabaseVehiculoRepository.ts` ya persiste y lee mantenimientos contra el servidor
  real — `VehiculoMantenimiento.tsx` tiene fuente de datos real desde entonces. Detalle completo en
  `openspec/changes/integracion-conductores-vehiculos/design.md` §Gap 4B.4 cerrado; ver también
  `CHANGES.md` §C-08.
- **Conductor**: cartel en UI (`ConductorDetail`). ~~Faltan campos que sí están en el docx:
  Domicilio, CUIL (acá solo hay Documento/DNI) y Estado (operando / fuera de servicio)~~ — resuelto
  2026-07-24: los 3 campos se sumaron al frontend (`Conductor.domicilio`, `Conductor.cuil`,
  `Conductor.estado`). ~~Queda pendiente: "Restricciones" acá es un catálogo cerrado
  (`RestriccionConductor[]`); en el docx es texto libre dentro de un único campo "Notas" junto con
  las observaciones — a coordinar con Enzo (backend) antes de cerrar C-09: decidir si se mantiene
  estructurado o se funde en un campo de texto.~~ — **RESUELTO 2026-08-01, decisión de diseño D6-B**
  (`openspec/changes/integracion-conductores-vehiculos/design.md`): gana el docx. `restricciones`
  desaparece del dominio por completo — se elimina el catálogo cerrado y todo pasa a un único campo
  de texto libre (`notas`/`observaciones`). Costo asumido: `C-10` pierde el filtro computable por
  restricción de perfil (RN-GL-03 pasa a depender de lectura humana de la nota, no de una validación
  automática).
- ~~**Asignación de Conductores a Vehículos**: cartel en UI (`ConductorDetail`, sección Flota). Acá la
  semana se guarda como etiqueta ISO (`semana: '2026-W30'`); el docx tiene Fecha de inicio y Fecha de
  fin de semana como dos campos de fecha independientes.~~ — **RESUELTO (`integracion-conductores-vehiculos`
  D7, 2026-08-11)**: el docx manda en estructura, así que se persiste el par de fechas
  (`conductores.conductores_vehiculos.fecha_init`/`fecha_fin_semana`) tal cual la base; el tipo del
  frontend no cambió — `AsignacionSemanal.semana` sigue siendo la etiqueta ISO, y la conversión
  bidireccional vive en `semanaIso.ts` (función pura, con tests dedicados a los casos borde: semana 1
  ISO, años de 53 semanas, cruce de fin de año, parseo de `DATE` sin zona horaria). No es una
  divergencia pendiente, es una traducción implementada. El cartel de `ConductorDetail.tsx` se
  reescribió para reflejarlo (§8.4 de `tasks.md`).
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
  **⚠️ Discrepancia nueva, sin resolver contra el docx (2026-08-05)**: `PersonaACargo.parentesco`
  (unión cerrada `'padre' | 'madre' | 'tutor_legal' | 'otro'`, obligatorio en el frontend) se agregó
  a **pedido directo de la usuaria**, no viene del docx — que no modela ningún campo de parentesco
  para esta entidad. Columna `pacientes.personas_a_cargo.parentesco` (`TEXT`, NULLable, migración
  `20260805130000_personas_a_cargo_parentesco.sql`) queda NULLable en la base por el mismo criterio
  que `dni` (discrepancia #10 arriba): filas ya existentes no tienen el dato y no hay valor por
  defecto razonable para backfillear. Cartel `AvisoModeloDatos` agregado de nuevo en
  `PacienteDetail.tsx` (sección "Personas a cargo") señalando esto. Pendiente: confirmar con quien
  mantiene el docx si el campo debe sumarse ahí también, o si queda como una extensión propia de
  esta implementación.
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
  **⚠️ Discrepancia nueva, sin resolver contra el docx (2026-08-06)**: `Direccion.descripcion`
  (texto libre, opcional) se agregó a **pedido directo de la usuaria** — para diferenciar dos
  direcciones del mismo `tipo` (ej. dos `terapia`: "Kinesióloga" vs "Fonoaudióloga") al elegir
  origen/destino de un tramo en Hojas de Ruta (`PacienteTramoCampos.tsx`). El docx no modela ningún
  campo de descripción para esta entidad. Columna `pacientes.direcciones.descripcion` (`TEXT`,
  NULLable, migración `20260806150000_direcciones_descripcion.sql`) — mismo criterio NULLable que
  `parentesco` (discrepancia de "Personas a Cargo" arriba): opcional también en el frontend, así
  que no hace falta backfill. Cartel `AvisoModeloDatos` agregado en `PacienteDetail.tsx` (sección
  Direcciones) señalando esto. Pendiente: confirmar con quien mantiene el docx si el campo debe
  sumarse ahí también.
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
  2. **Documentos por factura no existen en el docx** (known, ver bullet arriba) — **RESUELTA
     2026-08-07**: la tabla `documento_factura` ya existe desde `C-03` (ver bullet "Documentos vs.
     esquema real de `C-03`" más abajo); lo pendiente es que `Factura` conecte a datos reales, no el
     schema.
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

- **Facturación vs. esquema real de `C-07`** (detalle completo en
  `openspec/changes/integracion-facturacion/design.md` D12, propose 2026-08-12): comparación entre
  las 5 discrepancias bloqueantes declaradas arriba (bullet "Facturación y Cobros") y el schema
  `facturacion` real, verificado en vivo (`supabase db query --linked`, solo lectura, 2026-07-31)
  antes del swap de `SupabaseFacturaRepository`/`SupabaseCobroRepository`.

  **Cuatro de las cinco discrepancias declaradas ya no existen — la base las tenía resueltas antes
  de que este change empezara:**
  1. `asistencia_prestacion` — ✅ **CERRADA**: la tabla existe
     (`facturacion.asistencia_prestacion`, FK `factura_id → facturas ON DELETE CASCADE`, columnas
     `fecha`, `prestacion`, `dependencia`, `retorno`, `factura_sabados`), con RLS y trigger de
     auditoría.
  2. `documento_factura` — ✅ **CERRADA**: la tabla existe (`facturacion.documento_factura`, FK
     `factura_id → facturas ON DELETE CASCADE` + FK `id_tipo_documento → obra_social.tipos_documento
     ON DELETE RESTRICT`, `archivo_url NOT NULL`), con RLS y trigger de auditoría. El schema está
     resuelto; lo que sigue pendiente es el swap del repository (ver D8 más abajo).
  3. `fecha_estimada_cobro` — ✅ **CERRADA**: `facturacion.facturas.fecha_estimada_cobro DATE`
     existe como columna propia.
  4. `cantidad_km` — ✅ **CERRADA**: `facturacion.facturas.cantidad_km NUMERIC` existe como columna
     propia (junto a `valor_km`, que ya existía).

  **La quinta queda parcial:**
  5. El enum de `estado` — 🟡 **PARCIAL**: `facturacion.estado_factura` **sí** incluye `'facturado'`
     (el hueco original que motivaba la discrepancia), pero además conserva `'pendiente'` — un
     literal que el frontend nunca modeló (`EstadoFactura` tiene 4 valores, no 5). Se resuelve por
     mapeo, no por schema: `estadoDesdeBase('pendiente') → 'a-facturar'` en la lectura (tratándolo
     como sinónimo, igual que ya decidía `facturacion-ui`), y `estadoHaciaBase` nunca emite
     `'pendiente'` en la escritura. El enum real de la base **no se toca** — es governance CRÍTICO y
     los 5 literales (con espacios, no guiones) son los del docx.

  **Seis discrepancias NUEVAS, descubiertas al verificar el schema real antes de escribir el mapeo
  (ninguna estaba anticipada por el `design.md` de `facturacion-ui`):**

  N1. **`Factura.fechaFactura` sin columna** — el tipo del frontend tiene `fechaFactura?: string`
     (fecha de emisión) desde `facturacion-ui`, pero la base no tenía ninguna columna para
     persistirla. **Resuelta por este change**: `ALTER TABLE facturacion.facturas ADD COLUMN
     fecha_factura DATE` (nullable, sin default — una factura en `a-facturar` no tiene fecha de
     emisión, y eso es su significado, no un dato faltante). Sin esta columna,
     `estadoVencimientoFactura` (RF-406, alerta de vencida a los 60 días) perdía su punto de partida
     en cada recarga del navegador.
  N2. **El enum de `EstadoFactura` no coincide en formato ni cardinalidad con
     `facturacion.estado_factura`** — 4 literales con guiones vs. 5 con espacios. Ver el punto 5
     (parcial) arriba; es la misma discrepancia, elevada acá porque el `design.md` de
     `facturacion-ui` no la había registrado como estructural.
  N3. **13 campos que el tipo `Factura`/`AsistenciaPrestacion` declara requeridos son nullable en la
     base** (17 de las 19 columnas de `facturas`, todas menos `id` y `paciente_id`; además
     `asistencia_prestacion.dependencia`/`.retorno`). **No se resuelve con `NOT NULL`** — sería
     contract-breaking sobre un dominio CRÍTICO y requeriría backfill coordinado con backend. Se
     absorbe en el mapeo de lectura (`parseFacturaRow` aplica defaults explícitos: `?? ''` para
     texto, `?? 0` para numéricos) y se reporta a backend como decisión pendiente (ver
     `10_preguntas_abiertas.md`).
  N4. **`facturacion.presupuesto` y `facturacion.autorizacion` están gateadas por el módulo
     `presupuestos`, no `facturacion`, pese a que la migración commiteada
     (`20260724100005_schema_facturacion.sql`) dice explícitamente lo contrario** (con un comentario
     largo citando el docx). Verificado contra `pg_policies` en vivo. **No se resuelve acá** — es un
     hallazgo de D9, documentado también en `CHANGES.md` §C-06 porque bloquea
     `integracion-presupuestos`: sin resolverlo, cualquier cuenta con `facturacion: read/write` y sin
     `presupuestos: read` va a ver 0 autorizaciones en silencio, sin ningún error, y la validación de
     cupo (RN-FA-02) va a quedar desactivada de hecho para el perfil que más la necesita.
  N5. **Ninguna de las 9 foreign keys del schema `facturacion` tenía índice** (7 índices totales en
     el schema, las 7 primary keys, cero sobre FK) — viola la regla dura de indexar toda columna FK.
     **Se resuelve parcialmente**: este change agrega 6 índices sobre las FK de su propio dominio
     (`facturas.paciente_id`, `facturas.domicilio_id`, `asistencia_prestacion.factura_id`,
     `cobros.facturas_id`, `documento_factura.factura_id`, `documento_factura.id_tipo_documento`),
     sin `CONCURRENTLY` porque las 6 tablas tenían 0 filas al verificar (condición a re-chequear
     antes de aplicar cualquier migración futura sobre estas tablas). Las FK de `presupuesto` /
     `autorizacion` (`C-06`) y `gastos_vehiculos` (`C-08`) quedan fuera de alcance, reportadas pero
     no resueltas — mismo precedente que las FK hijas de Pacientes.
  N6. **10+ columnas y 2 tablas completas del schema `facturacion` (`cantidad_km`,
     `fecha_estimada_cobro`, `prestacion`, `mes_facturado`, `anio_facturado`,
     `dependencia_y_retorno`, `domicilio_id`, `identificador_origen`, `identificador_valor`,
     `asistencia_prestacion`, `documento_factura`) están aplicadas en la base real sin ninguna
     migración commiteada en el repo que las cree.** Es la **tercera vez consecutiva** que esta serie
     de changes encuentra este patrón (`integracion-pacientes` 1B.3, `integracion-obra-social` 1.3, y
     ahora este, con el dominio más crítico del sistema y el gap más grande hasta ahora). **No se
     resuelve acá** — es un problema de proceso, no de este change: quien clone el repo y corra
     `supabase db reset` obtiene un schema `facturacion` incapaz de sostener la app. Elevado a
     `10_preguntas_abiertas.md`.
  N7. **`facturas.autorizacion_id` es un agregado sobre el docx** (detalle completo en
     `openspec/changes/facturacion-seleccion-autorizacion/design.md` D1/D5, propose 2026-08-13): el
     docx **no prevé** ninguna referencia de la Factura a la Autorización. Se agrega igual —
     `facturas.autorizacion_id UUID REFERENCES facturacion.autorizacion(id)`, nullable, sin
     `UNIQUE` — para que la factura registre qué autorización la habilitó (relación **N:1**: una
     autorización genera una factura por período, sin filtro de "ya facturado este mes" — riesgo de
     negocio aceptado explícitamente, no un bug; ver `CHANGES.md §C-07`). **No se resuelve
     unilateralmente**: queda marcada para confirmar con el cliente / quien mantiene el docx. Cartel
     pendiente con `AvisoModeloDatos` en el paso 2 del wizard, a agregar junto con el selector real
     (bloqueado por la aplicación de las migraciones, ver `tasks.md` §1B/§3 del change).

     De paso, este change **retira** `prestadorNombre`/`prestadorDomicilio` del alta de factura:
     nunca fueron una discrepancia real con el docx (no tienen columna real en producción, ni en
     `facturaMapping.ts` ni en las RPC) — eran un remanente de un change ya revertido
     (`sacar-prestadores`) sin backend real detrás. Su baja es limpieza de frontend, no cambio de
     schema.

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
  (`SupabasePacienteRepository.ts`) en lugar del mock. Once discrepancias — la #1 quedó **resuelta**
  el 2026-07-31 (`tasks.md` §8), el resto sigue pendiente de confirmar con el cliente o con quien
  mantiene `docs/core/Traslados-Modelo-Datos.docx`, señalizadas con `AvisoModeloDatos` agrupado en
  `PacienteDetail.tsx` (y uno propio en `DireccionesEditor.tsx` para las de dirección):
  1. **`numeroAfiliado.formato`** — **resuelta (2026-07-31, versión final): es
     `ObraSocial.formatoAfiliado`, no un campo del paciente.** RF-106 manda: "el identificador de
     afiliado varía según la obra social". Una nota anterior en este mismo bloque decía que quedaba
     resuelto al revés (por cobertura, `coberturas_paciente.formato_afiliado`, citando una
     "confirmación de la usuaria" de `integracion-obra-social` D12 revertida) — esa confirmación
     **nunca pasó**, Enzo la desmintió el mismo día. La columna real es
     `obra_social.obra_social.formato_afiliado` (`20260731140000_schema_obra_social_formato_afiliado
     .sql`, reutiliza el enum `obra_social.formato_afiliado` ya creado por
     `20260729120000_schema_pacientes_gaps.sql`), expuesta en `ObraSocialForm.tsx` y persistida por
     `crear_obra_social_completa`/`actualizar_obra_social_completa`
     (`20260731150000_obra_social_rpc_formato_afiliado.sql`). `coberturas_paciente.formato_afiliado`
     sí existe de verdad en la base (confirmado por Enzo) pero queda **sin usar, no se dropea**
     (`pacientes.crear_paciente_completo`/`SupabasePacienteRepository.ts` siguen mandando un valor
     fijo ahí solo para satisfacer el `NOT NULL` sin default — bug `23502` corregido en
     `20260731130000_crear_paciente_completo_formato_afiliado.sql`, esa parte del fix sigue vigente).
     Cierra también IN-01 de `10_preguntas_abiertas.md` en su parte de esquema.
  2. **`numeroAfiliado.valor`** vive en `obra_social.coberturas_paciente.num_afiliado`, otro schema,
     gateado por el módulo `obra_social` — si la cuenta no tiene `obra_social: read`, el valor se
     lee degradado (vacío, con cartel), nunca se inventa ni se bloquea la ficha.
  3. ~~**`Direccion.localidad`** no tiene columna — no se persiste, se pierde al recargar.~~
     **Resuelto** (`20260729120000_schema_pacientes_gaps.sql` agregó `direcciones.localidad TEXT
     NOT NULL`; frontend actualizado el 2026-08-04 en `pacienteMapping.ts`/
     `SupabasePacienteRepository.ts` para leerla y escribirla).
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
11. **`accesorioMovilidad: AccesorioMovilidad[]`** vs. `pacientes.accesorios.tipo TEXT` libre +
       tabla de vínculo N:N, **resuelto por `catalogo-accesorios-movilidad` (2026-08-16)**: el
       catálogo maestro dejó de ser solo semilla y pasó a ser **gestionable** — el selector
       reutilizable (`AccesoriosMovilidadSelector`) da alta/edición/baja lógica inline; la migración
       `20260816090000_catalogo_accesorios_icono_activa.sql` agrega `icono` (clave del mapeo de
       iconos del design system, backfill `icono = tipo` por ser las 5 claves del seed) y `activa`
       (baja lógica, mismo criterio que `pacientes.prestaciones`), y amplía la policy de LECTURA del
       catálogo a los módulos `vehiculos` y `conductores` (docx: catálogo compartido por el Área de
       Conductores) manteniendo la escritura SOLO para pacientes. Los `tipo` desconocidos ya no se
       descartan en silencio: los selectores consumen el catálogo activo, y escribir un accesorio
       inexistente en el maestro aborta el alta con un error accionable en vez de guardar basura
       (contrato de `crear_paciente_completo`, `45001`).

  **Columnas que el backend debería agregar** para cerrar el punto 8 (ver también `CHANGES.md`
  §`C-05`): `amparo_judicial_aclaracion` (en `paciente` o en `clinicos`, a definir). Los puntos 1 y
  3 ya están resueltos — ver el detalle de cada uno arriba.

  **Además**, la función `pacientes.crear_paciente_completo` (alta atómica, ver más abajo en esta
  misma sección) documenta el contrato de escritura real; el punto 9 y el punto 11 tienen
  consecuencias directas sobre esa función (`vigente` no se escribe nunca; un `tipo` de accesorio
  inexistente en el maestro hace abortar la transacción completa con `45001`).

- **Vehículos y Conductores vs. esquema real de `C-08/C-09`** (detalle completo en
  `openspec/changes/integracion-conductores-vehiculos/design.md`, propose 2026-08-01, swap real
  Vehículos 2026-08-10, Conductores 2026-08-11): comparación entre los tipos `Vehiculo`/`Conductor`
  del frontend y el schema real que Enzo construyó en paralelo (`C-08-vehiculos-mantenimiento`,
  mergeado, commit `f840a96`), sin que ninguno de los dos supiera del otro al arrancar.

  **El mapa de permisos no es un solo módulo — no estaba documentado en ningún lado hasta acá.**
  `20260730140000_split_modulos_permisos.sql` reescribió las policies de RLS del schema
  `conductores`:

  | Tabla | Módulo que la gatea (RLS) |
  |---|---|
  | `conductores.conductores` | `conductores` |
  | `conductores.documentacion_conductores` | `conductores` |
  | `conductores.conductores_vehiculos` (asignación semanal) | **`vehiculos`** — se edita desde la pantalla de Conductores, pero el permiso que manda es el de Vehículos |
  | `conductores.vehiculo` | `vehiculos` |
  | `conductores.accesorios_vehiculo` | `vehiculos` |
  | `conductores.documentacion_vehiculo` | `vehiculos` |
  | `conductores.mantenimiento` (gastos + mantenimiento) | `vehiculos` |
  | `conductores.habilitaciones_vehiculo` | `vehiculos` (tabla real, sin consumidor — ver más abajo) |
  | `pacientes.accesorios` (catálogo, leído por Vehículos) | `pacientes` |

  **Esta tabla es la configuración de RLS, no necesariamente el gateo que se ejercita en la
  práctica** — depende de cómo cada dominio accede a los datos:
  - **Conductores** usa PostgREST + RPC directo (`SupabaseConductorRepository.ts`, `.from()`/`.rpc()`
    con el JWT de la sesión) — la RLS de la tabla **sí** decide, tal cual el mapa de arriba.
  - **Vehículos** usa la Edge Function `vehiculos` (`supabase.functions.invoke()`), que hace **un
    único chequeo grueso** `tiene_permiso('vehiculos', nivel)` al principio de la request y de ahí
    en más usa un cliente `service-role` que bypasea RLS por completo — incluida la lectura del
    catálogo de accesorios (`pacientes.accesorios`) y de gastos/mantenimiento. En la práctica, quien
    tiene `vehiculos: write` ve y escribe todo lo que la pantalla de Vehículos muestra, sin ningún
    gateo cruzado adicional (ni `pacientes: read` para accesorios, ni `facturacion: read` para
    gastos, pese a que el docx los ubica conceptualmente en otros módulos).

  **Resueltos por este change** (detalle en cada bullet de arriba/abajo de esta lista):
  Habilitaciones VTV/RTO se derivan del historial de mantenimiento, no de una tabla propia (ver
  bullet "Vehículo — kilometraje/habilitaciones"); gastos y categoría de mantenimiento en dos
  niveles con columnas reales (`monto`/`descripcion`/`subtipo`/`detalle` en
  `conductores.mantenimiento`); mantenimientos con fuente real en la API (cerrado 2026-08-10);
  semana de asignación persistida como dos fechas con conversión ISO pura (D7); colisión de
  asignación semanal bloqueada siempre por constraint; restricciones de perfil del conductor sin
  catálogo, texto libre en `observaciones` (D6-B).

  **Sigue abierto**: `Vehiculo.notas` no viaja en la respuesta de la Edge Function (existe en el
  dominio y en la base, `toApi()` nunca la incluye); campos obligatorios del alta de conductor y
  checklist de documentos, ambos a confirmar con el cliente (ver `CHANGES.md` §C-09).

- **Obras Sociales vs. esquema real de `C-04`** (detalle completo en
  `openspec/changes/integracion-obra-social/design.md`, propose 2026-07-31, apply 2026-07-31):
  comparación entre el tipo `ObraSocial` del frontend, el docx, y `20260724100003_schema_obra_social.sql`
  **más el schema real verificado en vivo** (`supabase db query --linked`, sin Docker) al conectar
  el repository real (`SupabaseObraSocialRepository.ts`). Quince discrepancias de la tabla D11 de
  `design.md`, la mayoría **resueltas por este change**:
  1. `nombre` ↔ `razon_social` (renombre) — resuelto, se mapea.
  2. `tipoComprobante` ↔ `tipo_comprobante` (renombre; además ya es un enum compartido
     `facturacion.tipo_factura` en la base, no `TEXT` libre con CHECK como se planeaba) — resuelto.
  3. `checklist: ChecklistItem[]` (array embebido) ↔ `requisitos_os` × `tipos_documento`
     (relacional, catálogo **compartido** con Pacientes y con Facturación) — resuelto: persistencia
     relacional, sin cambiar el tipo del frontend (`ChecklistItem.id` = `tipos_documento.id`, nunca
     `requisitos_os.id` — ver la función de escritura más abajo).
  4-5. Orden y obligatoriedad del checklist (`requisitos_os.orden`/`.requerido`) — resuelto (ya
     existían en la base real al momento de verificar, no hizo falta migrarlas).
  6-9. `plazoCobroDias`, `modalidadFacturacion`, `admitePagosParciales`, `plantillaFactura.campos[]`
     — resuelto: ya existían en la base real (columnas/tabla `plantilla_campo`, no
     `campos_plantilla_factura` como se había planeado — ver discrepancia nueva #17).
     ⚠️ **`plazoCobroDias` ya no aplica esta resolución**: el change `prestadores-crud`
     (2026-08-01) lo mueve a `Prestador` junto con `tipoComprobante` (ver discrepancia nueva #18)
     — provisorio, sin confirmar con Andrea. `modalidadFacturacion`/`admitePagosParciales` **no**
     se mueven, siguen resueltos acá tal como dice este bullet.
  10. `plantillaFactura.identificadorOrigen` (IN-01) — resuelto como columna configurable
     (`obra_social.identificador_origen`); la pregunta de fondo (qué campo va en la factura) sigue
     abierta, ver `10_preguntas_abiertas.md`.
  11. `codigo`, `direccion`, `telefono`, `condicion_iva` (columnas sin campo frontend) — resuelto,
     sumados al tipo y a la UI.
  12. **`cuit` ambiguo — NO resuelto**: la base tiene `obra_social.cuit` **y** `prestadores.cuit`
     como columnas distintas de tablas distintas, y el docx solo dice "CUIT del prestador/entidad
     pagadora" sin aclarar cuál. Cartel en `ObraSocialDetail.tsx`.
  13. `obra_social.prestadores` sin contraparte en el frontend — **decidido**: change propio
     `prestadores-crud` (ver bullet dedicado arriba).
  14. `condicion_iva` sin valores enumerados en ninguna fuente — **NO resuelto**, queda `TEXT` libre
     sin `CHECK`; pregunta abierta.
  15. `Paciente.numeroAfiliado.formato` (RN-ID-02, heredada de `integracion-pacientes`) — **cerrada
     el 2026-07-31, versión final: sí se deriva de la obra social**, tal como decidía D12
     originalmente y como pide RF-106 literal. Una nota anterior acá decía lo contrario (D12
     revertida, formato por cobertura) citando una "confirmación de la usuaria" que Enzo desmintió
     el mismo día — nunca pasó. Columna real: `obra_social.obra_social.formato_afiliado`
     (`20260731140000_schema_obra_social_formato_afiliado.sql`). Ver #16 para el detalle completo.

  **Dos discrepancias NUEVAS, descubiertas al verificar el schema real en vivo antes de escribir
  las migraciones de este change (tareas 1.1-1.4, `supabase db query --linked`, sin Docker) —
  ninguna de las dos estaba anticipada por `design.md`:**

  16. **⚠️ "D12 revertida" fue un error de proceso — corregido (2026-07-31): D12 restaurada.**
     Este bloque decía que, al verificar el schema real, se había encontrado que
     `obra_social.formato_identificador_afiliado` (D12) no existe y que en cambio
     `obra_social.coberturas_paciente.formato_afiliado` (enum, `NOT NULL`, sin default) ya existía
     por cobertura — y que "la usuaria confirmó aceptar la realidad ya construida", revirtiendo D12.
     **Esa confirmación nunca pasó.** Enzo desmintió el mismo día haber tenido esa conversación con
     Andrea, al releer RF-106 literal ("el identificador de afiliado... varía según la obra social").
     `coberturas_paciente.formato_afiliado` sí existe de verdad (confirmado por Enzo, no por el
     agente que escribió la nota original) — pero eso no cambia lo que pide RF-106.
     **Resolución final**: se agrega `obra_social.obra_social.formato_afiliado`
     (`20260731140000_schema_obra_social_formato_afiliado.sql`, reutiliza el enum
     `obra_social.formato_afiliado` ya creado por `20260729120000_schema_pacientes_gaps.sql`, no
     crea un tipo duplicado) y se cablea en `ObraSocialForm.tsx` +
     `crear_obra_social_completa`/`actualizar_obra_social_completa`
     (`20260731150000_obra_social_rpc_formato_afiliado.sql`). `coberturas_paciente.formato_afiliado`
     queda **sin usar, no se dropea** (no destructivo, mismo patrón que `facturacion.gastos_vehiculos`
     de C-08).
     **Consecuencia que sigue vigente sin cambios**: `coberturas_paciente.formato_afiliado` sigue
     siendo `NOT NULL` sin default, y `pacientes.crear_paciente_completo` no la completaba en su
     `INSERT` — cualquier alta de paciente con número de afiliado fallaba con `23502`. Ese bug se
     corrigió igual (`20260731130000_crear_paciente_completo_formato_afiliado.sql`, manda un valor
     fijo ahí ahora que la columna quedó sin uso real) — independiente de qué lado ganara esta
     discrepancia.
  17. **Nombres de tabla/columna reales distintos de los que `design.md` había planeado (no
     contradicción, solo desfasaje de nomenclatura)**: la tabla se llama `obra_social.plantilla_campo`
     (no `campos_plantilla_factura`) y la columna se llama `tipo_comprobante` (no `tipo_factura`,
     además ya retipada como el enum `facturacion.tipo_factura`). Ambas ya existían con RLS,
     policies y trigger de auditoría propios cuando se verificó el schema — no son tablas/columnas
     que este change haya creado. El mapeo del frontend (`obraSocialMapping.ts`) usa los nombres
     reales, no los que `design.md` había asumido.

  18. **⚠️ "Condiciones particulares por prestador" (US-300) — movida a Prestador, provisorio, SIN
     confirmar con Andrea** (change `prestadores-crud`, propose 2026-08-01, apply del frontend el
     mismo día). Este bullet reemplaza el estado anterior de esta nota ("resuelta en ObraSocial",
     ver 6-9 arriba): US-300 dice literalmente *"se registra plazo de cobro, tipo de comprobante
     (A/B/C) y demás condiciones particulares **por prestador**"*, pero `plazoCobroDias`/
     `tipoComprobante` habían quedado implementados como columnas de `obra_social.obra_social`
     (`integracion-obra-social`, misma mañana) — la misma clase de discrepancia que #16
     (`formato_afiliado`): la palabra literal del requisito apunta a una entidad y lo implementado
     quedó en otra. **Resolución provisoria**: `plazoCobroDias`/`tipoComprobante` se mudan al tipo
     `Prestador` nuevo (`frontend/src/shared/types/prestador.ts`); `modalidadFacturacion`/
     `admitePagosParciales` se quedan en `ObraSocial` (son preferencias de la obra social pagadora,
     no condiciones fiscales del prestador — confirmado con Enzo, no con Andrea). Migración
     `20260801100000_prestadores_condiciones.sql`: **aditiva únicamente** —
     `ALTER TABLE obra_social.prestadores ADD COLUMN plazo_cobro_dias, tipo_comprobante` — **no
     escrita** contra `obra_social.obra_social` (el `DROP COLUMN` queda solo documentado en
     comentario dentro de `prestadores-crud/design.md` D3, nunca como archivo `.sql`, hasta que
     Andrea confirme el modelo). Consecuencia directa: `FacturaForm.tsx` pierde su fuente real de
     default para `tipoComprobante` (antes `obraSocial.tipoComprobante`) — queda con un fallback
     fijo `TIPO_COMPROBANTE_DEFAULT = 'A'` marcado `⚠️ PROVISORIO`, documentado como pendiente en
     vez de resuelto. Ver `10_preguntas_abiertas.md` y entidad `Prestador` arriba.

  Además, esta verificación encontró que el catálogo `tipos_documento` es compartido por **tres**
  entidades, no dos: `pacientes.documentos.id_tipo_documento` **y**
  `facturacion.documento_factura.id_tipo_documento` (esta última tabla no estaba documentada en
  ningún lado de esta KB hasta ahora) referencian `tipos_documento` con `ON DELETE RESTRICT`. Un
  tipo de documento mal cargado desde el editor de checklist de Obras Sociales queda para siempre
  si algún documento de paciente **o de factura** ya lo referencia.

  El **checklist manual con cuentas reales de la sección 1B.8/8.5 de `tasks.md` sigue pendiente**
  (bloqueado por falta de Docker/credenciales de escritura en el sandbox del agente) — las dos
  migraciones (`20260731120000_obra_social_config_facturacion.sql`,
  `20260731120001_obra_social_rpc.sql`) están redactadas y revisadas, pendientes de que la
  usuaria/Enzo las aplique.

- **Hoja de Ruta / Recorrido vs. esquema real de `C-10`** (detalle completo en
  `openspec/changes/integracion-hojas-de-ruta/design.md`, propose 2026-08-04, apply 2026-08-04):
  comparación entre la entidad `HojaDeRuta`/`Recorrido` del frontend y el docx, que **no tiene
  entidad "Hoja de Ruta"**: solo "Recorridos" (agenda habitual del paciente, sin vehículo/conductor)
  e "Historial de Recorridos" (viaje realizado, ligado a Paciente + Vehículo, sin campo Conductor).
  Los tres checkpoints de `design.md` se resolvieron con veredicto de la usuaria/Enzo registrado en
  `openspec/changes/integracion-hojas-de-ruta/tasks.md` §0.1 (2026-08-04):
  - **Checkpoint 0 — swap parcial, ahora**: `HojaDeRuta` y `Paciente` pasan a reales en
    `HojaDeRutaRoute.tsx`; `Vehículo`/`Conductor` siguen mock hasta que aterrice
    `integracion-conductores-vehiculos` (hoy bloqueado en la fuente real de mantenimientos, decisión
    de Enzo sin fecha).
  - **Checkpoint 1 — repropuesta de `historial_recorridos` como paradas + dos tablas nuevas de
    agrupación con `conductor_id NOT NULL`**: `pacientes.hoja_de_ruta` (nueva) `1---N`
    `pacientes.recorrido` (nueva, `conductor_id NOT NULL REFERENCES conductores.conductores(id)`)
    `1---N` `pacientes.historial_recorridos` (expand aditivo: `+recorrido_id`, `+tramo`, `+orden`,
    `+hora_estimada`). `historial_recorridos` ya tenía exactamente la forma de una parada
    (`paciente_id`, `id_dir_inicial`, `id_dir_final`, `id_vehiculo`) y era placeholder puro — cero
    consumidores que romper. `conductor_id` hereda la decisión ya tomada del lado frontend
    (`hojas-de-ruta-ui`, RN-VE-01/02): sin el campo el sistema no puede decir qué chofer hizo cada
    viaje. Sigue siendo formalmente una discrepancia contra el docx **resuelta con nota de decisión,
    no cerrada por default** — la coordinación con el dueño del docx queda anotada en `tasks.md` 7.4.
    Por regla dura aditiva no se dropea `historial_recorridos.id_vehiculo` (hoy redundante con
    `recorrido.vehiculo_id`); la función de escritura los mantiene sincronizados. `vehiculo_id`/
    `conductor_id` son `ON DELETE RESTRICT` (el historial no se arrastra al borrar), mismo criterio
    que las FK de `direcciones`.
  - **Checkpoint 2 — sin geocoding por ahora**: `ParadaRecorrido.coordenadaOrigen` nunca vino de
    geocoding real (fixture del lado cliente desde `hojas-de-ruta-ui`, Decisión 6) y ni
    `pacientes.direcciones` ni el esquema nuevo tienen columnas `lat`/`lng`. El mapeo real deja
    `coordenadaOrigen` como `undefined` siempre; `RecorridoMapa.tsx` muestra su estado vacío ya
    contemplado con un `AvisoModeloDatos` propio explicando que es por diseño — regresión de UX
    aceptada y documentada, no descubierta en QA.

- **Presupuestos / Autorizaciones vs. esquema real de `C-06`** (detalle completo en
  `openspec/changes/integracion-presupuestos/design.md` §D13, propose 2026-08-02, apply en curso
  2026-08-05 — el swap ya está en vivo, la verificación manual con cuentas reales todavía está
  pendiente, ver nota de estado al final de este bloque): comparación entre `Presupuesto`/
  `Autorizacion` del frontend y `facturacion.presupuesto`/`facturacion.autorizacion`
  (`20260724100005_schema_facturacion.sql` + `20260729130000_schema_autorizacion_monto_vigencia.sql`
  + `20260730120000_revert_presupuesto_archivo_meta.sql` +
  `20260730140000_split_modulos_permisos.sql`), más el contrato real de las Edge Functions
  `presupuestos`/`autorizaciones` (ver sección dedicada más abajo). Trece discrepancias de la tabla
  D13 de `design.md` — nueve **resueltas**, cuatro **abiertas**:
  1. **`Presupuesto.archivo: ArchivoAdjunto { nombre, cargadoEn }` — ABIERTA (parcialmente
     resuelta)**: la base tiene una sola columna, `archivo_url TEXT`; las columnas de metadatos
     (`archivo_nombre`, `archivo_cargado_en`) las dropeó a propósito `20260730120000`. Peor aún,
     **hoy nada sube el archivo**: no hay bucket de Storage para este dominio y el formulario nunca
     lo manda al servidor. Se resuelve parcialmente con mapeo no destructivo (lectura: `archivo_url`
     → `{ nombre: último segmento decodeURIComponent, cargadoEn: fechaEmision }`; escritura: un
     archivo recién elegido en el input **nunca** produce `archivoUrl`, solo viaja si vino de una
     lectura previa) más `AvisoModeloDatos` en `PresupuestoForm.tsx` diciendo que el archivo no se
     guarda. La subida real a Storage queda como change propio futuro
     (`presupuestos-documentacion-storage`).
  2. **`Autorizacion.archivo: ArchivoAdjunto` — ABIERTA (parcialmente resuelta)**: mismo caso que #1,
     sobre `autorizacion.archivo_url`. Mismo mapeo no destructivo, mismo `AvisoModeloDatos` en
     `AutorizacionForm.tsx`.
  3. **`Presupuesto.monto: number` vs. `numeric NULL` — RESUELTA**: fila con `monto` nulo o no
     numérico se descarta del listado (no se inventa `0`, que se leería como "presupuesto de cero
     pesos").
  4. **`Presupuesto.fechaEmision: string` vs. `date NULL` — RESUELTA**: mismo criterio, fila sin
     fecha se descarta.
  5. **`Autorizacion.estado` (requerido) vs. `NULL DEFAULT 'pendiente'` — RESUELTA**: nulo o fuera de
     la unión `EstadoAutorizacion` se mapea a `'pendiente'` (es el default real de la columna, no una
     invención del frontend).
  6. **`montoAutorizado?`/`vigenciaDesde?` documentados como "campos que el frontend agrega sobre el
     docx, pendientes de confirmar con backend" — RESUELTA**: son columnas reales desde `C-06`
     (`monto_autorizado`, `vigencia_desde`). El comentario del tipo se actualizó y el cartel
     `⚠️ Pendiente de confirmar con el cliente/backend` de `AutorizacionForm.tsx` (`presupuestos-ui`,
     ver `ROADMAP-FRONTEND.md` FE-4) se retiró; se conservó, reformulada, la parte que sigue siendo
     cierta ("estos campos no existen en el docx original").
  7. **RN-PA-01 solo en UI (`validarAutorizacion`) — RESUELTA**: el trigger
     `facturacion.validar_autorizacion_monto` ahora la aplica de verdad en el servidor; el rechazo
     (`RAISE EXCEPTION 'RN-PA-01: monto_autorizado (%) no puede superar el presupuesto (%)'`) se
     traduce a `La autorización no puede superar el monto del presupuesto.` en
     `edgeFunctionErrors.ts`. La función pura de UI queda como espejo, no como única defensa.
  8. **Policies gateadas por el módulo `presupuestos`, no `facturacion` — RESUELTA (documentación)**:
     ver sección dedicada más abajo (§Presupuesto/Autorizacion) para el detalle completo, incluida la
     consecuencia práctica para perfiles con `facturacion` sin `presupuestos`.
  9. **3 FK sin índice — RESUELTA**: `presupuesto.paciente_id`, `presupuesto.obra_social_id` y
     `autorizacion.presupuesto_id` no tenían índice (`pg_indexes`, 2026-08-02: el schema `facturacion`
     solo tenía sus 7 primary keys). Se agregaron los 3 vía
     `20260802100000_presupuesto_autorizacion_indices.sql` (`CREATE INDEX IF NOT EXISTS`, sin
     `CONCURRENTLY` — las dos tablas tenían 0 filas), **aplicada por la usuaria/Enzo el 2026-08-05** y
     verificada existente contra el proyecto real.
  10. **Repositories vía RLS directo (los cuatro changes de integración previos) vs. Edge Functions
      deployadas — ABIERTA, declarada y no resuelta**: este change consume
      `supabase.functions.invoke('presupuestos'|'autorizaciones', …)` en vez de PostgREST + RLS
      directo, porque el contrato de esas dos funciones ya coincide con el dominio y evita remapear
      snake_case en las dos direcciones. Consecuencia: el proyecto queda con **dos patrones de
      integración conviviendo** sobre las mismas tablas, sin que ningún change lo haya declarado
      antes. No se unifica acá — es un change transversal. Pregunta abierta con decisor nombrado en
      `10_preguntas_abiertas.md`.
  11. **`FacturacionRoute.tsx` sigue en mocks — ABIERTA, coordinación con `integracion-facturacion`**:
      después de este change la app tiene **dos fuentes distintas para la misma entidad**
      (autorización): Presupuestos ya lee/escribe real, Facturación sigue validando cupo contra el
      fixture de `localStorage`. Se decidió (D11) swapear Presupuestos primero, dejando
      `FacturacionRoute.tsx` sin tocar — es alcance de `integracion-facturacion`, meterlo acá
      arrastraría un change de governance CRÍTICO adentro de uno ALTO. Lo que sí queda cerrado: la
      trampa de RLS que `integracion-facturacion` D9 dejó anotada (ver #8 arriba).
  12. **Interfaces sin `delete()` vs. Edge Functions con `DELETE` — ABIERTA**: las dos funciones
      soportan borrado; `PresupuestoRepository`/`AutorizacionRepository` no lo exponen y ninguna
      pantalla lo ofrece. Agregar borrado es funcionalidad nueva, no swap de backend — no se hace
      acá. Pregunta abierta con decisor nombrado en `10_preguntas_abiertas.md`.
  13. **`Presupuesto` = monto único vs. la lectura anterior de la KB ("estimación anual por
      prestación") — NO SE REABRE**: ya se resolvió a favor del docx en `presupuestos-ui`
      (2026-07-24); este change no vuelve sobre esa decisión.
  14. **RN-GL-02 (rastro de alta/edición) solo parcialmente cumplida para este módulo — ABIERTA,
      hallazgo de la verificación con cuentas reales**: confirmado por `tasks.md` 1B.4(i)/7.6
      (2026-08-06) que `auditoria.logs` sí registra el `INSERT`/`UPDATE` de un presupuesto (el *qué*),
      pero `usuario_id` llega `null` en ambas filas (el *quién*, ausente). Causa raíz, leída en
      `20260724100001_schema_modulos_auditoria.sql`: el trigger de auditoría usa `auth.uid()`, que no
      resuelve nada cuando la escritura llega vía la Edge Function operando con `service_role` (D3) —
      no hay sesión de usuario a nivel Postgres en ese camino, a diferencia de las escrituras vía
      PostgREST + RLS directo de los otros cuatro changes de integración. Es un costo de D3 que
      `design.md` no había anotado explícitamente. Pregunta abierta con decisor nombrado en
      `10_preguntas_abiertas.md`.

  **Nota de estado (2026-08-06, actualizada al cierre del change)**: las resoluciones #3-#9 están
  escritas y verificadas por lectura contra el proyecto real (schema, trigger, policies, índices), y
  el swap de `PresupuestosRoute.tsx` a los repositories reales está en producción (`tasks.md` §4).
  La verificación manual de las dos Edge Functions con tres cuentas reales (`tasks.md` 1B.4) **ya se
  corrió** (2026-08-06, vía `curl` directo con tokens de sesión reales, no clickeada en el navegador —
  ver `tasks.md` 7.5) y confirmó en particular el punto (c): un perfil con `facturacion` sin
  `presupuestos` recibe **403 explícito** y no `200 []` al listar — la resolución de #8 ya está
  verificada por comportamiento observado en producción, no solo por lectura de `pg_policies`. El
  único residual que dejó esa verificación es el nuevo ítem **#14** de arriba (`usuario_id null` en
  auditoría).

- **Documentos vs. esquema real de `C-03`** (detalle completo en
  `openspec/changes/integracion-documentos/design.md` y `tasks.md` §0, propose 2026-08-05, apply
  2026-08-07): comparación entre el checklist documental compartido (`DocumentChecklist`/
  `useDocumentChecklist`, FE-1) y las 4 tablas reales de `C-03` — `pacientes.documentos`,
  `conductores.documentacion_vehiculo`, `conductores.documentacion_conductores`,
  `facturacion.documento_factura` (el schema de la tabla no siempre coincide con el módulo de
  permisos que la gatea, ver Checkpoint 3 abajo). Cinco checkpoints con veredicto de la usuaria
  (2026-08-05, `tasks.md` §0.1), todos **RESUELTOS**:
  1. **Checkpoint 0 — alcance del swap**: solo `PacientesRoute.tsx` se conecta a Storage/Postgres
     reales (`SupabaseDocumentoRepository`); Vehículos, Conductores y Facturación siguen con
     `mockDocumentoRepository` hasta que esas entidades tengan `entidadId` real
     (`integracion-conductores-vehiculos`, `integracion-facturacion`) — señalizado con
     `AvisoModeloDatos` en las tres pantallas (`tasks.md` §6).
  2. **Checkpoint 1 — `itemId` heterogéneo entre las 4 tablas**: en vez de normalizar el schema
     (columnas `TEXT` a `UUID FK`, no aditivo), `documentoMapping.ts` acepta la heterogeneidad con
     una entrada de configuración por entidad (`CONFIG_ENTIDAD`).
  3. **Checkpoint 2 — columnas de metadatos faltantes**: migración aditiva
     `20260806190000_documentos_nombre_archivo.sql` agrega `nombre_archivo TEXT` a las 4 tablas y
     `created_at TIMESTAMPTZ DEFAULT NOW()` a `documentacion_conductores` (las otras tres ya lo
     tenían).
  4. **🔴 Checkpoint 3 — bucket `documentos-vehiculos` gateado por el módulo equivocado (CRÍTICO)**:
     las 4 policies de `storage.objects` pedían `modulos.tiene_permiso('conductores', …)` mientras
     su tabla (`conductores.documentacion_vehiculo`) ya vivía bajo el módulo `vehiculos` desde el
     split del 30/07 — cualquier cuenta con `vehiculos` pero sin `conductores` no podía subir ni
     bajar fotos de vehículo. Repunteado a `vehiculos` en
     `20260805140000_fix_documentos_vehiculos_rls_modulo.sql`, verificado contra `pg_policies`;
     auditoría retroactiva de accesos: 0 cuentas afectadas.
  5. **Checkpoint 4 — precondición de datos**: `obra_social.requisitos_os` tenía 0 filas (el
     checklist de todo paciente renderizaba vacío); la usuaria lo carga con el `ChecklistEditor`
     existente antes de la verificación manual de `tasks.md` §8.

  Una discrepancia menor adicional, sin cartel dedicado propio (ya cubierta por el
  `AvisoModeloDatos` de alcance del swap, Checkpoint 0 arriba): **`archivo_url` no guarda una URL**
  — los 4 buckets son privados (una URL pública no existiría y una firmada expira), así que la
  columna guarda la **clave dentro del bucket**, no una URL. Renombrarla sería destructivo sobre 4
  tablas ya aplicadas; se documenta con `COMMENT ON COLUMN` en la migración del Checkpoint 2 en vez
  de resolverse.

  **Nota de estado (2026-08-07)**: el swap real de `PacientesRoute.tsx` está en producción
  (`tasks.md` §5); Vehículos/Conductores/Facturación muestran `AvisoModeloDatos` explicando que la
  subida sigue simulada (`tasks.md` §6). La descarga de documentos (`createSignedUrl`) queda fuera
  de alcance de este change — ver `10_preguntas_abiertas.md`. Verificación manual con cuentas
  reales (`tasks.md` §8) todavía pendiente.

- **Documentación del paciente por actividad — sin columna real** (`documentos-checklist-por-actividad`,
  propose+apply 2026-08-07): el frontend agrupa el checklist documental del paciente por actividad
  (`Direccion` del paciente cuyo `tipo` no es `'domicilio'`: escuela, terapia(s), club) vía un campo
  opcional `agrupacionId?` agregado al contrato compartido `DocumentoAdjunto`/`DocumentoRepository`
  (usado solo por Pacientes; Vehículos/Conductores/Facturación siguen pasando `undefined`, sin cambio
  de comportamiento). A diferencia de la cardinalidad múltiple por ítem (`pacientes-documentos-multiples`,
  RN-FA-09), que la base real ya soportaba sin migración, **esta dimensión NO tiene respaldo real
  hoy**: la tabla `pacientes.documentos` (real, `C-03`) no tiene ninguna columna de dirección/actividad
  — solo `paciente_id`, `id_tipo_documento`, `archivo_url`, `created_at`. Guía de migración futura
  (Checkpoint (h) de `documentos-checklist-por-actividad/design.md`, no vinculante, no aplicada en
  este change): `ALTER TABLE pacientes.documentos ADD COLUMN direccion_id UUID REFERENCES
  pacientes.direcciones(id) ON DELETE ...` — aditiva y nullable (`NULL` = documentación general del
  paciente, coherente con el bloque "General" del frontend). La cláusula `ON DELETE` queda
  **pendiente de decidir en el futuro change de integración** (`integracion-documentos` o su
  continuación): `RESTRICT` si se termina bloqueando la eliminación de una dirección con documentos,
  `SET NULL` si los documentos vuelven al bloque general al quitarla (comportamiento elegido en el
  frontend de este change, Checkpoint (e) — advertir y confirmar, no bloquear), `CASCADE` descartado
  explícitamente (borraría documentación clínica en silencio). Señalizado con `AvisoModeloDatos` en la
  sección de documentación de `PacienteDetail.tsx` (`tasks.md` 8.5).

  **Nota de estado (2026-08-10/11, hallazgo de `documentos-transferencia-actividad`, tasks.md 1.5)**:
  la columna **ya existe**. `20260807010000_documentos_direccion_id.sql` la agregó (`direccion_id
  UUID REFERENCES pacientes.direcciones(id) ON DELETE RESTRICT`, nullable) — verificado contra la
  migración real, no asumido. Esta entrada y el `AvisoModeloDatos` de `PacienteDetail.tsx` (línea
  ~250, "todavía no tiene respaldo en el modelo real... no tiene ninguna columna de
  dirección/actividad hoy") quedaron **desactualizados** por ese `apply` posterior: ya no reflejan
  el estado real de la base. Corregirlos (reescribir o retirar el bullet de arriba y el
  `AvisoModeloDatos` correspondiente) es una edición de un artefacto de OTRO change ya archivado —
  **no se resuelve en este apply**, se deja anotado para quien lo toque después. `ON DELETE` quedó
  en `RESTRICT` (no `SET NULL` como preveía la guía de arriba, ni `CASCADE`).

- **Vinculación actividad → documentación, exportación y transferencia — requerimiento incompleto,
  no discrepancia de modelo** (`documentos-transferencia-actividad`, propose 2026-08-10, apply
  parcial 2026-08-10/11): punto 3 de la Ronda 2 de feedback de la clienta (Andrea Pastor,
  `docs/cambios/cambios2-requerimientos.pdf`). El texto original cierra con *"el cliente enviará un
  video mostrando este flujo"* — el video **no llegó** (verificado también contra
  `TODO-video-revision.txt`). Governance CRÍTICO (mismo dominio que sus tres predecesores
  archivados; primera operación del proyecto que muta la ubicación de un documento clínico ya
  cargado).

  **Qué se implementó en esta pasada (veredicto confirmado por la usuaria, 2026-08-10,
  `tasks.md` §0.2 — no provisorio, no pendiente del video)**:
  - **Exportar** (3.b): originalmente una vista imprimible (PDF vía Ctrl+P) de la documentación de
    una actividad puntual, distinguiendo ítems cargados de faltantes; después ganó en paralelo un
    `.zip` con los archivos reales. **Revertido (2026-08-11)**: la usuaria sacó por completo la
    vista imprimible ("siento que no tiene utilidad") — "Exportar" arma únicamente el `.zip` con
    los archivos reales de la actividad. Ver `tasks.md` §0.2/§2/§11/§13/§14 del change.
  - **Transferir** (3.c): reasignación de un documento ya cargado entre actividades del mismo
    paciente (o el bloque "General"), quinto método `transferirAgrupacion` en `DocumentoRepository`,
    `UPDATE` de `direccion_id` sin tocar Storage. La transferencia queda registrada en
    `auditoria.logs` (origen/destino en `datos_viejos`/`datos_nuevos`, quién en `usuario_id`, cuándo
    en `created_at`) por el trigger `trg_audit_documentos` **ya existente** sobre
    `pacientes.documentos` (`20260724100004_schema_pacientes.sql:169`) — no hizo falta ninguna
    migración nueva para esto, el trigger es genérico y ya cubría cualquier `UPDATE`.

  **Qué sigue abierto, bloqueado por el video (Checkpoint (a), `design.md`)**: la navegación
  propiamente dicha — que "marcar una actividad" (identificada por su domicilio) lleve a su bloque
  de documentación (3.a). El texto admite tres lecturas incompatibles (acción explícita por fila /
  selección persistente que filtra / deep-link desde Hojas de Ruta) y **no se elige ninguna
  adivinando**: esta pasada de apply deja 3.a explícitamente sin implementar (`tasks.md` §3/§4 sin
  marcar), declarado en pantalla vía `AvisoPendienteCliente` en la sección de documentación de
  `PacienteDetail.tsx`. Se retoma cuando el video llegue.

  **Qué se evidencia para cerrar (a)**: el video prometido por la clienta, mostrando el flujo real
  de "marcar una actividad" → documentación. Sin él, no se elige entre las tres lecturas.

  **Deuda detectada, no resuelta en este apply**: el requisito vigente de
  `openspec/specs/documento-contract/spec.md` *"El contrato `DocumentoRepository` pasa a tener dos
  implementaciones"* quedó desactualizado — habla de *"las mismas **tres** firmas"* (hoy son
  **cinco**, contando `resolverPrevisualizacion` y este mismo `transferirAgrupacion`) y de *"la misma
  semántica de **reemplazo**"* con el escenario *"existe exactamente **un** `DocumentoAdjunto` para
  ese `itemId`"*, que el sistema **ya no cumple ni debe cumplir** desde `pacientes-documentos-
  multiples` (acumulación real, sin reemplazo). Corregirlo es una edición del spec principal, no un
  delta de `documentos-transferencia-actividad` — se deja anotado, no se arregla acá.

  **Herencia hacia `openspec/changes/documentos-checklist-items-por-actividad/`** (change en curso
  de otra línea de trabajo, propuesto y sin aplicar al momento de escribir esto — **no se edita ni
  se coordina acá**): ese change hace que el contenido del checklist dependa del tipo de actividad.
  Hoy transferir un documento entre actividades es seguro porque **todos** los bloques reciben los
  mismos ítems (los de la obra social) — cualquier `itemId` válido en el origen lo es en el destino.
  Cuando ese change se aplique, transferir de una terapia a una escuela puede aterrizar en un
  `itemId` que la escuela no tiene. `design.md` Checkpoint (e) de este change ya lo previó y quedó
  sin resolver a propósito (VEREDICTO opción C — "no hacer nada ahora", con opción B — "permitir y
  marcar el ítem como no aplicable" — anotada como forma futura): **el punto de decisión es de quien
  aplique `documentos-checklist-items-por-actividad` en segundo lugar**, no de este apply.

- ⚠️ **Ítems de checklist propios por tipo de actividad — supuesto del EQUIPO, no feedback textual de
  la clienta** (`documentos-checklist-items-por-actividad`, propose+apply 2026-08-10/11): tabla nueva
  `obra_social.requisitos_actividad (id, tipo_lugar pacientes.tipo_direccion, tipo_documento_id FK →
  obra_social.tipos_documento, requerido BOOL, orden INT, UNIQUE(tipo_lugar, tipo_documento_id))`,
  **global por tipo de actividad** (sin `obra_social_id` — 5 listas en total, una por valor de
  `pacientes.tipo_direccion` distinto de `domicilio`), gateada por el mismo módulo `obra_social` que
  `requisitos_os`. En cada bloque de actividad de `PacienteDocumentos.tsx`, sus ítems se combinan
  (`combinarItemsDeActividad`, `actividadDocumental.ts`) con los de la obra social: dedup por
  `tipo_documento_id` compartido, el más estricto gana en `requerido`, el nombre de la obra social
  gana ante conflicto. **Origen**: hipótesis de la usuaria (Delfina) — *"yo creería que cada actividad
  define los suyos… conviven, es un complemento"* — **NO** transcripción textual de Andrea Pastor, a
  diferencia de los tres refinamientos hermanos anteriores de esta misma pantalla
  (`pacientes-documentos-multiples`, `documentos-previsualizacion`, `documentos-checklist-por-
  actividad`), que sí lo son. **Default**: configuración vacía en las 5 listas — mientras nadie cargue
  nada desde `/documentacion-por-actividad`, el comportamiento es **bit a bit idéntico** al de antes
  de este change (verificación manual pendiente, `tasks.md` §9.1). **Estado de la confirmación**: sin
  veredicto textual de Andrea al momento de aplicar — ver la nota `⚠️` sobre RN-FA-08/RN-FA-10 en
  `05_reglas_de_negocio.md` y el `AvisoModeloDatos` de `PacienteDetail.tsx`. Con veredicto afirmativo
  futuro: se agrega **RN-FA-11** (no se reescribe la 08, que sigue siendo verdad para el eje "por obra
  social") y esta nota se cierra (`tasks.md` 8.5).

  **Interacción con `documentos-transferencia-actividad` (cierra el "Herencia hacia..." de arriba)**:
  el riesgo que esa nota anticipó (transferir un documento a una actividad cuyo checklist combinado no
  incluye su `itemId`) quedó resuelto **del lado de `DocumentChecklist.tsx`, no de este change**: ese
  componente compartido ya muestra cualquier documento cuyo `itemId` no matchea ningún ítem vigente en
  una sección aparte ("Otros documentos"), sin ocultarlo ni bloquear la pantalla — la opción B que
  `design.md` Checkpoint (e) de `documentos-transferencia-actividad` había dejado anotada como forma
  futura, implementada antes de archivar ese change.

- **`presupuesto.prestacion_id` (columna nueva) — decidido, NO es reapertura de #13**
  (`openspec/changes/presupuesto-prestaciones/design.md` §D5, propose+apply 2026-08-12): el docx no
  vincula `Presupuesto` con ninguna prestación. Se agrega una FK **opcional**
  (`facturacion.presupuesto.prestacion_id UUID NULL REFERENCES pacientes.prestaciones(id)`) para
  soportar obras sociales con `modalidad_facturacion = 'por-prestacion'`, donde cada prestación
  genera su propio presupuesto (con su propio `monto` único y su propia autorización 1:1, sin
  cambios). **`monto` sigue siendo un importe único y nunca un desglose persistido**, exactamente
  como fijó la discrepancia **#13** de "Presupuestos / Autorizaciones vs. esquema real de `C-06`"
  arriba — esta entrada **cita** la #13, no la edita ni la reabre. En modalidad `general` la columna
  queda `NULL` y el desglose por prestación **solo existe en el estado del formulario**
  (`PresupuestoLineasEditor.tsx`), nunca en la base. El catálogo nuevo `pacientes.prestaciones`
  (tabla hija del paciente, calco de `pacientes.direcciones`, borrado lógico vía `activa`) es la
  única estructura nueva; no hay tabla intermedia N:N. Cartel `AvisoModeloDatos` correspondiente en
  `PresupuestoForm.tsx` y `PresupuestoResumen.tsx`.

### Presupuesto / Autorizacion — policies gateadas por `presupuestos`, no `facturacion`

**Confirmado leyendo `pg_policies` directamente** (`integracion-presupuestos`, 2026-08-02 y
re-verificado 2026-08-05): las cuatro policies de `facturacion.presupuesto` y
`facturacion.autorizacion` (`Read/Write presupuesto`, `Read/Write autorizacion`) tienen
`qual = modulos.tiene_permiso('presupuestos'::text, 'read'|'write'::modulos.nivel_acceso)` —
gateadas por el módulo **`presupuestos`**, no `facturacion` como afirma el comentario de cabecera de
`20260724100005_schema_facturacion.sql` ("el módulo de permisos es `facturacion`"). **La base manda,
el comentario de la migración está desactualizado/equivocado** — es la misma trampa que
`integracion-facturacion` D9 dejó anotada como "bloqueante a resolver en `integracion-presupuestos`".

**Ese mismo comentario desactualizado se repite, textual, en la cabecera de los dos `index.ts` de las
Edge Functions** (`supabase/functions/presupuestos/index.ts` y
`supabase/functions/autorizaciones/index.ts`: *"El modulo de permisos es 'facturacion' -- Presupuesto
y Autorizacion comparten modulo con Facturas/Cobros/Gastos de Vehiculos"*) — pero el código real de
esos mismos archivos, dos líneas más abajo, usa `const MODULO = 'presupuestos'` con un segundo
comentario correcto justo encima (*"Modulo 'presupuestos' (no 'facturacion'): split via
`20260730140000_split_modulos_permisos.sql`"*). Es decir: **el propio archivo se contradice a sí
mismo** entre su docstring de cabecera (viejo) y su constante ejecutada (correcta) — no es solo la
migración `.sql` la que quedó desactualizada. Ninguna de las dos correcciones estaba en `design.md`,
que solo mencionaba la migración. Vale la pena que backend limpie el comentario de cabecera de los
dos `index.ts` en algún momento, aunque no cambia ningún comportamiento (el código ejecutado ya es
correcto).

**Consecuencia práctica para perfiles con `facturacion: read/write` y sin `presupuestos: read`
(D11 punto 3 de `integracion-presupuestos`)**: con el transporte de Edge Functions que usa este
change, ese perfil recibe un **403 explícito** (`no tenes permiso de 'read' sobre el modulo
'presupuestos'`) al invocar `GET /presupuestos` o `GET /autorizaciones` — **no** `200 []` con lista
vacía. Es estrictamente mejor que el modo de falla silencioso que tendría PostgREST + RLS directo (0
filas sin ningún error), y es la confirmación de que la trampa que `integracion-facturacion` D9 anotó
queda cerrada del lado de Presupuestos. **Confirmado empíricamente con una cuenta real**
(`tasks.md` 1B.4(c), 2026-08-06: se le retiró `presupuestos: write` a `facturacion@pastor.com` y
`GET /presupuestos` devolvió `403`, no `200 []`) — lo de arriba ya no es solo lectura de `pg_policies`
y del código de la Edge Function, es un request real observado.

### Edge Functions: `presupuestos` / `autorizaciones` (contrato del módulo Presupuestos)

Deployadas y `ACTIVE` (versión 2 al 2026-08-05), leídas directamente de
`supabase/functions/presupuestos/index.ts` y `supabase/functions/autorizaciones/index.ts` para este
bloque (no asumidas de `design.md`). Mismo molde que el resto de las Edge Functions del proyecto
(`supabase/functions/_shared/auth.ts`): el portón de autorización es
`requirePermiso(req, 'presupuestos', req.method === 'GET' ? 'read' : 'write')` — sin `Authorization`
da `401`, JWT inválido da `401`, `tiene_permiso()` en falso da `403`; si pasa, la función sigue
adentro operando con un cliente `admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`
(`service_role`, bypasea RLS — la autorización ya se verificó a nivel de módulo, RLS queda como
segunda capa de defensa, no como el único gate). La `SERVICE_ROLE_KEY` vive solo en el entorno de la
función, nunca llega al frontend.

| Método | Ruta | Respuesta |
|---|---|---|
| `GET` | `/presupuestos` | `200` array, ordenado por `fecha_emision` desc |
| `GET` | `/presupuestos/:id` | `200` \| `404 { error: 'presupuesto no encontrado' }` |
| `POST` | `/presupuestos` | `201` \| `400` si falta `pacienteId`/`obraSocialId`/`monto`/`fechaEmision` |
| `PATCH` | `/presupuestos/:id` | `200` \| `404 { error: 'presupuesto no encontrado' }` |
| `DELETE` | `/presupuestos/:id` | `204` (sin body) |
| `GET` | `/autorizaciones` | `200` array, **sin `order()`** — orden físico de Postgres, no garantizado |
| `GET` | `/autorizaciones/:id` | `200` \| `404 { error: 'autorizacion no encontrada' }` |
| `GET` | `/autorizaciones?presupuestoId=<uuid>` | `200` \| `404 { error: 'este presupuesto todavia no tiene autorizacion asociada' }` (relación 1—1, si `:id` también viene en el path tiene prioridad sobre `presupuestoId`) |
| `POST` | `/autorizaciones` | `201` \| `400` si falta `presupuestoId` |
| `PATCH` | `/autorizaciones/:id` | `200` \| `404 { error: 'autorizacion no encontrada' }` |
| `DELETE` | `/autorizaciones/:id` | `204` (sin body) |

`toApi()` de `presupuestos` devuelve, ya en camelCase: `id`, `pacienteId`, `obraSocialId`, `monto`
(`Number(row.monto)`, nunca el `numeric` crudo de Postgres), `fechaEmision`, `archivoUrl?` (`??
undefined`, nunca `null`). `toApi()` de `autorizaciones`: `id`, `presupuestoId`, `estado`,
`fechaRespuesta?`, `montoAutorizado?` (`Number(...)` solo si no es `null`, si no `undefined`),
`vigenciaDesde?`, `cupoMensualDias?`, `cupoMensualKm?`, `archivoUrl?` — los seis campos opcionales
usan `?? undefined`, ninguno llega como `null` al frontend. Cualquier error de Postgres (incluido el
`RAISE EXCEPTION` de RN-PA-01) se devuelve tal cual como `400 { error: error.message }` — **texto
crudo del motor**, la traducción a castellano la hace el frontend (`edgeFunctionErrors.ts`), la Edge
Function no la traduce.

**Hallazgo de esta verificación (leyendo el código real, no `design.md`)**: el `MODULO` real de las
dos funciones (`const MODULO = 'presupuestos'`) sí coincide con lo que `design.md` asumía, pero el
docstring de cabecera de los dos archivos dice lo contrario (ver bloque de arriba
§Presupuesto/Autorizacion) y `design.md` no lo menciona — solo hablaba del comentario de la migración
`.sql`.

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

**🐛 Bug bloqueante encontrado y corregido (2026-08-07, verificación en vivo de `tasks.md` 1B.4).**
El paso 4 (direcciones) nunca casteaba `tipo_lugar` al enum `pacientes.tipo_direccion` — bug
presente desde la primera versión de la función y heredado sin cambios a través de sus 5
reescrituras posteriores (`formato_afiliado`, `localidad`, `parentesco`, `descripcion`, `lat`/`lng`)
porque ninguna había ejecutado una llamada real end-to-end con `tipo_lugar` poblado.
`NULLIF(text, text)` devuelve `text`, no `unknown`, y Postgres no registra un cast automático de
`text` a un enum de usuario en contexto de asignación — **cualquier alta de paciente con al menos
una dirección con tipo cargado fallaba con `42804`**. Corregido en
`supabase/migrations/20260807000000_crear_paciente_completo_tipo_lugar_cast.sql` (aditiva, mismo
patrón de siempre, único cambio real un `::pacientes.tipo_direccion` explícito). Verificado post-fix
contra `pkryfoljypuzfifofdwp`: alta completa con `tipo_lugar: "domicilio"` → éxito, las 7 tablas con
su fila correspondiente.

### Funciones de alta/edición: `obra_social.crear_obra_social_completa` / `actualizar_obra_social_completa`

Migraciones `supabase/migrations/20260731120000_obra_social_config_facturacion.sql` (reconciliación
de índices, ver el bloque de discrepancias arriba) y `20260731120001_obra_social_rpc.sql`
(`openspec/changes/integracion-obra-social/`, D6). Son el único camino de alta y edición
multi-tabla del módulo Obras Sociales: `crear_obra_social_completa(p_os jsonb)` inserta
atómicamente `obra_social`, y por cada ítem del checklist hace *get-or-create* (normalizado por
`trim`+`lower`) sobre el catálogo **compartido** `tipos_documento` antes de insertar en
`requisitos_os`, más los campos de `plantilla_campo`. `actualizar_obra_social_completa(p_id uuid,
p_cambios jsonb)` hace **reemplazo completo** (no diff fino) de `requisitos_os` y `plantilla_campo`
cuando esas claves están presentes en `p_cambios` — es lo que significa "reordenar" un conjunto sin
`id` estable a nivel de fila de vínculo (el `id` que ve el frontend es el de `tipos_documento`,
estable por definición, nunca el de `requisitos_os`). La semántica parcial usa el operador `?` de
jsonb (clave ausente ≠ clave presente con `[]`) — confundir los dos casos borraría el checklist de
cualquiera que edite solo el nombre.

**`SECURITY INVOKER` a propósito, no un descuido** (mismo criterio y misma advertencia que
`pacientes.crear_paciente_completo` de arriba). Acá el riesgo tiene **radio de daño mayor**: además
de bypassear el gateo del módulo `obra_social`, un `SECURITY DEFINER` accidental daría a cualquier
cuenta autenticada la capacidad de escribir en `tipos_documento`, que es compartido con Pacientes
**y con Facturación** (ver discrepancia nueva arriba). `REVOKE ALL ... FROM PUBLIC` y `FROM anon`,
`GRANT EXECUTE ... TO authenticated` únicamente, `COMMENT ON FUNCTION` visible desde el dashboard, y
un test automatizado que lee el `.sql` con `node:fs` y confirma que la única cláusula de seguridad
activa es `SECURITY INVOKER` (`SupabaseObraSocialRepository.test.ts`/`obraSocialMigrations.test.ts`,
tarea 4.9). **No cambiar `SECURITY INVOKER` por `SECURITY DEFINER` bajo ninguna circunstancia.**

**Nota de verificación**: a diferencia de un `INSERT` (donde `WITH CHECK` rechaza directamente con
`42501` si falta el permiso), el `UPDATE` de `actualizar_obra_social_completa` sobre una fila que
RLS oculta por falta de `obra_social:write` afecta 0 filas **sin lanzar** por sí solo — esta función
lo traduce a `45103` (mismo código que "no existe"), consistente con el resto del dominio. El
resultado en filas escritas es el mismo (cero) en cualquiera de los dos casos; el código de error
que ve el frontend podría no ser exactamente el que se anticipó en el diseño. Confirmar el
comportamiento exacto con cuentas reales es parte del checklist manual pendiente (`tasks.md` 1B.8).

## Seed data inicial

Migración inicial estimada: 50-60 pacientes (más de 50 activos), con su documentación asociada, a definir en detalle a partir de las planillas/Excel y estructura de carpetas actuales que aporte el cliente (ver `10_preguntas_abiertas.md` e `11` en `01_vision_y_objetivos.md` sección insumos pendientes).
