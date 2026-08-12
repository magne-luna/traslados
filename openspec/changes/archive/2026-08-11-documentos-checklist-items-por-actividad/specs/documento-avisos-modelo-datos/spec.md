## ADDED Requirements

### Requirement: La exigencia de documentación propia por tipo de actividad se documenta como discrepancia no confirmada

La regla *"cada tipo de actividad exige documentación propia, además de la que exige la obra social"*
NO proviene del cliente: es un supuesto del equipo. Mientras no haya confirmación del cliente, el
sistema SHALL tratarla como discrepancia abierta y documentarla en los tres lugares que exige el
proyecto, sin resolverla unilateralmente en el código:

1. `knowledge-base/04_modelo_de_datos.md` §Discrepancias — bullet propio que describa el supuesto, su
   origen (equipo, no cliente), la forma de la configuración introducida y su default vacío.
2. `knowledge-base/05_reglas_de_negocio.md` — nota `⚠️` en RN-FA-08 y RN-FA-10 indicando que existe un
   segundo eje de configuración documental todavía **no confirmado**, con referencia a la
   discrepancia. El sistema MUST NOT reescribir el texto normativo de esas reglas, ni redactar una
   regla nueva marcada como feedback del cliente, mientras el supuesto no esté confirmado.
3. `CHANGES.md` — bullet de refinamiento en `C-03` (dueño del componente/tipo/repository documental
   compartido) y en `C-05` (dueño de la pantalla Pacientes → Documentos), siguiendo el formato de los
   tres refinamientos anteriores de este mismo dominio.

Además, la sección de documentación del paciente SHALL mostrar un `AvisoModeloDatos` que lo indique en
pantalla, usando el componente del design system, sin markup ad-hoc ni estilos inline.

Cuando el cliente confirme la regla, la documentación SHALL actualizarse: la regla pasa a la
knowledge-base con su marca de procedencia real y las notas `⚠️` se cierran.

#### Scenario: La discrepancia queda documentada en los tres lugares

- **WHEN** el change se completa sin confirmación del cliente
- **THEN** el supuesto aparece descrito en `knowledge-base/04_modelo_de_datos.md` §Discrepancias
- **AND** RN-FA-08 y RN-FA-10 llevan una nota `⚠️` que apunta a esa discrepancia
- **AND** `CHANGES.md` lo refleja en los bullets de `C-03` y `C-05`

#### Scenario: Las reglas de negocio no se reescriben sobre un supuesto

- **WHEN** se documenta la discrepancia
- **THEN** el texto normativo de RN-FA-08 y RN-FA-10 permanece sin cambios
- **AND** no se agrega ninguna regla nueva marcada como feedback confirmado del cliente

#### Scenario: El aviso distingue supuesto de exigencia confirmada

- **WHEN** el usuario abre la sección de documentación de un paciente
- **THEN** el `AvisoModeloDatos` indica explícitamente que la documentación propia por tipo de
  actividad es un supuesto del equipo pendiente de confirmar con el cliente
- **AND** el aviso no presenta esa exigencia como una regla ya validada del negocio
