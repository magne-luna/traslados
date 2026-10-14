## Purpose

Separa los datos fijos del paciente (identidad) de los datos que cambian año a año (prestaciones,
destinos habituales, obra social/afiliado), para que la operadora trabaje cada paciente como
"carpetas por año" (2025 en cobro, 2026 en curso, 2027 en preparación).

## ADDED Requirements

### Requirement: Datos fijos del paciente
El sistema SHALL tratar nombre(s), apellido(s), DNI, CUIL y fecha de nacimiento como datos únicos
del paciente, independientes del año: se muestran fuera de las pestañas por año y editarlos afecta a
todos los años.

#### Scenario: Editar el DNI desde cualquier año
- **WHEN** la operadora corrige el DNI del paciente estando en la pestaña 2027
- **THEN** el DNI corregido se ve también al abrir la pestaña 2026 y en los presupuestos de ese paciente

### Requirement: Pestañas por año en la ficha del paciente
La ficha del paciente SHALL mostrar un selector de año cuyas opciones son: los años en que el
paciente tiene prestaciones, destinos habituales o coberturas, más el año actual y el año
siguiente, ordenados ascendente. El año seleccionado por defecto SHALL ser el año actual.

#### Scenario: Paciente con datos 2025 y 2026, hoy 2026-10-14
- **WHEN** se abre la ficha de un paciente con prestaciones en 2025 y 2026
- **THEN** el selector ofrece 2025, 2026 y 2027, con 2026 seleccionado

#### Scenario: Paciente nuevo sin datos por año
- **WHEN** se abre la ficha de un paciente recién creado (hoy 2026-10-14)
- **THEN** el selector ofrece 2026 y 2027, con 2026 seleccionado, y ambas pestañas están vacías

### Requirement: Prestaciones por año
Cada prestación del paciente SHALL pertenecer a exactamente un año. La sección Prestaciones de la
ficha SHALL listar y dar de alta solo prestaciones del año seleccionado. Una prestación de un año
SHALL NOT aparecer en otro año. El borrado sigue siendo lógico (`activa = false`).

#### Scenario: Hidroterapia solo en 2027
- **WHEN** la operadora, en la pestaña 2027, agrega la prestación "Hidroterapia"
- **THEN** "Hidroterapia" aparece en la pestaña 2027 y no aparece en la pestaña 2026

#### Scenario: Misma prestación en dos años
- **WHEN** el paciente tiene "Terapia ocupacional" en 2026 y en 2027
- **THEN** existen dos prestaciones independientes; desactivar la de 2026 no afecta a la de 2027

### Requirement: Destinos habituales por año
Cada destino habitual (día de semana + hora + dirección inicial/final) SHALL pertenecer a un año.
La sección de destinos habituales de la ficha SHALL listar y crear solo los del año seleccionado.
Las direcciones del paciente (catálogo de lugares) SHALL seguir siendo comunes a todos los años.

#### Scenario: Cambio de escuela de un año a otro
- **WHEN** en 2026 el paciente va los lunes 8:00 a la Escuela A y en 2027 se carga lunes 8:00 a la Escuela B
- **THEN** la pestaña 2026 muestra el destino a la Escuela A y la pestaña 2027 el destino a la Escuela B

### Requirement: Obra social y afiliado por período
El paciente SHALL poder tener varias coberturas (obra social + número de afiliado) con fecha desde
y fecha hasta opcional. La pestaña de un año SHALL mostrar las coberturas cuyo período se solapa
con ese año. Dos coberturas del mismo paciente SHALL NOT solaparse en el tiempo.

#### Scenario: Cambio de obra social a mitad de año
- **WHEN** el paciente tiene OS A desde 2027-01-01 hasta 2027-07-31 y OS B desde 2027-08-01 sin fecha hasta
- **THEN** la pestaña 2027 muestra las dos coberturas con sus períodos y la pestaña 2028 muestra solo OS B

#### Scenario: Coberturas solapadas
- **WHEN** la operadora intenta guardar una cobertura desde 2027-06-01 mientras otra sigue vigente hasta 2027-07-31
- **THEN** el sistema rechaza el guardado con un mensaje que indica el solapamiento y no modifica ninguna cobertura

### Requirement: Preparar un año copiando el anterior
Desde la pestaña de un año sin prestaciones ni destinos habituales, la operadora SHALL poder copiar
las prestaciones activas y los destinos habituales del año anterior inmediato. La copia SHALL crear
filas nuevas (no mover ni compartir las del año origen) y SHALL NOT copiar presupuestos,
autorizaciones ni coberturas.

#### Scenario: Preparar 2027 desde 2026
- **WHEN** en la pestaña 2027 vacía la operadora elige "Copiar desde 2026"
- **THEN** 2027 queda con una copia de las prestaciones activas y los destinos habituales de 2026, y 2026 no cambia

#### Scenario: Año ya con datos
- **WHEN** la pestaña 2027 ya tiene al menos una prestación o destino habitual
- **THEN** la acción "Copiar desde 2026" no se ofrece

### Requirement: Migración de datos existentes sin pérdida
Al introducir los datos por año, todas las prestaciones y destinos habituales existentes SHALL
quedar asignados a un año sin borrarse ninguna fila, y todo paciente con obra social cargada SHALL
quedar con al menos una cobertura vigente. Ningún presupuesto, autorización o factura existente
SHALL cambiar de prestación, obra social ni monto.

#### Scenario: Prestación cargada como "Hidroterapia 2027"
- **WHEN** se aplica la migración y existe la prestación "Hidroterapia 2027"
- **THEN** queda como prestación "Hidroterapia" del año 2027 (si la regla de renombrado fue aprobada; si no, queda con su nombre original en 2027)

#### Scenario: Prestación sin año en el nombre
- **WHEN** se aplica la migración y existe la prestación "Psicología"
- **THEN** queda asignada al año por defecto acordado (2026) con el mismo id, por lo que los presupuestos que la referencian no cambian

### Requirement: Aviso de discrepancia con el modelo de datos
La ficha del paciente SHALL mostrar un `AvisoModeloDatos` indicando que el año de prestaciones y
destinos habituales no existe en `Traslados-Modelo-Datos.docx`, hasta que el docx se actualice.

#### Scenario: Ver el aviso
- **WHEN** se abre la ficha de cualquier paciente
- **THEN** se ve el aviso de discrepancia sobre los datos por año
