import { useEffect, useRef, useState } from 'react';
import { Button, FieldGroupHeading } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { DocumentChecklist } from '../../shared/components/DocumentChecklist';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { useDocumentChecklist } from '../../shared/lib/documentos/useDocumentChecklist';
import type { ChecklistItem, DocumentoAdjunto } from '../../shared/types/documento';
import type { Direccion } from '../../shared/types/paciente';
import { usePuedeEscribir } from '../../shared/auth/usePuedeEscribir';
import { SeccionPlegable } from '../facturacion/SeccionPlegable';
// documentos-transferencia-actividad (tasks.md §12, Checkpoint (b) VEREDICTO REVISADO
// 2026-08-11): "Exportar" arma un `.zip` con los archivos reales de la actividad. El resumen
// imprimible que en su momento convivía con esta acción ("Ver resumen"/"Imprimir", más el
// embebido de §14) se sacó por completo — REVERTIDO (2026-08-11, decisión de la usuaria: "siento
// que no tiene utilidad"). Ver tasks.md §2/§11/§13/§14 para el historial completo.
import { armarZipDocumentacionActividad, dispararDescargaZip } from './exportacionZip';
import type { ProgresoInstancia } from './progresoDocumental';

interface PacienteDocumentosChecklistProps {
  pacienteId: string;
  items: ChecklistItem[];
  repository: DocumentoRepository;
  /** documentos-checklist-por-actividad (tasks.md 3.6, design.md Checkpoint (b) VEREDICTO opción
   * B): agrupa este checklist dentro de una actividad puntual del paciente (`Direccion.id`).
   * `undefined` = bloque "General" — documentos sin actividad (Checkpoint (c)). Se reenvía tal
   * cual al hook, que a su vez lo reenvía al repository (§2, ya implementado). */
  agrupacionId?: string;
  /** Encabezado visible de este bloque — qué actividad es (o la etiqueta del bloque "General").
   * Sin `label`, no se renderiza ningún encabezado propio (compatibilidad hacia atrás), aunque
   * hoy todo caller de este componente (PacienteDocumentos.tsx §3) pasa uno. */
  label?: string;
  /** documentos-transferencia-actividad (tasks.md 2.6, `paciente-documentos-exportacion`): la
   * `Direccion` completa de esta actividad — hace falta su `calle`/`localidad` para identificar
   * sin ambigüedad lo exportado. Opcional: sin ella (o sin `pacienteNombre`), "Exportar" no se
   * ofrece — mismo criterio que `label` para no romper compatibilidad con callers existentes. */
  direccion?: Direccion;
  /** documentos-transferencia-actividad (tasks.md 2.6): nombre legible del paciente, para el
   * encabezado de la exportación (`paciente-documentos-exportacion`, requisito "Lo exportado
   * identifica al paciente"). Opcional por el mismo motivo que `direccion`. */
  pacienteNombre?: string;
  /** documentos-checklist-por-actividad (tasks.md 5.1, design.md Checkpoint (f) VEREDICTO opción
   * A): reporta el progreso propio de esta instancia (cargados/total, misma fórmula que
   * `DocumentChecklist.tsx` usa para su barra) al montar/cada vez que cambia — quien decide "hay
   * un total agregado" es `PacienteDocumentos.tsx` (D1), esta instancia solo informa su parte. */
  onProgreso?: (progreso: ProgresoInstancia) => void;
  /** documentos-transferencia-actividad (tasks.md 6.1, design.md Checkpoint (c) VEREDICTO opción
   * A): reenvía hacia arriba el documento sobre el que se pidió "Transferir" — `PacienteDocumentos`
   * es quien conoce las demás actividades del paciente (destinos posibles) y dispara la
   * reasignación (D6). Sin este prop, `DocumentChecklist` no ofrece la acción (mismo criterio que
   * `onResolverPrevisualizacion`). Se ofrece en TODOS los bloques (General incluida): el bloque
   * general es origen y destino válido de una reasignación. */
  onIniciarTransferencia?: (documento: DocumentoAdjunto) => void;
  /** documentos-transferencia-actividad (tasks.md 6.7, design.md D6): sube cada vez que una
   * transferencia afecta a ESTE bloque (como origen o como destino) — fuerza el refetch de
   * `listByEntity` sin remontar el componente (D6, "trampa" de re-montar por identidad de
   * `items`). `PacienteDocumentos.tsx` es quien lo incrementa. */
  refreshToken?: number;
}

