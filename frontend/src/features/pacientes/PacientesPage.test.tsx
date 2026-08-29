import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderConQuery } from '../../shared/test/queryWrapper';
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
import { CatalogoAccesoriosRepositoryProvider } from './CatalogoAccesoriosRepositoryContext';
import { mockCatalogoAccesoriosRepository } from '../../shared/lib/mocks/mockCatalogoAccesoriosRepository';
import { PacientesPage } from './PacientesPage';

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: 'numero-documento',
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
    listPage: vi.fn().mockResolvedValue({ items: [martina], total: 1, pagina: 1, tamanio: 20 }),
    getById: vi.fn().mockResolvedValue(martina),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(martina),
  };
}

function buildFakeObraSocialRepository(): ObraSocialRepository {
  return {
    list: vi.fn().mockResolvedValue([osecac]),
    listPage: vi.fn(),
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
    resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
    transferirAgrupacion: vi.fn(),
  };
}

// El detalle compone <PacienteForm>/<VehiculoForm>, que a su vez montan
// <AccesoriosMovilidadSelector> — ese selector consume el repository del catálogo por context y
// LANZA si no está provisto. Los tests a nivel de formulario ya lo envolvían
// (PacienteForm.test.tsx, VehiculoForm.test.tsx, VehiculoDetail.test.tsx); estos, que llegan al
// mismo formulario desde la página, se quedaron sin el provider al incorporarse el selector.
// `renderConSesion` (design.md D11) en vez de `render` pelado: <AccesoriosMovilidadSelector>, que
// entra por el formulario del detalle, resuelve `usePermiso('pacientes','write')` vía useAuth y
// lanza sin <AuthProvider>. El default de renderConSesion es "admin con todos los permisos" — el
// mismo supuesto implícito que ya tenían estos tests antes de que existiera el selector.
function renderPage(pacienteRepository: PacienteRepository) {
  return renderConSesion(
    <CatalogoAccesoriosRepositoryProvider repository={mockCatalogoAccesoriosRepository}>
      <PacienteRepositoryProvider repository={pacienteRepository}>
        <PacientesPage obraSocialRepository={buildFakeObraSocialRepository()} documentoRepository={buildFakeDocumentoRepository()} />
      </PacienteRepositoryProvider>
    </CatalogoAccesoriosRepositoryProvider>,
  );
}

function renderPageConPermiso(puedeEscribir: boolean, pacienteRepository: PacienteRepository) {
  return renderConSesion(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
      <CatalogoAccesoriosRepositoryProvider repository={mockCatalogoAccesoriosRepository}>
        <PacienteRepositoryProvider repository={pacienteRepository}>
          <PacientesPage obraSocialRepository={buildFakeObraSocialRepository()} documentoRepository={buildFakeDocumentoRepository()} />
        </PacienteRepositoryProvider>
      </CatalogoAccesoriosRepositoryProvider>
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

// paginacion-listados, Fase 3 (tasks.md 17.4): PacientesList resuelve el nombre de la obra
// social de cada paciente vía `nombreObraSocial(obraSocialId)`, poblado desde
// `ObraSocialRepository.list()` (useObrasSociales). Si eso se paginara, los pacientes cuya obra
// social cayó fuera de la página mostrarían "Sin obra social" — dato incorrecto sin ningún error
// visible (mismo modo de falla que 14.1/14.2 de la Fase 2).
describe('PacientesPage — no-regresión: obra social sigue usando list() completo (17.4)', () => {
  it('llama a obraSocialRepository.list(), nunca a listPage()', async () => {
    const obraSocialRepository = buildFakeObraSocialRepository();

    renderConQuery(
      <PacienteRepositoryProvider repository={buildFakePacienteRepository()}>
        <PacientesPage obraSocialRepository={obraSocialRepository} documentoRepository={buildFakeDocumentoRepository()} />
      </PacienteRepositoryProvider>,
    );

    await screen.findByText('OSECAC');

    expect(obraSocialRepository.list).toHaveBeenCalled();
    expect(obraSocialRepository.listPage).not.toHaveBeenCalled();
  });
});

// paginacion-listados, Fase 2 (tasks.md 13.2/13.7): PacientesPage cablea `usePacientesPaginado`
// (listPage) en vez de `usePacientes` (list()) para el listado. La navegación al detalle carga el
// objeto `Paciente` completo que ya trae el evento (`onSelect`/`onCreated`), NUNCA lo busca con
// `.find()` sobre `pacientes` — esa lista es ahora solo la página actual, no el padrón completo.
describe('PacientesPage — paginación server-side (13.x)', () => {
  it('13.2 usa listPage (no list) para poblar el listado', async () => {
    const repository = buildFakePacienteRepository();
    renderPage(repository);

    await screen.findByText(/gómez, martina/i);

    expect(repository.listPage).toHaveBeenCalledWith({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });
  });

  it('13.1/13.2 monta el <Paginador> y navegar a la página siguiente vuelve a pedir listPage con esa página', async () => {
    const user = userEvent.setup();
    const repository = buildFakePacienteRepository();
    vi.mocked(repository.listPage).mockResolvedValue({ items: [martina], total: 45, pagina: 1, tamanio: 20 });

    renderPage(repository);

    await screen.findByText(/gómez, martina/i);
    expect(screen.getByText(/página 1 de 3/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /página siguiente/i }));

    await vi.waitFor(() =>
      expect(repository.listPage).toHaveBeenCalledWith({ pagina: 2, tamanio: 20, filtros: { busqueda: '' } }),
    );
  });

  it('13.4/gotcha del detalle: seleccionar un paciente muestra su ficha completa sin depender de que siga en la página cargada', async () => {
    const user = userEvent.setup();
    const repository = buildFakePacienteRepository();
    renderPage(repository);

    await screen.findByText(/gómez, martina/i);
    // Tras el click, la página pudo haberse recargado con otro contenido (ej. otra búsqueda) — la
    // ficha igual debe mostrar los datos de Martina porque viajan en el propio evento de selección,
    // no se re-derivan buscando el id en `pacientes`.
    vi.mocked(repository.listPage).mockResolvedValue({ items: [], total: 0, pagina: 1, tamanio: 20 });

    await user.click(screen.getByText(/gómez, martina/i));

    expect(await screen.findByRole('button', { name: /editar datos/i })).toBeInTheDocument();
  });

  it('13.7 crear un paciente nuevo muestra su ficha aunque no esté en el listado paginado recién recargado', async () => {
    const user = userEvent.setup();
    const repository = buildFakePacienteRepository();
    const creado: Paciente = { ...martina, id: 'paciente-nuevo', apellido: 'Zzz-Nuevo', nombre: 'Recién Creado' };
    vi.mocked(repository.create).mockResolvedValue(creado);

    renderPage(repository);
    await screen.findByText(/gómez, martina/i);

    // Tras crear(), `listado.recargar()` vuelve a pedir la página vigente — que puede no incluir
    // al paciente recién creado (depende del orden alfabético). La ficha debe mostrarlo igual.
    vi.mocked(repository.listPage).mockResolvedValue({ items: [martina], total: 2, pagina: 1, tamanio: 20 });

    await user.click(screen.getByRole('button', { name: /nuevo paciente/i }));
    await user.type(screen.getByLabelText(/^apellido$/i), 'Zzz-Nuevo');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Recién Creado');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText(/zzz-nuevo, recién creado/i)).toBeInTheDocument();
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
