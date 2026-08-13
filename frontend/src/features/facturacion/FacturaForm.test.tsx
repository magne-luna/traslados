import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Paciente } from '../../shared/types/paciente';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Factura } from '../../shared/types/factura';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { FacturaForm, type FacturaFormValues } from './FacturaForm';

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
  direcciones: [{ id: 'dir-1', tipo: 'domicilio', calle: 'Rivadavia 4500', localidad: 'CABA' }],
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

// Obra social en modalidad "general" (change `factura-por-prestador`, design.md D2): usada donde
// hace falta distinguirla de `osecac` ("por-prestacion"). Los campos de prestador que antes
// diferenciaban a las dos modalidades en el Paso 2 se retiraron por completo (change
// `facturacion-seleccion-autorizacion`, design.md D5) — el Paso 2 hoy se comporta igual en ambas
// modalidades hasta que la sección 3 de ese change (bloqueada por migraciones) cablee el selector
// de autorizaciones que las vuelve a distinguir.
const obraSocialGeneral: ObraSocial = {
  ...osecac,
  id: 'os-general',
  nombre: 'Obra Social General',
  modalidadFacturacion: 'general',
};

const pacienteGeneral: Paciente = { ...martina, id: 'paciente-general', obraSocialId: 'os-general' };

// Valores de una factura ya cargada (change `facturacion-wizard-paciente-prestador`): dispara el
// modo edición de `FacturaForm` (`esEdicion = Boolean(initial?.pacienteId)`), que saltea el
// wizard y muestra los tres pasos juntos.
function valoresIniciales(overrides: Partial<FacturaFormValues> = {}): FacturaFormValues {
  return {
    pacienteId: 'paciente-martina',
    descripcion: '',
    dias: 0,
    valorKm: 0,
    monto: 0,
    fechaInicial: '2026-01-01',
    fechaTope: '2026-01-01',
    tipoComprobante: 'A',
    cantidadKm: 0,
    prestacion: '',
    mesFacturado: 1,
    anioFacturado: 2026,
    dependenciaYRetorno: '',
    domicilioId: '',
    asistencias: [],
    ...overrides,
  };
}

function renderForm(overrides: Partial<React.ComponentProps<typeof FacturaForm>> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <FacturaForm
      pacientes={[martina]}
      obrasSociales={[osecac]}
      facturasExistentes={[]}
      facturaIdEnEdicion={null}
      feriados={[]}
      resolverCupoAutorizado={vi.fn().mockResolvedValue(undefined)}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onSubmit, onCancel };
}

function renderFormConPermiso(puedeEscribir: boolean, overrides: Partial<React.ComponentProps<typeof FacturaForm>> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
      <FacturaForm
        pacientes={[martina]}
        obrasSociales={[osecac]}
        facturasExistentes={[]}
        facturaIdEnEdicion={null}
        feriados={[]}
        resolverCupoAutorizado={vi.fn().mockResolvedValue(undefined)}
        onSubmit={onSubmit}
        onCancel={onCancel}
        {...overrides}
      />
    </PuedeEscribirContext.Provider>,
  );
  return { onSubmit, onCancel };
}

