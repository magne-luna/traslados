import { AvisoModeloDatos } from '../../design-system/components';

// Cartel único con las discrepancias VIGENTES contra Traslados-Modelo-Datos.docx
// (integracion-facturacion, design.md D12, tasks.md 6.1/6.2). Las 4 discrepancias originales de
// CHANGES.md §C-07 (AsistenciaPrestacion, documento_factura, fecha_estimada_cobro, cantidad_km)
// quedaron CERRADAS tras verificar la base real (tasks.md 1.3) — ya no se listan acá. Un solo
// cartel (no varios) para no tapar la pantalla. Extraído para poder testearlo aislado y para
// mantener FacturaDetail bajo las ~200 líneas (tasks.md 12.3).
export function FacturaAvisoDiscrepancias() {
  return (
    <AvisoModeloDatos>
      Discrepancias vigentes contra <code>Traslados-Modelo-Datos.docx</code> (design.md
      §Discrepancias N1, N2 y Open Questions): (1) el enum real de <strong>estado</strong> tiene
      un literal adicional, "pendiente", que esta pantalla no modela por separado (se lee como
      sinónimo de "a facturar", nunca se escribe); (2) la fecha de emisión
      (<code>fecha_factura</code>) es un campo agregado sobre el docx, que no la contemplaba; (3)
      la factura no congela la obra social con la que se emitió — si el paciente cambia de obra
      social, sus facturas anteriores pueden empezar a mostrar la configuración nueva.
    </AvisoModeloDatos>
  );
}
