import { useId, useState } from 'react';
import { Button } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { capacidadDisponible } from '../../shared/lib/hojas-de-ruta/capacidadDisponible';
import { validarCompatibilidadAccesorio } from '../../shared/lib/hojas-de-ruta/validarCompatibilidadAccesorio';
import type { Conductor } from '../../shared/types/conductor';
import type { Paciente } from '../../shared/types/paciente';
import type { Recorrido } from '../../shared/types/hojaDeRuta';
import type { Vehiculo } from '../../shared/types/vehiculo';

interface VistaGlobalHojaDeRutaProps {
  recorridos: Recorrido[];
  vehiculos: Vehiculo[];
  conductores: Conductor[];
  pacientes: Paciente[];
  onReasignar: (paradaId: string, origenRecorridoId: string, destinoRecorridoId: string) => void;
}

interface FilaReasignacion {
  recorridoId: string;
  paradaId: string;
  pacienteId: string;
}

// Vista global del día (tasks.md 7.5, RF-705, RN-VE-01/RN-VE-02): recorre todos los recorridos,
// señala los que tienen vehículo o conductor fuera de servicio, y permite reasignar cada pasaje
// afectado a otro recorrido con vehículo habilitado + conductor operando — la reasignación se
// bloquea en la UI si rompe compatibilidad de accesorio (RN-VE-01) o no hay capacidad.
export function VistaGlobalHojaDeRuta({ recorridos, vehiculos, conductores, pacientes, onReasignar }: VistaGlobalHojaDeRutaProps) {
  const formId = useId();
  const [destinoPorFila, setDestinoPorFila] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function vehiculoDe(recorrido: Recorrido): Vehiculo | undefined {
    return vehiculos.find((v) => v.id === recorrido.vehiculoId);
  }
  function conductorDe(recorrido: Recorrido): Conductor | undefined {
    return conductores.find((c) => c.id === recorrido.conductorId);
  }
  function nombrePaciente(pacienteId: string): string {
    const paciente = pacientes.find((p) => p.id === pacienteId);
    return paciente ? `${paciente.apellido}, ${paciente.nombre}` : 'Paciente desconocido';
  }

  function razonConflicto(recorrido: Recorrido): string | null {
    if (vehiculoDe(recorrido)?.estado === 'fuera-de-servicio') return 'Vehículo fuera de servicio';
    if (conductorDe(recorrido)?.estado === 'fuera-de-servicio') return 'Conductor fuera de servicio';
    return null;
  }

  const recorridosConConflicto = recorridos.filter((r) => razonConflicto(r) !== null);
  const recorridosDisponibles = recorridos.filter((r) => razonConflicto(r) === null);

  function filaKey(fila: FilaReasignacion): string {
    return `${fila.recorridoId}-${fila.paradaId}`;
  }

  function handleMover(fila: FilaReasignacion) {
    setError(null);
    const destinoId = destinoPorFila[filaKey(fila)];
    const destino = recorridosDisponibles.find((r) => r.id === destinoId);
    const vehiculoDestino = destino ? vehiculoDe(destino) : undefined;
    const paciente = pacientes.find((p) => p.id === fila.pacienteId);

    if (!destino || !vehiculoDestino || !paciente) {
      setError('Elegí un recorrido destino válido.');
      return;
    }
    if (!capacidadDisponible(vehiculoDestino, destino)) {
      setError(`El vehículo ${vehiculoDestino.patente} no tiene lugar disponible.`);
      return;
    }
    const compatibilidad = validarCompatibilidadAccesorio({
      accesoriosPaciente: paciente.accesorioMovilidad,
      accesoriosCompatiblesVehiculo: vehiculoDestino.accesoriosCompatibles,
    });
    if (!compatibilidad.ok) {
      setError(compatibilidad.error);
      return;
    }

    onReasignar(fila.paradaId, fila.recorridoId, destino.id);
  }

  if (recorridosConConflicto.length === 0) {
    return (
      <p role="status" className="m-0 font-body text-sm text-muted">
        Sin conflictos: todos los recorridos tienen vehículo habilitado y conductor operando.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      {error && (
        <Alert tone="danger" size="sm">
          {error}
        </Alert>
      )}

      {recorridosConConflicto.map((recorrido) => (
        <div key={recorrido.id} className="flex flex-col gap-sm rounded-sm border border-warning-soft bg-warning-soft p-md">
          <p className="m-0 font-body text-[13px] font-semibold text-warning">⚠ {razonConflicto(recorrido)}</p>

          {recorrido.paradas.map((parada) => {
            const fila: FilaReasignacion = { recorridoId: recorrido.id, paradaId: parada.id, pacienteId: parada.pacienteId };
            const nombre = nombrePaciente(parada.pacienteId);
            return (
              <div key={parada.id} className="flex flex-wrap items-center gap-sm">
                <span className="font-body text-[13px] text-ink">{nombre}</span>
                <label htmlFor={`${formId}-${filaKey(fila)}`} className="sr-only">
                  Reasignar {nombre} a
                </label>
                {/* NOTA (tasks.md sección 15.5, gap de API — no resuelto acá): verificado el color
                    heredado que pide la task. Este <select> no declara ningún `text-*` propio y,
                    constatado contra src/index.css/AppShell.tsx, ningún ancestro (body, <main>,
                    este componente) fija tampoco un color de texto — hereda el color por default
                    del navegador (negro puro), no `--color-text` (#2E3D3C). `Select`
                    (design-system/form.tsx) siempre agrega `text-text` (tone='default') o
                    `text-muted` (tone='muted'): no existe un tono "sin color declarado". Migrarlo
                    cambiaría el color de este texto (viola REGLA 0). Se deja `<select>` nativo. */}
                <select
                  id={`${formId}-${filaKey(fila)}`}
                  className="rounded-sm border border-border-strong bg-surface px-sm py-1 font-body text-[12px]"
                  value={destinoPorFila[filaKey(fila)] ?? ''}
                  onChange={(event) =>
                    setDestinoPorFila((prev) => ({ ...prev, [filaKey(fila)]: event.target.value }))
                  }
                >
                  <option value="">Elegir recorrido destino…</option>
                  {recorridosDisponibles.map((destino) => (
                    <option key={destino.id} value={destino.id}>
                      {vehiculoDe(destino)?.patente ?? destino.id}
                    </option>
                  ))}
                </select>
                <Button variant="secondary" onClick={() => handleMover(fila)}>
                  Mover
                </Button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
