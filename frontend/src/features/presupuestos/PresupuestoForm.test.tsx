import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Paciente } from '../../shared/types/paciente';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Prestacion } from '../../shared/types/prestacion';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PresupuestoForm, type PresupuestoFormSubmission } from './PresupuestoForm';

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

// Fixture base: modalidad `general` — la rama que, sin líneas cargadas, se comporta byte a byte
// como el campo `monto` simple histórico (spec "Modalidad general sin líneas cargadas usa el
// campo simple"). Los tests genéricos de este archivo (validación, wiring de selects, cartel de
// archivo, gateo) usan esta obra social a propósito para no bifurcar.
const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  modalidadFacturacion: 'general',
  admitePagosParciales: false,
  formatoAfiliado: 'numero-documento',
  checklist: [],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

// Fixture dedicada a la rama `por-prestacion` (tasks.md 8.4-8.6).
const swissMedical: ObraSocial = {
  id: 'swiss-medical',
  nombre: 'Swiss Medical',
  cuit: '30-50000000-1',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: 'numero-documento',
  checklist: [],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

const kinesiologia: Prestacion = {
  id: 'prestacion-kine',
  pacienteId: 'paciente-martina',
  nombre: 'Kinesiología',
  activa: true,
};

const fonoaudiologiaInactiva: Prestacion = {
  id: 'prestacion-fono',
  pacienteId: 'paciente-martina',
  nombre: 'Fonoaudiología',
  activa: false,
};

const martinaConPrestaciones: Paciente = { ...martina, prestaciones: [kinesiologia, fonoaudiologiaInactiva] };
const facundo: Paciente = { ...martina, id: 'paciente-facundo', apellido: 'Pérez', nombre: 'Facundo', prestaciones: [] };

describe('PresupuestoForm', () => {
  it('bloquea el guardado y señala paciente/obra social/monto faltantes cuando se envía vacío', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/el paciente es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/la obra social es obligatoria/i)).toBeInTheDocument();
    expect(screen.getByText(/el monto debe ser mayor a 0/i)).toBeInTheDocument();
  });

  it('el selector de paciente ofrece las opciones inyectadas por PacienteRepository', () => {
    render(<PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('option', { name: /gómez, martina/i })).toBeInTheDocument();
  });

  it('el selector de obra social ofrece las opciones inyectadas por ObraSocialRepository', () => {
    render(<PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('option', { name: 'OSECAC' })).toBeInTheDocument();
  });

  it('llama a onSubmit (modo "unico") guardando solo los ids de paciente/obra social (no los objetos embebidos)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    await user.selectOptions(screen.getByLabelText(/obra social/i), 'osecac');
    await user.type(screen.getByLabelText(/^monto \(estimaci/i), '150000');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[PresupuestoFormSubmission]>({
      modo: 'unico',
      values: expect.objectContaining({ pacienteId: 'paciente-martina', obraSocialId: 'osecac', monto: 150_000 }),
    });
  });

  it('muestra el AvisoModeloDatos de archivo único (Discrepancia 1, NO multi-documento)', () => {
    render(<PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('note')).toHaveTextContent(/un solo archivo/i);
  });

  // tasks.md 5.1, design.md D5/D13#1: el cartel más importante del change — el archivo elegido
  // todavía no se sube ni se persiste contra la base real (solo queda en el navegador). Un único
  // cartel agrupa esta advertencia con la ya existente de "archivo único" (mismo campo, mismo
  // grupo temático — no uno por campo).
  it('muestra un único cartel agrupado avisando que el archivo elegido todavía no se guarda en el servidor (D5)', () => {
    render(<PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const notas = screen.getAllByRole('note');
    expect(notas).toHaveLength(1);
    const cartel = notas[0];
    expect(cartel).toHaveTextContent(/todavía no se guarda en el servidor/i);
    expect(cartel).toHaveTextContent(/un solo archivo/i);
  });

  // Triangulación: el cartel se mantiene único incluso en modo edición, con un archivo ya
  // "cargado" en los valores iniciales (round-trip de lectura, D5) — no se duplica ni desaparece.
  it('el cartel del archivo se mantiene único también en modo edición con un archivo ya precargado', () => {
    render(
      <PresupuestoForm
        pacientes={[martina]}
        obrasSociales={[osecac]}
        initial={{
          pacienteId: 'paciente-martina',
          obraSocialId: 'osecac',
          monto: 150_000,
          fechaEmision: '2026-06-01',
          archivo: { nombre: 'presupuesto-facundo.pdf', cargadoEn: '2026-06-01' },
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const notas = screen.getAllByRole('note');
    expect(notas).toHaveLength(1);
    expect(notas[0]).toHaveTextContent(/todavía no se guarda en el servidor/i);
  });

  it('el input de archivo es de un único archivo, no un checklist', () => {
    render(<PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByLabelText(/archivo/i) as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.multiple).toBe(false);
  });

  it('precarga los valores iniciales en modo edición', () => {
    render(
      <PresupuestoForm
        pacientes={[martina]}
        obrasSociales={[osecac]}
        initial={{ pacienteId: 'paciente-martina', obraSocialId: 'osecac', monto: 150_000, fechaEmision: '2026-06-01' }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/paciente/i)).toHaveValue('paciente-martina');
    expect(screen.getByLabelText(/obra social/i)).toHaveValue('osecac');
    expect(screen.getByLabelText(/^monto \(estimaci/i)).toHaveValue(150_000);
  });

  it('muestra el error del repository sin ocultar el formulario', () => {
    render(
      <PresupuestoForm
        pacientes={[martina]}
        obrasSociales={[osecac]}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        submitError="No se pudo guardar"
      />,
    );

    expect(screen.getByText('No se pudo guardar')).toBeInTheDocument();
    expect(screen.getByLabelText(/paciente/i)).toBeInTheDocument();
  });

  it('dispara onCancel al hacer click en Cancelar', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// Bifurcación por modalidadFacturacion (design.md D9, tasks.md 8.1-8.6, spec presupuesto-prestacion).
describe('PresupuestoForm — bifurcación (design.md D9)', () => {
  // 8.1
  it('sin obra social elegida: muestra el campo monto simple (comportamiento sin cambios)', () => {
    render(<PresupuestoForm pacientes={[martinaConPrestaciones]} obrasSociales={[osecac, swissMedical]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/^monto \(estimaci/i)).toBeInTheDocument();
    expect(screen.queryByText(/no hay líneas/i)).not.toBeInTheDocument();
  });

  // 8.2 + 8.3
  it('obra social "general": ofrece PresupuestoLineasEditor y, sin líneas, el submit usa monto = 0 (modo "unico") — cae al campo simple', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(submission: PresupuestoFormSubmission) => void>();

    render(<PresupuestoForm pacientes={[martinaConPrestaciones]} obrasSociales={[osecac]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    await user.selectOptions(screen.getByLabelText(/obra social/i), 'osecac');

    // PresupuestoLineasEditor está presente, pero el campo monto simple sigue siendo la
    // alternativa válida sin líneas (spec "Modalidad general sin líneas cargadas usa el campo simple").
    expect(screen.getByText(/no hay líneas/i)).toBeInTheDocument();
    const montoInput = screen.getByLabelText(/^monto \(estimaci/i);
    expect(montoInput).not.toBeDisabled();

    await user.type(montoInput, '500');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[PresupuestoFormSubmission]>({
      modo: 'unico',
      values: expect.objectContaining({ monto: 500, prestacionId: undefined }),
    });
  });

  it('obra social "general" con líneas cargadas: submit usa create() con monto = suma(líneas) y prestacionId ausente', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(submission: PresupuestoFormSubmission) => void>();

    render(<PresupuestoForm pacientes={[martinaConPrestaciones]} obrasSociales={[osecac]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    await user.selectOptions(screen.getByLabelText(/obra social/i), 'osecac');

    await user.selectOptions(screen.getByLabelText(/prestación/i), 'prestacion-kine');
    await user.type(screen.getByLabelText(/^monto de la línea$/i), '100');
    await user.click(screen.getByRole('button', { name: /agregar/i }));

    // El campo monto simple pasa a solo-lectura y refleja la suma en vivo (D9).
    expect(screen.getByLabelText(/^monto \(estimaci/i)).toHaveValue(100);

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[PresupuestoFormSubmission]>({
      modo: 'unico',
      values: expect.objectContaining({ monto: 100, prestacionId: undefined }),
    });
  });

  // 8.4
  it('obra social "por-prestacion": multi-select de prestaciones activas del paciente + monto por cada una; submit usa createLote() (modo "lote")', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(submission: PresupuestoFormSubmission) => void>();

    render(
      <PresupuestoForm pacientes={[martinaConPrestaciones]} obrasSociales={[swissMedical]} onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    await user.selectOptions(screen.getByLabelText(/obra social/i), 'swiss-medical');

    // Solo la prestación activa aparece (spec "El selector de alta no ofrece prestaciones inactivas").
    expect(screen.getByText('Kinesiología')).toBeInTheDocument();
    expect(screen.queryByText('Fonoaudiología')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /kinesiología/i }));
    await user.type(screen.getByLabelText(/monto para kinesiología/i), '300');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[PresupuestoFormSubmission]>({
      modo: 'lote',
      items: [expect.objectContaining({ pacienteId: 'paciente-martina', prestacionId: 'prestacion-kine', monto: 300 })],
    });
  });

  it('obra social "por-prestacion": no envía ninguna prestación no marcada, aunque tenga un monto residual en el estado', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(submission: PresupuestoFormSubmission) => void>();
    const martinaDosActivas: Paciente = {
      ...martina,
      prestaciones: [kinesiologia, { ...fonoaudiologiaInactiva, activa: true }],
    };

    render(<PresupuestoForm pacientes={[martinaDosActivas]} obrasSociales={[swissMedical]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    await user.selectOptions(screen.getByLabelText(/obra social/i), 'swiss-medical');

    await user.click(screen.getByRole('checkbox', { name: /kinesiología/i }));
    await user.type(screen.getByLabelText(/monto para kinesiología/i), '150');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    const submission = onSubmit.mock.calls[0]?.[0];
    expect(submission?.modo).toBe('lote');
    if (submission?.modo === 'lote') {
      expect(submission.items).toHaveLength(1);
      expect(submission.items[0]).toMatchObject({ prestacionId: 'prestacion-kine' });
    }
  });

  // 8.5
  it('obra social "por-prestacion" con paciente sin prestaciones activas: empty state con enlace a la ficha del paciente, submit bloqueado', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PresupuestoForm pacientes={[facundo]} obrasSociales={[swissMedical]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-facundo');
    await user.selectOptions(screen.getByLabelText(/obra social/i), 'swiss-medical');

    expect(screen.getByText(/no tiene prestaciones activas/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ficha del paciente/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/carg[áa] el monto de al menos una prestaci[óo]n/i)).toBeInTheDocument();
  });

  // 8.6
  it('cambiar de paciente con líneas ya cargadas resetea el bloque de montos con aviso explícito', async () => {
    const user = userEvent.setup();

    render(
      <PresupuestoForm
        pacientes={[martinaConPrestaciones, facundo]}
        obrasSociales={[osecac]}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    await user.selectOptions(screen.getByLabelText(/obra social/i), 'osecac');
    await user.selectOptions(screen.getByLabelText(/prestación/i), 'prestacion-kine');
    await user.type(screen.getByLabelText(/^monto de la línea$/i), '100');
    await user.click(screen.getByRole('button', { name: /agregar/i }));

    expect(screen.queryByText(/no hay líneas/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-facundo');

    expect(screen.getByText(/no hay líneas/i)).toBeInTheDocument();
    expect(screen.getByText(/se reinici[oó]/i)).toBeInTheDocument();
  });

  it('cambiar de obra social con selección de prestaciones ya cargada resetea la selección con aviso explícito', async () => {
    const user = userEvent.setup();

    render(
      <PresupuestoForm
        pacientes={[martinaConPrestaciones]}
        obrasSociales={[osecac, swissMedical]}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    await user.selectOptions(screen.getByLabelText(/obra social/i), 'swiss-medical');
    await user.click(screen.getByRole('checkbox', { name: /kinesiología/i }));

    await user.selectOptions(screen.getByLabelText(/obra social/i), 'osecac');

    expect(screen.getByText(/se reinici[oó]/i)).toBeInTheDocument();
  });
});

// D9: la edición NUNCA bifurca — con `initial` presente, el bloque es siempre el campo monto
// simple, sin importar la modalidadFacturacion de la obra social (tasks.md 8.9).
describe('PresupuestoForm — edición no bifurca (design.md D9)', () => {
  it('editando un presupuesto de una obra social "por-prestacion", el formulario NO muestra el multi-select: sigue siendo el campo monto simple', () => {
    render(
      <PresupuestoForm
        pacientes={[martinaConPrestaciones]}
        obrasSociales={[swissMedical]}
        initial={{
          pacienteId: 'paciente-martina',
          obraSocialId: 'swiss-medical',
          monto: 80_000,
          fechaEmision: '2026-06-01',
          prestacionId: 'prestacion-kine',
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^monto \(estimaci/i)).toHaveValue(80_000);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('editando y guardando, onSubmit llega con modo "unico" y el monto editado', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(submission: PresupuestoFormSubmission) => void>();

    render(
      <PresupuestoForm
        pacientes={[martina]}
        obrasSociales={[osecac]}
        initial={{ pacienteId: 'paciente-martina', obraSocialId: 'osecac', monto: 150_000, fechaEmision: '2026-06-01' }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    const montoInput = screen.getByLabelText(/^monto \(estimaci/i);
    await user.clear(montoInput);
    await user.type(montoInput, '160000');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[PresupuestoFormSubmission]>({
      modo: 'unico',
      values: expect.objectContaining({ monto: 160_000 }),
    });
  });
});

// Gateo de escritura (gateo-facturacion, tasks.md 2.3/2.4, design.md D3). Un único envoltorio
// cubre todo el bloque de campos; Guardar declara `requiereEscritura`; Cancelar queda fuera del
// envoltorio y sigue operativo siempre (mismo criterio que PacienteForm/gateo-pacientes).
describe('PresupuestoForm — gateo de escritura', () => {
  it('sin permiso de escritura: ningún campo acepta entrada', async () => {
    const user = userEvent.setup();

    renderConPermiso(false, <PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/paciente/i)).toBeDisabled();
    expect(screen.getByLabelText(/obra social/i)).toBeDisabled();
    expect(screen.getByLabelText(/^monto \(estimaci/i)).toBeDisabled();
    expect(screen.getByLabelText(/fecha de emisión/i)).toBeDisabled();
    expect(screen.getByLabelText(/archivo/i)).toBeDisabled();

    await user.type(screen.getByLabelText(/^monto \(estimaci/i), '5');
    expect(screen.getByLabelText(/^monto \(estimaci/i)).toHaveValue(0);
  });

  it('sin permiso de escritura: Guardar no se puede activar y el repositorio (onSubmit) no recibe ninguna llamada', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(false, <PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    const guardar = screen.getByRole('button', { name: /guardar/i });
    expect(guardar).toBeDisabled();
    await user.click(guardar);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('con permiso de escritura: todo editable y guardable (triangulación)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(true, <PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/paciente/i)).toBeEnabled();

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    await user.selectOptions(screen.getByLabelText(/obra social/i), 'osecac');
    await user.type(screen.getByLabelText(/^monto \(estimaci/i), '150000');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('sin permiso de escritura: Cancelar sigue activable y dispara onCancel, y el formulario se cierra', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderConPermiso(false, <PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={onCancel} />);

    const cancelar = screen.getByRole('button', { name: /cancelar/i });
    expect(cancelar).toBeEnabled();
    await user.click(cancelar);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
