# Delta for Paciente Contract

## MODIFIED Requirements

### Requirement: Tipo de dominio Paciente

El sistema SHALL definir un tipo TypeScript `Paciente` en `frontend/src/shared/types/` que modele:
identificador, apellido(s), nombre(s), fecha de nacimiento, DNI, CUIL del titular,
diagnóstico/condición, accesorio de movilidad, obra social asignada (por referencia de id, no
embebida), CUD, identificador de afiliado adaptable, direcciones múltiples, personas a cargo,
teléfono alternativo del responsable y flag de amparo judicial. El tipo MUST estar en modo strict
sin uso de `any`. El campo `accesorioMovilidad` MUST ser `TipoAccesorio[]`, donde `TipoAccesorio` es
`string` con valores del catálogo dinámico `pacientes.accesorios`, definido en
`shared/types/catalogoAccesorios.ts` — ya NO una unión cerrada de literales: cualquier tipo presente
en el maestro es un valor legítimo.
(Previously: el accesorio reutilizaba `AccesorioMovilidad`, una unión cerrada de 5 literales de
`shared/types/vehiculo.ts`.)

#### Scenario: El CUIL del titular es un campo propio, distinto del identificador de afiliado

- WHEN se modela un `Paciente`
- THEN el `cuil` del titular (RN-ID-01) es un campo separado del identificador de afiliado y del DNI, y NO se unifican

#### Scenario: La obra social se referencia, no se embebe

- WHEN un `Paciente` tiene una obra social asignada
- THEN se guarda una referencia (`obraSocialId`) y no una copia embebida de la obra social, para que el checklist y la plantilla se lean siempre del maestro de FE-2

#### Scenario: El accesorio de movilidad es un valor del catálogo, no un literal fijo

- WHEN se declara `Paciente.accesorioMovilidad`
- THEN su tipo es `TipoAccesorio[]` (`string` del catálogo dinámico)
- AND no existe en el código una lista cerrada de literales contra la cual validar al compilar