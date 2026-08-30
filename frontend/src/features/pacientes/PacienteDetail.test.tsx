import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderConQuery } from '../../shared/test/queryWrapper';
import userEvent from '@testing-library/user-event';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { RequisitosActividadRepository } from '../../shared/lib/requisitosActividad/RequisitosActividadRepository';
import type { RecorridoHabitualRepository } from '../../shared/lib/pacientes/RecorridoHabitualRepository';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import type { Prestacion } from '../../shared/types/prestacion';
import { renderConSesion } from '../../shared/test/renderConSesion';
import { mockCatalogoAccesoriosRepository } from '../../shared/lib/mocks/mockCatalogoAccesoriosRepository';
import { CatalogoAccesoriosRepositoryProvider } from './CatalogoAccesoriosRepositoryContext';
import { PacienteDetail } from './PacienteDetail';

function buildFakeObraSocialRepository(): ObraSocialRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    listPage: vi.fn(),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function buildFakeDocumentoRepository(): DocumentoRepository {
  return {
    listByEntity: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    remove: vi.fn(),
    resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
    transferirAgrupacion: vi.fn(),
  };
}

// documentos-checklist-items-por-actividad (tasks.md §6): repository opcional — `listAll` resuelve
// `{}` por default, mismo criterio que los otros dos fakes de este archivo.
function buildFakeRequisitosActividadRepository(): RequisitosActividadRepository {
  return {
    listAll: vi.fn().mockResolvedValue({}),
    actualizar: vi.fn(),
  };
}

// RF-110 (destinos habituales): repository opcional — mismo criterio que
// buildFakeRequisitosActividadRepository (arriba).
function buildFakeRecorridoHabitualRepository(): RecorridoHabitualRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    remove: vi.fn(),
  };
}

const basePaciente: Paciente = {
  id: 'paciente-martina',
  apellido: 'Gómez',
  nombre: 'Martina',
  fechaNacimiento: '2015-03-12',
  dni: '45123456',
  cuilTitular: '27-30111222-4',
  diagnostico: 'Parálisis cerebral',
  accesorioMovilidad: [],
  obraSocialId: null,
  numeroAfiliado: { valor: '45123456' },
  cud: null,
  direcciones: [],
  personasACargo: [],
  amparoJudicial: false,
};

// Solo las pruebas de ALTA (paciente null) montan <PacienteForm> directamente, y ese formulario
// compone <AccesoriosMovilidadSelector>, que resuelve el catálogo por context y `usePermiso` por
// useAuth — sin los dos providers, lanza. Las de EDICIÓN arrancan colapsadas en el resumen: no
// llegan al formulario y por eso siguen con `render` pelado, sin envolverlas de más.
function renderAlta(ui: React.ReactElement) {
  return renderConSesion(
    <CatalogoAccesoriosRepositoryProvider repository={mockCatalogoAccesoriosRepository}>{ui}</CatalogoAccesoriosRepositoryProvider>,
  );
}

