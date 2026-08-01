import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
