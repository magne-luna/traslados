import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import { ObraSocialRepositoryProvider } from './ObraSocialRepositoryContext';
import { ObraSocialesPage } from './ObraSocialesPage';

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

function buildFakeRepository(): ObraSocialRepository {
  return {
    list: vi.fn().mockResolvedValue([osecac]),
    getById: vi.fn().mockResolvedValue(osecac),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(osecac),
  };
}

function renderPage(repository: ObraSocialRepository) {
  return render(
    <ObraSocialRepositoryProvider repository={repository}>
      <ObraSocialesPage />
    </ObraSocialRepositoryProvider>,
  );
}

describe('ObraSocialesPage', () => {
  it('carga y muestra el listado usando el repository inyectado por context', async () => {
    renderPage(buildFakeRepository());

    expect(await screen.findByText('OSECAC')).toBeInTheDocument();
  });

  it('navega al detalle de alta al hacer click en "Nueva obra social"', async () => {
    const user = userEvent.setup();
    renderPage(buildFakeRepository());

    await screen.findByText('OSECAC');
    await user.click(screen.getByRole('button', { name: /nueva obra social/i }));

    expect(screen.getByText('Nueva obra social')).toBeInTheDocument();
    expect(screen.queryByLabelText(/nuevo ítem/i)).not.toBeInTheDocument();
  });

  it('navega al detalle de edición precargado al hacer click en "Editar"', async () => {
    const user = userEvent.setup();
    renderPage(buildFakeRepository());

    await screen.findByText('OSECAC');
    await user.click(screen.getByRole('button', { name: /editar osecac/i }));
    expect(screen.getByLabelText(/nuevo ítem/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /editar datos/i }));

    expect(screen.getByLabelText(/^nombre$/i)).toHaveValue('OSECAC');
  });
});
