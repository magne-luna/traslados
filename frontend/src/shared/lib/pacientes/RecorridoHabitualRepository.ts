import type { NuevoRecorridoHabitual, RecorridoHabitual } from '../../types/recorridoHabitual';

// Contrato de datos de "Destinos habituales" (RF-110): sin `update` a propósito — mismo criterio
// simple que otras colecciones chicas del repo (ej. `CobroRepository`, `AutorizacionRepository`),
// una edición se resuelve como baja + alta desde el editor, no como un PATCH parcial. Cuando el
// backend real se archive, `SupabaseRecorridoHabitualRepository` cumple este mismo contrato — los
// componentes no cambian.
export interface RecorridoHabitualRepository {
  list(pacienteId: string): Promise<RecorridoHabitual[]>;
  create(data: NuevoRecorridoHabitual): Promise<RecorridoHabitual>;
  remove(id: string): Promise<void>;
}
