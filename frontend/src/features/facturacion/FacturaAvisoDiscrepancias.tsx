import { AvisoModeloDatos } from '../../design-system/components';

// Cartel único agrupando las 5 discrepancias de impacto backend contra
// Traslados-Modelo-Datos.docx (tasks.md 6.4, design.md Decisión 14): AsistenciaPrestacion,
// documentos por factura, fecha estimada de cobro, cantidad de km y el enum de estados
// divergente. Un solo cartel (no cinco) para no tapar la pantalla. Extraído para poder testearlo
// aislado y para mantener FacturaDetail bajo las ~200 líneas (tasks.md 12.3).
export function FacturaAvisoDiscrepancias() {
  return (
    <AvisoModeloDatos>
      Este contrato agrega sobre <code>Traslados-Modelo-Datos.docx</code> (design.md
      §Discrepancias 1 a 5): (1) <code>AsistenciaPrestacion</code> no existe como entidad en el
      docx; (2) no existe tabla de documentos por factura (<code>documento_factura</code>); (3)
      no existe campo de fecha estimada de cobro (<code>fecha_estimada_cobro</code>); (4) no
      existe <code>cantidad_km</code> en Factura; (5) el enum de <strong>estado</strong> del docx
      ("a facturar, cobrada, pagada parcialmente, pendiente") no incluye "facturado". El backend
      `C-07` debe absorber estos cinco puntos antes de cerrar el esquema.
    </AvisoModeloDatos>
  );
}
