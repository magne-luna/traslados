/** Opciones de un selector de alta (paciente, obra social): sin los inactivos (baja lógica), salvo
 * el que ya está elegido — al editar un presupuesto viejo de alguien inactivo, el campo no se vacía. */
export function seleccionables<T extends { id: string; activo?: boolean }>(items: T[], idActual: string | null): T[] {
  return items.filter((item) => item.activo !== false || item.id === idActual);
}
