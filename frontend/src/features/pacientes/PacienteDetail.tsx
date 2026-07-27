import { useState } from 'react';
import { AvisoModeloDatos, Chip, Section, VolverAlListadoButton, VolverAlListadoLink } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { ActualizacionPaciente, Cud, Direccion, NuevoPaciente, Paciente, PersonaACargo } from '../../shared/types/paciente';
import { CUD_CHIP_KIND, CUD_CHIP_LABEL } from '../../shared/lib/pacientes/cudCopy';
import { estadoCud } from '../../shared/lib/pacientes/estadoCud';
import { CudFields } from './CudFields';
import { DireccionesEditor } from './DireccionesEditor';
import { PacienteDocumentos } from './PacienteDocumentos';
import { PacienteForm, type PacienteFormValues } from './PacienteForm';
import { nombreCompleto, PacienteResumen } from './PacienteResumen';
import { PersonasACargoEditor } from './PersonasACargoEditor';

interface PacienteDetailProps {
  /** null = alta de un paciente nuevo; el resto de las secciones solo aplica en edición. */
  paciente: Paciente | null;
  crear: (data: NuevoPaciente) => Promise<Paciente>;
  actualizar: (id: string, data: ActualizacionPaciente) => Promise<Paciente>;
  obrasSociales: ObraSocial[];
  obraSocialRepository: ObraSocialRepository;
  documentoRepository: DocumentoRepository;
  onCreated: (paciente: Paciente) => void;
  onBack: () => void;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}

// Composición de la pantalla de detalle (tasks.md 6.1/6.4, 7.1, 8.1/8.2, 9.1/9.2): wire de
// PacienteForm contra el hook usePacientes (crear/actualizar), con manejo de error visible y
// sin loading infinito. CUD, personas a cargo, direcciones y documentación viven en secciones
// propias que persisten directo contra actualizar() sin pasar por el submit general del
// formulario — mismo criterio que ChecklistEditor/PlantillaFacturaEditor (FE-2 ObraSocialDetail),
// y refuerza el aislamiento de datos sensibles (CUD, menores) exigido por design.md.
export function PacienteDetail({
  paciente,
  crear,
  actualizar,
  obrasSociales,
  obraSocialRepository,
  documentoRepository,
  onCreated,
  onBack,
}: PacienteDetailProps) {
  // Sin resumen posible en alta (paciente null): el form arranca visible directamente.
  const [editing, setEditing] = useState(paciente === null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  async function handleSubmitGeneral(values: PacienteFormValues) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (paciente === null) {
        const creado = await crear({
          ...values,
          cud: null,
          direcciones: [],
          personasACargo: [],
        });
        onCreated(creado);
      } else {
        await actualizar(paciente.id, values);
        setEditing(false);
      }
    } catch (err) {
      setSubmitError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCudChange(cud: Cud | null) {
    if (paciente === null) return;
    setSectionError(null);
    try {
      await actualizar(paciente.id, { cud });
    } catch (err) {
      setSectionError(toErrorMessage(err));
    }
  }

  async function handlePersonasACargoChange(personasACargo: PersonaACargo[]) {
    if (paciente === null) return;
    setSectionError(null);
    try {
      await actualizar(paciente.id, { personasACargo });
    } catch (err) {
      setSectionError(toErrorMessage(err));
    }
  }

  async function handleDireccionesChange(direcciones: Direccion[]) {
    if (paciente === null) return;
    setSectionError(null);
    try {
      await actualizar(paciente.id, { direcciones });
    } catch (err) {
      setSectionError(toErrorMessage(err));
    }
  }

  const estado = paciente?.cud ? estadoCud(paciente.cud, new Date()) : null;

  return (
    <div className="flex flex-col gap-xl py-xxl px-xl">
      <VolverAlListadoLink onClick={onBack} />

      <Section label="Paciente" title={paciente ? nombreCompleto(paciente) : 'Nuevo paciente'}>
        {paciente && !editing ? (
          <PacienteResumen paciente={paciente} obrasSociales={obrasSociales} onEdit={() => setEditing(true)} />
        ) : (
          <PacienteForm
            initial={
              paciente
                ? {
                    apellido: paciente.apellido,
                    segundoApellido: paciente.segundoApellido,
                    nombre: paciente.nombre,
                    segundoNombre: paciente.segundoNombre,
                    fechaNacimiento: paciente.fechaNacimiento,
                    dni: paciente.dni,
                    cuilTitular: paciente.cuilTitular,
                    diagnostico: paciente.diagnostico,
                    condicion: paciente.condicion,
                    accesorioMovilidad: paciente.accesorioMovilidad,
                    obraSocialId: paciente.obraSocialId,
                    numeroAfiliado: paciente.numeroAfiliado,
                    amparoJudicial: paciente.amparoJudicial,
                    amparoJudicialAclaracion: paciente.amparoJudicialAclaracion,
                  }
                : undefined
            }
            obrasSociales={obrasSociales}
            onSubmit={handleSubmitGeneral}
            onCancel={paciente ? () => setEditing(false) : onBack}
            submitting={submitting}
            submitError={submitError}
          />
        )}
      </Section>

      <AvisoModeloDatos>
        El número de afiliado acá es un valor único y actual; en el docx vive en "Cobertura del
        Paciente", una entidad histórica (N coberturas por paciente, con fecha desde/hasta) — acá no
        hay historial de coberturas ni de obras sociales anteriores.
      </AvisoModeloDatos>

      {paciente && (
        <>
          {sectionError && <Alert tone="danger">{sectionError}</Alert>}

          <Section
            label="Datos sensibles"
            title="Certificado Único de Discapacidad (CUD)"
            action={estado && <Chip kind={CUD_CHIP_KIND[estado]}>{CUD_CHIP_LABEL[estado]}</Chip>}
          >
            <AvisoModeloDatos>
              El docx guarda un campo booleano propio del CUD para esta condición; acá se calcula al
              vuelo (`estadoCud`) a partir de la fecha de vencimiento, no se persiste.
            </AvisoModeloDatos>
            <div className="mt-md">
              <CudFields value={paciente.cud} onChange={handleCudChange} />
            </div>
          </Section>

          <Section label="Datos sensibles" title="Personas a cargo">
            <PersonasACargoEditor personasACargo={paciente.personasACargo} onChange={handlePersonasACargoChange} />
          </Section>

          <Section label="Traslados" title="Direcciones">
            <AvisoModeloDatos>
              El docx separa "Direcciones" (catálogo: calle + tipo de lugar) de "Recorridos" (entidad
              aparte: dirección inicial/final + día de la semana + hora). Acá están fusionados en un
              solo objeto `Direccion` con `dias`/`horario` opcionales que no existen en el docx.
            </AvisoModeloDatos>
            <DireccionesEditor direcciones={paciente.direcciones} onChange={handleDireccionesChange} />
          </Section>

          <Section label="Documentación" title="Checklist documental">
            <PacienteDocumentos
              pacienteId={paciente.id}
              obraSocialId={paciente.obraSocialId}
              obraSocialRepository={obraSocialRepository}
              documentoRepository={documentoRepository}
            />
          </Section>
        </>
      )}

      <VolverAlListadoButton onClick={onBack} />
    </div>
  );
}
