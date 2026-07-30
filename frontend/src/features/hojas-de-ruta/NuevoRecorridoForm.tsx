import { useId, useState } from 'react';
import { Button, CamposSoloLectura } from '../../design-system/components';
import { Label, Textarea } from '../../design-system/form';
import { conductoresDisponibles, vehiculosDisponibles } from '../../shared/lib/hojas-de-ruta/disponibilidad';
import { vehiculosCompatibles } from '../../shared/lib/hojas-de-ruta/vehiculosCompatibles';
import type { Conductor } from '../../shared/types/conductor';
import type { NuevaParadaRecorrido, Tramo } from '../../shared/types/hojaDeRuta';
import type { Paciente } from '../../shared/types/paciente';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { ACCESORIO_MOVILIDAD_LABELS } from '../vehiculos/accesorioMovilidadOptions';
import { CarIcon, PlusIcon, UserIcon } from './icons';
import { PacienteTramoCampos } from './PacienteTramoCampos';
import { RequisitosPaciente } from './RequisitosPaciente';
import { SelectorPaciente } from './SelectorPaciente';

export interface NuevoRecorridoPayload {
  vehiculoId: string;
  conductorId: string;
  manual: boolean;
  paradas: NuevaParadaRecorrido[];
  notas?: string;
}

interface NuevoRecorridoFormProps {
  vehiculos: Vehiculo[];
  conductores: Conductor[];
  pacientes: Paciente[];
  onCrear: (data: NuevoRecorridoPayload) => void;
}

const NOTAS_MAX_LENGTH = 500;
// NOTA (tasks.md sección 15.1, gap de API — no resuelto acá): el diseño original de `Select`
// (design-system/form.tsx) mide estas clases (`px-md py-2 text-muted`, tone='muted') pensando
// solo en el CONTROL, pero en el sitio real el borde/fondo envuelve un ícono + un <select> sin
// borde propio (bg-transparent), no un <select> suelto — `Select` no tiene slot para un ícono
// interno (mismo tipo de límite que el prefijo "$" de AutorizacionForm o el ícono-CUD de
// CudFields, design.md Decisión 9). Migrarlo perdería el ícono dentro de la caja o duplicaría el
// borde — cualquiera de las dos cambia el aspecto (viola REGLA 0). Se deja nativo, reportado como
// candidato a sección 17 (requeriría un slot `icon`/`prefix` en Select, fuera de alcance acá).
const boxedSelectClasses =
  'flex w-full items-center gap-xs rounded-sm border border-border-strong bg-surface px-md py-2 text-muted';
const boxedSelectFieldClasses = 'w-full border-none bg-transparent p-0 font-body text-[13px] text-text focus:outline-none';
const SIN_PACIENTE = '';

function opcionVehiculo(vehiculo: Vehiculo): string {
  const accesorios = vehiculo.accesoriosCompatibles.map((a) => ACCESORIO_MOVILIDAD_LABELS[a]).join(', ');
  return `${vehiculo.patente} · ${vehiculo.modelo} · cap. ${vehiculo.capacidad}${accesorios ? ` · ${accesorios}` : ''}`;
}

