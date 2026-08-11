# Paciente Documentos

## Purpose

Define the requirements for document management in the patient record, reusing the DocumentChecklist component and logic from FE-1 (Document Management) without recreation or duplication. Ensures document requirements are derived from the patient's assigned social work checklist, respecting order and configuration. Handles loading, empty, and error states explicitly.

---

## Requirements

### Requirement: Documentación del paciente reutilizando el checklist de FE-1
El sistema SHALL mostrar una pestaña/sección de documentación del paciente reutilizando el componente `DocumentChecklist` (FE-1) y su wiring (`useDocumentChecklist` + `DocumentoRepository`), con la entidad `paciente`. El sistema MUST NOT recrear el modelo de checklist ni un componente documental paralelo. Desde `integracion-documentos`, la implementación inyectada es `supabaseDocumentoRepository` (real, contra Storage/Postgres) — ver capability `documento-repository-supabase` para el contrato de esa implementación.

#### Scenario: Adjuntar y quitar documentos del paciente
- **WHEN** el usuario sube o quita un documento en la pestaña de documentación
- **THEN** el cambio se refleja usando el mismo mecanismo de FE-1 (subir/quitar sobre `DocumentoRepository`), asociado a la entidad `paciente` y al id del paciente

### Requirement: Ítems filtrados por la obra social del paciente
El sistema SHALL derivar los ítems del checklist documental del paciente del checklist configurado en su obra social asignada (leído vía `ObraSocialRepository` de FE-2), respetando el orden de los ítems tal como los exige esa obra social (RN-FA-08). El sistema MUST NOT usar una lista de documentos genérica única.

#### Scenario: El checklist depende de la obra social asignada
- **WHEN** el paciente tiene una obra social asignada con su checklist configurado
- **THEN** la pestaña de documentación muestra exactamente los ítems de ese checklist, en el orden configurado en la obra social

#### Scenario: Paciente sin obra social o sin checklist
- **WHEN** el paciente no tiene obra social asignada, o su obra social no tiene ítems de checklist
- **THEN** la pestaña muestra un estado vacío explícito en vez de un checklist genérico o una pantalla en blanco

#### Scenario: Estado de carga al resolver la obra social
- **WHEN** la pestaña está resolviendo la obra social y sus documentos
- **THEN** se muestra un estado de carga durante la latencia, sin pantalla en blanco ni loading infinito ante error

### Requirement: Previsualización de un documento cargado sin salir de la pantalla

El sistema SHALL permitir ver el contenido de un documento adjunto puntual del checklist documental
del paciente sin abandonar la pantalla de documentación y sin requerir que el usuario descargue el
archivo previamente.

La acción de previsualizar SHALL apuntar a un documento puntual por su `id` propio, no al ítem del
checklist — un ítem puede tener N documentos cargados simultáneamente.

La previsualización SHALL mostrarse en una superficie de **solo lectura** provista por un componente
reutilizable del design system. El sistema MUST NOT implementar esa superficie como markup ad-hoc
dentro del componente de checklist, y MUST NOT incluir en ella campos editables ni acciones de
escritura sobre el documento.

Cerrar la previsualización SHALL devolver al usuario a la pantalla de documentación en el mismo
estado en que la dejó, sin recargar el checklist ni perder el progreso visible.

#### Scenario: Ver el contenido de un documento recién cargado

- **GIVEN** un paciente con un documento cargado en un ítem del checklist (ej. el RHC)
- **WHEN** el usuario activa la acción de previsualizar ese documento
- **THEN** se muestra el contenido del documento en una ventana de solo lectura sobre la misma
  pantalla, sin navegar a otra ruta ni descargar el archivo

#### Scenario: Cada documento de un ítem con múltiples documentos se previsualiza por separado

- **GIVEN** un ítem del checklist con dos o más documentos cargados (ej. el presupuesto vigente y el
  de la renovación)
- **WHEN** el usuario activa la previsualización de uno de ellos
- **THEN** se muestra el contenido de ese documento puntual, y no el de otro documento del mismo ítem

#### Scenario: Cerrar la previsualización no altera el checklist

- **GIVEN** una previsualización abierta sobre la pantalla de documentación
- **WHEN** el usuario la cierra
- **THEN** el checklist permanece con los mismos documentos, el mismo progreso y la misma marca de
  documento vigente que antes de abrirla

### Requirement: Estados explícitos de la previsualización

El sistema SHALL representar explícitamente el estado de resolución del contenido a previsualizar.
El sistema MUST NOT mostrar una ventana en blanco ni un indicador de carga indefinido ante un fallo.

