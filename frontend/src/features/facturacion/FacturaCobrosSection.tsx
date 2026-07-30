import { useState } from 'react';
import { Button } from '../../design-system/components';
import { Select } from '../../design-system/form';
import type { Cobro, EstadoFactura, Factura, NuevoCobro } from '../../shared/types/factura';
import { estadoDerivadoFactura } from '../../shared/lib/facturacion/estadoDerivadoFactura';
import { CobrosPanel } from './CobrosPanel';

interface FacturaCobrosSectionProps {
  factura: Factura;
  cobros: Cobro[];
  loading: boolean;
  error: string | null;
  registrar: (data: NuevoCobro) => Promise<Cobro | void>;
  eliminar: (id: string) => Promise<void>;
  onCorregirEstado: (estado: EstadoFactura) => void;
}

const ESTADOS: EstadoFactura[] = ['a-facturar', 'facturado', 'cobrado', 'pagado-parcialmente'];

// Sección de cobros del detalle de factura (tasks.md 9.4, design.md Decisión 10): muestra el
// panel de cobros y, cuando el estado persistido no coincide con el derivado de los cobros
// (`estadoDerivadoFactura`), un banner visible con la corrección manual — nunca se sobrescribe
// en silencio. Extraído de FacturaDetail para mantener ambos componentes bajo las ~200 líneas
// (tasks.md 12.3).
//
// Migrado a Select (tasks.md 16.4): el `<select>` de corrección manual pasa a
// `Select density="tight" fullWidth={false}` — coincide byte a byte con el sitio actual
// (`rounded-sm border border-border-strong bg-surface px-sm py-1 font-body text-xs text-text`).
// El banner `border-l-4` en sí **NO** migra a `Alert emphasis="accent"` (gobernanza MEDIO,
// reportada): el sitio usa `text-[13px]` mientras `Alert emphasis="accent"` fija `text-[12px]`
// (design.md Decisión 4, molde de `AvisoModeloDatos`) — no es el mismo conjunto de clases. El
// banner además necesita `flex flex-wrap items-center gap-sm` para acomodar 3 hijos (texto,
// select, botón) en fila, clases que `Alert` no puede recibir (`className` no es prop pública).
// Migrarlo igual cambiaría tamaño de fuente y layout — viola la Regla 0. Se deja nativo.
export function FacturaCobrosSection({ factura, cobros, loading, error, registrar, eliminar, onCorregirEstado }: FacturaCobrosSectionProps) {
  const [estadoManual, setEstadoManual] = useState<EstadoFactura | ''>('');

  const estadoDerivadoActual = factura.estado !== 'a-facturar' ? estadoDerivadoFactura(factura, cobros) : null;
  const hayInconsistencia = estadoDerivadoActual !== null && estadoDerivadoActual !== factura.estado;

  return (
    <div className="flex flex-col gap-md">
      {hayInconsistencia && estadoDerivadoActual && (
        <div role="alert" className="flex flex-wrap items-center gap-sm rounded-sm border border-warning border-l-4 border-l-warning bg-warning-soft px-md py-sm font-body text-[13px] text-warning">
          <span>
            El estado persistido (<strong>{factura.estado}</strong>) no coincide con el derivado de los cobros
            (<strong>{estadoDerivadoActual}</strong>).
          </span>
          <Select
            aria-label="Corregir estado manualmente"
            density="tight"
            fullWidth={false}
            value={estadoManual}
            onChange={(event) => setEstadoManual(event.target.value as EstadoFactura)}
          >
            <option value="">Elegir estado…</option>
            {ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
          </Select>
          {/* gateo-facturacion (design.md D2, tasks.md 5.3): corregir el estado es una escritura
              no-CRUD gateada al mismo nivel `write` — ninguna requiere `admin` (decisión 5). */}
          <Button variant="secondary" requiereEscritura onClick={() => estadoManual && onCorregirEstado(estadoManual)}>Aplicar</Button>
        </div>
      )}
      <CobrosPanel factura={factura} cobros={cobros} loading={loading} error={error} registrar={registrar} eliminar={eliminar} />
    </div>
  );
}
