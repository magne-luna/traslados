import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Paciente } from '../../shared/types/paciente';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Factura } from '../../shared/types/factura';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { FacturaForm } from './FacturaForm';

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
  plazoCobroDias: 90,
  tipoComprobante: 'A',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: 'documento',
  checklist: [],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

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
  it('no invoca onSubmit si falta el paciente (validateFacturaForm bloquea)', async () => {
    const { onSubmit } = renderForm();

    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/el paciente es obligatorio/i)).toBeInTheDocument();
  });

  it('precarga el tipo de comprobante desde la obra social del paciente seleccionado, editable', async () => {
    renderForm();

    await userEvent.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');

    const tipoComprobante = screen.getByLabelText(/tipo de comprobante/i) as HTMLSelectElement;
    await waitFor(() => expect(tipoComprobante.value).toBe('A'));

    await userEvent.selectOptions(tipoComprobante, 'B');
    expect(tipoComprobante.value).toBe('B');
  });

  it('el selector de domicilio se puebla con las direcciones del paciente seleccionado', async () => {
    renderForm();
    await userEvent.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');

    expect(screen.getByRole('option', { name: /rivadavia 4500/i })).toBeInTheDocument();
  });

  it('envía el formulario con los valores cargados cuando pasa la validación', async () => {
    const { onSubmit } = renderForm();

    await userEvent.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
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

    await userEvent.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    const [campoPrestacion] = screen.getAllByLabelText(/^prestación$/i);
    if (!campoPrestacion) throw new Error('Debería existir el campo Prestación del formulario principal');
    await userEvent.type(campoPrestacion, 'Kinesiología');

    await waitFor(() => expect(screen.getByText(/prestación: kinesiología/i)).toBeInTheDocument());
  });
});

// Gateo de escritura (gateo-facturacion, tasks.md 4.3/4.4, design.md D3). Una sola inserción del
// envoltorio en FacturaForm cubre los dos bloques de campos (FacturaFormDatosBasicos +
// FacturaFormEconomicos), que no reciben ninguna prop nueva. Guardar declara `requiereEscritura`;
// Cancelar queda fuera del envoltorio y sigue operativo.
describe('FacturaForm — gateo de escritura', () => {
  it('sin permiso de escritura: ningún campo de los dos bloques acepta entrada y Guardar no se puede activar', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderFormConPermiso(false);

    // FacturaFormDatosBasicos
    expect(screen.getByLabelText(/^paciente$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^mes$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^año$/i)).toBeDisabled();
    // "Prestación" también existe como campo de alta dentro de AsistenciasEditor (gateo propio,
    // sección 5) — se toma el primero, que es el del bloque FacturaFormDatosBasicos.
    expect(screen.getAllByLabelText(/^prestación$/i)[0]).toBeDisabled();
    expect(screen.getByLabelText(/^domicilio$/i)).toBeDisabled();
    expect(screen.getByLabelText(/dependencia y retorno/i)).toBeDisabled();
    // FacturaFormEconomicos
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

  it('con permiso de escritura: los dos bloques aceptan entrada y se guarda (triangulación)', async () => {
    const { onSubmit } = renderFormConPermiso(true);

    expect(screen.getByLabelText(/^paciente$/i)).toBeEnabled();
    expect(screen.getByLabelText(/valor del km/i)).toBeEnabled();

    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-martina');
    await userEvent.type(screen.getByLabelText(/valor del km/i), '300');
    await userEvent.type(screen.getByLabelText(/cantidad de km/i), '10');
    await userEvent.clear(screen.getByLabelText(/cantidad de días/i));
    await userEvent.type(screen.getByLabelText(/cantidad de días/i), '5');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('el envoltorio no cambió las firmas de FacturaFormDatosBasicos ni FacturaFormEconomicos: los dos archivos no reciben props nuevas', () => {
    // Verificado por lectura del diff (tasks.md 4.3) — comportamiento observable equivalente:
    // los campos de los dos bloques quedan inertes con una única fuente de verdad (el contexto).
    renderFormConPermiso(false);

    expect(screen.getByLabelText(/^paciente$/i)).toBeDisabled();
    expect(screen.getByLabelText(/valor del km/i)).toBeDisabled();
  });

  it('sin permiso de escritura: Cancelar sigue activable y dispara onCancel', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderFormConPermiso(false);

    const cancelar = screen.getByRole('button', { name: /cancelar/i });
    expect(cancelar).toBeEnabled();
    await user.click(cancelar);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
