import { useId, useState } from 'react';
import { AvisoModeloDatos, AvisoSoloLectura, Button, Chip, Section } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { generateId } from '../../shared/lib/id';
import { agregarParada, quitarParada } from '../../shared/lib/hojas-de-ruta/paradasHelpers';
import { ordenarRecorridosPorHorario } from '../../shared/lib/hojas-de-ruta/ordenarRecorridosPorHorario';
import type { ConductorRepository } from '../../shared/lib/conductores/ConductorRepository';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import type { Recorrido } from '../../shared/types/hojaDeRuta';
import { useConductores } from '../conductores/useConductores';
import { usePacientes } from '../pacientes/usePacientes';
import { useVehiculos } from '../vehiculos/useVehiculos';
import { HojaDeRutaImprimible } from './HojaDeRutaImprimible';
import { useHojaDeRutaRepository } from './HojaDeRutaRepositoryContext';
import { CalendarIcon, ClockIcon, GlobeIcon, ListIcon, PrinterIcon } from './icons';
import { NuevoRecorridoForm, type NuevoRecorridoPayload } from './NuevoRecorridoForm';
import { RecorridoCard } from './RecorridoCard';
import { useHojasDeRuta } from './useHojasDeRuta';
import { VistaGlobalHojaDeRuta } from './VistaGlobalHojaDeRuta';

interface HojaDeRutaPageProps {
  /** Solo lectura — puebla selectores y resuelve nombres/accesorios/direcciones (design.md Decisión 9). */
  pacienteRepository: PacienteRepository;
  vehiculoRepository: VehiculoRepository;
  conductorRepository: ConductorRepository;
}

type Vista = 'armado' | 'global' | 'imprimir';

