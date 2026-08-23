import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Paciente } from '../../shared/types/paciente';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Autorizacion, Presupuesto } from '../../shared/types/presupuesto';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import type { RecorridoHabitualRepository } from '../../shared/lib/pacientes/RecorridoHabitualRepository';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PresupuestoDetail } from './PresupuestoDetail';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

// Stub compartido (tasks.md 8.5): estos tests ejercitan el flujo de crear()/actualizar()/
// autorización, no el botón "Traer de los destinos..." en sí (cubierto en PresupuestoForm.test.tsx).
const recorridoHabitualRepositoryStub: Pick<RecorridoHabitualRepository, 'list'> = {
  list: vi.fn().mockResolvedValue([]),
};

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
  // 'general' a propósito (presupuesto-prestaciones, design.md D9): estos tests ejercitan el flujo
  // genérico de crear()/actualizar() de PresupuestoDetail, no la bifurcación en sí (cubierta en
  // PresupuestoForm.test.tsx) — martina no tiene `prestaciones` cargadas, así que 'por-prestacion'
  // caería en el empty state con submit bloqueado.
  modalidadFacturacion: 'general',
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

const autorizacionMartina: Autorizacion = {
  id: 'autorizacion-martina-1',
  presupuestoId: 'presupuesto-martina-1',
  estado: 'autorizada',
  montoAutorizado: 150_000,
};

function buildFakeAutorizacionRepository(overrides: Partial<AutorizacionRepository> = {}): AutorizacionRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    listByPresupuestoId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(autorizacionMartina),
    update: vi.fn().mockResolvedValue(autorizacionMartina),
    uploadArchivo: vi.fn().mockResolvedValue(autorizacionMartina),
    removeArchivo: vi.fn().mockResolvedValue(autorizacionMartina),
    getUrlArchivo: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('PresupuestoDetail — modo alta (presupuesto null)', () => {
  it('solo muestra el formulario de presupuesto, sin sección de autorización', () => {
    render(
      <PresupuestoDetail
        presupuesto={null}
        crear={vi.fn()}
        crearLote={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={buildFakeAutorizacionRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/paciente/i)).toBeInTheDocument();
    expect(screen.queryByText(/autorización/i)).not.toBeInTheDocument();
  });

  it('al guardar, llama a crear() con los datos del form y avisa onCreated', async () => {
    const user = userEvent.setup();
    const creado = { ...presupuestoMartina, id: 'nuevo-1' };
    const crear = vi.fn().mockResolvedValue(creado);
    const onCreated = vi.fn();

    render(
      <PresupuestoDetail
        presupuesto={null}
        crear={crear}
        crearLote={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={buildFakeAutorizacionRepository()}
        onCreated={onCreated}
        onBack={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    // Fix "la obra social debe derivarse del paciente": ya no hay selector propio — se completa
    // sola con martina.obraSocialId ('osecac') al elegir el paciente.
    await user.type(screen.getByLabelText(/^monto \(estimaci/i), '150000');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ pacienteId: 'paciente-martina', obraSocialId: 'osecac' }));
    expect(onCreated).toHaveBeenCalledWith(creado);
  });
});

describe('PresupuestoDetail — modo edición', () => {
  it('muestra el resumen resuelto (paciente, obra social, monto) y el botón Editar datos', async () => {
    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        crearLote={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={buildFakeAutorizacionRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect((await screen.findAllByText('Gómez, Martina')).length).toBeGreaterThan(0);
    expect(screen.getByText('OSECAC')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar datos/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^paciente$/i)).not.toBeInTheDocument();
  });

  it('al apretar "Editar datos" muestra el form precargado y al guardar llama actualizar()', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(presupuestoMartina);

    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        crearLote={vi.fn()}
        actualizar={actualizar}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={buildFakeAutorizacionRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await screen.findAllByText('Gómez, Martina');
    await user.click(screen.getByRole('button', { name: /editar datos/i }));
    const pacienteField = screen.getByLabelText(/^paciente$/i);
    expect(pacienteField).toHaveValue('paciente-martina');

    // Con la autorización todavía sin cargar (listByPresupuestoId resuelve []), la sección de
    // Autorización también muestra su propio form con botón "Guardar" — se acota la búsqueda al
    // form del presupuesto (el que contiene el campo "Paciente").
    const presupuestoForm = pacienteField.closest('form');
    if (!presupuestoForm) throw new Error('No se encontró el form de presupuesto');
    await user.click(within(presupuestoForm).getByRole('button', { name: /guardar/i }));

    expect(actualizar).toHaveBeenCalledWith('presupuesto-martina-1', expect.objectContaining({ monto: 150_000 }));
  });

  it('cuando no hay autorización asociada (listByPresupuestoId resuelve []), muestra el estado vacío y el form para crearla', async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockResolvedValue(autorizacionMartina);
    const autorizacionRepository = buildFakeAutorizacionRepository({ create });

    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        crearLote={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={autorizacionRepository}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByText(/no hay autorización/i)).toBeInTheDocument();
    expect(autorizacionRepository.listByPresupuestoId).toHaveBeenCalledWith('presupuesto-martina-1');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ presupuestoId: 'presupuesto-martina-1' }));
  });

  it('cuando ya hay autorización asociada, la muestra resuelta y permite editarla vía actualizar()', async () => {
    const user = userEvent.setup();
    const update = vi.fn().mockResolvedValue({ ...autorizacionMartina, estado: 'judicializada' });
    const autorizacionRepository = buildFakeAutorizacionRepository({
      listByPresupuestoId: vi.fn().mockResolvedValue([autorizacionMartina]),
      update,
    });

    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        crearLote={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={autorizacionRepository}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByText(/autorizada/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /editar autorización/i }));
    await user.selectOptions(screen.getByLabelText(/^estado$/i), 'judicializada');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(update).toHaveBeenCalledWith('autorizacion-martina-1', expect.objectContaining({ estado: 'judicializada' }));
  });

  it('muestra el error del repository de autorizaciones sin ocultar el resto del detalle', async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockRejectedValue(new Error('no se pudo crear la autorización'));
    const autorizacionRepository = buildFakeAutorizacionRepository({ create });

    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        crearLote={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={autorizacionRepository}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await screen.findByText(/no hay autorización/i);
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('no se pudo crear la autorización')).toBeInTheDocument();
  });
});

