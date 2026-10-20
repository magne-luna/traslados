import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderConSesion } from '../../test/renderConSesion';
import type { CanalRealtime, CrearCanal } from './canal';
import { SincronizacionRealtime } from './SincronizacionRealtime';

function fabrica() {
  const cerrar = vi.fn();
  const crearCanal = vi.fn<CrearCanal>(
    (): CanalRealtime => ({ escuchar: vi.fn(), suscribir: vi.fn(), cerrar }),
  );
  return { crearCanal, cerrar };
}

describe('<SincronizacionRealtime />', () => {
  it('mientras la sesión carga no crea canal', () => {
    const { crearCanal } = fabrica();
    renderConSesion(<SincronizacionRealtime crearCanal={crearCanal} />);
    expect(crearCanal).not.toHaveBeenCalled();
  });

  it('anónimo: no crea canal', async () => {
    const { crearCanal } = fabrica();
    renderConSesion(<SincronizacionRealtime crearCanal={crearCanal} />, { status: 'anonymous' });
    await new Promise((r) => setTimeout(r, 20));
    expect(crearCanal).not.toHaveBeenCalled();
  });

  it('autenticado: crea el canal y no renderiza nada', async () => {
    const { crearCanal } = fabrica();
    const { container } = renderConSesion(<SincronizacionRealtime crearCanal={crearCanal} />);
    await waitFor(() => expect(crearCanal).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('al desmontar cierra el canal', async () => {
    const { crearCanal, cerrar } = fabrica();
    const { unmount } = renderConSesion(<SincronizacionRealtime crearCanal={crearCanal} />);
    await waitFor(() => expect(crearCanal).toHaveBeenCalled());
    unmount();
    expect(cerrar).toHaveBeenCalled();
  });
});
