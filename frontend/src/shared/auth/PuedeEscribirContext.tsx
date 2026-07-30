import { createContext } from 'react';

// ============================================================================================
// REFERENCIA — mecanismo compartido de gateo de escritura (gateo-obrasocial, tasks.md 5.6)
// ============================================================================================
// Firma pública consumida, sin modificarla, por gateo-pacientes, gateo-facturacion y
// gateo-conductores (los otros 3 changes del split "gateo de escritura"). Ninguno de ellos toca
// estos archivos — cada uno solo cablea su propio módulo (ver design.md D1-D6 de este change
// para el razonamiento completo detrás de cada decisión):
//
//   usePuedeEscribir(): boolean
//     shared/auth/usePuedeEscribir.ts — sin argumentos; el componente que lo llama nunca sabe
//     contra qué módulo del backend se resuelve, eso lo determina la ruta activa vía RequireAuth.
//     Fallback `true` fuera de un proveedor (mismo criterio que usePermiso.ts).
//
//   <CamposSoloLectura>{children}</CamposSoloLectura>
//     design-system/components.tsx — envuelve un bloque de formulario en <fieldset disabled>
//     nativo; deshabilita de una vez todos los descendientes (input/select/textarea/button,
//     incluidos los <button> nativos de subcomponentes anidados). Se llama sin props, se
//     autorresuelve contra usePuedeEscribir(). NO cubre elementos `draggable` — ver el patrón de
//     ChecklistItemRow.tsx/PlantillaCampoRow.tsx (condicionar `draggable` + handlers a mano).
//
//   <Button requiereEscritura>...</Button>
//     design-system/components.tsx — prop opt-in (default false); declarar la prop es lo único
//     que activa el gateo en ese botón puntual. Nunca automático: los botones que no escriben
//     (Cancelar, Volver al listado, conmutadores de vista, Reintentar) no llevan la prop.
//
//   <AvisoSoloLectura />
//     design-system/components.tsx — sin props; se monta una sola vez en la página de cada
//     módulo (patrón: ObraSocialesPage.tsx) y cubre lista + detalle. Renderiza null con permiso.
//
// Ninguna de estas 4 piezas recibe ni necesita el nombre del módulo del backend — ver
// PuedeEscribirContext de abajo para dónde se resuelve.
// ============================================================================================

// Contexto de permiso de escritura por ruta (design.md D1): expone un único booleano derivado
// del módulo de la ruta activa (que RequireAuth ya resuelve con moduloDeRuta() para su gateo de
// `read`) cruzado con usePermiso(modulo, 'write'). Sembrado en un único punto — RequireAuth —
// que ya está en el camino de las 8 rutas protegidas: ninguna pantalla tiene que acordarse de
// montar un proveedor propio.
//
// `null` = fuera de un RequireAuth. usePuedeEscribir() (usePuedeEscribir.ts) lo interpreta como
// `true`: preserva el comportamiento previo al gateo para un componente mal ubicado o un test que
// monta un formulario aislado sin router, que es lo que mantiene verdes los ~190 tests existentes
// sin editarlos.
//
// IMPORTANTE (security-review): esto es UX, no una frontera de seguridad — mismo lenguaje que
// permisos.ts y SidebarNav.tsx. La autorización efectiva de escritura la impone la RLS del
// servidor vía modulos.tiene_permiso(modulo, 'write'); un cliente parcheado que fuerce este
// contexto a `true` no escribe ni una fila más de las que la RLS permite.
export const PuedeEscribirContext = createContext<boolean | null>(null);
