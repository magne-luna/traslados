import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { FacturaFormValues } from './FacturaForm';
import { FacturaFormEconomicos } from './FacturaFormEconomicos';

// Fix directo (sin change SDD): los inputs numéricos mostraban el 0 inicial (al tipear quedaba
// "05" y no se podían vaciar) y el total no se calculaba — ahora se calcula con "Calcular".
function valores(parciales: Partial<FacturaFormValues> = {}): FacturaFormValues {
  return {
    pacienteId: 'paciente-1',
    descripcion: '',
    dias: 0,
    valorKm: 0,
    monto: 0,
    fechaInicial: '2026-08-01',
    fechaTope: '2026-08-31',
    tipoComprobante: 'A',
    cantidadKm: 0,
    prestacion: '',
    mesFacturado: 8,
    anioFacturado: 2026,
    dependenciaYRetorno: '',
    domicilioId: '',
    asistencias: [],
    ...parciales,
  };
}

describe('FacturaFormEconomicos', () => {
  it('muestra vacíos (no "0") los campos numéricos en cero', () => {
    render(<FacturaFormEconomicos formId="f" values={valores()} errors={{}} set={vi.fn()} />);

    expect(screen.getByLabelText('Valor del km')).toHaveValue('');
    expect(screen.getByLabelText('Cantidad de km')).toHaveValue('');
    expect(screen.getByLabelText('Cantidad de días')).toHaveValue('');
    expect(screen.getByLabelText('Total')).toHaveValue('');
  });

  it('al vaciar un campo lo guarda como 0', () => {
    const set = vi.fn();
    render(<FacturaFormEconomicos formId="f" values={valores({ cantidadKm: 12 })} errors={{}} set={set} />);

    fireEvent.change(screen.getByLabelText('Cantidad de km'), { target: { value: '' } });

    expect(set).toHaveBeenCalledWith('cantidadKm', 0);
  });

  it('acepta decimales con punto; una coma tipeada se convierte en punto', () => {
    const set = vi.fn();
    render(<FacturaFormEconomicos formId="f" values={valores()} errors={{}} set={set} />);

    const valorKm = screen.getByLabelText('Valor del km');
    fireEvent.change(valorKm, { target: { value: '150,' } });
    expect(valorKm).toHaveValue('150.');
    fireEvent.change(valorKm, { target: { value: '150.75' } });
    expect(valorKm).toHaveValue('150.75');
    expect(set).toHaveBeenLastCalledWith('valorKm', 150.75);

    const cantidadKm = screen.getByLabelText('Cantidad de km');
    fireEvent.change(cantidadKm, { target: { value: '12.5' } });
    expect(cantidadKm).toHaveValue('12.5');
    expect(set).toHaveBeenLastCalledWith('cantidadKm', 12.5);
  });

  it('ignora lo que no es un número (letras, más de 2 decimales, decimales en días)', () => {
    const set = vi.fn();
    render(<FacturaFormEconomicos formId="f" values={valores()} errors={{}} set={set} />);

    fireEvent.change(screen.getByLabelText('Valor del km'), { target: { value: '12a' } });
    fireEvent.change(screen.getByLabelText('Valor del km'), { target: { value: '1.234' } });
    fireEvent.change(screen.getByLabelText('Cantidad de días'), { target: { value: '2,5' } });

    expect(set).not.toHaveBeenCalled();
  });

  it('refleja el total cuando cambia desde afuera (ej. tras "Calcular")', () => {
    const { rerender } = render(<FacturaFormEconomicos formId="f" values={valores()} errors={{}} set={vi.fn()} />);

    rerender(<FacturaFormEconomicos formId="f" values={valores({ monto: 1234.5 })} errors={{}} set={vi.fn()} />);

    expect(screen.getByLabelText('Total')).toHaveValue('1234.5');
  });

  it('"Calcular" completa el total con días × km × valor del km', () => {
    const set = vi.fn();
    render(<FacturaFormEconomicos formId="f" values={valores({ dias: 20, cantidadKm: 15, valorKm: 300 })} errors={{}} set={set} />);

    fireEvent.click(screen.getByRole('button', { name: 'Calcular' }));

    expect(set).toHaveBeenCalledWith('monto', 90000);
  });
});
