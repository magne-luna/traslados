import { useEffect, useState } from 'react';
import { AvisoModeloDatos, AvisoPendienteCliente, Chip, Section, VolverAlListadoButton, VolverAlListadoLink } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { RecorridoHabitualRepository } from '../../shared/lib/pacientes/RecorridoHabitualRepository';
import type { RequisitosActividadRepository } from '../../shared/lib/requisitosActividad/RequisitosActividadRepository';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { ActualizacionPaciente, Cud, Direccion, NuevoPaciente, Paciente, PersonaACargo } from '../../shared/types/paciente';
import type { Prestacion } from '../../shared/types/prestacion';
import { CUD_CHIP_KIND, CUD_CHIP_LABEL } from '../../shared/lib/pacientes/cudCopy';
import { estadoCud } from '../../shared/lib/pacientes/estadoCud';
import { CudFields } from './CudFields';
import { DireccionesEditor } from './DireccionesEditor';
import { PacienteDocumentos } from './PacienteDocumentos';
import { PacienteForm, type PacienteFormValues } from './PacienteForm';
import { nombreCompleto, PacienteResumen } from './PacienteResumen';
import { PersonasACargoEditor } from './PersonasACargoEditor';
import { PrestacionesEditor } from './PrestacionesEditor';
import { RecorridosHabitualesEditor } from './RecorridosHabitualesEditor';

