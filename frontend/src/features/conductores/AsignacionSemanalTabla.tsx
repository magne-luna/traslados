import { useId, useState, type FormEvent } from 'react';
import { AvisoPendienteCliente, Button, CamposSoloLectura, InlineIcon } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Field, Input, Select } from '../../design-system/form';
import { Table, Td, Th, Tr } from '../../design-system/table';
import { iconCalendario } from '../../design-system/icons';
import type { AsignacionSemanal } from '../../shared/types/conductor';
import { semanaActualIso } from '../../shared/lib/conductores/semanaActualIso';
import { validarAsignacionSemanal } from '../../shared/lib/conductores/validarAsignacionSemanal';
import { useVehiculoRepository } from '../vehiculos/VehiculoRepositoryContext';
import { useVehiculos } from '../vehiculos/useVehiculos';

interface AsignacionSemanalTablaProps {
  asignaciones: AsignacionSemanal[];
  /** Fecha de referencia inyectable (tests); por defecto "ahora" real (design.md Decisión 4). */
  ahora?: Date;
  onAgregar: (asignacion: { vehiculoId: string; semana: string }) => void;
}

// Tabla de asignación semanal a vehículo (tasks.md 6.1 a 6.3, 9.2, 11.2, design.md Decisiones 4, 6
// y 7): el selector de vehículo lee VehiculoRepository.list() vía su propio context (sin embeber
// el objeto Vehiculo, guarda solo vehiculoId), y el alta se bloquea client-side con la función
// pura validarAsignacionSemanal salvo que se habilite explícitamente `permitirMultiple`. Historial
// (solo lectura) y alta separados en dos bloques con su propio título — el historial vacío usa un
// estado ilustrado (ícono + texto secundario) en vez de una línea de texto suelta, y el toggle
// "Permitir múltiple" se agrupa en la misma fila que "Asignar" (mismo patrón de switch ya usado
// en ChecklistItemRow, obras-sociales-ui).
//
// NOTA (tasks.md 11.2, gobernanza MEDIO): el contenedor `rounded-md` de más abajo usa
// `grid grid-cols-1 md:grid-cols-2`, no `flex flex-col` — Card (layout.tsx) solo soporta
// `flex flex-col` en su base, así que NO se migró a Card acá (haría cambiar el layout de 2
// columnas a una columna apilada, violando REGLA 0). Se deja como div nativo; reportado en el
// resumen del apply. Los `<select>`/`<input>` de "Nueva asignación" SÍ tienen label visible propio
// (no son "selects de celda") y migran con `Field`, no sueltos.
export function AsignacionSemanalTabla({ asignaciones, ahora = new Date(), onAgregar }: AsignacionSemanalTablaProps) {
  const vehiculoRepository = useVehiculoRepository();
  const { vehiculos } = useVehiculos(vehiculoRepository);
  const [vehiculoId, setVehiculoId] = useState('');
  const [semana, setSemana] = useState(semanaActualIso(ahora));
  const [permitirMultiple, setPermitirMultiple] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vehiculoId) return;

    const resultado = validarAsignacionSemanal({ asignaciones, semana, vehiculoId, permitirMultiple });
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    setError(null);
    onAgregar({ vehiculoId, semana });
  }

  return (
    <div className="flex flex-col gap-lg">
      <AvisoPendienteCliente>
        Confirmar si un conductor puede tener dos vehículos la misma semana (excepción explícita).
      </AvisoPendienteCliente>

      <div className="grid grid-cols-1 gap-lg rounded-md border border-border bg-surface p-lg md:grid-cols-2">
        <div className="flex flex-col gap-sm">
          <h3 className="m-0 font-body text-[14px] font-semibold text-ink">Historial de asignaciones</h3>

          {asignaciones.length === 0 ? (
            <div className="flex flex-col items-center gap-xs rounded-md border border-dashed border-border px-lg py-xxl text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-surface-soft text-muted">
                <InlineIcon size={24}>{iconCalendario}</InlineIcon>
              </span>
              <p className="m-0 font-body text-[13px] font-semibold text-ink">No hay asignaciones semanales registradas todavía.</p>
              <p className="m-0 font-body text-[12px] text-muted">Usá el formulario de abajo para crear la primera asignación.</p>
            </div>
          ) : (
            <Table caption="Historial de asignaciones semanales" scrollable={false}>
              <thead>
                <Tr>
                  <Th scope="col" align="left" padding="md" divided>
                    Semana
                  </Th>
                  <Th scope="col" align="left" padding="md" divided>
                    Patente
                  </Th>
                  <Th scope="col" align="left" padding="md" divided>
                    Modelo
                  </Th>
                </Tr>
              </thead>
              <tbody>
                {asignaciones.map((asignacion) => {
                  const vehiculo = vehiculos.find((v) => v.id === asignacion.vehiculoId);
                  return (
                    <Tr key={asignacion.id}>
                      <Td padding="md">{asignacion.semana}</Td>
                      <Td padding="md">{vehiculo?.patente ?? asignacion.vehiculoId}</Td>
                      <Td padding="md">{vehiculo?.modelo ?? '—'}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </div>

        <div className="flex flex-col gap-sm md:border-l md:border-border md:pl-lg">
          <h3 className="m-0 font-body text-[14px] font-semibold text-ink">Nueva asignación</h3>

          {error && <Alert tone="danger">{error}</Alert>}

          {/* gateo-conductores (design.md D2/riesgos, tasks.md 2.5): una sola inserción cubre
              el selector de vehículo, la semana y el toggle "Permitir múltiple". El historial
              (arriba) queda fuera del envoltorio y sigue legible sin permiso de escritura. */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-md">
            <CamposSoloLectura>
            <Field label="Vehículo" htmlFor={`${formId}-vehiculo`}>
              <Select
                id={`${formId}-vehiculo`}
                density="comfortable"
                value={vehiculoId}
                onChange={(event) => setVehiculoId(event.target.value)}
              >
                <option value="" disabled>
                  Elegir vehículo…
                </option>
                {vehiculos.map((vehiculo) => (
                  <option key={vehiculo.id} value={vehiculo.id}>
                    {vehiculo.patente} — {vehiculo.modelo}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Semana (ISO)" htmlFor={`${formId}-semana`}>
              <Input
                id={`${formId}-semana`}
                density="comfortable"
                value={semana}
                onChange={(event) => setSemana(event.target.value)}
              />
            </Field>

            <div className="flex items-center justify-between gap-md pt-xs">
              <label htmlFor={`${formId}-permitir-multiple`} className="flex items-center gap-sm font-body text-[13px] text-text">
                Permitir múltiple
                <span className="relative inline-flex items-center">
                  <input
                    id={`${formId}-permitir-multiple`}
                    type="checkbox"
                    checked={permitirMultiple}
                    onChange={(event) => setPermitirMultiple(event.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="h-5 w-9 rounded-pill bg-border-strong transition-colors peer-checked:bg-primary" />
                  <span className="absolute left-0.5 h-4 w-4 rounded-pill bg-surface shadow-sm transition-transform peer-checked:translate-x-4" />
                </span>
              </label>

              <Button type="submit" variant="secondary" requiereEscritura>
                Asignar
              </Button>
            </div>
            </CamposSoloLectura>
          </form>
        </div>
      </div>
    </div>
  );
}
