import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Paciente } from '../../shared/types/paciente';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PacienteResumen } from './PacienteResumen';

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
  obraSocialId: null,
  numeroAfiliado: { formato: 'numero-documento', valor: '45123456' },
  cud: null,
  direcciones: [],
  personasACargo: [],
  amparoJudicial: false,
};

describe('PacienteResumen', () => {
  it('dispara onEdit al hacer click en "Editar datos"', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(<PacienteResumen paciente={martina} obrasSociales={[]} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: /editar datos/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

// Gateo de escritura (gateo-pacientes, tasks.md 3.2): "Editar datos" queda visible pero no
// activable sin permiso de escritura sobre pacientes; los datos del resumen siguen legibles
// (Card no está envuelta — es puro texto, no controles de formulario).
describe('PacienteResumen — gateo de escritura', () => {
  it('sin permiso de escritura: "Editar datos" queda visible y no se puede activar', () => {
    renderConPermiso(false, <PacienteResumen paciente={martina} obrasSociales={[]} onEdit={vi.fn()} />);

    const editar = screen.getByRole('button', { name: /editar datos/i });
    expect(editar).toBeVisible();
    expect(editar).toBeDisabled();
    // Los datos siguen siendo legibles con solo `read` (D2/D3 — el gateo nunca oculta contenido).
    expect(screen.getByText(/gómez, martina/i)).toBeInTheDocument();
  });

  it('con permiso de escritura: "Editar datos" está activable (triangulación)', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    renderConPermiso(true, <PacienteResumen paciente={martina} obrasSociales={[]} onEdit={onEdit} />);

    const editar = screen.getByRole('button', { name: /editar datos/i });
    expect(editar).toBeEnabled();
    await user.click(editar);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
