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

    // autorizacion-mensual (tasks.md 6a.3, design.md D10): "fila 100% clickeable" reemplaza el
    // botón "Editar autorización" — se entra a la fila por el rótulo del mes (legacy, sin
    // `periodoMes`: "Sin mes cargado").
    await user.click(screen.getByRole('button', { name: /sin mes cargado/i }));
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

// Gateo de escritura (gateo-facturacion, tasks.md 3.1, design.md D1). autorizacion-mensual
// (tasks.md 6a.2/6a.3, design.md D10) reemplaza el botón "Editar autorización" por la fila 100%
// clickeable de la Table — la entrada a VER una fila ya no está gateada (mismo criterio que
// `CamposSoloLectura` ya documenta: "los datos siguen siendo legibles con solo `read`"), pero los
// CAMPOS del form que se despliega siguen gateados (ver `AutorizacionForm.test.tsx —  gateo de
// escritura`). Acá se cubre además el botón nuevo "Agregar mes", que sí declara `requiereEscritura`.
describe('PresupuestoDetail — gateo de escritura de la entrada a autorización', () => {
  function buildRepoConAutorizacionExistente(): AutorizacionRepository {
    return buildFakeAutorizacionRepository({ listByPresupuestoId: vi.fn().mockResolvedValue([autorizacionMartina]) });
  }

  it('sin permiso de escritura: la fila sigue siendo clickeable (D10) pero los campos del form quedan deshabilitados', async () => {
    const user = userEvent.setup();
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

    // Los datos de la autorización siguen siendo legibles con solo `read`.
    expect(await screen.findByText(/autorizada/i)).toBeInTheDocument();

    const agregarMes = screen.getByRole('button', { name: /agregar mes/i });
    expect(agregarMes).toBeVisible();
    expect(agregarMes).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /sin mes cargado/i }));
    expect(screen.getByLabelText(/^estado$/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('con permiso de escritura: "Agregar mes" y los campos del form quedan activables (triangulación)', async () => {
    const user = userEvent.setup();
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

    expect(await screen.findByRole('button', { name: /agregar mes/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /sin mes cargado/i }));
    expect(screen.getByLabelText(/^estado$/i)).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /guardar/i }));
    // No falla al guardar con permiso — no se afirma nada del repository acá (cubierto en otros tests).
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

    await user.click(await screen.findByRole('button', { name: /sin mes cargado/i }));
    const archivo = new File(['contenido'], 'informe.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText(/^archivo$/i), archivo);

    expect(uploadArchivo).toHaveBeenCalledWith('autorizacion-martina-1', expect.any(File));
    expect(await screen.findByText(/informe\.pdf/i)).toBeInTheDocument();
  });
});

// presupuestos-vigencia-datos-traslado-vista-previa, tasks.md 8.7/8.8. autorizacion-mensual
// (tasks.md 6a.3, design.md D10) reemplaza el Card único por la Table de meses — sus 6 columnas
// (Mes/Estado/Monto/Cupo/Vigencia/Adjunto) NO incluyen "Con dependencia" (columna deliberadamente
// fuera de D10): vigencia se lee en la fila de la Table, CD/SD se lee/edita abriendo esa fila
// (AutorizacionForm, checkbox ya cubierto en su propio test file).
describe('PresupuestoDetail — vigencia y CD/SD de la autorización (tasks.md 8.7/8.8, 6a.3)', () => {
  it('la fila de la Table muestra vigenciaDesde → vigenciaHasta, y al abrirla el checkbox CD refleja lo persistido', async () => {
    const user = userEvent.setup();
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

    expect(await screen.findByText('2026-02-01 → 2026-08-31')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sin mes cargado/i }));
    expect(screen.getByRole('checkbox', { name: /con dependencia/i })).toBeChecked();
  });

  it('sin vigenciaHasta ni conDependencia cargados: la fila muestra "—" en vigencia y el checkbox arranca sin marcar al abrirla', async () => {
    const user = userEvent.setup();

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

    expect(await screen.findByText('— → —')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sin mes cargado/i }));
    expect(screen.getByRole('checkbox', { name: /con dependencia/i })).not.toBeChecked();
  });
});

