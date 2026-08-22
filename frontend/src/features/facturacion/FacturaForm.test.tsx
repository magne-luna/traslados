import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Paciente } from '../../shared/types/paciente';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Factura } from '../../shared/types/factura';
import type {
  ActualizacionAutorizacion,
  ActualizacionPresupuesto,
  Autorizacion,
  NuevaAutorizacion,
  NuevoPresupuesto,
  Presupuesto,
} from '../../shared/types/presupuesto';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
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

// WU2 (decisión usuaria 2026-08-16, opción a): el bloque "Prestaciones:" del preview se arma con
// los nombres de las LÍNEAS del presupuesto de la autorización elegida (REAPERTURA #13) resueltas
// contra el catálogo del paciente — fixtures compartidas por los tests de descripción.
const prestacionKinesiologia = { id: 'prest-kine', pacienteId: 'paciente-general', nombre: 'Kinesiología', activa: true };
const prestacionFonoaudiologia = { id: 'prest-fono', pacienteId: 'paciente-general', nombre: 'Fonoaudiología', activa: true };
const lineaKinesiologia = { id: 'linea-1', prestacionId: 'prest-kine', monto: 9000, orden: 1 };
const lineaFonoaudiologia = { id: 'linea-2', prestacionId: 'prest-fono', monto: 4500, orden: 2 };

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

// Fakes tipados del insumo del Paso 2 (D3, tasks.md 2.6/3.1) — mismo patrón que
// `autorizacionesPendientes.test.ts`, sin red, cero `any`.
function presupuesto(overrides: Partial<Presupuesto> = {}): Presupuesto {
  return {
    id: 'presupuesto-default',
    pacienteId: 'paciente-martina',
    obraSocialId: 'osecac',
    monto: 45000,
    fechaEmision: '2026-03-01',
    ...overrides,
  };
}

function autorizacion(overrides: Partial<Autorizacion> = {}): Autorizacion {
  return {
    id: 'autorizacion-default',
    presupuestoId: 'presupuesto-default',
    estado: 'autorizada',
    ...overrides,
  };
}

function fakePresupuestoRepository(presupuestos: Presupuesto[]): PresupuestoRepository {
  return {
    list: () => Promise.resolve(presupuestos),
    getById: (id: string) => Promise.resolve(presupuestos.find((p) => p.id === id) ?? null),
    create: (_data: NuevoPresupuesto) => Promise.reject(new Error('no usado en este test')),
    createLote: (_nuevos: NuevoPresupuesto[]) => Promise.reject(new Error('no usado en este test')),
    update: (_id: string, _data: ActualizacionPresupuesto) => Promise.reject(new Error('no usado en este test')),
  };
}

function fakeAutorizacionRepository(autorizacionesPorPresupuesto: Map<string, Autorizacion>): AutorizacionRepository {
  const todas = [...autorizacionesPorPresupuesto.values()];
  return {
    list: () => Promise.resolve(todas),
    getById: (id: string) => Promise.resolve(todas.find((a) => a.id === id) ?? null),
    getByPresupuestoId: (presupuestoId: string) => Promise.resolve(autorizacionesPorPresupuesto.get(presupuestoId) ?? null),
    create: (_data: NuevaAutorizacion) => Promise.reject(new Error('no usado en este test')),
    update: (_id: string, _data: ActualizacionAutorizacion) => Promise.reject(new Error('no usado en este test')),
    uploadArchivo: (_id: string, _file: File) => Promise.reject(new Error('no usado en este test')),
    removeArchivo: (_id: string) => Promise.reject(new Error('no usado en este test')),
    getUrlArchivo: (_id: string, _modo: 'inline' | 'descarga') => Promise.reject(new Error('no usado en este test')),
  };
}

