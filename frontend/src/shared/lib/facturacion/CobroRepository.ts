import type { Cobro, NuevoCobro } from '../../types/factura';

// Contrato de datos (tasks.md 4.2, design.md Decisión 1): Cobro tiene repository propio, a
// diferencia de AsistenciaPrestacion — los cobros llegan después de emitida la factura, a lo
// largo de meses, con su propio ciclo de vida. Cuando el backend real (C-07) se archive, se
// escribe un SupabaseCobroRepository que cumpla este mismo contrato — los componentes no cambian.
export interface CobroRepository {
  /**
   * Adición aditiva (design.md Decisión 6, tasks.md 2.1): devuelve todos los cobros
   * persistidos, de todas las facturas, en una sola lectura. La necesita `C-11` para agregar
   * facturado/cobrado por período sin hacer una llamada de `listByFactura` por cada factura
   * (fan-out N+1). `listByFactura`, `create` y `remove` conservan su firma y comportamiento —
   * ninguna pantalla de `facturacion-ui` cambia.
   */
  list(): Promise<Cobro[]>;
  listByFactura(facturaId: string): Promise<Cobro[]>;
  create(data: NuevoCobro): Promise<Cobro>;
  remove(id: string): Promise<void>;
}
