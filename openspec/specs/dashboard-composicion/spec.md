## ADDED Requirements

### Requirement: Pantalla de dashboard montada en la ruta raíz
El sistema SHALL reemplazar el contenido placeholder de la ruta `/` por la pantalla de dashboard, modificando únicamente el `element` de esa ruta en `frontend/src/app/router.tsx`. `frontend/src/app/routes.ts` MUST permanecer sin cambios.

#### Scenario: Dashboard como pantalla inicial
- **WHEN** la usuaria autenticada accede a la raíz de la aplicación
- **THEN** se renderiza el dashboard dentro del shell de la aplicación, en vez de la página placeholder de "próximamente"

#### Scenario: Lista de rutas intacta
- **WHEN** se inspecciona `app/routes.ts` después del cambio
- **THEN** la lista de los ocho módulos, sus paths, etiquetas e íconos son idénticos a antes

#### Scenario: Ruta protegida como el resto
- **WHEN** una persona no autenticada intenta acceder a la raíz
- **THEN** el guard de autenticación existente la redirige al login, sin que el dashboard introduzca ninguna excepción

### Requirement: Composition root con inyección de repositorios de solo lectura
El sistema SHALL componer la pantalla en `DashboardRoute`, inyectando por context las implementaciones mock de `FacturaRepository`, `CobroRepository`, `PacienteRepository`, `VehiculoRepository` y `HojaDeRutaRepository`, reutilizando los contexts que las features existentes ya exponen y creando solo los que falten. Ningún componente del dashboard MUST importar una implementación concreta.

#### Scenario: Componentes acoplados a la interfaz, no a la implementación
- **WHEN** se inspecciona cualquier componente de `features/dashboard/`
- **THEN** consume el repositorio desde su context tipado por la interfaz, y no importa ningún módulo de `shared/lib/mocks/`

#### Scenario: Sustitución de implementación en FE-8
- **WHEN** se inyecta en el composition root una implementación distinta que cumpla las mismas interfaces
- **THEN** la pantalla funciona sin modificar ningún componente ni ningún hook de presentación

#### Scenario: Sin providers duplicados
- **WHEN** el dashboard necesita un repositorio para el que ya existe un context en otra feature
- **THEN** reutiliza ese context en vez de declarar uno propio, de modo que no haya dos providers del mismo repositorio en el mismo árbol

### Requirement: Solo lectura en toda la pantalla
El sistema SHALL garantizar que el dashboard no escriba datos: no invoca `create`, `update` ni `remove` de ningún repositorio, y no expone formularios de alta o edición.

#### Scenario: Ninguna escritura
- **WHEN** la usuaria interactúa con cualquier control del dashboard (selector de período, selector de año, enlaces)
- **THEN** no se invoca ningún método de escritura de ningún repositorio, y los datos de los módulos fuente quedan inalterados

### Requirement: Carga independiente por bloque
El sistema SHALL cargar los datos en bloques independientes: la hoja de ruta del día por un lado, y el par facturas + cobros por otro (leído una sola vez y compartido por el reporte por período, el resumen anual y la tarjeta de mora), más pacientes y vehículos para sus respectivas tarjetas. La falla de un bloque MUST NOT impedir que los demás se muestren.

#### Scenario: Falla aislada
- **WHEN** la lectura de facturas y cobros falla
- **THEN** los paneles financieros muestran su error acotado y el panel de recorridos del día y las tarjetas de CUD y mantenimiento siguen mostrando su contenido

#### Scenario: Una sola lectura para las tres proyecciones financieras
- **WHEN** se cargan las facturas y los cobros
- **THEN** el reporte por período, el resumen anual y la tarjeta de mora derivan de esa misma lectura en memoria, sin que ninguno dispare una lectura adicional del mismo repositorio

#### Scenario: Recalculo sin nueva lectura
- **WHEN** la usuaria cambia el período o el año seleccionado
- **THEN** las proyecciones se recalculan sobre los datos ya cargados, sin volver a leer los repositorios

### Requirement: Cartel agrupado de discrepancias con el modelo de datos
El sistema SHALL mostrar en la pantalla un cartel `AvisoModeloDatos` único y agrupado con las discrepancias detectadas entre `docs/core/Traslados-Modelo-Datos.docx` y lo que este change necesita, siguiendo el patrón ya usado en facturación.

#### Scenario: Discrepancias visibles sin leer la documentación
- **WHEN** cualquier persona abre el dashboard
- **THEN** ve un cartel que informa que el modelo de datos real no contempla vistas ni reportes, que la mora depende de la fecha de emisión y del estado `facturado` (que el docx no tiene), que el período de atribución del facturado no está estructurado en el docx, y que el CUD y el mantenimiento se derivan en el cliente mientras el docx los persiste

#### Scenario: Un solo cartel, no uno por panel
- **WHEN** se renderiza la pantalla
- **THEN** las discrepancias se agrupan en un único cartel en la parte superior, en lugar de un cartel por panel

#### Scenario: Documentación sincronizada
- **WHEN** se agrega o modifica una discrepancia del cartel
- **THEN** el mismo contenido queda registrado en `knowledge-base/04_modelo_de_datos.md` §Discrepancias y en el bloque `### [C-11]` de `CHANGES.md`

### Requirement: Accesibilidad y estilado del dashboard
El sistema SHALL construir la pantalla con HTML semántico, cumpliendo WCAG 2.1 AA, y estilarla exclusivamente con clases utilitarias de Tailwind v4 apoyadas en los tokens del bloque `@theme` de `frontend/src/index.css`.

#### Scenario: Estructura semántica y navegable por teclado
- **WHEN** se navega la pantalla solo con teclado
- **THEN** los paneles están delimitados por regiones con encabezado, todos los controles y enlaces son alcanzables en un orden lógico y tienen indicador de foco visible

#### Scenario: Sin estilos inline ni important
- **WHEN** se inspecciona el código de los componentes del dashboard
- **THEN** no hay ningún `style={{}}` inline ni ninguna declaración `!important`, y los valores de diseño provienen de los tokens del design system

#### Scenario: Sin any en TypeScript
- **WHEN** se compila el proyecto en modo strict
- **THEN** ningún archivo del dashboard usa `any`, y la compilación y el linter pasan sin advertencias

#### Scenario: Diseño responsive
- **WHEN** la pantalla se ve en un viewport angosto
- **THEN** los paneles y tarjetas se reacomodan sin desbordar horizontalmente, y las tablas de los reportes se desplazan dentro de su propio contenedor
