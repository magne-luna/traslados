import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import { PacienteDetail } from './PacienteDetail';

function buildFakeObraSocialRepository(): ObraSocialRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
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

describe('PacienteDetail', () => {
  it('en alta (paciente null) muestra el formulario directamente y llama a onCreated tras crear', async () => {
    const user = userEvent.setup();
    const crear = vi.fn().mockResolvedValue(basePaciente);
    const onCreated = vi.fn();

    render(
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
    render(
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

    render(
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

    render(
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

    render(
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

    render(
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

    render(
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

    render(
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
    render(
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

    render(
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
    render(
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
    render(
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
    render(
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
    render(
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
    render(
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
    render(
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
    render(
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
    render(
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

    render(
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

    render(
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

    render(
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

    render(
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
});