describe('PacienteDetail', () => {
  it('en alta (paciente null) muestra el formulario directamente y llama a onCreated tras crear', async () => {
    const user = userEvent.setup();
    const crear = vi.fn().mockResolvedValue(basePaciente);
    const onCreated = vi.fn();

    renderAlta(
      <PacienteDetail
        paciente={null}
        crear={crear}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={onCreated}
        onBack={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ apellido: 'Gómez', nombre: 'Martina', dni: '45123456' }));
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith(basePaciente));
  });

  it('en edición arranca colapsado en el resumen, detrás de "Editar datos"', () => {
    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Gómez, Martina').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /editar datos/i })).toBeInTheDocument();
  });

  it('CUD "vencido" muestra un chip de peligro distinto del vigente', () => {
    const vencido: Paciente = {
      ...basePaciente,
      cud: { numero: 'CUD-1', fechaEmision: '2020-01-01', fechaVencimiento: '2020-06-01' },
    };

    renderConQuery(
      <PacienteDetail
        paciente={vencido}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    // Aparece 2 veces: en el resumen colapsado del paciente y en la sección de CUD.
    expect(screen.getAllByText(/vencido/i).length).toBeGreaterThan(0);
  });

  it('CUD "por-vencer" muestra un chip de advertencia distinto del vigente (triangulación)', () => {
    const proximo = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const porVencer: Paciente = {
      ...basePaciente,
      cud: { numero: 'CUD-1', fechaEmision: '2020-01-01', fechaVencimiento: proximo },
    };

    renderConQuery(
      <PacienteDetail
        paciente={porVencer}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/por vencer|por-vencer/i).length).toBeGreaterThan(0);
  });

  it('CUD "vigente" no muestra alerta de vencimiento', () => {
    const lejano: Paciente = {
      ...basePaciente,
      cud: { numero: 'CUD-1', fechaEmision: '2020-01-01', fechaVencimiento: '2030-01-01' },
    };

    renderConQuery(
      <PacienteDetail
        paciente={lejano}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/vigente/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/vencido/i)).not.toBeInTheDocument();
  });

  it('editar la fecha de vencimiento del CUD persiste vía actualizar()', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(basePaciente);

    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={actualizar}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /agregar cud/i }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(actualizar).toHaveBeenCalledWith(
      'paciente-martina',
      { cud: { numero: '', fechaEmision: '', fechaVencimiento: '' } },
    );
  });

  it('agregar una persona a cargo persiste vía actualizar()', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(basePaciente);

    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={actualizar}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/^nombre$/i), 'Roberto');
    await user.type(screen.getByLabelText(/^apellido$/i), 'Pereyra');
    await user.type(screen.getByLabelText(/^dni$/i), '25333444');
    await user.click(screen.getByRole('button', { name: /agregar persona a cargo/i }));

    expect(actualizar).toHaveBeenCalledWith(
      'paciente-martina',
      { personasACargo: [expect.objectContaining({ nombre: 'Roberto', apellido: 'Pereyra', dni: '25333444' })] },
    );
  });

  it('el resumen muestra segundo nombre, segundo apellido y condición cuando están presentes', () => {
    const conDatosExtendidos: Paciente = {
      ...basePaciente,
      segundoNombre: 'Sol',
      segundoApellido: 'Díaz',
      condicion: 'Estable',
    };

    renderConQuery(
      <PacienteDetail
        paciente={conDatosExtendidos}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/gómez díaz, martina sol/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/estable/i)).toBeInTheDocument();
  });

  it('el resumen no rompe cuando falta segundo nombre/apellido/condición (triangulación, son opcionales)', () => {
    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Gómez, Martina').length).toBeGreaterThan(0);
  });

  it('el resumen muestra todos los accesorios de movilidad cuando el paciente tiene más de uno cargado', () => {
    const conVariosAccesorios: Paciente = {
      ...basePaciente,
      accesorioMovilidad: ['silla-plegable', 'andador'],
    };

    renderConQuery(
      <PacienteDetail
        paciente={conVariosAccesorios}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText('Silla plegable')).toBeInTheDocument();
    expect(screen.getByText('Andador')).toBeInTheDocument();
  });

  it('el resumen no rompe cuando el paciente no tiene ningún accesorio cargado (triangulación, array vacío)', () => {
    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Gómez, Martina').length).toBeGreaterThan(0);
    expect(screen.queryByText('Silla plegable')).not.toBeInTheDocument();
  });

  it('el cartel de modelo de datos de Paciente ya no menciona segundo nombre/apellido ni Condición (resueltos)', () => {
    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByText(/segundo nombre/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/segundo apellido/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/"Condición" como campo separado/i)).not.toBeInTheDocument();
  });

  it('el cartel de modelo de datos de Paciente ya no menciona accesorio de movilidad único (resuelto)', () => {
    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByText(/accesorio de movilidad.*acá admite uno solo/i)).not.toBeInTheDocument();
  });

  it('el cartel de modelo de datos de Paciente sigue avisando lo que queda sin resolver: numeroAfiliado sin historial de coberturas (triangulación)', () => {
    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText(/no hay historial de coberturas/i)).toBeInTheDocument();
  });

  it('ya no hay cartel de modelo de datos en Personas a Cargo: la única discrepancia (teléfono) está resuelta', () => {
    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByText(/falta teléfono.*teléfono alternativo/i)).not.toBeInTheDocument();
  });

  // tasks.md 5.1 (integracion-pacientes), design.md D9 #8/#10/#7: cartel agrupado con los campos
  // que no persisten o degradan al leer/escribir contra pacientes.paciente. El formato del
  // identificador de afiliado (#1) salió de este cartel en tasks.md 8.3 — ya persiste (ver el test
  // "ya NO muestra..." más abajo).
  it('muestra un cartel agrupado con las discrepancias de amparo judicial, nullables y diagnóstico JSONB', () => {
    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const notas = screen.getAllByRole('note');
    const cartel = notas.find((nota) => /aclaración del amparo judicial/i.test(nota.textContent ?? ''));
    if (!cartel) throw new Error('No se encontró el cartel agrupado de discrepancias (tasks.md 5.1)');
    expect(cartel).toHaveTextContent(/fecha de nacimiento/i);
    expect(cartel).toHaveTextContent(/cuil del titular/i);
    expect(cartel).toHaveTextContent(/nullable en la base/i);
    expect(cartel).toHaveTextContent(/diagnóstico/i);
    expect(cartel).toHaveTextContent(/jsonb/i);
  });

  // tasks.md 8.3: la discrepancia #1 (formato del identificador de afiliado) quedó resuelta —
  // ya no debe seguir señalizada como pendiente en ningún cartel de esta pantalla.
  it('ya NO muestra el formato del identificador de afiliado como discrepancia sin resolver (8.3, D9 addendum)', () => {
    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByText(/no se persiste \(IN-01/i)).not.toBeInTheDocument();
  });

  // tasks.md 5.2 (integracion-pacientes), design.md D3/D9 #2: cartel separado sobre el gateo por
  // el módulo Obras Sociales del número de afiliado.
  it('muestra un cartel separado avisando que el número de afiliado depende del permiso de Obras Sociales', () => {
    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const notas = screen.getAllByRole('note');
    const cartel = notas.find((nota) => /si la cuenta no tiene permiso/i.test(nota.textContent ?? ''));
    if (!cartel) throw new Error('No se encontró el cartel del número de afiliado (tasks.md 5.2)');
    expect(cartel).toHaveTextContent(/módulo obras sociales/i);
    expect(cartel).toHaveTextContent(/no significa que el paciente no tenga afiliado cargado/i);
  });

  it('agregar una dirección persiste vía actualizar()', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(basePaciente);

    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={actualizar}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/calle y número/i), 'Av. Rivadavia 4500');
    await user.type(screen.getByLabelText(/^localidad$/i), 'CABA');
    await user.click(screen.getByRole('button', { name: /agregar dirección/i }));

    expect(actualizar).toHaveBeenCalledWith(
      'paciente-martina',
      { direcciones: [expect.objectContaining({ calle: 'Av. Rivadavia 4500', localidad: 'CABA' })] },
    );
  });

  // documentos-checklist-por-actividad (tasks.md 3.2, design.md D1): la Section "Checklist
  // documental" pasa a recibir las actividades del paciente — antes de este change
  // PacienteDocumentos solo recibía pacienteId/obraSocialId, sin de dónde sacar la lista de
  // actividades para el checklist por actividad de la §3.
  it('pasa las direcciones del paciente a la sección de documentación, habilitando un checklist por actividad', async () => {
    const osecac: ObraSocial = {
      id: 'osecac',
      nombre: 'OSECAC',
      cuit: '30-54155200-6',
      modalidadFacturacion: 'por-prestacion',
      admitePagosParciales: false,
      formatoAfiliado: 'numero-documento',
      checklist: [{ id: 'item-1', nombre: 'RHC', requerido: true }],
      plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
    };
    const pacienteConActividad: Paciente = {
      ...basePaciente,
      obraSocialId: 'osecac',
      direcciones: [
        { id: 'dir-1', tipo: 'terapia', calle: 'Calle Falsa 123', localidad: 'CABA', descripcion: 'Kinesióloga' },
      ],
    };
    const obraSocialRepository = buildFakeObraSocialRepository();
    obraSocialRepository.getById = vi.fn().mockResolvedValue(osecac);

    renderConQuery(
      <PacienteDetail
        paciente={pacienteConActividad}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={obraSocialRepository}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    // Scoped al `<section>` de "Checklist documental" — "Terapia — Kinesióloga" también aparece
    // en la sección "Direcciones" (DireccionesEditor), así que una búsqueda sin acotar da un falso
    // verde aunque PacienteDocumentos nunca haya recibido las direcciones.
    const tituloDocumentacion = await screen.findByRole('heading', { name: /checklist documental/i });
    const seccionDocumentacion = tituloDocumentacion.closest('section');
    if (!seccionDocumentacion) throw new Error('No se encontró la <section> de "Checklist documental"');
    expect(await within(seccionDocumentacion).findByText(/terapia — kinesióloga/i)).toBeInTheDocument();
  });

  // documentos-checklist-por-actividad (tasks.md 6.1, design.md Checkpoint (e) VEREDICTO opción
  // A): PacienteDetail —no el editor— consulta cuántos documentos tiene cada dirección (vía
  // documentoRepository) y se lo pasa al editor de direcciones, que lo usa para advertir antes de
  // quitar una actividad con documentación cargada.
  it('calcula la cantidad de documentos por dirección y la pasa al editor de direcciones para advertir al quitar (tasks.md 6.1)', async () => {
    const user = userEvent.setup();
    const documentoRepository = buildFakeDocumentoRepository();
    documentoRepository.listByEntity = vi.fn().mockImplementation((_entidad: string, _entidadId: string, agrupacionId?: string) => {
      if (agrupacionId === 'dir-1') {
        return Promise.resolve([
          { id: 'doc-1', itemId: 'item-1', nombreArchivo: 'rhc.pdf', subidoEn: '2026-07-01' },
          { id: 'doc-2', itemId: 'item-1', nombreArchivo: 'rhc-2.pdf', subidoEn: '2026-07-02' },
        ]);
      }
      return Promise.resolve([]);
    });
    const pacienteConActividad: Paciente = {
      ...basePaciente,
      direcciones: [
        { id: 'dir-1', tipo: 'terapia', calle: 'Calle Falsa 123', localidad: 'CABA', descripcion: 'Kinesióloga' },
      ],
    };

    renderConQuery(
      <PacienteDetail
        paciente={pacienteConActividad}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={documentoRepository}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await vi.waitFor(() => expect(documentoRepository.listByEntity).toHaveBeenCalledWith('paciente', 'paciente-martina', 'dir-1'));

    await user.click(await screen.findByRole('button', { name: /quitar terapia/i }));

    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('2');
  });

  // Triangulación de 6.1/6.3: una dirección sin documentos cargados no dispara ningún diálogo,
  // aunque el cálculo de PacienteDetail sí haya corrido.
  it('una dirección sin documentos no pide confirmación al quitarla (triangulación de 6.1, comportamiento actual)', async () => {
    const user = userEvent.setup();
    const documentoRepository = buildFakeDocumentoRepository();
    const pacienteConActividad: Paciente = {
      ...basePaciente,
      direcciones: [
        { id: 'dir-1', tipo: 'terapia', calle: 'Calle Falsa 123', localidad: 'CABA', descripcion: 'Kinesióloga' },
      ],
    };

    renderConQuery(
      <PacienteDetail
        paciente={pacienteConActividad}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={documentoRepository}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await vi.waitFor(() => expect(documentoRepository.listByEntity).toHaveBeenCalledWith('paciente', 'paciente-martina', 'dir-1'));

    await user.click(screen.getByRole('button', { name: /quitar terapia/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // documentos-checklist-por-actividad (tasks.md 8.5, design.md Checkpoint (h)): la asociación
  // documento↔actividad (agrupacionId, futura columna `direccion_id` sobre `pacientes.documentos`)
  // todavía no tiene respaldo en el modelo real de la BD — mismo mecanismo (AvisoModeloDatos) que ya
  // usan las secciones de Direcciones/CUD/Personas a cargo.
  it('muestra un AvisoModeloDatos en la sección de documentación sobre la asociación documento↔actividad (tasks.md 8.5)', async () => {
    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const tituloDocumentacion = await screen.findByRole('heading', { name: /checklist documental/i });
    const seccionDocumentacion = tituloDocumentacion.closest('section');
    if (!seccionDocumentacion) throw new Error('No se encontró la <section> de "Checklist documental"');
    const avisos = within(seccionDocumentacion).getAllByRole('note');
    const aviso = avisos.find((a) => /actividad/i.test(a.textContent ?? ''));
    expect(aviso).toBeTruthy();
    expect(aviso?.textContent ?? '').toMatch(/direccion_id|pacientes\.documentos/i);
  });

  // Triangulación de 8.5: el aviso no depende del estado de carga de PacienteDocumentos — sigue
  // presente incluso cuando la obra social ya resolvió y el checklist por actividad está "listo"
  // (a diferencia del test anterior, que corre en el estado "sin-obra-social").
  it('el AvisoModeloDatos de documentación sigue presente con obra social y actividades cargadas (triangulación de 8.5)', async () => {
    const osecac: ObraSocial = {
      id: 'osecac',
      nombre: 'OSECAC',
      cuit: '30-54155200-6',
      modalidadFacturacion: 'por-prestacion',
      admitePagosParciales: false,
      formatoAfiliado: 'numero-documento',
      checklist: [{ id: 'item-1', nombre: 'RHC', requerido: true }],
      plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
    };
    const pacienteConActividad: Paciente = {
      ...basePaciente,
      obraSocialId: 'osecac',
      direcciones: [
        { id: 'dir-1', tipo: 'terapia', calle: 'Calle Falsa 123', localidad: 'CABA', descripcion: 'Kinesióloga' },
      ],
    };
    const obraSocialRepository = buildFakeObraSocialRepository();
    obraSocialRepository.getById = vi.fn().mockResolvedValue(osecac);

    renderConQuery(
      <PacienteDetail
        paciente={pacienteConActividad}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={obraSocialRepository}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const tituloDocumentacion = await screen.findByRole('heading', { name: /checklist documental/i });
    const seccionDocumentacion = tituloDocumentacion.closest('section');
    if (!seccionDocumentacion) throw new Error('No se encontró la <section> de "Checklist documental"');
    // Espera a que resuelva la obra social (estado "listo") antes de verificar el aviso.
    await within(seccionDocumentacion).findByText(/terapia — kinesióloga/i);
    const avisos = within(seccionDocumentacion).getAllByRole('note');
    const aviso = avisos.find((a) => /actividad/i.test(a.textContent ?? ''));
    expect(aviso).toBeTruthy();
  });
});

// documentos-transferencia-actividad (tasks.md §7, design.md D5, `documento-avisos-modelo-datos`
// spec): checkpoint del video pendiente, declarado EN PANTALLA. Alcance de ESTA pasada (tasks.md
// §0.2, nota de alcance): exportar (3.b) y transferir (3.c) YA se implementaron con veredicto
// confirmado por la usuaria — NO son provisorios. Lo único que sigue pendiente del video es la
// navegación (3.a, "marcar una actividad" lleva a su documentación), bloqueada por el Checkpoint
// (a). El aviso debe hablar de ESO, no de exportar/transferir.
describe('PacienteDetail — aviso del checkpoint pendiente del video (tasks.md §7)', () => {
  it('muestra un AvisoPendienteCliente en la sección de documentación sobre la navegación pendiente (3.a)', async () => {
    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const tituloDocumentacion = await screen.findByRole('heading', { name: /checklist documental/i });
    const seccionDocumentacion = tituloDocumentacion.closest('section');
    if (!seccionDocumentacion) throw new Error('No se encontró la <section> de "Checklist documental"');

    const avisos = within(seccionDocumentacion).getAllByRole('note');
    // "Pendiente cliente:" es el título propio de AvisoPendienteCliente — lo distingue del
    // AvisoModeloDatos ya existente en esta misma sección (ambos son <Alert role="note">).
    const avisoPendiente = avisos.find((a) => /pendiente cliente/i.test(a.textContent ?? ''));
    expect(avisoPendiente).toBeTruthy();

    const texto = avisoPendiente?.textContent ?? '';
    // Dice qué falta (el video) y qué NO entra en este aviso: exportar/transferir ya están
    // resueltos, no provisorios — el aviso es específicamente sobre "marcar una actividad".
    expect(texto).toMatch(/video/i);
    expect(texto).toMatch(/marcar una actividad|navegaci[oó]n/i);
    expect(texto).not.toMatch(/exportar/i);
    expect(texto).not.toMatch(/transferir/i);
  });
});

// documentos-checklist-items-por-actividad (tasks.md §6, "Cableado en Pacientes → Documentos"):
// `PacienteDetail` es un eslabón del cableado hacia `PacienteDocumentos.tsx` — este test confirma
// que el prop llega, no vuelve a probar la lógica de combinación (eso ya está cubierto exhaustivamente
// en `PacienteDocumentos.test.tsx`).
describe('PacienteDetail — reenvía requisitosActividadRepository a PacienteDocumentos (tasks.md §6)', () => {
  it('con requisitosActividadRepository provisto, PacienteDocumentos lo usa para resolver la configuración por tipo de actividad', async () => {
    const requisitosActividadRepository = buildFakeRequisitosActividadRepository();

    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        requisitosActividadRepository={requisitosActividadRepository}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await waitFor(() => expect(requisitosActividadRepository.listAll).toHaveBeenCalled());
  });

  it('sin requisitosActividadRepository (prop opcional): no se rompe, PacienteDocumentos se comporta igual que antes', async () => {
    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByRole('heading', { name: /checklist documental/i })).toBeInTheDocument();
  });
});

describe('PacienteDetail — sección Destinos habituales (RF-110)', () => {
  it('con recorridoHabitualRepository provisto, se muestra la sección y lista() se llama con el paciente activo', async () => {
    const recorridoHabitualRepository = buildFakeRecorridoHabitualRepository();

    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        recorridoHabitualRepository={recorridoHabitualRepository}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByRole('heading', { name: /destinos habituales/i })).toBeInTheDocument();
    await waitFor(() => expect(recorridoHabitualRepository.list).toHaveBeenCalledWith('paciente-martina'));
  });

  it('sin recorridoHabitualRepository (prop opcional): la sección no se muestra, el resto de la ficha no se rompe', async () => {
    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await screen.findByRole('heading', { name: /checklist documental/i });
    expect(screen.queryByRole('heading', { name: /destinos habituales/i })).not.toBeInTheDocument();
  });

  it('en alta (paciente null) la sección no se muestra aunque haya recorridoHabitualRepository', () => {
    renderAlta(
      <PacienteDetail
        paciente={null}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        recorridoHabitualRepository={buildFakeRecorridoHabitualRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByRole('heading', { name: /destinos habituales/i })).not.toBeInTheDocument();
  });
});

// documentos-checklist-items-por-actividad (tasks.md 8.4, design.md Checkpoint (f)): supuesto
// pendiente de confirmar, un tema distinto del AvisoModeloDatos ya existente de arriba (ese habla
// de la columna `direccion_id`; este habla de si el CONTENIDO del checklist varía por tipo de
// actividad) — no reemplaza ni repite el texto de ninguno de los dos avisos que ya conviven en esta
// sección (tasks.md 8.4: "nunca dos carteles que repitan el mismo texto").
describe('PacienteDetail — aviso sobre el supuesto de ítems por tipo de actividad sin confirmar (tasks.md 8.4)', () => {
  it('muestra un aviso en la sección de documentación señalando que la configuración por tipo de actividad es un supuesto del equipo, sin confirmar con la clienta', async () => {
    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const tituloDocumentacion = await screen.findByRole('heading', { name: /checklist documental/i });
    const seccionDocumentacion = tituloDocumentacion.closest('section');
    if (!seccionDocumentacion) throw new Error('No se encontró la <section> de "Checklist documental"');

    const avisos = within(seccionDocumentacion).getAllByRole('note');
    const avisoSupuesto = avisos.find((a) => /tipo de actividad/i.test(a.textContent ?? ''));
    expect(avisoSupuesto).toBeTruthy();
    expect(avisoSupuesto?.textContent ?? '').toMatch(/sin confirmar|no confirmad/i);

    // No repite el texto del AvisoModeloDatos ya existente (direccion_id) — distinto tema.
    expect(avisoSupuesto?.textContent ?? '').not.toMatch(/direccion_id/);
  });
});

// presupuesto-prestaciones (design.md D1/D7, tasks.md 4.4 — PR 1 de la serie encadenada): sección
// nueva "Catálogo de prestaciones", gateada por el módulo `pacientes` (mismo `CamposSoloLectura`
// que Direcciones/Personas a cargo, vía PrestacionesEditor).
describe('PacienteDetail — sección Catálogo de prestaciones (tasks.md 4.4)', () => {
  it('agregar una prestación persiste vía actualizar()', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(basePaciente);

    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={actualizar}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const tituloPrestaciones = await screen.findByRole('heading', { name: /catálogo de prestaciones/i });
    const seccionPrestaciones = tituloPrestaciones.closest('section');
    if (!seccionPrestaciones) throw new Error('No se encontró la <section> de "Catálogo de prestaciones"');

    await user.type(within(seccionPrestaciones).getByLabelText(/nombre de la prestación/i), 'Kinesiología');
    await user.click(within(seccionPrestaciones).getByRole('button', { name: /agregar prestación/i }));

    expect(actualizar).toHaveBeenCalledWith(
      'paciente-martina',
      { prestaciones: [expect.objectContaining({ pacienteId: 'paciente-martina', nombre: 'Kinesiología', activa: true })] },
    );
  });

  it('sin permiso de escritura, la sección de prestaciones queda de solo lectura, pero las prestaciones cargadas siguen legibles', () => {
    const conPrestacion: Paciente = {
      ...basePaciente,
      prestaciones: [{ id: 'prest-1', pacienteId: 'paciente-martina', nombre: 'Kinesiología', activa: true } satisfies Prestacion],
    };

    renderConQuery(
      <PuedeEscribirContext.Provider value={false}>
        <PacienteDetail
          paciente={conPrestacion}
          crear={vi.fn()}
          actualizar={vi.fn()}
          obrasSociales={[]}
          obraSocialRepository={buildFakeObraSocialRepository()}
          documentoRepository={buildFakeDocumentoRepository()}
          onCreated={vi.fn()}
          onBack={vi.fn()}
        />
      </PuedeEscribirContext.Provider>,
    );

    expect(screen.getByText('Kinesiología')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar prestación/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /editar kinesiología/i })).toBeDisabled();
  });

  it('sin paciente.prestaciones (undefined, backend sin extender todavía), la sección se muestra vacía sin romper', () => {
    renderConQuery(
      <PacienteDetail
        paciente={basePaciente}
        crear={vi.fn()}
        actualizar={vi.fn()}
        obrasSociales={[]}
        obraSocialRepository={buildFakeObraSocialRepository()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText(/no hay prestaciones/i)).toBeInTheDocument();
  });
});
