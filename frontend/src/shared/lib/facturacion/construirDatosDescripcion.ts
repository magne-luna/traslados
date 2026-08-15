import type { Paciente } from '../../types/paciente';
import type { DatosDescripcionFactura } from './renderDescripcionFactura';

// Función pura auxiliar: mapea los campos de la factura (formulario o ya persistida) + el
// paciente seleccionado al shape que espera `renderDescripcionFactura`. Extraída para no
// duplicar el mapeo entre la vista previa en vivo (FacturaForm, tasks.md 7.6) y la congelación
// real al emitir (FacturaDetail, tasks.md 9.1) — ambas deben construir los datos exactamente
// igual para que la vista previa nunca difiera del texto que termina persistido.
export interface CamposParaDescripcion {
  prestacion: string;
  mesFacturado: number;
  anioFacturado: number;
  dias: number;
  dependenciaYRetorno: string;
  valorKm: number;
  cantidadKm: number;
  monto: number;
  domicilioId: string;
  /** WU2 (2026-08-16): prestaciones ya resueltas a nombres por el caller (opción a — líneas del
   * presupuesto de la autorización elegida). Ausente = por-prestacion/legacy → sin bloque. */
  prestaciones?: string[];
}

export function construirDatosDescripcion(campos: CamposParaDescripcion, paciente: Paciente): DatosDescripcionFactura {
  const domicilio = paciente.direcciones.find((direccion) => direccion.id === campos.domicilioId);

  return {
    pacienteNombre: `${paciente.apellido}, ${paciente.nombre}`,
    pacienteDni: paciente.dni,
    pacienteNumeroAfiliado: paciente.numeroAfiliado.valor,
    domicilio: domicilio ? `${domicilio.calle}, ${domicilio.localidad}` : '',
    prestacion: campos.prestacion,
    mesFacturado: campos.mesFacturado,
    anioFacturado: campos.anioFacturado,
    cantidadDias: campos.dias,
    dependenciaYRetorno: campos.dependenciaYRetorno,
    valorKm: campos.valorKm,
    cantidadKm: campos.cantidadKm,
    total: campos.monto,
    valoresManuales: {},
    prestaciones: campos.prestaciones ?? [],
  };
}
