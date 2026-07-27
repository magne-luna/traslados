import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ParadaRecorrido } from '../../shared/types/hojaDeRuta';
import { ParadasList } from './ParadasList';

// Lista de paradas (tasks.md 5.4, 6.3, RN-HR-01 + feedback de usuario "toda la info posible"):
// en modo `editable` el operador puede reordenar a mano (botones subir/bajar, fallback accesible
// WCAG 2.1 AA a drag-and-drop) y quitar una parada; en modo solo-lectura (recorrido ya armado) se
// ve la lista sin controles de edición. Siempre muestra hora estimada (si hay) y la dirección de
// origen → destino resuelta del catálogo del paciente. Nunca usa el índice del array como key
// (react-best-practices).

function parada(id: string, orden: number, nombrePaciente: string, overrides: Partial<ParadaRecorrido> = {}): ParadaRecorrido & { nombrePaciente: string } {
  return {
    id,
    pacienteId: `paciente-${id}`,
    tramo: 'ida',
    direccionOrigenId: 'dir-1',
    direccionDestinoId: 'dir-2',
    orden,
    nombrePaciente,
    ...overrides,
  };
}

const direccionFija = () => 'Calle 1, CABA';

describe('ParadasList', () => {
  it('muestra las paradas en el orden dado, identificadas por el nombre del paciente', () => {
    render(
      <ParadasList
        paradas={[parada('a', 0, 'Gómez, Martina'), parada('b', 1, 'Pereyra, Facundo')]}
        nombrePaciente={(pacienteId) =>
          pacienteId === 'paciente-a' ? 'Gómez, Martina' : 'Pereyra, Facundo'
        }
        editable
        direccionTexto={direccionFija}
        onReordenar={vi.fn()}
        onQuitar={vi.fn()}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Gómez, Martina');
    expect(items[1]).toHaveTextContent('Pereyra, Facundo');
  });

  it('mueve una parada hacia abajo y llama a onReordenar con el nuevo array completo', async () => {
    const user = userEvent.setup();
    const onReordenar = vi.fn();

    render(
      <ParadasList
        paradas={[parada('a', 0, 'A'), parada('b', 1, 'B')]}
        nombrePaciente={(pacienteId) => (pacienteId === 'paciente-a' ? 'Nombre A' : 'Nombre B')}
        editable
        direccionTexto={direccionFija}
        onReordenar={onReordenar}
        onQuitar={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /bajar nombre a/i }));

    expect(onReordenar).toHaveBeenCalledTimes(1);
    const nuevoOrden = onReordenar.mock.calls[0]?.[0] as ParadaRecorrido[];
    expect(nuevoOrden.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('quita una parada al hacer click en "Quitar"', async () => {
    const user = userEvent.setup();
    const onQuitar = vi.fn();

    render(
      <ParadasList
        paradas={[parada('a', 0, 'A')]}
        nombrePaciente={() => 'A'}
        editable
        direccionTexto={direccionFija}
        onReordenar={vi.fn()}
        onQuitar={onQuitar}
      />,
    );

    await user.click(screen.getByRole('button', { name: /quitar/i }));

    expect(onQuitar).toHaveBeenCalledWith('a');
  });

  it('muestra un estado vacío cuando el recorrido no tiene paradas (borde)', () => {
    render(
      <ParadasList
        paradas={[]}
        nombrePaciente={() => ''}
        editable
        direccionTexto={direccionFija}
        onReordenar={vi.fn()}
        onQuitar={vi.fn()}
      />,
    );

    expect(screen.getByText(/sin paradas/i)).toBeInTheDocument();
  });

  it('en modo solo-lectura (editable=false) no muestra los botones de subir/bajar/quitar', () => {
    render(
      <ParadasList
        paradas={[parada('a', 0, 'Gómez, Martina')]}
        nombrePaciente={() => 'Gómez, Martina'}
        editable={false}
        direccionTexto={direccionFija}
        onReordenar={vi.fn()}
        onQuitar={vi.fn()}
      />,
    );

    expect(screen.getByText('Gómez, Martina')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /subir/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bajar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument();
  });

  it('muestra la dirección de origen → destino y la hora estimada de cada parada', () => {
    render(
      <ParadasList
        paradas={[parada('a', 0, 'Gómez, Martina', { horaEstimada: '08:30' })]}
        nombrePaciente={() => 'Gómez, Martina'}
        editable
        direccionTexto={(direccionId) => (direccionId === 'dir-1' ? 'Av. Rivadavia 4500, CABA' : 'Bulnes 1200, CABA')}
        onReordenar={vi.fn()}
        onQuitar={vi.fn()}
      />,
    );

    expect(screen.getByText(/av\. rivadavia 4500, caba/i)).toBeInTheDocument();
    expect(screen.getByText(/bulnes 1200, caba/i)).toBeInTheDocument();
    expect(screen.getByText(/08:30/)).toBeInTheDocument();
  });

  it('sin hora estimada cargada, no muestra el campo de hora (borde)', () => {
    render(
      <ParadasList
        paradas={[parada('a', 0, 'Gómez, Martina')]}
        nombrePaciente={() => 'Gómez, Martina'}
        editable
        direccionTexto={direccionFija}
        onReordenar={vi.fn()}
        onQuitar={vi.fn()}
      />,
    );

    expect(screen.queryByText(/^\d{2}:\d{2}$/)).not.toBeInTheDocument();
  });
});
