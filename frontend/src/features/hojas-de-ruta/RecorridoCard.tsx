import { useId, useState } from 'react';
import { AvisoModeloDatos, Button, CamposSoloLectura, Chip } from '../../design-system/components';
import { Label, Textarea } from '../../design-system/form';
import { conductoresDisponibles, vehiculosDisponibles } from '../../shared/lib/hojas-de-ruta/disponibilidad';
import { agregarParada, quitarParada } from '../../shared/lib/hojas-de-ruta/paradasHelpers';
import { pacienteDisponibleEnRecorrido } from '../../shared/lib/hojas-de-ruta/pacienteDisponibleEnRecorrido';
import { sugerirOrdenPorCercania } from '../../shared/lib/hojas-de-ruta/sugerirOrdenPorCercania';
import { vehiculosCompatibles } from '../../shared/lib/hojas-de-ruta/vehiculosCompatibles';
import type { Conductor } from '../../shared/types/conductor';
import type { Paciente } from '../../shared/types/paciente';
import type { Recorrido } from '../../shared/types/hojaDeRuta';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { TRAMO_LABELS } from '../pacientes/direccionOptions';
import { AsignacionPanel } from './AsignacionPanel';
import { ArrowLeftIcon, ArrowRightIcon, NotesIcon } from './icons';
import { ParadasList } from './ParadasList';
import { RecorridoHorario } from './RecorridoHorario';
import { RecorridoMapa } from './RecorridoMapa';
import { RecorridoStat } from './RecorridoStat';
import { RecorridoVehiculoConductor } from './RecorridoVehiculoConductor';

const NOTAS_MAX_LENGTH = 500;

interface RecorridoCardProps {
  recorrido: Recorrido;
  vehiculo: Vehiculo | undefined;
  conductor: Conductor | undefined;
  /** Universo completo — habilita el selector de cambio de vehículo en modo edición. */
  vehiculos: Vehiculo[];
  /** Universo completo — habilita el selector de cambio de conductor en modo edición. */
  conductores: Conductor[];
  pacientes: Paciente[];
  onUpdateRecorrido: (recorrido: Recorrido) => void;
  /** Posición del recorrido en la lista del día (feedback de usuario) — puramente de despliegue,
   * no identifica al recorrido (eso lo hace `recorrido.id`). */
  numero?: number;
}

