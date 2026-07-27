import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ObraSocial } from '../../shared/types/obraSocial';
import { ObrasSocialesList } from './ObrasSocialesList';

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  plazoCobroDias: 90,
  tipoComprobante: 'A',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  checklist: [],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

const osde: ObraSocial = {
  id: 'osde',
  nombre: 'OSDE',
  cuit: '30-50110100-3',
  plazoCobroDias: 60,
  tipoComprobante: 'B',
  modalidadFacturacion: 'general',
  admitePagosParciales: true,
  checklist: [
    { id: 'c1', nombre: 'Receta digital', requerido: true },
    { id: 'c2', nombre: 'Orden médica', requerido: true },
    { id: 'c3', nombre: 'Credencial', requerido: false },
    { id: 'c4', nombre: 'Carnet de afiliado', requerido: true },
    { id: 'c5', nombre: 'Historia clínica', requerido: false },
  ],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.dni' },
};

describe('ObrasSocialesList', () => {
  it('muestra un indicador de carga mientras loading es true', () => {
    render(<ObrasSocialesList obrasSociales={[]} loading error={null} onSelect={vi.fn()} onCreateNew={vi.fn()} />);

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('muestra un estado vacío con acción de crear cuando no hay obras sociales (triangulación con loading)', async () => {
    const user = userEvent.setup();
    const onCreateNew = vi.fn();

    render(
      <ObrasSocialesList obrasSociales={[]} loading={false} error={null} onSelect={vi.fn()} onCreateNew={onCreateNew} />,
    );

    expect(screen.getByText(/no hay obras sociales/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /crear/i }));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it('muestra un mensaje de error visible sin quedar en loading infinito', () => {
    render(
      <ObrasSocialesList obrasSociales={[]} loading={false} error="no se pudo conectar" onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );

    expect(screen.getByText(/no se pudo conectar/i)).toBeInTheDocument();
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
  });

  it('muestra cada fila con nombre, CUIT y tipo de comprobante, y dispara onSelect al hacer click', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <ObrasSocialesList obrasSociales={[osecac]} loading={false} error={null} onSelect={onSelect} onCreateNew={vi.fn()} />,
    );

    expect(screen.getByText('OSECAC')).toBeInTheDocument();
    expect(screen.getByText(/30-54155200-6/)).toBeInTheDocument();
    expect(screen.getByText(/comprobante a/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /editar osecac/i }));
    expect(onSelect).toHaveBeenCalledWith(osecac);
  });

  it('dispara onSelect al hacer click en cualquier parte de la fila, no solo en el botón Editar', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <ObrasSocialesList obrasSociales={[osecac]} loading={false} error={null} onSelect={onSelect} onCreateNew={vi.fn()} />,
    );

    await user.click(screen.getByText('OSECAC'));
    expect(onSelect).toHaveBeenCalledWith(osecac);
  });

  it('no duplica la llamada a onSelect cuando el click viene del botón Editar', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <ObrasSocialesList obrasSociales={[osecac]} loading={false} error={null} onSelect={onSelect} onCreateNew={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /editar osecac/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('muestra plazo de cobro, cantidad de documentos e identificador de factura en la tarjeta', () => {
    render(
      <ObrasSocialesList obrasSociales={[osecac]} loading={false} error={null} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );

    expect(screen.getByText('90 días')).toBeInTheDocument();
    expect(screen.getByText('Ninguno')).toBeInTheDocument();
    expect(screen.getByText('Nro. de afiliado')).toBeInTheDocument();
  });

  it('trunca el checklist a 3 ítems y muestra un contador de los restantes', () => {
    render(
      <ObrasSocialesList obrasSociales={[osde]} loading={false} error={null} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );

    expect(screen.getByText('Receta digital')).toBeInTheDocument();
    expect(screen.getByText('Orden médica')).toBeInTheDocument();
    expect(screen.getByText('Credencial')).toBeInTheDocument();
    expect(screen.queryByText('Carnet de afiliado')).not.toBeInTheDocument();
    expect(screen.getByText('+2 más')).toBeInTheDocument();
  });

  it('el buscador filtra las tarjetas por nombre', async () => {
    const user = userEvent.setup();

    render(
      <ObrasSocialesList
        obrasSociales={[osecac, osde]}
        loading={false}
        error={null}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByText('OSECAC')).toBeInTheDocument();
    expect(screen.getByText('OSDE')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /buscar obra social/i }), 'osde');

    expect(screen.queryByText('OSECAC')).not.toBeInTheDocument();
    expect(screen.getByText('OSDE')).toBeInTheDocument();
  });
});
