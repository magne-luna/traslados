## MODIFIED Requirements

### Requirement: Cálculo del cupo consumido del período, con dos semánticas conviviendo por fila

El sistema SHALL calcular el cupo ya consumido por un paciente en un período mediante la misma función pura `cupoConsumido(facturas, pacienteId, mes, anio)` (sin cambios de código), sumando los días y los kilómetros de las facturas de ese paciente y período que ya salieron del estado `a-facturar` (es decir, en estado `facturado`, `cobrado` o `pagado-parcialmente`), excluyendo la factura que se está editando. El significado de esa suma MUST leerse según si la `Autorizacion` referenciada tiene `periodoMes`: para una fila **legacy** (`periodoMes` ausente), la suma sigue siendo el consumo **anual** contra un `montoAutorizado`/cupo anual; para una fila con `periodoMes`, la misma suma pasa a ser el consumo **de ese mes** contra un `montoAutorizado`/cupo **mensual** (firma G4, `autorizacion-mensual/design.md` D8, confirmación provisoria de la usuaria 2026-08-22, no de Andrea).

(Previously: `montoConsumido`/`cupoConsumido` documentaban un único significado — tope **anual** — sin ninguna fila con semántica distinta.)

#### Scenario: Solo cuentan las facturas ya emitidas
- **WHEN** el paciente tiene una factura del período en estado `a-facturar` y otra en estado `facturado`
- **THEN** el cupo consumido suma únicamente la factura `facturado`

#### Scenario: La factura en edición no se cuenta a sí misma
- **WHEN** se recalcula el cupo consumido mientras se edita una factura ya emitida de ese período
- **THEN** esa factura queda excluida de la suma, para no computarla dos veces al validar

#### Scenario: Aislamiento por paciente y por período
- **WHEN** existen facturas de otros pacientes o de otros meses del mismo paciente
- **THEN** no se suman al cupo consumido del período consultado (el cupo autorizado es mensual, RN-PA-03)

#### Scenario: Fila legacy sigue sumando el año (nuevo, test de regresión nominado)
- **GIVEN** una autorización sin `periodoMes` (modelo 1:1 anterior) y varias facturas del mismo paciente y año, referenciando esa autorización
- **WHEN** se calcula `montoConsumido`/`cupoConsumido`
- **THEN** la suma incluye todas las facturas del año, igual que antes de este change

#### Scenario: Fila mensual suma solo su mes (nuevo, test de regresión nominado)
- **GIVEN** una autorización con `periodoMes` cargado (modelo 1:N de este change) y facturas de distintos meses del mismo paciente, cada una referenciando la autorización de su propio mes
- **WHEN** se calcula `montoConsumido`/`cupoConsumido` para una autorización dada
- **THEN** la suma incluye únicamente las facturas de ese mes, no las de otros meses del mismo presupuesto

> Nota: no se agrega ningún parámetro `periodoMes` a `cupoConsumido`/`montoConsumido` ni se bifurca
> su cuerpo (alternativa descartada explícitamente en `autorizacion-mensual/design.md` D8: forzaría
> a resolver la Open Question 1 dentro de una función que hoy no la tiene). El cambio es de
> **interpretación documentada**, no de código — `montoConsumido.ts` no tuvo cambios en su cuerpo,
> solo en su comentario de cabecera. Los Requirements "Alerta al superar el cupo autorizado" y "La
> alerta de cupo avisa y pide confirmación, sin bloquear la emisión" de esta capability **no
> cambian** por este change (confirmado por test: `resolverCupoAutorizado` deriva el cupo de la
> autorización elegida explícitamente, sin iterar ni adivinar, igual que antes) — no se repiten acá.
