import { Button, Chip } from '../../design-system/components';
import { Card } from '../../design-system/layout';
import { CUD_CHIP_KIND, CUD_CHIP_LABEL } from '../../shared/lib/pacientes/cudCopy';
import { estadoCud } from '../../shared/lib/pacientes/estadoCud';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import { ACCESORIO_MOVILIDAD_LABELS } from '../vehiculos/accesorioMovilidadOptions';

interface PacienteResumenProps {
  paciente: Paciente;
  obrasSociales: ObraSocial[];
  onEdit: () => void;
  /** Fecha de referencia inyectable (tests) para edad y estado del CUD; por defecto "ahora" real. */
  ahora?: Date;
}

type NombreCompleto = Pick<Paciente, 'apellido' | 'segundoApellido' | 'nombre' | 'segundoNombre'>;

/** Apellido(s) + nombre(s) completos, incluyendo segundo nombre/apellido cuando están cargados
 * (opcionales — docx los separa del primero). Reutilizado por PacienteDetail para el título de
 * la sección, para no duplicar el formato. */
export function nombreCompleto(paciente: NombreCompleto): string {
  const apellido = paciente.segundoApellido ? `${paciente.apellido} ${paciente.segundoApellido}` : paciente.apellido;
  const nombre = paciente.segundoNombre ? `${paciente.nombre} ${paciente.segundoNombre}` : paciente.nombre;
  return `${apellido}, ${nombre}`;
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

// Resumen de solo lectura del paciente (tasks.md 6.1), extraído de PacienteDetail para
// mantenerlo bajo ~200 líneas (react-best-practices). Muestra toda la info editable del form
// (mismo criterio que ObraSocialDetail/VehiculoDetail) para no obligar a abrir "Editar datos"
// solo para consultar un dato.
export function PacienteResumen({ paciente, obrasSociales, onEdit, ahora = new Date() }: PacienteResumenProps) {
  const cudEstado = paciente.cud ? estadoCud(paciente.cud, ahora) : null;
  const obraSocial = obrasSociales.find((os) => os.id === paciente.obraSocialId);

  return (
    <Card radius="sm" gap="md">
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

      <div className="grid grid-cols-2 gap-md border-y border-border py-md md:grid-cols-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-body text-[11px] text-muted">Obra social</span>
          <span className="font-body text-[13px] font-semibold text-ink">{obraSocial?.nombre ?? 'Sin obra social'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-body text-[11px] text-muted">CUIL titular</span>
          <span className="font-mono text-[13px] font-semibold text-ink">{paciente.cuilTitular}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-body text-[11px] text-muted">N° afiliado</span>
          <span className="font-mono text-[13px] font-semibold text-ink">{paciente.numeroAfiliado.valor}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-body text-[11px] text-muted">Fecha de nacimiento</span>
          <span className="font-body text-[13px] font-semibold text-ink">
            {new Date(paciente.fechaNacimiento).toLocaleDateString('es-AR')}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="font-body text-[11px] text-muted">Diagnóstico</span>
        <span className="font-body text-[13px] text-ink">
          {paciente.diagnostico}
          {paciente.condicion ? ` · ${paciente.condicion}` : ''}
        </span>
      </div>

      {paciente.amparoJudicial && paciente.amparoJudicialAclaracion && (
        <div className="flex flex-col gap-0.5">
          <span className="font-body text-[11px] text-muted">Aclaración del amparo</span>
          <span className="font-body text-[13px] text-ink">{paciente.amparoJudicialAclaracion}</span>
        </div>
      )}

      {paciente.accesorioMovilidad.length > 0 && (
        <div className="flex flex-wrap gap-sm">
          {paciente.accesorioMovilidad.map((accesorio) => (
            <Chip key={accesorio} kind="info">
              {ACCESORIO_MOVILIDAD_LABELS[accesorio]}
            </Chip>
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

      <div className="flex justify-end">
        <Button variant="secondary" requiereEscritura onClick={onEdit}>
          Editar datos
        </Button>
      </div>
    </Card>
  );
}