// Alta de recorrido (tasks.md 5.2, 7.3, RN-VE-02/RN-HR-03 + feedback de usuario): MISMOS campos
// que AsignacionPanel (paciente por select, hora, tramo, direcciones) — antes eran dos
// formularios distintos (checkboxes acá, select allá) para la misma acción real de "sumar un
// pasajero". Elegir un paciente muestra sus accesorios (coloreados según compatibilidad con el
// vehículo elegido) y limita el selector de vehículo a los que le entran (capacidad + RN-VE-01).
// El paciente es opcional — se puede crear el recorrido vacío y sumar pasajeros después vía
// AsignacionPanel, igual que antes.
export function NuevoRecorridoForm({ vehiculos, conductores, pacientes, onCrear }: NuevoRecorridoFormProps) {
  const formId = useId();
  const disponibles = vehiculosDisponibles(vehiculos);
  const conductoresOperando = conductoresDisponibles(conductores);

  const [pacienteId, setPacienteId] = useState(SIN_PACIENTE);
  const [horaEstimada, setHoraEstimada] = useState('');
  const [tramo, setTramo] = useState<Tramo>('ida');
  const [direccionOrigenId, setDireccionOrigenId] = useState('');
  const [direccionDestinoId, setDireccionDestinoId] = useState('');

  const pacienteSeleccionado = pacientes.find((p) => p.id === pacienteId);
  const candidatos = vehiculosCompatibles(disponibles, pacienteSeleccionado ? [pacienteSeleccionado] : []);

  const [vehiculoId, setVehiculoId] = useState(candidatos[0]?.id ?? '');
  const [conductorId, setConductorId] = useState(conductoresOperando[0]?.id ?? '');
  const [manual, setManual] = useState(false);
  const [notas, setNotas] = useState('');

  const vehiculoSeleccionado = candidatos.find((v) => v.id === vehiculoId);

  if (disponibles.length === 0) {
    return <p className="m-0 font-body text-sm text-muted">No hay vehículos habilitados disponibles hoy.</p>;
  }
  if (conductoresOperando.length === 0) {
    return <p className="m-0 font-body text-sm text-muted">No hay conductores operando disponibles hoy.</p>;
  }

  function handlePacienteChange(id: string) {
    setPacienteId(id);
    setDireccionOrigenId('');
    setDireccionDestinoId('');

    const nuevoSeleccionado = pacientes.find((p) => p.id === id);
    const nuevosCandidatos = vehiculosCompatibles(disponibles, nuevoSeleccionado ? [nuevoSeleccionado] : []);
    if (!nuevosCandidatos.some((v) => v.id === vehiculoId)) {
      setVehiculoId(nuevosCandidatos[0]?.id ?? '');
    }
  }

  function handleSubmit() {
    if (!vehiculoId || !conductorId) return;

    const paradas: NuevaParadaRecorrido[] = pacienteSeleccionado
      ? [
          {
            pacienteId: pacienteSeleccionado.id,
            tramo,
            direccionOrigenId: direccionOrigenId || (pacienteSeleccionado.direcciones[0]?.id ?? ''),
            direccionDestinoId: direccionDestinoId || (pacienteSeleccionado.direcciones[0]?.id ?? ''),
            orden: 0,
            horaEstimada: horaEstimada || undefined,
          },
        ]
      : [];

    onCrear({ vehiculoId, conductorId, manual, paradas, notas: notas || undefined });
  }

  return (
    <div className="flex flex-col gap-lg rounded-sm border border-border bg-surface p-lg shadow-sm">
      <div className="flex items-start gap-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
          <PlusIcon />
        </div>
        <div>
          <h3 className="m-0 font-heading text-[17px] font-bold text-ink">Nuevo recorrido</h3>
          <p className="m-0 font-body text-[13px] text-muted">Completá los datos para crear un nuevo recorrido.</p>
        </div>
      </div>

      {/* gateo-hojas-de-ruta (design.md D4/D9, tasks.md 3.1/3.2): una sola inserción cubre
          SelectorPaciente, PacienteTramoCampos (ninguno de los dos cambia ni una línea ni recibe
          props nuevas), los selects de vehículo/conductor, el checkbox "manual", la textarea de
          notas y la acción "Crear recorrido" — <fieldset disabled> alcanza a todo el subárbol.
          IMPORTANTE (security-review): esto es UX, no una frontera de seguridad — la
          autorización efectiva la impone la RLS vía modulos.tiene_permiso('pacientes', 'write').
          Mismo comentario que permisos.ts, usePuedeEscribir.ts y las pantallas ya cableadas. */}
      <CamposSoloLectura>
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-5">
        {pacientes.length > 0 && (
          <SelectorPaciente
            formId={formId}
            pacientes={pacientes}
            value={pacienteId}
            onChange={handlePacienteChange}
            permitirVacio
          />
        )}

        {pacienteSeleccionado && (
          <PacienteTramoCampos
            formId={formId}
            direcciones={pacienteSeleccionado.direcciones}
            horaEstimada={horaEstimada}
            tramo={tramo}
            direccionOrigenId={direccionOrigenId}
            direccionDestinoId={direccionDestinoId}
            onHoraChange={setHoraEstimada}
            onTramoChange={setTramo}
            onDireccionOrigenChange={setDireccionOrigenId}
            onDireccionDestinoChange={setDireccionDestinoId}
          />
        )}
      </div>

      {pacienteSeleccionado && <RequisitosPaciente paciente={pacienteSeleccionado} vehiculo={vehiculoSeleccionado} />}

      {pacienteSeleccionado && candidatos.length === 0 ? (
        <p role="alert" className="m-0 font-body text-sm text-danger">
          Ningún vehículo disponible tiene capacidad o accesorios compatibles con este paciente.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-md">
          <div className="flex flex-col gap-xs">
            <Label htmlFor={`${formId}-vehiculo`}>Vehículo</Label>
            <div className={boxedSelectClasses}>
              <CarIcon />
              <select
                id={`${formId}-vehiculo`}
                className={boxedSelectFieldClasses}
                value={vehiculoId}
                onChange={(event) => setVehiculoId(event.target.value)}
              >
                {candidatos.map((vehiculo) => (
                  <option key={vehiculo.id} value={vehiculo.id}>
                    {opcionVehiculo(vehiculo)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-xs">
            <Label htmlFor={`${formId}-conductor`}>Conductor</Label>
            <div className={boxedSelectClasses}>
              <UserIcon />
              <select
                id={`${formId}-conductor`}
                className={boxedSelectFieldClasses}
                value={conductorId}
                onChange={(event) => setConductorId(event.target.value)}
              >
                {conductoresOperando.map((conductor) => (
                  <option key={conductor.id} value={conductor.id}>
                    {conductor.apellido}, {conductor.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label htmlFor={`${formId}-manual`} className="flex items-center gap-xs font-body text-[13px] text-text">
            <input
              id={`${formId}-manual`}
              type="checkbox"
              checked={manual}
              onChange={(event) => setManual(event.target.checked)}
            />
            Recorrido manual (sin turno fijo)
          </label>

          <div className="ml-auto">
            <Button variant="primary" requiereEscritura onClick={handleSubmit}>
              <PlusIcon />
              Crear recorrido
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-xs">
        <Label htmlFor={`${formId}-notas`}>Notas del recorrido (opcional)</Label>
        <Textarea
          id={`${formId}-notas`}
          value={notas}
          onChange={(event) => setNotas(event.target.value.slice(0, NOTAS_MAX_LENGTH))}
          placeholder="Escribí una nota…"
          maxLength={NOTAS_MAX_LENGTH}
          rows={3}
        />
        <span className="self-end font-body text-[11px] text-faint">
          {notas.length}/{NOTAS_MAX_LENGTH}
        </span>
      </div>
      </CamposSoloLectura>
    </div>
  );
}
