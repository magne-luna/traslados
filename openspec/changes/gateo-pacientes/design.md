## Context

### El mecanismo ya existe

`gateo-obrasocial` (change 1 del split) construyó y estrenó el mecanismo compartido de gateo de escritura:

```
contexto en RequireAuth      deriva puedeEscribir del módulo de la ruta (moduloDeRuta) × usePermiso(modulo, 'write')
usePuedeEscribir(): boolean  hook sin argumentos; el componente declara que necesita escritura,
                             no contra qué módulo (eso lo determina la ruta)
envoltorio de solo lectura   <fieldset disabled> nativo: deshabilita todos los controles descendientes
                             de una vez, incluidos <button> nativos y campos de subcomponentes anidados
prop opt-in en Button        declara que la acción escribe; NUNCA automática
aviso con Alert              patrón del indicador visible de modo solo lectura
```

**Este change no construye ni modifica nada de eso.** Solo lo consume. Si algo del mecanismo resultara insuficiente, se corrige en el change 1, no acá.

### Lo que falta en este módulo

La pantalla de Pacientes tiene ~13 puntos de escritura sin gatear, repartidos en 13 componentes. `PacientesPage` (62 líneas) es un switch entre lista y detalle, igual que `ObraSocialesPage`.

### Por qué este módulo es el que pone a prueba el mecanismo

Es la primera superficie con **tres editores anidados en profundidad** y con **componente de documentos**:

```
PacientesPage (62)
├── PacientesList (178)              Crear :60 · Crear el primero :82 · Editar por fila :159 · 1 <button> nativo
└── PacienteDetail (199)
    ├── PacienteResumen (122)        Editar :116
    ├── PacienteForm (107)           Cancelar :98 · Guardar :101
    │   ├── PacienteDatosPersonalesFields (155)   campos
    │   ├── PacienteCoberturaFields (74)          campos
    │   └── IdentificadorAfiliadoField (51)       campos
    ├── CudFields (173)              :53 · :90 · :93 · :163 · :166   ← 5 puntos de escritura
    ├── DireccionesEditor (130)      Agregar :123 · 1 <button> nativo · campos
    ├── PersonasACargoEditor (211)   Agregar/Editar :203 · 3 <button> nativos · campos
    └── PacienteDocumentos (71) + PacienteDocumentosChecklist (20)
```

Los editores anidados están a 3-4 niveles de la página y **ninguno sabe a qué módulo del backend pertenece la pantalla en la que vive** — `DireccionesEditor` es un editor de direcciones, nada más. Por eso el mecanismo del change 1 usa contexto y no props: acá se ve por qué.

Además hay **5 `<button>` nativos** (1 en `DireccionesEditor`, 1 en `PacientesList`, 3 en `PersonasACargoEditor`) que no son componentes `Button` del design system. El envoltorio `<fieldset disabled>` los cubre por ser HTML nativo; este change lo verifica en la práctica.

**No hay `draggable` en este módulo** (verificado con grep: los dos únicos del proyecto están en `obra_social` y ya se cerraron en el change 1), así que el hueco de arrastre de `design.md` D4 del change 1 no aplica acá.

### Frontera de seguridad (no negociable)

La autorización efectiva la impone la RLS: `modulos.tiene_permiso('pacientes', 'write')`. **Este gateo es experiencia de uso.** El código nuevo lleva el mismo comentario que ya llevan `permisos.ts`, `SidebarNav.tsx` y el mecanismo del change 1.

## Goals / Non-Goals

**Goals:**

- Gatear por nivel `write` sobre `pacientes` todas las acciones que persisten datos de la pantalla de Pacientes.
- Verificar que el envoltorio del change 1 cubre los 3 editores anidados y los 5 `<button>` nativos sin cambiarles la firma.
- Mantener disponible con `read` todo lo que es consulta: ficha, direcciones, personas a cargo, CUD, y la **descarga** de documentos existentes.
- Que los tests existentes de pacientes sigan pasando **sin tocarlos**.

**Non-Goals:**

- No se construye ni se modifica el mecanismo compartido (change 1).
- No se cablean los otros tres módulos.
- No se toca `tienePermiso`, `usePermiso`, la jerarquía, ni el gateo de navegación por `read`.
- No se toca ninguna policy de RLS ni Edge Function.
- No se traduce el error de RLS del servidor a un mensaje amigable.

## Decisions

### D1 — El envoltorio de solo lectura va en `PacienteForm`, no en cada bloque de campos

`PacienteForm` (107 líneas) compone tres bloques de campos: `PacienteDatosPersonalesFields` (155), `PacienteCoberturaFields` (74) e `IdentificadorAfiliadoField` (51). Envolver **una vez** en `PacienteForm` deshabilita los campos de los tres, porque `<fieldset disabled>` alcanza a todos los descendientes.

Consecuencia deliberada: los tres componentes de campos **no cambian ni una línea** y no reciben ninguna prop nueva. Es exactamente el beneficio que justificó el fieldset en el change 1.

**Alternativa descartada — envolver cada bloque por separado.** Tres envoltorios en vez de uno, sin ninguna ganancia: no hay ningún caso donde un bloque deba estar editable y otro no.

**Alternativa descartada — pasar `disabled` a cada bloque de campos.** Tres firmas nuevas que después hay que propagar a cada campo interno; es el camino que el change 1 ya descartó.

### D2 — Los editores anidados se gatean por separado del formulario

`CudFields`, `DireccionesEditor` y `PersonasACargoEditor` **no** están dentro de `PacienteForm`: cuelgan de `PacienteDetail`, en paralelo al formulario. Cada uno tiene su propio ciclo de edición inline (la convención del proyecto: editar inline, nunca modal), así que cada uno necesita su propio gateo — no los alcanza el envoltorio de D1.

