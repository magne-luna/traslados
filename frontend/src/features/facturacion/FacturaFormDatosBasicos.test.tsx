import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { Paciente } from '../../shared/types/paciente';
import type { FacturaFormValues } from './FacturaForm';
import { FacturaFormDatosBasicos } from './FacturaFormDatosBasicos';

// Fix directo (sin change SDD, ver historial del repo): el selector de "Domicilio" debe listar
// solo las direcciones del paciente con `tipo === 'domicilio'` — antes mostraba TODAS las
// direcciones (escuela, terapia, cet, etc.), lo cual no tiene sentido para un campo que arma el
// domicilio del traslado.
function paciente(): Paciente {
  return {
    id: 'paciente-1',
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
    direcciones: [
      { id: 'dir-domicilio', tipo: 'domicilio', calle: 'Rivadavia 4500', localidad: 'CABA' },
      { id: 'dir-escuela', tipo: 'escuela', calle: 'Escuela 123', localidad: 'CABA' },
      { id: 'dir-otro', tipo: 'otro', calle: 'Otra dirección 456', localidad: 'CABA' },
    ],
    personasACargo: [],
    amparoJudicial: false,
  };
}

function valores(): FacturaFormValues {
  return {
    pacienteId: 'paciente-1',
    descripcion: '',
    dias: 0,
    valorKm: 0,
    monto: 0,
    fechaInicial: '2026-08-01',
    fechaTope: '2026-08-31',
    tipoComprobante: 'A',
    cantidadKm: 0,
    prestacion: '',
    mesFacturado: 8,
    anioFacturado: 2026,
    dependenciaYRetorno: '',
    domicilioId: '',
    asistencias: [],
  };
}

describe('FacturaFormDatosBasicos — selector de domicilio', () => {
  it('solo lista direcciones de tipo domicilio, no escuela/terapia/otro', () => {
    render(
      <FacturaFormDatosBasicos formId="f" values={valores()} errors={{}} paciente={paciente()} set={vi.fn()} />,
    );

    const select = screen.getByLabelText(/^domicilio$/i);
    const opciones = within(select).getAllByRole('option').map((o) => o.textContent);

    expect(opciones).toContain('Rivadavia 4500, CABA');
    expect(opciones).not.toContain('Escuela 123, CABA');
    expect(opciones).not.toContain('Otra dirección 456, CABA');
  });

  it('deja el selector sin opciones (además de la vacía) si el paciente no tiene direcciones de tipo domicilio', () => {
    const sinDomicilio: Paciente = { ...paciente(), direcciones: [{ id: 'dir-escuela', tipo: 'escuela', calle: 'Escuela 123', localidad: 'CABA' }] };
    render(
      <FacturaFormDatosBasicos formId="f" values={valores()} errors={{}} paciente={sinDomicilio} set={vi.fn()} />,
    );

    const select = screen.getByLabelText(/^domicilio$/i);
    const opciones = within(select).getAllByRole('option');
    expect(opciones).toHaveLength(1);
    expect(opciones[0]?.textContent).toMatch(/seleccionar domicilio/i);
  });
});
