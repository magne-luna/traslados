import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { FacturaEnMora, PacienteCudPorVencer, AlertaMantenimientoVehiculo } from '../../shared/types/reportes';
import { TarjetasAlertas } from './TarjetasAlertas';

// tasks.md 6.4, spec dashboard-tarjetas-alertas: compone las tres tarjetas (mora, CUD,
// mantenimiento) sobre TarjetaResumen, con enlaces a /facturacion, /pacientes y /vehiculos.

const mora: FacturaEnMora[] = [{ facturaId: 'f1', pacienteId: 'p1', saldoPendiente: 5000, diasDeAtraso: 70 }];
const cud: PacienteCudPorVencer[] = [
  { pacienteId: 'p2', apellido: 'Pérez', nombre: 'Ana', fechaVencimiento: '2026-08-01', estado: 'por-vencer' },
];
const mantenimiento: AlertaMantenimientoVehiculo[] = [
  { vehiculoId: 'v1', patente: 'AB123CD', motivos: [{ tipo: 'service-preventivo', estado: 'vencido' }] },
];

function renderTarjetas(overrides: Partial<React.ComponentProps<typeof TarjetasAlertas>> = {}) {
  return render(
    <MemoryRouter>
      <TarjetasAlertas
        mora={[]}
        moraCargando={false}
        moraError={null}
        nombrePaciente={() => 'Paciente'}
        cud={[]}
        cudCargando={false}
        cudError={null}
        mantenimiento={[]}
        mantenimientoCargando={false}
        mantenimientoError={null}
        {...overrides}
      />
    </MemoryRouter>,
  );
}

describe('TarjetasAlertas', () => {
  it('muestra la tarjeta de mora con el nombre del paciente resuelto y enlaza a /facturacion', () => {
    renderTarjetas({ mora, nombrePaciente: (id) => (id === 'p1' ? 'Juana Pérez' : 'Desconocido') });
    expect(screen.getByText(/Juana Pérez/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /facturas en mora/i })).toHaveAttribute('href', '/facturacion');
  });

  it('muestra la tarjeta de CUD y enlaza a /pacientes', () => {
    renderTarjetas({ cud });
    expect(screen.getByText(/Pérez, Ana/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cud por vencer/i })).toHaveAttribute('href', '/pacientes');
  });

  it('muestra la tarjeta de mantenimiento y enlaza a /vehiculos', () => {
    renderTarjetas({ mantenimiento });
    expect(screen.getByText(/AB123CD/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /mantenimiento/i })).toHaveAttribute('href', '/vehiculos');
  });

  it('cada tarjeta muestra su propio estado de error sin afectar a las demás', () => {
    renderTarjetas({ moraError: 'Falló facturación', cud, mantenimiento });
    expect(screen.getByRole('alert')).toHaveTextContent('Falló facturación');
    expect(screen.getByText(/Pérez, Ana/)).toBeInTheDocument();
    expect(screen.getByText(/AB123CD/)).toBeInTheDocument();
  });

  it('muestra un estado vacío afirmativo en las tres tarjetas cuando no hay alertas', () => {
    renderTarjetas();
    expect(screen.getByText(/no hay facturas en mora/i)).toBeInTheDocument();
    expect(screen.getByText(/no hay pacientes con cud/i)).toBeInTheDocument();
    expect(screen.getByText(/no hay veh[ií]culos/i)).toBeInTheDocument();
  });
});
