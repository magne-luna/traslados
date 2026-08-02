import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ParadaRecorrido } from '../../shared/types/hojaDeRuta';
import { RecorridoHorario } from './RecorridoHorario';

// Resumen visual del horario (feedback de usuario, mockup "más énfasis en los horarios" +
// "que figuren todos los horarios"): un solo horario grande cuando hay una sola parada, línea de
// tiempo con TODAS las paradas cuando hay dos o más — la primera y la última con su rótulo
// semántico ("Primera parada"/"Hora de regreso"), las del medio numeradas ("Parada N").

function parada(id: string, horaEstimada?: string): ParadaRecorrido {
  return {
    id,
    pacienteId: `paciente-${id}`,
    tramo: 'ida',
    direccionOrigenId: 'x',
    direccionDestinoId: 'y',
    orden: 0,
    horaEstimada,
  };
}

describe('RecorridoHorario', () => {
  it('con una sola parada, muestra su hora como "Hora de salida"', () => {
    render(<RecorridoHorario paradas={[parada('a', '06:30')]} />);

    expect(screen.getByText('06:30')).toBeInTheDocument();
    expect(screen.getByText(/hora de salida/i)).toBeInTheDocument();
    expect(screen.queryByText(/primera parada/i)).not.toBeInTheDocument();
  });

  it('con dos paradas, muestra ambas horas como "Primera parada" y "Hora de regreso"', () => {
    render(<RecorridoHorario paradas={[parada('a', '14:00'), parada('b', '16:00')]} />);

    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByText(/primera parada/i)).toBeInTheDocument();
    expect(screen.getByText('16:00')).toBeInTheDocument();
    expect(screen.getByText(/hora de regreso/i)).toBeInTheDocument();
  });

  it('con tres o más paradas, muestra TODAS las horas — las del medio numeradas (triangulación)', () => {
    render(<RecorridoHorario paradas={[parada('a', '06:30'), parada('b', '08:30'), parada('c', '09:00')]} />);

    expect(screen.getByText('06:30')).toBeInTheDocument();
    expect(screen.getByText(/primera parada/i)).toBeInTheDocument();
    expect(screen.getByText('08:30')).toBeInTheDocument();
    expect(screen.getByText(/parada 2/i)).toBeInTheDocument();
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText(/hora de regreso/i)).toBeInTheDocument();
  });

  it('sin horaEstimada cargada, muestra un placeholder en vez de romper (borde, RN-HR-03)', () => {
    render(<RecorridoHorario paradas={[parada('a')]} />);

    expect(screen.getByText('--:--')).toBeInTheDocument();
  });

  it('sin horaEstimada en una parada intermedia, esa parada muestra el placeholder sin romper el resto (borde)', () => {
    render(<RecorridoHorario paradas={[parada('a', '06:30'), parada('b'), parada('c', '09:00')]} />);

    expect(screen.getByText('06:30')).toBeInTheDocument();
    expect(screen.getByText('--:--')).toBeInTheDocument();
    expect(screen.getByText('09:00')).toBeInTheDocument();
  });

  it('sin paradas, no renderiza nada (borde)', () => {
    const { container } = render(<RecorridoHorario paradas={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
