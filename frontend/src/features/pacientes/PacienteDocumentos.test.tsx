import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { DocumentoAdjunto } from '../../shared/types/documento';
import type { Direccion } from '../../shared/types/paciente';
import type { RequisitosActividadRepository, RequisitosPorTipo } from '../../shared/lib/requisitosActividad/RequisitosActividadRepository';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { mockDocumentoRepository } from '../../shared/lib/documentos/mockDocumentoRepository';
import { PacienteDocumentos } from './PacienteDocumentos';
import { armarZipDocumentacionActividad } from './exportacionZip';

// documentos-transferencia-actividad (tasks.md §12): mock PARCIAL — por default llama a la
// implementación real (`importOriginal`), así que la mayoría de los tests de "Exportar" ejercitan
// el armado del zip de punta a punta. Solo el test de manejo de errores pisa
// `armarZipDocumentacionActividad` con `mockRejectedValueOnce` para forzar el catch de
// `PacienteDocumentosChecklist` sin depender de romper `fetch`/JSZip por dentro (que ya están
// manejados como fallo PARCIAL, no error, por diseño — ver exportacionZip.test.ts).
vi.mock('./exportacionZip', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./exportacionZip')>();
  return { ...actual, armarZipDocumentacionActividad: vi.fn(actual.armarZipDocumentacionActividad) };
});

// documentos-transferencia-actividad (tasks.md §6): el mock persiste en un Map de sesión sin
// reset entre tests — mismo criterio que `mockDocumentoRepository.test.ts`, cada test usa un
// pacienteId único para no pisar el store de otro.
let contadorPacienteTransferencia = 0;
function pacienteIdUnico(): string {
  contadorPacienteTransferencia += 1;
  return `paciente-transferencia-${Date.now()}-${contadorPacienteTransferencia}`;
}

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
  checklist: [
    { id: 'item-1', nombre: 'RHC', requerido: true },
    { id: 'item-2', nombre: 'Consentimiento informado', requerido: true },
  ],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

function buildObraSocialRepository(overrides: Partial<ObraSocialRepository> = {}): ObraSocialRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(osecac),
    create: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

function buildDocumentoRepository(overrides: Partial<DocumentoRepository> = {}): DocumentoRepository {
  return {
    listByEntity: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    remove: vi.fn(),
    resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
    transferirAgrupacion: vi.fn(),
    ...overrides,
  };
}

describe('PacienteDocumentos', () => {
  it('sin obra social asignada, muestra un estado vacío explícito (no un checklist genérico)', () => {
    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId={null}
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        direcciones={[]}
      />,
    );

    expect(screen.getByText(/no tiene una obra social asignada/i)).toBeInTheDocument();
  });

  it('mientras resuelve la obra social, muestra un estado de carga', () => {
    const obraSocialRepository = buildObraSocialRepository({
      getById: vi.fn(() => new Promise<ObraSocial | null>(() => {})),
    });

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={obraSocialRepository}
        documentoRepository={buildDocumentoRepository()}
        direcciones={[]}
      />,
    );

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('obra social sin checklist configurado muestra un estado vacío explícito (triangulación)', async () => {
    const sinChecklist: ObraSocial = { ...osecac, checklist: [] };
    const obraSocialRepository = buildObraSocialRepository({ getById: vi.fn().mockResolvedValue(sinChecklist) });

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={obraSocialRepository}
        documentoRepository={buildDocumentoRepository()}
        direcciones={[]}
      />,
    );

    expect(await screen.findByText(/no tiene.*checklist|sin checklist/i)).toBeInTheDocument();
  });

  it('con checklist configurado, muestra los ítems de la obra social del paciente en su orden', async () => {
    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        direcciones={[]}
      />,
    );

    expect(await screen.findByText('RHC')).toBeInTheDocument();
    expect(screen.getByText('Consentimiento informado')).toBeInTheDocument();
  });

  it('consulta los documentos del paciente por entidad "paciente" y su id', async () => {
    const doc: DocumentoAdjunto = { id: 'doc-1', itemId: 'item-1', nombreArchivo: 'rhc.pdf', subidoEn: '2026-07-01' };
    const documentoRepository = buildDocumentoRepository({ listByEntity: vi.fn().mockResolvedValue([doc]) });

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
        direcciones={[]}
      />,
    );

    expect(await screen.findByText(/rhc\.pdf/i)).toBeInTheDocument();
    expect(documentoRepository.listByEntity).toHaveBeenCalledWith('paciente', 'paciente-1');
  });

  // pacientes-documentos-multiples (tasks.md 5.1): escenario central del change — feedback real
  // de la clienta (Andrea Pastor). Dos documentos del mismo tipo (ej. presupuesto agosto-julio
  // actual + su renovación) conviven visibles, ninguno se sobrescribe.
  it('dos documentos del mismo tipo conviven visibles sin sobrescribirse (escenario central de pacientes-documentos-multiples)', async () => {
    const actual: DocumentoAdjunto = {
      id: 'doc-actual',
      itemId: 'item-1',
      nombreArchivo: 'rhc-2025.pdf',
      subidoEn: '2025-08-01',
      vigenciaDesde: '2025-08-01',
    };
    const renovacion: DocumentoAdjunto = {
      id: 'doc-renovacion',
      itemId: 'item-1',
      nombreArchivo: 'rhc-2026.pdf',
      subidoEn: '2026-07-30',
      vigenciaDesde: '2099-08-01',
    };
    const documentoRepository = buildDocumentoRepository({
      listByEntity: vi.fn().mockResolvedValue([actual, renovacion]),
    });

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
        direcciones={[]}
      />,
    );

    expect(await screen.findByText(/rhc-2025\.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/rhc-2026\.pdf/i)).toBeInTheDocument();
  });
});

