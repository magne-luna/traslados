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

    expect(screen.getByLabelText('Valor del km')).toHaveValue(null);
    expect(screen.getByLabelText('Cantidad de km')).toHaveValue(null);
    expect(screen.getByLabelText('Cantidad de días')).toHaveValue(null);
    expect(screen.getByLabelText('Total')).toHaveValue(null);
  });

  it('al vaciar un campo lo guarda como 0', () => {
    const set = vi.fn();
    render(<FacturaFormEconomicos formId="f" values={valores({ cantidadKm: 12 })} errors={{}} set={set} />);

    fireEvent.change(screen.getByLabelText('Cantidad de km'), { target: { value: '' } });

    expect(set).toHaveBeenCalledWith('cantidadKm', 0);
  });

  it('"Calcular" completa el total con días × km × valor del km', () => {
    const set = vi.fn();
    render(<FacturaFormEconomicos formId="f" values={valores({ dias: 20, cantidadKm: 15, valorKm: 300 })} errors={{}} set={set} />);

    fireEvent.click(screen.getByRole('button', { name: 'Calcular' }));

    expect(set).toHaveBeenCalledWith('monto', 90000);
  });
});
