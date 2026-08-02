import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Cobro, Factura } from '../../shared/types/factura';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { FacturaImprimible } from './FacturaImprimible';

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

const obraSocial: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: 'numero-documento',
  checklist: [],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

const factura: Factura = {
  id: 'factura-1',
  pacienteId: 'paciente-martina',
  descripcion: 'Paciente: Gómez, Martina\nPrestación: Kinesiología',
  dias: 20,
  valorKm: 300,
  monto: 60_000,
  estado: 'cobrado',
  fechaInicial: '2026-08-01',
  fechaTope: '2026-08-31',
  tipoComprobante: 'A',
  cantidadKm: 45,
  fechaFactura: '2026-08-05',
  fechaEstimadaCobro: '2026-11-03',
  prestacion: 'Kinesiología',
  mesFacturado: 8,
  anioFacturado: 2026,
  dependenciaYRetorno: 'Escuela / domicilio',
  domicilioId: 'dir-1',
  asistencias: [
    { id: 'a1', fecha: '2026-08-05', prestacion: 'Kinesiología', dependencia: 'Escuela', retorno: 'Domicilio', facturaSabados: false },
  ],
};

const cobros: Cobro[] = [{ id: 'c1', facturaId: 'factura-1', fecha: '2026-08-20', montoPagado: 60_000 }];

describe('FacturaImprimible', () => {
  it('imprime la descripción persistida (congelada), no una recalculada', () => {
    render(<FacturaImprimible factura={factura} asistencias={factura.asistencias} paciente={paciente} obraSocial={obraSocial} cobros={[]} />);
    expect(screen.getByText(/prestación: kinesiología/i)).toBeInTheDocument();
  });

  it('muestra los datos económicos y el detalle de asistencias', () => {
    render(<FacturaImprimible factura={factura} asistencias={factura.asistencias} paciente={paciente} obraSocial={obraSocial} cobros={[]} />);
    expect(screen.getByText(/45/)).toBeInTheDocument(); // cantidadKm
    expect(screen.getByText('Kinesiología')).toBeInTheDocument();
  });

  it('cuando existen cobros, muestra el detalle de cobros y el saldo', () => {
    render(<FacturaImprimible factura={factura} asistencias={factura.asistencias} paciente={paciente} obraSocial={obraSocial} cobros={cobros} />);
    expect(screen.getByText(/saldo/i)).toBeInTheDocument();
    expect(screen.getByText('2026-08-20')).toBeInTheDocument();
  });

  it('sin cobros, no muestra la sección de cobros', () => {
    render(<FacturaImprimible factura={factura} asistencias={factura.asistencias} paciente={paciente} obraSocial={obraSocial} cobros={[]} />);
    expect(screen.queryByText(/cobros registrados/i)).not.toBeInTheDocument();
  });
});

// Lectura preservada (gateo-facturacion, tasks.md 6.1/6.2, design.md D4). `FacturaImprimible` es
// puramente presentacional (recibe todo por props, sin `usePuedeEscribir`) — bloquear la vista
// imprimible a una cuenta de solo `read` sería una regresión muy visible (design.md riesgos). Se
// verifica que el gateo de escritura del módulo NUNCA llega a este componente.
describe('FacturaImprimible — lectura preservada en modo solo lectura', () => {
  it('con solo `read` sobre facturacion: se renderiza completa y utilizable', () => {
    render(
      <PuedeEscribirContext.Provider value={false}>
        <FacturaImprimible factura={factura} asistencias={factura.asistencias} paciente={paciente} obraSocial={obraSocial} cobros={cobros} />
      </PuedeEscribirContext.Provider>,
    );

    expect(screen.getByText(/prestación: kinesiología/i)).toBeInTheDocument();
    expect(screen.getByText(/saldo/i)).toBeInTheDocument();
    expect(screen.getByText('2026-08-20')).toBeInTheDocument();
  });

  it('con `write`: se renderiza igual (triangulación) — el gateo de escritura nunca llega acá', () => {
    render(
      <PuedeEscribirContext.Provider value={true}>
        <FacturaImprimible factura={factura} asistencias={factura.asistencias} paciente={paciente} obraSocial={obraSocial} cobros={cobros} />
      </PuedeEscribirContext.Provider>,
    );

    expect(screen.getByText(/prestación: kinesiología/i)).toBeInTheDocument();
  });
});
