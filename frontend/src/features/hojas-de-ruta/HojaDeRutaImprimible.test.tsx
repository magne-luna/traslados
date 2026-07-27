import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Conductor } from '../../shared/types/conductor';
import type { Paciente } from '../../shared/types/paciente';
import type { HojaDeRuta } from '../../shared/types/hojaDeRuta';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { HojaDeRutaImprimible } from './HojaDeRutaImprimible';

// Vista imprimible (tasks.md 8.1, RF-706): recorridos agrupados por vehículo/conductor, orden
// de recogida, direcciones por tramo y notas al pie — refleja el estado actual (post-edición).

const vehiculo: Vehiculo = {
  id: 'v-1',
  patente: 'AC123DE',
  modelo: 'Toyota Etios',
  tipo: 'sedan',
  capacidad: 4,
  accesoriosCompatibles: [],
  estado: 'habilitado',
  kilometraje: 0,
  kilometrajeUltimoService: 0,
  fechaUltimoService: '2026-01-01',
  habilitaciones: [],
  gastos: [],
};

const conductor: Conductor = {
  id: 'c-1',
  apellido: 'González',
  nombre: 'Marcos',
  documento: '1',
  domicilio: 'x',
  cuil: '20-1-1',
  estado: 'operando',
  restricciones: [],
  asignaciones: [],
};

const paciente: Paciente = {
  id: 'paciente-1',
  apellido: 'Gómez',
  nombre: 'Martina',
  fechaNacimiento: '2015-01-01',
  dni: '1',
  cuilTitular: '20-1-1',
  diagnostico: 'x',
  accesorioMovilidad: [],
  obraSocialId: null,
  numeroAfiliado: { formato: 'numero-documento', valor: '1' },
  cud: null,
  direcciones: [
    { id: 'dir-origen', tipo: 'domicilio', calle: 'Av. Rivadavia 4500', localidad: 'CABA' },
    { id: 'dir-destino', tipo: 'escuela', calle: 'Bulnes 1200', localidad: 'CABA' },
  ],
  personasACargo: [],
  amparoJudicial: false,
};

const hoja: HojaDeRuta = {
  id: 'hoja-1',
  fecha: '2026-07-25',
  franjaInicio: '08:00',
  franjaFin: '20:00',
  notas: 'Nota general del día',
  recorridos: [
    {
      id: 'r-1',
      vehiculoId: 'v-1',
      conductorId: 'c-1',
      manual: false,
      notas: 'Nota del recorrido',
      paradas: [
        { id: 'p-1', pacienteId: 'paciente-1', tramo: 'ida', direccionOrigenId: 'dir-origen', direccionDestinoId: 'dir-destino', orden: 0 },
      ],
    },
  ],
};

describe('HojaDeRutaImprimible', () => {
  it('agrupa por vehículo/conductor y muestra el orden de recogida', () => {
    render(<HojaDeRutaImprimible hoja={hoja} vehiculos={[vehiculo]} conductores={[conductor]} pacientes={[paciente]} />);

    expect(screen.getByText(/ac123de/i)).toBeInTheDocument();
    expect(screen.getByText(/gonzález/i)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('muestra las direcciones de origen y destino resueltas por tramo', () => {
    render(<HojaDeRutaImprimible hoja={hoja} vehiculos={[vehiculo]} conductores={[conductor]} pacientes={[paciente]} />);

    expect(screen.getByText(/av\. rivadavia 4500/i)).toBeInTheDocument();
    expect(screen.getByText(/bulnes 1200/i)).toBeInTheDocument();
  });

  it('muestra las notas al pie de la hoja y del recorrido', () => {
    render(<HojaDeRutaImprimible hoja={hoja} vehiculos={[vehiculo]} conductores={[conductor]} pacientes={[paciente]} />);

    expect(screen.getByText('Nota general del día')).toBeInTheDocument();
    expect(screen.getByText('Nota del recorrido')).toBeInTheDocument();
  });

  it('muestra un estado explícito cuando la hoja del día no tiene recorridos (borde)', () => {
    const vacia: HojaDeRuta = { ...hoja, recorridos: [] };

    render(<HojaDeRutaImprimible hoja={vacia} vehiculos={[vehiculo]} conductores={[conductor]} pacientes={[paciente]} />);

    expect(screen.getByText(/sin recorridos/i)).toBeInTheDocument();
  });
});
