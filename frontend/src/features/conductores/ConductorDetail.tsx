import { useState } from 'react';
import { AvisoModeloDatos, Button, Chip, InlineIcon, Section, VolverAlListadoButton, VolverAlListadoLink } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
import { iconCasa } from '../../design-system/icons';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { generateId } from '../../shared/lib/id';
import type { ActualizacionConductor, AsignacionSemanal, Conductor, NuevoConductor } from '../../shared/types/conductor';
import { AsignacionSemanalTabla } from './AsignacionSemanalTabla';
import { ConductorDocumentos } from './ConductorDocumentos';
import { ConductorForm, type ConductorFormValues } from './ConductorForm';
import { RESTRICCION_CONDUCTOR_LABELS } from './restriccionConductorOptions';

// Fecha de nacimiento se guarda como 'YYYY-MM-DD' (sin componente de hora): formatear con
// `new Date(iso).toLocaleDateString()` corre el string por UTC medianoche y luego lo muestra en
// el huso horario local, lo que puede mostrar el día anterior (bug ya presente en
// PacienteResumen/CudFields — no replicarlo acá). Se arma el string a mano, sin pasar por Date.
function formatearFechaNacimiento(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return `${Number(dia)}/${Number(mes)}/${anio}`;
}

interface ConductorDetailProps {
  /** null = alta de un conductor nuevo; el resto de las secciones solo aplica en edición. */
  conductor: Conductor | null;
  crear: (data: NuevoConductor) => Promise<Conductor>;
  actualizar: (id: string, data: ActualizacionConductor) => Promise<Conductor>;
  documentoRepository: DocumentoRepository;
  onCreated: (conductor: Conductor) => void;
  onBack: () => void;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}