// Gateo de escritura (gateo-pacientes, design.md D3, tasks.md 5.1/5.2). Solo la carga y baja de
// documentos (DocumentChecklist.readOnly, ya existente y reutilizado tal cual — el mecanismo
// compartido de gateo-obrasocial NO se toca) se gatea; consultar/descargar sigue disponible con
// `read` porque la RLS del servidor ya autoriza esa lectura — el gateo del cliente nunca debe ser
// más restrictivo que eso (design.md riesgos).
describe('PacienteDocumentos — gateo de escritura', () => {
  it('sin permiso de escritura: "Subir" y "Quitar" quedan deshabilitados, pero el documento ya cargado sigue siendo consultable', async () => {
    const doc: DocumentoAdjunto = { id: 'doc-1', itemId: 'item-1', nombreArchivo: 'rhc.pdf', subidoEn: '2026-07-01' };
    const documentoRepository = buildDocumentoRepository({ listByEntity: vi.fn().mockResolvedValue([doc]) });

    renderConPermiso(
      false,
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
        direcciones={[]}
      />,
    );

    // Consultar sigue disponible con solo `read` (D3): el archivo cargado sigue visible.
    expect(await screen.findByText(/rhc\.pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /quitar rhc/i })).toBeDisabled();
    // El ítem sin cargar todavía ("Consentimiento informado") también sigue legible.
    expect(screen.getByText('Consentimiento informado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subir/i })).toBeDisabled();
  });

  it('con permiso de escritura: "Subir", "Reemplazar" y "Quitar" están activables (triangulación), y el checklist se renderiza completo', async () => {
    const doc: DocumentoAdjunto = { id: 'doc-1', itemId: 'item-1', nombreArchivo: 'rhc.pdf', subidoEn: '2026-07-01' };
    const documentoRepository = buildDocumentoRepository({ listByEntity: vi.fn().mockResolvedValue([doc]) });

    renderConPermiso(
      true,
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
        direcciones={[]}
      />,
    );

    expect(await screen.findByText(/rhc\.pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /quitar rhc/i })).toBeEnabled();
    expect(screen.getByText('Consentimiento informado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subir/i })).toBeEnabled();
  });
});

// Rol admin sin filas de permisos (design.md D5): el contexto ya resolvió el short-circuit de
// admin (probado de punta a punta en usePuedeEscribir.test.tsx, gateo-obrasocial tasks.md 2.2) —
// acá solo se confirma que PacienteDocumentos consume ese resultado.
describe('PacienteDocumentos — rol admin sin filas de permisos', () => {
  it('con puedeEscribir true (equivalente al short-circuit de admin sin filas): carga y baja de documentos operativas', async () => {
    renderConPermiso(
      true,
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        direcciones={[]}
      />,
    );

    expect(await screen.findByText('RHC')).toBeInTheDocument();
    for (const boton of screen.getAllByRole('button', { name: /^subir$/i })) {
      expect(boton).toBeEnabled();
    }
  });
});

// documentos-checklist-por-actividad (tasks.md §3, design.md D1/Checkpoint (c) VEREDICTO): N
// checklists por composición, uno por actividad del paciente, más un bloque "General" que
// convive con ellos para la documentación que no pertenece a ninguna actividad puntual.
//
// Repository "de verdad" para estos tests (no un stub que ignore `agrupacionId`): replica
// exactamente la regla de `mockDocumentoRepository.listByEntity` (§2, ya implementado) —
// `agrupacionId === undefined` devuelve solo los documentos sin agrupación (bloque "General"),
// nunca todos los documentos de la entidad.
// documentos-checklist-items-por-actividad (tasks.md §6): repository de configuración por tipo de
// actividad — por default `listAll` resuelve `{}` (sin ninguna configuración, el default
// documentado, design.md D2), mismo criterio que `buildObraSocialRepository`/`buildDocumentoRepository`.
function buildRequisitosActividadRepository(overrides: Partial<RequisitosActividadRepository> = {}): RequisitosActividadRepository {
  return {
    listAll: vi.fn().mockResolvedValue({}),
    actualizar: vi.fn(),
    ...overrides,
  };
}

function buildRepositorioConAgrupacion(seed: DocumentoAdjunto[] = []): DocumentoRepository {
  return {
    listByEntity: vi.fn((_entidad, _entidadId, agrupacionId) =>
      Promise.resolve(seed.filter((doc) => doc.agrupacionId === agrupacionId)),
    ),
    upload: vi.fn(),
    remove: vi.fn(),
    resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
    transferirAgrupacion: vi.fn(),
  };
}

describe('PacienteDocumentos — checklist por actividad', () => {
  it('sin actividades registradas: muestra un estado vacío explícito que invita a cargar una dirección, nunca N=0 bloques sin explicación (tasks.md 3.4)', async () => {
    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        direcciones={[]}
      />,
    );

    // El bloque "General" sigue existiendo siempre (tasks.md 3.5), aunque no haya actividades.
    expect(await screen.findByRole('group', { name: /documentación general/i })).toBeInTheDocument();
    expect(
      screen.getByText(/no tiene actividades registradas|cargá una dirección/i),
    ).toBeInTheDocument();
  });

  it('un domicilio solo (sin actividades no-domicilio) también cae en el estado vacío de actividades (triangulación de 3.4)', async () => {
    const domicilio: Direccion = { id: 'dir-casa', tipo: 'domicilio', calle: 'Mi Casa 123', localidad: 'CABA' };

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        direcciones={[domicilio]}
      />,
    );

    expect(await screen.findByText(/no tiene actividades registradas|cargá una dirección/i)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^domicilio/i })).not.toBeInTheDocument();
  });

  it('el bloque "General" se renderiza primero, antes de los bloques por actividad (tasks.md 3.5)', async () => {
    const escuela: Direccion = { id: 'dir-escuela', tipo: 'escuela', calle: 'Calle Escuela 1', localidad: 'CABA' };
    const terapia: Direccion = {
      id: 'dir-terapia',
      tipo: 'terapia',
      calle: 'Calle Terapia 1',
      localidad: 'CABA',
      descripcion: 'Kinesióloga',
    };

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        direcciones={[escuela, terapia]}
      />,
    );

    const encabezados = (await screen.findAllByRole('heading', { level: 3 })).map((h) => h.textContent);
    expect(encabezados).toEqual(['Documentación general', 'Escuela', 'Terapia — Kinesióloga']);
  });

  // Escenario central del change (tasks.md 3.7, spec: "Los documentos de una actividad no se
  // filtran a otra"). Paciente con escuela + dos terapias distinguibles por descripción: subir un
  // documento en la primera terapia no debe aparecer en la segunda, ni en la escuela, ni en el
  // bloque "General".
  it('un documento cargado en una terapia no aparece en la otra terapia, ni en la escuela, ni en "General" (triangulación central, tasks.md 3.7)', async () => {
    const escuela: Direccion = { id: 'dir-escuela', tipo: 'escuela', calle: 'Calle Escuela 1', localidad: 'CABA' };
    const kinesiologa: Direccion = {
      id: 'dir-kine',
      tipo: 'terapia',
      calle: 'Calle Terapia 1',
      localidad: 'CABA',
      descripcion: 'Kinesióloga',
    };
    const fonoaudiologa: Direccion = {
      id: 'dir-fono',
      tipo: 'terapia',
      calle: 'Calle Terapia 2',
      localidad: 'CABA',
      descripcion: 'Fonoaudióloga',
    };

    const docEnKinesiologa: DocumentoAdjunto = {
      id: 'doc-kine-1',
      itemId: 'item-1',
      nombreArchivo: 'presupuesto-kinesiologa.pdf',
      subidoEn: '2026-07-01',
      agrupacionId: 'dir-kine',
    };
    const documentoRepository = buildRepositorioConAgrupacion([docEnKinesiologa]);

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
        direcciones={[escuela, kinesiologa, fonoaudiologa]}
      />,
    );

    const bloqueKine = await screen.findByRole('group', { name: /terapia — kinesióloga/i });
    const bloqueFono = screen.getByRole('group', { name: /terapia — fonoaudióloga/i });
    const bloqueEscuela = screen.getByRole('group', { name: /^escuela$/i });
    const bloqueGeneral = screen.getByRole('group', { name: /documentación general/i });

    // Espera a que el documento cargue en su bloque antes de afirmar ausencia en los demás — las
    // N instancias resuelven su propia promesa de forma independiente (useDocumentChecklist),
    // `findByText` espera a que termine, en vez de asumir que ya resolvió por haber esperado el
    // `group` de arriba.
    expect(await within(bloqueKine).findByText(/presupuesto-kinesiologa\.pdf/i)).toBeInTheDocument();
    expect(within(bloqueFono).queryByText(/presupuesto-kinesiologa\.pdf/i)).not.toBeInTheDocument();
    expect(within(bloqueEscuela).queryByText(/presupuesto-kinesiologa\.pdf/i)).not.toBeInTheDocument();
    expect(within(bloqueGeneral).queryByText(/presupuesto-kinesiologa\.pdf/i)).not.toBeInTheDocument();

    // El ítem correspondiente sigue figurando como no cargado en las otras actividades (spec:
    // "el ítem correspondiente de la segunda actividad sigue figurando como no cargado").
    expect(within(bloqueFono).getByText('RHC')).toBeInTheDocument();
    expect(within(bloqueFono).getAllByText(/^falta$/i).length).toBeGreaterThan(0);
  });
});

