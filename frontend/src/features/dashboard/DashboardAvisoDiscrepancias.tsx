import { AvisoModeloDatos } from '../../design-system/components';

// Cartel único agrupando las 4 discrepancias estructurales de C-11 contra
// Traslados-Modelo-Datos.docx (tasks.md 6.8, design.md §Discrepancias 1 a 4): el docx no
// modela ninguna vista/reporte; la mora depende de fechaFactura y del estado `facturado` que
// el docx no tiene; el período de atribución del facturado no está estructurado en el docx; y
// el CUD/mantenimiento se derivan en el cliente mientras el docx los persiste. Un solo cartel
// (no cuatro) — mismo patrón que FacturaAvisoDiscrepancias de facturacion-ui.
export function DashboardAvisoDiscrepancias() {
  return (
    <AvisoModeloDatos>
      Este dashboard agrega sobre <code>Traslados-Modelo-Datos.docx</code> (design.md
      §Discrepancias 1 a 4): (1) el docx no modela <strong>ninguna vista, reporte ni
      agregación</strong> — las funciones de <code>shared/lib/reportes/</code> son el contrato
      que el backend `C-11` debe cumplir; (2) la mora depende de la{' '}
      <strong>fecha de emisión</strong> y del estado <code>facturado</code>, que el docx no
      tiene — sin ellos RF-801 no es calculable; (3) el docx no tiene un{' '}
      <strong>período de atribución</strong> estructurado de la factura (solo{' '}
      <code>Fecha inicial/tope</code>) — se asume <code>mesFacturado</code>/
      <code>anioFacturado</code>; (4) el CUD y el mantenimiento{' '}
      <strong>se derivan en el cliente</strong> mientras el docx los persiste (<code>Vigente</code>
      , próximos vencimientos) — pueden contradecirse si el backend no recalcula. Ninguna se
      resuelve acá: quedan para confirmar con el cliente y con quien mantiene el docx.
    </AvisoModeloDatos>
  );
}