// autorizacion-mensual (tasks.md 6a.3, design.md D10): "Estados a cubrir: cargando · sin ninguna
// autorización (legacy pre-2026-08-15) · solo legacy sin mes · N meses · mezcla legacy + meses" —
// los 5, textuales de design.md, uno por test (más los ya cubiertos arriba de vigencia/CD/gateo).
describe('PresupuestoDetail — Table de meses, los 5 estados de D10', () => {
  const marzo: Autorizacion = {
    id: 'autorizacion-marzo',
    presupuestoId: 'presupuesto-martina-1',
    estado: 'autorizada',
    montoAutorizado: 50_000,
    periodoMes: '2026-03-01',
  };
  const abril: Autorizacion = {
    id: 'autorizacion-abril',
    presupuestoId: 'presupuesto-martina-1',
    estado: 'pendiente',
    periodoMes: '2026-04-01',
  };

  // Estado 1: cargando.
  it('estado "cargando": muestra el mensaje de carga mientras listByPresupuestoId no resolvió', () => {
    const listByPresupuestoId = vi.fn(() => new Promise<Autorizacion[]>(() => {})); // nunca resuelve
    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        crearLote={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={buildFakeAutorizacionRepository({ listByPresupuestoId })}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText(/cargando autorización/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  // Estado 2: sin ninguna autorización (legacy pre-2026-08-15, D3) — ya cubierto arriba en "modo
  // edición" ("cuando no hay autorización asociada..."), se referencia acá para dejar el mapeo
  // completo de los 5 estados documentado en un solo lugar.
  it('estado "sin ninguna autorización": listByPresupuestoId resuelve [] -> abre directo el form de alta, sin Table', async () => {
    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        crearLote={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={buildFakeAutorizacionRepository({ listByPresupuestoId: vi.fn().mockResolvedValue([]) })}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByText(/no hay autorización cargada todavía/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^estado$/i)).toBeInTheDocument();
  });

  // Estado 3: solo legacy sin mes -- una (o más) filas sin periodoMes, todas rotuladas "Sin mes
  // cargado", sin ningún "Mes N".
  it('estado "solo legacy sin mes": la Table rotula la fila "Sin mes cargado", sin "Mes N"', async () => {
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

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sin mes cargado$/i })).toBeInTheDocument();
    expect(screen.queryByText(/mes \d/i)).not.toBeInTheDocument();
  });

  // Estado 4: N meses -- todas las filas con periodoMes, "Mes N" numerado en el orden recibido
  // (la Table no reordena: ya llega ordenado de listByPresupuestoId/EF real, D5).
  it('estado "N meses": la Table numera "Mes 1"/"Mes 2" en el orden recibido, cada una con su propia fila', async () => {
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
          listByPresupuestoId: vi.fn().mockResolvedValue([marzo, abril]),
        })}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: /mes 1 · marzo 2026/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mes 2 · abril 2026/i })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3); // 1 header + 2 filas
  });

  // Estado 5: mezcla legacy + meses -- la legacy se muestra "Sin mes cargado" (sin correr la
  // numeración de las demás, decisión de `ordinalMes` 3.3) y las que tienen mes siguen su propio
  // "Mes N" entre ellas.
  it('estado "mezcla legacy + meses": la fila legacy no corre la numeración de las filas con mes', async () => {
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
          // Mismo orden que la EF real (D5): legacy primero, luego ascendente por mes.
          listByPresupuestoId: vi.fn().mockResolvedValue([autorizacionMartina, marzo]),
        })}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: /^sin mes cargado$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mes 1 · marzo 2026/i })).toBeInTheDocument();
  });
});

// autorizacion-mensual (tasks.md 6a.3, design.md D4/D11): acción "Agregar mes" al pie de la Table
// -- abre un AutorizacionForm de ALTA (sin `initial`), y al guardar llama a `create()` (nunca
// `update()`), agregando la fila nueva a la Table sin descartar las que ya había.
describe('PresupuestoDetail — acción "Agregar mes" (tasks.md 6a.3, design.md D4/D11)', () => {
  const marzo: Autorizacion = {
    id: 'autorizacion-marzo',
    presupuestoId: 'presupuesto-martina-1',
    estado: 'autorizada',
    periodoMes: '2026-03-01',
  };

  it('al hacer click en "Agregar mes", crea la fila y la agrega a la Table sin perder la existente', async () => {
    const user = userEvent.setup();
    const abrilCreada: Autorizacion = { id: 'autorizacion-abril', presupuestoId: 'presupuesto-martina-1', estado: 'pendiente', periodoMes: '2026-04-01' };
    const create = vi.fn().mockResolvedValue(abrilCreada);
    const autorizacionRepository = buildFakeAutorizacionRepository({
      listByPresupuestoId: vi.fn().mockResolvedValue([marzo]),
      create,
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

    await user.click(await screen.findByRole('button', { name: /agregar mes/i }));
    await user.type(screen.getByLabelText(/^mes$/i), '2026-04');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ presupuestoId: 'presupuesto-martina-1', periodoMes: '2026-04-01' }));
    expect(await screen.findByRole('button', { name: /mes 1 · marzo 2026/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mes 2 · abril 2026/i })).toBeInTheDocument();
  });

  it('"Cancelar" desde "Agregar mes" vuelve a la Table (no llama a onBack, hay al menos una fila)', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        crearLote={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        recorridoHabitualRepository={recorridoHabitualRepositoryStub}
        autorizacionRepository={buildFakeAutorizacionRepository({ listByPresupuestoId: vi.fn().mockResolvedValue([marzo]) })}
        onCreated={vi.fn()}
        onBack={onBack}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /agregar mes/i }));
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
  });
});

