import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Prestador } from '../../shared/types/prestador';
import type { PrestadorRepository } from '../../shared/lib/prestadores/PrestadorRepository';
import { PrestadorRepositoryProvider } from '../prestadores/PrestadorRepositoryContext';
import { PrestadorSelector } from './PrestadorSelector';

// tasks.md 3.2 (change `factura-por-prestador`): a diferencia de `PrestadoresDeObraSocial.tsx`
// (sin test dedicado, ver ese archivo), este componente sí lo tiene porque su callback `onChange`
// es el punto donde `FacturaForm.tsx` decide fijar `tipoComprobante` (design.md D3) — vale la pena
// cubrir el contrato de datos que entrega. Nota de alcance: este componente NO decide si se
// monta o no según `modalidadFacturacion` (design.md D2, eso lo decide `FacturaFormDatosBasicos`,
// ya cubierto en `FacturaForm.test.tsx` — "FacturaForm — selección de Prestador"); acá solo se
// prueba su propio contrato: fetch, poblado del `<select>`, `EmptyState` y el shape de `onChange`.

const prestadorA: Prestador = {
  id: 'prestador-a',
  razonSocial: 'Traslados Andrea Pastor',
  cuit: '30-71234567-8',
  plazoCobroDias: 90,
  tipoComprobante: 'B',
};

const prestadorB: Prestador = {
  id: 'prestador-b',
  razonSocial: 'Otro Prestador SA',
  cuit: '30-99999999-9',
  plazoCobroDias: 30,
  tipoComprobante: 'A',
};

function fakeRepository(overrides: Partial<PrestadorRepository> = {}): PrestadorRepository {
  return {
    list: () => Promise.resolve([]),
    getById: () => Promise.resolve(null),
    create: () => Promise.reject(new Error('no implementado en este test')),
    update: () => Promise.reject(new Error('no implementado en este test')),
    listarPorObraSocial: () => Promise.resolve([prestadorA, prestadorB]),
    ...overrides,
  };
}

function renderSelector(onChange = vi.fn(), repository: PrestadorRepository = fakeRepository()) {
  render(
    <PrestadorRepositoryProvider repository={repository}>
      <PrestadorSelector formId="f" obraSocialId="osecac" prestadorId="" onChange={onChange} />
    </PrestadorRepositoryProvider>,
  );
  return { onChange };
}

describe('PrestadorSelector', () => {
  it('lista los prestadores de la obra social resueltos vía listarPorObraSocial(obraSocialId)', async () => {
    const listarPorObraSocial = vi.fn().mockResolvedValue([prestadorA, prestadorB]);
    render(
      <PrestadorRepositoryProvider repository={fakeRepository({ listarPorObraSocial })}>
        <PrestadorSelector formId="f" obraSocialId="osecac" prestadorId="" onChange={vi.fn()} />
      </PrestadorRepositoryProvider>,
    );

    expect(await screen.findByRole('option', { name: /traslados andrea pastor/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /otro prestador sa/i })).toBeInTheDocument();
    expect(listarPorObraSocial).toHaveBeenCalledWith('osecac');
  });

  it('muestra EmptyState si la obra social no tiene ningún prestador vinculado', async () => {
    renderSelector(vi.fn(), fakeRepository({ listarPorObraSocial: () => Promise.resolve([]) }));

    expect(await screen.findByText(/ningún prestador vinculado/i)).toBeInTheDocument();
  });

  it('al elegir un prestador, entrega el Prestador completo (no solo el id) a onChange', async () => {
    const { onChange } = renderSelector();

    const select = await screen.findByLabelText(/^prestador$/i);
    await userEvent.selectOptions(select, 'prestador-a');

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(prestadorA));
  });

  it('al volver a "Seleccionar…", entrega undefined a onChange', async () => {
    const onChange = vi.fn();
    render(
      <PrestadorRepositoryProvider repository={fakeRepository()}>
        <PrestadorSelector formId="f" obraSocialId="osecac" prestadorId="prestador-a" onChange={onChange} />
      </PrestadorRepositoryProvider>,
    );

    const select = await screen.findByLabelText(/^prestador$/i);
    await userEvent.selectOptions(select, '');

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(undefined));
  });
});
