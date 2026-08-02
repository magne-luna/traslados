import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ObraSocial } from '../../shared/types/obraSocial';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PacienteForm, type PacienteFormValues } from './PacienteForm';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

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

describe('PacienteForm', () => {
  it('bloquea el guardado y señala apellido/nombre/DNI faltantes al enviar vacío', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/el apellido es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/el nombre es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/el dni es obligatorio/i)).toBeInTheDocument();
  });

  it('llama a onSubmit con los valores completados, numeroAfiliado sin formato (RF-106: vive en la obra social)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[PacienteFormValues]>(
      expect.objectContaining({
        apellido: 'Gómez',
        nombre: 'Martina',
        dni: '45123456',
        numeroAfiliado: { valor: '' },
        obraSocialId: null,
        accesorioMovilidad: [],
        amparoJudicial: false,
      }),
    );
  });

  it('la Condición se guarda como campo separado del Diagnóstico (opcional)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.type(screen.getByLabelText(/diagnóstico/i), 'Parálisis cerebral');
    await user.type(screen.getByLabelText(/condición/i), 'Estable');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[PacienteFormValues]>(
      expect.objectContaining({ diagnostico: 'Parálisis cerebral', condicion: 'Estable' }),
    );
  });

  it('la Condición es opcional: se puede guardar sin completarla (triangulación)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0].condicion).toBeUndefined();
  });

  it('el segundo nombre es un campo opcional separado del nombre', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/segundo nombre/i), 'Sol');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[PacienteFormValues]>(
      expect.objectContaining({ nombre: 'Martina', segundoNombre: 'Sol' }),
    );
  });

  it('el segundo nombre queda sin completar si no se ingresa (triangulación)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0].segundoNombre).toBeUndefined();
  });

  it('el segundo apellido es un campo opcional separado del apellido', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/segundo apellido/i), 'Díaz');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[PacienteFormValues]>(
      expect.objectContaining({ apellido: 'Gómez', segundoApellido: 'Díaz' }),
    );
  });

  it('el segundo apellido queda sin completar si no se ingresa (triangulación)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0].segundoApellido).toBeUndefined();
  });

  it('el select de obra social se puebla desde la lista recibida por props, no hardcodeada', () => {
    render(<PacienteForm obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('option', { name: 'OSECAC' })).toBeInTheDocument();
  });

  it('marcar amparo judicial revela el campo de aclaración', async () => {
    const user = userEvent.setup();

    render(<PacienteForm obrasSociales={[]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByLabelText(/aclaración/i)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/amparo judicial/i));
    expect(screen.getByLabelText(/aclaración/i)).toBeInTheDocument();
  });

  it('precarga los valores iniciales en modo edición', () => {
    render(
      <PacienteForm
        obrasSociales={[osecac]}
        initial={{
          apellido: 'Gómez',
          nombre: 'Martina',
          fechaNacimiento: '2015-03-12',
          dni: '45123456',
          cuilTitular: '27-30111222-4',
          diagnostico: 'Parálisis cerebral',
          accesorioMovilidad: ['silla-plegable', 'andador'],
          obraSocialId: 'osecac',
          numeroAfiliado: { valor: 'OS-1' },
          amparoJudicial: false,
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^apellido$/i)).toHaveValue('Gómez');
    expect(screen.getByLabelText(/^dni$/i)).toHaveValue('45123456');
    expect(screen.getByLabelText(/silla plegable/i)).toBeChecked();
    expect(screen.getByLabelText(/andador/i)).toBeChecked();
    expect(screen.getByLabelText(/silla rígida/i)).not.toBeChecked();
  });

  it('muestra el error del repository sin ocultar el formulario', () => {
    render(<PacienteForm obrasSociales={[]} onSubmit={vi.fn()} onCancel={vi.fn()} submitError="DNI duplicado" />);

    expect(screen.getByText('DNI duplicado')).toBeInTheDocument();
    expect(screen.getByLabelText(/^apellido$/i)).toBeInTheDocument();
  });

  it('permite seleccionar más de un accesorio de movilidad (multi-selección, tabla de vínculo en el docx)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByLabelText(/silla plegable/i));
    await user.click(screen.getByLabelText(/andador/i));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[PacienteFormValues]>(
      expect.objectContaining({ accesorioMovilidad: ['silla-plegable', 'andador'] }),
    );
  });

  it('no tiene campo de teléfono alternativo (docx: pertenece a Personas a Cargo, no a Paciente)', () => {
    render(<PacienteForm obrasSociales={[]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByLabelText(/teléfono/i)).not.toBeInTheDocument();
  });

  it('dispara onCancel al hacer click en Cancelar', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// Gateo de escritura (gateo-pacientes, design.md D1, tasks.md 2.1-2.3): el envoltorio de solo
// lectura cubre los dos bloques de campos (PacienteDatosPersonalesFields + PacienteCoberturaFields,
// que a su vez incluye IdentificadorAfiliadoField) con una única inserción en PacienteForm, nunca
// en cada bloque por separado. Guardar es la única acción que declara `requiereEscritura`;
// Cancelar queda fuera del envoltorio y sigue operativo siempre (design.md riesgos).
describe('PacienteForm — gateo de escritura', () => {
  it('sin permiso de escritura: ningún campo de los tres bloques acepta entrada', async () => {
    const user = userEvent.setup();

    renderConPermiso(false, <PacienteForm obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    // PacienteDatosPersonalesFields
    expect(screen.getByLabelText(/^apellido$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^nombre$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^dni$/i)).toBeDisabled();
    expect(screen.getByLabelText(/diagnóstico/i)).toBeDisabled();
    // PacienteCoberturaFields
    expect(screen.getByLabelText(/obra social/i)).toBeDisabled();
    expect(screen.getByLabelText(/amparo judicial/i)).toBeDisabled();
    // IdentificadorAfiliadoField, anidado dentro de PacienteCoberturaFields
    expect(screen.getByLabelText(/formato/i)).toBeDisabled();
    expect(screen.getByLabelText(/^valor$/i)).toBeDisabled();

    // Comportamiento observable (D7), no solo el atributo disabled: intentar escribir no cambia el valor.
    await user.type(screen.getByLabelText(/^apellido$/i), 'Intento bloqueado');
    expect(screen.getByLabelText(/^apellido$/i)).toHaveValue('');
  });

  it('sin permiso de escritura: Guardar no se puede activar y el repositorio (onSubmit) no recibe ninguna llamada', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(false, <PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    const guardar = screen.getByRole('button', { name: /guardar/i });
    expect(guardar).toBeDisabled();
    await user.click(guardar);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('con permiso de escritura: los tres bloques aceptan entrada y Guardar guarda (triangulación)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(true, <PacienteForm obrasSociales={[osecac]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/^apellido$/i)).toBeEnabled();
    expect(screen.getByLabelText(/obra social/i)).toBeEnabled();
    // Nota: "formato" NO se prueba acá — es siempre solo-lectura (derivado de la obra social,
    // RF-106), nunca lo habilita el permiso de escritura. Cubierto en el describe de arriba.

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('el envoltorio no cambió las firmas de PacienteDatosPersonalesFields, PacienteCoberturaFields ni IdentificadorAfiliadoField: siguen sin recibir props de permiso', async () => {
    // Verificado por lectura del diff (tasks.md 2.2) — los tres componentes de campos no reciben
    // ninguna prop nueva; el gateo entero vive en el <CamposSoloLectura> de PacienteForm. Este
    // test documenta el comportamiento observable equivalente: los campos de los tres bloques
    // quedan inertes con una única fuente de verdad (el contexto), sin que ningún bloque quede
    // desincronizado del resto.
    renderConPermiso(false, <PacienteForm obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const camposDeLosTresBloques = [
      screen.getByLabelText(/^apellido$/i), // PacienteDatosPersonalesFields
      screen.getByLabelText(/obra social/i), // PacienteCoberturaFields
      screen.getByLabelText(/formato/i), // IdentificadorAfiliadoField
    ];
    for (const campo of camposDeLosTresBloques) {
      expect(campo).toBeDisabled();
    }
  });

  it('sin permiso de escritura: Cancelar sigue activable y dispara onCancel, porque no persiste nada', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderConPermiso(false, <PacienteForm obrasSociales={[]} onSubmit={vi.fn()} onCancel={onCancel} />);

    const cancelar = screen.getByRole('button', { name: /cancelar/i });
    expect(cancelar).toBeEnabled();
    await user.click(cancelar);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// Rol admin sin filas en la matriz de permisos (design.md D5, tasks.md 2.4): es el falso negativo
// más caro — un test de "solo read" no lo detecta. El short-circuit de rol==='admin' en
// tienePermiso() (permisos.ts) ya está probado de punta a punta contra RequireAuth en
// usePuedeEscribir.test.tsx (mecanismo compartido, gateo-obrasocial tasks.md 2.2); acá solo se
// confirma que PacienteForm consume ese `true` igual que el de una cuenta con permiso `write`
// explícito, sin volver a resolver la matriz por su cuenta (mismo criterio ya usado en
// ObrasSocialesList.test.tsx para el mismo escenario).
describe('PacienteForm — rol admin sin filas de permisos', () => {
  it('puedeEscribir true (equivalente al short-circuit de admin sin filas): el formulario queda plenamente editable y guardable', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(true, <PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/^apellido$/i)).toBeEnabled();
    expect(screen.getByRole('button', { name: /guardar/i })).toBeEnabled();

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('triangulación: rol empleado sin permiso de escritura (incluida matriz vacía, que además pierde el acceso de lectura en RequireAuth) deja el formulario inerte', () => {
    renderConPermiso(false, <PacienteForm obrasSociales={[]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/^apellido$/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });
});
