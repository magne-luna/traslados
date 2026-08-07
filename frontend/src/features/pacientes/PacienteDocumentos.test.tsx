import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { DocumentoAdjunto } from '../../shared/types/documento';
import type { Direccion } from '../../shared/types/paciente';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PacienteDocumentos } from './PacienteDocumentos';

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
function buildRepositorioConAgrupacion(seed: DocumentoAdjunto[] = []): DocumentoRepository {
  return {
    listByEntity: vi.fn((_entidad, _entidadId, agrupacionId) =>
      Promise.resolve(seed.filter((doc) => doc.agrupacionId === agrupacionId)),
    ),
    upload: vi.fn(),
    remove: vi.fn(),
    resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
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
