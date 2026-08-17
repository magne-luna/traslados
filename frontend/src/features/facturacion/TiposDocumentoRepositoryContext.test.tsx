import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TiposDocumentoRepository } from '../../shared/lib/facturacion/TiposDocumentoRepository';
import type { Usuario } from '../../shared/types/usuario';
import { AuthProvider } from '../../shared/auth/AuthContext';
import { createMockAuthRepository } from '../../shared/lib/auth/mockAuthRepository';
import { TiposDocumentoRepositoryProvider, useTiposDocumento, useTiposDocumentoRepository } from './TiposDocumentoRepositoryContext';

const EMPLEADO: Usuario = { id: 'u2', nombre: 'Juan', apellido: 'Pérez', email: 'juan@x.com', rol: 'empleado' };

function buildFakeRepository(): TiposDocumentoRepository {
  return {
    listarActivos: vi.fn().mockResolvedValue([{ id: 't1', tipo: 'Comprobante ARCA', requerido: true, activa: true }]),
    listarTodos: vi.fn().mockResolvedValue([
      { id: 't1', tipo: 'Comprobante ARCA', requerido: true, activa: true },
      { id: 't2', tipo: 'CODEM', requerido: false, activa: false },
    ]),
    crear: vi.fn(),
    editar: vi.fn(),
    desactivar: vi.fn(),
    reactivar: vi.fn(),
  };
}

function ConsumerRepository() {
  const repository = useTiposDocumentoRepository();
  return <div>{typeof repository.listarActivos}</div>;
}

function ConsumerVista() {
  const { tiposDocumento, incluyeInactivos, cargando } = useTiposDocumento();
  if (cargando) return <div>cargando</div>;
  return (
    <div>
      {tiposDocumento.map((t) => (
        <span key={t.id}>
          {t.tipo}:{String(t.activa)}
        </span>
      ))}
      <span>incluyeInactivos={String(incluyeInactivos)}</span>
    </div>
  );
}

describe('TiposDocumentoRepositoryContext', () => {
  it('expone el repository inyectado a los descendientes dentro del Provider', () => {
    render(
      <TiposDocumentoRepositoryProvider repository={buildFakeRepository()}>
        <ConsumerRepository />
      </TiposDocumentoRepositoryProvider>,
    );

    expect(screen.getByText('function')).toBeInTheDocument();
  });

  it('lanza un error explícito si se usa fuera del Provider (borde)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<ConsumerRepository />)).toThrow(/TiposDocumentoRepositoryProvider/);

    consoleSpy.mockRestore();
  });

  it('sin permiso facturacion:write carga solo activos y no incluye inactivos', async () => {
    const repository = buildFakeRepository();
    render(
      <AuthProvider repository={createMockAuthRepository({ usuario: EMPLEADO, permisos: { facturacion: 'read' } })}>
        <TiposDocumentoRepositoryProvider repository={repository}>
          <ConsumerVista />
        </TiposDocumentoRepositoryProvider>
      </AuthProvider>,
    );

    expect(await screen.findByText('Comprobante ARCA:true')).toBeInTheDocument();
    expect(screen.queryByText('CODEM:false')).not.toBeInTheDocument();
    expect(screen.getByText('incluyeInactivos=false')).toBeInTheDocument();
    expect(repository.listarActivos).toHaveBeenCalled();
    expect(repository.listarTodos).not.toHaveBeenCalled();
  });

  it('con facturacion:write carga todos (activos e inactivos, para poder reactivar)', async () => {
    const repository = buildFakeRepository();
    render(
      <AuthProvider repository={createMockAuthRepository({ permisos: { facturacion: 'write' } })}>
        <TiposDocumentoRepositoryProvider repository={repository}>
          <ConsumerVista />
        </TiposDocumentoRepositoryProvider>
      </AuthProvider>,
    );

    expect(await screen.findByText('CODEM:false')).toBeInTheDocument();
    expect(screen.getByText('incluyeInactivos=true')).toBeInTheDocument();
    expect(repository.listarTodos).toHaveBeenCalled();
  });
});