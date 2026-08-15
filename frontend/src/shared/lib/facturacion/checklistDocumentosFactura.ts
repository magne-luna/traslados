import type { ChecklistItem } from '../../types/documento';

// Checklist documental de Facturación (RF-410, fix directo 2026-08-15, sin change SDD nuevo):
// antes `FacturaDetail.tsx` reusaba `obraSocial?.checklist` (el checklist CONFIGURABLE de la obra
// social del paciente, mismo mecanismo que Pacientes/RF-305) para armar los documentos exigidos
// por FACTURA — dependencia incorrecta: la documentación de respaldo de una factura (comprobante
// ARCA, asistencia, CODEM) no depende de qué checklist tenga cargado la obra social del paciente,
// es la misma para toda factura del sistema. Confirmado por la usuaria: debe ser una lista FIJA
// propia de Facturación, independiente de la obra social.
//
// `requerido`: comprobante ARCA y asistencia son obligatorios para que la factura tenga respaldo
// documental completo ante una auditoría; CODEM se deja opcional porque no todas las prestaciones
// (ej. traslados sin código de discapacidad específico) lo generan — mismo criterio de "declarar
// requerido solo lo que aplica siempre" que ya usan los checklists de obra social (RF-305).
export const CHECKLIST_DOCUMENTOS_FACTURA: ChecklistItem[] = [
  { id: 'comprobante-arca', nombre: 'Comprobante ARCA', requerido: true },
  { id: 'asistencia', nombre: 'Asistencia', requerido: true },
  { id: 'codem', nombre: 'CODEM', requerido: false },
];
