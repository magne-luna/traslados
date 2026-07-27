import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ObraSocial } from '../../shared/types/obraSocial';
import { ObraSocialDetail } from './ObraSocialDetail';

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  plazoCobroDias: 90,
  tipoComprobante: 'A',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  checklist: [{ id: 'i1', nombre: 'RHC', requerido: true }],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

describe('ObraSocialDetail — modo alta (obraSocial null)', () => {
  it('solo muestra el formulario general, sin editor de checklist ni de plantilla', () => {
    render(<ObraSocialDetail obraSocial={null} crear={vi.fn()} actualizar={vi.fn()} onCreated={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByLabelText(/^nombre$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/nuevo ítem/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/nueva etiqueta/i)).not.toBeInTheDocument();
  });

  it('al guardar, llama a crear() con checklist vacío y el identificadorOrigen default, y avisa onCreated', async () => {
    const user = userEvent.setup();
    const creada = { ...osecac, id: 'nueva-1', nombre: 'Swiss Medical', checklist: [] };
    const crear = vi.fn().mockResolvedValue(creada);
    const onCreated = vi.fn();

    render(<ObraSocialDetail obraSocial={null} crear={crear} actualizar={vi.fn()} onCreated={onCreated} onBack={vi.fn()} />);

    await user.type(screen.getByLabelText(/^nombre$/i), 'Swiss Medical');
    await user.type(screen.getByLabelText(/cuit/i), '30-11111111-1');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(crear).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Swiss Medical',
        cuit: '30-11111111-1',
        checklist: [],
        plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(creada);
  });
});

describe('ObraSocialDetail — modo edición', () => {
  it('por defecto muestra un resumen de solo lectura (sin form) junto con el checklist y la plantilla', () => {
    render(
      <ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={vi.fn()} onCreated={vi.fn()} onBack={vi.fn()} />,
    );

    expect(screen.getAllByText('OSECAC').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/^nombre$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar datos/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nuevo ítem/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nueva etiqueta/i)).toBeInTheDocument();
    expect(screen.getAllByText('RHC').length).toBeGreaterThan(0);
  });

  it('al apretar "Editar datos" muestra el form precargado', async () => {
    const user = userEvent.setup();

    render(
      <ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={vi.fn()} onCreated={vi.fn()} onBack={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /editar datos/i }));

    expect(screen.getByLabelText(/^nombre$/i)).toHaveValue('OSECAC');
  });

  it('al guardar los datos generales, llama a actualizar(id, valores) y vuelve al resumen', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(osecac);

    render(
      <ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={actualizar} onCreated={vi.fn()} onBack={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /editar datos/i }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(actualizar).toHaveBeenCalledWith(
      'osecac',
      expect.objectContaining({ nombre: 'OSECAC', cuit: '30-54155200-6' }),
    );
    expect(await screen.findByRole('button', { name: /editar datos/i })).toBeInTheDocument();
  });

  it('al editar el checklist, persiste el cambio vía actualizar(id, { checklist })', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(osecac);

    render(
      <ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={actualizar} onCreated={vi.fn()} onBack={vi.fn()} />,
    );

    await user.type(screen.getByLabelText(/nuevo ítem/i), 'FIM');
    await user.click(screen.getByRole('button', { name: /^agregar$/i }));

    expect(actualizar).toHaveBeenCalledWith('osecac', {
      checklist: [osecac.checklist[0], expect.objectContaining({ nombre: 'FIM' })],
    });
  });

  it('al editar la plantilla, persiste el cambio vía actualizar(id, { plantillaFactura })', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(osecac);

    render(
      <ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={actualizar} onCreated={vi.fn()} onBack={vi.fn()} />,
    );

    await user.selectOptions(screen.getByLabelText(/identificador en la factura/i), 'paciente.dni');

    expect(actualizar).toHaveBeenCalledWith('osecac', {
      plantillaFactura: { campos: [], identificadorOrigen: 'paciente.dni' },
    });
  });

  it('muestra el error del repository si crear/actualizar falla', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockRejectedValue(new Error('nombre duplicado'));

    render(
      <ObraSocialDetail obraSocial={osecac} crear={vi.fn()} actualizar={actualizar} onCreated={vi.fn()} onBack={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /editar datos/i }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('nombre duplicado')).toBeInTheDocument();
  });
});
