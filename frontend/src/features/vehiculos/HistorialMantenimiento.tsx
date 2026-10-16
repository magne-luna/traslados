import { useState } from 'react';
import { Table, Th, Tr } from '../../design-system/table';
import type { MantenimientoRegistro } from '../../shared/types/vehiculo';
import { MantenimientoFila } from './MantenimientoFila';
import { NuevoMantenimientoForm } from './NuevoMantenimientoForm';
import { toMantenimientoFormInput, type NuevoMantenimientoInput } from './toMantenimientoRegistro';

interface HistorialMantenimientoProps {
  mantenimientos: MantenimientoRegistro[];
  onAgregar: (data: NuevoMantenimientoInput) => void;
  /** Corrige un registro ya cargado (errores de carga). Sin él no se muestra "Editar". */
  onEditar?: (id: string, data: NuevoMantenimientoInput) => void;
}

// Historial de intervenciones de mantenimiento (RF-507, US-500, tasks.md 6.1-6.9): mismo layout
// que `GastosVehiculo.tsx` (design.md Decisión 9) — tabla a la izquierda, form de alta a la
// derecha (`grid lg:grid-cols-[2fr_1fr]`). Reusa `Table`/`Th`/`Tr` del design system; la fila y
// el form quedan en sus propios componentes (`MantenimientoFila`, `NuevoMantenimientoForm`) para
// no superar el tamaño de componente recomendado (regla del proyecto).
export function HistorialMantenimiento({ mantenimientos, onAgregar, onEditar }: HistorialMantenimientoProps) {
  const [editando, setEditando] = useState<MantenimientoRegistro | null>(null);

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
                <Th scope="col" align="left" padding="md" divided muted>
                  <span className="sr-only">Acciones</span>
                </Th>
              </Tr>
            </thead>
            <tbody>
              {mantenimientos.map((registro) => (
                <MantenimientoFila
                  key={registro.id}
                  registro={registro}
                  onEditar={onEditar && (() => setEditando(registro))}
                />
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {/* `key` remonta el form al cambiar de registro para que tome los valores precargados. */}
      {editando && onEditar ? (
        <NuevoMantenimientoForm
          key={editando.id}
          inicial={toMantenimientoFormInput(editando)}
          onAgregar={(data) => {
            onEditar(editando.id, data);
            setEditando(null);
          }}
          onCancelar={() => setEditando(null)}
        />
      ) : (
        <NuevoMantenimientoForm key="nuevo" onAgregar={onAgregar} />
      )}
    </div>
  );
}