// documentos-checklist-por-actividad (tasks.md 5.1, design.md Checkpoint (f) VEREDICTO opción A):
// progreso por actividad (ya existe, sin cambios: cada `DocumentChecklist` sigue mostrando su
// propia barra) + un total agregado NUEVO en el encabezado de PacienteDocumentos.tsx, sumando la
// General + las N actividades vía la función pura `agregarProgreso` (progresoDocumental.ts).
describe('PacienteDocumentos — progreso agregado en el encabezado (tasks.md 5.1)', () => {
  it('sin actividades: el total agregado es solo el del bloque "General" (0 de 2, sin documentos)', async () => {
    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        direcciones={[]}
      />,
    );

    expect(await screen.findByText(/0 de 2 documentos cargados en total/i)).toBeInTheDocument();
  });

  it('con una actividad completa y la General vacía: el total agregado suma ambas instancias (2 de 4, 50%)', async () => {
    const kinesiologa: Direccion = {
      id: 'dir-kine',
      tipo: 'terapia',
      calle: 'Calle Terapia 1',
      localidad: 'CABA',
      descripcion: 'Kinesióloga',
    };
    const docRhc: DocumentoAdjunto = {
      id: 'doc-rhc',
      itemId: 'item-1',
      nombreArchivo: 'rhc.pdf',
      subidoEn: '2026-07-01',
      agrupacionId: 'dir-kine',
    };
    const docConsentimiento: DocumentoAdjunto = {
      id: 'doc-consentimiento',
      itemId: 'item-2',
      nombreArchivo: 'consentimiento.pdf',
      subidoEn: '2026-07-01',
      agrupacionId: 'dir-kine',
    };
    const documentoRepository = buildRepositorioConAgrupacion([docRhc, docConsentimiento]);

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
        direcciones={[kinesiologa]}
      />,
    );

    // 2 instancias (General + Kinesióloga) × 2 ítems = 4 en total; los 2 de la actividad están
    // cargados, los 2 de "General" no — total agregado: 2 de 4 (50%). `findByText` (no `getByText`):
    // el grupo agregado aparece apenas la primera instancia reporta, con `cargados=0` todavía
    // (antes de que resuelvan sus promesas) — hay que esperar a que el texto se actualice, no solo
    // a que el grupo exista.
    const bloqueTotal = await screen.findByRole('group', { name: /progreso total de documentación/i });
    expect(await within(bloqueTotal).findByText(/2 de 4 documentos cargados en total/i)).toBeInTheDocument();
    expect(within(bloqueTotal).getByText(/50%/)).toBeInTheDocument();
  });

  it('con todas las instancias completas: el total agregado llega a 100% (triangulación)', async () => {
    const escuela: Direccion = { id: 'dir-escuela', tipo: 'escuela', calle: 'Calle Escuela 1', localidad: 'CABA' };
    const docsCompletos: DocumentoAdjunto[] = [
      { id: 'doc-gen-1', itemId: 'item-1', nombreArchivo: 'rhc-general.pdf', subidoEn: '2026-07-01' },
      { id: 'doc-gen-2', itemId: 'item-2', nombreArchivo: 'consentimiento-general.pdf', subidoEn: '2026-07-01' },
      { id: 'doc-esc-1', itemId: 'item-1', nombreArchivo: 'rhc-escuela.pdf', subidoEn: '2026-07-01', agrupacionId: 'dir-escuela' },
      { id: 'doc-esc-2', itemId: 'item-2', nombreArchivo: 'consentimiento-escuela.pdf', subidoEn: '2026-07-01', agrupacionId: 'dir-escuela' },
    ];
    const documentoRepository = buildRepositorioConAgrupacion(docsCompletos);

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
        direcciones={[escuela]}
      />,
    );

    const bloqueTotal = await screen.findByRole('group', { name: /progreso total de documentación/i });
    expect(await within(bloqueTotal).findByText(/4 de 4 documentos cargados en total/i)).toBeInTheDocument();
    expect(within(bloqueTotal).getByText(/100%/)).toBeInTheDocument();
  });
});

