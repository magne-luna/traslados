# Autorización Validación Monto

## Purpose
Defines validation rules for authorization amounts against budgets, implementing RN-PA-01 as a pure function.

## Requirements

### Requirement: Validación RN-PA-01 como función pura (autorización nunca mayor al presupuesto)
El sistema SHALL implementar una función pura `validarAutorizacion` que reciba el monto autorizado y el monto del presupuesto y devuelva un resultado ok/error, rechazando o alertando cuando `montoAutorizado > presupuesto.monto` ("la autorización puede coincidir con el presupuesto o ser menor, nunca mayor", RN-PA-01). Es un espejo en UI de la regla; el backend `C-06` la re-valida.

#### Scenario: Autorización mayor al presupuesto se rechaza
- **WHEN** `montoAutorizado` es mayor que `presupuesto.monto`
- **THEN** `validarAutorizacion` devuelve un error (RN-PA-01) y el formulario bloquea/alerta el guardado con un mensaje visible

#### Scenario: Autorización igual o menor al presupuesto se acepta
- **WHEN** `montoAutorizado` es igual o menor que `presupuesto.monto`
- **THEN** `validarAutorizacion` devuelve ok y el guardado procede

#### Scenario: Autorización sin monto (estado pendiente) no dispara el error de monto
- **WHEN** el `montoAutorizado` está ausente (por ejemplo, estado `pendiente`)
- **THEN** `validarAutorizacion` no reporta el error de RN-PA-01 por comparación de montos (no hay monto que comparar todavía)

#### Scenario: La validación es una función pura testeable
- **WHEN** se invoca `validarAutorizacion` con distintos pares de montos
- **THEN** el resultado depende solo de sus argumentos (sin efectos de red ni de `localStorage`), permitiendo tests deterministas de RN-PA-01