interface PacienteDetailProps {
  /** null = alta de un paciente nuevo; el resto de las secciones solo aplica en edición. */
  paciente: Paciente | null;
  crear: (data: NuevoPaciente) => Promise<Paciente>;
  actualizar: (id: string, data: ActualizacionPaciente) => Promise<Paciente>;
  obrasSociales: ObraSocial[];
  obraSocialRepository: ObraSocialRepository;
  documentoRepository: DocumentoRepository;
  /** documentos-checklist-items-por-actividad (tasks.md §6, "Cableado en Pacientes → Documentos"):
   * reenviado tal cual a `PacienteDocumentos` — opcional, mismo criterio que las otras dos
   * dependencias de esa sección (`design.md` D2: sin este prop, comportamiento actual sin cambios). */
  requisitosActividadRepository?: RequisitosActividadRepository;
  /** RF-110 (destinos habituales, `pacientes.recorridos`): opcional, mismo criterio que
   * `requisitosActividadRepository` — sin este prop la sección "Destinos habituales" no se
   * muestra (en vez de romper con un repository undefined). */
  recorridoHabitualRepository?: RecorridoHabitualRepository;
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
  requisitosActividadRepository,
  recorridoHabitualRepository,
  onCreated,
  onBack,
}: PacienteDetailProps) {
  // Sin resumen posible en alta (paciente null): el form arranca visible directamente.
  const [editing, setEditing] = useState(paciente === null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);
  // documentos-checklist-por-actividad (tasks.md 6.1, design.md Checkpoint (e) VEREDICTO opción
  // A): cantidad de documentos por dirección (`Direccion.id` → cantidad), calculada acá —no en
  // `DireccionesEditor`, que solo la recibe por prop— para advertir antes de quitar una actividad
  // con documentación cargada. `PacienteDocumentos`/`PacienteDocumentosChecklist` (§3/§5) ya
  // calculan un progreso por actividad, pero a nivel de ÍTEMS con al menos un documento, no de
  // cantidad de documentos crudos — acá se necesita el conteo real de `DocumentoAdjunto` que se
  // perderían, así que se resuelve con su propio `listByEntity` por dirección.
  const [documentosPorDireccion, setDocumentosPorDireccion] = useState<Record<string, number>>({});

  useEffect(() => {
    if (paciente === null) {
      setDocumentosPorDireccion({});
      return;
    }
    let active = true;
    Promise.all(
      paciente.direcciones.map((direccion) =>
        documentoRepository
          .listByEntity('paciente', paciente.id, direccion.id)
          .then((documentos) => [direccion.id, documentos.length] as const),
      ),
    ).then((entradas) => {
      if (!active) return;
      setDocumentosPorDireccion(Object.fromEntries(entradas));
    });
    return () => {
      active = false;
    };
  }, [paciente, documentoRepository]);

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

  // presupuesto-prestaciones (design.md D1/D7, tasks.md 4.4): mismo patrón que
  // handleDireccionesChange. `SupabasePacienteRepository.actualizarPaciente` persiste el diff
  // contra `pacientes.prestaciones` (fix/pacientes-prestaciones-persistencia) — la baja siempre es
  // lógica (`activa: false`), nunca un DELETE físico.
  async function handlePrestacionesChange(prestaciones: Prestacion[]) {
    if (paciente === null) return;
    setSectionError(null);
    try {
      await actualizar(paciente.id, { prestaciones });
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

      {/* tasks.md 5.1 (integracion-pacientes), design.md D9 #7/#8/#10: cartel agrupado — campos
          que se ven en pantalla pero no persisten limpio contra pacientes.paciente/clinicos.
          El formato del identificador de afiliado (#1) salió de este cartel: ya no es un dato del
          paciente, se muestra derivado (solo lectura) de ObraSocial.formatoAfiliado — RF-106,
          ver openspec/changes/integracion-obra-social/design.md D12. */}
      <AvisoModeloDatos>
        La <strong>aclaración del amparo judicial</strong> no tiene columna: se pierde al recargar
        la página. <strong>Fecha de nacimiento</strong>, <strong>CUIL del titular</strong> y el{' '}
        <strong>DNI</strong> de cada persona a cargo son nullable en la base — si faltan, se
        muestran vacíos en vez de un error. El <strong>diagnóstico</strong> se guarda como JSON
        (`clinicos.diagnostico JSONB`), no como texto plano.
      </AvisoModeloDatos>

      {/* tasks.md 5.2 (integracion-pacientes), design.md D3/D9 #2: cartel separado — el número de
          afiliado depende de un permiso de otro módulo, no del de Pacientes. */}
      <AvisoModeloDatos>
        El número de afiliado vive en el <strong>módulo Obras Sociales</strong> (
        `obra_social.coberturas_paciente`), no en Pacientes. Si la cuenta no tiene permiso de
        lectura sobre Obras Sociales, este campo se muestra vacío — no significa que el paciente no
        tenga afiliado cargado.
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
            {/* Discrepancia nueva (2026-08-05, pedido directo de la usuaria, fuera del docx): ver
                knowledge-base/04_modelo_de_datos.md §Discrepancias, entrada "Personas a Cargo". */}
            <AvisoModeloDatos>
              El campo <strong>Parentesco</strong> no existe en el docx — se agregó a pedido directo
              de la usuaria (padre/madre/tutor legal/otro).
            </AvisoModeloDatos>
            <PersonasACargoEditor personasACargo={paciente.personasACargo} onChange={handlePersonasACargoChange} />
          </Section>

          <Section label="Traslados" title="Direcciones">
            <AvisoModeloDatos>
              El docx separa "Direcciones" (catálogo: calle + tipo de lugar) de "Recorridos" (entidad
              aparte: dirección inicial/final + día de la semana + hora). Acá están fusionados en un
              solo objeto `Direccion` con `dias`/`horario` opcionales que no existen en el docx. El
              campo <strong>Descripción</strong> tampoco existe en el docx — se agregó a pedido
              directo de la usuaria para diferenciar dos direcciones del mismo tipo (ej. dos
              "Terapia").
            </AvisoModeloDatos>
            <DireccionesEditor
              direcciones={paciente.direcciones}
              onChange={handleDireccionesChange}
              documentosPorDireccion={documentosPorDireccion}
            />
          </Section>

          {recorridoHabitualRepository && (
            <Section label="Traslados" title="Destinos habituales">
              <AvisoModeloDatos>
                El docx modela "Recorridos" como entidad aparte de "Direcciones": día de la semana y
                hora habituales (escuela, terapias, CET) entre dos direcciones de este mismo
                catálogo. Sin vehículo ni conductor asociado — no confundir con el recorrido
                operativo del día de una hoja de ruta.
              </AvisoModeloDatos>
              <RecorridosHabitualesEditor
                pacienteId={paciente.id}
                direcciones={paciente.direcciones}
                repository={recorridoHabitualRepository}
              />
            </Section>
          )}

          <Section label="Prestaciones" title="Catálogo de prestaciones">
            {/* presupuesto-prestaciones (design.md D1, tasks.md Fase 4 — PR 1 de la serie
                encadenada): catálogo nuevo, sin equivalente en el docx (§Discrepancias, entrada
                nueva pendiente de D5 hasta PR 2). Se agrega para que un presupuesto (PR 2) pueda
                asociarse a UNA prestación puntual cuando la obra social factura "por-prestación". */}
            <AvisoModeloDatos>
              Catálogo nuevo, sin equivalente en el docx: cada prestación pertenece a{' '}
              <strong>este paciente</strong> (no es un catálogo global). Sirve para asociar un
              presupuesto a una prestación puntual cuando la obra social factura por prestación —
              ver `knowledge-base/04_modelo_de_datos.md` §Discrepancias.
            </AvisoModeloDatos>
            <PrestacionesEditor
              pacienteId={paciente.id}
              prestaciones={paciente.prestaciones ?? []}
              onChange={handlePrestacionesChange}
            />
          </Section>

          <Section label="Documentación" title="Checklist documental">
            {/* documentos-checklist-por-actividad (tasks.md 8.5, design.md Checkpoint (h)): la
                asociación documento↔actividad (agrupacionId en el frontend) no tiene columna real
                en pacientes.documentos todavía — ver knowledge-base/04_modelo_de_datos.md
                §Discrepancias, entrada "Documentación del paciente por actividad — sin columna
                real". */}
            <AvisoModeloDatos>
              La asociación de un documento con una actividad (escuela, terapia, club) todavía no
              tiene respaldo en el modelo real de la base: <strong>`pacientes.documentos`</strong>{' '}
              no tiene ninguna columna de dirección/actividad hoy. La futura columna{' '}
              <strong>`direccion_id`</strong> queda documentada como guía (Checkpoint (h)), a
              aplicarse en el change de integración documental.
            </AvisoModeloDatos>
            {/* documentos-transferencia-actividad (tasks.md §7, design.md D5, `documento-avisos-
                modelo-datos` spec): la clienta pidió que "marcar una actividad" lleve a su
                documentación, y prometió un video mostrando el flujo — el video todavía no llegó
                (Checkpoint (a)). Exportar (3.b) y transferir (3.c) YA se implementaron con el
                veredicto que la usuaria confirmó — este aviso es SOLO sobre lo que sigue abierto:
                la navegación. Se retira cuando el video llegue y ese checkpoint se cierre. */}
            <AvisoPendienteCliente>
              La clienta pidió que, al marcar una actividad (identificada por su domicilio), el
              sistema lleve directamente a su documentación — y prometió un video mostrando ese
              flujo. El video todavía no llegó, así que esa navegación **no está implementada
              todavía**: por ahora, cada bloque de documentación se consulta desplazándose
              manualmente por esta sección. Cuando el video llegue, se define la forma exacta (un
              botón "Ver documentación" por actividad es la lectura más literal del pedido, pero
              el video puede mostrar algo distinto) y este aviso se retira.
            </AvisoPendienteCliente>
            {/* documentos-checklist-items-por-actividad (tasks.md 8.4, design.md Checkpoint (f)
                VEREDICTO opción A): distinto del AvisoModeloDatos de arriba (ese habla de la
                columna `direccion_id`) — este habla de si el CONTENIDO del checklist varía según
                el tipo de actividad, que es un supuesto del EQUIPO (hipótesis de la usuaria), no
                feedback textual de Andrea Pastor, a diferencia de los otros refinamientos de esta
                pantalla. Se retira (o se reescribe como confirmado) recién con veredicto real —
                tasks.md 8.5. */}
            <AvisoModeloDatos>
              Cada bloque de actividad puede sumar, además de los ítems de la obra social, ítems
              propios de su <strong>tipo de actividad</strong> (escuela, escuela especial, terapia,
              CET, otro — configurables en "Documentación por Actividad"). Que la documentación
              exigida varíe según el tipo de actividad es un <strong>supuesto del equipo</strong>,{' '}
              <strong>sin confirmar</strong> todavía con la clienta con una respuesta textual — ver
              `knowledge-base/05_reglas_de_negocio.md` (nota sobre RN-FA-08/RN-FA-10). Mientras nadie
              configure ítems para ningún tipo, esta pantalla se ve y se comporta exactamente igual
              que antes.
            </AvisoModeloDatos>
            <PacienteDocumentos
              pacienteId={paciente.id}
              pacienteNombre={nombreCompleto(paciente)}
              obraSocialId={paciente.obraSocialId}
              obraSocialRepository={obraSocialRepository}
              documentoRepository={documentoRepository}
              requisitosActividadRepository={requisitosActividadRepository}
              direcciones={paciente.direcciones}
            />
          </Section>
        </>
      )}

      <VolverAlListadoButton onClick={onBack} />
    </div>
  );
}
