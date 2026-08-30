import type { ActualizacionFactura, NuevaFactura, Factura } from '../../shared/types/factura';
import type { FacturaRepository } from '../../shared/lib/facturacion/FacturaRepository';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';
import { useListaDeDominio } from '../../shared/lib/query/useListaDeDominio';

export interface UseFacturasResult {
  facturas: Factura[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevaFactura) => Promise<Factura>;
  actualizar: (id: string, data: ActualizacionFactura) => Promise<Factura>;
}

// Wiring de estado entre las pantallas de Facturación y un FacturaRepository.
//
// migracion-react-query, Fase 4 (dominio TRANSACCIONAL). **`UseFacturasResult` NO cambió.**
//
// ⚠️ `FRESCURA.transaccional` es CERO, y no es un olvido: una factura es dinero y su estado cambia dentro de la sesión. Ponerle
// `FRESCURA.referencia` sería el riesgo R2 del change — mostrarle a la usuaria plata
// desactualizada. Con frescura cero se conservan igual la deduplicación de peticiones concurrentes
// y la invalidación automática por mutación; lo único que no se hace es servir un dato viejo desde
// memoria.
export function useFacturas(repository: FacturaRepository): UseFacturasResult {
  const { datos, ...resto } = useListaDeDominio<Factura, NuevaFactura, ActualizacionFactura>({
    claveDominio: claves.facturas.todos(),
    claveLista: claves.facturas.lista(),
    cargar: () => repository.list(),
    crear: (data) => repository.create(data),
    actualizar: (id, data) => repository.update(id, data),
    frescuraMs: FRESCURA.transaccional,
  });

  return { facturas: datos, ...resto };
}
