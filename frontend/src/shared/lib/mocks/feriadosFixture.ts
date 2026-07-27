// Catálogo de feriados nacionales argentinos (tasks.md 4.3, design.md Decisión 11, RN-FA-03):
// se INYECTA como parámetro a `diasFacturables`, nunca se hardcodea dentro de la función ni del
// componente — el backend podrá reemplazar este fixture por una tabla o un servicio sin tocar
// la función pura ni los componentes (design.md Risks/Trade-offs). Feriados de fecha fija del
// calendario nacional (no se modelan los trasladables/puente, fuera de alcance del mock).
export function buildFeriadosFixture(): string[] {
  const anio = new Date().getFullYear();

  const feriadosFijos = [
    `${anio}-01-01`, // Año Nuevo
    `${anio}-03-24`, // Día Nacional de la Memoria por la Verdad y la Justicia
    `${anio}-04-02`, // Día del Veterano y de los Caídos en la Guerra de Malvinas
    `${anio}-05-01`, // Día del Trabajador
    `${anio}-05-25`, // Día de la Revolución de Mayo
    `${anio}-06-20`, // Paso a la Inmortalidad del General Belgrano
    `${anio}-07-09`, // Día de la Independencia
    `${anio}-08-17`, // Paso a la Inmortalidad del General San Martín
    `${anio}-12-08`, // Inmaculada Concepción de María
    `${anio}-12-25`, // Navidad
  ];

  // Feriado adicional dentro del mes actual (tasks.md 4.3: "incluyendo al menos uno dentro del
  // período de alguna factura sembrada" — ver facturasFixture.ts, que siembra una factura con
  // mesFacturado = mes actual). Se agrega sin importar qué mes sea al correr la app, para no
  // depender de que el mes actual coincida con uno de los feriados fijos de arriba.
  const mesActual = String(new Date().getMonth() + 1).padStart(2, '0');
  const feriadoDelMesActual = `${anio}-${mesActual}-15`;

  return Array.from(new Set([...feriadosFijos, feriadoDelMesActual])).sort();
}
