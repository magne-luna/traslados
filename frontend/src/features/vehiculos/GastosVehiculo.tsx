import { useId, useState, type FormEvent } from 'react';
import { Button, Chip } from '../../design-system/components';
import { Field, Input, Select } from '../../design-system/form';
import { Table, Td, Th, Tr } from '../../design-system/table';
import type { CategoriaGasto, GastoVehiculo } from '../../shared/types/vehiculo';
import { CATEGORIA_GASTO_CHIP_KIND, CATEGORIA_GASTO_LABELS, CATEGORIA_GASTO_OPTIONS } from './categoriaGastoOptions';
import { validateGastoForm, type GastoFormErrors } from './validateGastoForm';

export interface NuevoGastoInput {
  fecha: string;
  monto: number;
  descripcion: string;
  categoria: CategoriaGasto;
}

interface GastosVehiculoProps {
  gastos: GastoVehiculo[];
  onAgregar: (data: NuevoGastoInput) => void;
  /** Fecha de referencia inyectable (tests) para calcular "gastado este mes"; por defecto "ahora" real. */
  ahora?: Date;
}

function formatoMonto(monto: number): string {
  return `$${monto.toLocaleString('es-AR')}`;
}

function formatoFecha(fechaIso: string): string {
  return new Date(fechaIso).toLocaleDateString('es-AR');
}

function esDelMismoMes(fechaIso: string, ahora: Date): boolean {
  const fecha = new Date(fechaIso);
  return fecha.getFullYear() === ahora.getFullYear() && fecha.getMonth() === ahora.getMonth();
}

// Registro de gastos del vehículo (tasks.md 7.1/7.2, RF-508): resumen de totales arriba + tabla
// (izquierda) y form de alta en una card aparte (derecha) — mismo criterio de "todo a la vista"
// que el resto del rediseño de vehiculos-ui. Alta validada por validateGastoForm (función pura);
// no hay borrado todavía (decisión explícita del usuario, fuera de alcance de este cambio).
export function GastosVehiculo({ gastos, onAgregar, ahora = new Date() }: GastosVehiculoProps) {
  const [fecha, setFecha] = useState('');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState<CategoriaGasto>('mantenimiento');
  const [errors, setErrors] = useState<GastoFormErrors>({});
  const formId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const montoNumerico = Number(monto);
    const validationErrors = validateGastoForm({ fecha, monto: montoNumerico });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onAgregar({ fecha, monto: montoNumerico, descripcion, categoria });
    setFecha('');
    setMonto('');
    setDescripcion('');
    setCategoria('mantenimiento');
  }

  const totalGastado = gastos.reduce((total, gasto) => total + gasto.monto, 0);
  const totalEsteMes = gastos.filter((gasto) => esDelMismoMes(gasto.fecha, ahora)).reduce((total, gasto) => total + gasto.monto, 0);
  const ultimoGasto = [...gastos].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

  return (
    <div className="flex flex-col gap-lg">
      {gastos.length > 0 && (
        <div className="grid grid-cols-1 gap-md rounded-md border border-border bg-surface p-lg sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-body text-[11px] text-muted">Total gastado</span>
            <span className="font-heading text-[19px] font-bold text-ink">{formatoMonto(totalGastado)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-body text-[11px] text-muted">Este mes</span>
            <span className="font-heading text-[19px] font-bold text-ink">{formatoMonto(totalEsteMes)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-body text-[11px] text-muted">Último gasto</span>
            <span className="font-heading text-[19px] font-bold text-ink">{ultimoGasto ? formatoFecha(ultimoGasto.fecha) : '—'}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[2fr_1fr]">
        <div className="rounded-md border border-border bg-surface p-lg">
          {gastos.length === 0 ? (
            <p className="m-0 font-body text-sm text-muted">No hay gastos registrados todavía.</p>
          ) : (
            <Table caption="Gastos registrados del vehículo" scrollable={false}>
              <thead>
                <Tr>
                  <Th scope="col" align="left" padding="md" divided muted>
                    Fecha
                  </Th>
                  <Th scope="col" align="left" padding="md" divided muted>
                    Monto
                  </Th>
                  <Th scope="col" align="left" padding="md" divided muted>
                    Descripción
                  </Th>
                  <Th scope="col" align="left" padding="md" divided muted>
                    Categoría
                  </Th>
                </Tr>
              </thead>
              <tbody>
                {gastos.map((gasto) => (
                  <Tr key={gasto.id}>
                    <Td padding="md" divided>
                      {formatoFecha(gasto.fecha)}
                    </Td>
                    <Td padding="md" divided>
                      <span className="font-semibold text-success">{formatoMonto(gasto.monto)}</span>
                    </Td>
                    <Td padding="md" divided>
                      {gasto.descripcion || '—'}
                    </Td>
                    <Td padding="md" divided>
                      <Chip kind={CATEGORIA_GASTO_CHIP_KIND[gasto.categoria]}>{CATEGORIA_GASTO_LABELS[gasto.categoria]}</Chip>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-md rounded-md border border-border bg-surface p-lg">
          <div className="flex flex-col">
            <span className="font-body text-[11px] text-muted">Nuevo gasto</span>
            <span className="font-heading text-[15px] font-bold text-ink">Registrar gasto</span>
          </div>

          <Field label="Fecha" htmlFor={`${formId}-fecha`} error={errors.fecha}>
            <Input
              id={`${formId}-fecha`}
              type="date"
              density="comfortable"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
            />
          </Field>

          <Field label="Monto" htmlFor={`${formId}-monto`} error={errors.monto}>
            <Input
              id={`${formId}-monto`}
              type="number"
              density="comfortable"
              value={monto}
              onChange={(event) => setMonto(event.target.value)}
            />
          </Field>

          <Field label="Descripción" htmlFor={`${formId}-descripcion`}>
            <Input
              id={`${formId}-descripcion`}
              density="comfortable"
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
            />
          </Field>

          <Field label="Categoría" htmlFor={`${formId}-categoria`}>
            <Select
              id={`${formId}-categoria`}
              density="comfortable"
              value={categoria}
              onChange={(event) => setCategoria(event.target.value as CategoriaGasto)}
            >
              {CATEGORIA_GASTO_OPTIONS.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {CATEGORIA_GASTO_LABELS[opcion]}
                </option>
              ))}
            </Select>
          </Field>

          <Button type="submit" variant="primary">
            + Registrar
          </Button>
        </form>
      </div>
    </div>
  );
}
