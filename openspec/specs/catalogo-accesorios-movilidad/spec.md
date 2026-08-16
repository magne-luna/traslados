# catalogo-accesorios-movilidad Specification

## Purpose
Catálogo global gestionable de accesorios (`pacientes.accesorios`), compartido por Pacientes,
Vehículos y Conductores. Gestión inline desde el selector, icono de lista fija del DS, selectores
alimentados por el catálogo activo. Cierra la discrepancia #11.
## Requirements
### Requirement: Catálogo global con icono y baja lógica

El sistema SHALL mantener `pacientes.accesorios` como catálogo ÚNICO y global, compartido por
pacientes (`accesorios_pacientes`) y vehículos/conductores (`conductores.accesorios_vehiculo`), con
`icono TEXT NOT NULL` (string, clave del mapeo del design system) y `activa BOOLEAN NOT NULL DEFAULT
true`. La baja es lógica (`activa = false`); el sistema MUST NOT borrar físicamente desde la UI.

#### Scenario: Los 5 accesorios del seed quedan con icono backfilled

- GIVEN el seed de 5 accesorios (`silla-plegable`, `silla-rigida`, `silla-postural`, `andador`, `tripode`)
- WHEN se aplica la migración aditiva
- THEN cada fila queda con su `icono` y `activa = true`, sin nulos

#### Scenario: Catálogo único compartido entre módulos

- GIVEN un accesorio creado desde la ficha de un paciente
- WHEN se abre el selector de Vehículo
- THEN el mismo accesorio aparece como opción, del mismo maestro, sin copia por módulo

### Requirement: Selectores alimentados por el catálogo activo

El sistema SHALL ofrecer en `PacienteDatosPersonalesFields` y `VehiculoForm` únicamente accesorios
con `activa = true`, cargados desde el repository — nunca de una lista estática en código. Un
inactivo MUST NOT ofrecerse para asignaciones nuevas, pero MUST seguir presente en los registros que
ya lo referencian (filas intactas por `id`).

#### Scenario: Alta visible sin recompilar

- GIVEN un accesorio creado desde el gestor inline
- WHEN se abre o reabre un selector de Paciente o Vehículo
- THEN aparece entre las opciones sin recompilar ni reseedar

#### Scenario: Desactivado no se ofrece

- GIVEN un accesorio con `activa = false`
- WHEN se abre un selector para asignación nueva
- THEN no aparece entre las opciones

#### Scenario: Registros existentes lo conservan

- GIVEN un paciente y un vehículo que ya usan un accesorio luego desactivado
- WHEN se releen sus fichas
- THEN el accesorio sigue presente en ambos (referencia por `id`)

### Requirement: Alta inline en el selector

El sistema SHALL permitir crear un accesorio con el botón "+ Agregar accesorio" al final del
fieldset, abriendo un form inline compacto (nombre + icono) que lo persiste en el catálogo; el
accesorio recién creado MUST quedar seleccionable de inmediato. La gestión SHALL ser un componente
reutilizable compartido por ambos formularios; MUST NOT existir pantalla ni sección dedicada.

#### Scenario: Alta exitosa

- GIVEN un usuario con permiso de escritura sobre `pacientes`
- WHEN completa el form inline (nombre + icono de la lista fija) y confirma
- THEN el accesorio queda con `activa = true` y seleccionable en el mismo selector sin recargar

#### Scenario: Nombre duplicado da error accionable

- GIVEN un `tipo` que ya existe (constraint UNIQUE)
- WHEN se confirma el form
- THEN se rechaza con un mensaje que nombra el duplicado y el form queda abierto para corregir

#### Scenario: Sin escritura no se gestiona

- GIVEN un usuario con solo `pacientes: read`
- WHEN abre el selector
- THEN elige entre los activos, sin botón de agregar ni menús

### Requirement: Edición, desactivación con aviso y reactivación

El sistema SHALL ofrecer por cada opción un menú (⋮) con editar (nombre/icono) y desactivar, visible
solo con permiso de escritura. Antes de desactivar, la UI MUST mostrar el aviso: queda visible donde
ya se usa y deja de ofrecerse en asignaciones nuevas. Inactivos SHALL verse tachados en la gestión y
SHALL poder reactivarse.

#### Scenario: Desactivar con aviso previo

- GIVEN un accesorio activo y usuario con escritura
- WHEN elige "desactivar" en el menú ⋮
- THEN se muestra el aviso de baja lógica antes de aplicar el cambio
- AND, confirmada, el catálogo queda con `activa = false`

#### Scenario: Reactivar un inactivo

- GIVEN un accesorio con `activa = false` visible tachado
- WHEN el usuario elige reactivarlo
- THEN vuelve a `activa = true` y reaparece en los selectores de asignaciones nuevas

#### Scenario: Editar sin tocar el historial

- GIVEN un accesorio usado por pacientes y vehículos
- WHEN se editan nombre o icono desde el menú ⋮
- THEN el cambio se persiste y los registros existentes muestran el dato nuevo sin perder vínculos

### Requirement: Icono desde lista fija del design system con fallback

El sistema SHALL persistir el icono como `string` y resolverlo a un SVG del design system vía
`iconoAccesorioMap`, con fallback genérico ante un string desconocido. El sistema MUST NOT permitir
emoji libre ni imagen subida como icono; la lista ofrecida en el alta SHALL ser la lista fija de
SVGs del DS.

#### Scenario: Icono conocido se resuelve al SVG

- GIVEN un accesorio con `icono` presente en el mapeo
- WHEN se renderiza en selector o ficha
- THEN se muestra el SVG correspondiente del design system

#### Scenario: Icono desconocido cae al fallback

- GIVEN un accesorio con un `icono` ausente del mapeo (p. ej. creado en otra base)
- WHEN se renderiza
- THEN se muestra el icono genérico de fallback y el resto se renderiza normalmente

### Requirement: Cierre de la discrepancia #11 documentado

El sistema SHALL cerrar la discrepancia #11 de la KB: el catálogo es la fuente de verdad, el
frontend deja de descartar en silencio los desconocidos y `ACCESORIOS_VALIDOS` desaparece de
mappers y Edge Functions. El cierre SHALL documentarse en KB §Discrepancias y `CHANGES.md`. La regla
dura del repo no exige `AvisoModeloDatos` nuevo: la desactivación usa `Alert` del DS y, cerrada la
discrepancia, no queda mismatch que señalizar.

#### Scenario: La discrepancia se documenta como cerrada

- GIVEN el inventario de discrepancias del change
- WHEN se completa la implementación
- THEN la entrada #11 de KB queda marcada cerrada con su motivo
- AND existe el bullet ⚠️ correspondiente en `CHANGES.md`

#### Scenario: Sin descarte silencioso ni cartel obsoleto

- GIVEN el frontend mapeando el catálogo real
- WHEN se revisan mappers, Edge Functions y pantallas de Pacientes/Vehículos
- THEN no existe `ACCESORIOS_VALIDOS` ni descarte por unión cerrada
- AND no hay `AvisoModeloDatos` que describa ese descarte como vigente

