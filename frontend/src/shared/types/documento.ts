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
  itemId: string;
  nombreArchivo: string;
  subidoEn: string; // ISO date
}
