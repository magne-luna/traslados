import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PrestadorConVinculo } from '../../shared/lib/prestadores/prestadorMapping';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Prestador } from '../../shared/types/prestador';
import { PrestadorDetail } from './PrestadorDetail';

// Único smoke test de la feature (tasks.md 4.6, testing reducido a propósito — ver nota de
// cabecera de tasks.md): completa los campos requeridos y confirma que el alta se dispara. No se
// testean por separado todas las validaciones de campo (eso vive, sin test propio adicional, en
// validatePrestadorForm.ts) ni el resto de PrestadorForm/PrestadoresList/usePrestadores.

const traslados: Prestador = {
  id: 'p1',
  razonSocial: 'Traslados del Sur S.A.',
  cuit: '30-54155200-6',
  plazoCobroDias: 90,
  tipoComprobante: 'A',
};

describe('PrestadorDetail — alta de prestador (smoke test, tasks.md 4.6)', () => {
  it('al completar razón social y CUIT y guardar, llama a crear() y avisa onCreated', async () => {
    const user = userEvent.setup();
    const creado = { ...traslados, id: 'nuevo-1', razonSocial: 'Emergencias Norte' };
    const crear = vi.fn().mockResolvedValue(creado);
    const onCreated = vi.fn();

    render(<PrestadorDetail prestador={null} crear={crear} actualizar={vi.fn()} onCreated={onCreated} onBack={vi.fn()} />);

    await user.type(screen.getByLabelText(/razón social/i), 'Emergencias Norte');
    await user.type(screen.getByLabelText(/^cuit$/i), '30-11111111-1');
    await user.click(screen.getByRole('button', { name: /guardar prestador/i }));

    expect(crear).toHaveBeenCalledWith(
      expect.objectContaining({
        razonSocial: 'Emergencias Norte',
        cuit: '30-11111111-1',
        plazoCobroDias: 90,
        tipoComprobante: 'A',
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(creado);
  });
});

// Único smoke test del vínculo N:N (design.md D2, tasks.md 5.1/5.5 — testing reducido a
// propósito): confirma que en edición se precarga la ObraSocial ya vinculada, que tildar una
// segunda arma el conjunto completo, y que ese conjunto viaja como `obrasSocialesIds` dentro del
// mismo `actualizar()` que los campos planos — no se testea por separado ninguna otra rama
// (alta sin vínculo, orden de ids, etc.).
describe('PrestadorDetail — vínculo N:N con ObrasSociales (smoke test, tasks.md 5.1)', () => {
  const osde: ObraSocial = {
    id: 'os-osde',
    nombre: 'OSDE',
    cuit: '30-11111111-1',
    modalidadFacturacion: 'por-prestacion',
    admitePagosParciales: false,
    formatoAfiliado: 'numero-documento',
    checklist: [],
    plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
  };
  const swissMedical: ObraSocial = { ...osde, id: 'os-swiss', nombre: 'Swiss Medical' };

  it('precarga el vínculo existente y, al tildar una obra social más y guardar, manda el conjunto completo en obrasSocialesIds', async () => {
    const user = userEvent.setup();
    const prestadorConVinculo: PrestadorConVinculo = { ...traslados, obrasSocialesIds: ['os-osde'] };
    const actualizar = vi.fn().mockResolvedValue(traslados);

    render(
      <PrestadorDetail
        prestador={prestadorConVinculo}
        obrasSociales={[osde, swissMedical]}
        crear={vi.fn()}
        actualizar={actualizar}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar datos/i }));

    const checkOsde = screen.getByLabelText('OSDE');
    const checkSwiss = screen.getByLabelText('Swiss Medical');
    expect(checkOsde).toBeChecked();
    expect(checkSwiss).not.toBeChecked();

    await user.click(checkSwiss);
    await user.click(screen.getByRole('button', { name: /guardar prestador/i }));

    expect(actualizar).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ obrasSocialesIds: expect.arrayContaining(['os-osde', 'os-swiss']) }),
    );
  });
});