// documentos-checklist-por-actividad (tasks.md 5.2, design.md Checkpoint (f) nota de UX): los
// bloques de actividad (no "General", que no se multiplica por N) son colapsables — arrancan
// colapsados si ya están completos, para no alargar la pantalla con bloques que no necesitan
// atención. Reusa `SeccionPlegable` (ya usado en facturacion) en vez de markup ad-hoc.
describe('PacienteDocumentos — bloques de actividad colapsables (tasks.md 5.2)', () => {
  it('una actividad completa arranca colapsada (aria-expanded=false)', async () => {
    const kinesiologa: Direccion = {
      id: 'dir-kine',
      tipo: 'terapia',
      calle: 'Calle Terapia 1',
      localidad: 'CABA',
      descripcion: 'Kinesióloga',
    };
    const docRhc: DocumentoAdjunto = { id: 'doc-rhc', itemId: 'item-1', nombreArchivo: 'rhc.pdf', subidoEn: '2026-07-01', agrupacionId: 'dir-kine' };
    const docConsentimiento: DocumentoAdjunto = {
      id: 'doc-consentimiento',
      itemId: 'item-2',
      nombreArchivo: 'consentimiento.pdf',
      subidoEn: '2026-07-01',
      agrupacionId: 'dir-kine',
    };
    const documentoRepository = buildRepositorioConAgrupacion([docRhc, docConsentimiento]);

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
        direcciones={[kinesiologa]}
      />,
    );

    const bloqueKine = await screen.findByRole('group', { name: /terapia — kinesióloga/i });
    // `SeccionPlegable` nunca desmonta el contenido al colapsar (usa `grid-template-rows`, no
    // renderizado condicional — ver su comentario), así que el documento sigue siendo consultable
    // por testing-library aunque el bloque esté visualmente colapsado.
    expect(await within(bloqueKine).findByText(/rhc\.pdf/i)).toBeInTheDocument();
    // La decisión de colapso se toma en un efecto separado (depende de `loading`), que se
    // confirma en un commit posterior al que pinta "rhc.pdf" — `waitFor` reintenta hasta que ese
    // segundo commit ocurrió, en vez de asumir que ambos pasan juntos (no es así: son dos
    // `useEffect` distintos sobre la misma actualización de `documentos`).
    await waitFor(() => {
      expect(within(bloqueKine).getByRole('button', { name: /terapia — kinesióloga/i })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });
  });

  it('una actividad incompleta arranca expandida (aria-expanded=true) — triangulación', async () => {
    const kinesiologa: Direccion = {
      id: 'dir-kine',
      tipo: 'terapia',
      calle: 'Calle Terapia 1',
      localidad: 'CABA',
      descripcion: 'Kinesióloga',
    };
    // Solo un ítem cargado de dos — actividad incompleta.
    const docRhc: DocumentoAdjunto = { id: 'doc-rhc', itemId: 'item-1', nombreArchivo: 'rhc.pdf', subidoEn: '2026-07-01', agrupacionId: 'dir-kine' };
    const documentoRepository = buildRepositorioConAgrupacion([docRhc]);

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
        direcciones={[kinesiologa]}
      />,
    );

    const bloqueKine = await screen.findByRole('group', { name: /terapia — kinesióloga/i });
    // Espera a que el documento ya cargado esté visible (misma señal de "terminó de resolver" que
    // usan los demás tests de este archivo) antes de leer `aria-expanded`, que se decide recién
    // cuando `loading` pasa a `false`.
    expect(await within(bloqueKine).findByText(/rhc\.pdf/i)).toBeInTheDocument();
    const toggle = within(bloqueKine).getByRole('button', { name: /terapia — kinesióloga/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('colapsar y volver a expandir un bloque de actividad no pierde el estado del checklist (el documento sigue cargado al reabrir)', async () => {
    const user = userEvent.setup();
    const kinesiologa: Direccion = {
      id: 'dir-kine',
      tipo: 'terapia',
      calle: 'Calle Terapia 1',
      localidad: 'CABA',
      descripcion: 'Kinesióloga',
    };
    // Incompleta a propósito (arranca expandida) para poder colapsarla manualmente y verificar
    // que reabrirla no perdió nada — si arrancara ya colapsada no probaría la interacción.
    const docRhc: DocumentoAdjunto = { id: 'doc-rhc', itemId: 'item-1', nombreArchivo: 'rhc.pdf', subidoEn: '2026-07-01', agrupacionId: 'dir-kine' };
    const documentoRepository = buildRepositorioConAgrupacion([docRhc]);

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
        direcciones={[kinesiologa]}
      />,
    );

    const bloqueKine = await screen.findByRole('group', { name: /terapia — kinesióloga/i });
    expect(await within(bloqueKine).findByText(/rhc\.pdf/i)).toBeInTheDocument();

    const toggle = within(bloqueKine).getByRole('button', { name: /terapia — kinesióloga/i });
    await user.click(toggle); // colapsa
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle); // vuelve a expandir

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // El documento sigue vivo — no se perdió estado ni se volvió a pedir al repository.
    expect(within(bloqueKine).getByText(/rhc\.pdf/i)).toBeInTheDocument();
    expect(within(bloqueKine).getByText('RHC')).toBeInTheDocument();
    expect(within(bloqueKine).getByText('Consentimiento informado')).toBeInTheDocument();
    expect(documentoRepository.listByEntity).toHaveBeenCalledTimes(2); // 1 vez por instancia (General + Kine), no una vez más por togglear.
  });
});

// documentos-transferencia-actividad (tasks.md 2.6, §12): el botón "Exportar" arma un `.zip` con
// los archivos reales de la actividad (ver el describe de más abajo, "exportar un .zip"). Vive en
// el encabezado de cada bloque de ACTIVIDAD (no en "General"), sin exigir permiso de escritura
// (Checkpoint (g): alcanza con lectura). El botón "Ver resumen" (detalle imprimible, §2/§11, con
// el embebido de §14) que en su momento convivía acá se sacó por completo — REVERTIDO
// (2026-08-11, decisión de la usuaria: "siento que no tiene utilidad"). Los tres describe blocks
// que cubrían "Ver resumen"/"Imprimir"/el embebido se borraron junto con el código que probaban.
// documentos-transferencia-actividad (tasks.md §12): "Exportar" arma un `.zip` (vía
// `armarZipDocumentacionActividad`) y dispara la descarga en el navegador — es la única acción de
// exportación que queda tras revertir "Ver resumen"/"Imprimir" (ver comentario arriba).
describe('PacienteDocumentos — exportar un .zip con los archivos reales de una actividad (tasks.md §12)', () => {
  const kinesiologa: Direccion = {
    id: 'dir-kine',
    tipo: 'terapia',
    calle: 'Calle 818',
    localidad: 'CABA',
    descripcion: 'Kinesióloga',
  };

  function buildRepositorioConPrevisualizacion(
    seed: DocumentoAdjunto[],
    urlPorDocumentoId: Record<string, string | null>,
  ): DocumentoRepository {
    return {
      listByEntity: vi.fn((_entidad, _entidadId, agrupacionId) =>
        Promise.resolve(seed.filter((doc) => doc.agrupacionId === agrupacionId)),
      ),
      upload: vi.fn(),
      remove: vi.fn(),
      resolverPrevisualizacion: vi.fn((_entidad, _entidadId, documentoId: string) =>
        Promise.resolve(urlPorDocumentoId[documentoId] ?? null),
      ),
      transferirAgrupacion: vi.fn(),
    };
  }

  it('un bloque de actividad ofrece "Exportar"; el bloque "General" no lo ofrece', async () => {
    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        pacienteNombre="Pérez, Juan"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        direcciones={[kinesiologa]}
      />,
    );

    const bloqueKine = await screen.findByRole('group', { name: /terapia — kinesióloga/i });
    expect(within(bloqueKine).getByRole('button', { name: /^exportar$/i })).toBeInTheDocument();

    const bloqueGeneral = screen.getByRole('group', { name: /documentación general/i });
    expect(within(bloqueGeneral).queryByRole('button', { name: /exportar/i })).not.toBeInTheDocument();
  });

  it('sin permiso de escritura, "Exportar" sigue disponible (Checkpoint (g): alcanza con lectura)', async () => {
    renderConPermiso(
      false,
      <PacienteDocumentos
        pacienteId="paciente-1"
        pacienteNombre="Pérez, Juan"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        direcciones={[kinesiologa]}
      />,
    );

    const bloqueKine = await screen.findByRole('group', { name: /terapia — kinesióloga/i });
    expect(within(bloqueKine).getByRole('button', { name: /^exportar$/i })).toBeEnabled();
  });

  it('clickear "Exportar" arma el zip y dispara la descarga en el navegador', async () => {
    const user = userEvent.setup();
    const docRhc: DocumentoAdjunto = { id: 'doc-rhc', itemId: 'item-1', nombreArchivo: 'rhc.pdf', subidoEn: '2026-07-01', agrupacionId: 'dir-kine' };
    const documentoRepository = buildRepositorioConPrevisualizacion([docRhc], { 'doc-rhc': 'blob://rhc' });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob(['contenido-rhc'], { type: 'application/pdf' })),
    } as Response);
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://zip-generado');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        pacienteNombre="Pérez, Juan"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
        direcciones={[kinesiologa]}
      />,
    );

    const bloqueKine = await screen.findByRole('group', { name: /terapia — kinesióloga/i });
    expect(await within(bloqueKine).findByText(/rhc\.pdf/i)).toBeInTheDocument();

    await user.click(within(bloqueKine).getByRole('button', { name: /^exportar$/i }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(fetchSpy).toHaveBeenCalledWith('blob://rhc');
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalled();
    // Ningún overlay se abrió — "Exportar" descarga el zip directamente, sin diálogo intermedio.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fetchSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('mientras arma el zip, "Exportar" se deshabilita y muestra "Exportando…"; vuelve a habilitarse al terminar', async () => {
    const user = userEvent.setup();
    const docRhc: DocumentoAdjunto = { id: 'doc-rhc', itemId: 'item-1', nombreArchivo: 'rhc.pdf', subidoEn: '2026-07-01', agrupacionId: 'dir-kine' };

    let resolverPrevisualizacionPromise!: (value: string | null) => void;
    const documentoRepository: DocumentoRepository = {
      listByEntity: vi.fn((_entidad, _entidadId, agrupacionId) =>
        Promise.resolve([docRhc].filter((doc) => doc.agrupacionId === agrupacionId)),
      ),
      upload: vi.fn(),
      remove: vi.fn(),
      resolverPrevisualizacion: vi.fn(
        () => new Promise<string | null>((resolve) => { resolverPrevisualizacionPromise = resolve; }),
      ),
      transferirAgrupacion: vi.fn(),
    };
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://zip-generado');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        pacienteNombre="Pérez, Juan"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
        direcciones={[kinesiologa]}
      />,
    );

    const bloqueKine = await screen.findByRole('group', { name: /terapia — kinesióloga/i });
    expect(await within(bloqueKine).findByText(/rhc\.pdf/i)).toBeInTheDocument();

    const botonExportar = within(bloqueKine).getByRole('button', { name: /^exportar$/i });
    await user.click(botonExportar);

    // Todavía no se resolvió resolverPrevisualizacion — el botón queda en estado de carga.
    expect(await within(bloqueKine).findByRole('button', { name: /exportando/i })).toBeDisabled();

    // El documento no está disponible para previsualizar (resuelve null) — el zip se arma igual
    // (con `_pendientes.txt`), lo que importa acá es solo el ciclo del estado de carga.
    resolverPrevisualizacionPromise(null);

    await waitFor(() =>
      expect(within(bloqueKine).getByRole('button', { name: /^exportar$/i })).toBeEnabled(),
    );

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('un fallo al armar el zip muestra un mensaje en castellano vía Alert, sin texto crudo de fetch/Storage', async () => {
    const user = userEvent.setup();
    const docRhc: DocumentoAdjunto = { id: 'doc-rhc', itemId: 'item-1', nombreArchivo: 'rhc.pdf', subidoEn: '2026-07-01', agrupacionId: 'dir-kine' };
    const documentoRepository = buildRepositorioConPrevisualizacion([docRhc], { 'doc-rhc': 'blob://rhc' });

    // `armarZipDocumentacionActividad` maneja el fallo de UN documento como PARCIAL (nunca
    // lanza) — para ejercitar el catch de `PacienteDocumentosChecklist` (el caso "algo
    // imprevisto rompió el armado entero") se fuerza un rechazo con `mockRejectedValueOnce` sobre
    // la función completa, no sobre `fetch`. `TypeError` con texto crudo de red, a propósito —
    // confirma que la UI NO lo repite tal cual, lo traduce.
    vi.mocked(armarZipDocumentacionActividad).mockRejectedValueOnce(
      new TypeError('NetworkError when attempting to fetch resource.'),
    );

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        pacienteNombre="Pérez, Juan"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
        direcciones={[kinesiologa]}
      />,
    );

    const bloqueKine = await screen.findByRole('group', { name: /terapia — kinesióloga/i });
    expect(await within(bloqueKine).findByText(/rhc\.pdf/i)).toBeInTheDocument();

    await user.click(within(bloqueKine).getByRole('button', { name: /^exportar$/i }));

    const alerta = await within(bloqueKine).findByRole('alert');
    expect(alerta.textContent).not.toMatch(/NetworkError|fetch|Storage/i);
    expect(alerta.textContent?.toLowerCase()).toContain('no se pudo armar');

    // El botón vuelve a habilitarse — el error no lo deja colgado.
    expect(within(bloqueKine).getByRole('button', { name: /^exportar$/i })).toBeEnabled();
  });
});

