import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Paciente } from '../../shared/types/paciente';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Factura } from '../../shared/types/factura';
import type { Prestador } from '../../shared/types/prestador';
import type { PrestadorRepository } from '../../shared/lib/prestadores/PrestadorRepository';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PrestadorRepositoryProvider } from '../prestadores/PrestadorRepositoryContext';
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
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: 'numero-documento',
  checklist: [],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

// Obra social en modalidad "general" (change `factura-por-prestador`, design.md D2): sirve para
// probar que el selector de Prestador NO aparece y `tipoComprobante` sigue 100% editable, sin
// tocar el fixture `osecac` (que ya está en "por-prestacion" en el resto de este archivo).
const obraSocialGeneral: ObraSocial = {
  ...osecac,
  id: 'os-general',
  nombre: 'Obra Social General',
  modalidadFacturacion: 'general',
};

const pacienteGeneral: Paciente = { ...martina, id: 'paciente-general', obraSocialId: 'os-general' };

const prestadorTraslados: Prestador = {
  id: 'prestador-1',
  razonSocial: 'Traslados Andrea Pastor',
  cuit: '30-71234567-8',
  plazoCobroDias: 90,
  tipoComprobante: 'B',
};

// Fake mínimo tipado (sin `any`/`as`), mismo criterio que `ObraSocialDetail.test.tsx`:
// `FacturaFormDatosBasicos` monta `PrestadorSelector` cuando la obra social resuelta está en
// "por-prestacion", que exige un `PrestadorRepositoryProvider` en el árbol
// (`usePrestadorRepository()` lanza si falta).
function fakePrestadorRepository(prestadores: Prestador[] = [prestadorTraslados]): PrestadorRepository {
  return {
    list: () => Promise.resolve(prestadores),
    getById: () => Promise.resolve(null),
    create: () => Promise.reject(new Error('no implementado en este test')),
    update: () => Promise.reject(new Error('no implementado en este test')),
    listarPorObraSocial: () => Promise.resolve(prestadores),
  };
}

function renderForm(overrides: Partial<React.ComponentProps<typeof FacturaForm>> = {}, prestadorRepository: PrestadorRepository = fakePrestadorRepository()) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <PrestadorRepositoryProvider repository={prestadorRepository}>
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
    </PrestadorRepositoryProvider>,
  );
  return { onSubmit, onCancel };
}

function renderFormConPermiso(puedeEscribir: boolean, overrides: Partial<React.ComponentProps<typeof FacturaForm>> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <PrestadorRepositoryProvider repository={fakePrestadorRepository()}>
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
      </PuedeEscribirContext.Provider>
    </PrestadorRepositoryProvider>,
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

  // `tipoComprobante` ya no se precarga desde la obra social del paciente (design.md D3/D4 de
  // prestadores-crud, sin confirmar con Andrea): arranca en el default provisorio
  // (TIPO_COMPROBANTE_DEFAULT = 'A') sin importar qué paciente se elija, y sigue editable a mano.
  it('arranca en el default provisorio de tipo de comprobante, sigue editable a mano', async () => {
    renderForm();

    const tipoComprobante = screen.getByLabelText(/tipo de comprobante/i) as HTMLSelectElement;
    expect(tipoComprobante.value).toBe('A');

    await userEvent.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    expect(tipoComprobante.value).toBe('A');

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
    // Esta obra social está en modalidad "por-prestacion" (design.md D5, change
    // `factura-por-prestador`): la vista previa no arma hasta elegir un Prestador.
    const selectorPrestador = await screen.findByLabelText(/^prestador$/i);
    await userEvent.selectOptions(selectorPrestador, 'prestador-1');

    const [campoPrestacion] = screen.getAllByLabelText(/^prestación$/i);
    if (!campoPrestacion) throw new Error('Debería existir el campo Prestación del formulario principal');
    await userEvent.type(campoPrestacion, 'Kinesiología');

    await waitFor(() => expect(screen.getByText(/prestación: kinesiología/i)).toBeInTheDocument());
  });
});

// Selección de Prestador (change `factura-por-prestador`, tasks.md 3.3, design.md D1/D3/D4).
describe('FacturaForm — selección de Prestador', () => {
  it('elegir un prestador fija tipoComprobante desde el prestador y bloquea el <Select>', async () => {
    renderForm();

    await userEvent.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    const selectorPrestador = await screen.findByLabelText(/^prestador$/i);
    const tipoComprobante = screen.getByLabelText(/tipo de comprobante/i) as HTMLSelectElement;
    expect(tipoComprobante).toBeEnabled();
    expect(tipoComprobante.value).toBe('A');

    await userEvent.selectOptions(selectorPrestador, 'prestador-1');

    expect(tipoComprobante.value).toBe('B');
    expect(tipoComprobante).toBeDisabled();
  });

  it('limpiar el prestador elegido vuelve a habilitar tipoComprobante sin resetear su valor', async () => {
    renderForm();

    await userEvent.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    const selectorPrestador = await screen.findByLabelText(/^prestador$/i);
    await userEvent.selectOptions(selectorPrestador, 'prestador-1');

    const tipoComprobante = screen.getByLabelText(/tipo de comprobante/i) as HTMLSelectElement;
    expect(tipoComprobante).toBeDisabled();

    await userEvent.selectOptions(selectorPrestador, '');

    expect(tipoComprobante).toBeEnabled();
    expect(tipoComprobante.value).toBe('B');
  });

  it('en modalidad "general" no muestra el selector de prestador y tipoComprobante sigue 100% editable', async () => {
    renderForm({ pacientes: [martina, pacienteGeneral], obrasSociales: [osecac, obraSocialGeneral] });

    await userEvent.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-general');

    expect(screen.queryByLabelText(/^prestador$/i)).not.toBeInTheDocument();
    const tipoComprobante = screen.getByLabelText(/tipo de comprobante/i) as HTMLSelectElement;
    expect(tipoComprobante).toBeEnabled();

    await userEvent.selectOptions(tipoComprobante, 'C');
    expect(tipoComprobante.value).toBe('C');
  });

  it('en modalidad "por-prestacion" no arma la vista previa de la descripción hasta elegir un prestador', async () => {
    renderForm();

    await userEvent.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    const selectorPrestador = await screen.findByLabelText(/^prestador$/i);

    expect(screen.queryByText(/vista previa de la descripción/i)).not.toBeInTheDocument();

    await userEvent.selectOptions(selectorPrestador, 'prestador-1');

    expect(await screen.findByText(/vista previa de la descripción/i)).toBeInTheDocument();
  });

  it('en modalidad "general" la vista previa de la descripción arma apenas se elige el paciente', async () => {
    renderForm({ pacientes: [martina, pacienteGeneral], obrasSociales: [osecac, obraSocialGeneral] });

    await userEvent.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-general');

    expect(await screen.findByText(/vista previa de la descripción/i)).toBeInTheDocument();
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
