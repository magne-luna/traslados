import type { ChecklistItem } from '../../types/documento';
import type { TipoDireccion } from '../../types/paciente';

// documentos-checklist-items-por-actividad (tasks.md §4, design.md Checkpoint (a)/(e), veredictos
// 1.2/1.5): contrato de la configuración "ítems requeridos por tipo de actividad". `domicilio`
// queda excluido a propósito del tipo — no es una actividad (mismo criterio ya aplicado por
// `obtenerActividadesConChecklist`, `actividadDocumental.ts`).
export type TipoActividad = Exclude<TipoDireccion, 'domicilio'>;

// `Partial`, no `Record` completo: un tipo sin ítems configurados simplemente no tiene clave — es
// el default documentado (design.md D2), nunca un array vacío forzado ni un estado de error.
export type RequisitosPorTipo = Partial<Record<TipoActividad, ChecklistItem[]>>;

export interface RequisitosActividadRepository {
  /** Todos los tipos con ítems configurados, agrupados. Un tipo ausente = sin configuración para
   * ese tipo (comportamiento actual, sin regresión — design.md D2). */
  listAll(): Promise<RequisitosPorTipo>;
  /** Reemplaza la lista completa de ítems de un tipo (mismo criterio D6 que
   * `ObraSocialRepository.update()` con el checklist: reemplazo completo, no diff fino). Devuelve
   * la lista tal como quedó persistida. */
  actualizar(tipo: TipoActividad, items: ChecklistItem[]): Promise<ChecklistItem[]>;
}
