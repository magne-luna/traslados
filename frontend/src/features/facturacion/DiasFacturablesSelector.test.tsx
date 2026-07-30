import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { DiasFacturablesSelector } from './DiasFacturablesSelector';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

// Agosto 2026: 1 es sábado, 2 es domingo, 17 es feriado de ejemplo (ver test).
describe('DiasFacturablesSelector', () => {
  it('pre-selecciona los días facturables del período al montar (excluye domingos y feriados)', () => {
    const onChange = vi.fn();
    render(
      <DiasFacturablesSelector
        mes={8}
        anio={2026}
        feriados={['2026-08-17']}
        facturaSabados={false}
        onChange={onChange}
      />,
    );

    const seleccionInicial = onChange.mock.calls[0]?.[0] as string[];
    expect(seleccionInicial).toContain('2026-08-03');
    expect(seleccionInicial).not.toContain('2026-08-02'); // domingo
    expect(seleccionInicial).not.toContain('2026-08-17'); // feriado
    expect(seleccionInicial).not.toContain('2026-08-01'); // sábado, facturaSabados=false
  });

  it('marca visualmente los feriados', () => {
    render(
      <DiasFacturablesSelector mes={8} anio={2026} feriados={['2026-08-17']} facturaSabados={false} onChange={vi.fn()} />,
    );

    expect(screen.getAllByText(/feriado/i).length).toBeGreaterThan(0);
  });

  it('permite desmarcar un día pre-seleccionado', async () => {
    const onChange = vi.fn();
    render(
      <DiasFacturablesSelector mes={8} anio={2026} feriados={[]} facturaSabados={false} onChange={onChange} />,
    );
    onChange.mockClear();

    await userEvent.click(screen.getByRole('checkbox', { name: '3 de agosto' }));

    const ultimaLlamada = onChange.mock.calls.at(-1)?.[0] as string[];
    expect(ultimaLlamada).not.toContain('2026-08-03');
  });

  it('permite marcar manualmente un feriado excluido por default', async () => {
    const onChange = vi.fn();
    render(
      <DiasFacturablesSelector mes={8} anio={2026} feriados={['2026-08-17']} facturaSabados={false} onChange={onChange} />,
    );
    onChange.mockClear();

    await userEvent.click(screen.getByRole('checkbox', { name: '17 de agosto' }));

    const ultimaLlamada = onChange.mock.calls.at(-1)?.[0] as string[];
    expect(ultimaLlamada).toContain('2026-08-17');
  });
});

// Gateo de escritura (gateo-facturacion, tasks.md 5.5, design.md D2). Seleccionar días
// facturables es una escritura no-CRUD gateada al mismo nivel `write` — ninguna requiere `admin`
// (decisión 5). La selección actual sigue siendo legible con solo `read`.
describe('DiasFacturablesSelector — gateo de escritura', () => {
  it('sin permiso de escritura: la selección queda inerte, pero la selección actual sigue siendo legible', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderConPermiso(
      false,
      <DiasFacturablesSelector mes={8} anio={2026} feriados={[]} facturaSabados={false} onChange={onChange} />,
    );

    const checkbox = screen.getByRole('checkbox', { name: '3 de agosto' });
    expect(checkbox).toBeDisabled();
    expect(checkbox).toBeChecked();

    onChange.mockClear();
    await user.click(checkbox);
    expect(onChange).not.toHaveBeenCalled();
    expect(checkbox).toBeChecked();
  });

  it('con permiso de escritura (sin admin): la selección es operativa (triangulación) — no requiere admin (decisión 5)', async () => {
    const onChange = vi.fn();

    renderConPermiso(
      true,
      <DiasFacturablesSelector mes={8} anio={2026} feriados={[]} facturaSabados={false} onChange={onChange} />,
    );
    onChange.mockClear();

    const checkbox = screen.getByRole('checkbox', { name: '3 de agosto' });
    expect(checkbox).toBeEnabled();
    await userEvent.click(checkbox);

    const ultimaLlamada = onChange.mock.calls.at(-1)?.[0] as string[];
    expect(ultimaLlamada).not.toContain('2026-08-03');
  });
});
