// Tipos del dominio documental (RF-900 a RF-902, knowledge-base/06_funcionalidades.md §Épica 10).
// El mismo checklist/documento se reusa en Pacientes, Vehículos, Conductores y Facturas — solo
// cambia la entidad y la lista de items, nunca la forma del dato.

export type EntidadDocumental = 'paciente' | 'vehiculo' | 'conductor' | 'factura';

export interface ChecklistItem {
  id: string;
  nombre: string;
  /** La mayoría de los ítems de un checklist de obra social son obligatorios (RF-305). */
  requerido: boolean;
}

export interface DocumentoAdjunto {
  /** Identifica un documento puntual dentro de la colección del mismo itemId — antes no existía
   * porque solo podía haber uno. Necesario para que remove() apunte a un documento específico
   * (pacientes-documentos-multiples). */
  id: string;
  itemId: string;
  nombreArchivo: string;
  subidoEn: string; // ISO date — fecha de carga al sistema, sin cambios de semántica
  /** ISO date opcional — inicio del período que cubre este documento (mismo nombre y semántica
   * que Autorizacion.vigenciaDesde en presupuesto.ts). Si no se completa, "vigente" se deriva de
   * subidoEn (pacientes-documentos-multiples, design.md Checkpoint (b)). */
  vigenciaDesde?: string;
  /** Tipo MIME del archivo cargado (`file.type`, ej. `image/jpeg`, `application/pdf`). Decide si el
   * documento es previsualizable y con qué elemento (imagen / PDF / no previsualizable) —
   * `documentos-previsualizacion`, design.md D1. Opcional a propósito: los documentos cargados antes
   * de ese change no lo tienen. */
  tipoMime?: string;
}
