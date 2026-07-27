// Generador de ids sin dependencia externa (Decisión 4 de design.md de obras-sociales-ui:
// evitar sumar dependencias nuevas para un maestro simple). No es criptográficamente fuerte,
// alcanza para ids de fixtures/mock — cuando llegue el backend real, el id lo asigna Postgres.
export function generateId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}