Cada editor consume `usePuedeEscribir()` directamente. Ninguno recibe el módulo por props ni importa el literal `'pacientes'`.

Caso particular de `CudFields`: tiene 5 puntos de escritura porque implementa un mini-ciclo de edición propio (`:53` empezar edición, `:90` editar, `:93` quitar, `:163` cancelar edición interna, `:166` guardar). El `:163` (*Cancelar* interno) **no escribe** y debe seguir operativo — mismo criterio que el `Cancelar` del formulario. Es el punto más fácil de gatear de más en todo este change.

### D3 — Consultar un documento no es escribirlo

`PacienteDocumentos` (71) y `PacienteDocumentosChecklist` (20) mezclan dos cosas: **cargar/dar de baja** documentos (escritura) y **consultar/descargar** los existentes (lectura). Solo la primera se gatea.

Bloquear la descarga a una cuenta con `read` sería una regresión: `read` sobre el módulo es exactamente el permiso que autoriza a ver los documentos del paciente, y la RLS del servidor los devuelve. El gateo del cliente no debe ser más restrictivo que la RLS — sería inventar una regla que el servidor no tiene.

Este criterio se replica en los otros dos changes que tienen documentos (`gateo-conductores` para `ConductorDocumentos` y `VehiculoDocumentos`, `gateo-facturacion` para `FacturaDocumentos`).

### D4 — El aviso de solo lectura va en `PacientesPage`

Una sola inserción en el switch lista/detalle (62 líneas) cubre las dos vistas, replicando el patrón que `gateo-obrasocial` fijó en `ObraSocialesPage`. Mismo tono, mismo texto, misma ubicación: la consistencia entre módulos es el punto.

### D5 — Pruebas: dos direcciones por comportamiento, con `renderConSesion`

Cada comportamiento se prueba con `write` (habilitado) y con solo `read` (deshabilitado), que es el mínimo de triangulación del modo Strict TDD. `renderConSesion` ya permite declarar el escenario; su default (admin con todos los permisos) mantiene verdes los tests existentes de pacientes sin editarlos.

Las aserciones van sobre comportamiento observable —`toBeDisabled()`, el `onSubmit` que no dispara, el repositorio mock que no recibe llamadas— nunca sobre el valor del contexto ni sobre clases CSS.

El rol `admin` tiene ciclo propio: `tienePermiso` le da `true` sin consultar la matriz, así que un `admin` sin ninguna fila en `modulos.permisos` debe tener todo habilitado. Es el falso negativo más caro y un test de "solo read" no lo detecta.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Falso negativo: deshabilitar a quien sí puede escribir**, sobre todo al rol `admin` sin filas en la matriz | Ciclo TDD propio para `admin` sin filas, además del par `write`/`read` por comportamiento |
| **Gatear de más en `CudFields`** — su *Cancelar* interno (`:163`) no escribe y bloquearlo encierra a la cuenta en un sub-formulario | Ciclo TDD dedicado: con solo `read`, el *Cancelar* interno sigue activable |
| **Bloquear la descarga de documentos** a una cuenta con `read`, siendo más restrictivo que la RLS | D3 + ciclo TDD que verifica que consultar y descargar siguen disponibles con `read` |
| **El envoltorio no cubre los 5 `<button>` nativos** de `DireccionesEditor` / `PacientesList` / `PersonasACargoEditor` | Ciclo TDD por editor que afirma el estado deshabilitado de sus botones nativos. Si falla, el arreglo va en el change 1, no acá |
| **Los editores anidados quedan fuera del gateo** por asumir que el envoltorio del formulario los alcanza — no los alcanza, cuelgan de `PacienteDetail` | D2: cada editor tiene su propio ciclo TDD, y 3 de los 13 puntos de escritura viven ahí |
| **Romper los tests existentes de pacientes** (la feature con más superficie del módulo) | Fallback `true` del mecanismo fuera del provider + prop opt-in de `Button`. Verificado contra la línea base en cada tarea |
| **OWASP A04 *Insecure Design*** — leer este gateo como la frontera de autorización | Comentario explícito en el código nuevo; el requisito ya está fijado por el change 1 |
| **Divergencia con la semántica del servidor** | No se toca `tienePermiso` ni `ORDEN_NIVEL`: se consume la misma función con `'write'` |

## Migration Plan

Cero SQL, cero Edge Functions, cero dependencias, cero estado persistido. Build normal del frontend.

**Rollback:** revertir el commit devuelve Pacientes a su comportamiento actual sin afectar al mecanismo compartido ni a los otros módulos.

**Verificación manual (humana, no automatizable con mocks):** con una cuenta real de solo `read` sobre `pacientes`, confirmar que (a) *Crear*/*Editar*/*Guardar* están visibles pero bloqueados, (b) el aviso de solo lectura aparece, (c) *Cancelar* (el del formulario **y** el interno de `CudFields`) y *Volver al listado* funcionan, (d) los tres editores anidados están inertes pero sus datos son legibles, (e) los documentos del paciente se pueden **consultar y descargar** pero no cargar ni dar de baja, y (f) una cuenta con `write` no ve nada deshabilitado. A cargo de la usuaria.

## Open Questions

Ninguna. Las cinco del análisis paraguas quedaron resueltas por la usuaria el 2026-07-29. Lo único pendiente es la aprobación humana de gobernanza CRÍTICO para empezar a escribir código.

## Governance

Dominio **auth/permisos → nivel CRÍTICO** en la tabla de Agent Governance del proyecto. **`/opsx:apply` requiere aprobación humana explícita antes de escribir una sola línea**, y el cierre requiere la verificación manual del Migration Plan.
