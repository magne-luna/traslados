## ADDED Requirements

> **Nota de estado.** Este delta se agrega en la misma tanda que implementa `tasks.md` §6
> (Checkpoint (e) de `design.md`, VEREDICTO: opción A — advertir y confirmar). Documenta el único
> acoplamiento nuevo entre el editor de direcciones y el dominio documental que introduce
> `documentos-checklist-por-actividad`: el editor de direcciones (`DireccionesEditor.tsx`) ahora
> puede recibir, por prop, cuántos documentos tiene cargados cada dirección, y usa ese dato para
> advertir antes de quitarla. Se sincroniza a `openspec/specs/paciente-direcciones/spec.md` recién
> en `/opsx:archive`, siguiendo el patrón ya establecido en el repo.

### Requirement: Quitar una dirección con documentación cargada exige advertencia y confirmación

Cuando el usuario intenta quitar una dirección que tiene documentación cargada en su checklist
documental (capability `paciente-documentos`), el sistema SHALL informarle explícitamente cuántos
documentos se perderían y MUST NOT concretar la baja sin una confirmación explícita del usuario.

La cantidad de documentos por dirección SHALL llegar al editor de direcciones como dato
externo (prop), nunca mediante un fetch propio del editor — el editor de direcciones no conoce el
`DocumentoRepository` ni el resto del dominio documental.

Este requisito es aditivo sobre "Direcciones múltiples por paciente" (capability
`paciente-direcciones`, requisito ya existente): no reemplaza ni relaja el rechazo de eliminar una
dirección referenciada por un recorrido, que sigue aplicando con su propio mecanismo.

#### Scenario: Quitar una dirección con documentos pide confirmación con la cantidad

- **GIVEN** una dirección del paciente con al menos un documento cargado en su checklist
- **WHEN** el usuario hace click en "Quitar" para esa dirección
- **THEN** se muestra un diálogo de advertencia que indica cuántos documentos se perderían
- **AND** la dirección NO se quita todavía — la baja queda condicionada a que el usuario confirme

#### Scenario: Confirmar la advertencia concreta la baja

- **GIVEN** el diálogo de advertencia abierto para una dirección con documentos
- **WHEN** el usuario confirma explícitamente ("Quitar de todas formas")
- **THEN** la dirección se quita de la lista, igual que el comportamiento anterior a este change

#### Scenario: Cancelar la advertencia no quita nada

- **GIVEN** el diálogo de advertencia abierto para una dirección con documentos
- **WHEN** el usuario cancela
- **THEN** la dirección sigue en la lista sin cambios, y ningún documento se ve afectado

#### Scenario: Quitar una dirección sin documentos no cambia de comportamiento

- **GIVEN** una dirección del paciente sin ningún documento cargado
- **WHEN** el usuario hace click en "Quitar"
- **THEN** la dirección se quita inmediatamente, sin diálogo de advertencia ni pasos adicionales —
  idéntico al comportamiento anterior a este change