describe('FacturaForm', () => {
  // Modo edición (`initial` con `pacienteId`): saltea el wizard, así que el campo Paciente sigue
  // visible junto con el resto — el único lugar donde este escenario ("guardar sin paciente")
  // puede ocurrir después del wizard, ya que en modo alta nunca se llega a "Guardar" sin haber
  // elegido paciente en el Paso 1 (gatea "Siguiente").
  it('no invoca onSubmit si falta el paciente (validateFacturaForm bloquea)', async () => {
    const { onSubmit } = renderForm({ initial: valoresIniciales() });

    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), '');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/el paciente es obligatorio/i)).toBeInTheDocument();
  });

  // `tipoComprobante` no se precarga desde ninguna fuente (change `sacar-prestadores`, revierte
  // `factura-por-prestador`): arranca en el default provisorio (TIPO_COMPROBANTE_DEFAULT = 'A')
  // sin importar qué paciente se elija, y sigue editable a mano siempre. El campo vive en el
  // Paso 3 del wizard, no está en el DOM antes de llegar ahí.
  it('arranca en el default provisorio de tipo de comprobante, sigue editable a mano', async () => {
    renderForm();

    expect(screen.queryByLabelText(/tipo de comprobante/i)).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-martina');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    const tipoComprobante = screen.getByLabelText(/tipo de comprobante/i) as HTMLSelectElement;
    expect(tipoComprobante.value).toBe('A');

    await userEvent.selectOptions(tipoComprobante, 'B');
    expect(tipoComprobante.value).toBe('B');
  });

  it('el selector de domicilio se puebla con las direcciones del paciente seleccionado', async () => {
    renderForm();
    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-martina');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    expect(screen.getByRole('option', { name: /rivadavia 4500/i })).toBeInTheDocument();
  });

  it('envía el formulario con los valores cargados cuando pasa la validación', async () => {
    const { onSubmit } = renderForm();

    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-martina');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    await userEvent.type(screen.getByLabelText(/valor del km/i), '300');
    await userEvent.type(screen.getByLabelText(/cantidad de km/i), '10');
    await userEvent.clear(screen.getByLabelText(/cantidad de días/i));
    await userEvent.type(screen.getByLabelText(/cantidad de días/i), '5');

    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const values = onSubmit.mock.calls[0]?.[0] as Factura;
    expect(values.pacienteId).toBe('paciente-martina');
    expect(values.valorKm).toBe(300);
    expect(values.dias).toBe(5);
  });

  it('muestra la vista previa en vivo de la descripción mientras la factura está en a-facturar', async () => {
    renderForm({
      obrasSociales: [
        {
          ...osecac,
          plantillaFactura: {
            identificadorOrigen: 'paciente.numeroAfiliado',
            campos: [{ id: 'c-1', etiqueta: 'Prestación', origen: 'traslado.prestacion', orden: 0 }],
          },
        },
      ],
    });

    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-martina');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    const [campoPrestacion] = screen.getAllByLabelText(/^prestación$/i);
    if (!campoPrestacion) throw new Error('Debería existir el campo Prestación del formulario principal');
    await userEvent.type(campoPrestacion, 'Kinesiología');

    await waitFor(() => expect(screen.getByText(/prestación: kinesiología/i)).toBeInTheDocument());
  });

  // La vista previa ya no depende de ningún dato de prestador (change
  // `facturacion-seleccion-autorizacion`, design.md D5): arma apenas se completan los Pasos 1 y 2,
  // en las dos modalidades por igual, hasta que la sección 3 de ese change cablee el gateo real
  // por `autorizacionId`.
  it('la vista previa de la descripción arma apenas se completan los Pasos 1 y 2 (sin nada de prestador que completar)', async () => {
    renderForm({ pacientes: [martina, pacienteGeneral], obrasSociales: [osecac, obraSocialGeneral] });

    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-general');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    expect(await screen.findByText(/vista previa de la descripción/i)).toBeInTheDocument();
  });
});