// Composición de la pantalla de detalle (tasks.md 5.6, 6.3, 7.2, 8.1): wire de ConductorForm +
// AsignacionSemanalTabla + ConductorDocumentos contra el hook useConductores (crear/actualizar),
// con manejo de error visible y sin loading infinito. Asignación semanal y documentos solo
// aplican una vez que el conductor existe (tiene id) — mismo criterio que VehiculoDetail.
export function ConductorDetail({ conductor, crear, actualizar, documentoRepository, onCreated, onBack }: ConductorDetailProps) {
  // Sin resumen posible en alta (conductor null): el form arranca visible directamente. En
  // edición arranca colapsado detrás de "Editar datos" para no mezclar edición con el resto del
  // detalle (asignación semanal/documentos) — mismo criterio de UX que VehiculoDetail.
  const [editing, setEditing] = useState(conductor === null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  async function handleSubmitGeneral(values: ConductorFormValues) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: NuevoConductor = {
        apellido: values.apellido,
        nombre: values.nombre,
        documento: values.documento,
        telefono: values.telefono || undefined,
        fechaNacimiento: values.fechaNacimiento || undefined,
        domicilio: values.domicilio,
        cuil: values.cuil,
        estado: values.estado,
        restricciones: values.restricciones,
        observaciones: values.observaciones || undefined,
        asignaciones: conductor?.asignaciones ?? [],
      };

      if (conductor === null) {
        const creado = await crear(payload);
        onCreated(creado);
      } else {
        await actualizar(conductor.id, payload);
        setEditing(false);
      }
    } catch (err) {
      setSubmitError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAgregarAsignacion(data: { vehiculoId: string; semana: string }) {
    if (conductor === null) return;
    setSectionError(null);
    const nuevaAsignacion: AsignacionSemanal = { id: generateId('asignacion'), ...data };
    try {
      await actualizar(conductor.id, { asignaciones: [...conductor.asignaciones, nuevaAsignacion] });
    } catch (err) {
      setSectionError(toErrorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-xl py-xxl px-xl">
      <VolverAlListadoLink onClick={onBack} />

      <Section label="Conductor" title={conductor?.apellido ?? 'Nuevo conductor'}>
        {conductor && !editing ? (
          <Card radius="sm" gap="md">
            <div className="flex flex-wrap items-center gap-md">
              <span className="font-body text-[14px] font-semibold text-ink">{conductor.apellido}</span>
              <span className="font-body text-[13px] text-muted">{conductor.nombre}</span>
              {conductor.estado === 'fuera-de-servicio' ? (
                <Chip kind="danger">⛔ Fuera de servicio</Chip>
              ) : (
                <Chip kind="success">✅ Operando</Chip>
              )}
            </div>

            <div className="grid grid-cols-2 gap-md border-y border-border py-md md:grid-cols-4">
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-[11px] text-muted">Documento</span>
                <span className="font-body text-[13px] font-semibold text-ink">{conductor.documento}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-[11px] text-muted">CUIL</span>
                <span className="font-body text-[13px] font-semibold text-ink">{conductor.cuil || 'Sin datos'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-[11px] text-muted">Teléfono</span>
                <span className="font-body text-[13px] font-semibold text-ink">{conductor.telefono || 'Sin datos'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-[11px] text-muted">Fecha de nacimiento</span>
                <span className="font-body text-[13px] font-semibold text-ink">
                  {conductor.fechaNacimiento ? formatearFechaNacimiento(conductor.fechaNacimiento) : 'Sin datos'}
                </span>
              </div>
            </div>

            {conductor.domicilio && (
              <span className="flex items-center gap-xs font-body text-[13px] text-muted">
                <InlineIcon>{iconCasa}</InlineIcon>
                {conductor.domicilio}
              </span>
            )}

            <div className="flex flex-wrap items-center gap-sm">
              {conductor.restricciones.length === 0 ? (
                <span className="font-body text-[12px] text-muted">Sin restricciones de perfil</span>
              ) : (
                conductor.restricciones.map((restriccion) => (
                  <Chip key={restriccion} kind="warning">
                    {RESTRICCION_CONDUCTOR_LABELS[restriccion]}
                  </Chip>
                ))
              )}
            </div>

            {conductor.observaciones && <p className="m-0 font-body text-[13px] text-muted">{conductor.observaciones}</p>}

            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Editar datos
              </Button>
            </div>
          </Card>
        ) : (
          <ConductorForm
            initial={
              conductor
                ? {
                    apellido: conductor.apellido,
                    nombre: conductor.nombre,
                    documento: conductor.documento,
                    telefono: conductor.telefono ?? '',
                    fechaNacimiento: conductor.fechaNacimiento ?? '',
                    domicilio: conductor.domicilio,
                    cuil: conductor.cuil,
                    estado: conductor.estado,
                    restricciones: conductor.restricciones,
                    observaciones: conductor.observaciones ?? '',
                  }
                : undefined
            }
            onSubmit={handleSubmitGeneral}
            onCancel={conductor ? () => setEditing(false) : onBack}
            submitting={submitting}
            submitError={submitError}
          />
        )}
      </Section>

      <AvisoModeloDatos>
        "Restricciones" es acá un catálogo cerrado; en Traslados-Modelo-Datos.docx es texto libre
        dentro de un único campo "Notas" junto con las observaciones — a coordinar con Enzo
        (backend) antes de cerrar C-09: si se mantiene estructurado o se funde en un campo de
        texto. (Domicilio, CUIL y Estado ya se sumaron al frontend — resuelto.)
      </AvisoModeloDatos>

      {conductor && (
        <>
          {sectionError && <Alert tone="danger">{sectionError}</Alert>}

          <Section label="Flota" title="Asignación semanal">
            <AvisoModeloDatos>
              Acá la semana se guarda como una etiqueta ISO (ej. "2026-W30"). En el docx la
              "Asignación de Conductores a Vehículos" tiene Fecha de inicio y Fecha de fin de semana
              como dos campos de fecha, no una etiqueta de semana.
            </AvisoModeloDatos>
            <AsignacionSemanalTabla asignaciones={conductor.asignaciones} onAgregar={handleAgregarAsignacion} />
          </Section>

          <Section label="Documentación" title="Checklist documental">
            <ConductorDocumentos conductorId={conductor.id} repository={documentoRepository} />
          </Section>
        </>
      )}

      <VolverAlListadoButton onClick={onBack} />
    </div>
  );
}
