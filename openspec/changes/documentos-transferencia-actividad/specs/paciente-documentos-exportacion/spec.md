## Purpose

Permite sacar del sistema los **archivos reales** ya cargados de una actividad puntual del
paciente, empaquetados en un `.zip` listo para armar el legajo y entregarlo a un tercero (botón
"Exportar", `tasks.md` §12).

## ADDED Requirements

> **Nota de estado (actualizada 2026-08-11, REVERTIDO).** Este archivo describía originalmente dos
> capacidades complementarias: un **resumen** presentable del estado documental (botón "Ver
> resumen"/"Imprimir", con un embebido posterior del documento vigente de cada ítem cargado) y los
> **archivos reales** empaquetados en un `.zip` (botón "Exportar"). La cadena de veredictos del
> **Checkpoint (b)** de `design.md` fue **A (resumen imprimible) → A+B (resumen + zip en paralelo)
> → A+B+embebido → solo B**: la usuaria decidió dar marcha atrás por completo en la mitad "resumen
> imprimible" — *"siento que no tiene utilidad"* — y se quedó solo con "Exportar" (el `.zip`), que
> ya cubre el caso de uso real (armar el legajo para la obra social). Ver `tasks.md` §0.2
> (VEREDICTO REVERTIDO), §2/§11/§13/§14 (marcados REVERTIDOS, historial conservado).
>
> Los ocho Requirements que describían el resumen imprimible/"Ver resumen"/"Imprimir"/el embebido
> se retiraron de este archivo — el código que implementaban (`DocumentacionActividadImprimible.tsx`,
> `PdfPaginasImpresion.tsx`, `exportacionDocumental.ts`, la regla `@media print`/`.print-target` de
> `index.css`) se borró. Quedan únicamente los tres Requirements de "Exportar" (`.zip`), sin cambios
> de comportamiento respecto de su primera implementación en `tasks.md` §12.

### Requirement: Los archivos reales de una actividad se pueden descargar en un solo paso

> **`tasks.md` §12, Checkpoint (b) VEREDICTO REVISADO (2026-08-11).** Botón "Exportar" — cubre el
> pedido real de la usuaria de bajarse los adjuntos ya cargados para armar el legajo.

El sistema SHALL permitir descargar, en un solo paso, los documentos ya cargados de **una actividad
puntual** del paciente, empaquetados en un único archivo `.zip`, de forma independiente de las demás
actividades del mismo paciente.

La descarga SHALL abarcar exactamente los documentos de esa actividad, y MUST NOT incluir documentos
de otras actividades del paciente ni del bloque general.

El nombre del archivo `.zip` SHALL identificar sin ambigüedad al paciente, a la actividad y a la fecha
de la descarga.

#### Scenario: Descargar los archivos de una actividad

- **GIVEN** una actividad con varios documentos ya cargados
- **WHEN** el usuario hace clic en "Exportar"
- **THEN** el navegador descarga un `.zip` que contiene el contenido real de esos documentos, con un
  nombre que identifica al paciente y a la actividad

#### Scenario: Descargar los archivos de dos actividades da dos archivos distintos

- **GIVEN** un paciente con dos actividades, cada una con su propia documentación cargada
- **WHEN** el usuario exporta cada una por separado
- **THEN** cada `.zip` contiene únicamente los documentos de su propia actividad, y ninguno incluye
  documentos de la otra

### Requirement: La descarga de archivos reales tolera documentos individuales no disponibles

Un documento que no se pueda incluir (no previsualizable, o un fallo al obtener su contenido) MUST NOT
abortar la descarga completa: el resto de los documentos de la actividad SHALL incluirse igual, y el
`.zip` resultante SHALL dejar constancia legible de qué documento no se pudo incluir y por qué.

#### Scenario: Un documento no disponible no impide descargar el resto

- **GIVEN** una actividad con varios documentos cargados, uno de los cuales no tiene contenido
  disponible para incluir
- **WHEN** el usuario exporta esa actividad
- **THEN** el `.zip` se descarga igual, con el resto de los documentos, y deja registro de cuál
  quedó afuera y por qué

### Requirement: Descargar los archivos reales no modifica nada ni exige más permiso que verlos

La descarga SHALL ser una operación de solo lectura: MUST NOT crear, modificar, mover ni eliminar
ningún documento, y MUST NOT cambiar el estado documental del paciente.

El permiso de lectura sobre el módulo de pacientes SHALL ser suficiente para descargar los archivos;
no se SHALL exigir permiso de escritura.

#### Scenario: Descargar en modo solo lectura

- **GIVEN** un usuario con permiso de lectura pero no de escritura sobre el módulo de pacientes
- **WHEN** descarga los archivos reales de una actividad
- **THEN** la descarga se completa con normalidad