Mientras el contenido se resuelve, el sistema SHALL mostrar un estado de carga. Si la resolución
falla, el sistema SHALL mostrar un mensaje de error comprensible y MUST NOT propagar a la interfaz el
mensaje crudo del error de origen. Si el documento existe pero su contenido no puede previsualizarse
—porque su formato no es soportado o porque no hay contenido asociado— el sistema SHALL mostrar un
estado explícito que lo indique, junto con el nombre del archivo, en vez de un error.

#### Scenario: Documento cuyo contenido todavía se está resolviendo

- **WHEN** el usuario abre la previsualización y el contenido aún no está disponible
- **THEN** se muestra un estado de carga acotado, que se reemplaza por el contenido o por un estado
  de error, nunca por una ventana en blanco permanente

#### Scenario: Falla la resolución del contenido

- **GIVEN** un documento cuya previsualización no puede resolverse (por ejemplo, permiso denegado o
  contenido inaccesible)
- **WHEN** el usuario abre la previsualización
- **THEN** se muestra un mensaje de error comprensible para la usuaria, sin exponer el mensaje técnico
  del error de origen

#### Scenario: Documento de un formato no previsualizable

- **GIVEN** un documento cargado cuyo formato no puede renderizarse en la ventana
- **WHEN** el usuario abre la previsualización
- **THEN** se muestra un estado explícito de "no previsualizable" junto con el nombre del archivo, y
  el sistema no intenta renderizar el contenido

#### Scenario: Documento sin contenido asociado

- **GIVEN** un documento registrado en el checklist antes de que existiera la previsualización, sin
  contenido resoluble
- **WHEN** el usuario abre la previsualización
- **THEN** se muestra el estado explícito de contenido no disponible, y el sistema no lo trata como
  un error

### Requirement: La previsualización no amplía el acceso a los documentos

La previsualización SHALL operar exclusivamente sobre mecanismos de acceso autenticados. El sistema
MUST NOT exponer los documentos mediante URLs de acceso público, MUST NOT alterar la privacidad de los
buckets de almacenamiento y MUST NOT usar credenciales de servicio desde el frontend.

El acceso al contenido SHALL seguir estando determinado por las políticas de seguridad del servidor.
Ningún control de la interfaz SHALL ser la autoridad que decide si un documento puede leerse.

#### Scenario: La previsualización no genera acceso público

- **WHEN** el usuario previsualiza un documento
- **THEN** el contenido se obtiene por un mecanismo de acceso autenticado y acotado en el tiempo, y no
  queda accesible mediante una URL pública permanente

#### Scenario: Sin permiso de lectura no hay previsualización

- **GIVEN** un usuario sin permiso de lectura sobre el módulo de la entidad del documento
- **WHEN** se intenta resolver el contenido de un documento
- **THEN** la resolución es rechazada por las políticas del servidor y la interfaz muestra el estado
  de error correspondiente, sin mostrar el contenido

### Requirement: Cardinalidad múltiple sin sobrescritura por tipo de documento

El sistema SHALL permitir que un mismo ítem del checklist documental del paciente tenga más de un documento adjunto simultáneamente. Subir un documento nuevo para un ítem que ya tiene uno o más documentos cargados MUST NOT reemplazar ni eliminar los documentos anteriores del mismo ítem — se acumulan. El sistema MUST NOT imponer un tope de cantidad de documentos por ítem.

Cuando un ítem tiene más de un documento cargado, el sistema SHALL distinguir visualmente cuál es el documento vigente (el de `vigenciaDesde` más reciente que no sea futuro, con fallback a la fecha de carga si ningún documento indica `vigenciaDesde`) del resto, que se muestran como historial/continuidad.

Quitar un documento puntual de la colección MUST NOT afectar a los demás documentos del mismo ítem.

#### Scenario: Dos documentos del mismo tipo conviven sin sobrescribirse

- **GIVEN** un paciente con un documento ya cargado para un ítem del checklist (ej. un presupuesto vigente agosto-julio)
- **WHEN** el usuario sube un segundo documento para el mismo ítem (ej. el presupuesto de la renovación agosto-julio del año siguiente)
- **THEN** ambos documentos quedan visibles y consultables, ninguno se sobrescribe ni se pierde

#### Scenario: Sin tope de cantidad por ítem

- **GIVEN** un ítem del checklist con documentos ya cargados
- **WHEN** el usuario sigue subiendo documentos adicionales del mismo ítem
- **THEN** el sistema los acumula sin rechazar la carga por haber alcanzado una cantidad máxima

#### Scenario: Distinción visual entre el documento vigente y el siguiente

- **GIVEN** un ítem con dos documentos cargados, uno con `vigenciaDesde` pasada o presente y otro con `vigenciaDesde` futura
- **WHEN** se muestra el checklist documental
- **THEN** el documento con la `vigenciaDesde` más reciente que no sea futura se marca como vigente, y el otro se muestra como continuidad/historial

