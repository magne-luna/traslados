import type { OrigenCampoPlantilla, PlantillaFactura } from '../../types/obraSocial';

// Función pura (tasks.md 3.1, design.md Decisión 5, US-400/RF-400): arma la descripción de la
// factura recorriendo `plantilla.campos` ordenados por `orden` y resolviendo cada
// `OrigenCampoPlantilla` contra `datos`. Sin repositorios, sin fecha del sistema — el resultado
// se persiste en `Factura.descripcion` al emitir y no se recalcula después (RN-FA-06).
export interface DatosDescripcionFactura {
  pacienteNombre: string;
  pacienteDni: string;
  pacienteNumeroAfiliado: string;
  domicilio: string;
  prestacion: string;
  /** 1-12 (design.md Decisión 4: período estructurado). */
  mesFacturado: number;
  anioFacturado: number;
  cantidadDias: number;
  dependenciaYRetorno: string;
  valorKm: number;
  cantidadKm: number;
  total: number;
  /** Valores de campos con `origen: 'valor-manual'`, indexados por el `id` del `PlantillaCampo`. */
  valoresManuales: Record<string, string>;
  /** WU2 de `facturacion-cambios-ui` (2026-08-16): nombres de las prestaciones del bloque
   * "Prestaciones:" (modalidad `general`), resueltos desde las líneas del presupuesto de la
   * autorización elegida — ver `prestacionesDescripcion.ts`. Vacío = no hay bloque. */
  prestaciones: string[];
}

function formatearMesYAnio(mes: number, anio: number): string {
  return `${String(mes).padStart(2, '0')}/${anio}`;
}

function resolverValor(origen: OrigenCampoPlantilla, campoId: string, datos: DatosDescripcionFactura): string {
  switch (origen) {
    case 'paciente.nombre':
      return datos.pacienteNombre;
    case 'paciente.dni':
      return datos.pacienteDni;
    case 'paciente.numeroAfiliado':
      return datos.pacienteNumeroAfiliado;
    case 'paciente.domicilio':
      return datos.domicilio;
    case 'traslado.prestacion':
      return datos.prestacion;
    case 'traslado.mesYAnio':
      return formatearMesYAnio(datos.mesFacturado, datos.anioFacturado);
    case 'traslado.cantidadDias':
      return String(datos.cantidadDias);
    case 'traslado.dependenciaYRetorno':
      return datos.dependenciaYRetorno;
    case 'traslado.valorKm':
      return String(datos.valorKm);
    case 'traslado.cantidadKm':
      return String(datos.cantidadKm);
    case 'traslado.total':
      return String(datos.total);
    case 'valor-manual':
      return datos.valoresManuales[campoId] ?? '';
    default: {
      const _exhaustive: never = origen;
      return _exhaustive;
    }
  }
}

export function renderDescripcionFactura(plantilla: PlantillaFactura, datos: DatosDescripcionFactura): string {
  const camposOrdenados = [...plantilla.campos].sort((a, b) => a.orden - b.orden);
  const lineas = camposOrdenados
    .map((campo) => `${campo.etiqueta}: ${resolverValor(campo.origen, campo.id, datos)}`)
    .join('\n');

  // WU2 (decisión usuaria 2026-08-16, opción a): el bloque "Prestaciones:" NO es un campo de
  // plantilla (no existe `OrigenCampoPlantilla` para él) — se agrega SIEMPRE al final de la
  // descripción cuando hay prestaciones resueltas, después de los campos de la plantilla.
  if (datos.prestaciones.length === 0) return lineas;
  const bloquePrestaciones = `Prestaciones: ${datos.prestaciones.join(', ')}`;
  return lineas === '' ? bloquePrestaciones : `${lineas}\n${bloquePrestaciones}`;
}
