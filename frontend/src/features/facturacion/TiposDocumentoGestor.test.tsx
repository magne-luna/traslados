import type { FormEvent, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../../shared/auth/AuthContext';
import { createMockAuthRepository, type MockAuthRepositoryOptions } from '../../shared/lib/auth/mockAuthRepository';
import type { Usuario } from '../../shared/types/usuario';
import type { TipoDocumentoFactura } from '../../shared/types/tiposDocumento';
import type { TiposDocumentoRepository } from '../../shared/lib/facturacion/TiposDocumentoRepository';
import { TiposDocumentoRepositoryProvider } from './TiposDocumentoRepositoryContext';
import { TiposDocumentoGestor } from './TiposDocumentoGestor';

const EMPLEADO: Usuario = { id: 'u2', nombre: 'Juan', apellido: 'Pérez', email: 'juan@x.com', rol: 'empleado' };

const seed: TipoDocumentoFactura[] = [
  { id: 't1', tipo: 'Comprobante ARCA', requerido: true, activa: true },
  { id: 't2', tipo: 'CODEM', requerido: false, activa: false },
];

function crearRepository(tipos: TipoDocumentoFactura[]): TiposDocumentoRepository {
  const estado = new Map(tipos.map((t) => [t.id, { ...t }]));
  let proximoId = 100;
  return {
    async listarActivos() {
      return [...estado.values()].filter((t) => t.activa).sort((a, b) => a.tipo.localeCompare(b.tipo));
    },
    async listarTodos() {
      return [...estado.values()].sort((a, b) => a.tipo.localeCompare(b.tipo));
    },
    async crear(tipo: string, requerido: boolean) {
      const nuevo: TipoDocumentoFactura = { id: `t${proximoId++}`, tipo, requerido, activa: true };
      estado.set(nuevo.id, nuevo);
      return nuevo;
    },
    async editar(id: string, cambios: { tipo?: string; requerido?: boolean }) {
      const actual = estado.get(id);
      if (!actual) throw new Error('No existe ese tipo de documento en el catálogo.');
      const editado = { ...actual, ...cambios };
      estado.set(id, editado);
      return editado;
    },
    async desactivar(id: string) {
      const actual = estado.get(id);
      if (!actual) throw new Error('No existe ese tipo de documento en el catálogo.');
      estado.set(id, { ...actual, activa: false });
    },
    async reactivar(id: string) {
      const actual = estado.get(id);
      if (!actual) throw new Error('No existe ese tipo de documento en el catálogo.');
      estado.set(id, { ...actual, activa: true });
    },
  };
}

interface RenderOptions {
  repository: TiposDocumentoRepository;
  auth: MockAuthRepositoryOptions;
}

function renderGestor({ repository, auth }: RenderOptions) {
  const authRepository = createMockAuthRepository(auth);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthProvider repository={authRepository}>
        <TiposDocumentoRepositoryProvider repository={repository}>{children}</TiposDocumentoRepositoryProvider>
      </AuthProvider>
    );
  }
  return render(<TiposDocumentoGestor idBase="factura" />, { wrapper: Wrapper });
}

describe('TiposDocumentoGestor', () => {
  it('sin permiso de escritura no muestra la gestión (ni agregar ni editar ni reactivar)', async () => {
    renderGestor({ repository: crearRepository(seed), auth: { usuario: EMPLEADO, permisos: { facturacion: 'read' } } });

    await waitFor(() => expect(screen.queryByText('Comprobante ARCA')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /agregar tipo de documento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reactivar codem/i })).not.toBeInTheDocument();
  });

  it('con escritura lista el catálogo (activos e inactivos tachados) y permite dar de alta', async () => {
    const repository = crearRepository(seed);
    renderGestor({ repository, auth: { usuario: EMPLEADO, permisos: { facturacion: 'write' } } });

    expect(await screen.findByText('Comprobante ARCA')).toBeInTheDocument();
    expect(await screen.findByText('CODEM')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: /agregar tipo de documento/i }));
    await userEvent.type(screen.getByLabelText(/nombre/i), 'Orden de traslado');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('Orden de traslado')).toBeInTheDocument();
  });

  it('regresión: no anida un <form> dentro de un formulario externo (submit del contexto)', async () => {
    const repository = crearRepository(seed);
    const onSubmitExterno = vi.fn((event: FormEvent) => event.preventDefault());

    render(
      <AuthProvider repository={createMockAuthRepository({ usuario: EMPLEADO, permisos: { facturacion: 'write' } })}>
        <TiposDocumentoRepositoryProvider repository={repository}>
          <form onSubmit={onSubmitExterno}>
            <TiposDocumentoGestor idBase="factura" />
          </form>
        </TiposDocumentoRepositoryProvider>
      </AuthProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: /agregar tipo de documento/i }));

    const formularios = document.querySelectorAll('form');
    expect(formularios).toHaveLength(1);

    await userEvent.type(screen.getByLabelText(/nombre/i), 'Orden de traslado');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(screen.getByText('Orden de traslado')).toBeInTheDocument());
    expect(onSubmitExterno).not.toHaveBeenCalled();
  });

  it('desactiva con confirmación Overlay y permite reactivar', async () => {
    const repository = crearRepository(seed);
    renderGestor({ repository, auth: { usuario: EMPLEADO, permisos: { facturacion: 'write' } } });

    await userEvent.click(await screen.findByRole('button', { name: /menu de comprobante arca/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /desactivar/i }));

    expect(screen.getByRole('dialog', { name: /desactivar comprobante arca/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /desactivar de todas formas/i }));

    expect(await screen.findByRole('button', { name: /reactivar comprobante arca/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /reactivar comprobante arca/i }));
    expect(await screen.findByRole('button', { name: /menu de comprobante arca/i })).toBeInTheDocument();
  });

  it('editar cambia nombre y obligatoriedad', async () => {
    const repository = crearRepository(seed);
    renderGestor({ repository, auth: { usuario: EMPLEADO, permisos: { facturacion: 'write' } } });

    await userEvent.click(await screen.findByRole('button', { name: /menu de comprobante arca/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /editar/i }));
    await userEvent.clear(screen.getByLabelText(/nombre/i));
    await userEvent.type(screen.getByLabelText(/nombre/i), 'Comprobante ARCA digital');
    await userEvent.selectOptions(screen.getByLabelText(/obligatoriedad/i), 'opcional');
    await userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText('Comprobante ARCA digital')).toBeInTheDocument();
  });

  it('nombre vacío: error accionable y el form sigue abierto', async () => {
    renderGestor({ repository: crearRepository(seed), auth: { usuario: EMPLEADO, permisos: { facturacion: 'write' } } });

    await userEvent.click(await screen.findByRole('button', { name: /agregar tipo de documento/i }));
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText(/escribí un nombre para el tipo de documento/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
  });
});