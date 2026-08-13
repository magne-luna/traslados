// Tipos del dominio de Prestaciones (presupuesto-prestaciones, design.md D1/D7). Catálogo de
// prestaciones PROPIO de cada paciente (D7: sin catálogo global — dos pacientes con la misma
// prestación tienen dos filas distintas, mismo criterio que `PersonaACargo`), editable desde la
// ficha del paciente (`PrestacionesEditor.tsx`, PR 1 de la serie encadenada). Consumido en PR 2 por
// `Presupuesto.prestacionId` (obras sociales `por-prestacion`) — ver `shared/types/presupuesto.ts`.

/**
 * Prestación puntual del catálogo de un paciente (design.md D1). `activa` modela el borrado
 * LÓGICO: "quitar" una prestación desde `PrestacionesEditor` nunca hace `DELETE`, solo
 * `activa = false` — así un presupuesto ya emitido (PR 2) sigue apuntando a una prestación
 * inactiva sin quedar con una FK rota. El catálogo activo (lo que se ofrece para presupuestos
 * nuevos) es `prestaciones.filter(p => p.activa)`.
 */
export interface Prestacion {
  id: string;
  /** Referencia por id al paciente dueño del catálogo, nunca embebido — mismo criterio que el
   * resto de las referencias del dominio (`Presupuesto.pacienteId`, `Direccion` no la tiene
   * porque vive embebida en `Paciente.direcciones`, pero acá se explicita porque `Prestacion`
   * puede viajar sola, ver `prestacionMapping.ts`). */
  pacienteId: string;
  nombre: string;
  descripcion?: string;
  activa: boolean;
}

/** Payload de alta: todo lo de Prestacion salvo el id, que asigna el repository. */
export type NuevaPrestacion = Omit<Prestacion, 'id'>;

/** Payload de edición: actualización parcial, sin permitir cambiar el id ni el paciente dueño. */
export type ActualizacionPrestacion = Partial<Omit<Prestacion, 'id' | 'pacienteId'>>;
