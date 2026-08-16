# Delta for Vehiculo Crud

## MODIFIED Requirements

### Requirement: Selector de accesorios de movilidad compatibles

El sistema SHALL ofrecer un selector de accesorios de movilidad compatibles del vehículo, alimentado
por el catálogo global activo (`pacientes.accesorios` con `activa = true`) y permitiendo seleccionar
cero o más (RN-VE-01, RF-501). Los valores MUST ser `TipoAccesorio` (`string` del catálogo dinámico),
nunca una lista estática en código.
(Previously: el selector se restringía al conjunto cerrado de `AccesorioMovilidad` de 5 literales.)

#### Scenario: Selección múltiple de accesorios

- GIVEN el catálogo con accesorios activos e inactivos
- WHEN el usuario marca uno o más accesorios activos y guarda
- THEN el vehículo persiste exactamente esos accesorios en `accesoriosCompatibles`
- AND las opciones inactivas no se ofrecen en el selector
(Previously: el selector se restringía al conjunto cerrado de `AccesorioMovilidad` de 5 literales, sin activo/inactivo.)