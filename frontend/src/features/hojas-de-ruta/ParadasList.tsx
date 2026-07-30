import { Button, CamposSoloLectura } from '../../design-system/components';
import { moveDown, moveUp } from '../../shared/lib/reorder';
import type { ParadaRecorrido } from '../../shared/types/hojaDeRuta';
import { TRAMO_LABELS } from '../pacientes/direccionOptions';
import { PinIcon } from './icons';

interface ParadasListProps {
  paradas: ParadaRecorrido[];
  nombrePaciente: (pacienteId: string) => string;
  /** Resuelve una `Direccion` del catálogo del paciente a texto legible (mismo criterio que HojaDeRutaImprimible). */
  direccionTexto: (direccionId: string, pacienteId: string) => string;
  /** false = recorrido ya armado, vista solo-lectura (feedback de usuario) — sin controles. */
  editable: boolean;
  onReordenar: (paradas: ParadaRecorrido[]) => void;
  onQuitar: (paradaId: string) => void;
}

// Lista de paradas (tasks.md 5.4, 6.3, RN-HR-01): botones subir/bajar como fallback accesible
// (WCAG 2.1 AA) a un futuro drag-and-drop, visibles solo en modo `editable`; key por `parada.id`,
// nunca por índice (react-best-practices). El reorden manual siempre prevalece — no hay
// sugerencia automática que se aplique sin acción explícita del operador.
export function ParadasList({ paradas, nombrePaciente, direccionTexto, editable, onReordenar, onQuitar }: ParadasListProps) {
  if (paradas.length === 0) {
    return <p className="m-0 font-body text-sm text-muted">Sin paradas cargadas todavía.</p>;
  }

  // Solo-lectura (feedback de usuario, rediseño de la lista de recorridos del día): sin
  // numeración propia de la parada (esa la asume el número de la tarjeta del recorrido en
  // RecorridoCard) ni controles de reorden/quitar — solo paciente + tramo/hora + dirección.
  if (!editable) {
    return (
      <div className="flex flex-col gap-sm">
        {paradas.map((parada) => {
          const nombre = nombrePaciente(parada.pacienteId);
          return (
            <div key={parada.id} className="flex items-start gap-sm">
              <span className="mt-0.5 shrink-0 text-muted">
                <PinIcon />
              </span>
              <div>
                <p className="m-0 font-body text-[14px] font-semibold text-ink">
                  {nombre}
                  {parada.horaEstimada && <span className="font-normal text-muted"> · {parada.horaEstimada}</span>}
                </p>
                <p className="m-0 font-body text-[13px] text-muted">
                  {direccionTexto(parada.direccionOrigenId, parada.pacienteId)} →{' '}
                  {direccionTexto(parada.direccionDestinoId, parada.pacienteId)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-xs p-0">
      {paradas.map((parada, indice) => {
        const nombre = nombrePaciente(parada.pacienteId);
        return (
          <li
            key={parada.id}
            className="flex flex-wrap items-center justify-between gap-sm rounded-sm border border-border bg-surface px-md py-sm"
          >
            <div className="flex flex-wrap items-center gap-sm font-body text-[13px] text-text">
              <span className="font-mono text-[11px] text-faint">{indice + 1}</span>
              <span className="font-semibold text-ink">{nombre}</span>
              <span className="text-muted">· {TRAMO_LABELS[parada.tramo]}</span>
              {parada.horaEstimada && <span className="text-muted">· {parada.horaEstimada}</span>}
              <span className="text-muted">
                {direccionTexto(parada.direccionOrigenId, parada.pacienteId)} →{' '}
                {direccionTexto(parada.direccionDestinoId, parada.pacienteId)}
              </span>
            </div>
            {editable && (
              // gateo-hojas-de-ruta (design.md D6, tasks.md 5.1/5.2): Subir/Bajar son Button del
              // design system (prop opt-in); Quitar es un <button> nativo, fuera del alcance de
              // esa prop — un solo CamposSoloLectura cubre los tres. El `disabled` de Subir/Bajar
              // en el borde de la lista (primera/última parada) es una razón previa e
              // independiente del gateo; la disyunción ya la resuelve Button internamente.
              // IMPORTANTE (security-review): esto es UX, no una frontera de seguridad — la
              // autorización efectiva la impone la RLS vía modulos.tiene_permiso('pacientes',
              // 'write'). Mismo comentario que permisos.ts y usePuedeEscribir.ts.
              <CamposSoloLectura>
              <div className="flex items-center gap-xs">
                <Button
                  variant="secondary-accent"
                  size="xs"
                  ariaLabel={`Subir ${nombre}`}
                  disabled={indice === 0}
                  requiereEscritura
                  onClick={() => onReordenar(moveUp(paradas, indice))}
                >
                  ↑
                </Button>
                <Button
                  variant="secondary-accent"
                  size="xs"
                  ariaLabel={`Bajar ${nombre}`}
                  disabled={indice === paradas.length - 1}
                  requiereEscritura
                  onClick={() => onReordenar(moveDown(paradas, indice))}
                >
                  ↓
                </Button>
                <button
                  type="button"
                  onClick={() => onQuitar(parada.id)}
                  className="cursor-pointer rounded-sm border border-danger-soft bg-danger-soft px-sm py-xs font-body text-xs font-semibold text-danger"
                >
                  Quitar
                </button>
              </div>
              </CamposSoloLectura>
            )}
          </li>
        );
      })}
    </ul>
  );
}
