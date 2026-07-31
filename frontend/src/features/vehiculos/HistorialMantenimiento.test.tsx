import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MantenimientoRegistro } from '../../shared/types/vehiculo';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { HistorialMantenimiento } from './HistorialMantenimiento';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

const preventivo: MantenimientoRegistro = {
  id: 'm1',
  fecha: '2026-06-01',
  kilometraje: 82_000,
  tipoIntervencion: 'preventivo',
  subtipo: 'cambio-aceite-filtros',
  proximoVencimientoKm: 92_000,
};

const correctivoOtro: MantenimientoRegistro = {
  id: 'm2',
  fecha: '2026-05-01',
  kilometraje: 78_000,
  tipoIntervencion: 'correctivo',
  subtipo: 'otro',
  detalle: 'Reemplazo de radiador perforado',
};

const gasto: MantenimientoRegistro = {
  id: 'm3',
  fecha: '2026-02-01',
  kilometraje: 55_000,
  tipoIntervencion: 'gasto',
};

describe('HistorialMantenimiento', () => {
  it('muestra un estado vacío cuando no hay intervenciones', () => {
    render(<HistorialMantenimiento mantenimientos={[]} onAgregar={vi.fn()} />);

    expect(screen.getByText(/no hay intervenciones/i)).toBeInTheDocument();
  });

  it('muestra la tabla poblada con tipo, sub-tipo, fecha, kilometraje y próximo vencimiento por fila', () => {
    render(<HistorialMantenimiento mantenimientos={[preventivo]} onAgregar={vi.fn()} />);

    // "Preventivo" y "Cambio de aceite/filtros" también existen como <option> del form de alta
    // (siempre en el DOM) — se verifica que aparezcan al menos una vez, no que sean únicos.
    expect(screen.getAllByText('Preventivo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cambio de aceite/filtros').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/82.?000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/92.?000/).length).toBeGreaterThan(0);
  });

  it('un sub-tipo de escape (otro) se muestra con su detalle en texto libre', () => {
    render(<HistorialMantenimiento mantenimientos={[correctivoOtro]} onAgregar={vi.fn()} />);

    expect(screen.getByText('Reemplazo de radiador perforado')).toBeInTheDocument();
  });

  it('un registro de tipo "gasto" se muestra identificado, sin sub-tipo', () => {
    render(<HistorialMantenimiento mantenimientos={[gasto]} onAgregar={vi.fn()} />);

    expect(screen.getAllByText('Gasto').length).toBeGreaterThan(0);
  });

  it('el selector de tipo de intervención ofrece solo preventivo y correctivo, no gasto', () => {
    render(<HistorialMantenimiento mantenimientos={[]} onAgregar={vi.fn()} />);

    const select = screen.getByLabelText(/tipo de intervención/i) as HTMLSelectElement;
    const opciones = Array.from(select.options)
      .map((o) => o.value)
      .filter((value) => value !== '');

    expect(opciones).toEqual(['preventivo', 'correctivo']);
  });

  it('el formulario no tiene ningún campo de monto', () => {
    render(<HistorialMantenimiento mantenimientos={[]} onAgregar={vi.fn()} />);

    expect(screen.queryByLabelText(/monto/i)).not.toBeInTheDocument();
  });

  it('selector en cascada: cambiar el tipo repuebla el sub-tipo y limpia la selección previa', async () => {
    const user = userEvent.setup();
    render(<HistorialMantenimiento mantenimientos={[]} onAgregar={vi.fn()} />);

    function opcionesNoVacias(select: HTMLSelectElement): string[] {
      return Array.from(select.options)
        .map((o) => o.value)
        .filter((value) => value !== '');
    }

    const tipoSelect = screen.getByLabelText(/tipo de intervención/i);
    await user.selectOptions(tipoSelect, 'preventivo');
    let subtipoSelect = screen.getByLabelText(/sub-?tipo/i) as HTMLSelectElement;
    expect(opcionesNoVacias(subtipoSelect)).toEqual(['cambio-aceite-filtros', 'vtv', 'rto']);

    await user.selectOptions(tipoSelect, 'correctivo');
    subtipoSelect = screen.getByLabelText(/sub-?tipo/i) as HTMLSelectElement;
    expect(opcionesNoVacias(subtipoSelect)).toEqual(['alternador', 'bateria', 'frenos', 'embrague', 'cubiertas', 'otro']);
    expect(subtipoSelect.value).not.toBe('vtv');
  });

  it('el campo detalle aparece y es obligatorio solo cuando el sub-tipo es "otro"', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    render(<HistorialMantenimiento mantenimientos={[]} onAgregar={onAgregar} />);

    expect(screen.queryByLabelText(/detalle/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/tipo de intervención/i), 'correctivo');
    await user.selectOptions(screen.getByLabelText(/sub-?tipo/i), 'otro');

    expect(screen.getByLabelText(/detalle/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^fecha$/i), '2026-07-01');
    await user.type(screen.getByLabelText(/^kilometraje$/i), '50000');
    await user.click(screen.getByRole('button', { name: /registrar/i }));

    expect(onAgregar).not.toHaveBeenCalled();
    expect(screen.getByText(/el detalle es obligatorio/i)).toBeInTheDocument();
  });

  it('bloquea el alta con fecha vacía o kilometraje negativo, señalando el campo', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    render(<HistorialMantenimiento mantenimientos={[]} onAgregar={onAgregar} />);

    await user.type(screen.getByLabelText(/^kilometraje$/i), '-5');
    await user.click(screen.getByRole('button', { name: /registrar/i }));

    expect(onAgregar).not.toHaveBeenCalled();
    expect(screen.getByText(/la fecha es obligatoria/i)).toBeInTheDocument();
    expect(screen.getByText(/el kilometraje es obligatorio/i)).toBeInTheDocument();
  });

  it('registra una intervención preventiva válida sin próximo vencimiento (opcional)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    render(<HistorialMantenimiento mantenimientos={[]} onAgregar={onAgregar} />);

    await user.selectOptions(screen.getByLabelText(/tipo de intervención/i), 'preventivo');
    await user.selectOptions(screen.getByLabelText(/sub-?tipo/i), 'cambio-aceite-filtros');
    await user.type(screen.getByLabelText(/^fecha$/i), '2026-07-01');
    await user.type(screen.getByLabelText(/^kilometraje$/i), '50000');
    await user.click(screen.getByRole('button', { name: /registrar/i }));

    expect(onAgregar).toHaveBeenCalledWith({
      tipoIntervencion: 'preventivo',
      subtipo: 'cambio-aceite-filtros',
      fecha: '2026-07-01',
      kilometraje: 50_000,
    });
  });

  it('registra una intervención correctiva fuera de catálogo conservando el detalle', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    render(<HistorialMantenimiento mantenimientos={[]} onAgregar={onAgregar} />);

    await user.selectOptions(screen.getByLabelText(/tipo de intervención/i), 'correctivo');
    await user.selectOptions(screen.getByLabelText(/sub-?tipo/i), 'otro');
    await user.type(screen.getByLabelText(/detalle/i), 'Suspensión delantera');
    await user.type(screen.getByLabelText(/^fecha$/i), '2026-07-01');
    await user.type(screen.getByLabelText(/^kilometraje$/i), '50000');
    await user.click(screen.getByRole('button', { name: /registrar/i }));

    expect(onAgregar).toHaveBeenCalledWith({
      tipoIntervencion: 'correctivo',
      subtipo: 'otro',
      detalle: 'Suspensión delantera',
      fecha: '2026-07-01',
      kilometraje: 50_000,
    });
  });
});

describe('HistorialMantenimiento — gateo de escritura', () => {
  it('sin permiso de escritura: el historial se lee completo y el alta no se puede activar', () => {
    renderConPermiso(false, <HistorialMantenimiento mantenimientos={[preventivo]} onAgregar={vi.fn()} />);

    expect(screen.getAllByText('Preventivo').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/tipo de intervención/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /registrar/i })).toBeDisabled();
  });

  it('con permiso de escritura: el alta queda operativa (triangulación)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();

    renderConPermiso(true, <HistorialMantenimiento mantenimientos={[]} onAgregar={onAgregar} />);

    await user.selectOptions(screen.getByLabelText(/tipo de intervención/i), 'preventivo');
    await user.selectOptions(screen.getByLabelText(/sub-?tipo/i), 'vtv');
    await user.type(screen.getByLabelText(/^fecha$/i), '2026-07-01');
    await user.type(screen.getByLabelText(/^kilometraje$/i), '50000');
    await user.click(screen.getByRole('button', { name: /registrar/i }));

    expect(onAgregar).toHaveBeenCalledTimes(1);
  });
});
