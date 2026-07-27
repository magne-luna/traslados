## ADDED Requirements

### Requirement: Layout shell con navegación
El sistema SHALL proveer un layout raíz (shell) que envuelve todas las pantallas de módulo, compuesto por una navegación lateral (sidebar) persistente y un área de contenido con un `<Outlet>`. El shell MUST construirse reutilizando los primitivos del design system existentes (`NavIcon`, `tokens`, `components.tsx`) y NO recrear primitivos.

#### Scenario: Shell presente en pantallas de módulo
- **WHEN** el usuario está en cualquier ruta de módulo protegida
- **THEN** se muestra la navegación lateral junto con la pantalla del módulo en el área de contenido

#### Scenario: Navegación construida sobre el design system
- **WHEN** se renderiza la navegación del shell
- **THEN** los íconos e ítems usan los primitivos y tokens del design system existente, sin estilos ni componentes duplicados

### Requirement: Indicación del módulo activo
El sistema SHALL resaltar en la navegación el ítem correspondiente a la ruta actualmente activa, de modo que el usuario siempre sepa en qué módulo está.

#### Scenario: Ítem activo resaltado
- **WHEN** el usuario está en la ruta de un módulo
- **THEN** el ítem de navegación de ese módulo aparece visualmente resaltado y los demás no

### Requirement: Navegación responsive
El sistema SHALL adaptar la navegación a pantallas chicas (RNF-08), de forma que el contenido siga siendo usable en mobile sin que la navegación lo tape de manera permanente.

#### Scenario: Vista en pantalla angosta
- **WHEN** el usuario abre la aplicación en una pantalla de ancho reducido
- **THEN** la navegación se adapta (por ejemplo, colapsable o compacta) sin romper el layout ni impedir el acceso al contenido

### Requirement: Sidebar colapsable en desktop
El sistema SHALL permitir alternar el sidebar entre expandido (272px, con etiquetas) y colapsado (solo íconos, ~72px) en pantallas de escritorio (md en adelante), mediante un botón toggle visible en el propio sidebar. La preferencia SHALL persistir entre recargas (localStorage) para que el usuario no tenga que repetirla en cada sesión.

#### Scenario: Colapsar el sidebar
- **WHEN** el usuario hace click en el botón de colapsar estando el sidebar expandido
- **THEN** el sidebar pasa a mostrar solo los íconos de navegación (sin etiquetas de texto) y el área de contenido gana el ancho liberado

#### Scenario: Expandir el sidebar
- **WHEN** el usuario hace click en el botón de expandir estando el sidebar colapsado
- **THEN** el sidebar vuelve a mostrar íconos junto con las etiquetas de texto

#### Scenario: Accesibilidad en modo colapsado
- **WHEN** el sidebar está colapsado
- **THEN** cada ítem de navegación sigue siendo identificable (tooltip o `aria-label` con el nombre del módulo) para lectores de pantalla y al pasar el mouse

#### Scenario: Preferencia persistida
- **WHEN** el usuario colapsa el sidebar y recarga la página
- **THEN** el sidebar se muestra colapsado sin necesidad de volver a togglearlo

#### Scenario: Sin efecto en mobile
- **WHEN** la app se ve en una pantalla angosta (por debajo de md)
- **THEN** el toggle de colapso de desktop no interfiere con el comportamiento de drawer off-canvas ya existente (RNF-08)
