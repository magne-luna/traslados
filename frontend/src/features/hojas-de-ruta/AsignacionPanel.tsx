import { useId, useState } from 'react';
import { Button, CamposSoloLectura } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { generateId } from '../../shared/lib/id';
import { camposDesdeRecorridoHabitual } from '../../shared/lib/hojas-de-ruta/camposDesdeRecorridoHabitual';
import { capacidadDisponible } from '../../shared/lib/hojas-de-ruta/capacidadDisponible';
import { direccionesInvertidas } from '../../shared/lib/hojas-de-ruta/direccionesInvertidas';
import { validarCompatibilidadAccesorio } from '../../shared/lib/hojas-de-ruta/validarCompatibilidadAccesorio';
import type { RecorridoHabitualRepository } from '../../shared/lib/pacientes/RecorridoHabitualRepository';
import type { PacienteResumen } from '../../shared/types/paciente';
import type { ParadaRecorrido, Recorrido, Tramo } from '../../shared/types/hojaDeRuta';
import type { RecorridoHabitual } from '../../shared/types/recorridoHabitual';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { TRAMO_LABELS } from '../pacientes/direccionOptions';
import { PlusIcon } from './icons';
import { PacienteTramoCampos } from './PacienteTramoCampos';
import { RequisitosPaciente } from './RequisitosPaciente';
import { SelectorPaciente } from './SelectorPaciente';
import { SelectorRecorridoHabitual } from './SelectorRecorridoHabitual';
import { useRecorridosHabituales } from './useRecorridosHabituales';

interface AsignacionPanelProps {
  recorrido: Recorrido;
  /** Vehículo del recorrido, resuelto por el caller a partir de `recorrido.vehiculoId`. */
  vehiculo: Vehiculo | undefined;
  /** Candidatos a asignar — la pantalla decide si filtra a los que ya están en el recorrido. */
  pacientes: PacienteResumen[];
  onAgregar: (parada: ParadaRecorrido) => void;
  /**
   * Modo controlado opcional (feedback de usuario: "mismo comportamiento que crear recorrido") —
   * RecorridoCard lo usa para conocer, en vivo y sin confirmar todavía, a quién se está por
   * agregar, y así filtrar su propio selector de Vehículo. Sin estos dos props, el paciente
   * elegido es estado interno (comportamiento previo, sin cambios).
   */
  pacienteId?: string;
  onPacienteIdChange?: (pacienteId: string) => void;
  /** Fecha ISO de la hoja de ruta — decide qué destinos habituales son "de este día". */
  fecha?: string;
  /** Destinos habituales del paciente (RF-110). Opcional: sin repository el atajo "Destino
   *  habitual" no se ofrece y la parada se completa a mano, como antes. */
  recorridoHabitualRepository?: Pick<RecorridoHabitualRepository, 'list'>;
}

