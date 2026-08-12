import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Paciente } from '../../shared/types/paciente';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PacientesList } from './PacientesList';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

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

const nombreObraSocial = (id: string | null) => (id === 'osecac' ? 'OSECAC' : 'Sin obra social');

// paginacion-listados, Fase 2 (tasks.md 13.x): `PacientesList` deja de tener estado propio de
// filtrado (13.8, presentacional puro) — `busqueda`/`pagina`/`total`/`tamanio` llegan por props
// desde `usePacientesPaginado` (vía PacientesPage), y `pacientes` es SOLO la página actual, no el
// padrón completo. Este helper deja explícito qué representa cada combinación en los tests.
function defaultProps(overrides: Partial<React.ComponentProps<typeof PacientesList>> = {}): React.ComponentProps<
  typeof PacientesList
> {
  return {
    pacientes: [],
    loading: false,
    error: null,
    nombreObraSocial,
    onSelect: vi.fn(),
    onCreateNew: vi.fn(),
    busqueda: '',
    onBusquedaChange: vi.fn(),
    pagina: 1,
    tamanio: 20,
    total: 0,
    onCambiarPagina: vi.fn(),
    ...overrides,
  };
}

describe('PacientesList', () => {
  it('muestra un indicador de carga mientras loading es true (13.5)', () => {
    render(<PacientesList {...defaultProps({ loading: true })} />);

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('estado 1/3 — sin pacientes cargados: total 0 y sin búsqueda muestra el estado vacío con acción de crear (13.5)', async () => {
    const user = userEvent.setup();
    const onCreateNew = vi.fn();

    render(<PacientesList {...defaultProps({ total: 0, busqueda: '', onCreateNew })} />);

    expect(screen.getByText(/no hay pacientes/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /crear/i }));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it('estado 2/3 — búsqueda sin coincidencias: total 0 CON búsqueda muestra un mensaje distinto del vacío inicial (13.5)', () => {
    render(<PacientesList {...defaultProps({ total: 0, busqueda: 'zzz-inexistente', pacientes: [] })} />);

    expect(screen.getByText(/ningún paciente coincide con "zzz-inexistente"/i)).toBeInTheDocument();
    expect(screen.queryByText(/no hay pacientes cargados/i)).not.toBeInTheDocument();
  });

  it('muestra un mensaje de error visible sin quedar en loading infinito', () => {
    render(<PacientesList {...defaultProps({ error: 'no se pudo conectar' })} />);

    expect(screen.getByText(/no se pudo conectar/i)).toBeInTheDocument();
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
  });

  it('muestra cada fila con apellido y nombre, DNI y la obra social asignada', () => {
    render(<PacientesList {...defaultProps({ pacientes: [martina], total: 1 })} />);

    expect(screen.getByText(/gómez, martina/i)).toBeInTheDocument();
    expect(screen.getAllByText('45123456').length).toBeGreaterThan(0);
    expect(screen.getByText('OSECAC')).toBeInTheDocument();
  });

  it('dispara onSelect al hacer click en cualquier parte de la fila', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<PacientesList {...defaultProps({ pacientes: [martina], total: 1, onSelect })} />);

    await user.click(screen.getByText(/gómez, martina/i));
    expect(onSelect).toHaveBeenCalledWith(martina);
  });

  it('el botón Editar abre el detalle sin togglear/duplicar por la propagación del click de la fila', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<PacientesList {...defaultProps({ pacientes: [martina], total: 1, onSelect })} />);

    await user.click(screen.getByRole('button', { name: /editar gómez, martina/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(martina);
  });

  // 13.3: el SearchInput ya no filtra en memoria — alimenta el término del hook vía prop.
  describe('PacientesList — búsqueda alimenta el hook, no filtra en memoria (13.3)', () => {
    it('escribir en el buscador llama a onBusquedaChange con el valor crudo (no filtra "pacientes" localmente)', async () => {
      const user = userEvent.setup();
      const onBusquedaChange = vi.fn();

      render(<PacientesList {...defaultProps({ pacientes: [martina], total: 1, busqueda: '', onBusquedaChange })} />);

      await user.type(screen.getByLabelText(/buscar paciente/i), 'x');
      expect(onBusquedaChange).toHaveBeenCalled();
    });

    it('el valor del input refleja la prop busqueda (controlado desde afuera, no estado propio)', () => {
      render(<PacientesList {...defaultProps({ pacientes: [martina], total: 1, busqueda: 'martina' })} />);

      expect(screen.getByLabelText(/buscar paciente/i)).toHaveValue('martina');
    });

    it('13.4: un paciente encontrado por búsqueda que NO está en `pacientes` de la primera carga se ve igual — la lista SOLO refleja lo que venga por props', () => {
      // La prueba de que la mudanza a server-side funcionó ya no es responsabilidad de este
      // componente presentacional (no tiene acceso al padrón completo para filtrar) — la cubre
      // usePacientesPaginado/SupabasePacienteRepository.listPage. Acá solo se confirma que
      // `PacientesList` no vuelve a filtrar por su cuenta lo que ya le llegó filtrado.
      const otroPaciente: Paciente = { ...martina, id: 'paciente-otro', apellido: 'Zzz', nombre: 'Fuera de la carga inicial' };
      render(<PacientesList {...defaultProps({ pacientes: [otroPaciente], total: 1, busqueda: 'zzz' })} />);

      expect(screen.getByText(/zzz, fuera de la carga inicial/i)).toBeInTheDocument();
    });

    it('el buscador sigue visible con 0 resultados de búsqueda (para poder borrar/corregir el término)', () => {
      render(<PacientesList {...defaultProps({ pacientes: [], total: 0, busqueda: 'zzz-inexistente' })} />);

      expect(screen.getByLabelText(/buscar paciente/i)).toBeInTheDocument();
    });

    it('el buscador NO se muestra cuando no hay pacientes en el sistema y no hay búsqueda activa', () => {
      render(<PacientesList {...defaultProps({ pacientes: [], total: 0, busqueda: '' })} />);

      expect(screen.queryByLabelText(/buscar paciente/i)).not.toBeInTheDocument();
    });
  });

  // 13.1/13.2: <Paginador> montado con el total que llega por props.
  describe('PacientesList — <Paginador> (13.1/13.2)', () => {
    it('renderiza el total de resultados que llega por props', () => {
      render(<PacientesList {...defaultProps({ pacientes: [martina], total: 45, pagina: 2, tamanio: 20 })} />);

      expect(screen.getByText('45 resultados')).toBeInTheDocument();
      expect(screen.getByText(/página 2 de 3/i)).toBeInTheDocument();
    });

    it('click en "Siguiente" invoca onCambiarPagina con pagina + 1', async () => {
      const user = userEvent.setup();
      const onCambiarPagina = vi.fn();

      render(
        <PacientesList {...defaultProps({ pacientes: [martina], total: 45, pagina: 2, tamanio: 20, onCambiarPagina })} />,
      );

      await user.click(screen.getByRole('button', { name: /página siguiente/i }));
      expect(onCambiarPagina).toHaveBeenCalledWith(3);
    });

    it('no monta el <Paginador> (fila de navegación) mientras loading o sin resultados', () => {
      render(<PacientesList {...defaultProps({ total: 0, busqueda: '' })} />);

      expect(screen.queryByText(/resultados/i)).not.toBeInTheDocument();
    });
  });

  // 13.6: la tarjeta sigue clickeable y "Editar" sigue con stopPropagation (convención existente).
  describe('PacientesList — gateo de escritura', () => {
    it('sin permiso de escritura: "+ Nuevo paciente" queda visible y no se puede activar (sigue en el DOM, decisión 1)', () => {
      renderConPermiso(false, <PacientesList {...defaultProps({ pacientes: [martina], total: 1 })} />);

      const crear = screen.getByRole('button', { name: /\+ nuevo paciente/i });
      expect(crear).toBeInTheDocument();
      expect(crear).toBeVisible();
      expect(crear).toBeDisabled();
    });

    it('sin permiso de escritura: "Crear el primer paciente" (estado vacío) queda visible y no se puede activar (triangulación con la lista no vacía)', () => {
      renderConPermiso(false, <PacientesList {...defaultProps({ pacientes: [], total: 0, busqueda: '' })} />);

      const crearPrimero = screen.getByRole('button', { name: /crear el primer paciente/i });
      expect(crearPrimero).toBeInTheDocument();
      expect(crearPrimero).toBeDisabled();
    });

    it('con permiso de escritura: "+ Nuevo paciente" y "Crear el primer paciente" están activables (triangulación)', () => {
      renderConPermiso(true, <PacientesList {...defaultProps({ pacientes: [martina], total: 1 })} />);

      expect(screen.getByRole('button', { name: /\+ nuevo paciente/i })).toBeEnabled();
    });

    it('sin permiso de escritura: "Editar" por fila queda visible y no se puede activar, y la fila sigue navegando al detalle', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      renderConPermiso(false, <PacientesList {...defaultProps({ pacientes: [martina], total: 1, onSelect })} />);

      const editar = screen.getByRole('button', { name: /editar gómez, martina/i });
      expect(editar).toBeVisible();
      expect(editar).toBeDisabled();

      await user.click(screen.getByText(/gómez, martina/i));
      expect(onSelect).toHaveBeenCalledWith(martina);
    });

    it('con permiso de escritura: "Editar" por fila está activable (triangulación)', () => {
      renderConPermiso(true, <PacientesList {...defaultProps({ pacientes: [martina], total: 1 })} />);

      expect(screen.getByRole('button', { name: /editar gómez, martina/i })).toBeEnabled();
    });

    it('sin permiso de escritura: el <button> nativo "Ver detalle" queda deshabilitado por el envoltorio', () => {
      renderConPermiso(false, <PacientesList {...defaultProps({ pacientes: [martina], total: 1 })} />);

      expect(screen.getByRole('button', { name: /^ver detalle$/i })).toBeDisabled();
    });

    it('con permiso de escritura: el <button> nativo "Ver detalle" está activable (triangulación)', () => {
      renderConPermiso(true, <PacientesList {...defaultProps({ pacientes: [martina], total: 1 })} />);

      expect(screen.getByRole('button', { name: /^ver detalle$/i })).toBeEnabled();
    });
  });

  // Rol admin sin filas de permisos (design.md D5): el contexto ya resolvió el short-circuit de
  // admin (probado de punta a punta en usePuedeEscribir.test.tsx, gateo-obrasocial tasks.md 2.2) —
  // acá solo se verifica que PacientesList consume ese resultado, mismo criterio que
  // ObrasSocialesList.test.tsx para el mismo escenario.
  describe('PacientesList — rol admin sin filas de permisos', () => {
    it('con puedeEscribir true (equivalente al short-circuit de admin sin filas): la acción de alta está activable', () => {
      renderConPermiso(true, <PacientesList {...defaultProps({ pacientes: [], total: 0, busqueda: '' })} />);

      expect(screen.getByRole('button', { name: /crear el primer paciente/i })).toBeEnabled();
    });
  });
});
