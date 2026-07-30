import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { AutorizacionForm, type AutorizacionFormValues } from './AutorizacionForm';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

describe('AutorizacionForm', () => {
  it('el selector de estado ofrece exactamente los 4 valores de EstadoAutorizacion', () => {
    render(<AutorizacionForm montoPresupuesto={100_000} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const select = screen.getByLabelText(/^estado$/i);
    const opciones = Array.from(select.querySelectorAll('option')).map((o) => o.getAttribute('value'));

    expect(opciones).toEqual(['pendiente', 'autorizada', 'judicializada', 'rechazada']);
  });

  it('bloquea el guardado y muestra el mensaje de RN-PA-01 cuando montoAutorizado supera el presupuesto', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<AutorizacionForm montoPresupuesto={100_000} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/monto autorizado/i), '150000');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/no puede ser mayor al monto del presupuesto/i)).toBeInTheDocument();
  });

  it('permite guardar cuando montoAutorizado es igual al presupuesto (borde inclusivo RN-PA-01)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<AutorizacionForm montoPresupuesto={100_000} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/monto autorizado/i), '100000');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[AutorizacionFormValues]>(
      expect.objectContaining({ montoAutorizado: 100_000 }),
    );
  });

  it('permite guardar sin montoAutorizado (estado pendiente, sin error de monto)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<AutorizacionForm montoPresupuesto={100_000} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('acepta una vigenciaDesde anterior a la fecha de respuesta (carga retroactiva, RN-PA-02) sin bloquear', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<AutorizacionForm montoPresupuesto={100_000} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/fecha de respuesta/i), '2026-04-01');
    await user.type(screen.getByLabelText(/vigencia desde/i), '2026-01-01');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[AutorizacionFormValues]>(
      expect.objectContaining({ fechaRespuesta: '2026-04-01', vigenciaDesde: '2026-01-01' }),
    );
  });

  it('muestra el AvisoModeloDatos de montoAutorizado (Discrepancia 2, pendiente de confirmar con backend)', () => {
    render(<AutorizacionForm montoPresupuesto={100_000} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const avisos = screen.getAllByRole('note');
    expect(avisos.some((a) => /monto autorizado no existe en el docx/i.test(a.textContent ?? ''))).toBe(true);
  });

  it('muestra el AvisoModeloDatos de vigenciaDesde (Discrepancia 3, pendiente de confirmar con backend)', () => {
    render(<AutorizacionForm montoPresupuesto={100_000} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const avisos = screen.getAllByRole('note');
    expect(avisos.some((a) => /fecha de vigencia no existe en el docx/i.test(a.textContent ?? ''))).toBe(true);
  });

  it('muestra el AvisoModeloDatos de archivo único (mismo criterio que el presupuesto)', () => {
    render(<AutorizacionForm montoPresupuesto={100_000} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const avisos = screen.getAllByRole('note');
    expect(avisos.some((a) => /un solo archivo/i.test(a.textContent ?? ''))).toBe(true);
  });

  it('el input de archivo es de un único archivo, no un checklist', () => {
    render(<AutorizacionForm montoPresupuesto={100_000} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByLabelText(/^archivo$/i) as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.multiple).toBe(false);
  });

  it('los campos de cupo mensual de días/km son editables y se envían en el submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<AutorizacionForm montoPresupuesto={100_000} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/cupo mensual de días/i), '20');
    await user.type(screen.getByLabelText(/cupo mensual de.*km/i), '600');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[AutorizacionFormValues]>(
      expect.objectContaining({ cupoMensualDias: 20, cupoMensualKm: 600 }),
    );
  });

  it('precarga los valores iniciales en modo edición', () => {
    render(
      <AutorizacionForm
        montoPresupuesto={100_000}
        initial={{
          estado: 'autorizada',
          montoAutorizado: 90_000,
          cupoMensualDias: 20,
          cupoMensualKm: 600,
          fechaRespuesta: '2026-04-01',
          vigenciaDesde: '2026-01-01',
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^estado$/i)).toHaveValue('autorizada');
    expect(screen.getByLabelText(/monto autorizado/i)).toHaveValue(90_000);
    expect(screen.getByLabelText(/vigencia desde/i)).toHaveValue('2026-01-01');
  });

  it('dispara onCancel al hacer click en Cancelar', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<AutorizacionForm montoPresupuesto={100_000} onSubmit={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// Gateo de escritura (gateo-facturacion, tasks.md 3.2/3.3, design.md D3/D6). Mismo criterio que
// PresupuestoForm: un solo envoltorio sobre el bloque de campos, Guardar declara
// `requiereEscritura`, Cancelar queda fuera y sigue operativo.
describe('AutorizacionForm — gateo de escritura', () => {
  it('sin permiso de escritura: ningún campo acepta entrada y Guardar no se puede activar, sin escrituras al repositorio', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(false, <AutorizacionForm montoPresupuesto={100_000} onSubmit={onSubmit} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/^estado$/i)).toBeDisabled();
    expect(screen.getByLabelText(/monto autorizado/i)).toBeDisabled();
    expect(screen.getByLabelText(/cupo mensual de días/i)).toBeDisabled();
    expect(screen.getByLabelText(/cupo mensual de.*km/i)).toBeDisabled();
    expect(screen.getByLabelText(/fecha de respuesta/i)).toBeDisabled();
    expect(screen.getByLabelText(/vigencia desde/i)).toBeDisabled();

    const guardar = screen.getByRole('button', { name: /guardar/i });
    expect(guardar).toBeDisabled();
    await user.click(guardar);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('con permiso de escritura: todo operativo y los datos ya cargados siguen siendo legibles (triangulación)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(
      true,
      <AutorizacionForm
        montoPresupuesto={100_000}
        initial={{ estado: 'autorizada', montoAutorizado: 90_000 }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^estado$/i)).toBeEnabled();
    expect(screen.getByLabelText(/^estado$/i)).toHaveValue('autorizada');
    expect(screen.getByLabelText(/monto autorizado/i)).toHaveValue(90_000);

    await user.click(screen.getByRole('button', { name: /guardar/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('sin permiso de escritura: Cancelar sigue activable y dispara onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderConPermiso(false, <AutorizacionForm montoPresupuesto={100_000} onSubmit={vi.fn()} onCancel={onCancel} />);

    const cancelar = screen.getByRole('button', { name: /cancelar/i });
    expect(cancelar).toBeEnabled();
    await user.click(cancelar);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