// tasks.md 6a.5, design.md D5/D11: confirma que `PresupuestoDetail` le pasa a `AutorizacionForm`
// los `periodosDelPresupuesto` correctos (las DEMÁS filas) para que su chequeo local de unicidad
// (`AutorizacionForm.test.tsx`) bloquee un mes duplicado con el mismo mensaje de dominio que
// `edgeFunctionErrors.ts` mapea del `23505` real (tasks.md 4.3) — reusado, no reimplementado. El
// `create()` mockeado para rechazar con ese mismo texto documenta que, si el chequeo local no
// alcanzara a interceptarlo (ej. otra pestaña cargó el mismo mes segundos antes), el error del
// servidor real llegaría con el mismo mensaje — pero en este caso el chequeo local lo intercepta
// primero, así que `create()` ni se llega a invocar.
describe('PresupuestoDetail — mensaje de dominio al cargar un mes duplicado (tasks.md 6a.5)', () => {
  it('el chequeo local de AutorizacionForm bloquea un mes ya cargado en otra fila, con el mismo mensaje que mapearía el 23505 real', async () => {
    const user = userEvent.setup();
    const marzo: Autorizacion = { id: 'autorizacion-marzo', presupuestoId: 'presupuesto-martina-1', estado: 'autorizada', periodoMes: '2026-03-01' };
    const create = vi.fn().mockRejectedValue(new Error('Ya existe una autorización para ese mes en este presupuesto.'));
    const autorizacionRepository = buildFakeAutorizacionRepository({
      listByPresupuestoId: vi.fn().mockResolvedValue([marzo]),
      create,
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

    await user.click(await screen.findByRole('button', { name: /agregar mes/i }));
    // Se fuerza el mismo mes que ya está cargado, salteando el chequeo LOCAL de AutorizacionForm
    // (`periodosDelPresupuesto` sí lo tendría) para ejercitar el camino del error real del servidor:
    // se limpia el prefill sugerido y se escribe a mano el mes ya existente.
    const input = screen.getByLabelText(/^mes$/i);
    await user.clear(input);
    await user.type(input, '2026-03');
    // El chequeo local de AutorizacionForm ya bloquearía acá -- se confirma con el mensaje mostrado,
    // y de paso que Guardar tampoco llegó a invocar `create()` con ese valor:
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(create).not.toHaveBeenCalled();
    expect(screen.getByText('Ya existe una autorización para ese mes en este presupuesto.')).toBeInTheDocument();
  });
});

// autorizacion-mensual (tasks.md 6a.7, design.md D12): "N filas mensuales = N archivos
// independientes, con cero cambios en la capa de storage" -- se verifica con un test, no se
// declara verificado por lectura (textual de D12). Reemplazar el adjunto del mes 2 (abril) no
// tiene que tocar el adjunto ya cargado del mes 1 (marzo), ni en la llamada al repository ni en lo
// que la Table sigue mostrando para marzo al reabrirla.
describe('PresupuestoDetail — el adjunto de un mes no afecta al de otro mes (tasks.md 6a.7, design.md D12)', () => {
  it('subir un archivo para abril llama a uploadArchivo con el id de abril, y marzo sigue mostrando su propio archivo al reabrirla', async () => {
    const user = userEvent.setup();
    const marzoConArchivo: Autorizacion = {
      id: 'autorizacion-marzo',
      presupuestoId: 'presupuesto-martina-1',
      estado: 'autorizada',
      periodoMes: '2026-03-01',
      archivo: { nombre: 'marzo.pdf', cargadoEn: '2026-03-05T10:00:00.000Z', clave: 'autorizacion-marzo/uuid-marzo.pdf' },
    };
    const abrilSinArchivo: Autorizacion = {
      id: 'autorizacion-abril',
      presupuestoId: 'presupuesto-martina-1',
      estado: 'pendiente',
      periodoMes: '2026-04-01',
    };
    const abrilConArchivo: Autorizacion = {
      ...abrilSinArchivo,
      archivo: { nombre: 'abril.pdf', cargadoEn: '2026-04-05T10:00:00.000Z', clave: 'autorizacion-abril/uuid-abril.pdf' },
    };
    const uploadArchivo = vi.fn().mockResolvedValue(abrilConArchivo);
    const autorizacionRepository = buildFakeAutorizacionRepository({
      listByPresupuestoId: vi.fn().mockResolvedValue([marzoConArchivo, abrilSinArchivo]),
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

    // Abre abril (Mes 2) y le sube un archivo.
    await user.click(await screen.findByRole('button', { name: /mes 2 · abril 2026/i }));
    await user.upload(screen.getByLabelText(/^archivo$/i), new File(['contenido'], 'abril.pdf', { type: 'application/pdf' }));

    expect(uploadArchivo).toHaveBeenCalledWith('autorizacion-abril', expect.any(File));
    expect(uploadArchivo).not.toHaveBeenCalledWith('autorizacion-marzo', expect.anything());
    expect(await screen.findByText(/abril\.pdf/i)).toBeInTheDocument();

    // Vuelve a la Table y reabre marzo (Mes 1): su archivo sigue siendo el propio, sin cruzarse con
    // el que se acaba de subir para abril.
    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    await user.click(await screen.findByRole('button', { name: /mes 1 · marzo 2026/i }));

    expect(await screen.findByText(/marzo\.pdf/i)).toBeInTheDocument();
    expect(screen.queryByText(/abril\.pdf/i)).not.toBeInTheDocument();
  });
});
