# Paciente Documentos

## Purpose

Define the requirements for document management in the patient record, reusing the DocumentChecklist component and logic from FE-1 (Document Management) without recreation or duplication. Ensures document requirements are derived from the patient's assigned social work checklist, respecting order and configuration. Handles loading, empty, and error states explicitly.

---

## Requirements

### Requirement: Documentación del paciente reutilizando el checklist de FE-1
El sistema SHALL mostrar una pestaña/sección de documentación del paciente reutilizando el componente `DocumentChecklist` (FE-1) y su wiring (`useDocumentChecklist` + `DocumentoRepository`/`mockDocumentoRepository`), con la entidad `paciente`. El sistema MUST NOT recrear el modelo de checklist ni un componente documental paralelo.

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
