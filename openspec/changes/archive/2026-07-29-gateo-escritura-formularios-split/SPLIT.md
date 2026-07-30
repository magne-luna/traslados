# Este change fue dividido en cuatro (2026-07-29)

**No se implementó como tal.** Es el **análisis paraguas** del que se derivaron los cuatro changes reales de gateo de escritura, uno por módulo real del backend, por decisión explícita de la usuaria (Open Question 3, resuelta el 2026-07-29: cada módulo debe ser proponible / aplicable / revisable de forma independiente, respetando el presupuesto de revisión de ~400 líneas por PR).

Se archiva acá para conservar el análisis completo de la superficie (~40 componentes en 7 rutas) y las alternativas descartadas, que los cuatro changes derivados referencian pero no repiten.

## Los cuatro changes derivados

| # | Change | Módulo | Pantallas | Puntos de escritura | Depende de |
|---|---|---|---|---|---|
| 1 | `gateo-obrasocial` | `obra_social` | `/obras-sociales` | ~8 | — (**construye la plomería compartida**) |
| 2 | `gateo-pacientes` | `pacientes` | `/pacientes` | ~13 | 1 |
| 3 | `gateo-facturacion` | `facturacion` | `/presupuestos`, `/facturacion` | ~20 | 1 |
| 4 | `gateo-conductores` | `conductores` | `/conductores`, `/vehiculos`, `/hojas-de-ruta` | ~26 | 1 |

El change 1 construye el mecanismo compartido (contexto en `RequireAuth`, `usePuedeEscribir()`, envoltorio de solo lectura sobre `<fieldset disabled>`, prop opt-in en `Button`, aviso con `Alert`) y lo estrena sobre la superficie más chica. Los changes 2, 3 y 4 **solo consumen** ese mecanismo y son independientes entre sí — pueden aplicarse en cualquier orden, o en paralelo, una vez cerrado el 1.

`obra_social` va primero porque es el único módulo de una sola ruta sin componente de documentos, y porque —descubierto durante este análisis— contiene los **dos únicos componentes con `draggable` de todo el proyecto** (`ChecklistItemRow.tsx:39`, `PlantillaCampoRow.tsx:53`). Como `<fieldset disabled>` **no** bloquea el arrastre, ese hueco del mecanismo se descubre y se cierra en el change más chico en vez de aparecer como un bug en el más grande.

## Las cinco decisiones que la usuaria cerró (2026-07-29)

Quedaron heredadas por los cuatro changes derivados. No re-abrir sin hablar con ella:

1. **Deshabilitar, nunca ocultar**: las acciones de escritura siguen visibles en el DOM pero bloqueadas.
2. **Sí al indicador visible** de modo solo lectura, con `Alert` del design system.
3. **Cuatro changes, uno por módulo real del backend.**
4. **Agrupación módulo→pantalla confirmada** tal cual `seed_modulos.sql`: `conductores` gatea 3 pantallas, `facturacion` gatea 2.
5. **Todas las acciones de escritura al nivel `write`** —incluidas emitir factura, registrar cobro, corregir estado de asistencia y reordenar paradas—. **Ninguna requiere `admin`.**

## Dónde vive cada sección de este análisis

| Secciones de `tasks.md` | Change destino |
|---|---|
| 1, 2, 3 (red de seguridad, contexto/hook, primitivas) + 5 | `gateo-obrasocial` |
| 4 | `gateo-pacientes` |
| 7 | `gateo-facturacion` |
| 6 | `gateo-conductores` |
| 8 | repartida: lo transversal en el change 1, la verificación por módulo en cada uno |

`design.md` D1-D5 (el mecanismo compartido) vive en `gateo-obrasocial`; los otros tres changes lo consumen y solo documentan lo específico de su módulo.

## Gobernanza

La compuerta de **gobernanza CRÍTICO** (dominio auth/permisos) **sigue vigente en cada uno de los cuatro changes por separado**: `/opsx:apply` requiere aprobación humana explícita antes de escribir código, y el cierre de cada uno requiere verificación manual con una cuenta real de solo `read` a cargo de la usuaria.
