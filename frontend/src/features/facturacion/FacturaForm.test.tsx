import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Paciente } from '../../shared/types/paciente';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Factura } from '../../shared/types/factura';
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
  numeroAfiliado: { formato: 'numero-documento', valor: '45123456' },
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