const FRANJA_INICIO_DEFAULT = '08:00';
const FRANJA_FIN_DEFAULT = '20:00';

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Pantalla de armado de la hoja de ruta del día (tasks.md 5.1-5.4, 7.5, 8.1, 9.1, US-700):
// selector de fecha/franja, estados de carga/vacío/error, agrupa recorridos por vehículo/
// conductor (un RecorridoCard por recorrido = por combinación vehículo+conductor), cartel
// AvisoModeloDatos siempre visible (design.md Decisión 8) y navegación a la vista global (7.5) y
// a la vista imprimible (8.1). < ~200 líneas — el resto vive en subcomponentes.
export function HojaDeRutaPage({ pacienteRepository, vehiculoRepository, conductorRepository }: HojaDeRutaPageProps) {
  const formId = useId();
  const hojaRepository = useHojaDeRutaRepository();
  const { hojasDeRuta, loading, error, crear, actualizar } = useHojasDeRuta(hojaRepository);
  const { pacientes } = usePacientes(pacienteRepository);
  const { vehiculos } = useVehiculos(vehiculoRepository);
  const { conductores } = useConductores(conductorRepository);

  const [fecha, setFecha] = useState(hoyIso);
  const [vista, setVista] = useState<Vista>('armado');

  const hojaDelDia = hojasDeRuta.find((h) => h.fecha === fecha) ?? null;

  async function handleCrearHoja() {
    await crear({ fecha, franjaInicio: FRANJA_INICIO_DEFAULT, franjaFin: FRANJA_FIN_DEFAULT, recorridos: [] });
  }

  async function handleCrearRecorrido(data: NuevoRecorridoPayload) {
    if (!hojaDelDia) return;
    const nuevoRecorrido: Recorrido = {
      id: generateId('recorrido'),
      vehiculoId: data.vehiculoId,
      conductorId: data.conductorId,
      manual: data.manual,
      notas: data.notas,
      paradas: data.paradas.map((parada) => ({ ...parada, id: generateId('parada') })),
    };
    await actualizar(hojaDelDia.id, { recorridos: [...hojaDelDia.recorridos, nuevoRecorrido] });
  }

  async function handleUpdateRecorrido(recorridoActualizado: Recorrido) {
    if (!hojaDelDia) return;
    await actualizar(hojaDelDia.id, {
      recorridos: hojaDelDia.recorridos.map((r) => (r.id === recorridoActualizado.id ? recorridoActualizado : r)),
    });
  }

  async function handleReasignar(paradaId: string, origenId: string, destinoId: string) {
    if (!hojaDelDia) return;
    const origen = hojaDelDia.recorridos.find((r) => r.id === origenId);
    const parada = origen?.paradas.find((p) => p.id === paradaId);
    if (!origen || !parada) return;

    const recorridos = hojaDelDia.recorridos.map((r) => {
      if (r.id === origenId) return { ...r, paradas: quitarParada(r.paradas, paradaId) };
      if (r.id === destinoId) return { ...r, paradas: agregarParada(r.paradas, parada) };
      return r;
    });
    await actualizar(hojaDelDia.id, { recorridos });
  }

  return (
    <div className="flex flex-col gap-lg py-xxl px-xl">
      <h1 className="m-0 font-heading text-[21px] font-bold text-ink">Hoja de ruta del día</h1>

      {/* gateo-hojas-de-ruta (design.md D7, tasks.md 7.1/7.2): una sola inserción, arriba del
          switch de vistas (:129-144, más abajo) — nunca dentro de una rama — para que sobreviva
          al conmutar entre armado, global e imprimir. Mismo patrón que ObraSocialesPage/
          PacientesPage. */}
      <AvisoSoloLectura />

      <AvisoModeloDatos>
        El modelo real (Traslados-Modelo-Datos.docx) no tiene entidad "Hoja de Ruta" y su
        "Historial de Recorridos" no tiene campo Conductor — <code>conductorId</code> es un campo
        agregado en este frontend, pendiente de confirmar con el dueño del docx (design.md
        Discrepancias 1 y 2).
      </AvisoModeloDatos>

      <div className="flex flex-wrap items-end gap-md">
        <div className="flex flex-col gap-xs">
          <label htmlFor={`${formId}-fecha`} className="font-body text-[12px] font-semibold text-muted">
            Fecha
          </label>
          <div className="flex items-center gap-xs rounded-sm border border-border-strong bg-surface px-md py-2 text-muted">
            <CalendarIcon />
            <input
              id={`${formId}-fecha`}
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="border-none bg-transparent p-0 font-body text-[13px] text-text focus:outline-none"
            />
          </div>
        </div>
        {hojaDelDia && (
          <div className="flex items-center gap-xs rounded-sm border border-border-strong bg-surface px-md py-2 text-muted">
            <ClockIcon />
            <span className="font-body text-[13px]">
              Franja {hojaDelDia.franjaInicio} a {hojaDelDia.franjaFin}
            </span>
          </div>
        )}

        {hojaDelDia && (
          <div className="ml-auto flex gap-xs">
            <Button variant={vista === 'armado' ? 'primary' : 'secondary'} onClick={() => setVista('armado')}>
              <ListIcon />
              Armado
            </Button>
            <Button variant={vista === 'global' ? 'primary' : 'secondary'} onClick={() => setVista('global')}>
              <GlobeIcon />
              Vista global
            </Button>
            <Button variant={vista === 'imprimir' ? 'primary' : 'secondary'} onClick={() => setVista('imprimir')}>
              <PrinterIcon />
              Imprimir
            </Button>
          </div>
        )}
      </div>

      {hojaDelDia && (
        <AvisoModeloDatos>
          La franja horaria y las notas al pie no existen en el docx — son atributos del agregado
          "Hoja de Ruta", que en sí tampoco existe en el modelo real (ver cartel de arriba).
        </AvisoModeloDatos>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <p className="font-body text-sm text-muted">Cargando hoja de ruta…</p>
      ) : !hojaDelDia ? (
        <div className="flex flex-col items-start gap-md rounded-sm border border-border bg-surface-soft p-xl">
          <p className="m-0 font-body text-sm text-muted">No hay hoja de ruta cargada para el {fecha}.</p>
          {/* gateo-hojas-de-ruta (design.md D9, tasks.md 2.1): única acción de escritura del
              estado vacío — sin campos que envolver acá, alcanza con la prop opt-in del Button.
              IMPORTANTE (security-review): esto es UX, no una frontera de seguridad — la
              autorización efectiva la impone la RLS vía modulos.tiene_permiso('pacientes',
              'write'). Mismo comentario que permisos.ts, usePuedeEscribir.ts y las pantallas ya
              cableadas. */}
          <Button variant="secondary" requiereEscritura onClick={handleCrearHoja}>
            + Crear hoja de ruta para este día
          </Button>
        </div>
      ) : vista === 'imprimir' ? (
        <HojaDeRutaImprimible hoja={hojaDelDia} vehiculos={vehiculos} conductores={conductores} pacientes={pacientes} />
      ) : vista === 'global' ? (
        <VistaGlobalHojaDeRuta
          recorridos={hojaDelDia.recorridos}
          vehiculos={vehiculos}
          conductores={conductores}
          pacientes={pacientes}
          onReasignar={handleReasignar}
        />
      ) : (
        <div className="flex flex-col gap-lg">
          <div className="flex flex-col gap-sm">
            <Chip kind="success">ARMADO</Chip>
            <NuevoRecorridoForm
              vehiculos={vehiculos}
              conductores={conductores}
              pacientes={pacientes}
              onCrear={handleCrearRecorrido}
            />
          </div>

          <Section label="Hoy" title="Recorridos del día">
            {hojaDelDia.recorridos.length === 0 ? (
              <p className="m-0 font-body text-sm text-muted">No hay recorridos cargados. Agregá el primero arriba.</p>
            ) : (
              <div className="flex flex-col gap-lg">
                {ordenarRecorridosPorHorario(hojaDelDia.recorridos).map((recorrido, index) => (
                  <RecorridoCard
                    key={recorrido.id}
                    numero={index + 1}
                    recorrido={recorrido}
                    vehiculo={vehiculos.find((v) => v.id === recorrido.vehiculoId)}
                    conductor={conductores.find((c) => c.id === recorrido.conductorId)}
                    vehiculos={vehiculos}
                    conductores={conductores}
                    pacientes={pacientes}
                    onUpdateRecorrido={handleUpdateRecorrido}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