#### Scenario: Quitar un documento puntual no afecta a los demás del mismo ítem

- **GIVEN** un ítem con dos o más documentos cargados
- **WHEN** el usuario quita uno de esos documentos puntualmente
- **THEN** los demás documentos del mismo ítem permanecen cargados y visibles

### Requirement: Checklist documental instanciado por actividad del paciente

El sistema SHALL instanciar el checklist documental del paciente **una vez por cada actividad registrada del paciente**, y MUST NOT presentar un único checklist que represente al paciente completo.

Cada instancia SHALL identificar de forma legible a qué actividad corresponde, incluso cuando dos actividades comparten el mismo tipo (por ejemplo, dos terapias distintas).

Los documentos cargados en una actividad MUST NOT aparecer, contarse ni afectar el estado de ninguna otra actividad del mismo paciente.

Una "actividad", a los efectos de este requisito, es una `Direccion` del paciente cuyo `tipo` **no** es `'domicilio'` — el domicilio del paciente no lleva checklist propio, su documentación cae en el bloque general de "Documentación del paciente no asociada a ninguna actividad".

#### Scenario: Un paciente con varias actividades ve varios checklists

- **GIVEN** un paciente con una escuela y dos terapias registradas
- **WHEN** el usuario abre la sección de documentación del paciente
- **THEN** se muestra un checklist documental independiente por cada una de esas actividades, cada uno identificado con la actividad a la que pertenece

#### Scenario: Dos actividades del mismo tipo son distinguibles entre sí

- **GIVEN** un paciente con dos actividades del mismo tipo, diferenciadas por su descripción (por ejemplo, "Kinesióloga" y "Fonoaudióloga")
- **WHEN** se muestran sus checklists documentales
- **THEN** cada checklist se identifica con la descripción de su actividad, y el usuario puede distinguir cuál es cuál sin ambigüedad

#### Scenario: Los documentos de una actividad no se filtran a otra

- **GIVEN** un paciente con dos actividades, y un documento cargado en un ítem de la primera
- **WHEN** el usuario consulta el checklist de la segunda actividad
- **THEN** ese documento no aparece en la segunda actividad, y el ítem correspondiente de la segunda actividad sigue figurando como no cargado

#### Scenario: Agregar una actividad nueva agrega su checklist

- **GIVEN** un paciente con sus actividades ya registradas y documentación cargada en ellas
- **WHEN** el usuario registra una actividad nueva
- **THEN** aparece un checklist documental adicional para esa actividad, vacío, sin alterar la documentación ya cargada en las demás

### Requirement: La multiplicidad por actividad se compone con la multiplicidad por ítem

El sistema SHALL mantener, **dentro de cada actividad**, todo el comportamiento documental ya especificado: los ítems derivados del checklist de la obra social asignada, la cardinalidad múltiple sin sobrescritura por ítem, la distinción del documento vigente, y la previsualización por documento puntual.

Subir un documento en un ítem de una actividad MUST NOT reemplazar ni eliminar documentos de ese mismo ítem en otra actividad.

#### Scenario: Dos documentos del mismo ítem, en dos actividades distintas

- **GIVEN** un paciente con dos actividades, y un documento cargado para el ítem "presupuesto" en la primera
- **WHEN** el usuario carga un documento para el ítem "presupuesto" en la segunda actividad
- **THEN** ambos documentos coexisten, cada uno dentro de su propia actividad, y ninguno reemplaza al otro

#### Scenario: Varias versiones de un mismo ítem dentro de una misma actividad

- **GIVEN** un ítem del checklist de una actividad con un documento ya cargado
- **WHEN** el usuario carga un segundo documento para ese mismo ítem de esa misma actividad (por ejemplo, la renovación del período siguiente)
- **THEN** ambos quedan visibles dentro de esa actividad, con la distinción entre el vigente y el siguiente, sin afectar a ninguna otra actividad

### Requirement: Documentación del paciente no asociada a ninguna actividad

El sistema SHALL conservar y mostrar la documentación del paciente que no está asociada a ninguna actividad, sin ocultarla ni reasignarla automáticamente a una actividad.

El sistema MUST NOT reasignar de forma implícita un documento existente a una actividad sin acción explícita del usuario.

Esa documentación SHALL presentarse en un bloque "General" propio, distinto de los bloques por actividad y mostrado primero.

#### Scenario: Documentos cargados antes de la separación por actividad

- **GIVEN** un paciente con documentos cargados cuando el checklist todavía era único por paciente
- **WHEN** el usuario abre la sección de documentación
- **THEN** esos documentos siguen siendo visibles y consultables, y el sistema no los asigna por su cuenta a ninguna actividad