// Default: una única autorización "autorizada" por cada paciente usado en estos tests, para no
// tener que especificar repositories en cada test que solo necesita atravesar el wizard.
function repositoriosPorDefecto() {
  const presupuestos = [
    presupuesto({ id: 'presupuesto-martina', pacienteId: 'paciente-martina' }),
    presupuesto({ id: 'presupuesto-general', pacienteId: 'paciente-general' }),
  ];
  const autorizaciones = new Map<string, Autorizacion>([
    ['presupuesto-martina', autorizacion({ id: 'autorizacion-martina', presupuestoId: 'presupuesto-martina' })],
    ['presupuesto-general', autorizacion({ id: 'autorizacion-general', presupuestoId: 'presupuesto-general' })],
  ]);
  return {
    presupuestoRepository: fakePresupuestoRepository(presupuestos),
    autorizacionRepository: fakeAutorizacionRepository(autorizaciones),
  };
}

function renderForm(overrides: Partial<React.ComponentProps<typeof FacturaForm>> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const { presupuestoRepository, autorizacionRepository } = repositoriosPorDefecto();
  render(
    <FacturaForm
      pacientes={[martina]}
      obrasSociales={[osecac]}
      facturasExistentes={[]}
      facturaIdEnEdicion={null}
      feriados={[]}
      presupuestoRepository={presupuestoRepository}
      autorizacionRepository={autorizacionRepository}
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
  const { presupuestoRepository, autorizacionRepository } = repositoriosPorDefecto();
  render(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
      <FacturaForm
        pacientes={[martina]}
        obrasSociales={[osecac]}
        facturasExistentes={[]}
        facturaIdEnEdicion={null}
        feriados={[]}
        presupuestoRepository={presupuestoRepository}
        autorizacionRepository={autorizacionRepository}
        resolverCupoAutorizado={vi.fn().mockResolvedValue(undefined)}
        onSubmit={onSubmit}
        onCancel={onCancel}
        {...overrides}
      />
    </PuedeEscribirContext.Provider>,
  );
  return { onSubmit, onCancel };
}

// Selecciona la primera opción real (no el placeholder "Seleccionar autorización…") del selector
// del Paso 2 — helper compartido por los tests que necesitan atravesar el wizard completo.
async function elegirPrimeraAutorizacion() {
  const select = await screen.findByLabelText(/^autorización$/i);
  const opciones = within(select).getAllByRole('option') as HTMLOptionElement[];
  const primera = opciones.find((o) => o.value !== '');
  if (!primera) throw new Error('Debería existir al menos una opción de autorización');
  await userEvent.selectOptions(select, primera.value);
}

// Atraviesa Paso 1 (elegir paciente) → Paso 2 (elegir la primera autorización pendiente, D4) →
// Paso 3, con los repositories por defecto de `renderForm`/`renderFormConPermiso` (una
// autorización "autorizada" por paciente). Reemplaza al doble click de "Siguiente" sin selección
// que usaban estos tests antes de D4 (ahora bloqueado, tasks.md 3.3).
async function avanzarHastaPaso3(pacienteId: string) {
  await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), pacienteId);
  await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
  await elegirPrimeraAutorizacion();
  await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
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

  // WU2 de `facturacion-cambios-ui` (2026-08-16): el campo "Tipo de comprobante" del Paso 3 ya NO
  // existe — la factura NUEVA lo precarga automáticamente al guardar desde la obra social cuando
  // está configurado (RF-306, `sacar-prestadores`), y en edición se respeta el valor ya guardado.
  it('no existe el campo "Tipo de comprobante"; al guardar una factura nueva se envía el default', async () => {
    const { onSubmit } = renderForm();

    await avanzarHastaPaso3('paciente-martina');

    expect(screen.queryByLabelText(/tipo de comprobante/i)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/valor del km/i), '300');
    await userEvent.type(screen.getByLabelText(/cantidad de km/i), '10');
    await userEvent.clear(screen.getByLabelText(/cantidad de días/i));
    await userEvent.type(screen.getByLabelText(/cantidad de días/i), '5');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const values = onSubmit.mock.calls[0]?.[0] as Factura;
    expect(values.tipoComprobante).toBe('A');
  }, 15_000);

  it('con tipoComprobante configurado en la obra social: al guardar una factura nueva se precarga ese valor, sin campo visible', async () => {
    const { onSubmit } = renderForm({ obrasSociales: [{ ...osecac, tipoComprobante: 'B' }] });

    await avanzarHastaPaso3('paciente-martina');

    expect(screen.queryByLabelText(/tipo de comprobante/i)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/valor del km/i), '300');
    await userEvent.type(screen.getByLabelText(/cantidad de km/i), '10');
    await userEvent.clear(screen.getByLabelText(/cantidad de días/i));
    await userEvent.type(screen.getByLabelText(/cantidad de días/i), '5');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const values = onSubmit.mock.calls[0]?.[0] as Factura;
    expect(values.tipoComprobante).toBe('B');
  }, 15_000);

  it('en modo edición se respeta el tipo de comprobante ya guardado (sin campo visible)', async () => {
    const { onSubmit } = renderForm({
      initial: valoresIniciales({ tipoComprobante: 'C', monto: 1000, dias: 5, valorKm: 200, cantidadKm: 5 }),
    });

    expect(screen.queryByLabelText(/tipo de comprobante/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const values = onSubmit.mock.calls[0]?.[0] as Factura;
    expect(values.tipoComprobante).toBe('C');
  });

  it('el selector de domicilio se puebla con las direcciones del paciente seleccionado', async () => {
    renderForm();
    await avanzarHastaPaso3('paciente-martina');

    expect(screen.getByRole('option', { name: /rivadavia 4500/i })).toBeInTheDocument();
  });

  it('envía el formulario con los valores cargados cuando pasa la validación', async () => {
    const { onSubmit } = renderForm();

    await avanzarHastaPaso3('paciente-martina');

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
    // Payload incluye la autorización elegida en el Paso 2 (D6, tasks.md 3.5/3.6).
    expect(values.autorizacionId).toBe('autorizacion-martina');
  });

  // WU2 (2026-08-16): el campo "Prestación" del formulario ya no existe — en modalidad
  // `por-prestacion` la prestación deriva sola desde la autorización elegida (mismo criterio que
  // `prestacionRealAutorizacion`) y el preview en vivo la muestra igual que antes.
  it('muestra la vista previa en vivo de la descripción con la prestación derivada, sin campo Prestación', async () => {
    const pacienteConPrestaciones: Paciente = {
      ...martina,
      prestaciones: [{ id: 'prest-kine', pacienteId: 'paciente-martina', nombre: 'Kinesiología', activa: true }],
    };
    const presupuestos = [
      presupuesto({ id: 'presupuesto-kine', pacienteId: 'paciente-martina', prestacionId: 'prest-kine' }),
    ];
    const autorizaciones = new Map([
      ['presupuesto-kine', autorizacion({ id: 'autorizacion-kine', presupuestoId: 'presupuesto-kine' })],
    ]);
    renderForm({
      pacientes: [pacienteConPrestaciones],
      obrasSociales: [
        {
          ...osecac,
          plantillaFactura: {
            identificadorOrigen: 'paciente.numeroAfiliado',
            campos: [{ id: 'c-1', etiqueta: 'Prestación', origen: 'traslado.prestacion', orden: 0 }],
          },
        },
      ],
      presupuestoRepository: fakePresupuestoRepository(presupuestos),
      autorizacionRepository: fakeAutorizacionRepository(autorizaciones),
    });

    await avanzarHastaPaso3('paciente-martina');

    expect(screen.queryByLabelText(/^prestación$/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/prestación: kinesiología/i)).toBeInTheDocument());
  });

  // La vista previa ya no depende de ningún dato de prestador (change
  // `facturacion-seleccion-autorizacion`, design.md D5): arma apenas se completan los Pasos 1 y 2,
  // en las dos modalidades por igual.
  it('la vista previa de la descripción arma apenas se completan los Pasos 1 y 2 (sin nada de prestador que completar)', async () => {
    renderForm({ pacientes: [martina, pacienteGeneral], obrasSociales: [osecac, obraSocialGeneral] });

    await avanzarHastaPaso3('paciente-general');

    expect(await screen.findByText(/vista previa de la descripción/i)).toBeInTheDocument();
  });

  // WU2 (decisión usuaria 2026-08-16, opción a): modalidad `general` → el preview agrega el
  // bloque "Prestaciones:" con los nombres de las LÍNEAS del presupuesto de la autorización
  // elegida (REAPERTURA #13), resueltas client-side contra el catálogo del paciente.
  it('modalidad general: el preview muestra "Prestaciones:" con las líneas del presupuesto de la autorización elegida', async () => {
    renderForm({
      pacientes: [{ ...pacienteGeneral, prestaciones: [prestacionKinesiologia, prestacionFonoaudiologia] }],
      obrasSociales: [osecac, obraSocialGeneral],
      presupuestoRepository: fakePresupuestoRepository([
        presupuesto({
          id: 'presupuesto-general',
          pacienteId: 'paciente-general',
          lineas: [lineaKinesiologia, lineaFonoaudiologia],
        }),
      ]),
      autorizacionRepository: fakeAutorizacionRepository(
        new Map([['presupuesto-general', autorizacion({ id: 'autorizacion-general', presupuestoId: 'presupuesto-general' })]]),
      ),
    });

    await avanzarHastaPaso3('paciente-general');

    await waitFor(() =>
      expect(screen.getByText(/prestaciones: kinesiología, fonoaudiología/i)).toBeInTheDocument(),
    );
  }, 15_000);

  it('el bloque "Prestaciones:" es reactivo: cambia al cambiar de autorización en el Paso 2', async () => {
    renderForm({
      pacientes: [{ ...pacienteGeneral, prestaciones: [prestacionKinesiologia, prestacionFonoaudiologia] }],
      obrasSociales: [osecac, obraSocialGeneral],
      presupuestoRepository: fakePresupuestoRepository([
        presupuesto({ id: 'presupuesto-general-a', pacienteId: 'paciente-general', lineas: [lineaKinesiologia] }),
        presupuesto({
          id: 'presupuesto-general-b',
          pacienteId: 'paciente-general',
          lineas: [lineaKinesiologia, lineaFonoaudiologia],
        }),
      ]),
      autorizacionRepository: fakeAutorizacionRepository(
        new Map([
          ['presupuesto-general-a', autorizacion({ id: 'autorizacion-general-a', presupuestoId: 'presupuesto-general-a' })],
          ['presupuesto-general-b', autorizacion({ id: 'autorizacion-general-b', presupuestoId: 'presupuesto-general-b' })],
        ]),
      ),
    });

    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-general');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await userEvent.selectOptions(await screen.findByLabelText(/^autorización$/i), 'autorizacion-general-a');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    await waitFor(() => expect(screen.getByText(/prestaciones: kinesiología$/i)).toBeInTheDocument());
    expect(screen.queryByText(/fonoaudiología/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /atrás/i }));
    await userEvent.selectOptions(screen.getByLabelText(/^autorización$/i), 'autorizacion-general-b');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    await waitFor(() =>
      expect(screen.getByText(/prestaciones: kinesiología, fonoaudiología/i)).toBeInTheDocument(),
    );
  }, 15_000);

  // Presupuestos anteriores a la REAPERTURA #13: `presupuesto.lineas` no existe (o está vacío) →
  // el bloque NO se muestra, aunque el paciente tenga catálogo — la factura no adivina.
  it('autorización cuyo presupuesto es legacy sin líneas: no se muestra el bloque "Prestaciones:"', async () => {
    renderForm({
      pacientes: [{ ...pacienteGeneral, prestaciones: [prestacionKinesiologia, prestacionFonoaudiologia] }],
      obrasSociales: [osecac, obraSocialGeneral],
    });

    await avanzarHastaPaso3('paciente-general');

    await screen.findByText(/vista previa de la descripción/i);
    expect(screen.queryByText(/prestaciones:/i)).not.toBeInTheDocument();
  }, 15_000);

  // WU2 (2026-08-16): la tarjeta "Asistencias / prestaciones declaradas" (AsistenciasEditor) se
  // elimina del Paso 3 — el tipo `asistencias` sigue en el dominio (mapeos de presentación), la
  // UI ya no la expone. Modo edición: todo el formulario visible de una, el único lugar donde se
  // puede verificar que la tarjeta no existe sin atravesar el wizard.
  it('la tarjeta de asistencias ya no se muestra (modo edición, todo visible)', () => {
    renderForm({ initial: valoresIniciales() });

    expect(screen.queryByText(/asistencias \/ prestaciones declaradas/i)).not.toBeInTheDocument();
  });
});