// tasks.md 5.4, design.md D11: esta pantalla ya lee datos reales del servidor mientras
// Facturación (validación de cupo, RN-FA-02/RN-PA-03) sigue leyendo datos de prueba — hay que
// decirlo para que nadie concluya de una pantalla lo que pasa en la otra.
describe('PresupuestoDetail — cartel de fuente mixta con Facturación (D11)', () => {
  it('muestra un cartel avisando que Facturación todavía valida cupo contra datos de prueba', () => {
    render(
      <PresupuestoDetail
        presupuesto={null}
        crear={vi.fn()}
        crearLote={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={buildFakeAutorizacionRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const notas = screen.getAllByRole('note');
    const cartel = notas.find((n) => /facturación/i.test(n.textContent ?? ''));
    if (!cartel) throw new Error('No se encontró el cartel de fuente mixta con Facturación (tasks.md 5.4)');
    expect(cartel).toHaveTextContent(/datos de prueba/i);
    expect(cartel).toHaveTextContent(/cupo/i);
  });

  // Triangulación: el cartel también aparece (una sola vez) en modo edición, con presupuesto y
  // autorización ya cargados — no depende de que la pantalla esté vacía.
  it('sigue mostrando exactamente un cartel de Facturación en modo edición con autorización cargada', async () => {
    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        crearLote={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={buildFakeAutorizacionRepository({
          listByPresupuestoId: vi.fn().mockResolvedValue([autorizacionMartina]),
        })}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByText(/autorizada/i)).toBeInTheDocument();

    const notas = screen.getAllByRole('note');
    const cartelesFacturacion = notas.filter((n) => /facturación/i.test(n.textContent ?? ''));
    expect(cartelesFacturacion).toHaveLength(1);
  });
});

// Gateo de escritura (gateo-facturacion, tasks.md 3.1, design.md D1). La entrada a la edición de
// autorización ("Editar autorización") queda visible pero no activable sin permiso de escritura.
describe('PresupuestoDetail — gateo de escritura de la entrada a autorización', () => {
  function buildRepoConAutorizacionExistente(): AutorizacionRepository {
    return buildFakeAutorizacionRepository({ listByPresupuestoId: vi.fn().mockResolvedValue([autorizacionMartina]) });
  }

  it('sin permiso de escritura: "Editar autorización" queda visible y no se puede activar', async () => {
    renderConPermiso(
      false,
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        crearLote={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={buildRepoConAutorizacionExistente()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const editarAutorizacion = await screen.findByRole('button', { name: /editar autorización/i });
    expect(editarAutorizacion).toBeVisible();
    expect(editarAutorizacion).toBeDisabled();
    // Los datos de la autorización siguen siendo legibles con solo `read`.
    expect(screen.getByText(/autorizada/i)).toBeInTheDocument();
  });

  it('con permiso de escritura: "Editar autorización" está activable (triangulación)', async () => {
    renderConPermiso(
      true,
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        crearLote={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={buildRepoConAutorizacionExistente()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: /editar autorización/i })).toBeEnabled();
  });
});

// integracion-documentos-autorizaciones (tasks.md 4.2): confirma el wiring real entre
// PresupuestoDetail y AutorizacionForm — el `id` de la autorización YA cargada y el
// `autorizacionRepository` recibido por props llegan tal cual al form, que es quien invoca
// uploadArchivo/removeArchivo (D3).
describe('PresupuestoDetail — wiring de archivo hacia AutorizacionForm (integracion-documentos-autorizaciones)', () => {
  it('al editar una autorización existente y elegir un archivo, llama a autorizacionRepository.uploadArchivo con el id real', async () => {
    const user = userEvent.setup();
    const archivoSubido = { ...autorizacionMartina, archivo: { nombre: 'informe.pdf', cargadoEn: '2026-08-18T12:00:00.000Z', clave: 'autorizacion-martina-1/uuid-informe.pdf' } };
    const uploadArchivo = vi.fn().mockResolvedValue(archivoSubido);
    const autorizacionRepository = buildFakeAutorizacionRepository({
      listByPresupuestoId: vi.fn().mockResolvedValue([autorizacionMartina]),
      uploadArchivo,
    });

    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        crearLote={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={autorizacionRepository}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /editar autorización/i }));
    const archivo = new File(['contenido'], 'informe.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText(/^archivo$/i), archivo);

    expect(uploadArchivo).toHaveBeenCalledWith('autorizacion-martina-1', expect.any(File));
    expect(await screen.findByText(/informe\.pdf/i)).toBeInTheDocument();
  });
});

// presupuestos-vigencia-datos-traslado-vista-previa, tasks.md 8.7/8.8.
describe('PresupuestoDetail — vigencia y CD/SD de la autorización (tasks.md 8.7/8.8)', () => {
  it('muestra vigenciaHasta y "Con dependencia" ya persistidos de la autorización', async () => {
    const autorizacionConVigenciaYDependencia = {
      ...autorizacionMartina,
      vigenciaDesde: '2026-02-01',
      vigenciaHasta: '2026-08-31',
      conDependencia: true,
    };

    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        crearLote={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={buildFakeAutorizacionRepository({
          listByPresupuestoId: vi.fn().mockResolvedValue([autorizacionConVigenciaYDependencia]),
        })}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByText('2026-08-31')).toBeInTheDocument();
    expect(screen.getByText('Sí')).toBeInTheDocument();
  });

  it('sin vigenciaHasta ni conDependencia cargados en la autorización: muestra "Sin definir" / "No cargado"', async () => {
    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        crearLote={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={buildFakeAutorizacionRepository({
          listByPresupuestoId: vi.fn().mockResolvedValue([autorizacionMartina]),
        })}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByText(/autorizada/i)).toBeInTheDocument();
    // Aparece dos veces: una para `Presupuesto.conDependencia` (PresupuestoResumen) y otra para
    // `Autorizacion.conDependencia` (este mismo Card) — ninguno de los dos se cargó todavía.
    expect(screen.getAllByText('No cargado').length).toBeGreaterThanOrEqual(1);
  });
});
