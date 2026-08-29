import { useId, useState } from 'react';
import { Button, CamposSoloLectura } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Label, Textarea } from '../../design-system/form';
import { camposDesdeRecorridoHabitual } from '../../shared/lib/hojas-de-ruta/camposDesdeRecorridoHabitual';
import { conductoresDisponibles, vehiculosDisponibles } from '../../shared/lib/hojas-de-ruta/disponibilidad';
import { sugerirRecorridoExistente } from '../../shared/lib/hojas-de-ruta/sugerirRecorridoExistente';
import { vehiculosCompatibles } from '../../shared/lib/hojas-de-ruta/vehiculosCompatibles';
import type { RecorridoHabitualRepository } from '../../shared/lib/pacientes/RecorridoHabitualRepository';
import type { Conductor } from '../../shared/types/conductor';
import type { NuevaParadaRecorrido, Recorrido, Tramo } from '../../shared/types/hojaDeRuta';
import type { RecorridoHabitual } from '../../shared/types/recorridoHabitual';
import type { PacienteResumen } from '../../shared/types/paciente';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { labelAccesorio } from '../../shared/lib/accesorios/IconoAccesorio';
import { CarIcon, PlusIcon, UserIcon } from './icons';
import { PacienteTramoCampos } from './PacienteTramoCampos';
import { RequisitosPaciente } from './RequisitosPaciente';
import { SelectorPaciente } from './SelectorPaciente';
import { SelectorRecorridoHabitual } from './SelectorRecorridoHabitual';
import { useRecorridosHabituales } from './useRecorridosHabituales';

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
  pacientes: PacienteResumen[];
  /** Recorridos de HOY (feedback de usuario, RN-HR-01) — habilita sugerir sumarse a uno
   *  compatible en vez de crear uno nuevo desde cero. Sin recorridos que ofrecer todavía. */
  recorridos?: Recorrido[];
  /** Fecha ISO de la hoja de ruta — decide qué destinos habituales del paciente son "de este día"
   *  (SelectorRecorridoHabitual). Sin fecha el selector sigue funcionando, sin agrupar por día. */
  fecha?: string;
  /** Destinos habituales del paciente (RF-110). Opcional: sin repository el atajo "Destino
   *  habitual" no se ofrece y el formulario se completa a mano, como antes. */
  recorridoHabitualRepository?: Pick<RecorridoHabitualRepository, 'list'>;
  onCrear: (data: NuevoRecorridoPayload) => void;
  /** Sumar el paciente elegido a un recorrido EXISTENTE en vez de crear uno nuevo — nunca
   *  automático, el operador decide si usa la sugerencia (ver `sugerirRecorridoExistente.ts`). */
  onAgregarAExistente?: (recorridoId: string, parada: NuevaParadaRecorrido) => void;
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
  const accesorios = vehiculo.accesoriosCompatibles.map((a) => labelAccesorio(a)).join(', ');
  return `${vehiculo.patente} · ${vehiculo.modelo} · cap. ${vehiculo.capacidad}${accesorios ? ` · ${accesorios}` : ''}`;
}