// Panel de asignación (tasks.md 5.3, RN-VE-01, design.md Decisión 7): antes de agregar una
// parada valida capacidad (`capacidadDisponible`) y compatibilidad de accesorios
// (`validarCompatibilidadAccesorio`) — funciones puras testeadas por TDD en shared/lib. Si algo
// falla, se bloquea con un mensaje visible y NUNCA se llama a `onAgregar` (no se persiste la
// asignación inválida, spec "Bloqueo de la asignación incompatible en la UI").
export function AsignacionPanel({
  recorrido,
  vehiculo,
  pacientes,
  onAgregar,
  pacienteId: pacienteIdControlado,
  onPacienteIdChange,
  fecha = '',
  recorridoHabitualRepository,
}: AsignacionPanelProps) {
  const formId = useId();
  const [pacienteIdInterno, setPacienteIdInterno] = useState(pacientes[0]?.id ?? '');
  const pacienteId = pacienteIdControlado ?? pacienteIdInterno;
  // RN-HR-02 (feedback de usuario): si el paciente elegido ya tiene la ida cargada en este
  // recorrido, preseleccionar la vuelta (y viceversa) — evita que el operador tenga que cambiar
  // el tramo a mano para no pisar el que ya existe.
  function tramoDisponible(id: string): Tramo {
    return recorrido.paradas.some((parada) => parada.pacienteId === id && parada.tramo === 'ida') ? 'vuelta' : 'ida';
  }
  const [tramo, setTramo] = useState<Tramo>(() => tramoDisponible(pacienteIdInterno));
  const sugeridoInicial = direccionesInvertidas(recorrido.paradas, pacienteIdInterno);
  const [direccionOrigenId, setDireccionOrigenId] = useState(sugeridoInicial?.direccionOrigenId ?? '');
  const [direccionDestinoId, setDireccionDestinoId] = useState(sugeridoInicial?.direccionDestinoId ?? '');
  const [horaEstimada, setHoraEstimada] = useState('');
  const [recorridoHabitualId, setRecorridoHabitualId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pacienteSeleccionado = pacientes.find((p) => p.id === pacienteId);
  const {
    recorridos: recorridosHabituales,
    loading: cargandoHabituales,
    error: errorHabituales,
  } = useRecorridosHabituales(recorridoHabitualRepository, pacienteId);

  function handlePacienteChange(id: string) {
    setPacienteIdInterno(id);
    onPacienteIdChange?.(id);
    setTramo(tramoDisponible(id));
    // RN-HR-02 (feedback de usuario): si ya tiene una parada en este recorrido (ej. la ida),
    // sugerir la vuelta natural — origen/destino invertidos — en vez de dejar los selects vacíos.
    const sugerido = direccionesInvertidas(recorrido.paradas, id);
    setDireccionOrigenId(sugerido?.direccionOrigenId ?? '');
    setDireccionDestinoId(sugerido?.direccionDestinoId ?? '');
    // Los destinos habituales son de UN paciente: arrastrar el elegido al cambiar de paciente
    // dejaría el select apuntando a una opción que ya no está en la lista.
    setRecorridoHabitualId('');
  }

  // Copy-on-create (camposDesdeRecorridoHabitual.ts): completa los campos y los deja EDITABLES —
  // la parada creada no queda ligada al habitual de origen. Pisa la sugerencia de vuelta invertida
  // (`direccionesInvertidas`) a propósito: el operador acaba de pedir explícitamente ESTE destino.
  // Volver a "— Sin destino habitual —" solo suelta la selección, no borra lo ya completado.
  function handleRecorridoHabitual(habitual: RecorridoHabitual | undefined) {
    setRecorridoHabitualId(habitual?.id ?? '');
    if (habitual === undefined || !pacienteSeleccionado) return;

    const campos = camposDesdeRecorridoHabitual(habitual, pacienteSeleccionado.direcciones);
    setDireccionOrigenId(campos.direccionOrigenId);
    setDireccionDestinoId(campos.direccionDestinoId);
    setHoraEstimada(campos.horaEstimada);
  }

  function handleSubmit() {
    setError(null);

    if (!vehiculo) {
      setError('No se pudo resolver el vehículo del recorrido.');
      return;
    }
    if (!pacienteSeleccionado) {
      setError('Elegí un paciente para asignar.');
      return;
    }

    if (!capacidadDisponible(vehiculo, recorrido)) {
      setError(`El vehículo ${vehiculo.patente} no tiene lugar disponible (capacidad ${vehiculo.capacidad}).`);
      return;
    }

    if (recorrido.paradas.some((parada) => parada.pacienteId === pacienteSeleccionado.id && parada.tramo === tramo)) {
      setError(
        `${pacienteSeleccionado.apellido}, ${pacienteSeleccionado.nombre} ya tiene una parada de ${TRAMO_LABELS[tramo]} en este recorrido.`,
      );
      return;
    }

    const compatibilidad = validarCompatibilidadAccesorio({
      accesoriosPaciente: pacienteSeleccionado.accesorioMovilidad,
      accesoriosCompatiblesVehiculo: vehiculo.accesoriosCompatibles,
    });
    if (!compatibilidad.ok) {
      setError(compatibilidad.error);
      return;
    }

    const nuevaParada: ParadaRecorrido = {
      id: generateId('parada'),
      pacienteId: pacienteSeleccionado.id,
      tramo,
      direccionOrigenId: direccionOrigenId || (pacienteSeleccionado.direcciones[0]?.id ?? ''),
      direccionDestinoId: direccionDestinoId || (pacienteSeleccionado.direcciones[0]?.id ?? ''),
      orden: recorrido.paradas.length,
      horaEstimada: horaEstimada || undefined,
    };
    onAgregar(nuevaParada);
  }

  if (pacientes.length === 0) {
    return <p className="m-0 font-body text-sm text-muted">No hay pacientes disponibles para asignar.</p>;
  }

  // Con el atajo "Destino habitual" la fila pasa de 6 a 7 campos: a `lg` (1024px) ya no entran
  // legibles, así que el layout en una sola línea se corre a `xl` y por debajo se apila — mismo
  // criterio que ya tenía la fila de 6. Depende de que la función esté CABLEADA (hay repository),
  // no de que haya datos: el campo ocupa su columna igual cuando está deshabilitado explicando
  // que el paciente no tiene ninguno. Sin repository el grid queda EXACTAMENTE como antes.
  const gridColumnas =
    recorridoHabitualRepository !== undefined
      ? 'xl:grid-cols-[auto_minmax(0,1fr)_auto_auto_minmax(0,1fr)_minmax(0,1fr)_auto]'
      : 'lg:grid-cols-[auto_auto_auto_minmax(0,1fr)_minmax(0,1fr)_auto]';

  return (
    <div className="flex flex-col gap-sm rounded-sm border border-border bg-surface-soft p-md">
      {error && (
        <Alert tone="danger" size="sm">
          {error}
        </Alert>
      )}

      {/* gateo-hojas-de-ruta (design.md D4/D9, tasks.md 5.3): una sola inserción cubre
          SelectorPaciente + PacienteTramoCampos (ninguno de los dos cambia ni una línea ni
          recibe props nuevas) + la acción "Agregar pasajero". RequisitosPaciente queda fuera:
          sigue legible sin permiso de escritura.
          IMPORTANTE (security-review): esto es UX, no una frontera de seguridad — la
          autorización efectiva la impone la RLS vía modulos.tiene_permiso('pacientes', 'write').
          Mismo comentario que permisos.ts y usePuedeEscribir.ts. */}
      <CamposSoloLectura>
      {/* grid, no flex-wrap (feedback de usuario: "que el botón se mantenga en la misma línea"):
          Paciente/Hora/Tramo son `auto` (ocupan solo lo que su contenido necesita, feedback de
          usuario: "que no ocupen de más") y le dejan el espacio sobrante a las dos direcciones
          (`minmax(0, 1fr)` — así no se cortan) y a una columna `auto` fija para el botón, que
          nunca se cae a otra fila. Por debajo de `lg` los campos no entran igual, así que se
          apilan (grid-cols-1) en vez de quedar ilegibles. */}
      <div className={`grid grid-cols-1 items-end gap-md ${gridColumnas}`}>
        <SelectorPaciente formId={formId} pacientes={pacientes} value={pacienteId} onChange={handlePacienteChange} />

        {recorridoHabitualRepository !== undefined && (
          <SelectorRecorridoHabitual
            formId={formId}
            recorridos={recorridosHabituales}
            direcciones={pacienteSeleccionado?.direcciones ?? []}
            fecha={fecha}
            value={recorridoHabitualId}
            loading={cargandoHabituales}
            error={errorHabituales}
            onSelect={handleRecorridoHabitual}
          />
        )}

        <PacienteTramoCampos
          formId={formId}
          direcciones={pacienteSeleccionado?.direcciones ?? []}
          horaEstimada={horaEstimada}
          tramo={tramo}
          direccionOrigenId={direccionOrigenId}
          direccionDestinoId={direccionDestinoId}
          onHoraChange={setHoraEstimada}
          onTramoChange={setTramo}
          onDireccionOrigenChange={setDireccionOrigenId}
          onDireccionDestinoChange={setDireccionDestinoId}
        />

        <div className="justify-self-end">
          <Button variant="primary" requiereEscritura onClick={handleSubmit} ariaLabel="Agregar pasajero">
            <PlusIcon />
            Agregar pasajero
          </Button>
        </div>
      </div>
      </CamposSoloLectura>

      {pacienteSeleccionado && <RequisitosPaciente paciente={pacienteSeleccionado} vehiculo={vehiculo} />}
    </div>
  );
}
