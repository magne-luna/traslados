## ADDED Requirements

### Requirement: Tipos de proyección del dominio de reportes
El sistema SHALL definir los tipos TypeScript de los reportes en `frontend/src/shared/types/reportes.ts`, en modo strict y sin usar `any`. MUST incluir `PeriodoMeses`, `PuntoPeriodo`, `SerieFacturadoVsCobrado`, `ResumenAnual`, `FacturaEnMora`, `PacienteCudPorVencer`, `AlertaMantenimientoVehiculo` y `ResumenDelDia`.

Estos tipos son **proyecciones derivadas**, no entidades: MUST referenciar las entidades del dominio por id (`facturaId`, `pacienteId`, `vehiculoId`) y NO MUST redefinir ni duplicar tipos ya declarados en `factura.ts`, `paciente.ts`, `vehiculo.ts` u `hojaDeRuta.ts` — se importan.

#### Scenario: Ninguna entidad nueva
- **WHEN** se declaran los tipos de reportes
- **THEN** ninguno representa una entidad persistible del dominio: todos son proyecciones calculables a partir de `Factura`, `Cobro`, `Paciente`, `Vehiculo` y `HojaDeRuta`, y ninguno requiere una tabla nueva en el backend

#### Scenario: Período configurable como unión cerrada
- **WHEN** se declara `PeriodoMeses`
- **THEN** es la unión cerrada `3 | 6 | 12`, nunca `number` libre, de modo que un período no soportado sea un error de compilación

#### Scenario: Punto de la serie con la diferencia explícita
- **WHEN** se declara `PuntoPeriodo`
- **THEN** contiene el mes (1-12), el año, el total facturado, el total cobrado y la diferencia entre ambos como campo propio, para que ningún componente tenga que recalcular la resta

#### Scenario: Proyecciones de alerta con su causa
- **WHEN** se declaran `FacturaEnMora`, `PacienteCudPorVencer` y `AlertaMantenimientoVehiculo`
- **THEN** cada una expone, además del id de la entidad origen y los datos mínimos para mostrarla, el motivo de la alerta (días de atraso, estado del CUD, o qué señal de mantenimiento disparó: service preventivo, habilitación, o ambas)

#### Scenario: Referencia por id, sin embeber entidades
- **WHEN** una proyección necesita identificar la entidad origen
- **THEN** guarda su id y solo los campos mínimos de presentación (por ejemplo patente, apellido y nombre), sin embeber la entidad completa

### Requirement: Capa de agregación como funciones puras
El sistema SHALL implementar toda la lógica de agregación de reportes como funciones puras en `frontend/src/shared/lib/reportes/`, que reciban las colecciones ya cargadas y devuelvan la proyección. Estas funciones MUST NOT acceder a repositorios, a React, ni a `localStorage`, y MUST NOT leer el reloj del sistema: la fecha de referencia SHALL entrar siempre por parámetro, igual que en `estadoCud`, `estadoHabilitacion` y `estadoVencimientoFactura`.

#### Scenario: Determinismo con la fecha inyectada
- **WHEN** se invoca cualquier función de agregación dos veces con las mismas colecciones y la misma fecha de referencia
- **THEN** devuelve exactamente el mismo resultado, y el test no necesita fake timers ni mockear `Date`

#### Scenario: Sin acceso a repositorios
- **WHEN** se inspecciona cualquier módulo de `shared/lib/reportes/`
- **THEN** no importa ningún repositorio, ningún mock, ni nada de `react`: recibe datos y devuelve datos

#### Scenario: Colecciones vacías
- **WHEN** se invoca cualquier función de agregación con colecciones vacías
- **THEN** devuelve la proyección vacía correspondiente (serie con los meses del rango en cero, listas vacías, totales en cero) en vez de lanzar un error o devolver `undefined`

#### Scenario: Sin mutar la entrada
- **WHEN** una función de agregación recibe colecciones del dominio
- **THEN** no las ordena, filtra ni modifica en el lugar: devuelve estructuras nuevas y las colecciones de entrada quedan intactas

### Requirement: Reutilización de las reglas de negocio de los módulos fuente
El sistema SHALL derivar las alertas del dashboard invocando las funciones puras que ya existen en los módulos dueños de cada regla, y NO MUST reimplementarlas ni redeclarar sus umbrales. La mora MUST usar `estadoVencimientoFactura` de `shared/lib/facturacion/`; el CUD MUST usar `estadoCud` de `shared/lib/pacientes/`; el mantenimiento MUST usar `estadoServicePreventivo` y `estadoHabilitacion` de `shared/lib/mantenimiento/`.

#### Scenario: Cambio de umbral en el módulo dueño
- **WHEN** se modifica una constante de umbral en el módulo dueño (por ejemplo `PLAZO_ALERTA_VENCIDA_DIAS` en `shared/lib/facturacion/constantes.ts`)
- **THEN** el resultado de la tarjeta del dashboard cambia en consecuencia, sin tocar ningún archivo de `shared/lib/reportes/` ni de `features/dashboard/`

#### Scenario: Sin constantes duplicadas
- **WHEN** se inspecciona `shared/lib/reportes/constantes.ts`
- **THEN** no declara ningún valor que ya exista en `shared/lib/facturacion/constantes.ts` ni en `shared/lib/mantenimiento/constantes.ts`: solo declara lo propio del dashboard (opciones de período disponibles, máximo de ítems por tarjeta y el umbral de CUD que se pasa explícito)

#### Scenario: Coherencia con la pantalla del módulo fuente
- **WHEN** una factura, un paciente o un vehículo aparece en una tarjeta de alerta del dashboard
- **THEN** el mismo registro aparece con el mismo estado en la pantalla de su módulo, porque ambos evalúan la misma función pura con el mismo umbral

### Requirement: Contrato de las futuras vistas del backend
El sistema SHALL tratar las funciones de `shared/lib/reportes/` y sus tests como la especificación ejecutable de las vistas SQL / RPC que el backend `C-11` deberá proveer, dado que `docs/core/Traslados-Modelo-Datos.docx` no modela ninguna vista, reporte ni agregación.

#### Scenario: Sustitución en FE-8 sin tocar componentes
- **WHEN** el backend `C-11` entregue las vistas o RPC reales
- **THEN** basta con inyectar en el composition root un adaptador que devuelva las mismas proyecciones, sin modificar ningún componente de `features/dashboard/`

#### Scenario: Casos borde fijados por los tests
- **WHEN** se implementen las vistas del backend
- **THEN** los tests de las funciones puras (meses sin datos, cruce de año, factura sin emitir, cobro fuera de rango, fechas límite del mes) documentan el comportamiento esperado, sin depender de una interpretación propia de US-800
