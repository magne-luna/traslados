import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Direccion } from '../../shared/types/paciente';
import type { RecorridoHabitual } from '../../shared/types/recorridoHabitual';
import { SelectorRecorridoHabitual } from './SelectorRecorridoHabitual';

// Atajo "Destino habitual" del armado de la hoja de ruta (feedback de usuario, 2026-08-27):
// ofrece los destinos habituales del paciente (RF-110) para completar hora/origen/destino de una.
// Los del día de la fecha van primero y agrupados aparte, pero el resto NO se esconde — un
// traslado excepcional un jueves con el destino habitual de los martes es un caso real.

const DIRECCIONES: Direccion[] = [
  { id: 'dir-casa', tipo: 'domicilio', calle: 'Rivadavia 100', localidad: 'CABA' },
  { id: 'dir-escuela', tipo: 'escuela', calle: 'Mitre 200', localidad: 'CABA' },
  { id: 'dir-terapia', tipo: 'terapia', calle: 'Sarmiento 300', localidad: 'CABA', descripcion: 'Kinesio' },
];

function habitual(id: string, overrides: Partial<RecorridoHabitual> = {}): RecorridoHabitual {
  return {
    id,
    pacienteId: 'p-1',
    direccionInicialId: 'dir-casa',
    direccionFinalId: 'dir-escuela',
    diaSemana: 'jueves',
    hora: '08:00',
    ...overrides,
  };
}

// 2026-08-27 es jueves.
const JUEVES = '2026-08-27';

function renderSelector(recorridos: RecorridoHabitual[], onSelect = vi.fn(), fecha = JUEVES) {
  render(
    <SelectorRecorridoHabitual
      formId="f"
      recorridos={recorridos}
      direcciones={DIRECCIONES}
      fecha={fecha}
      value=""
      onSelect={onSelect}
    />,
  );
  return onSelect;
}

describe('SelectorRecorridoHabitual', () => {
  // Feedback de la usuaria (2026-08-27): esconder el campo cuando el paciente no tiene ninguno
  // hacía indistinguible "este paciente no tiene" de "la función no anda". El campo se muestra
  // SIEMPRE, deshabilitado y con el motivo escrito.
  it('muestra el campo deshabilitado y explica por qué cuando el paciente no tiene ninguno', () => {
    render(
      <SelectorRecorridoHabitual formId="f" recorridos={[]} direcciones={DIRECCIONES} fecha={JUEVES} value="" onSelect={vi.fn()} />,
    );

    expect(screen.getByLabelText(/destino habitual/i)).toBeDisabled();
    expect(screen.getByText('Este paciente no tiene destinos habituales cargados en su ficha.')).toBeInTheDocument();
  });

  it('avisa mientras está buscando, en vez de aparecer vacío', () => {
    render(
      <SelectorRecorridoHabitual
        formId="f"
        recorridos={[]}
        direcciones={DIRECCIONES}
        fecha={JUEVES}
        value=""
        loading
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('Buscando destinos habituales…')).toBeInTheDocument();
    expect(screen.getByLabelText(/destino habitual/i)).toBeDisabled();
  });

  it('distingue un error de carga de "no tiene ninguno"', () => {
    render(
      <SelectorRecorridoHabitual
        formId="f"
        recorridos={[]}
        direcciones={DIRECCIONES}
        fecha={JUEVES}
        value=""
        error="No se pudieron cargar los destinos habituales."
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('No se pudieron cargar los destinos habituales.')).toBeInTheDocument();
    expect(screen.queryByText(/no tiene destinos habituales cargados/i)).not.toBeInTheDocument();
  });

  it('agrupa los del día de la fecha aparte de los otros días', () => {
    renderSelector([habitual('h-jueves'), habitual('h-martes', { diaSemana: 'martes', hora: '10:00' })]);

    const grupos = screen.getAllByRole('group');
    expect(grupos.map((g) => g.getAttribute('label'))).toEqual(['Para este día (Jueves)', 'Otros días']);
  });

  it('nombra cada destino con su hora y sus dos direcciones legibles', () => {
    renderSelector([habitual('h-1')]);

    expect(screen.getByRole('option', { name: '08:00 · Domicilio — Rivadavia 100 → Escuela — Mitre 200' })).toBeInTheDocument();
  });

  it('antepone el día a los destinos de otros días, para no confundirlos con los de hoy', () => {
    renderSelector([habitual('h-martes', { diaSemana: 'martes', hora: '10:00', direccionFinalId: 'dir-terapia' })]);

    expect(
      screen.getByRole('option', { name: 'Martes 10:00 · Domicilio — Rivadavia 100 → Terapia (Kinesio) — Sarmiento 300' }),
    ).toBeInTheDocument();
  });

  it('avisa cuando el paciente tiene habituales pero ninguno de ese día', () => {
    renderSelector([habitual('h-martes', { diaSemana: 'martes' })]);

    expect(screen.getByText('Sin destinos de Jueves — abajo están los de otros días')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^Martes/ })).toBeInTheDocument();
  });

  it('devuelve el destino elegido al caller', async () => {
    const user = userEvent.setup();
    const elegido = habitual('h-1');
    const onSelect = renderSelector([elegido]);

    await user.selectOptions(screen.getByLabelText(/destino habitual/i), 'h-1');

    expect(onSelect).toHaveBeenCalledWith(elegido);
  });

  it('devuelve undefined al volver a "sin destino habitual"', async () => {
    const user = userEvent.setup();
    const onSelect = renderSelector([habitual('h-1')]);

    await user.selectOptions(screen.getByLabelText(/destino habitual/i), '');

    expect(onSelect).toHaveBeenCalledWith(undefined);
  });
});
