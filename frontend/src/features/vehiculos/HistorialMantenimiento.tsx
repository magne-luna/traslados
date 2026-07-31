import { Table, Th, Tr } from '../../design-system/table';
import type { MantenimientoRegistro } from '../../shared/types/vehiculo';
import { MantenimientoFila } from './MantenimientoFila';
import { NuevoMantenimientoForm } from './NuevoMantenimientoForm';
import type { NuevoMantenimientoInput } from './toMantenimientoRegistro';

interface HistorialMantenimientoProps {
  mantenimientos: MantenimientoRegistro[];
  onAgregar: (data: NuevoMantenimientoInput) => void;
}

// Historial de intervenciones de mantenimiento (RF-507, US-500, tasks.md 6.1-6.9): mismo layout
// que `GastosVehiculo.tsx` (design.md Decisión 9) — tabla a la izquierda, form de alta a la
// derecha (`grid lg:grid-cols-[2fr_1fr]`). Reusa `Table`/`Th`/`Tr` del design system; la fila y
// el form quedan en sus propios componentes (`MantenimientoFila`, `NuevoMantenimientoForm`) para
// no superar el tamaño de componente recomendado (regla del proyecto).
export function HistorialMantenimiento({ mantenimientos, onAgregar }: HistorialMantenimientoProps) {
  return (
    <div className="grid grid-cols-1 gap-md lg:grid-cols-[2fr_1fr]">
      <div className="rounded-md border border-border bg-surface p-lg">
        {mantenimientos.length === 0 ? (
          <p className="m-0 font-body text-sm text-muted">Aún no hay intervenciones de mantenimiento registradas.</p>
        ) : (
          <Table caption="Historial de intervenciones de mantenimiento del vehículo" scrollable={false}>
            <thead>
              <Tr>
                <Th scope="col" align="left" padding="md" divided muted>
                  Tipo
                </Th>
                <Th scope="col" align="left" padding="md" divided muted>
                  Sub-tipo
                </Th>
                <Th scope="col" align="left" padding="md" divided muted>
                  Fecha
                </Th>
                <Th scope="col" align="left" padding="md" divided muted>
                  Kilometraje
                </Th>
                <Th scope="col" align="left" padding="md" divided muted>
                  Próximo vencimiento
                </Th>
              </Tr>
            </thead>
            <tbody>
              {mantenimientos.map((registro) => (
                <MantenimientoFila key={registro.id} registro={registro} />
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <NuevoMantenimientoForm onAgregar={onAgregar} />
    </div>
  );
}
