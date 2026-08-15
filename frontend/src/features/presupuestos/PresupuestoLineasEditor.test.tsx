import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Prestacion } from '../../shared/types/prestacion';
import { PresupuestoLineasEditor, type LineaPresupuesto } from './PresupuestoLineasEditor';

const kinesiologia: Prestacion = {
  id: 'prestacion-kine',
  pacienteId: 'paciente-martina',
  nombre: 'Kinesiología',
  activa: true,
};

const fonoaudiologia: Prestacion = {
  id: 'prestacion-fono',
  pacienteId: 'paciente-martina',
  nombre: 'Fonoaudiología',
  activa: true,
};

const prestaciones: Prestacion[] = [kinesiologia, fonoaudiologia];

const lineaKine: LineaPresupuesto = { id: 'linea-1', prestacionId: 'prestacion-kine', monto: 100 };

// Componente controlado puro (tasks.md Fase 7, design.md D9/D10): mismo espíritu que
// AsistenciasEditor.tsx de Facturación — agregar/quitar línea { prestacionId, monto }, total
// calculado en vivo. Sin red — no invoca ningún repository, no lee el estado global de ningún
// presupuesto. Las líneas NUNCA se persisten (design.md D9): solo viven acá y en el estado de
// PresupuestoForm que las suma en el submit.
describe('PresupuestoLineasEditor', () => {
  it('muestra un aviso aclarando que se pueden cargar varias líneas, una por cada prestación', () => {
    render(<PresupuestoLineasEditor prestaciones={prestaciones} lineas={[]} onChange={vi.fn()} />);

    expect(screen.getByText(/pod[eé]s cargar varias líneas/i)).toBeInTheDocument();
  });

  it('muestra un estado vacío y total $0 cuando no hay líneas cargadas', () => {
    render(<PresupuestoLineasEditor prestaciones={prestaciones} lineas={[]} onChange={vi.fn()} />);

    expect(screen.getByText(/no hay líneas/i)).toBeInTheDocument();
    expect(screen.getByText(/\$\s?0/)).toBeInTheDocument();
  });

  it('lista las líneas existentes por el nombre de su prestación y su monto', () => {
    render(<PresupuestoLineasEditor prestaciones={prestaciones} lineas={[lineaKine]} onChange={vi.fn()} />);

    expect(screen.getAllByText('Kinesiología').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/100/).length).toBeGreaterThan(0);
  });

  it('agrega una nueva línea al elegir prestación, cargar monto y confirmar', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PresupuestoLineasEditor prestaciones={prestaciones} lineas={[]} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/prestación/i), 'prestacion-fono');
    await user.type(screen.getByLabelText(/monto/i), '200');
    await user.click(screen.getByRole('button', { name: /agregar/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nuevaLista = onChange.mock.calls[0]?.[0] as LineaPresupuesto[];
    expect(nuevaLista).toHaveLength(1);
    expect(nuevaLista[0]).toMatchObject({ prestacionId: 'prestacion-fono', monto: 200 });
  });

  it('quita una línea existente al hacer click en "Quitar"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PresupuestoLineasEditor prestaciones={prestaciones} lineas={[lineaKine]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /quitar/i }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('calcula el total en vivo con decimales (NUMERIC(10,2)), sumando todas las líneas', () => {
    const lineas: LineaPresupuesto[] = [
      { id: 'l1', prestacionId: 'prestacion-kine', monto: 100 },
      { id: 'l2', prestacionId: 'prestacion-fono', monto: 200 },
      { id: 'l3', prestacionId: 'prestacion-kine', monto: 50.5 },
    ];

    render(<PresupuestoLineasEditor prestaciones={prestaciones} lineas={lineas} onChange={vi.fn()} />);

    expect(screen.getByText(/350,5/)).toBeInTheDocument();
  });

  it('una línea sin monto (0) no rompe el cálculo del total', () => {
    const lineas: LineaPresupuesto[] = [
      { id: 'l1', prestacionId: 'prestacion-kine', monto: 100 },
      { id: 'l2', prestacionId: 'prestacion-fono', monto: 0 },
    ];

    render(<PresupuestoLineasEditor prestaciones={prestaciones} lineas={lineas} onChange={vi.fn()} />);

    expect(screen.getAllByText(/100/).length).toBeGreaterThan(0);
  });

  it('no invoca ningún repository ni hace ninguna llamada de red al agregar o quitar líneas', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    const onChange = vi.fn();

    render(<PresupuestoLineasEditor prestaciones={prestaciones} lineas={[lineaKine]} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/prestación/i), 'prestacion-fono');
    await user.type(screen.getByLabelText(/monto/i), '10');
    await user.click(screen.getByRole('button', { name: /agregar/i }));
    await user.click(screen.getAllByRole('button', { name: /quitar/i })[0]!);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
