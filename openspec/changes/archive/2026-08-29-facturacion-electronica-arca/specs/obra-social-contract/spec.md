## MODIFIED Requirements

### Requirement: Tipo de dominio ObraSocial

El sistema SHALL definir un tipo TypeScript `ObraSocial` en `frontend/src/shared/types/` que modele:
identificador, nombre, CUIT (campo distinto del CUIL del paciente, RN-ID-01), plazo de cobro en días
(configurable), tipo de comprobante (`'A' | 'B' | 'C'`, RN-FA-07), modalidad de facturación
(`'por-prestacion' | 'general'`), flag de si admite pagos parciales/por lote, checklist documental
configurable y plantilla de descripción de factura. El tipo SHALL modelar además los cuatro campos
que el modelo de datos real ya tiene: **código, dirección, teléfono y condición frente al IVA**, los
cuatro **opcionales** (las columnas son nullables y ninguna fuente los declara obligatorios). El tipo
MUST estar en modo strict sin uso de `any`.

El campo `cuit` SHALL documentarse como el **CUIT de la obra social pagadora** (receptora de la
Factura A), por decisión de la usuaria del 2026-08-28. Ya no se modela como ambiguo.

El campo `condicionIva` SHALL modelarse como una **unión cerrada de literales** `CondicionIvaArca`
con exactamente los ocho códigos que acepta ARCA: `IVA_RESPONSABLE_INSCRIPTO`, `IVA_SUJETO_EXENTO`,
`CONSUMIDOR_FINAL`, `IVA_RESPONSABLE_MONOTRIBUTO`, `MONOTRIBUTO`, `PROVEEDOR_DEL_EXTERIOR`,
`CLIENTE_DEL_EXTERIOR`, `IVA_LIBERADO`. MUST NOT ser `string` libre. La columna
`obra_social.obra_social.condicion_iva` SHALL ganar un `CHECK` que admita esos ocho valores o `NULL`.
El formulario de obra social SHALL ofrecer estos valores como un `<select>` (más una opción "sin
especificar" que persiste `NULL`), reutilizando los componentes del design system. Sigue el mismo
precedente que `EstadoFactura` y `TipoComprobante`.

#### Scenario: El CUIT de la obra social es distinto del CUIL del paciente

- **WHEN** se modela una `ObraSocial`
- **THEN** el campo fiscal de la obra social es `cuit` y NO reutiliza ni se unifica con el `cuil` del
  titular/paciente (RN-ID-01)

#### Scenario: El CUIT es el de la obra social pagadora

- **WHEN** se documenta el campo `cuit` del tipo y se arma el receptor de una Factura A
- **THEN** se toma como el CUIT de la obra social (entidad pagadora), no el de un prestador
- **AND** no queda ningún `AvisoModeloDatos` de ambigüedad de CUIT en la ficha de obra social

#### Scenario: Campos con valores por defecto configurables, nunca hardcodeados

- **WHEN** una obra social se crea sin confirmación del cliente sobre plazo de cobro o tipo de
  comprobante
- **THEN** el valor por defecto documentado en la KB se persiste como dato editable de esa obra
  social, no como constante fija en el código del frontend

#### Scenario: Los cuatro campos del modelo real son completables desde la app

- **WHEN** el usuario da de alta o edita una obra social
- **THEN** puede cargar código, dirección, teléfono y condición frente al IVA
- **AND** dejarlos vacíos es válido: el alta no se bloquea por ellos

#### Scenario: La condición frente al IVA es una unión cerrada de los códigos de ARCA

- **WHEN** se modela `condicionIva`
- **THEN** es `CondicionIvaArca`, la unión cerrada de los ocho códigos de ARCA, opcional
- **AND** el formulario la ofrece como `<select>`, no como texto libre
- **AND** la columna real tiene un `CHECK` que admite esos ocho valores o `NULL`

#### Scenario: Una condición IVA fuera de la lista se rechaza

- **GIVEN** un intento de guardar una obra social con `condicionIva` que no es uno de los ocho códigos
- **WHEN** se valida el formulario o se inserta en la base
- **THEN** la validación del formulario lo rechaza con un mensaje claro
- **AND** el `CHECK` de la columna lo rechazaría también
