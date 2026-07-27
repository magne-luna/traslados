import type { IdentificadorAfiliado } from '../../types/paciente';
import type { IdentificadorFactura, IdentificadorOrigenFactura } from '../../types/factura';

// Función pura (tasks.md 3.2, design.md Decisión 3, IN-01): resuelve el identificador de la
// factura leyendo `obraSocial.plantillaFactura.identificadorOrigen` del paciente — no re-decide
// nada (esa pregunta abierta ya está resuelta estructuralmente en C-04, configurable por obra
// social). Sin ninguna constante local que fije DNI o número de afiliado como default.
export interface PacienteParaIdentificador {
  dni: string;
  numeroAfiliado: IdentificadorAfiliado;
}

export function resolverIdentificadorFactura(
  paciente: PacienteParaIdentificador,
  identificadorOrigen: IdentificadorOrigenFactura,
): IdentificadorFactura {
  if (identificadorOrigen === 'paciente.dni') {
    return { origen: 'paciente.dni', valor: paciente.dni };
  }
  return { origen: 'paciente.numeroAfiliado', valor: paciente.numeroAfiliado.valor };
}
