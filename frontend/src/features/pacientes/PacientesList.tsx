import { useMemo, useState } from 'react';
import { Button, Chip, SearchInput } from '../../design-system/components';
import { Alert, EmptyState, Pill } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
import { CUD_CHIP_KIND, CUD_CHIP_LABEL } from '../../shared/lib/pacientes/cudCopy';
import { estadoCud } from '../../shared/lib/pacientes/estadoCud';
import type { Paciente } from '../../shared/types/paciente';
import { ACCESORIO_MOVILIDAD_LABELS } from '../vehiculos/accesorioMovilidadOptions';
import { nombreCompleto } from './PacienteResumen';

interface PacientesListProps {
  pacientes: Paciente[];
  loading: boolean;
  error: string | null;
  /** Resuelve el nombre a mostrar de la obra social asignada (o "Sin obra social" si es null). */
  nombreObraSocial: (obraSocialId: string | null) => string;
  onSelect: (paciente: Paciente) => void;
  onCreateNew: () => void;
  /** Fecha de referencia inyectable (tests) para edad y estado del CUD; por defecto "ahora" real. */
  ahora?: Date;
}

function calcularEdad(fechaNacimiento: string, ahora: Date): number {
  const nacimiento = new Date(fechaNacimiento);
  let edad = ahora.getFullYear() - nacimiento.getFullYear();
  const aunNoCumplioEsteAnio =
    ahora.getMonth() < nacimiento.getMonth() ||
    (ahora.getMonth() === nacimiento.getMonth() && ahora.getDate() < nacimiento.getDate());
  if (aunNoCumplioEsteAnio) edad -= 1;
  return edad;
}

// Pantalla de listado (tasks.md 5.1/5.2): estados de carga/vacío/error explícitos (nunca una
// pantalla en blanco), presentacional puro salvo el filtro de búsqueda (estado local, no
// persiste). Grid de tarjetas con toda la info del maestro visible de entrada — mismo criterio
// ya aplicado en ObrasSocialesList/VehiculosList (FE-2/FE-3).
export function PacientesList({
  pacientes,
  loading,
  error,
  nombreObraSocial,
  onSelect,
  onCreateNew,
  ahora = new Date(),
}: PacientesListProps) {
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return pacientes;
    return pacientes.filter(
      (paciente) => nombreCompleto(paciente).toLowerCase().includes(termino) || paciente.dni.includes(termino),
    );
  }, [busqueda, pacientes]);

  return (
    <div className="flex flex-col gap-lg py-xxl px-xl">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="m-0 font-heading text-[21px] font-bold text-ink">Pacientes</h1>
        <Button variant="primary" onClick={onCreateNew}>
          + Nuevo paciente
        </Button>
      </div>

      {pacientes.length > 0 && (
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por nombre o DNI…"
          ariaLabel="Buscar paciente"
        />
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <p className="font-body text-sm text-muted">Cargando pacientes…</p>
      ) : pacientes.length === 0 ? (
        <EmptyState
          message="No hay pacientes cargados todavía."
          action={
            <Button variant="secondary" onClick={onCreateNew}>
              Crear el primer paciente
            </Button>
          }
        />
      ) : filtrados.length === 0 ? (
        <p className="font-body text-sm text-muted">Ningún paciente coincide con "{busqueda}".</p>
      ) : (
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          {filtrados.map((paciente) => {
            const cudEstado = paciente.cud ? estadoCud(paciente.cud, ahora) : null;

            return (
              <Card key={paciente.id} radius="md" elevated interactive onClick={() => onSelect(paciente)}>
                <div className="flex flex-wrap items-start justify-between gap-sm">
                  <div className="flex flex-col">
                    <span className="font-body text-[14px] font-semibold text-ink">{nombreCompleto(paciente)}</span>
                    <span className="font-body text-[12px] text-muted">
                      {calcularEdad(paciente.fechaNacimiento, ahora)} años · DNI <span className="font-mono">{paciente.dni}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-xs">
                    {paciente.amparoJudicial && <Chip kind="info">Amparo judicial</Chip>}
                    {cudEstado && <Chip kind={CUD_CHIP_KIND[cudEstado]}>CUD {CUD_CHIP_LABEL[cudEstado]}</Chip>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-sm border-y border-border py-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-body text-[11px] text-muted">Obra social</span>
                    <span className="font-body text-[13px] font-semibold text-ink">{nombreObraSocial(paciente.obraSocialId)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-body text-[11px] text-muted">CUIL titular</span>
                    <span className="font-mono text-[13px] font-semibold text-ink">{paciente.cuilTitular}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-body text-[11px] text-muted">N° afiliado</span>
                    <span className="font-mono text-[13px] font-semibold text-ink">{paciente.numeroAfiliado.valor}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="font-body text-[11px] text-muted">Diagnóstico</span>
                  <span className="font-body text-[13px] text-ink">
                    {paciente.diagnostico}
                    {paciente.condicion ? ` · ${paciente.condicion}` : ''}
                  </span>
                </div>

                {paciente.accesorioMovilidad.length > 0 && (
                  <div className="flex flex-wrap items-center gap-xs">
                    {paciente.accesorioMovilidad.map((accesorio) => (
                      <Pill key={accesorio}>{ACCESORIO_MOVILIDAD_LABELS[accesorio]}</Pill>
                    ))}
                  </div>
                )}

                <span className="font-body text-[12px] text-muted">
                  {paciente.direcciones.length === 0 ? 'Sin direcciones' : `${paciente.direcciones.length} direcciones`}
                  {' · '}
                  {paciente.personasACargo.length === 0
                    ? 'Sin personas a cargo'
                    : `${paciente.personasACargo.length} persona${paciente.personasACargo.length === 1 ? '' : 's'} a cargo`}
                </span>

                <div className="flex items-center justify-end gap-md pt-xs">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(paciente);
                    }}
                    className="cursor-pointer border-none bg-transparent p-0 font-body text-[13px] font-semibold text-primary"
                  >
                    Ver detalle
                  </button>
                  <Button
                    variant="secondary-accent"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(paciente);
                    }}
                    ariaLabel={`Editar ${nombreCompleto(paciente)}`}
                  >
                    Editar
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
