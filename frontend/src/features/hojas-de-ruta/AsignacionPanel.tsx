import { useId, useState } from 'react';
import { Button, CamposSoloLectura } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { generateId } from '../../shared/lib/id';
import { capacidadDisponible } from '../../shared/lib/hojas-de-ruta/capacidadDisponible';
import { validarCompatibilidadAccesorio } from '../../shared/lib/hojas-de-ruta/validarCompatibilidadAccesorio';
import type { Paciente } from '../../shared/types/paciente';
import type { ParadaRecorrido, Recorrido, Tramo } from '../../shared/types/hojaDeRuta';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { PlusIcon } from './icons';
import { PacienteTramoCampos } from './PacienteTramoCampos';
import { RequisitosPaciente } from './RequisitosPaciente';
import { SelectorPaciente } from './SelectorPaciente';

interface AsignacionPanelProps {
  recorrido: Recorrido;
  /** Vehículo del recorrido, resuelto por el caller a partir de `recorrido.vehiculoId`. */
  vehiculo: Vehiculo | undefined;
  /** Candidatos a asignar — la pantalla decide si filtra a los que ya están en el recorrido. */
  pacientes: Paciente[];
  onAgregar: (parada: ParadaRecorrido) => void;
  /**
   * Modo controlado opcional (feedback de usuario: "mismo comportamiento que crear recorrido") —
   * RecorridoCard lo usa para conocer, en vivo y sin confirmar todavía, a quién se está por
   * agregar, y así filtrar su propio selector de Vehículo. Sin estos dos props, el paciente
   * elegido es estado interno (comportamiento previo, sin cambios).
   */
  pacienteId?: string;
  onPacienteIdChange?: (pacienteId: string) => void;
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
}: AsignacionPanelProps) {
  const formId = useId();
  const [pacienteIdInterno, setPacienteIdInterno] = useState(pacientes[0]?.id ?? '');
  const pacienteId = pacienteIdControlado ?? pacienteIdInterno;
  const [tramo, setTramo] = useState<Tramo>('ida');
  const [direccionOrigenId, setDireccionOrigenId] = useState('');
  const [direccionDestinoId, setDireccionDestinoId] = useState('');
  const [horaEstimada, setHoraEstimada] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pacienteSeleccionado = pacientes.find((p) => p.id === pacienteId);

  function handlePacienteChange(id: string) {
    setPacienteIdInterno(id);
    onPacienteIdChange?.(id);
    setDireccionOrigenId('');
    setDireccionDestinoId('');
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
      <div className="flex flex-wrap items-end gap-md">
        <SelectorPaciente formId={formId} pacientes={pacientes} value={pacienteId} onChange={handlePacienteChange} />

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

        <Button variant="secondary" requiereEscritura onClick={handleSubmit}>
          <PlusIcon />
          Agregar pasajero
        </Button>
      </div>
      </CamposSoloLectura>

      {pacienteSeleccionado && <RequisitosPaciente paciente={pacienteSeleccionado} vehiculo={vehiculo} />}
    </div>
  );
}