// Wizard de 3 pasos (change `facturacion-wizard-paciente-prestador`, design.md): gateo de
// navegación entre pasos, conservación de valores con "Atrás" y el bypass de modo edición. El
// gateo de Paso 2→3 por datos de prestador (`faltaCompletarPrestador`) se retiró por completo
// junto con esos campos y lo reemplaza `!values.autorizacionId` (change
// `facturacion-seleccion-autorizacion`, design.md D4, tasks.md 3.3).
describe('FacturaForm — wizard de alta', () => {
  it('Paso 1→2: "Siguiente" está deshabilitado sin paciente elegido y se habilita al elegirlo', async () => {
    renderForm();

    const siguiente = screen.getByRole('button', { name: /siguiente/i });
    expect(siguiente).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-martina');
    expect(siguiente).toBeEnabled();
  });

  it('Paso 2→3: "Siguiente" queda deshabilitado hasta elegir una autorización y se habilita al elegirla (D4)', async () => {
    renderForm();
    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-martina');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    const siguiente = screen.getByRole('button', { name: /siguiente/i });
    // Recién llegado al Paso 2, la lista todavía puede estar resolviéndose — siempre bloqueado
    // hasta que haya una autorización elegida.
    expect(siguiente).toBeDisabled();

    await elegirPrimeraAutorizacion();
    expect(siguiente).toBeEnabled();
  });

  // Estado vacío (D4, tasks.md 3.3): sin autorizaciones pendientes, "Siguiente" queda bloqueado y
  // aparece el mensaje con link a Presupuestos — mismo patrón que `PresupuestoForm` usa para "sin
  // prestaciones activas".
  it('Paso 2, estado vacío: sin autorizaciones pendientes bloquea "Siguiente" y muestra el link a Presupuestos', async () => {
    renderForm({
      presupuestoRepository: fakePresupuestoRepository([]),
      autorizacionRepository: fakeAutorizacionRepository(new Map()),
    });
    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-martina');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    expect(await screen.findByText(/no tiene autorizaciones pendientes de facturar/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir a presupuestos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeDisabled();
  });

  // Varias autorizaciones simultáneas del mismo paciente en `por-prestacion` (D4, D6, tasks.md
  // 3.2/3.7): el selector las lista todas, distinguidas por el nombre real de la prestación
  // (`presupuesto.prestacionId` → `paciente.prestaciones`, hallazgo de esta sesión — ya no hace
  // falta el fallback de `design.md` porque el campo existe en esta rama).
  it('Paso 2, varias autorizaciones simultáneas: el selector las distingue por el nombre real de la prestación', async () => {
    const pacienteConPrestaciones: Paciente = {
      ...martina,
      prestaciones: [
        { id: 'prestacion-kine', pacienteId: 'paciente-martina', nombre: 'Kinesiología', activa: true },
        { id: 'prestacion-fono', pacienteId: 'paciente-martina', nombre: 'Fonoaudiología', activa: true },
      ],
    };
    const presupuestos = [
      presupuesto({ id: 'presupuesto-kine', pacienteId: 'paciente-martina', prestacionId: 'prestacion-kine' }),
      presupuesto({ id: 'presupuesto-fono', pacienteId: 'paciente-martina', prestacionId: 'prestacion-fono' }),
    ];
    const autorizaciones = new Map([
      ['presupuesto-kine', autorizacion({ id: 'autorizacion-kine', presupuestoId: 'presupuesto-kine' })],
      ['presupuesto-fono', autorizacion({ id: 'autorizacion-fono', presupuestoId: 'presupuesto-fono' })],
    ]);

    renderForm({
      pacientes: [pacienteConPrestaciones],
      presupuestoRepository: fakePresupuestoRepository(presupuestos),
      autorizacionRepository: fakeAutorizacionRepository(autorizaciones),
    });
    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-martina');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    const select = await screen.findByLabelText(/^autorización$/i);
    expect(within(select).getByRole('option', { name: 'Kinesiología' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Fonoaudiología' })).toBeInTheDocument();
  });

  it('"Atrás" conserva los valores ya cargados al volver a un paso anterior', async () => {
    renderForm();

    await avanzarHastaPaso3('paciente-martina');

    await userEvent.type(screen.getByLabelText(/valor del km/i), '300');

    // Paso 3 → Paso 2 → Paso 1: el paciente elegido sigue seleccionado.
    await userEvent.click(screen.getByRole('button', { name: /atrás/i }));
    await userEvent.click(screen.getByRole('button', { name: /atrás/i }));
    expect(screen.getByLabelText(/^paciente$/i)).toHaveValue('paciente-martina');

    // Vuelve a avanzar hasta el Paso 3: la autorización elegida y el valor ya cargado siguen
    // ahí — "Siguiente" ya está habilitado sin volver a elegir (D4).
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(screen.getByLabelText(/valor del km/i)).toHaveValue(300);
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

  // Modo edición (D4): la autorización ya persistida se muestra de solo lectura — no aparece
  // ningún `<select>` para recambiarla, mismo criterio que "la edición no bifurca" ya usado en
  // Presupuestos.
  it('en modo edición, la autorización ya elegida se muestra de solo lectura y no se puede recambiar', async () => {
    renderForm({ initial: valoresIniciales({ autorizacionId: 'autorizacion-martina' }) });

    // Fallback de `etiquetaAutorizacion` (martina no tiene `prestaciones` cargadas): fecha +
    // monto del presupuesto por defecto de `repositoriosPorDefecto`. Aparece dos veces (Paso 2 y
    // `ResumenPasoWizard`), nunca como control editable.
    await waitFor(() => expect(screen.getAllByText(/presupuesto del 2026-03-01/i).length).toBeGreaterThan(0));
    expect(screen.queryByLabelText(/^autorización$/i)).not.toBeInTheDocument();
  });
});

// WU2 de `facturacion-cambios-ui` (decisión usuaria 2026-08-16): el campo "Prestación" del Paso 3
// desaparece del formulario. La prestación se deriva desde la autorización elegida solo a nivel de
// datos (change `facturacion-derivar-prestacion`, mismo criterio que `prestacionRealAutorizacion`):
// modalidad `por-prestacion` → `values.prestacion` se prellena y el preview la muestra como
// "Prestación: …"; modalidad `general` → el preview muestra el bloque "Prestaciones:" con las
// líneas del presupuesto de la autorización (WU2, opción a).
describe('FacturaForm — prestación de la descripción sin campo visible (WU2)', () => {
  const pacienteConPrestaciones: Paciente = {
    ...martina,
    prestaciones: [{ id: 'prest-kine', pacienteId: 'paciente-martina', nombre: 'Kinesiología', activa: true }],
  };

  function repositoriosConPrestacion() {
    const presupuestos = [
      presupuesto({ id: 'presupuesto-kine', pacienteId: 'paciente-martina', prestacionId: 'prest-kine' }),
    ];
    const autorizaciones = new Map([
      ['presupuesto-kine', autorizacion({ id: 'autorizacion-kine', presupuestoId: 'presupuesto-kine' })],
    ]);
    return {
      presupuestoRepository: fakePresupuestoRepository(presupuestos),
      autorizacionRepository: fakeAutorizacionRepository(autorizaciones),
    };
  }

  function osecacConPlantillaPrestacion(): ObraSocial {
    return {
      ...osecac,
      plantillaFactura: {
        identificadorOrigen: 'paciente.numeroAfiliado',
        campos: [{ id: 'c-1', etiqueta: 'Prestación', origen: 'traslado.prestacion', orden: 0 }],
      },
    };
  }

  it('por-prestacion con prestación real: no hay campo; la derivada se muestra en el preview y viaja en el submit', async () => {
    const { presupuestoRepository, autorizacionRepository } = repositoriosConPrestacion();
    const { onSubmit } = renderForm({
      pacientes: [pacienteConPrestaciones],
      obrasSociales: [osecacConPlantillaPrestacion()],
      presupuestoRepository,
      autorizacionRepository,
    });

    await avanzarHastaPaso3('paciente-martina');

    expect(screen.queryByLabelText(/^prestación$/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/prestación: kinesiología/i)).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/valor del km/i), '300');
    await userEvent.type(screen.getByLabelText(/cantidad de km/i), '10');
    await userEvent.clear(screen.getByLabelText(/cantidad de días/i));
    await userEvent.type(screen.getByLabelText(/cantidad de días/i), '5');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const values = onSubmit.mock.calls[0]?.[0] as Factura;
    expect(values.prestacion).toBe('Kinesiología');
  }, 15_000);

  it('sin prestación real derivable (catálogo desactualizado): preview sin bloque "Prestaciones:"', async () => {
    renderForm({
      obrasSociales: [
        {
          ...osecac,
          plantillaFactura: {
            identificadorOrigen: 'paciente.numeroAfiliado',
            campos: [{ id: 'c-per', etiqueta: 'Período', origen: 'traslado.mesYAnio', orden: 0 }],
          },
        },
      ],
    });

    await avanzarHastaPaso3('paciente-martina');

    await screen.findByText(/vista previa de la descripción/i);
    expect(screen.queryByText(/prestaciones:/i)).not.toBeInTheDocument();
  }, 15_000);

  it('edición de una factura ya guardada: la descripción respeta la prestación persistida sin campo editable', async () => {
    const { presupuestoRepository, autorizacionRepository } = repositoriosConPrestacion();
    renderForm({
      pacientes: [pacienteConPrestaciones],
      obrasSociales: [osecacConPlantillaPrestacion()],
      presupuestoRepository,
      autorizacionRepository,
      initial: valoresIniciales({ autorizacionId: 'autorizacion-kine', prestacion: 'Kinesiología' }),
    });

    expect(screen.queryByLabelText(/^prestación$/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/prestación: kinesiología/i)).toBeInTheDocument());
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
    // WU2 (2026-08-16): el campo "Prestación" del Paso 3 ya no existe — no hay campo que gatear.
    expect(screen.queryByLabelText(/^prestación$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^domicilio$/i, { selector: 'select' })).toBeDisabled();
    expect(screen.getByLabelText(/dependencia y retorno/i)).toBeDisabled();
    // Paso 3 — FacturaFormEconomicos
    expect(screen.getByLabelText(/valor del km/i)).toBeDisabled();
    expect(screen.getByLabelText(/cantidad de km/i)).toBeDisabled();
    expect(screen.getByLabelText(/cantidad de días/i)).toBeDisabled();
    expect(screen.getByLabelText(/^total$/i)).toBeDisabled();
    // WU2 (2026-08-16): el campo "Tipo de comprobante" ya no existe — no hay campo que gatear.
    expect(screen.queryByLabelText(/tipo de comprobante/i)).not.toBeInTheDocument();

    const guardar = screen.getByRole('button', { name: /guardar/i });
    expect(guardar).toBeDisabled();
    await user.click(guardar);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('con permiso de escritura: los tres pasos aceptan entrada y se guarda (triangulación)', async () => {
    const { onSubmit } = renderFormConPermiso(true);

    expect(screen.getByLabelText(/^paciente$/i)).toBeEnabled();

    await avanzarHastaPaso3('paciente-martina');

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
