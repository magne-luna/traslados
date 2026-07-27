import { Link } from 'react-router';
import { Alert } from '../../design-system/feedback';
import { Panel } from '../../design-system/layout';
import type { Conductor } from '../../shared/types/conductor';
import type { HojaDeRuta } from '../../shared/types/hojaDeRuta';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { resumenDelDia } from '../../shared/lib/reportes/resumenDelDia';

export interface RecorridosDelDiaPanelProps {
  cargando: boolean;
  error: string | null;
  hojaDeRuta: HojaDeRuta | null;
  /** Solo lectura — se usan para resolver patente/nombre por id (design.md Decisión 9). */
  vehiculos: Vehiculo[];
  conductores: Conductor[];
}

const REFERENCIA_NO_DISPONIBLE = 'Referencia no disponible';

// tasks.md 6.1/6.2, spec dashboard-recorridos-del-dia: resumen de la jornada en primer plano
// (recorridos, paradas, pacientes), detalle por recorrido con patente/conductor resueltos por
// id (o "no disponible" si la referencia no existe, sin romper el panel), marca de manual, y
// enlace a /hojas-de-ruta. Panel de solo lectura: ninguna acción de creación/edición/borrado.
export function RecorridosDelDiaPanel({ cargando, error, hojaDeRuta, vehiculos, conductores }: RecorridosDelDiaPanelProps) {
  return (
    // NOTA (tasks.md 14.1, sección 17): el header de `Panel` es `flex flex-wrap items-center
    // justify-between gap-sm` (una clase `flex-wrap` más que el original `flex items-center
    // justify-between gap-sm`). No hay eje en `Panel` para omitirla — ya está fijada por su uso
    // previo en `ResumenAnualPanel`/`FacturadoVsCobradoPanel` (sección 6.4/7.4, aceptada). Con
    // título ("Recorridos de hoy") y enlace ("Ver hojas de ruta") ambos cortos, `flex-wrap` no
    // tiene efecto salvo en viewports extremadamente angostos donde de cualquier forma haría
    // falta que envuelvan — no constatado como cambio visual en el rango de viewports soportado.
    <Panel title="Recorridos de hoy" titleId="recorridos-del-dia-heading" gap="md" action={
      <Link to="/hojas-de-ruta" className="font-body text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
        Ver hojas de ruta
      </Link>
    }>
      {error && (
        <Alert tone="danger">
          {error}
        </Alert>
      )}

      {cargando ? (
        <p className="m-0 font-body text-sm text-muted">Cargando recorridos del día…</p>
      ) : error ? null : hojaDeRuta === null ? (
        <p className="m-0 font-body text-sm text-muted">No hay hoja de ruta cargada para hoy.</p>
      ) : (
        <>
          <Resumen hojaDeRuta={hojaDeRuta} />
          {hojaDeRuta.recorridos.length === 0 ? (
            <p className="m-0 font-body text-sm text-muted">No hay recorridos cargados para hoy.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-sm p-0">
              {hojaDeRuta.recorridos.map((recorrido) => {
                const vehiculoEncontrado = vehiculos.find((v) => v.id === recorrido.vehiculoId);
                const conductorEncontrado = conductores.find((c) => c.id === recorrido.conductorId);
                return (
                  <li
                    key={recorrido.id}
                    className="flex flex-wrap items-center gap-md rounded-sm border border-border bg-surface-soft px-md py-sm font-body text-[13px] text-text"
                  >
                    <span className="font-semibold">{vehiculoEncontrado?.patente ?? REFERENCIA_NO_DISPONIBLE}</span>
                    <span className="text-muted">
                      {conductorEncontrado ? `${conductorEncontrado.apellido}, ${conductorEncontrado.nombre}` : REFERENCIA_NO_DISPONIBLE}
                    </span>
                    <span className="text-muted">{recorrido.paradas.length} paradas</span>
                    {recorrido.manual && <span className="font-semibold text-info">Manual</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}

function Resumen({ hojaDeRuta }: { hojaDeRuta: HojaDeRuta }) {
  const resumen = resumenDelDia(hojaDeRuta);
  return (
    <dl className="m-0 flex flex-wrap gap-lg">
      <div>
        <dt className="font-body text-[11px] font-semibold text-muted">Recorridos</dt>
        <dd className="m-0 font-heading text-[20px] font-bold text-ink">{resumen.cantidadRecorridos}</dd>
      </div>
      <div>
        <dt className="font-body text-[11px] font-semibold text-muted">Paradas</dt>
        <dd className="m-0 font-heading text-[20px] font-bold text-ink">{resumen.cantidadParadas}</dd>
      </div>
      <div>
        <dt className="font-body text-[11px] font-semibold text-muted">Pacientes</dt>
        <dd className="m-0 font-heading text-[20px] font-bold text-ink">{resumen.cantidadPacientes}</dd>
      </div>
    </dl>
  );
}
