import { describe, expect, it } from 'vitest';
import type { Paciente } from '../../types/paciente';
import type { Direccion } from '../../types/paciente';
import { construirDatosDescripcion } from './construirDatosDescripcion';

const domicilio: Direccion = { id: 'dir-1', tipo: 'domicilio', calle: 'Rivadavia 4500', localidad: 'CABA' };

const paciente: Paciente = {
  id: 'paciente-martina',
  apellido: 'Gómez',
  nombre: 'Martina',
  fechaNacimiento: '2015-03-12',
  dni: '45123456',
  cuilTitular: '27-30111222-4',
  diagnostico: 'Parálisis cerebral',
  accesorioMovilidad: [],
  obraSocialId: 'osecac',
  numeroAfiliado: { valor: '45123456' },
  cud: null,
  direcciones: [domicilio],
  personasACargo: [],
  amparoJudicial: false,
};

describe('construirDatosDescripcion', () => {
  it('mapea el paciente y los campos de la factura al shape que espera renderDescripcionFactura', () => {
    const resultado = construirDatosDescripcion(
      {
        prestacion: 'Kinesiología',
        mesFacturado: 8,
        anioFacturado: 2026,
        dias: 20,
        dependenciaYRetorno: 'Escuela / domicilio',
        valorKm: 300,
        cantidadKm: 45,
        monto: 13_500,
        domicilioId: 'dir-1',
      },
      paciente,
    );

    expect(resultado).toEqual({
      pacienteNombre: 'Gómez, Martina',
      pacienteDni: '45123456',
      pacienteNumeroAfiliado: '45123456',
      domicilio: 'Rivadavia 4500, CABA',
      prestacion: 'Kinesiología',
      mesFacturado: 8,
      anioFacturado: 2026,
      cantidadDias: 20,
      dependenciaYRetorno: 'Escuela / domicilio',
      valorKm: 300,
      cantidadKm: 45,
      total: 13_500,
      valoresManuales: {},
    });
  });

  it('cuando el domicilioId no coincide con ninguna dirección, el domicilio queda vacío (no rompe)', () => {
    const resultado = construirDatosDescripcion(
      {
        prestacion: '',
        mesFacturado: 1,
        anioFacturado: 2026,
        dias: 0,
        dependenciaYRetorno: '',
        valorKm: 0,
        cantidadKm: 0,
        monto: 0,
        domicilioId: 'no-existe',
      },
      paciente,
    );

    expect(resultado.domicilio).toBe('');
  });
});
