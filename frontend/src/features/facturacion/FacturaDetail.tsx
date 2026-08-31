import { useState } from 'react';
import { Button, InlineIcon, Section, VolverAlListadoButton, VolverAlListadoLink } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { iconDocumento } from '../../design-system/icons';
import type { ActualizacionFactura, Factura, NuevaFactura } from '../../shared/types/factura';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import type { CobroRepository } from '../../shared/lib/facturacion/CobroRepository';
import type { EmisionRepository } from '../../shared/lib/facturacion/EmisionRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { estadoDerivadoFactura } from '../../shared/lib/facturacion/estadoDerivadoFactura';
import { useTiposDocumento } from './TiposDocumentoRepositoryContext';
import { FacturaAccionesEmision } from './FacturaAccionesEmision';
import { FacturaAvisoDiscrepancias } from './FacturaAvisoDiscrepancias';
import { FacturaCobrosSection } from './FacturaCobrosSection';
import { FacturaDocumentos } from './FacturaDocumentos';
import { TiposDocumentoGestor } from './TiposDocumentoGestor';
import { FacturaForm, type FacturaFormValues } from './FacturaForm';
import { useCobros } from './useCobros';
import { useEmisionFactura } from './useEmisionFactura';

interface FacturaDetailProps {
  /** `null` = alta de una factura nueva. */
  factura: Factura | null;
  crear: (data: NuevaFactura) => Promise<Factura>;
  actualizar: (id: string, data: ActualizacionFactura) => Promise<Factura>;
  facturasExistentes: Factura[];
  pacientes: Paciente[];
  obrasSociales: ObraSocial[];
  feriados: string[];
  presupuestoRepository: PresupuestoRepository;
  autorizacionRepository: AutorizacionRepository;
  emisionRepository: EmisionRepository;
  cobroRepository: CobroRepository;
  documentoRepository: DocumentoRepository;
  /** Recarga el listado de facturas tras una emisión (la EF ya persistió el CAE y los snapshots). */
  onEmitida: () => void | Promise<void>;
  onCreated: (factura: Factura) => void;
  onBack: () => void;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}

function nombrePaciente(paciente: Paciente | undefined): string {
  return paciente ? `${paciente.apellido}, ${paciente.nombre}` : 'Paciente desconocido';
}

