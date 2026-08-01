import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PrestadorRepository } from '../../shared/lib/prestadores/PrestadorRepository';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PrestadorRepositoryProvider } from '../prestadores/PrestadorRepositoryContext';
import { ObraSocialRepositoryProvider } from './ObraSocialRepositoryContext';
import { ObraSocialesPage } from './ObraSocialesPage';

// `ObraSocialDetail` monta `PrestadoresDeObraSocial` (design.md D2 de prestadores-crud, tasks.md
// 5.2) en modo edición, que exige un `PrestadorRepositoryProvider` en el árbol. Fake mínimo
// tipado (sin `any`/`as`) que resuelve sin vínculos — este archivo no testea el panel en sí.
const fakePrestadorRepository: PrestadorRepository = {
  list: () => Promise.resolve([]),
  getById: () => Promise.resolve(null),
  create: () => Promise.reject(new Error('no implementado en este test')),
  update: () => Promise.reject(new Error('no implementado en este test')),
  listarPorObraSocial: () => Promise.resolve([]),
};

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: 'numero-documento',
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
      <PrestadorRepositoryProvider repository={fakePrestadorRepository}>
        <ObraSocialesPage />
      </PrestadorRepositoryProvider>
    </ObraSocialRepositoryProvider>,
  );
}

function renderPageConPermiso(puedeEscribir: boolean, repository: ObraSocialRepository) {
  return render(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
      <ObraSocialRepositoryProvider repository={repository}>
        <PrestadorRepositoryProvider repository={fakePrestadorRepository}>
          <ObraSocialesPage />
        </PrestadorRepositoryProvider>
      </ObraSocialRepositoryProvider>
    </PuedeEscribirContext.Provider>,
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

// Gateo de escritura (gateo-obrasocial, tasks.md 4.8/4.9): aviso de modo solo lectura, en la
// vista de lista y en la de detalle, con una sola inserción en ObraSocialesPage.
describe('ObraSocialesPage — gateo de escritura', () => {
  it('sin permiso de escritura: muestra el aviso de modo solo lectura en el listado', async () => {
    renderPageConPermiso(false, buildFakeRepository());

    await screen.findByText('OSECAC');
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
  });

  it('sin permiso de escritura: muestra el aviso también en el detalle', async () => {
    const user = userEvent.setup();
    renderPageConPermiso(false, buildFakeRepository());

    await screen.findByText('OSECAC');
    // "Editar" queda deshabilitado por el gateo — se navega al detalle por la fila, no por el botón.
    await user.click(screen.getByText('OSECAC'));

    expect(await screen.findByLabelText(/nuevo ítem/i)).toBeInTheDocument();
    const notas = screen.getAllByRole('note').map((nota) => nota.textContent ?? '');
    expect(notas.some((texto) => /modo solo lectura/i.test(texto))).toBe(true);
  });

  it('con permiso de escritura: no muestra ningún aviso', async () => {
    renderPageConPermiso(true, buildFakeRepository());

    await screen.findByText('OSECAC');
    expect(screen.queryByText(/solo lectura/i)).not.toBeInTheDocument();
  });

  it('permiso de escritura sobre otro módulo no habilita este: con write en pacientes y solo read en obra_social, la pantalla queda en modo solo lectura', async () => {
    // El contexto ya resolvió esto contra el módulo de la ruta (usePuedeEscribir.test.tsx 2.1);
    // acá solo se confirma que ObraSocialesPage consume ese resultado sin volver a resolverlo
    // contra un módulo propio.
    renderPageConPermiso(false, buildFakeRepository());

    await screen.findByText('OSECAC');
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nueva obra social/i })).toBeDisabled();
  });
});
