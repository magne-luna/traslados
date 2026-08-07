## ADDED Requirements

> **Nota de estado (propose-only).** Estos requisitos están escritos a nivel de **comportamiento
> observable**, deliberadamente sin comprometer la forma técnica que todavía depende de los
> checkpoints de `design.md`. Los que dependen de un veredicto puntual lo declaran explícitamente en
> su propio texto. Se sincronizan a `openspec/specs/paciente-documentos/spec.md` recién en
> `/opsx:archive`, siguiendo el patrón ya establecido en el repo.

### Requirement: Checklist documental instanciado por actividad del paciente

El sistema SHALL instanciar el checklist documental del paciente **una vez por cada actividad
registrada del paciente**, y MUST NOT presentar un único checklist que represente al paciente
completo.

Cada instancia SHALL identificar de forma legible a qué actividad corresponde, incluso cuando dos
actividades comparten el mismo tipo (por ejemplo, dos terapias distintas).

Los documentos cargados en una actividad MUST NOT aparecer, contarse ni afectar el estado de ninguna
otra actividad del mismo paciente.

> **Depende del Checkpoint (a) de `design.md`**: qué entidad del modelo representa una "actividad", y
> si el domicilio del paciente cuenta como una. El requisito de independencia entre instancias es
> válido cualquiera sea el veredicto.

#### Scenario: Un paciente con varias actividades ve varios checklists

- **GIVEN** un paciente con una escuela y dos terapias registradas
- **WHEN** el usuario abre la sección de documentación del paciente
- **THEN** se muestra un checklist documental independiente por cada una de esas actividades, cada uno
  identificado con la actividad a la que pertenece

#### Scenario: Dos actividades del mismo tipo son distinguibles entre sí

- **GIVEN** un paciente con dos actividades del mismo tipo, diferenciadas por su descripción (por
  ejemplo, "Kinesióloga" y "Fonoaudióloga")
- **WHEN** se muestran sus checklists documentales
- **THEN** cada checklist se identifica con la descripción de su actividad, y el usuario puede
  distinguir cuál es cuál sin ambigüedad

#### Scenario: Los documentos de una actividad no se filtran a otra

- **GIVEN** un paciente con dos actividades, y un documento cargado en un ítem de la primera
- **WHEN** el usuario consulta el checklist de la segunda actividad
- **THEN** ese documento no aparece en la segunda actividad, y el ítem correspondiente de la segunda
  actividad sigue figurando como no cargado

#### Scenario: Agregar una actividad nueva agrega su checklist

- **GIVEN** un paciente con sus actividades ya registradas y documentación cargada en ellas
- **WHEN** el usuario registra una actividad nueva
- **THEN** aparece un checklist documental adicional para esa actividad, vacío, sin alterar la
  documentación ya cargada en las demás

### Requirement: La multiplicidad por actividad se compone con la multiplicidad por ítem

El sistema SHALL mantener, **dentro de cada actividad**, todo el comportamiento documental ya
especificado: los ítems derivados del checklist de la obra social asignada, la cardinalidad múltiple
sin sobrescritura por ítem, la distinción del documento vigente, y la previsualización por documento
puntual.

Subir un documento en un ítem de una actividad MUST NOT reemplazar ni eliminar documentos de ese mismo
ítem en otra actividad.

#### Scenario: Dos documentos del mismo ítem, en dos actividades distintas

- **GIVEN** un paciente con dos actividades, y un documento cargado para el ítem "presupuesto" en la
  primera
- **WHEN** el usuario carga un documento para el ítem "presupuesto" en la segunda actividad
- **THEN** ambos documentos coexisten, cada uno dentro de su propia actividad, y ninguno reemplaza al
  otro

#### Scenario: Varias versiones de un mismo ítem dentro de una misma actividad

- **GIVEN** un ítem del checklist de una actividad con un documento ya cargado
- **WHEN** el usuario carga un segundo documento para ese mismo ítem de esa misma actividad (por
  ejemplo, la renovación del período siguiente)
