import { useState } from 'react';
import { AvisoModeloDatos, Button, Chip, Section, VolverAlListadoButton, VolverAlListadoLink } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
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
              <Chip kind="info">Comprobante {obraSocial.tipoComprobante}</Chip>
            </div>

            <div className="grid grid-cols-2 gap-md border-y border-border py-md md:grid-cols-4">
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-[11px] text-muted">Plazo de cobro</span>
                <span className="font-body text-[13px] font-semibold text-ink">{obraSocial.plazoCobroDias} días</span>
              </div>
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

      <AvisoModeloDatos>
        Plazo de cobro, modalidad de facturación y pagos parciales están acá por reglas de negocio
        (RN-FA-07/08) pero no figuran en Traslados-Modelo-Datos.docx — hay que sumarlos a la BD real
        antes de conectar C-04. Además faltan campos que sí están en el docx: Código, Dirección,
        Teléfono y Condición frente al IVA.
      </AvisoModeloDatos>

      {obraSocial && (
        <>
          {sectionError && <Alert tone="danger">{sectionError}</Alert>}

          <Section label="Documentación" title="Checklist documental">
            <AvisoModeloDatos>
              Acá el checklist es una lista embebida en la obra social. En el docx es una tabla de
              vínculo ("Requisitos de la Obra Social") contra un catálogo compartido de Tipos de
              Documento — la forma va a cambiar cuando se conecte el backend real.
            </AvisoModeloDatos>
            <ChecklistEditor items={obraSocial.checklist} onChange={handleChecklistChange} />
          </Section>

          <Section label="Facturación" title="Plantilla de descripción de factura">
            <PlantillaFacturaEditor plantilla={obraSocial.plantillaFactura} onChange={handlePlantillaChange} />
          </Section>
        </>
      )}

      <VolverAlListadoButton onClick={onBack} />
    </div>
  );
}
