import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { Paciente } from '../../shared/types/paciente';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import { PacienteRepositoryProvider } from './PacienteRepositoryContext';
import { PacientesPage } from './PacientesPage';

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

const martina: Paciente = {
  id: 'paciente-martina',
  apellido: 'Gómez',
  nombre: 'Martina',
  fechaNacimiento: '2015-03-12',
  dni: '45123456',
  cuilTitular: '27-30111222-4',
  diagnostico: 'Parálisis cerebral',
  accesorioMovilidad: [],
  obraSocialId: 'osecac',
  numeroAfiliado: { formato: 'numero-documento', valor: '45123456' },
  cud: null,
  direcciones: [],
  personasACargo: [],
  amparoJudicial: false,
};

function buildFakePacienteRepository(): PacienteRepository {
  return {
    list: vi.fn().mockResolvedValue([martina]),
    getById: vi.fn().mockResolvedValue(martina),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(martina),
  };
}

function buildFakeObraSocialRepository(): ObraSocialRepository {
  return {
    list: vi.fn().mockResolvedValue([osecac]),
    getById: vi.fn().mockResolvedValue(osecac),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function buildFakeDocumentoRepository(): DocumentoRepository {
  return {
    listByEntity: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    remove: vi.fn(),
  };
}

function renderPage(pacienteRepository: PacienteRepository) {
  return render(
    <PacienteRepositoryProvider repository={pacienteRepository}>
      <PacientesPage obraSocialRepository={buildFakeObraSocialRepository()} documentoRepository={buildFakeDocumentoRepository()} />
    </PacienteRepositoryProvider>,
  );
}

describe('PacientesPage', () => {
  it('carga y muestra el listado usando el repository inyectado por context, con el nombre de la obra social resuelto', async () => {
    renderPage(buildFakePacienteRepository());

    expect(await screen.findByText(/gómez, martina/i)).toBeInTheDocument();
    expect(await screen.findByText('OSECAC')).toBeInTheDocument();
  });

  it('navega al detalle de alta al hacer click en "Nuevo paciente"', async () => {
    const user = userEvent.setup();
    renderPage(buildFakePacienteRepository());

    await screen.findByText(/gómez, martina/i);
    await user.click(screen.getByRole('button', { name: /nuevo paciente/i }));

    expect(screen.getByText('Nuevo paciente')).toBeInTheDocument();
  });

  it('navega al detalle de edición precargado al hacer click en "Editar"', async () => {
    const user = userEvent.setup();
    renderPage(buildFakePacienteRepository());

    await screen.findByText(/gómez, martina/i);
    await user.click(screen.getByRole('button', { name: /editar gómez, martina/i }));
    await user.click(screen.getByRole('button', { name: /editar datos/i }));

    const dniInputs = screen.getAllByLabelText(/^dni$/i) as HTMLInputElement[];
    expect(dniInputs.some((input) => input.value === '45123456')).toBe(true);
  });
});
