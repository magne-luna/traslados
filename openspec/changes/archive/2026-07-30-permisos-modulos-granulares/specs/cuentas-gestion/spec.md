## MODIFIED Requirements

### Requirement: Matriz de permisos por cuenta
El sistema SHALL presentar, para la cuenta seleccionada, una matriz con los siete módulos del sistema y el nivel asignado a cada uno, incluyendo la opción explícita "sin acceso". La edición MUST ser diferida y en línea (nunca en modal), y el guardado MUST enviarse a la Edge Function `update-permisos` como el conjunto completo deseado, respetando su semántica de reemplazo total.

#### Scenario: Otorgar acceso a un módulo
- **WHEN** la administradora asigna nivel `write` sobre `facturacion` a una cuenta y guarda
- **THEN** el sistema invoca `update-permisos` con el conjunto completo de permisos resultante y refleja el nuevo estado al confirmarse

#### Scenario: Revocar acceso a un módulo
- **WHEN** la administradora cambia un módulo a "sin acceso" y guarda
- **THEN** ese módulo no se incluye en el conjunto enviado a `update-permisos`, quedando revocado por la semántica de reemplazo total

#### Scenario: Revocar todos los accesos
- **WHEN** la administradora deja todos los módulos en "sin acceso" y guarda
- **THEN** el sistema envía un conjunto de permisos vacío y la cuenta queda sin acceso a ningún módulo

#### Scenario: Cambios descartados
- **WHEN** la administradora modifica la matriz y cancela sin guardar
- **THEN** la matriz vuelve a reflejar el último estado guardado y no se invoca `update-permisos`

#### Scenario: Módulos antes agrupados ahora se asignan por separado
- **WHEN** la administradora abre la matriz de una cuenta que antes de este cambio tenía `write` sobre `pacientes`
- **THEN** la matriz muestra `write` tanto en la fila `pacientes` como en la fila `hojas_de_ruta`, reflejando la copia de permisos hecha por la migración de datos del backend, y la administradora puede desde acá bajarle el nivel a `hojas_de_ruta` sin afectar `pacientes`
