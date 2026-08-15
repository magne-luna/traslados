import type { FormEvent, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../../shared/auth/AuthContext';
import { createMockAuthRepository, type MockAuthRepositoryOptions } from '../../shared/lib/auth/mockAuthRepository';
import type { Usuario } from '../../shared/types/usuario';
import type { AccesorioCatalogo } from '../../shared/types/catalogoAccesorios';
import type { CatalogoAccesoriosRepository } from '../../shared/lib/accesorios/CatalogoAccesoriosRepository';
import { CatalogoAccesoriosRepositoryProvider } from './CatalogoAccesoriosRepositoryContext';
import { AccesoriosMovilidadSelector } from './AccesoriosMovilidadSelector';

// Selector reutilizable de accesorios de movilidad (tasks.md 4.2, design D3 — plan recortado sin
// EF nueva): grid de ChecklistOption alimentado por el catálogo activo del repository, con gestión
// inline gateada por usePermiso('pacientes','write') — INDEPENDIENTE del módulo de la ruta (en
// VehiculoForm el PuedeEscribirContext de ruta es 'vehiculos' y no sirve acá).
//
// Patrón de context stub: AuthProvider (usePermiso → useAuth) + CatalogoAccesoriosRepositoryProvider
// con un repository inline por test (más control que el mock de localStorage, que persiste entre
// tests y contamina).

const EMPLEADO: Usuario = { id: 'u2', nombre: 'Juan', apellido: 'Pérez', email: 'juan@x.com', rol: 'empleado' };

const seed: AccesorioCatalogo[] = [
  { id: 'a1', tipo: 'silla-plegable', icono: 'silla-plegable', activa: true },
  { id: 'a2', tipo: 'tripode', icono: 'tripode', activa: false },
];

function crearRepository(acc: AccesorioCatalogo[]): CatalogoAccesoriosRepository {
  const estado = new Map(acc.map((a) => [a.id, { ...a }]));
  return {
    async listarActivos() {
      return [...estado.values()].filter((a) => a.activa).sort((a, b) => a.tipo.localeCompare(b.tipo));
    },
    async listarTodos() {
      return [...estado.values()].sort((a, b) => a.tipo.localeCompare(b.tipo));
    },
    async crear(tipo: string, icono: string) {
      if ([...estado.values()].some((a) => a.tipo === tipo)) {
        throw new Error(`Ya existe un accesorio llamado «${tipo}».`);
      }
      const nuevo: AccesorioCatalogo = { id: 'nuevo', tipo, icono, activa: true };
      estado.set('nuevo', nuevo);
      return nuevo;
    },
    async editar(id: string, cambios: { tipo?: string; icono?: string }) {
      const actual = estado.get(id);
      if (!actual) throw new Error('No existe ese accesorio en el catálogo.');
      const editado = { ...actual, ...cambios };
      estado.set(id, editado);
      return editado;
    },
    async desactivar(id: string) {
      const actual = estado.get(id);
      if (!actual) throw new Error('No existe ese accesorio en el catálogo.');
      estado.set(id, { ...actual, activa: false });
    },
    async reactivar(id: string) {
      const actual = estado.get(id);
      if (!actual) throw new Error('No existe ese accesorio en el catálogo.');
      estado.set(id, { ...actual, activa: true });
    },
  };
}

interface RenderOptions {
  repository: CatalogoAccesoriosRepository;
  auth: MockAuthRepositoryOptions;
  seleccion?: string[];
}

function renderSelector({ repository, auth, seleccion = [] }: RenderOptions) {
  const authRepository = createMockAuthRepository(auth);
  const onChange = vi.fn();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthProvider repository={authRepository}>
        <CatalogoAccesoriosRepositoryProvider repository={repository}>{children}</CatalogoAccesoriosRepositoryProvider>
      </AuthProvider>
    );
  }
  const utils = render(
    <AccesoriosMovilidadSelector idBase="acc" titulo="Accesorios de movilidad" seleccion={seleccion} onChange={onChange} />,
    { wrapper: Wrapper },
  );
  return { ...utils, onChange };
}

