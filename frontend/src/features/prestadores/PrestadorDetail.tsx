import { useState } from 'react';
import { AvisoModeloDatos, Button, Section, VolverAlListadoButton, VolverAlListadoLink } from '../../design-system/components';
import { Card } from '../../design-system/layout';
import type { ActualizacionPrestador, NuevoPrestador, Prestador } from '../../shared/types/prestador';
import { PrestadorForm, type PrestadorFormValues } from './PrestadorForm';

interface PrestadorDetailProps {
  /** null = alta de un Prestador nuevo. */
  prestador: Prestador | null;
  crear: (data: NuevoPrestador) => Promise<Prestador>;
  actualizar: (id: string, data: ActualizacionPrestador) => Promise<Prestador>;
  onCreated: (prestador: Prestador) => void;
  onBack: () => void;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}

// Composición de la pantalla de detalle (tasks.md 4.6, espejo de ObraSocialDetail.tsx): wire de
// PrestadorForm contra el hook usePrestadores (crear/actualizar), con manejo de error visible y
// edición diferida (nunca modal) — en edición arranca colapsado detrás de "Editar datos", en alta
// arranca visible directamente.
export function PrestadorDetail({ prestador, crear, actualizar, onCreated, onBack }: PrestadorDetailProps) {
  const [editing, setEditing] = useState(prestador === null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(values: PrestadorFormValues) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (prestador === null) {
        const creado = await crear(values);
        onCreated(creado);
      } else {
        await actualizar(prestador.id, values);
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

      <Section label="Prestador" title={prestador?.razonSocial ?? 'Nuevo prestador'}>
        {prestador && !editing ? (
          <Card radius="sm" gap="md">
            <div className="flex flex-wrap items-center gap-md">
              <span className="font-body text-[14px] font-semibold text-ink">{prestador.razonSocial}</span>
              <span className="font-mono text-[12px] text-muted">CUIT: {prestador.cuit}</span>
            </div>

            <div className="grid grid-cols-2 gap-md border-y border-border py-md md:grid-cols-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-[11px] text-muted">Plazo de cobro</span>
                <span className="font-body text-[13px] font-semibold text-ink">{prestador.plazoCobroDias} días</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-[11px] text-muted">Tipo de comprobante</span>
                <span className="font-body text-[13px] font-semibold text-ink">{prestador.tipoComprobante}</span>
              </div>
              {prestador.direccion && (
                <div className="flex flex-col gap-0.5">
                  <span className="font-body text-[11px] text-muted">Dirección</span>
                  <span className="font-body text-[13px] font-semibold text-ink">{prestador.direccion}</span>
                </div>
              )}
              {prestador.telefono && (
                <div className="flex flex-col gap-0.5">
                  <span className="font-body text-[11px] text-muted">Teléfono</span>
                  <span className="font-body text-[13px] font-semibold text-ink">{prestador.telefono}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="secondary" requiereEscritura onClick={() => setEditing(true)}>
                Editar datos
              </Button>
            </div>
          </Card>
        ) : (
          <PrestadorForm
            initial={prestador ?? undefined}
            onSubmit={handleSubmit}
            onCancel={prestador ? () => setEditing(false) : onBack}
            submitting={submitting}
            submitError={submitError}
          />
        )}
      </Section>

      {/* spec prestador-crud §Señalización de la ambigüedad del CUIT (supuesto #2, discrepancia
          #12, sin resolver): mismo texto/criterio que el segundo AvisoModeloDatos de
          ObraSocialDetail.tsx, en espejo desde el lado de Prestador. */}
      <AvisoModeloDatos>
        Este CUIT es <strong>prestadores.cuit</strong>, distinto de <strong>obra_social.cuit</strong> (otra
        tabla). No está confirmado si el CUIT de "la empresa prestadora" del docx debería vivir acá o en
        Obra Social — el docx solo dice "CUIT del prestador/entidad pagadora", que podría ser cualquiera
        de las dos tablas. Pendiente de confirmar con quien mantiene el docx.
      </AvisoModeloDatos>

      <VolverAlListadoButton onClick={onBack} />
    </div>
  );
}
