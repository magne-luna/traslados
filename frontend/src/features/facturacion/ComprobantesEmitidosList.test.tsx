import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Factura } from '../../shared/types/factura';
import { ComprobantesEmitidosList } from './ComprobantesEmitidosList';

function factura(over: Partial<Factura> = {}): Factura {
  return {
    id: 'factura-1',
    pacienteId: 'paciente-martina',
    descripcion: '',
    dias: 10,
    valorKm: 300,
    monto: 130900,
    estado: 'facturado',
    fechaInicial: '2026-08-01',
    fechaTope: '2026-08-31',
    tipoComprobante: 'A',
    cantidadKm: 10,
    prestacion: 'Kinesiología',
    mesFacturado: 8,
    anioFacturado: 2026,
    dependenciaYRetorno: '',
    domicilioId: '',
    asistencias: [],
    cae: '75012345678901',
    caeVencimiento: '2026-09-10',
    cbteNro: 7,
    ptoVta: 1,
    arcaAmbiente: 'homologacion',
    comprobantePdfUrl: 'factura-1/FACTURA_A-1-7.pdf',
    fechaFactura: '2026-08-30',
    ...over,
  };
}

const nombrePaciente = (id: string) => (id === 'paciente-martina' ? 'Gómez, Martina' : 'Otro, Paciente');

function props(over: Partial<Parameters<typeof ComprobantesEmitidosList>[0]> = {}) {
  return {
    facturas: [factura()],
    nombrePaciente,
    onVerComprobante: vi.fn(),
    onSelect: vi.fn(),
    onVolver: vi.fn(),
    error: null as string | null,
    ...over,
  };
}

describe('ComprobantesEmitidosList', () => {
  it('lista solo las facturas con CAE, con su número de comprobante, CAE y período', () => {
    const emitida = factura({ id: 'f-emitida', cbteNro: 7, ptoVta: 1, tipoComprobante: 'A' });
    const sinEmitir = factura({
      id: 'f-borrador',
      estado: 'a-facturar',
      cae: undefined,
      cbteNro: undefined,
      ptoVta: undefined,
      comprobantePdfUrl: undefined,
    });

    render(<ComprobantesEmitidosList {...props({ facturas: [emitida, sinEmitir] })} />);

    // cabecera + 1 sola fila de datos (la factura sin CAE no se lista)
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText(/A 0001-00000007/)).toBeInTheDocument();
    expect(screen.getByText('75012345678901')).toBeInTheDocument();
    expect(screen.getByText('8/2026')).toBeInTheDocument();
    expect(screen.getByText('Gómez, Martina')).toBeInTheDocument();
  });

  it('sin ninguna factura emitida muestra un estado vacío y ninguna tabla', () => {
    const sinEmitir = factura({ estado: 'a-facturar', cae: undefined });
    render(<ComprobantesEmitidosList {...props({ facturas: [sinEmitir] })} />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/todavía no se emitió ningún comprobante/i)).toBeInTheDocument();
  });

  it('marca los comprobantes de homologación como prueba sin valor fiscal', () => {
    render(<ComprobantesEmitidosList {...props({ facturas: [factura({ arcaAmbiente: 'homologacion' })] })} />);
    expect(screen.getByText(/prueba — sin valor fiscal/i)).toBeInTheDocument();
  });

  it('no marca como prueba un comprobante de producción', () => {
    render(<ComprobantesEmitidosList {...props({ facturas: [factura({ arcaAmbiente: 'production' })] })} />);
    expect(screen.queryByText(/prueba — sin valor fiscal/i)).not.toBeInTheDocument();
  });

  it('ofrece "Ver PDF" solo cuando hay comprobantePdfUrl y delega en onVerComprobante', async () => {
    const conPdf = factura({ id: 'con-pdf', comprobantePdfUrl: 'con-pdf/x.pdf' });
    const sinPdf = factura({ id: 'sin-pdf', comprobantePdfUrl: undefined });
    const onVerComprobante = vi.fn();

    render(<ComprobantesEmitidosList {...props({ facturas: [conPdf, sinPdf], onVerComprobante })} />);

    const [boton, ...resto] = screen.getAllByRole('button', { name: /ver pdf/i });
    expect(resto).toHaveLength(0);
    if (!boton) throw new Error('Debería existir el botón "Ver PDF" de la fila con PDF');

    await userEvent.click(boton);
    expect(onVerComprobante).toHaveBeenCalledWith(conPdf);
  });

  it('muestra el error sin ocultar la tabla', () => {
    render(
      <ComprobantesEmitidosList
        {...props({ error: 'No se pudo abrir el comprobante. Verificá que tengas permiso de facturación.' })}
      />,
    );
    expect(screen.getByText(/no se pudo abrir el comprobante/i)).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('clic en la fila abre el detalle de esa factura', async () => {
    const onSelect = vi.fn();
    const f = factura({ id: 'f-click' });
    render(<ComprobantesEmitidosList {...props({ facturas: [f], onSelect })} />);

    await userEvent.click(screen.getByText('Gómez, Martina'));
    expect(onSelect).toHaveBeenCalledWith(f);
  });

  it('ordena por fecha de factura descendente', () => {
    const vieja = factura({ id: 'vieja', fechaFactura: '2026-06-01', cbteNro: 1 });
    const nueva = factura({ id: 'nueva', fechaFactura: '2026-08-30', cbteNro: 9 });
    render(<ComprobantesEmitidosList {...props({ facturas: [vieja, nueva] })} />);

    const numeros = screen.getAllByText(/0001-\d{8}/).map((el) => el.textContent);
    expect(numeros).toEqual(['A 0001-00000009', 'A 0001-00000001']);
  });

  it('el botón de volver invoca onVolver', async () => {
    const onVolver = vi.fn();
    render(<ComprobantesEmitidosList {...props({ onVolver })} />);
    await userEvent.click(screen.getByRole('button', { name: /volver al listado/i }));
    expect(onVolver).toHaveBeenCalledTimes(1);
  });
});
