import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { Paciente } from '../../shared/types/paciente';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import type { Usuario } from '../../shared/types/usuario';
import type { MapaPermisos } from '../../shared/types/usuario';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { RequireAuth } from '../../shared/auth/RequireAuth';
import { renderConSesion } from '../../shared/test/renderConSesion';
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
  formatoAfiliado: 'documento',
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
  numeroAfiliado: { valor: '45123456' },
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

function renderPageConPermiso(puedeEscribir: boolean, pacienteRepository: PacienteRepository) {
  return render(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
      <PacienteRepositoryProvider repository={pacienteRepository}>
        <PacientesPage obraSocialRepository={buildFakeObraSocialRepository()} documentoRepository={buildFakeDocumentoRepository()} />
      </PacienteRepositoryProvider>
    </PuedeEscribirContext.Provider>,
  );
}

const EMPLEADO: Usuario = { id: 'u-empleado', nombre: 'Juan', apellido: 'Pérez', email: 'juan@x.com', rol: 'empleado' };

// Monta PacientesPage detrás del RequireAuth real, en la ruta /pacientes, para probar de punta a
// punta que el permiso se resuelve contra el módulo de la ruta activa (tasks.md 7.1) — no contra
// el mecanismo compartido stubeado (a diferencia del resto de este archivo). El mecanismo en sí
// (contexto, tienePermiso, short-circuit de admin) ya está probado en usePuedeEscribir.test.tsx;
// acá solo se confirma que PacientesPage no inventa una segunda resolución propia.
function renderRutaPacientesProtegida(permisos: MapaPermisos, pacienteRepository: PacienteRepository) {
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/pacientes',
            element: (
              <PacienteRepositoryProvider repository={pacienteRepository}>
                <PacientesPage
                  obraSocialRepository={buildFakeObraSocialRepository()}
                  documentoRepository={buildFakeDocumentoRepository()}
                />
              </PacienteRepositoryProvider>
            ),
          },
        ],
      },
      { path: '/login', element: <div>Login mock</div> },
    ],
    { initialEntries: ['/pacientes'] },
  );

  return renderConSesion(<RouterProvider router={router} />, { usuario: EMPLEADO, permisos });
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

// Gateo de escritura (gateo-pacientes, design.md D4, tasks.md 6.1/6.2): aviso de modo solo
// lectura, en la vista de lista y en la de ficha, con una sola inserción en PacientesPage —
// mismo patrón, mismo tono y mismo texto que fijó gateo-obrasocial en ObraSocialesPage
// (consistencia entre módulos, design.md D4).
describe('PacientesPage — gateo de escritura', () => {
  it('sin permiso de escritura: muestra el aviso de modo solo lectura en el listado', async () => {
    renderPageConPermiso(false, buildFakePacienteRepository());

    await screen.findByText(/gómez, martina/i);
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
  });

  it('sin permiso de escritura: muestra el aviso también en la ficha', async () => {
    const user = userEvent.setup();
    renderPageConPermiso(false, buildFakePacienteRepository());

    await screen.findByText(/gómez, martina/i);
    // "Editar" queda deshabilitado por el gateo — se navega a la ficha por la fila, no por el botón.
    await user.click(screen.getByText(/gómez, martina/i));

    expect(await screen.findByRole('button', { name: /editar datos/i })).toBeInTheDocument();
    const notas = screen.getAllByRole('note').map((nota) => nota.textContent ?? '');
    expect(notas.some((texto) => /modo solo lectura/i.test(texto))).toBe(true);
  });

  it('con permiso de escritura: no muestra ningún aviso', async () => {
    renderPageConPermiso(true, buildFakePacienteRepository());

    await screen.findByText(/gómez, martina/i);
    expect(screen.queryByText(/solo lectura/i)).not.toBeInTheDocument();
  });
});

// Rol admin sin filas de permisos (design.md D5): mismo criterio ya usado en
// ObraSocialesPage.test.tsx — el contexto ya resolvió el short-circuit de admin.
describe('PacientesPage — rol admin sin filas de permisos', () => {
  it('con puedeEscribir true (equivalente al short-circuit de admin sin filas): no muestra ningún aviso', async () => {
    renderPageConPermiso(true, buildFakePacienteRepository());

    await screen.findByText(/gómez, martina/i);
    expect(screen.queryByText(/solo lectura/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo paciente/i })).toBeEnabled();
  });
});

// Permiso de otro módulo no habilita este (spec: "Permiso sobre otro módulo no habilita este",
// tasks.md 7.1). De punta a punta contra RequireAuth real: el permiso se resuelve contra el
// módulo de la ruta activa (pacientes), nunca contra cualquier permiso de escritura que la
// cuenta tenga sobre otro módulo.
describe('PacientesPage — el permiso de otro módulo no habilita este', () => {
  it('con write en obra_social y solo read en pacientes: la pantalla de pacientes queda en modo solo lectura completo', async () => {
    renderRutaPacientesProtegida({ obra_social: 'write', pacientes: 'read' }, buildFakePacienteRepository());

    await screen.findByText(/gómez, martina/i);
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo paciente/i })).toBeDisabled();
  });

  it('triangulación: invirtiendo los permisos, pacientes queda escribible (aunque obra_social quede en solo lectura)', async () => {
    renderRutaPacientesProtegida({ pacientes: 'write', obra_social: 'read' }, buildFakePacienteRepository());

    await screen.findByText(/gómez, martina/i);
    expect(screen.queryByText(/solo lectura/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo paciente/i })).toBeEnabled();
  });
});