export function PacienteDocumentosChecklist({
  pacienteId,
  items,
  repository,
  agrupacionId,
  label,
  direccion,
  pacienteNombre,
  onProgreso,
  onIniciarTransferencia,
  refreshToken,
}: PacienteDocumentosChecklistProps) {
  const { documentos, loading, upload, remove, resolverPrevisualizacion, revocarPrevisualizacion } = useDocumentChecklist(
    'paciente', pacienteId, items, repository, agrupacionId, refreshToken,
  );
  // documentos-checklist-por-actividad (tasks.md 3.6, design.md D2): `readOnly={!puedeEscribir}`
  // se mantiene idéntico en las N instancias — ningún permiso por actividad, mismo criterio que
  // ya usaban gateo-pacientes/pacientes-documentos-multiples.
  const puedeEscribir = usePuedeEscribir();

  // tasks.md 5.1: misma fórmula "cargado a nivel ítem" que DocumentChecklist.tsx (líneas 233-235)
  // — no se importa de ahí (ese componente no exporta el cálculo, y su contrato quedó fijado en
  // §4), se deriva acá con los mismos `items`/`documentos` que ya tiene esta instancia.
  const cargados = items.filter((item) => documentos.some((doc) => doc.itemId === item.id)).length;
  const total = items.length;

  useEffect(() => {
    onProgreso?.({ cargados, total });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onProgreso es un callback inline del
    // caller (identidad nueva en cada render de PacienteDocumentos); solo interesa re-reportar
    // cuando el progreso de ESTA instancia cambia, no cuando cambia la identidad del callback.
  }, [cargados, total]);

  // tasks.md 5.2, design.md Checkpoint (f): solo los bloques de actividad son colapsables (el
  // volumen que se multiplica por N es "actividades", no "General", que sigue siendo un único
  // bloque fijo) — arrancan colapsados si ya están completos, para no alargar la pantalla con
  // bloques que no necesitan atención. La decisión de colapsar se toma UNA sola vez, apenas
  // termina de resolver la carga inicial (`decidioColapsoInicial`): si el usuario reabre un bloque
  // completo a mano, no se vuelve a cerrar solo por un cambio posterior de `cargados`/`total`.
  const esActividad = agrupacionId !== undefined;
  // Sin ítems propios configurados para este tipo de actividad (revisión de checkpoint (c),
  // 2026-08-11: ya no hereda los de la obra social). Mensaje explícito en vez de un checklist en
  // blanco, para que no se lea como un bug — pedido de la usuaria tras probar en vivo. Solo aplica
  // si además no hay ningún documento en este bloque: uno transferido/huérfano (sección "Otros
  // documentos" de DocumentChecklist.tsx) igual tiene que verse, aunque no haya ítems configurados.
  const sinConfigurar = esActividad && total === 0 && documentos.length === 0;
  const [abierta, setAbierta] = useState(true);
  const decidioColapsoInicial = useRef(false);
  // documentos-transferencia-actividad (tasks.md §12): estado de carga mientras se resuelve el
  // contenido real de cada documento y se arma el `.zip` — puede tardar con N documentos (N
  // fetch en serie), el botón se deshabilita y cambia de texto para que no parezca colgado.
  const [exportandoZip, setExportandoZip] = useState(false);
  // Mensaje en castellano, sin texto crudo de fetch/Storage (mismo criterio que el resto del
  // proyecto) — se limpia al reintentar, nunca queda pegado tras un éxito posterior.
  const [errorExportacion, setErrorExportacion] = useState<string | null>(null);

  async function handleExportarZip() {
    if (!direccion || !pacienteNombre || !label) return;
    setExportandoZip(true);
    setErrorExportacion(null);
    try {
      const resultado = await armarZipDocumentacionActividad({
        repository,
        entidad: 'paciente',
        entidadId: pacienteId,
        pacienteNombre,
        actividadLabel: label,
        documentos,
      });
      dispararDescargaZip(resultado.blob, resultado.nombreArchivo);
    } catch {
      setErrorExportacion('No se pudo armar el archivo de documentación. Probá de nuevo en unos segundos.');
    } finally {
      setExportandoZip(false);
    }
  }

  useEffect(() => {
    if (!esActividad || loading || decidioColapsoInicial.current) return;
    decidioColapsoInicial.current = true;
    if (total > 0 && cargados === total) {
      setAbierta(false);
    }
  }, [esActividad, loading, cargados, total]);

  // role="group" + aria-label (en vez de un <div> plano): agrupa el encabezado y el checklist
  // como una unidad accesible con nombre — útil para lectores de pantalla con N bloques en la
  // misma pantalla, y da a los tests un ancla semántica estable para escopar cada bloque
  // (`getByRole('group', { name: label })`) sin depender de estructura de DOM incidental.
  const checklist = (
    <DocumentChecklist
      items={items}
      documentos={documentos}
      onUpload={upload}
      onRemove={remove}
      readOnly={!puedeEscribir}
      onResolverPrevisualizacion={resolverPrevisualizacion}
      onRevocarPrevisualizacion={revocarPrevisualizacion}
      onTransferir={
        onIniciarTransferencia
          ? (documentoId) => {
              const documento = documentos.find((doc) => doc.id === documentoId);
              if (documento) onIniciarTransferencia(documento);
            }
          : undefined
      }
      // documentos-checklist-por-actividad (feedback directo de la usuaria, 2026-08-07): con N
      // instancias montadas (General + una por actividad), ya existe el total agregado de
      // PacienteDocumentos.tsx (tasks.md 5.1) — la barra individual de cada instancia queda
      // suprimida en las N, no solo en las actividades, para no repetir la misma información N+1
      // veces en una sola pantalla.
      mostrarProgreso={false}
      // checklist-documental-progreso-visual (skill `prototype`, variante "Progreso visual"
      // elegida 2026-08-10, solo Pacientes por ahora): círculo de check por ítem en vez de ícono +
      // Chip — puramente visual, ver DocumentChecklist.tsx.
      variant="ring"
    />
  );

  if (esActividad && label) {
    // documentos-transferencia-actividad (tasks.md §12, Checkpoint (b) VEREDICTO REVISADO
    // 2026-08-11, Checkpoint (g): exportar alcanza con permiso de lectura — el botón no se gatea
    // con `puedeEscribir`). Solo se ofrece cuando el caller pasó `direccion`+`pacienteNombre`
    // (siempre el caso real, `PacienteDocumentos.tsx`) — sin ellos no hay con qué identificar lo
    // exportado. Vive AFUERA de `SeccionPlegable` (que no admite una acción propia en su
    // encabezado) pero DENTRO del mismo `role="group"`, para que siga leyéndose como parte de
    // este bloque.
    //
    // "Exportar" arma el `.zip` con los archivos reales (§12) — la acción que la usuaria pidió
    // para armar el legajo y mandarlo a la obra social. El botón "Ver resumen" (detalle
    // imprimible, §2/§11, con el embebido de §14) que convivía acá se sacó por completo —
    // REVERTIDO (2026-08-11, decisión de la usuaria: "siento que no tiene utilidad"). "Exportar"
    // (ZIP) es la única acción de exportación que queda.
    return (
      <div role="group" aria-label={label} className="flex flex-col gap-xs">
        {direccion && pacienteNombre && (
          <div className="flex flex-col items-end gap-xs">
            <div className="flex justify-end gap-sm">
              <Button variant="secondary" size="sm" disabled={exportandoZip} onClick={handleExportarZip}>
                {exportandoZip ? 'Exportando…' : 'Exportar'}
              </Button>
            </div>
            {errorExportacion && <Alert tone="danger">{errorExportacion}</Alert>}
          </div>
        )}
        <SeccionPlegable
          titulo={label}
          resumen={total > 0 ? `${cargados} de ${total} cargados` : undefined}
          abierta={abierta}
          onToggle={() => setAbierta((prev) => !prev)}
        >
          {sinConfigurar ? (
            <p className="rounded-sm border border-border bg-surface-soft px-md py-lg font-body text-sm text-muted">
              Todavía no hay documentación configurada para este tipo de actividad. Se puede cargar
              desde "Documentación por Actividad".
            </p>
          ) : (
            checklist
          )}
        </SeccionPlegable>
      </div>
    );
  }

  return (
    <div role="group" aria-label={label}>
      {label && <FieldGroupHeading>{label}</FieldGroupHeading>}
      {checklist}
    </div>
  );
}
