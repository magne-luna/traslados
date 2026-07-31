import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Conductor } from '../../shared/types/conductor';
import type { HojaDeRuta } from '../../shared/types/hojaDeRuta';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { RecorridosDelDiaPanel } from './RecorridosDelDiaPanel';

// tasks.md 6.1/6.2, spec dashboard-recorridos-del-dia: resumen de la jornada, lista de
// recorridos con patente/conductor resueltos por id, marca de manual, enlace a /hojas-de-ruta,
// y estados de carga/error/"sin hoja de ruta cargada" explícitos.

const vehiculo: Vehiculo = {
  id: 'v1',
  patente: 'AB123CD',
  modelo: 'Sprinter',
  tipo: 'combi',
  capacidad: 6,
  accesoriosCompatibles: [],
  estado: 'habilitado',
  kilometraje: 1000,
  kilometrajeUltimoService: 0,
  fechaUltimoService: '2026-01-01',
  habilitaciones: [],
  gastos: [],
  mantenimientos: [],
};

const conductor: Conductor = {
  id: 'c1',
  apellido: 'Gómez',
  nombre: 'Luis',
  documento: '1',
  domicilio: '',
  cuil: '1',
  estado: 'operando',
  restricciones: [],
  asignaciones: [],
};

const hojaDeRuta: HojaDeRuta = {
  id: 'h1',
  fecha: '2026-07-24',
  franjaInicio: '08:00',
  franjaFin: '20:00',
  recorridos: [
    {
      id: 'r1',
      vehiculoId: 'v1',
      conductorId: 'c1',
      manual: false,
      paradas: [{ id: 'p1', pacienteId: 'pac-1', tramo: 'ida', direccionOrigenId: 'd1', direccionDestinoId: 'd2', orden: 1 }],
    },
    {
      id: 'r2',
      vehiculoId: 'no-existe',
      conductorId: 'no-existe',
      manual: true,
      paradas: [],
    },
  ],
};

function renderPanel(overrides: Partial<React.ComponentProps<typeof RecorridosDelDiaPanel>> = {}) {
  return render(
    <MemoryRouter>
      <RecorridosDelDiaPanel
        cargando={false}
        error={null}
        hojaDeRuta={hojaDeRuta}
        vehiculos={[vehiculo]}
        conductores={[conductor]}
        {...overrides}
      />
    </MemoryRouter>,
  );
}

describe('RecorridosDelDiaPanel', () => {
  it('muestra el resumen de la jornada y el detalle de cada recorrido con patente y conductor resueltos', () => {
    renderPanel();
    expect(screen.getByText('AB123CD')).toBeInTheDocument();
    expect(screen.getByText(/Gómez, Luis/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /hojas de ruta/i })).toHaveAttribute('href', '/hojas-de-ruta');
  });

  it('muestra un recorrido con referencia no resoluble sin romper el panel', () => {
    renderPanel();
    expect(screen.getAllByText(/no disponible/i).length).toBeGreaterThan(0);
  });

  it('señaliza el recorrido manual', () => {
    renderPanel();
    expect(screen.getByText(/manual/i)).toBeInTheDocument();
  });

  it('muestra estado de carga', () => {
    renderPanel({ cargando: true });
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('muestra estado de error acotado al panel', () => {
    renderPanel({ error: 'Falló la lectura' });
    expect(screen.getByRole('alert')).toHaveTextContent('Falló la lectura');
  });

  it('muestra estado vacío cuando no hay hoja de ruta cargada para hoy', () => {
    renderPanel({ hojaDeRuta: null });
    expect(screen.getByText(/no hay hoja de ruta cargada/i)).toBeInTheDocument();
  });
});