describe('AccesoriosMovilidadSelector', () => {
  it('RED/GREEN: con escritura, lista los activos del catálogo y deja elegir entre ellos', async () => {
    const { onChange } = renderSelector({
      repository: crearRepository(seed),
      auth: { usuario: EMPLEADO, permisos: { pacientes: 'write' } },
    });

    const opcion = await screen.findByRole('checkbox', { name: /silla plegable/i });
    await userEvent.click(opcion);

    expect(onChange).toHaveBeenCalledWith(['silla-plegable']);
  });

  it('GREEN: el activo ya seleccionado se muestra marcado', async () => {
    renderSelector({
      repository: crearRepository(seed),
      auth: { usuario: EMPLEADO, permisos: { pacientes: 'write' } },
      seleccion: ['silla-plegable'],
    });

    const opcion = await screen.findByRole('checkbox', { name: /silla plegable/i });
    expect(opcion).toBeChecked();
  });

  it('alta inline: crear un accesorio nuevo queda seleccionado en el mismo render sin recargar', async () => {
    const { onChange } = renderSelector({
      repository: crearRepository(seed),
      auth: { usuario: EMPLEADO, permisos: { pacientes: 'write' } },
    });

    await userEvent.click(await screen.findByRole('button', { name: /agregar accesorio/i }));
    await userEvent.type(screen.getByLabelText(/nombre/i), 'Silla eléctrica');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    // El nuevo queda seleccionado (spec: seleccionable y seleccionado en el mismo render)
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const ultimaLlamada = onChange.mock.calls.at(-1)?.[0] as string[];
    expect(ultimaLlamada).toContain('Silla eléctrica');
    expect(await screen.findByRole('checkbox', { name: /silla eléctrica/i })).toBeInTheDocument();
  });

  it('regresión: no anida un <form> dentro del <form> del alta de paciente/vehículo (recarga completa de página)', async () => {
    // El selector vive dentro del <form> de PacienteForm/VehiculoForm (vía CardForm). Un <form>
    // anidado es HTML inválido y el navegador terminaba disparando el submit del formulario
    // grande al hacer click en "Guardar" del alta de accesorio — recarga completa de página, y el
    // accesorio nunca llegaba a persistirse (el guardado real quedaba interrumpido a mitad).
    const authRepository = createMockAuthRepository({ usuario: EMPLEADO, permisos: { pacientes: 'write' } });
    const repository = crearRepository(seed);
    const onSubmitExterno = vi.fn((event: FormEvent) => event.preventDefault());
    const onChange = vi.fn();

    render(
      <AuthProvider repository={authRepository}>
        <CatalogoAccesoriosRepositoryProvider repository={repository}>
          <form onSubmit={onSubmitExterno}>
            <AccesoriosMovilidadSelector idBase="acc" titulo="Accesorios de movilidad" seleccion={[]} onChange={onChange} />
          </form>
        </CatalogoAccesoriosRepositoryProvider>
      </AuthProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: /agregar accesorio/i }));

    // Ningún <form> anidado dentro del <form> externo.
    const formularios = document.querySelectorAll('form');
    expect(formularios).toHaveLength(1);

    await userEvent.type(screen.getByLabelText(/nombre/i), 'Silla eléctrica');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    // El submit del formulario grande (paciente/vehículo) nunca se dispara por guardar un accesorio.
    expect(onSubmitExterno).not.toHaveBeenCalled();
  });

  it('duplicado: muestra el error accionable del repository bajo el form y el form sigue abierto', async () => {
    renderSelector({
      repository: crearRepository(seed),
      auth: { usuario: EMPLEADO, permisos: { pacientes: 'write' } },
    });

    await userEvent.click(await screen.findByRole('button', { name: /agregar accesorio/i }));
    await userEvent.type(screen.getByLabelText(/nombre/i), 'silla-plegable');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText(/ya existe un accesorio llamado «silla-plegable»/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument(); // form sigue abierto
  });

  it('menú ⋮: con escritura ofrece editar y desactivar por opción', async () => {
    renderSelector({
      repository: crearRepository(seed),
      auth: { usuario: EMPLEADO, permisos: { pacientes: 'write' } },
    });

    const opcion = await screen.findByRole('checkbox', { name: /silla plegable/i });
    const item = opcion.closest('label')?.parentElement; // contenedor del checklist item
    expect(item).not.toBeNull();
    const botonMenu = (await within(item as HTMLElement).findByRole('button', { name: /silla plegable/i }));
    await userEvent.click(botonMenu);

    expect(screen.getByRole('menuitem', { name: /editar/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /desactivar/i })).toBeInTheDocument();
  });

  it('desactivar: muestra el aviso de baja lógica antes de aplicar, y al confirmar queda tachado con Reactivar', async () => {
    renderSelector({
      repository: crearRepository(seed),
      auth: { usuario: EMPLEADO, permisos: { pacientes: 'write' } },
    });

    const opcion = await screen.findByRole('checkbox', { name: /silla plegable/i });
    const item = opcion.closest('label')?.parentElement as HTMLElement;
    await userEvent.click(await within(item).findByRole('button', { name: /silla plegable/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /desactivar/i }));

    // Aviso del DS antes de desactivar
    expect(screen.getByText(/deja de ofrecerse en asignaciones nuevas/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /desactivar de todas formas/i }));

    // Queda tachado + Reactivar
    expect(await screen.findByRole('button', { name: /reactivar silla plegable/i })).toBeInTheDocument();
  });

  it('reactivar: un inactivo vuelve a activa y reaparece como opción de asignación', async () => {
    renderSelector({
      repository: crearRepository(seed),
      auth: { usuario: EMPLEADO, permisos: { pacientes: 'write' } },
    });

    await userEvent.click(await screen.findByRole('button', { name: /reactivar trípode/i }));

    await waitFor(() => {
      // tras reactivar, el tachado con Reactivar desaparece del item (vuelve a activo)
      expect(screen.queryByRole('button', { name: /reactivar trípode/i })).not.toBeInTheDocument();
    });
  });

  it('sin escritura (pacientes: read): sin botón de agregar ni menús, solo elige entre activos', async () => {
    renderSelector({
      repository: crearRepository(seed),
      auth: { usuario: EMPLEADO, permisos: { pacientes: 'read' } },
    });

    const opcion = await screen.findByRole('checkbox', { name: /silla plegable/i });
    expect(opcion).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /agregar accesorio/i })).not.toBeInTheDocument();

    // el inactivo (tripode) no se ofrece a quien no gestiona
    expect(screen.queryByRole('checkbox', { name: /tripode/i })).not.toBeInTheDocument();
  });

  it('icono desconocido: renderiza el fallback genérico sin romper la opción', async () => {
    const conIconoRaro: AccesorioCatalogo[] = [{ id: 'a9', tipo: 'camilla-especial', icono: 'no-existe', activa: true }];
    renderSelector({
      repository: crearRepository(conIconoRaro),
      auth: { usuario: EMPLEADO, permisos: { pacientes: 'read' } },
    });

    const opcion = await screen.findByRole('checkbox', { name: /camilla especial/i });
    expect(opcion).toBeInTheDocument();
  });
});