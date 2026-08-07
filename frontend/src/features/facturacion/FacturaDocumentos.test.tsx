import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ChecklistItem, DocumentoAdjunto, EntidadDocumental } from '../../shared/types/documento';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { FacturaDocumentos } from './FacturaDocumentos';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

const items: ChecklistItem[] = [
  { id: 'item-arca', nombre: 'Comprobante ARCA', requerido: true },
  { id: 'item-asistencia', nombre: 'Asistencia', requerido: true },
  { id: 'item-codem', nombre: 'CODEM', requerido: false },
];

function buildFakeRepository(documentos: DocumentoAdjunto[] = []): DocumentoRepository {
  return {
    listByEntity: vi.fn((_entidad: EntidadDocumental, _entidadId: string) => Promise.resolve(documentos)),
    upload: vi.fn(),
    remove: vi.fn(),
    resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
  };
}

describe('FacturaDocumentos', () => {
  it('lista los ítems del checklist en el orden recibido, con entidad="factura"', async () => {
    const repository = buildFakeRepository();
    render(<FacturaDocumentos facturaId="factura-1" items={items} repository={repository} />);

    await waitFor(() => expect(repository.listByEntity).toHaveBeenCalledWith('factura', 'factura-1'));

    const nombres = items.map((item) => item.nombre);
    const textos = screen.getAllByText(new RegExp(nombres.join('|'))).map((el) => el.textContent);
    expect(textos).toEqual(nombres);
  });

  it('muestra el aviso actualizado: la tabla documento_factura ya existe, pero la subida sigue simulada porque Factura sigue en mock', () => {
    render(<FacturaDocumentos facturaId="factura-1" items={items} repository={buildFakeRepository()} />);
    expect(screen.getByText(/modelo de datos/i)).toBeInTheDocument();
    expect(screen.getByText(/documento_factura/i)).toBeInTheDocument();
    expect(screen.getByText(/sigue.*simulada/i)).toBeInTheDocument();
    expect(screen.queryByText(/C-07.*debe crear/i)).not.toBeInTheDocument();
  });

  it('no bloquea nada visualmente aunque falten documentos requeridos (solo informa el estado)', async () => {
    render(<FacturaDocumentos facturaId="factura-1" items={items} repository={buildFakeRepository()} />);
    await waitFor(() => expect(screen.getAllByText(/falta/i).length).toBeGreaterThan(0));
  });
});

// Gateo de escritura (gateo-facturacion, design.md D4, tasks.md 6.3). Solo la carga y baja de
// documentos se gatea (DocumentChecklist.readOnly, ya existente y reutilizado tal cual — el
// mecanismo compartido de gateo-obrasocial NO se toca); consultar/descargar sigue disponible con
// `read` porque la RLS del servidor ya autoriza esa lectura.
describe('FacturaDocumentos — gateo de escritura', () => {
  it('sin permiso de escritura: "Subir" y "Quitar" quedan deshabilitados, pero el documento ya cargado sigue siendo consultable', async () => {
    const doc: DocumentoAdjunto = { id: 'doc-arca', itemId: 'item-arca', nombreArchivo: 'arca.pdf', subidoEn: '2026-07-01' };
    const repository = buildFakeRepository([doc]);

    renderConPermiso(false, <FacturaDocumentos facturaId="factura-1" items={items} repository={repository} />);

    // Consultar sigue disponible con solo `read` (D4): el archivo cargado sigue visible.
    expect(await screen.findByText(/arca\.pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /quitar comprobante arca/i })).toBeDisabled();
    // Los ítems sin cargar todavía también siguen legibles.
    expect(screen.getByText('Asistencia')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^subir$/i })[0]).toBeDisabled();
  });

  it('con permiso de escritura: "Subir", "Reemplazar" y "Quitar" están activables (triangulación), y el checklist se renderiza completo', async () => {
    const doc: DocumentoAdjunto = { id: 'doc-arca', itemId: 'item-arca', nombreArchivo: 'arca.pdf', subidoEn: '2026-07-01' };
    const repository = buildFakeRepository([doc]);

    renderConPermiso(true, <FacturaDocumentos facturaId="factura-1" items={items} repository={repository} />);

    expect(await screen.findByText(/arca\.pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /quitar comprobante arca/i })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: /^subir$/i })[0]).toBeEnabled();
  });
});

// documentos-checklist-por-actividad (tasks.md 7.2, specs/paciente-documentos/spec.md
// "Un dominio sin actividades sigue con un único checklist"): no regresión explícita. Facturas
// nunca pasa `agrupacionId` a useDocumentChecklist (design.md D1) — aunque el tipo
// `DocumentoAdjunto.agrupacionId` ahora existe (tasks.md 2.1) y el repository pudiera devolver
// documentos con ese campo poblado (dato legacy o de otra integración), este dominio los sigue
// mostrando todos juntos en un único checklist, sin bloques por actividad ni pasos adicionales.
describe('FacturaDocumentos — no regresión por agrupación (tasks.md 7.2)', () => {
  it('muestra un único checklist sin bloques por actividad, incluso si el repository devuelve documentos con agrupacionId', async () => {
    const docSinAgrupar: DocumentoAdjunto = { id: 'doc-arca', itemId: 'item-arca', nombreArchivo: 'arca.pdf', subidoEn: '2026-07-01' };
    const docConAgrupacionLegacy: DocumentoAdjunto = {
      id: 'doc-asistencia',
      itemId: 'item-asistencia',
      nombreArchivo: 'asistencia.pdf',
      subidoEn: '2026-07-02',
      agrupacionId: 'direccion-x',
    };
    const repository = buildFakeRepository([docSinAgrupar, docConAgrupacionLegacy]);

    render(<FacturaDocumentos facturaId="factura-1" items={items} repository={repository} />);

    expect(await screen.findByText(/arca\.pdf/i)).toBeInTheDocument();
    expect(await screen.findByText(/asistencia\.pdf/i)).toBeInTheDocument();
    // "sin bloques por actividad": role="group" es el marcador que usa Pacientes
    // (PacienteDocumentosChecklist.tsx) para cada bloque de actividad — acá no debe aparecer ninguno.
    expect(screen.queryAllByRole('group')).toHaveLength(0);
    // "sin pasos adicionales": la misma llamada de siempre, con exactamente 2 argumentos — nunca un
    // 3.er `agrupacionId` explícito, porque este dominio nunca se lo pasa a useDocumentChecklist.
    expect(repository.listByEntity).toHaveBeenCalledWith('factura', 'factura-1');
  });
});
