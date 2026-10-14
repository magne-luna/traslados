import { describe, expect, it } from 'vitest';
import type { Paciente } from '../../shared/types/paciente';
import { calcularEdad, pacientesACsv } from './exportarPacientesCsv';

const base: Paciente = {
  id: 'p-1',
  apellido: 'Acuña Pastor',
  nombre: 'Mauricio',
  fechaNacimiento: '2009-03-12',
  dni: '49678621',
  cuilTitular: '',
  diagnostico: '',
  accesorioMovilidad: [],
  obraSocialId: 'os-1',
  numeroAfiliado: { valor: '' },
  cud: { numero: 'C-1', fechaEmision: '2023-01-01', fechaVencimiento: '2027-01-31' },
  direcciones: [],
  personasACargo: [],
  amparoJudicial: true,
};

const nombreObraSocial = (id: string | null) => (id === 'os-1' ? 'OSECAC' : 'Sin obra social');
const AHORA = new Date('2026-10-14T12:00:00');

// Pedido de Andrea (2026-08-04): exportar el listado con nombre, obra social, DNI, vencimiento del
// CUD, edad y amparo. CSV con `;` (lo que espera Excel en es-AR) y BOM para que respete las tildes.
describe('pacientesACsv', () => {
  it('arma encabezado + una fila por paciente con los campos pedidos', () => {
    const csv = pacientesACsv([base], nombreObraSocial, AHORA);

    expect(csv).toBe(
      '﻿Apellido y nombre;Obra social;DNI;Vencimiento CUD;Edad;Amparo\r\n' +
        'Acuña Pastor, Mauricio;OSECAC;49678621;31/01/2027;17;Sí\r\n',
    );
  });

  it('sin CUD deja el vencimiento vacío y sin amparo dice No', () => {
    const csv = pacientesACsv([{ ...base, cud: null, amparoJudicial: false }], nombreObraSocial, AHORA);

    expect(csv.split('\r\n')[1]).toBe('Acuña Pastor, Mauricio;OSECAC;49678621;;17;No');
  });

  it('escapa un valor con ; o comillas', () => {
    const csv = pacientesACsv([{ ...base, apellido: 'Pérez; "Pepe"' }], nombreObraSocial, AHORA);

    expect(csv.split('\r\n')[1]?.startsWith('"Pérez; ""Pepe"", Mauricio";')).toBe(true);
  });
});

describe('calcularEdad', () => {
  it('resta un año si todavía no cumplió', () => {
    expect(calcularEdad('2009-10-15', AHORA)).toBe(16);
    expect(calcularEdad('2009-10-14', AHORA)).toBe(17);
  });
});
