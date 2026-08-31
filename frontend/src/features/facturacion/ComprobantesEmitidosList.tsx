import { useMemo } from 'react';
import { Button, Chip, VolverAlListadoLink } from '../../design-system/components';
import { Alert, EmptyState } from '../../design-system/feedback';
import { Table, Td, Th, Tr } from '../../design-system/table';
import type { Factura } from '../../shared/types/factura';

interface ComprobantesEmitidosListProps {
  /** Todas las facturas: el componente se queda solo con las que tienen `cae` (ya emitidas). */
  facturas: Factura[];
  nombrePaciente: (pacienteId: string) => string;
  /** Abre el PDF del comprobante (signed URL). Solo se ofrece si la fila tiene `comprobantePdfUrl`. */
  onVerComprobante: (factura: Factura) => void;
  /** Click en la fila → detalle de esa factura (mismo patrón que FacturasList). */
  onSelect: (factura: Factura) => void;
  onVolver: () => void;
  /** Error al resolver la URL firmada del PDF — se muestra sin ocultar la tabla. */
  error?: string | null;
}

// Número de comprobante con el formato de ARCA (mismo que FacturaResumen/FacturaImprimible):
// punto de venta a 4 dígitos, número a 8. Una factura con `cae` siempre trae ambos (los persiste
// la Edge Function `facturar` en la misma operación), pero se guarda igual por si falta alguno.
function numeroComprobante(factura: Factura): string {
  if (factura.ptoVta === undefined || factura.cbteNro === undefined) return '—';
  return `${String(factura.ptoVta).padStart(4, '0')}-${String(factura.cbteNro).padStart(8, '0')}`;
}

// Listado de comprobantes emitidos (change `facturacion-listado-comprobantes`): todas las facturas
// con CAE, ordenadas por fecha de factura descendente, con acceso directo al PDF archivado en
// `facturas-emitidas`. Presentacional puro — la resolución de la signed URL y su manejo de error
// viven en FacturacionPage (mismo patrón que FacturaDetail.verComprobante). Arranca vacío hasta que
// haya emisiones reales contra ARCA.
export function ComprobantesEmitidosList({
  facturas,
  nombrePaciente,
  onVerComprobante,
  onSelect,
  onVolver,
  error,
}: ComprobantesEmitidosListProps) {
  const emitidos = useMemo(
    () =>
      facturas
        .filter((factura) => Boolean(factura.cae))
        .sort((a, b) => (b.fechaFactura ?? '').localeCompare(a.fechaFactura ?? '')),
    [facturas],
  );

  return (
    <div className="flex flex-col gap-lg py-xxl px-xl">
      <VolverAlListadoLink onClick={onVolver} />
      <h1 className="m-0 font-heading text-[21px] font-bold text-ink">Comprobantes emitidos</h1>

      {error && <Alert tone="danger">{error}</Alert>}

      {emitidos.length === 0 ? (
        <EmptyState message="Todavía no se emitió ningún comprobante. Cuando emitas una factura contra ARCA, su comprobante y su PDF aparecen acá." />
      ) : (
        <Table caption="Comprobantes emitidos" minWidth="lg">
          <thead>
            <Tr>
              <Th scope="col">Paciente</Th>
              <Th scope="col">Período</Th>
              <Th scope="col">Comprobante</Th>
              <Th scope="col">CAE</Th>
              <Th scope="col">Fecha</Th>
              <Th scope="col" align="right">
                PDF
              </Th>
            </Tr>
          </thead>
          <tbody>
            {emitidos.map((factura) => {
              const nombre = nombrePaciente(factura.pacienteId);
              return (
                <Tr key={factura.id} divided interactive onClick={() => onSelect(factura)}>
                  <Td>{nombre}</Td>
                  <Td numeric>
                    {factura.mesFacturado}/{factura.anioFacturado}
                  </Td>
                  <Td>
                    <span className="flex flex-wrap items-center gap-xs">
                      <span>
                        {factura.tipoComprobante} {numeroComprobante(factura)}
                      </span>
                      {factura.arcaAmbiente === 'homologacion' && <Chip kind="warning">PRUEBA — sin valor fiscal</Chip>}
                    </span>
                  </Td>
                  <Td numeric>{factura.cae}</Td>
                  <Td numeric>{factura.fechaFactura ?? '—'}</Td>
                  <Td align="right">
                    {factura.comprobantePdfUrl && (
                      <Button
                        variant="secondary"
                        size="sm"
                        ariaLabel={`Ver PDF del comprobante de ${nombre}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onVerComprobante(factura);
                        }}
                      >
                        Ver PDF
                      </Button>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