// Alta de recorrido (tasks.md 5.2, 7.3, RN-VE-02/RN-HR-03 + feedback de usuario): MISMOS campos
// que AsignacionPanel (paciente por select, hora, tramo, direcciones) — antes eran dos
// formularios distintos (checkboxes acá, select allá) para la misma acción real de "sumar un
// pasajero". Elegir un paciente muestra sus accesorios (coloreados según compatibilidad con el
// vehículo elegido) y limita el selector de vehículo a los que le entran (capacidad + RN-VE-01).
// El paciente es opcional — se puede crear el recorrido vacío y sumar pasajeros después vía
// AsignacionPanel, igual que antes.
export function NuevoRecorridoForm({
  vehiculos,
  conductores,
  pacientes,
  recorridos = [],
  fecha = '',
  recorridoHabitualRepository,
  onCrear,
  onAgregarAExistente,
}: NuevoRecorridoFormProps) {
  const formId = useId();
  const disponibles = vehiculosDisponibles(vehiculos);
  const conductoresOperando = conductoresDisponibles(conductores);

  const [pacienteId, setPacienteId] = useState(SIN_PACIENTE);
  const [horaEstimada, setHoraEstimada] = useState('');
  const [tramo, setTramo] = useState<Tramo>('ida');
  const [direccionOrigenId, setDireccionOrigenId] = useState('');
  const [direccionDestinoId, setDireccionDestinoId] = useState('');
  const [recorridoHabitualId, setRecorridoHabitualId] = useState('');

  const pacienteSeleccionado = pacientes.find((p) => p.id === pacienteId);
  const {
    recorridos: recorridosHabituales,
    loading: cargandoHabituales,
    error: errorHabituales,
  } = useRecorridosHabituales(recorridoHabitualRepository, pacienteId);
  const candidatos = vehiculosCompatibles(disponibles, pacienteSeleccionado ? [pacienteSeleccionado] : []);

  const [vehiculoId, setVehiculoId] = useState(candidatos[0]?.id ?? '');
  const [conductorId, setConductorId] = useState(conductoresOperando[0]?.id ?? '');
  const [manual, setManual] = useState(false);
  const [notas, setNotas] = useState('');

  const vehiculoSeleccionado = candidatos.find((v) => v.id === vehiculoId);
  // Sugerencia de recorrido existente (feedback de usuario, RN-HR-01): se recalcula en cada
  // render junto con `candidatos` — misma estrategia sin useMemo, es barato sobre arrays ya
  // cargados. Sin paciente elegido no hay nada para sugerir.
  const candidatosExistentes = pacienteSeleccionado
    ? sugerirRecorridoExistente(recorridos, vehiculos, pacienteSeleccionado, tramo, horaEstimada)
    : [];
  // "Crear recorrido" vive debajo de Notas (feedback de usuario) pero mantiene el mismo gateo que
  // antes tenía en la fila de vehículo/conductor: sin vehículo compatible para el paciente
  // elegido, no se puede enviar.
  const puedeCrear = !pacienteSeleccionado || candidatos.length > 0;

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
    // Los destinos habituales son de UN paciente: arrastrar el elegido al cambiar de paciente
    // dejaría el select apuntando a una opción que ya no está en la lista.
    setRecorridoHabitualId('');

    const nuevoSeleccionado = pacientes.find((p) => p.id === id);
    const nuevosCandidatos = vehiculosCompatibles(disponibles, nuevoSeleccionado ? [nuevoSeleccionado] : []);
    if (!nuevosCandidatos.some((v) => v.id === vehiculoId)) {
      setVehiculoId(nuevosCandidatos[0]?.id ?? '');
    }
  }

  // Copy-on-create (camposDesdeRecorridoHabitual.ts): completa los campos y los deja EDITABLES —
  // la parada que se cree no queda ligada al habitual de origen. Volver a "— Sin destino
  // habitual —" solo suelta la selección: NO borra lo ya completado, porque el operador pudo
  // haber ajustado la hora a mano después de traerlo.
  function handleRecorridoHabitual(habitual: RecorridoHabitual | undefined) {
    setRecorridoHabitualId(habitual?.id ?? '');
    if (habitual === undefined || !pacienteSeleccionado) return;

    const campos = camposDesdeRecorridoHabitual(habitual, pacienteSeleccionado.direcciones);
    setDireccionOrigenId(campos.direccionOrigenId);
    setDireccionDestinoId(campos.direccionDestinoId);
    setHoraEstimada(campos.horaEstimada);
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

  function handleAgregarAExistente(recorridoId: string) {
    if (!pacienteSeleccionado) return;
    onAgregarAExistente?.(recorridoId, {
      pacienteId: pacienteSeleccionado.id,
      tramo,
      direccionOrigenId: direccionOrigenId || (pacienteSeleccionado.direcciones[0]?.id ?? ''),
      direccionDestinoId: direccionDestinoId || (pacienteSeleccionado.direcciones[0]?.id ?? ''),
      orden: 0,
      horaEstimada: horaEstimada || undefined,
    });
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
      {/* 6 columnas desde `lg` (antes 5): entró "Destino habitual" entre el paciente y la hora —
          el atajo completa la hora y las dos direcciones que están a su derecha, así que va
          pegado al paciente del que dependen, no al final de la fila. */}
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-6 pb-3">
        {pacientes.length > 0 && (
          <SelectorPaciente
            formId={formId}
            pacientes={pacientes}
            value={pacienteId}
            onChange={handlePacienteChange}
            permitirVacio
          />
        )}

        {/* El campo se monta siempre que la pantalla haya inyectado el repository — sin
            habituales queda deshabilitado explicando por qué (feedback de la usuaria: escondido
            no se distinguía de "roto"). Sin repository no se monta: la función no está cableada
            en esa pantalla. */}
        {pacienteSeleccionado && recorridoHabitualRepository !== undefined && (
          <SelectorRecorridoHabitual
            formId={formId}
            recorridos={recorridosHabituales}
            direcciones={pacienteSeleccionado.direcciones}
            fecha={fecha}
            value={recorridoHabitualId}
            loading={cargandoHabituales}
            error={errorHabituales}
            onSelect={handleRecorridoHabitual}
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

      {/* Sugerencia de recorrido existente (feedback de usuario, RN-HR-01/RN-VE-01/RN-VE-02):
          nunca automática — el operador puede ignorarla y seguir completando el formulario para
          crear un recorrido nuevo, sin fricción. Antes de vehículo/conductor/notas para que se
          vea la opción de saltarse el resto del formulario antes de completarlo. */}
      {pacienteSeleccionado && candidatosExistentes.length > 0 && (
        <Alert tone="info" title="Ya hay un recorrido compatible hoy">
          <div className="flex flex-col gap-xs">
            <p className="m-0">Podés sumarlo a un recorrido existente en vez de crear uno nuevo.</p>
            {candidatosExistentes.map(({ recorrido, vehiculo }) => {
              const conductorDelRecorrido = conductores.find((c) => c.id === recorrido.conductorId);
              return (
                <div key={recorrido.id} className="flex flex-wrap items-center justify-between gap-sm">
                  <span className="font-body text-[12px]">
                    {`${vehiculo.patente} · ${vehiculo.modelo} — ${
                      conductorDelRecorrido ? `${conductorDelRecorrido.apellido}, ${conductorDelRecorrido.nombre}` : 'sin conductor'
                    } · ${recorrido.paradas.length}/${vehiculo.capacidad} pasajeros`}
                  </span>
                  <Button variant="secondary" size="sm" requiereEscritura onClick={() => handleAgregarAExistente(recorrido.id)}>
                    Agregar a este recorrido
                  </Button>
                </div>
              );
            })}
          </div>
        </Alert>
      )}

      {pacienteSeleccionado && <RequisitosPaciente paciente={pacienteSeleccionado} vehiculo={vehiculoSeleccionado} />}

      {pacienteSeleccionado && candidatos.length === 0 ? (
        <p role="alert" className="m-0 font-body text-sm text-danger">
          Ningún vehículo disponible tiene capacidad o accesorios compatibles con este paciente.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-md pt-2">
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
        </div>
      )}

      <div className="flex flex-col gap-xs py-3">
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

      {puedeCrear && (
        <div className="flex justify-end">
          <Button variant="primary" requiereEscritura onClick={handleSubmit}>
            <PlusIcon />
            Crear recorrido
          </Button>
        </div>
      )}
      </CamposSoloLectura>
    </div>
  );
}