// Tarjeta de un recorrido (tasks.md 5.4, 6.3, 7.1, 7.2, RN-HR-01/RF-702/RF-703): compone
// ParadasList + AsignacionPanel + RecorridoMapa (testeados por separado) y conecta el botón
// "Sugerir orden" a `sugerirOrdenPorCercania` — aplica la propuesta como lista editable, nunca
// impone la ruta; el reorden manual posterior siempre prevalece.
//
// Convención UI del proyecto (feedback de usuario): un recorrido ya armado arranca en modo
// SOLO-LECTURA (resumen) — igual que VehiculoDetail/PacienteDetail — y el botón "Editar" habilita
// reorden/quitar/agregar pasajero/notas editables; "Listo" vuelve al resumen. < ~200 líneas
// (react-best-practices).
export function RecorridoCard({
  recorrido,
  vehiculo,
  conductor,
  vehiculos,
  conductores,
  pacientes,
  onUpdateRecorrido,
  numero = 1,
}: RecorridoCardProps) {
  const formId = useId();
  const [editing, setEditing] = useState(false);
  const [notas, setNotas] = useState(recorrido.notas ?? '');

  // RN-HR-02 (feedback de usuario): ida y vuelta conviven en el mismo recorrido — un paciente
  // sigue disponible mientras le falte al menos un tramo, no desaparece apenas tiene una parada.
  const pacientesDisponibles = pacientes.filter((p) => pacienteDisponibleEnRecorrido(recorrido.paradas, p.id));
  // Paciente que se está por agregar en el panel de abajo, TODAVÍA sin confirmar (feedback de
  // usuario: "mismo comportamiento que crear recorrido" — el selector de vehículo debe reaccionar
  // en vivo a quién se está por sumar, no solo a los ya asignados).
  const [pacienteEnCursoId, setPacienteEnCursoId] = useState(pacientesDisponibles[0]?.id ?? '');
  const pacienteEnCurso = pacientesDisponibles.find((p) => p.id === pacienteEnCursoId);

  const pacientesEnRecorrido = pacientes.filter((p) => recorrido.paradas.some((parada) => parada.pacienteId === p.id));
  const vehiculosCandidatosGrupo = vehiculosCompatibles(vehiculosDisponibles(vehiculos), pacientesEnRecorrido);
  // El vehículo ACTUAL siempre queda como opción base aunque ya no pase el filtro del grupo YA
  // asignado (evita que el select quede sin value válido si, por ejemplo, salió de servicio
  // recién) — esta base NO se ve afectada por la preview del paciente en curso.
  const vehiculoActualEnCandidatos = vehiculosCandidatosGrupo.some((v) => v.id === recorrido.vehiculoId);
  const opcionesVehiculoBase =
    vehiculoActualEnCandidatos || !vehiculo ? vehiculosCandidatosGrupo : [vehiculo, ...vehiculosCandidatosGrupo];
  // Preview: si hay alguien elegido en "Agregar pasajero", se acota más — mismo criterio que
  // NuevoRecorridoForm, aplicado sobre las opciones ya calculadas para el grupo.
  const opcionesVehiculo = pacienteEnCurso
    ? vehiculosCompatibles(opcionesVehiculoBase, [pacienteEnCurso])
    : opcionesVehiculoBase;
  const conductoresCandidatos = conductoresDisponibles(conductores);
  const conductorActualEnCandidatos = conductoresCandidatos.some((c) => c.id === recorrido.conductorId);
  const opcionesConductor =
    conductorActualEnCandidatos || !conductor ? conductoresCandidatos : [conductor, ...conductoresCandidatos];

  function nombrePaciente(pacienteId: string): string {
    const paciente = pacientes.find((p) => p.id === pacienteId);
    return paciente ? `${paciente.apellido}, ${paciente.nombre}` : 'Paciente desconocido';
  }

  function direccionTexto(direccionId: string, pacienteId: string): string {
    const paciente = pacientes.find((p) => p.id === pacienteId);
    const direccion = paciente?.direcciones.find((d) => d.id === direccionId);
    return direccion ? `${direccion.calle}, ${direccion.localidad}` : 'Dirección desconocida';
  }

  function handleSugerirOrden() {
    onUpdateRecorrido({ ...recorrido, paradas: sugerirOrdenPorCercania(recorrido.paradas) });
  }

  function handleGuardarNotas() {
    if (notas !== (recorrido.notas ?? '')) {
      onUpdateRecorrido({ ...recorrido, notas: notas || undefined });
    }
  }

  const primeraParada = recorrido.paradas[0];

  // NOTA (tasks.md sección 15.2, gap de API — no resuelto acá): este contenedor es `flex gap-lg`
  // (fila: badge de número a la izquierda + contenido a la derecha, lado a lado), no `flex-col`.
  // `Card` (design-system/layout.tsx) fija `flex flex-col` en su base — envolverlo en `Card`
  // apilaría el badge arriba del contenido en vez de dejarlos en fila (viola REGLA 0). Mismo tipo
  // de límite que la sub-tarjeta grid de AsignacionSemanalTabla (sección 11.2.3) y el `<li>` de
  // DireccionesEditor/PersonasACargoEditor (sección 12.3). Se deja `<div>` nativo.
  return (
    <div className="flex gap-lg rounded-sm border border-border bg-surface p-lg shadow-sm">
      <div className="flex shrink-0 flex-col items-center justify-center gap-xs rounded-sm bg-success-soft px-md py-sm">
        <span className="font-heading text-[20px] font-bold text-success">{String(numero).padStart(2, '0')}</span>
        {primeraParada && (
          <>
            <span className="font-body text-[11px] font-semibold uppercase tracking-wide text-success">
              {TRAMO_LABELS[primeraParada.tramo]}
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-success">
              {primeraParada.tramo === 'ida' ? <ArrowRightIcon /> : <ArrowLeftIcon />}
            </span>
          </>
        )}
      </div>

      {/* Resumen de horario (feedback de usuario, mockup "más énfasis en los horarios"): solo en
          modo solo-lectura — en edición cada parada ya expone su propio campo "Hora estimada",
          mostrar además el resumen sería redundante. */}
      {!editing && <RecorridoHorario paradas={recorrido.paradas} />}

      <div className="flex flex-1 flex-col gap-md">
        <div className="flex flex-wrap items-start justify-between gap-sm">
          <div className="min-w-0 flex-1">
            <ParadasList
              paradas={recorrido.paradas}
              nombrePaciente={nombrePaciente}
              direccionTexto={direccionTexto}
              editable={editing}
              onReordenar={(paradas) => onUpdateRecorrido({ ...recorrido, paradas })}
              onQuitar={(paradaId) => onUpdateRecorrido({ ...recorrido, paradas: quitarParada(recorrido.paradas, paradaId) })}
            />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-sm">
            {recorrido.manual && <Chip kind="info">Manual</Chip>}
            {vehiculo?.estado === 'fuera-de-servicio' && <Chip kind="danger">⛔ Vehículo fuera de servicio</Chip>}
            {conductor?.estado === 'fuera-de-servicio' && <Chip kind="danger">⛔ Conductor fuera de servicio</Chip>}
            {/* gateo-hojas-de-ruta (design.md D3, tasks.md 4.1-4.3): "Sugerir orden" y "Editar"
                persisten (Editar es la única puerta al bloque de escritura de la tarjeta) y se
                gatean con la prop opt-in. "Listo" NO se gatea — sale del modo de edición sin
                persistir nada, mismo criterio que "Cancelar" en gateo-pacientes. Esta barra de
                acciones queda deliberadamente fuera de cualquier CamposSoloLectura.
                IMPORTANTE (security-review): esto es UX, no una frontera de seguridad — la
                autorización efectiva la impone la RLS vía modulos.tiene_permiso('pacientes',
                'write'). Mismo comentario que permisos.ts y usePuedeEscribir.ts. */}
            {editing ? (
              <>
                <Button variant="secondary" requiereEscritura onClick={handleSugerirOrden}>
                  Sugerir orden
                </Button>
                <Button variant="primary" onClick={() => setEditing(false)}>
                  Listo
                </Button>
              </>
            ) : (
              <Button variant="secondary" requiereEscritura onClick={() => setEditing(true)}>
                Editar
              </Button>
            )}
          </div>
        </div>

        {editing && (
          <AvisoModeloDatos>
            El docx no modela un orden de recogida dentro del recorrido ni coordenadas geográficas
            de las direcciones — el campo <code>orden</code> de cada parada y las coordenadas del
            mapa son agregados de este frontend para poder sugerir un orden por cercanía (RN-HR-01)
            y visualizarlo. En producción, las coordenadas reales las resolvería el backend por
            geocoding.
          </AvisoModeloDatos>
        )}

        <RecorridoMapa paradas={recorrido.paradas} nombrePaciente={nombrePaciente} />

        {editing && (
          <AsignacionPanel
            recorrido={recorrido}
            vehiculo={vehiculo}
            pacientes={pacientesDisponibles}
            pacienteId={pacienteEnCursoId}
            onPacienteIdChange={setPacienteEnCursoId}
            onAgregar={(parada) => {
              onUpdateRecorrido({ ...recorrido, paradas: agregarParada(recorrido.paradas, parada) });
              setPacienteEnCursoId('');
            }}
          />
        )}

        {editing ? (
          /* gateo-hojas-de-ruta (design.md D5, tasks.md 4.4/4.5): estos dos caminos persisten
             sin pasar por un Button (notas en onBlur, vehículo/conductor en onChange) — la prop
             opt-in de Button no los alcanza, así que los cubre CamposSoloLectura directamente
             acá. RecorridoVehiculoConductor.tsx no cambia ni una línea: el envoltorio va en el
             caller, no en el componente compartido.
             IMPORTANTE (security-review): esto es UX, no una frontera de seguridad — la
             autorización efectiva la impone la RLS vía modulos.tiene_permiso('pacientes',
             'write'). Mismo comentario que permisos.ts y usePuedeEscribir.ts. */
          <CamposSoloLectura>
            <RecorridoVehiculoConductor
              formId={formId}
              recorrido={recorrido}
              vehiculo={vehiculo}
              conductor={conductor}
              editing={editing}
              opcionesVehiculo={opcionesVehiculo}
              opcionesConductor={opcionesConductor}
              onChangeVehiculo={(vehiculoId) => onUpdateRecorrido({ ...recorrido, vehiculoId })}
              onChangeConductor={(conductorId) => onUpdateRecorrido({ ...recorrido, conductorId })}
            />

            <div className="flex flex-col gap-xs">
              <Label htmlFor={`${formId}-notas`}>Notas del recorrido (opcional)</Label>
              <Textarea
                id={`${formId}-notas`}
                value={notas}
                onChange={(event) => setNotas(event.target.value.slice(0, NOTAS_MAX_LENGTH))}
                onBlur={handleGuardarNotas}
                placeholder="Escribí una nota…"
                maxLength={NOTAS_MAX_LENGTH}
                rows={3}
              />
              <span className="self-end font-body text-[11px] text-faint">
                {notas.length}/{NOTAS_MAX_LENGTH}
              </span>
            </div>
          </CamposSoloLectura>
        ) : (
          <div className="flex flex-wrap divide-x divide-border border-t border-t-border pt-md">
            <RecorridoVehiculoConductor
              formId={formId}
              recorrido={recorrido}
              vehiculo={vehiculo}
              conductor={conductor}
              editing={editing}
              opcionesVehiculo={opcionesVehiculo}
              opcionesConductor={opcionesConductor}
              onChangeVehiculo={(vehiculoId) => onUpdateRecorrido({ ...recorrido, vehiculoId })}
              onChangeConductor={(conductorId) => onUpdateRecorrido({ ...recorrido, conductorId })}
            />
            <RecorridoStat icon={<NotesIcon />} label="Notas del recorrido" value={recorrido.notas || 'Sin notas.'} />
          </div>
        )}
      </div>
    </div>
  );
}
