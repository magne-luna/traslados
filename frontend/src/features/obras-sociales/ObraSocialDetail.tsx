import { useState } from 'react';
import { AvisoModeloDatos, Button, Section, VolverAlListadoButton, VolverAlListadoLink } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
import { PrestadoresDeObraSocial } from '../prestadores/PrestadoresDeObraSocial';
import type { ActualizacionObraSocial, NuevaObraSocial, ObraSocial } from '../../shared/types/obraSocial';
import { ChecklistEditor } from './ChecklistEditor';
import { DEFAULT_IDENTIFICADOR_ORIGEN } from './origenCampoOptions';
import { ObraSocialForm, type ObraSocialFormValues } from './ObraSocialForm';
import { PlantillaFacturaEditor } from './PlantillaFacturaEditor';

interface ObraSocialDetailProps {
  /** null = alta de una obra social nueva; el resto de las secciones solo aplica en edición. */
  obraSocial: ObraSocial | null;
  crear: (data: NuevaObraSocial) => Promise<ObraSocial>;
  actualizar: (id: string, data: ActualizacionObraSocial) => Promise<ObraSocial>;
  onCreated: (obraSocial: ObraSocial) => void;
  onBack: () => void;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}

// Composición de la pantalla de detalle (tasks.md 4.4, 5.3, 6.3): wire de ObraSocialForm +
// ChecklistEditor + PlantillaFacturaEditor contra el hook useObrasSociales (crear/actualizar),
// con manejo de error visible y sin loading infinito. El checklist y la plantilla solo se
// pueden editar una vez que la obra social existe (tiene id) — una obra social nueva primero
// se da de alta con los datos generales.
export function ObraSocialDetail({ obraSocial, crear, actualizar, onCreated, onBack }: ObraSocialDetailProps) {
  // Sin resumen posible en alta (obraSocial null): el form arranca visible directamente. En
  // edición arranca colapsado detrás de "Editar datos" para no mezclar edición con el resto del
  // detalle (checklist/plantilla) — mismo patrón que VehiculoDetail (FE-2 vehiculos-ui).
  const [editing, setEditing] = useState(obraSocial === null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  async function handleSubmitGeneral(values: ObraSocialFormValues) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (obraSocial === null) {
        const creada = await crear({
          ...values,
          checklist: [],
          plantillaFactura: { campos: [], identificadorOrigen: DEFAULT_IDENTIFICADOR_ORIGEN },
        });
        onCreated(creada);
      } else {
        await actualizar(obraSocial.id, values);
        setEditing(false);
      }
    } catch (err) {
      setSubmitError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChecklistChange(checklist: ObraSocial['checklist']) {
    if (obraSocial === null) return;
    setSectionError(null);
    try {
      await actualizar(obraSocial.id, { checklist });
    } catch (err) {
      setSectionError(toErrorMessage(err));
    }
  }

  async function handlePlantillaChange(plantillaFactura: ObraSocial['plantillaFactura']) {
    if (obraSocial === null) return;
    setSectionError(null);
    try {
      await actualizar(obraSocial.id, { plantillaFactura });
    } catch (err) {
      setSectionError(toErrorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-xl py-xxl px-xl">
      <VolverAlListadoLink onClick={onBack} />

      <Section label="Obra social" title={obraSocial?.nombre ?? 'Nueva obra social'}>
        {obraSocial && !editing ? (
          <Card radius="sm" gap="md">
            <div className="flex flex-wrap items-center gap-md">
              <span className="font-body text-[14px] font-semibold text-ink">{obraSocial.nombre}</span>
              <span className="font-mono text-[12px] text-muted">CUIT: {obraSocial.cuit}</span>
            </div>

            {/* `tipoComprobante`/`plazoCobroDias` se mudaron a `Prestador` (design.md D3 de
                prestadores-crud, sin confirmar con Andrea) — dejan de mostrarse acá. */}
            <div className="grid grid-cols-2 gap-md border-y border-border py-md md:grid-cols-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-[11px] text-muted">Modalidad de facturación</span>
                <span className="font-body text-[13px] font-semibold text-ink">
                  {obraSocial.modalidadFacturacion === 'general' ? 'Factura general' : 'Por prestación'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-[11px] text-muted">Pagos parciales</span>
                <span className="font-body text-[13px] font-semibold text-ink">
                  {obraSocial.admitePagosParciales ? 'Sí' : 'No'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-[11px] text-muted">Docs requeridos</span>
                <span className="font-body text-[13px] font-semibold text-ink">
                  {obraSocial.checklist.length === 0 ? 'Ninguno' : `${obraSocial.checklist.length} documentos`}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-[11px] text-muted">Identificador en factura</span>
                <span className="font-body text-[13px] font-semibold text-ink">
                  {obraSocial.plantillaFactura.identificadorOrigen === 'paciente.dni' ? 'DNI' : 'Nro. de afiliado'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-[11px] text-muted">Campos en la plantilla</span>
                <span className="font-body text-[13px] font-semibold text-ink">
                  {obraSocial.plantillaFactura.campos.length === 0
                    ? 'Ninguno'
                    : `${obraSocial.plantillaFactura.campos.length} campos`}
                </span>
              </div>
              {/* Los 4 campos del docx (D9, discrepancia #11): opcionales — se omiten del resumen
                  si no están completos, en vez de mostrar un "—" por cada uno (obras sociales
                  viejas del mock v1 nacieron sin ellos). */}
              {obraSocial.codigo && (
                <div className="flex flex-col gap-0.5">
                  <span className="font-body text-[11px] text-muted">Código</span>
                  <span className="font-body text-[13px] font-semibold text-ink">{obraSocial.codigo}</span>
                </div>
              )}
              {obraSocial.direccion && (
                <div className="flex flex-col gap-0.5">
                  <span className="font-body text-[11px] text-muted">Dirección</span>
                  <span className="font-body text-[13px] font-semibold text-ink">{obraSocial.direccion}</span>
                </div>
              )}
              {obraSocial.telefono && (
                <div className="flex flex-col gap-0.5">
                  <span className="font-body text-[11px] text-muted">Teléfono</span>
                  <span className="font-body text-[13px] font-semibold text-ink">{obraSocial.telefono}</span>
                </div>
              )}
              {obraSocial.condicionIva && (
                <div className="flex flex-col gap-0.5">
                  <span className="font-body text-[11px] text-muted">Condición frente al IVA</span>
                  <span className="font-body text-[13px] font-semibold text-ink">{obraSocial.condicionIva}</span>
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
          <ObraSocialForm
            initial={obraSocial ?? undefined}
            onSubmit={handleSubmitGeneral}
            onCancel={obraSocial ? () => setEditing(false) : onBack}
            submitting={submitting}
            submitError={submitError}
          />
        )}
      </Section>

      {/* tasks.md 6.3: cartel preexistente (obras-sociales-ui, 2026-07-24) actualizado —
          plazo de cobro, modalidad de facturación, pagos parciales (RN-FA-07/08) y los 4 campos
          del docx (código, dirección, teléfono, condición IVA) YA SON columnas reales de la base
          (integracion-obra-social D4/D9). Lo único que sigue sin cerrar es qué valores admite
          Condición frente al IVA (discrepancia #14): ninguna fuente los enumera. */}
      <AvisoModeloDatos>
        Plazo de cobro, modalidad de facturación, pagos parciales y los 4 campos del docx (código,
        dirección, teléfono, condición frente al IVA) ya son columnas reales de la base — dejaron
        de ser una discrepancia. Lo que sigue abierto: ninguna fuente (docx ni KB) no enumera los
        valores válidos de "Condición frente al IVA", así que queda como texto libre sin validar.
      </AvisoModeloDatos>

      {/* tasks.md 6.2 (D8, discrepancia #12): ambigüedad de qué CUIT representa este campo,
          descubierta al verificar que la base tiene dos columnas distintas. No se resuelve acá. */}
      <AvisoModeloDatos>
        Este CUIT es <strong>obra_social.cuit</strong>, distinto de <strong>prestadores.cuit</strong>{' '}
        (otra tabla, ya existe en la base). No está confirmado si este campo debería mostrar el CUIT
        de la obra social o el del prestador — el docx solo dice "CUIT del prestador/entidad
        pagadora", que podría ser cualquiera de las dos tablas. Pendiente de confirmar con quien
        mantiene el docx.
      </AvisoModeloDatos>

      {obraSocial && (
        <>
          {sectionError && <Alert tone="danger">{sectionError}</Alert>}

          <Section label="Documentación" title="Checklist documental">
            <ChecklistEditor items={obraSocial.checklist} onChange={handleChecklistChange} />
          </Section>

          <Section label="Facturación" title="Plantilla de descripción de factura">
            <PlantillaFacturaEditor plantilla={obraSocial.plantillaFactura} onChange={handlePlantillaChange} />
          </Section>

          {/* Panel de solo lectura del vínculo N:N (design.md D2 de prestadores-crud, tasks.md
              5.2/5.3): el multi-select de edición vive del lado de Prestador
              (PrestadorForm.tsx) — acá solo se muestra quién ya está vinculado. */}
          <Section label="Prestadores" title="Prestadores vinculados">
            <PrestadoresDeObraSocial obraSocialId={obraSocial.id} />
          </Section>
        </>
      )}

      <VolverAlListadoButton onClick={onBack} />
    </div>
  );
}
