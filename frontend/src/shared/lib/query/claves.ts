import type { RangoPagina } from '../../types/paginacion';
import type { FiltrosConductor } from '../conductores/ConductorRepository';
import type { FiltrosObraSocial } from '../obrasSociales/ObraSocialRepository';
import type { FiltrosPaciente } from '../pacientes/PacienteRepository';

// Único lugar donde se construyen `queryKey` (design.md §D4). Ningún otro archivo del proyecto
// debe escribir un literal de clave a mano.
//
// **Por qué esto es el punto crítico de todo el change:** una clave mal escrita en una invalidación
// NO falla — simplemente no invalida nada, y el bug aparece como un dato viejo en un selector,
// semanas después (R1). Centralizarlas y tiparlas convierte ese fallo silencioso en un error de
// compilación.
//
// Jerarquía deliberada, de menos a más específico:
//
//     [dominio]  →  [dominio, 'lista']  →  [dominio, 'pagina', query]
//
// React Query hace match por PREFIJO, así que `invalidateQueries({ queryKey: claves.X.todos() })`
// alcanza la lista completa y todas las páginas del dominio de una sola vez. Es exactamente lo que
// necesita una mutación, e incluye el camino paginado (R1).

/** Forma de la consulta paginada de cada dominio: rango + sus filtros propios. */
type QueryPagina<F> = RangoPagina & { filtros: F };

export const claves = {
  // --- Dominios de referencia (FRESCURA.referencia) -------------------------------------------
  pacientes: {
    todos: () => ['pacientes'] as const,
    lista: () => ['pacientes', 'lista'] as const,
    pagina: (query: QueryPagina<FiltrosPaciente>) => ['pacientes', 'pagina', query] as const,
  },
  vehiculos: {
    todos: () => ['vehiculos'] as const,
    lista: () => ['vehiculos', 'lista'] as const,
  },
  conductores: {
    todos: () => ['conductores'] as const,
    lista: () => ['conductores', 'lista'] as const,
    pagina: (query: QueryPagina<FiltrosConductor>) => ['conductores', 'pagina', query] as const,
  },
  obrasSociales: {
    todos: () => ['obrasSociales'] as const,
    lista: () => ['obrasSociales', 'lista'] as const,
    pagina: (query: QueryPagina<FiltrosObraSocial>) => ['obrasSociales', 'pagina', query] as const,
  },

  // --- Dominios transaccionales (FRESCURA.transaccional) --------------------------------------
  facturas: {
    todos: () => ['facturas'] as const,
    lista: () => ['facturas', 'lista'] as const,
  },
  cobros: {
    todos: () => ['cobros'] as const,
    lista: () => ['cobros', 'lista'] as const,
    /** Los cobros se consultan SIEMPRE acotados a una factura (`listByFactura`). */
    deFactura: (facturaId: string) => ['cobros', 'deFactura', facturaId] as const,
  },
  presupuestos: {
    todos: () => ['presupuestos'] as const,
    lista: () => ['presupuestos', 'lista'] as const,
  },
  autorizaciones: {
    todos: () => ['autorizaciones'] as const,
    lista: () => ['autorizaciones', 'lista'] as const,
  },
  hojasDeRuta: {
    todos: () => ['hojasDeRuta'] as const,
    lista: () => ['hojasDeRuta', 'lista'] as const,
    /** La hoja del día se consulta SIEMPRE por fecha (`getByFecha`). */
    deFecha: (fecha: string) => ['hojasDeRuta', 'deFecha', fecha] as const,
  },
  recorridosHabituales: {
    todos: () => ['recorridosHabituales'] as const,
    lista: () => ['recorridosHabituales', 'lista'] as const,
    dePaciente: (pacienteId: string) => ['recorridosHabituales', 'dePaciente', pacienteId] as const,
  },
  documentos: {
    todos: () => ['documentos'] as const,
    /** `agrupacionId` instancia N checklists independientes dentro de una misma entidad;
     * `refreshToken` fuerza una relectura sin remontar el componente (ver useDocumentChecklist). */
    deEntidad: (entidad: string, entidadId: string, agrupacionId?: string, refreshToken?: number) =>
      ['documentos', entidad, entidadId, agrupacionId ?? null, refreshToken ?? 0] as const,
  },

  // --- Dominios sensibles (FRESCURA.sensible) -------------------------------------------------
  cuentas: {
    todos: () => ['cuentas'] as const,
    lista: () => ['cuentas', 'lista'] as const,
  },
} as const;