// Composición de la pantalla de detalle (tasks.md 6.3, 6.4, 8.2, 8.4, 9.1, 9.4): resumen +
// formulario de edición, acción de emitir con confirmación explícita ante exceso de cupo
// (useEmisionFactura), panel de cobros con recálculo de estado tras cada mutación, corrección
// manual del estado, checklist documental y el aviso único agrupando las 5 discrepancias de
// impacto backend (design.md Decisión 14). Lógica de negocio pesada extraída a hooks/
// subcomponentes para mantenerse bajo las ~200 líneas (tasks.md 12.3).
//
// Migrado a Alert (tasks.md 16.4): el wrapper `<div className="mb-md">` alrededor de `Alert`
// reproduce el mismo patrón que `AvisoModeloDatos`/`AvisoPendienteCliente` (design.md Decisión 4
// — Alert no trae margen externo propio, lo pone el layout del caller).
export function FacturaDetail({
  factura,
  crear,
  actualizar,
  facturasExistentes,
  pacientes,
  obrasSociales,
  feriados,
  presupuestoRepository,
  autorizacionRepository,
  emisionRepository,
  cobroRepository,
  documentoRepository,
  onEmitida,
  onCreated,
  onBack,
}: FacturaDetailProps) {
  const [editing, setEditing] = useState(factura === null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Checklist documental catalog-driven (RF-410, migración 20260816120000): los ítems salen del
  // catálogo gestionable `facturacion.tipos_documento` (requerido/activa) en vez de la lista
  // estática `CHECKLIST_DOCUMENTOS_FACTURA` — el checklist se arma desde el catálogo, que la
  // gestión inline del detalle puede ampliar/ajustar. Mismo mapeo que el seed estático: nombre =
  // `tipo`, obligatoriedad = `requerido`.
  const { tiposDocumento } = useTiposDocumento();
  // facturacion-electronica-arca (§6.4): con la emisión electrónica, el PDF del comprobante lo
  // genera y archiva la Edge Function `facturar`. Una vez que la factura tiene `cae`, el ítem
  // manual "Comprobante ARCA" deja de ser obligatorio (el PDF generado es el respaldo).
  const comprobanteYaEmitido = Boolean(factura?.cae);
  const itemsChecklistDocumentos = tiposDocumento.map((tipo) => ({
    id: tipo.id,
    nombre: tipo.tipo,
    requerido: comprobanteYaEmitido && /comprobante\s+arca/i.test(tipo.tipo) ? false : tipo.requerido,
  }));

  // RN-FA-06: una factura ya emitida (todo lo que no sea 'a-facturar') es un documento fiscal y no
  // se modifica — la descripción y los importes quedaron congelados al emitir. Corregir el estado
  // o registrar cobros tienen sus propios controles más abajo; lo que se bloquea es el formulario
  // de edición de los datos de la factura.
  const puedeEditar = factura !== null && factura.estado === 'a-facturar';

  const { cobros, loading: cobrosLoading, error: cobrosError, registrar, eliminar } = useCobros(cobroRepository, factura?.id ?? '');

  const paciente = factura ? pacientes.find((p) => p.id === factura.pacienteId) : undefined;
  const obraSocial: ObraSocial | undefined = paciente ? obrasSociales.find((o) => o.id === paciente.obraSocialId) : undefined;

  const { resolverCupoAutorizado, cupoParaConfirmar, handleEmitirClick, handleConfirmarEmision } = useEmisionFactura({
    factura,
    facturasExistentes,
    autorizacionRepository,
    emisionRepository,
    onEmitida,
    onError: setSubmitError,
  });

  async function verComprobante() {
    if (!factura?.comprobantePdfUrl) return;
    setSubmitError(null);
    try {
      const url = await emisionRepository.verComprobante(factura.comprobantePdfUrl);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setSubmitError(toErrorMessage(err));
    }
  }

  async function conIndicadorDeCarga(accion: () => Promise<void>) {
    setSubmitting(true);
    setSubmitError(null);
    await accion();
    setSubmitting(false);
  }

  // Recalcula y persiste el estado derivado de los cobros tras cada alta/baja (tasks.md 9.4) —
  // solo en respuesta a la mutación (no en cada render/carga), para no pisar una corrección
  // manual que todavía no vio un nuevo cobro.
  async function sincronizarEstadoTrasCobro() {
    if (!factura || factura.estado === 'a-facturar') return;
    const cobrosFrescos = await cobroRepository.listByFactura(factura.id);
    const derivado = estadoDerivadoFactura(factura, cobrosFrescos);
    if (derivado !== factura.estado) {
      await actualizar(factura.id, { estado: derivado });
    }
  }

  async function handleRegistrarCobro(data: Parameters<typeof registrar>[0]) {
    const resultado = await registrar(data);
    await sincronizarEstadoTrasCobro();
    return resultado;
  }

  async function handleEliminarCobro(id: string) {
    await eliminar(id);
    await sincronizarEstadoTrasCobro();
  }

  async function handleSubmitForm(values: FacturaFormValues) {
    // RN-FA-06: nunca persistir cambios sobre una factura ya emitida, aunque el formulario se
    // hubiera abierto por otra vía. El alta (`factura === null`) siempre pasa.
    if (factura !== null && !puedeEditar) {
      setEditing(false);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (factura === null) {
        const creada = await crear({ ...values, estado: 'a-facturar' });
        onCreated(creada);
      } else {
        await actualizar(factura.id, values);
        setEditing(false);
      }
    } catch (err) {
      setSubmitError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-xl py-xxl px-xl">
      <VolverAlListadoLink onClick={onBack} />

      <FacturaAvisoDiscrepancias />

      {factura && !editing ? (
        <section className="mb-xxxl flex flex-col gap-lg">
          <div className="flex flex-col gap-xs">
            <div className="flex items-center gap-xs">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-success-soft text-success">
                <InlineIcon size={16}>{iconDocumento}</InlineIcon>
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">Factura</span>
              <span className="text-faint">›</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">Detalle</span>
            </div>
            <h1 className="m-0 font-heading text-[28px] font-bold text-ink">{nombrePaciente(paciente)}</h1>
          </div>

          {submitError && <Alert tone="danger">{submitError}</Alert>}

          <FacturaAccionesEmision
            factura={factura}
            paciente={paciente}
            submitting={submitting}
            onEmitir={() => void conIndicadorDeCarga(handleEmitirClick)}
            cupoParaConfirmar={cupoParaConfirmar}
            onConfirmarEmision={() => void conIndicadorDeCarga(handleConfirmarEmision)}
            onVerComprobante={factura.comprobantePdfUrl ? () => void verComprobante() : undefined}
          />

          {puedeEditar ? (
            <div className="flex justify-end">
              <Button variant="secondary" requiereEscritura onClick={() => setEditing(true)}>Editar</Button>
            </div>
          ) : (
            <p className="m-0 text-right font-body text-[12px] text-muted">
              Esta factura ya fue emitida: es un documento fiscal y no se puede modificar.
            </p>
          )}
        </section>
      ) : (
        <Section label="Factura" title={factura ? nombrePaciente(paciente) : 'Nueva factura'}>
          {submitError && (
            <div className="mb-md">
              <Alert tone="danger">{submitError}</Alert>
            </div>
          )}

          <FacturaForm
            initial={factura ?? undefined}
            pacientes={pacientes}
            obrasSociales={obrasSociales}
            facturasExistentes={facturasExistentes}
            facturaIdEnEdicion={factura?.id ?? null}
            feriados={feriados}
            presupuestoRepository={presupuestoRepository}
            autorizacionRepository={autorizacionRepository}
            resolverCupoAutorizado={resolverCupoAutorizado}
            esBorrador={factura === null || factura.estado === 'a-facturar'}
            onSubmit={handleSubmitForm}
            onCancel={factura ? () => setEditing(false) : onBack}
            submitting={submitting}
            submitError={null}
          />
        </Section>
      )}

      {factura && (
        <>
          <Section label="Cobros" title="Cobros y pagos parciales">
            <FacturaCobrosSection
              factura={factura}
              cobros={cobros}
              loading={cobrosLoading}
              error={cobrosError}
              registrar={handleRegistrarCobro}
              eliminar={handleEliminarCobro}
              onCorregirEstado={(estado) => void actualizar(factura.id, { estado })}
              obraSocial={obraSocial}
            />
          </Section>

          <Section label="Documentos" title="Documentación adjunta">
            <FacturaDocumentos facturaId={factura.id} items={itemsChecklistDocumentos} repository={documentoRepository} />
            <div className="mt-md border-t border-border pt-md">
              <TiposDocumentoGestor idBase="detalle-factura" />
            </div>
          </Section>
        </>
      )}

      <VolverAlListadoButton onClick={onBack} />
    </div>
  );
}
