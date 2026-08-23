# Spec: Listado de autorizaciones por presupuesto

## ADDED Requirements

### Requirement: Lectura plural de las autorizaciones de un presupuesto

El sistema SHALL reemplazar la lectura singular (`getByPresupuestoId(): Promise<Autorizacion |
null>`) por `listByPresupuestoId(presupuestoId: string, periodoMes?: string):
Promise<Autorizacion[]>`. La Edge Function `autorizaciones` (`GET ?presupuestoId=`) MUST devolver
siempre un arreglo ordenado por `periodo_mes` (`NULLS FIRST`), incluido el arreglo vacío, y MUST NOT
usar `.maybeSingle()` ni responder `404` para esa consulta. El filtro opcional `&periodoMes=` MUST
permitir acotar la lectura a un mes puntual.

#### Scenario: Un presupuesto sin ninguna autorización devuelve una lista vacía

- **GIVEN** un presupuesto sin ninguna autorización cargada
- **WHEN** se invoca `listByPresupuestoId(presupuestoId)`
- **THEN** la promesa resuelve `[]`
- **AND** la Edge Function responde `200`, nunca `404`

#### Scenario: Un presupuesto con varios meses devuelve todas las filas, ordenadas

- **GIVEN** un presupuesto con autorizaciones para marzo, abril y una legacy sin período
- **WHEN** se invoca `listByPresupuestoId(presupuestoId)`
- **THEN** se devuelven las tres filas, con la legacy primero y marzo/abril en orden ascendente

#### Scenario: Filtrar por un mes puntual

- **GIVEN** un presupuesto con autorizaciones para marzo y abril
- **WHEN** se invoca `listByPresupuestoId(presupuestoId, '2026-03-01')`
- **THEN** la Edge Function recibe `&periodoMes=2026-03-01` y devuelve solo la fila de marzo

### Requirement: `PresupuestoDetail` muestra una tabla de meses, no una card única

El sistema SHALL mostrar el bloque de autorización de `PresupuestoDetail` como una tabla con una
fila por mes (columnas: Mes, Estado, Monto autorizado, Cupo, Vigencia, Adjunto), cada fila
clickeable para desplegar su `AutorizacionForm` inline, con una acción "Agregar mes" para cargar la
siguiente. El sistema MUST cubrir los cinco estados: cargando, sin ninguna autorización, solo legacy
sin mes, N meses, y mezcla de legacy con meses.

#### Scenario: Presupuesto sin ninguna autorización

- **GIVEN** un presupuesto recién creado sin ninguna autorización
- **WHEN** se abre su detalle
- **THEN** se muestra el estado de alta directamente (`filaAbierta = 'nueva'`), sin tabla vacía ni
  error

#### Scenario: Presupuesto con una sola fila legacy sin mes

- **GIVEN** un presupuesto con una única autorización sin `periodoMes`
- **WHEN** se abre su detalle
- **THEN** la tabla muestra una fila rotulada "Sin mes cargado"

#### Scenario: Presupuesto con varios meses

- **GIVEN** un presupuesto con autorizaciones para marzo, abril y mayo
- **WHEN** se abre su detalle
- **THEN** la tabla muestra tres filas ordenadas cronológicamente, rotuladas "Mes 1 · marzo 2026",
  "Mes 2 · abril 2026", "Mes 3 · mayo 2026"

#### Scenario: Mezcla de legacy y meses

- **GIVEN** un presupuesto con una autorización legacy y dos autorizaciones mensuales
- **WHEN** se abre su detalle
- **THEN** la fila legacy aparece primero, rotulada "Sin mes cargado", seguida de las dos filas
  mensuales en orden ascendente

#### Scenario: Agregar un mes nuevo

- **GIVEN** un presupuesto con autorizaciones para marzo y abril
- **WHEN** el usuario hace clic en "Agregar mes"
- **THEN** se abre `AutorizacionForm` en modo alta, con el mes prefilleado al primer mes no cargado
  del rango de vigencia

### Requirement: El adjunto de cada mes es independiente

El sistema SHALL mantener el adjunto de cada `Autorizacion` cableado por su propio `id`, de modo que
reemplazar el archivo de un mes MUST NOT afectar el archivo de otro mes del mismo presupuesto.

#### Scenario: Reemplazar el adjunto de un mes no toca el de otro

- **GIVEN** un presupuesto con autorizaciones para marzo (con adjunto propio) y abril (con adjunto
  propio)
- **WHEN** se sube un archivo nuevo para abril
- **THEN** el adjunto de marzo sigue siendo el mismo tras recargar y reabrir esa fila

### Requirement: El campo de mes en `AutorizacionForm` es la identidad de la fila

El sistema SHALL exponer el mes como un `<input type="month">`, único campo de identidad de la fila,
con prefill del primer mes no cargado del presupuesto en el alta, editable en la edición con
re-chequeo de unicidad contra las demás filas del mismo presupuesto, y un rótulo "Mes N" derivado en
vivo.

#### Scenario: Prefill del primer mes no cargado

- **GIVEN** un presupuesto con vigencia desde febrero de 2026 y una autorización ya cargada para
  febrero
- **WHEN** se abre "Agregar mes"
- **THEN** el campo de mes se prellena con marzo de 2026

#### Scenario: El mes es editable en edición

- **GIVEN** una autorización existente con `periodoMes` cargado
- **WHEN** se abre en modo edición
- **THEN** el campo de mes no está deshabilitado por estar en edición (solo por el gateo de
  escritura general)

#### Scenario: Re-guardar la fila con su propio mes no bloquea

- **GIVEN** una autorización existente para abril
- **WHEN** se edita esa misma fila sin cambiar el mes y se guarda
- **THEN** el chequeo de unicidad no la rechaza contra sí misma
