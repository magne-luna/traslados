import type { Conductor } from '../../shared/types/conductor';
import type { Recorrido } from '../../shared/types/hojaDeRuta';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { labelAccesorio } from '../../shared/lib/accesorios/IconoAccesorio';
import { Label } from '../../design-system/form';
import { CarIcon, UserIcon } from './icons';
import { RecorridoStat } from './RecorridoStat';

// NOTA (tasks.md sección 15.1, gap de API — no resuelto acá): mismo caso que
// NuevoRecorridoForm.tsx — el `Select` del design system no tiene slot para un ícono interno
// (CarIcon/UserIcon dentro de la caja bordeada). Migrarlo perdería el ícono o duplicaría el
// borde (viola REGLA 0). Se deja nativo, candidato a sección 17 — ver design.md Decisión 9.
const boxedSelectClasses =
  'flex items-center gap-xs rounded-sm border border-border-strong bg-surface px-md py-2 text-muted';
const boxedSelectFieldClasses = 'border-none bg-transparent p-0 font-body text-[13px] text-text focus:outline-none';

interface RecorridoVehiculoConductorProps {
  formId: string;
  recorrido: Recorrido;
  vehiculo: Vehiculo | undefined;
  conductor: Conductor | undefined;
  editing: boolean;
  /** Ya filtrados por el caller (RN-VE-01/02 + capacidad sobre los pacientes del recorrido). */
  opcionesVehiculo: Vehiculo[];
  opcionesConductor: Conductor[];
  onChangeVehiculo: (vehiculoId: string) => void;
  onChangeConductor: (conductorId: string) => void;
}

function opcionVehiculo(v: Vehiculo): string {
  const accesorios = v.accesoriosCompatibles.map((a) => labelAccesorio(a)).join(', ');
  return `${v.patente} · ${v.modelo} · cap. ${v.capacidad}${accesorios ? ` · ${accesorios}` : ''}`;
}

// Encabezado de vehículo/conductor de un recorrido (feedback de usuario: poder cambiarlos sin
// recrear el recorrido): en modo edición son selects filtrados (RecorridoCard resuelve los
// candidatos vía vehiculosCompatibles/conductoresDisponibles); en modo solo-lectura, texto plano.
// Extraído de RecorridoCard para mantenerlo < ~200 líneas (react-best-practices).
export function RecorridoVehiculoConductor({
  formId,
  recorrido,
  vehiculo,
  conductor,
  editing,
  opcionesVehiculo,
  opcionesConductor,
  onChangeVehiculo,
  onChangeConductor,
}: RecorridoVehiculoConductorProps) {
  if (!editing) {
    return (
      <>
        <RecorridoStat
          icon={<CarIcon />}
          label="Vehículo"
          value={vehiculo ? `${vehiculo.patente} · ${vehiculo.modelo}` : 'Vehículo desconocido'}
        />
        <RecorridoStat
          icon={<UserIcon />}
          label="Conductor"
          value={conductor ? `${conductor.apellido}, ${conductor.nombre}` : 'Conductor desconocido'}
        />
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-md">
      {opcionesVehiculo.length === 0 ? (
        <p role="alert" className="m-0 font-body text-sm text-danger">
          Ningún vehículo disponible tiene capacidad o accesorios compatibles con el paciente que estás por agregar.
        </p>
      ) : (
        <div className="flex flex-col gap-xs">
          <Label htmlFor={`${formId}-vehiculo`}>Vehículo</Label>
          <div className={boxedSelectClasses}>
            <CarIcon />
            <select
              id={`${formId}-vehiculo`}
              className={boxedSelectFieldClasses}
              value={recorrido.vehiculoId}
              onChange={(event) => onChangeVehiculo(event.target.value)}
            >
              {opcionesVehiculo.map((v) => (
                <option key={v.id} value={v.id}>
                  {opcionVehiculo(v)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-xs">
        <Label htmlFor={`${formId}-conductor`}>Conductor</Label>
        <div className={boxedSelectClasses}>
          <UserIcon />
          <select
            id={`${formId}-conductor`}
            className={boxedSelectFieldClasses}
            value={recorrido.conductorId}
            onChange={(event) => onChangeConductor(event.target.value)}
          >
            {opcionesConductor.map((c) => (
              <option key={c.id} value={c.id}>
                {c.apellido}, {c.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
