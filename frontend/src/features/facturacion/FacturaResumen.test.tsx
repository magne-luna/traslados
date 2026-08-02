import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Factura } from '../../shared/types/factura';
import type { Paciente } from '../../shared/types/paciente';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { FacturaResumen } from './FacturaResumen';

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
  direcciones: [],
  personasACargo: [],
  amparoJudicial: false,
};

const factura: Factura = {
  id: 'factura-1',
  pacienteId: 'paciente-martina',
  descripcion: '',
  dias: 10,
  valorKm: 300,
  monto: 3000,
  estado: 'a-facturar',
  fechaInicial: '2026-08-01',
  fechaTope: '2026-08-31',
  tipoComprobante: 'A',
  cantidadKm: 10,
  prestacion: 'Kinesiología',
  mesFacturado: 8,
  anioFacturado: 2026,
  dependenciaYRetorno: 'Escuela / domicilio',
  domicilioId: 'dir-1',
  asistencias: [],
};

// Lectura preservada (gateo-facturacion, tasks.md 6.1, design.md D4). `FacturaResumen` es
// puramente presentacional (recibe todo por props, sin `usePuedeEscribir`) — debe seguir
// renderizándose completo con nivel `read`.
describe('FacturaResumen — lectura preservada en modo solo lectura', () => {
  it('con solo `read`: se renderiza completo', () => {
    render(
      <PuedeEscribirContext.Provider value={false}>
        <FacturaResumen factura={factura} paciente={paciente} />
      </PuedeEscribirContext.Provider>,
    );

    expect(screen.getByText(/gómez, martina/i)).toBeInTheDocument();
    expect(screen.getByText('Kinesiología')).toBeInTheDocument();
  });

  it('con `write`: se renderiza igual (triangulación)', () => {
    render(
      <PuedeEscribirContext.Provider value={true}>
        <FacturaResumen factura={factura} paciente={paciente} />
      </PuedeEscribirContext.Provider>,
    );

    expect(screen.getByText(/gómez, martina/i)).toBeInTheDocument();
  });
});
