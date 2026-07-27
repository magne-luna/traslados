import { useEffect, useState } from 'react';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { ChecklistItem } from '../../shared/types/documento';
import { PacienteDocumentosChecklist } from './PacienteDocumentosChecklist';

interface PacienteDocumentosProps {
  pacienteId: string;
  obraSocialId: string | null;
  obraSocialRepository: ObraSocialRepository;
  documentoRepository: DocumentoRepository;
}

type Resolucion =
  | { status: 'sin-obra-social' }
  | { status: 'cargando' }
  | { status: 'sin-checklist' }
  | { status: 'listo'; items: ChecklistItem[] };

const emptyStateClasses = 'rounded-sm border border-border bg-surface-soft px-md py-lg font-body text-sm text-muted';

// Pestaña de documentos del paciente (tasks.md 9.1/9.2): resuelve la obra social asignada vía
// ObraSocialRepository.getById() y deriva el checklist a mostrar de ahí — nunca una lista
// genérica (design.md Decisión 7, RN-FA-08). Estados de carga/vacío explícitos, nunca pantalla
// en blanco ni loading infinito ante error de resolución.
export function PacienteDocumentos({ pacienteId, obraSocialId, obraSocialRepository, documentoRepository }: PacienteDocumentosProps) {
  const [resolucion, setResolucion] = useState<Resolucion>(
    obraSocialId === null ? { status: 'sin-obra-social' } : { status: 'cargando' },
  );

  useEffect(() => {
    if (obraSocialId === null) {
      setResolucion({ status: 'sin-obra-social' });
      return;
    }

    let active = true;
    setResolucion({ status: 'cargando' });
    obraSocialRepository
      .getById(obraSocialId)
      .then((obraSocial) => {
        if (!active) return;
        if (obraSocial === null || obraSocial.checklist.length === 0) {
          setResolucion({ status: 'sin-checklist' });
        } else {
          setResolucion({ status: 'listo', items: obraSocial.checklist });
        }
      })
      .catch(() => {
        if (active) setResolucion({ status: 'sin-checklist' });
      });

    return () => {
      active = false;
    };
  }, [obraSocialId, obraSocialRepository]);

  if (resolucion.status === 'sin-obra-social') {
    return <p className={emptyStateClasses}>Este paciente no tiene una obra social asignada todavía.</p>;
  }

  if (resolucion.status === 'cargando') {
    return <p className="font-body text-sm text-muted">Cargando documentación…</p>;
  }

  if (resolucion.status === 'sin-checklist') {
    return <p className={emptyStateClasses}>La obra social asignada no tiene un checklist de documentos configurado.</p>;
  }

  return <PacienteDocumentosChecklist pacienteId={pacienteId} items={resolucion.items} repository={documentoRepository} />;
}
