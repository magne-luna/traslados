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
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { estadoDerivadoFactura } from '../../shared/lib/facturacion/estadoDerivadoFactura';
import { FacturaAccionesEmision } from './FacturaAccionesEmision';
import { FacturaAvisoDiscrepancias } from './FacturaAvisoDiscrepancias';
import { FacturaCobrosSection } from './FacturaCobrosSection';
import { FacturaDocumentos } from './FacturaDocumentos';
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
  cobroRepository: CobroRepository;
  documentoRepository: DocumentoRepository;
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
  cobroRepository,
  documentoRepository,
  onCreated,
  onBack,
}: FacturaDetailProps) {
  const [editing, setEditing] = useState(factura === null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { cobros, loading: cobrosLoading, error: cobrosError, registrar, eliminar } = useCobros(cobroRepository, factura?.id ?? '');

  const paciente = factura ? pacientes.find((p) => p.id === factura.pacienteId) : undefined;
  const obraSocial: ObraSocial | undefined = paciente ? obrasSociales.find((o) => o.id === paciente.obraSocialId) : undefined;

  const { resolverCupoAutorizado, cupoParaConfirmar, handleEmitirClick, handleConfirmarEmision } = useEmisionFactura({
    factura,
    paciente,
    obraSocial,
    facturasExistentes,
    presupuestoRepository,
    autorizacionRepository,
    actualizar,
    onError: setSubmitError,
  });

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
          />

          <div className="flex justify-end">
            <Button variant="secondary" requiereEscritura onClick={() => setEditing(true)}>Editar</Button>
          </div>
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
            />
          </Section>

          <Section label="Documentos" title="Documentación adjunta">
            <FacturaDocumentos facturaId={factura.id} items={obraSocial?.checklist ?? []} repository={documentoRepository} />
          </Section>
        </>
      )}

      <VolverAlListadoButton onClick={onBack} />
    </div>
  );
}
