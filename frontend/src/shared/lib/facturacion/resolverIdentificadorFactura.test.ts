import { describe, expect, it } from 'vitest';
import { resolverIdentificadorFactura, type PacienteParaIdentificador } from './resolverIdentificadorFactura';

const paciente: PacienteParaIdentificador = {
  dni: '45123456',
  numeroAfiliado: { valor: '45123456-A' },
};

describe('resolverIdentificadorFactura', () => {
  it('devuelve el DNI cuando la obra social configuró paciente.dni como origen', () => {
    const resultado = resolverIdentificadorFactura(paciente, 'paciente.dni');
    expect(resultado).toEqual({ origen: 'paciente.dni', valor: '45123456' });
  });

  it('devuelve el número de afiliado cuando la obra social configuró paciente.numeroAfiliado', () => {
    const resultado = resolverIdentificadorFactura(paciente, 'paciente.numeroAfiliado');
    expect(resultado).toEqual({ origen: 'paciente.numeroAfiliado', valor: '45123456-A' });
  });

  it('no fija ningún default propio: el mismo paciente cambia de valor solo según el origen recibido', () => {
    const otroPaciente: PacienteParaIdentificador = {
      dni: '99999999',
      numeroAfiliado: { valor: 'OS-ZZ000' },
    };

    const porDni = resolverIdentificadorFactura(otroPaciente, 'paciente.dni');
    const porAfiliado = resolverIdentificadorFactura(otroPaciente, 'paciente.numeroAfiliado');

    expect(porDni.valor).toBe('99999999');
    expect(porAfiliado.valor).toBe('OS-ZZ000');
    expect(porDni.valor).not.toBe(porAfiliado.valor);
  });
});