- **THEN** ambos quedan visibles dentro de esa actividad, con la distinción entre el vigente y el
  siguiente, sin afectar a ninguna otra actividad

### Requirement: Documentación del paciente no asociada a ninguna actividad

El sistema SHALL conservar y mostrar la documentación del paciente que no está asociada a ninguna
actividad, sin ocultarla ni reasignarla automáticamente a una actividad.

El sistema MUST NOT reasignar de forma implícita un documento existente a una actividad sin acción
explícita del usuario.

> **Depende del Checkpoint (c) de `design.md`**: si esa documentación se presenta en un bloque
> "general" propio (recomendación del propose) o si se exige asignarla a una actividad. La prohibición
> de reasignar implícitamente es válida cualquiera sea el veredicto.

#### Scenario: Documentos cargados antes de la separación por actividad

- **GIVEN** un paciente con documentos cargados cuando el checklist todavía era único por paciente
- **WHEN** el usuario abre la sección de documentación
- **THEN** esos documentos siguen siendo visibles y consultables, y el sistema no los asigna por su
  cuenta a ninguna actividad

### Requirement: Progreso documental visible por actividad

El sistema SHALL mostrar el estado de avance de la documentación de cada actividad de forma
independiente (cuántos ítems de esa actividad están cargados sobre el total de ítems que le
corresponden).

El sistema MUST NOT presentar un único indicador de avance que impida saber a qué actividad le falta
documentación.

> **Depende del Checkpoint (f) de `design.md`**: si además del avance por actividad existe un total
> agregado del paciente (recomendación del propose).

#### Scenario: Una actividad completa y otra incompleta

- **GIVEN** un paciente con una actividad con todos sus ítems requeridos cargados y otra con ítems
  pendientes
- **WHEN** el usuario consulta la sección de documentación
- **THEN** el avance de cada actividad se muestra por separado, permitiendo identificar cuál de las dos
  tiene documentación pendiente

### Requirement: Quitar una actividad no destruye su documentación en silencio

Cuando el usuario intenta eliminar una actividad que tiene documentación cargada, el sistema SHALL
informarle explícitamente que existe documentación asociada antes de que la eliminación se concrete.
El sistema MUST NOT eliminar ni volver inaccesible esa documentación sin una acción confirmada por el
usuario.

> **Depende del Checkpoint (e) de `design.md`**: si el veredicto es "advertir y confirmar"
> (recomendación del propose) o "bloquear la eliminación mientras haya documentación". Ambas
> satisfacen este requisito; "sin protección" no lo satisface. Si el veredicto pide bloqueo o
> advertencia dentro del editor de direcciones, este change agrega además un delta sobre la capability
> `paciente-direcciones`.

#### Scenario: Intento de quitar una actividad con documentos cargados

- **GIVEN** una actividad del paciente con al menos un documento cargado en su checklist
- **WHEN** el usuario intenta quitarla
- **THEN** el sistema le informa que esa actividad tiene documentación asociada y la eliminación no se
  concreta sin su confirmación explícita

#### Scenario: Quitar una actividad sin documentación

- **GIVEN** una actividad del paciente sin ningún documento cargado
- **WHEN** el usuario la quita
- **THEN** la eliminación procede con el mismo comportamiento que antes de este change, sin pasos
  adicionales

### Requirement: La separación por actividad no altera los demás dominios documentales

La documentación de Vehículos, Conductores y Facturas MUST NOT quedar dividida por actividad ni
requerir un nivel de agrupación para funcionar. El comportamiento observable de esas tres pantallas
SHALL ser idéntico al anterior a este change.

#### Scenario: Un dominio sin actividades sigue con un único checklist

- **GIVEN** un vehículo, un conductor o una factura con su checklist documental
- **WHEN** el usuario abre su pantalla de documentación
- **THEN** se muestra un único checklist, sin bloques por actividad y sin pasos adicionales respecto
  del comportamiento anterior a este change