// Wizard de 3 pasos (change `facturacion-wizard-paciente-prestador`, design.md): gateo de
// navegación entre pasos, conservación de valores con "Atrás" y el bypass de modo edición. El
// gateo de Paso 2→3 por datos de prestador (`faltaCompletarPrestador`) se retiró por completo
// junto con esos campos (change `facturacion-seleccion-autorizacion`, design.md D5) — el
// reemplazo por `!values.autorizacionId` es la sección 3 de ese change, todavía no cableada acá.
describe('FacturaForm — wizard de alta', () => {
  it('Paso 1→2: "Siguiente" está deshabilitado sin paciente elegido y se habilita al elegirlo', async () => {
    renderForm();

    const siguiente = screen.getByRole('button', { name: /siguiente/i });
    expect(siguiente).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-martina');
    expect(siguiente).toBeEnabled();
  });

  it('Paso 2→3: "Siguiente" está habilitado de entrada (sin gateo propio de prestador)', async () => {
    renderForm();
    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-martina');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    expect(screen.getByRole('button', { name: /siguiente/i })).toBeEnabled();
  });

  it('"Atrás" conserva los valores ya cargados al volver a un paso anterior', async () => {
    renderForm();

    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-martina');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    const [campoPrestacion] = screen.getAllByLabelText(/^prestación$/i);
    if (!campoPrestacion) throw new Error('Debería existir el campo Prestación del formulario principal');
    await userEvent.type(campoPrestacion, 'Kinesiología');

    // Paso 3 → Paso 2 → Paso 1: el paciente elegido sigue seleccionado.
    await userEvent.click(screen.getByRole('button', { name: /atrás/i }));
    await userEvent.click(screen.getByRole('button', { name: /atrás/i }));
    expect(screen.getByLabelText(/^paciente$/i)).toHaveValue('paciente-martina');

    // Vuelve a avanzar hasta el Paso 3: la prestación tipeada antes de "Atrás" sigue ahí.
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    const [campoPrestacionFinal] = screen.getAllByLabelText(/^prestación$/i);
    expect(campoPrestacionFinal).toHaveValue('Kinesiología');
  });

  it('en modo edición (initial con pacienteId) arranca directo en el Paso 3, con todo visible y sin navegación de pasos', () => {
    renderForm({ initial: valoresIniciales() });

    expect(screen.getByLabelText(/^paciente$/i)).toBeInTheDocument();
    expect(screen.getByText(/^obra social$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/valor del km/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();

    expect(screen.queryByRole('list', { name: /progreso del formulario/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^siguiente$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^atrás$/i })).not.toBeInTheDocument();
  });
});

// Gateo de escritura (gateo-facturacion, tasks.md 4.3/4.4, design.md D3), reorganizado para el
// wizard (change `facturacion-wizard-paciente-prestador`): cada paso gatea su propio contenido
// (antes era una sola inserción porque los dos bloques de campos vivían siempre montados juntos).
// Guardar declara `requiereEscritura`; Cancelar queda fuera del envoltorio y sigue operativo.
describe('FacturaForm — gateo de escritura', () => {
  // Modo edición: todo el formulario visible de una, el único lugar donde se puede verificar en
  // un solo render que el gateo cubre los pasos simultáneamente — en modo alta nunca están todos
  // a la vista al mismo tiempo.
  it('sin permiso de escritura (modo edición): ningún campo acepta entrada y Guardar no se puede activar', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderFormConPermiso(false, { initial: valoresIniciales() });

    // Paso 1 — Paciente
    expect(screen.getByLabelText(/^paciente$/i)).toBeDisabled();
    // Paso 3 — FacturaFormDatosBasicos
    expect(screen.getByLabelText(/^mes$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^año$/i)).toBeDisabled();
    // "Prestación" también existe como campo de alta dentro de AsistenciasEditor (gateo propio,
    // sección 5) — se toma el primero, que es el del bloque FacturaFormDatosBasicos.
    expect(screen.getAllByLabelText(/^prestación$/i)[0]).toBeDisabled();
    expect(screen.getByLabelText(/^domicilio$/i, { selector: 'select' })).toBeDisabled();
    expect(screen.getByLabelText(/dependencia y retorno/i)).toBeDisabled();
    // Paso 3 — FacturaFormEconomicos
    expect(screen.getByLabelText(/valor del km/i)).toBeDisabled();
    expect(screen.getByLabelText(/cantidad de km/i)).toBeDisabled();
    expect(screen.getByLabelText(/cantidad de días/i)).toBeDisabled();
    expect(screen.getByLabelText(/^total$/i)).toBeDisabled();
    expect(screen.getByLabelText(/tipo de comprobante/i)).toBeDisabled();

    const guardar = screen.getByRole('button', { name: /guardar/i });
    expect(guardar).toBeDisabled();
    await user.click(guardar);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('con permiso de escritura: los tres pasos aceptan entrada y se guarda (triangulación)', async () => {
    const { onSubmit } = renderFormConPermiso(true);

    expect(screen.getByLabelText(/^paciente$/i)).toBeEnabled();

    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-martina');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    expect(screen.getByLabelText(/valor del km/i)).toBeEnabled();
    await userEvent.type(screen.getByLabelText(/valor del km/i), '300');
    await userEvent.type(screen.getByLabelText(/cantidad de km/i), '10');
    await userEvent.clear(screen.getByLabelText(/cantidad de días/i));
    await userEvent.type(screen.getByLabelText(/cantidad de días/i), '5');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  // Consecuencia esperada de combinar el wizard con el gateo de escritura en el flujo de alta:
  // con el Paciente deshabilitado, `values.pacienteId` nunca puede setearse, así que "Siguiente"
  // queda deshabilitado (gateo de wizard, no del permiso) y el resto del formulario (Pasos 2 y 3,
  // incluido Guardar) nunca llega a montarse. Distinto del caso de edición de arriba, donde todo
  // el form ya está poblado y visible de entrada.
  it('sin permiso de escritura, en modo alta: el Paso 1 queda bloqueado y nunca se llega al resto del formulario', () => {
    renderFormConPermiso(false);

    expect(screen.getByLabelText(/^paciente$/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeDisabled();
    expect(screen.queryByLabelText(/valor del km/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
  });

  it('sin permiso de escritura (modo edición): Cancelar sigue activable y dispara onCancel', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderFormConPermiso(false, { initial: valoresIniciales() });

    const cancelar = screen.getByRole('button', { name: /cancelar/i });
    expect(cancelar).toBeEnabled();
    await user.click(cancelar);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