// documentos-transferencia-actividad (tasks.md §6, design.md D6, Checkpoint (c)/(d)/(g) VEREDICTO):
// integración de punta a punta contra el mock REAL (no un stub) — ejercita `transferirAgrupacion`
// tal como lo llamaría la UI real, y verifica el refresco cruzado entre los dos bloques afectados
// sin recargar la pantalla (spec `paciente-documentos-transferencia`).
describe('PacienteDocumentos — transferir un documento entre actividades (tasks.md §6)', () => {
  const kinesiologa: Direccion = { id: 'dir-kine', tipo: 'terapia', calle: 'Calle 818', localidad: 'CABA', descripcion: 'Kinesióloga' };
  const fonoaudiologa: Direccion = { id: 'dir-fono', tipo: 'terapia', calle: 'Calle 254', localidad: 'CABA', descripcion: 'Fonoaudióloga' };

  it('transferir de una actividad a otra: el documento deja de figurar en el origen y pasa a figurar en el destino, sin recargar (tasks.md 6.4/6.5/6.7)', async () => {
    const user = userEvent.setup();
    const pacienteId = pacienteIdUnico();
    const doc = await mockDocumentoRepository.upload('paciente', pacienteId, 'item-1', new File(['x'], 'rhc.pdf', { type: 'application/pdf' }), undefined, 'dir-kine');

    render(
      <PacienteDocumentos
        pacienteId={pacienteId}
        pacienteNombre="Pérez, Juan"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={mockDocumentoRepository}
        direcciones={[kinesiologa, fonoaudiologa]}
      />,
    );

    const bloqueKine = await screen.findByRole('group', { name: /terapia — kinesióloga/i });
    expect(await within(bloqueKine).findByText(/rhc\.pdf/i)).toBeInTheDocument();

    await user.click(within(bloqueKine).getByRole('button', { name: /transferir rhc/i }));

    const dialogo = await screen.findByRole('dialog');
    // La confirmación identifica documento, origen y destino, distinguiendo actividades del mismo
    // tipo (spec: "sin ambigüedad entre dos actividades del mismo tipo").
    expect(within(dialogo).getByText(/rhc\.pdf/i)).toBeInTheDocument();
    expect(within(dialogo).getByText(/Terapia — Kinesióloga/)).toBeInTheDocument();

    const select = within(dialogo).getByLabelText(/destino|actividad/i);
    await user.selectOptions(select, fonoaudiologa.id);
    await user.click(within(dialogo).getByRole('button', { name: /^transferir$/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const bloqueFono = screen.getByRole('group', { name: /terapia — fonoaudióloga/i });
    expect(await within(bloqueFono).findByText(/rhc\.pdf/i)).toBeInTheDocument();
    expect(within(bloqueKine).queryByText(/rhc\.pdf/i)).not.toBeInTheDocument();
    expect(doc.id).toEqual(expect.any(String)); // referencia usada arriba, evita "unused"
  });

  it('el total agregado del paciente no cambia por una transferencia (tasks.md 6.8)', async () => {
    const user = userEvent.setup();
    const pacienteId = pacienteIdUnico();
    await mockDocumentoRepository.upload('paciente', pacienteId, 'item-1', new File(['x'], 'rhc.pdf', { type: 'application/pdf' }), undefined, 'dir-kine');

    render(
      <PacienteDocumentos
        pacienteId={pacienteId}
        pacienteNombre="Pérez, Juan"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={mockDocumentoRepository}
        direcciones={[kinesiologa, fonoaudiologa]}
      />,
    );

    const bloqueKine = await screen.findByRole('group', { name: /terapia — kinesióloga/i });
    expect(await within(bloqueKine).findByText(/rhc\.pdf/i)).toBeInTheDocument();
    const totalAntes = await screen.findByText(/documentos cargados en total/i);
    // 3 instancias (General + Kinesióloga + Fonoaudióloga) × 2 ítems = 6 en total.
    expect(totalAntes.textContent).toMatch(/1 de 6/);

    await user.click(within(bloqueKine).getByRole('button', { name: /transferir rhc/i }));
    const dialogo = await screen.findByRole('dialog');
    await user.selectOptions(within(dialogo).getByLabelText(/destino|actividad/i), fonoaudiologa.id);
    await user.click(within(dialogo).getByRole('button', { name: /^transferir$/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const totalDespues = await screen.findByText(/documentos cargados en total/i);
    expect(totalDespues.textContent).toMatch(/1 de 6/);
  });

  it('cancelar la transferencia no modifica nada (tasks.md 6.5)', async () => {
    const user = userEvent.setup();
    const pacienteId = pacienteIdUnico();
    await mockDocumentoRepository.upload('paciente', pacienteId, 'item-1', new File(['x'], 'rhc.pdf', { type: 'application/pdf' }), undefined, 'dir-kine');

    render(
      <PacienteDocumentos
        pacienteId={pacienteId}
        pacienteNombre="Pérez, Juan"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={mockDocumentoRepository}
        direcciones={[kinesiologa, fonoaudiologa]}
      />,
    );

    const bloqueKine = await screen.findByRole('group', { name: /terapia — kinesióloga/i });
    expect(await within(bloqueKine).findByText(/rhc\.pdf/i)).toBeInTheDocument();

    await user.click(within(bloqueKine).getByRole('button', { name: /transferir rhc/i }));
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: /cancelar/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(bloqueKine).getByText(/rhc\.pdf/i)).toBeInTheDocument();
    const bloqueFono = screen.getByRole('group', { name: /terapia — fonoaudióloga/i });
    expect(within(bloqueFono).queryByText(/rhc\.pdf/i)).not.toBeInTheDocument();
  });

  it('los destinos ofrecidos son solo las otras actividades del mismo paciente + General, nunca la actividad de origen (tasks.md 6.3)', async () => {
    const user = userEvent.setup();
    const pacienteId = pacienteIdUnico();
    await mockDocumentoRepository.upload('paciente', pacienteId, 'item-1', new File(['x'], 'rhc.pdf', { type: 'application/pdf' }), undefined, 'dir-kine');

    render(
      <PacienteDocumentos
        pacienteId={pacienteId}
        pacienteNombre="Pérez, Juan"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={mockDocumentoRepository}
        direcciones={[kinesiologa, fonoaudiologa]}
      />,
    );

    const bloqueKine = await screen.findByRole('group', { name: /terapia — kinesióloga/i });
    expect(await within(bloqueKine).findByText(/rhc\.pdf/i)).toBeInTheDocument();
    await user.click(within(bloqueKine).getByRole('button', { name: /transferir rhc/i }));

    const dialogo = await screen.findByRole('dialog');
    const opciones = within(dialogo)
      .getByLabelText(/destino|actividad/i)
      .querySelectorAll('option');
    const textos = Array.from(opciones).map((o) => o.textContent);

    expect(textos).toEqual(expect.arrayContaining(['Terapia — Fonoaudióloga', 'Documentación general']));
    expect(textos).not.toEqual(expect.arrayContaining(['Terapia — Kinesióloga']));
  });

  it('transferir desde "General" hacia una actividad (tasks.md 6.3/6.4)', async () => {
    const user = userEvent.setup();
    const pacienteId = pacienteIdUnico();
    await mockDocumentoRepository.upload('paciente', pacienteId, 'item-1', new File(['x'], 'rhc-general.pdf', { type: 'application/pdf' }));

    render(
      <PacienteDocumentos
        pacienteId={pacienteId}
        pacienteNombre="Pérez, Juan"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={mockDocumentoRepository}
        direcciones={[kinesiologa]}
      />,
    );

    const bloqueGeneral = await screen.findByRole('group', { name: /documentación general/i });
    expect(await within(bloqueGeneral).findByText(/rhc-general\.pdf/i)).toBeInTheDocument();

    await user.click(within(bloqueGeneral).getByRole('button', { name: /transferir rhc/i }));
    const dialogo = await screen.findByRole('dialog');
    await user.selectOptions(within(dialogo).getByLabelText(/destino|actividad/i), kinesiologa.id);
    await user.click(within(dialogo).getByRole('button', { name: /^transferir$/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const bloqueKine = screen.getByRole('group', { name: /terapia — kinesióloga/i });
    expect(await within(bloqueKine).findByText(/rhc-general\.pdf/i)).toBeInTheDocument();
    expect(within(bloqueGeneral).queryByText(/rhc-general\.pdf/i)).not.toBeInTheDocument();
  });

  it('sin permiso de escritura, "Transferir" queda deshabilitado (Checkpoint (g), tasks.md 6.6)', async () => {
    const pacienteId = pacienteIdUnico();
    await mockDocumentoRepository.upload('paciente', pacienteId, 'item-1', new File(['x'], 'rhc.pdf', { type: 'application/pdf' }), undefined, 'dir-kine');

    renderConPermiso(
      false,
      <PacienteDocumentos
        pacienteId={pacienteId}
        pacienteNombre="Pérez, Juan"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={mockDocumentoRepository}
        direcciones={[kinesiologa]}
      />,
    );

    const bloqueKine = await screen.findByRole('group', { name: /terapia — kinesióloga/i });
    expect(await within(bloqueKine).findByText(/rhc\.pdf/i)).toBeInTheDocument();
    expect(within(bloqueKine).getByRole('button', { name: /transferir rhc/i })).toBeDisabled();
  });
});

// documentos-checklist-items-por-actividad (tasks.md §6, design.md D1/D2/Checkpoint (c) VEREDICTO
// 1.4): cableado de `combinarItemsDeActividad` en cada bloque de actividad. `requisitosActividadRepository`
// es OPCIONAL a propósito (mismo criterio que `pacienteNombre`): todos los tests de arriba, que no
// lo pasan, ya son la prueba más fuerte de "el default es la lista vacía, comportamiento actual sin
// regresión" (design.md D2) — no hace falta un test bespoke para ese caso, ya está cubierto ~30
// veces.
describe('PacienteDocumentos — ítems por tipo de actividad (tasks.md §6)', () => {
  const escuela: Direccion = { id: 'dir-escuela', tipo: 'escuela', calle: 'Calle Escuela 1', localidad: 'CABA' };
  const terapia: Direccion = { id: 'dir-terapia', tipo: 'terapia', calle: 'Calle Terapia 1', localidad: 'CABA' };

  it('con ítems configurados por tipo: el bloque de una actividad de tipo escuela muestra los de la obra social MÁS los de escuela; terapia no los recibe (tasks.md 6.2)', async () => {
    const requisitosActividadRepository = buildRequisitosActividadRepository({
      listAll: vi.fn().mockResolvedValue({
        escuela: [{ id: 'item-escuela-1', nombre: 'Constancia de alumno regular', requerido: true }],
      } satisfies RequisitosPorTipo),
    });

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        requisitosActividadRepository={requisitosActividadRepository}
        direcciones={[escuela, terapia]}
      />,
    );

    const bloqueEscuela = await screen.findByRole('group', { name: /^escuela$/i });
    expect(await within(bloqueEscuela).findByText('Constancia de alumno regular')).toBeInTheDocument();
    expect(within(bloqueEscuela).getByText('RHC')).toBeInTheDocument();
    expect(within(bloqueEscuela).getByText('Consentimiento informado')).toBeInTheDocument();

    const bloqueTerapia = screen.getByRole('group', { name: /^terapia$/i });
    expect(within(bloqueTerapia).queryByText('Constancia de alumno regular')).not.toBeInTheDocument();
    expect(within(bloqueTerapia).getByText('RHC')).toBeInTheDocument();
  });

  it('con configuración cargada para todos los tipos, el bloque "General" sigue mostrando SOLO los ítems de la obra social (no-regresión, tasks.md 6.3)', async () => {
    const requisitosActividadRepository = buildRequisitosActividadRepository({
      listAll: vi.fn().mockResolvedValue({
        escuela: [{ id: 'item-escuela-1', nombre: 'Constancia de alumno regular', requerido: true }],
        terapia: [{ id: 'item-terapia-1', nombre: 'Informe del profesional', requerido: true }],
      } satisfies RequisitosPorTipo),
    });

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        requisitosActividadRepository={requisitosActividadRepository}
        direcciones={[escuela, terapia]}
      />,
    );

    const bloqueGeneral = await screen.findByRole('group', { name: /documentación general/i });
    expect(within(bloqueGeneral).getByText('RHC')).toBeInTheDocument();
    expect(within(bloqueGeneral).getByText('Consentimiento informado')).toBeInTheDocument();
    // Espera a que el resto de la pantalla haya terminado de resolver (misma señal que el resto del
    // archivo) antes de afirmar la ausencia — si no, un `queryByText` podría correr antes de que el
    // efecto de configuración por tipo siquiera dispare.
    await within(await screen.findByRole('group', { name: /^escuela$/i })).findByText('Constancia de alumno regular');
    expect(within(bloqueGeneral).queryByText('Constancia de alumno regular')).not.toBeInTheDocument();
    expect(within(bloqueGeneral).queryByText('Informe del profesional')).not.toBeInTheDocument();
  });

  it('un ítem del tipo de actividad con el mismo id que uno de la obra social no se duplica — dedup por identidad (tasks.md 6.6, design.md Checkpoint (c) VEREDICTO)', async () => {
    const requisitosActividadRepository = buildRequisitosActividadRepository({
      listAll: vi.fn().mockResolvedValue({
        escuela: [
          { id: 'item-1', nombre: 'RHC (versión escuela, ignorada)', requerido: false },
          { id: 'item-escuela-extra', nombre: 'Constancia de alumno regular', requerido: true },
        ],
      } satisfies RequisitosPorTipo),
    });

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        requisitosActividadRepository={requisitosActividadRepository}
        direcciones={[escuela]}
      />,
    );

    const bloqueEscuela = await screen.findByRole('group', { name: /^escuela$/i });
    expect(await within(bloqueEscuela).findByText('Constancia de alumno regular')).toBeInTheDocument();
    // "RHC" aparece UNA sola vez (gana el nombre de la obra social) — nunca "RHC (versión escuela,
    // ignorada)" ni un segundo "RHC" duplicado.
    expect(within(bloqueEscuela).getAllByText('RHC')).toHaveLength(1);
    expect(within(bloqueEscuela).queryByText(/versión escuela/i)).not.toBeInTheDocument();
  });

  it('el progreso agregado se calcula sobre la lista combinada y deduplicada, sin contar dos veces un ítem (tasks.md 6.6)', async () => {
    const requisitosActividadRepository = buildRequisitosActividadRepository({
      listAll: vi.fn().mockResolvedValue({
        escuela: [
          { id: 'item-1', nombre: 'RHC', requerido: true }, // dedup con la obra social, no suma
          { id: 'item-escuela-extra', nombre: 'Constancia de alumno regular', requerido: true },
        ],
      } satisfies RequisitosPorTipo),
    });

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        requisitosActividadRepository={requisitosActividadRepository}
        direcciones={[escuela]}
      />,
    );

    // General: 2 ítems (RHC, Consentimiento). Escuela combinada y deduplicada: RHC, Consentimiento,
    // Constancia = 3 (NO 4 — si no dedupara, el total sería "0 de 6").
    const bloqueTotal = await screen.findByRole('group', { name: /progreso total de documentación/i });
    expect(await within(bloqueTotal).findByText(/0 de 5 documentos cargados en total/i)).toBeInTheDocument();
  });

  it('mientras la configuración por tipo no resolvió, los bloques muestran solo los ítems de la obra social — nunca una lista a medias (tasks.md 6.5)', async () => {
    const requisitosActividadRepository = buildRequisitosActividadRepository({
      listAll: vi.fn(() => new Promise<RequisitosPorTipo>(() => {})), // nunca resuelve en este test
    });

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        requisitosActividadRepository={requisitosActividadRepository}
        direcciones={[escuela]}
      />,
    );

    const bloqueEscuela = await screen.findByRole('group', { name: /^escuela$/i });
    expect(within(bloqueEscuela).getByText('RHC')).toBeInTheDocument();
    expect(within(bloqueEscuela).getByText('Consentimiento informado')).toBeInTheDocument();
  });

  it('si la configuración por tipo falla al cargar, degrada al comportamiento actual (solo ítems de la obra social) en vez de romper la pantalla — nunca vaciar (tasks.md 6.5)', async () => {
    const requisitosActividadRepository = buildRequisitosActividadRepository({
      listAll: vi.fn().mockRejectedValue(new Error('No se pudo cargar la configuración por tipo de actividad.')),
    });

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        requisitosActividadRepository={requisitosActividadRepository}
        direcciones={[escuela]}
      />,
    );

    const bloqueEscuela = await screen.findByRole('group', { name: /^escuela$/i });
    expect(await within(bloqueEscuela).findByText('RHC')).toBeInTheDocument();
    expect(within(bloqueEscuela).getByText('Consentimiento informado')).toBeInTheDocument();
    // La pantalla entera sigue operativa — nada de esto rompe el resto (el General también sigue).
    expect(screen.getByRole('group', { name: /documentación general/i })).toBeInTheDocument();
  });

  it('comunica la procedencia de los ítems extra a nivel de BLOQUE, sin tocar el checklist compartido (tasks.md 6.7, design.md D3)', async () => {
    const requisitosActividadRepository = buildRequisitosActividadRepository({
      listAll: vi.fn().mockResolvedValue({
        escuela: [{ id: 'item-escuela-1', nombre: 'Constancia de alumno regular', requerido: true }],
      } satisfies RequisitosPorTipo),
    });

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        requisitosActividadRepository={requisitosActividadRepository}
        direcciones={[escuela]}
      />,
    );

    const bloqueEscuela = await screen.findByRole('group', { name: /^escuela$/i });
    expect(await within(bloqueEscuela).findByText(/\+1 ítem propio de esta actividad/i)).toBeInTheDocument();

    // El bloque "General" nunca recibe ítems por tipo (tasks.md 6.3) — nunca muestra procedencia.
    const bloqueGeneral = screen.getByRole('group', { name: /documentación general/i });
    expect(within(bloqueGeneral).queryByText(/ítem propio/i)).not.toBeInTheDocument();
  });

  it('sin configurar `requisitosActividadRepository` (prop opcional): comportamiento idéntico al actual, sin chip de procedencia (triangulación de compatibilidad hacia atrás)', async () => {
    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
        direcciones={[escuela]}
      />,
    );

    const bloqueEscuela = await screen.findByRole('group', { name: /^escuela$/i });
    expect(within(bloqueEscuela).getByText('RHC')).toBeInTheDocument();
    expect(within(bloqueEscuela).queryByText(/ítem propio/i)).not.toBeInTheDocument();
  });
});
