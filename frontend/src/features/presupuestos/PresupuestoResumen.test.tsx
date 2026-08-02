import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import type { Presupuesto } from '../../shared/types/presupuesto';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PresupuestoResumen } from './PresupuestoResumen';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

const martina: Paciente = {
  id: 'paciente-martina',
  apellido: 'Gómez',
  nombre: 'Martina',
  fechaNacimiento: '2015-03-12',
  dni: '45123456',
  cuilTitular: '27-30111222-4',
  diagnostico: 'Parálisis cerebral',
  accesorioMovilidad: [],
  obraSocialId: 'osecac',
  numeroAfiliado: { valor: '45123456' },
  cud: null,
  direcciones: [],
  personasACargo: [],
  amparoJudicial: false,
};

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: 'numero-documento',
  checklist: [],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

const presupuestoMartina: Presupuesto = {
  id: 'presupuesto-martina-1',
  pacienteId: 'paciente-martina',
  obraSocialId: 'osecac',
  monto: 150_000,
  fechaEmision: '2026-06-01',
};

describe('PresupuestoResumen', () => {
  it('dispara onEdit al hacer click en "Editar datos"', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(<PresupuestoResumen presupuesto={presupuestoMartina} paciente={martina} obraSocial={osecac} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: /editar datos/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

// Gateo de escritura (gateo-facturacion, tasks.md 2.2, design.md D1/D4). "Editar datos" queda
// visible pero no activable sin permiso de escritura; los datos siguen legibles (mismo criterio
// que PacienteResumen/gateo-pacientes).
describe('PresupuestoResumen — gateo de escritura', () => {
  it('sin permiso de escritura: "Editar datos" queda visible y no se puede activar', () => {
    renderConPermiso(
      false,
      <PresupuestoResumen presupuesto={presupuestoMartina} paciente={martina} obraSocial={osecac} onEdit={vi.fn()} />,
    );

    const editar = screen.getByRole('button', { name: /editar datos/i });
    expect(editar).toBeVisible();
    expect(editar).toBeDisabled();
    // Los datos siguen siendo legibles con solo `read` (D4 — el gateo nunca oculta contenido).
    expect(screen.getByText(/gómez, martina/i)).toBeInTheDocument();
  });

  it('con permiso de escritura: "Editar datos" está activable (triangulación)', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    renderConPermiso(
      true,
      <PresupuestoResumen presupuesto={presupuestoMartina} paciente={martina} obraSocial={osecac} onEdit={onEdit} />,
    );

    const editar = screen.getByRole('button', { name: /editar datos/i });
    expect(editar).toBeEnabled();
    await user.click(editar);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