### Requirement: Progreso documental visible por actividad

El sistema SHALL mostrar el estado de avance de la documentación de cada actividad de forma independiente (cuántos ítems de esa actividad están cargados sobre el total de ítems que le corresponden).

El sistema MUST NOT presentar un único indicador de avance que impida saber a qué actividad le falta documentación.

Además del avance por actividad, el sistema SHALL mostrar un total agregado del paciente.

#### Scenario: Una actividad completa y otra incompleta

- **GIVEN** un paciente con una actividad con todos sus ítems requeridos cargados y otra con ítems pendientes
- **WHEN** el usuario consulta la sección de documentación
- **THEN** el avance de cada actividad se muestra por separado, permitiendo identificar cuál de las dos tiene documentación pendiente

### Requirement: Quitar una actividad no destruye su documentación en silencio

Cuando el usuario intenta eliminar una actividad que tiene documentación cargada, el sistema SHALL informarle explícitamente que existe documentación asociada antes de que la eliminación se concrete. El sistema MUST NOT eliminar ni volver inaccesible esa documentación sin una acción confirmada por el usuario.

El delta correspondiente sobre la capability `paciente-direcciones` se encuentra en esa spec.

#### Scenario: Intento de quitar una actividad con documentos cargados

- **GIVEN** una actividad del paciente con al menos un documento cargado en su checklist
- **WHEN** el usuario intenta quitarla
- **THEN** el sistema le informa que esa actividad tiene documentación asociada y la eliminación no se concreta sin su confirmación explícita

#### Scenario: Quitar una actividad sin documentación

- **GIVEN** una actividad del paciente sin ningún documento cargado
- **WHEN** el usuario la quita
- **THEN** la eliminación procede con el mismo comportamiento que antes de este change, sin pasos adicionales

### Requirement: La separación por actividad no altera los demás dominios documentales

La documentación de Vehículos, Conductores y Facturas MUST NOT quedar dividida por actividad ni requerir un nivel de agrupación para funcionar. El comportamiento observable de esas tres pantallas SHALL ser idéntico al anterior a este change.

#### Scenario: Un dominio sin actividades sigue con un único checklist

- **GIVEN** un vehículo, un conductor o una factura con su checklist documental
- **WHEN** el usuario abre su pantalla de documentación
- **THEN** se muestra un único checklist, sin bloques por actividad y sin pasos adicionales respecto del comportamiento anterior a este change

### Requirement: La documentación de una actividad se puede exportar desde su propio bloque

Cada bloque documental de actividad SHALL ofrecer la exportación de **su** documentación, acotada a esa
actividad, sin abarcar las demás.

El comportamiento y el contenido de esa exportación se especifican en la capacidad
`paciente-documentos-exportacion`.

#### Scenario: Exportar desde el bloque de una actividad

- **GIVEN** un paciente con varias actividades documentadas
- **WHEN** el usuario usa la acción de exportar del bloque de una de ellas
- **THEN** obtiene la exportación de esa actividad, y no de las demás

### Requirement: Un documento cargado se puede reasignar desde su propio bloque

Cada documento cargado SHALL ofrecer, dentro del bloque documental donde figura, la acción de
reasignarlo a otra actividad del mismo paciente o al bloque general.

El comportamiento de esa reasignación se especifica en la capacidad
`paciente-documentos-transferencia`.

#### Scenario: Reasignar desde el listado de documentos de un ítem

- **GIVEN** un ítem del checklist de una actividad con un documento cargado
- **WHEN** el usuario usa la acción de reasignar de ese documento
- **THEN** puede elegir a qué otra actividad del paciente —o al bloque general— moverlo

### Requirement: El estado provisorio de este flujo es visible en la pantalla

Mientras el flujo pedido por la clienta no esté confirmado —el requerimiento de origen quedó
explícitamente abierto a la espera de un video que la clienta enviaría—, la pantalla de documentación
del paciente SHALL exhibir un aviso visible que declare que la navegación directa desde una actividad
hacia su documentación **no está implementada todavía**, y que la exportación y la reasignación de
documentos entre actividades sí lo están, sobre la lectura literal del requerimiento y sujetas a
cambiar cuando llegue el video.

El aviso MUST distinguirse de los avisos de discrepancia con el modelo de datos: acá no hay divergencia
con el modelo, hay un requerimiento incompleto pendiente de confirmación del cliente.

#### Scenario: El aviso está visible mientras el checkpoint sigue abierto

- **GIVEN** que el video de la clienta no llegó y el flujo sigue sin confirmarse
- **WHEN** un usuario abre la sección de documentación de un paciente
- **THEN** ve un aviso que indica que este flujo es provisorio y está pendiente de confirmación de la
  clienta
