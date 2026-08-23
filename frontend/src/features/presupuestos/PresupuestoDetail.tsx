import { useEffect, useState } from 'react';
import { AvisoModeloDatos, Button, Chip, Section, VolverAlListadoButton, VolverAlListadoLink } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Table, Td, Th, Tr } from '../../design-system/table';
import { ESTADO_AUTORIZACION_CHIP_KIND, ESTADO_AUTORIZACION_LABEL } from '../../shared/lib/presupuestos/estadoAutorizacionCopy';
import { ordinalMes, etiquetaPeriodoMes } from '../../shared/lib/presupuestos/periodoAutorizacion';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import type { RecorridoHabitualRepository } from '../../shared/lib/pacientes/RecorridoHabitualRepository';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import type { ActualizacionPresupuesto, Autorizacion, NuevoPresupuesto, Presupuesto } from '../../shared/types/presupuesto';
import { AutorizacionForm, type AutorizacionFormValues } from './AutorizacionForm';
import { PresupuestoForm, type PresupuestoFormSubmission, type PresupuestoFormValues } from './PresupuestoForm';
import { PresupuestoResumen } from './PresupuestoResumen';

interface PresupuestoDetailProps {
  /** null = alta de un presupuesto nuevo; la sección de autorización solo aplica en edición. */
  presupuesto: Presupuesto | null;
  crear: (data: NuevoPresupuesto) => Promise<Presupuesto>;
  /** Alta atómica de N presupuestos (presupuesto-prestaciones, tasks.md Fase 8, design.md D9):
   * solo se invoca desde el submit `modo: 'lote'` de PresupuestoForm — la rama por-prestacion en
   * ALTA. La edición nunca produce este modo (D9: "la edición no bifurca"). */
  crearLote: (datas: NuevoPresupuesto[]) => Promise<Presupuesto[]>;
  actualizar: (id: string, data: ActualizacionPresupuesto) => Promise<Presupuesto>;
  /** Se puebla desde PacienteRepository.list() en el composition root — solo lectura (design.md Decisión 8). */
  pacientes: Paciente[];
  /** Se puebla desde ObraSocialRepository.list() en el composition root — solo lectura (design.md Decisión 8). */
  obrasSociales: ObraSocial[];
  autorizacionRepository: AutorizacionRepository;
  /** Botón "Traer de los destinos habituales del paciente" de PresupuestoForm (tasks.md 8.5,
   * design.md D2) — solo lectura, reusado del composition root de Pacientes. */
  recorridoHabitualRepository: Pick<RecorridoHabitualRepository, 'list'>;
  onCreated: (presupuesto: Presupuesto) => void;
  onBack: () => void;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}

function nombrePaciente(paciente: Paciente | undefined): string {
  return paciente ? `${paciente.apellido}, ${paciente.nombre}` : 'Paciente desconocido';
}

// PresupuestoForm ya bloqueó el submit si pacienteId/obraSocialId son null (validatePresupuestoForm,
// tasks.md 5.3) — acá solo se angosta el tipo sin `as`, lanzando si igualmente llegaran nulos.
function toPersistedValues(values: PresupuestoFormValues): NuevoPresupuesto {
  if (values.pacienteId === null || values.obraSocialId === null) {
    throw new Error('El presupuesto requiere paciente y obra social seleccionados.');
  }
  return {
    pacienteId: values.pacienteId,
    obraSocialId: values.obraSocialId,
    monto: values.monto,
    fechaEmision: values.fechaEmision,
    archivo: values.archivo,
    prestacionId: values.prestacionId,
    // REAPERTURA #13 (2026-08-16): el desglose de la rama `general` viaja y se persiste. En
    // edición (`initial` presente) el formulario nunca produce `lineas` (D9: "la edición no
    // bifurca" — muestra solo el campo monto simple), así que acá no hay nada que pisar.
    lineas: values.lineas,
    // presupuestos-vigencia-datos-traslado-vista-previa (tasks.md 8.2-8.4, design.md D1/D2/D3):
    // pasan tal cual — PresupuestoForm ya validó `vigenciaHasta >= vigenciaDesde` (tasks.md 8.6).
    vigenciaDesde: values.vigenciaDesde,
    vigenciaHasta: values.vigenciaHasta,
    conDependencia: values.conDependencia,
    datosTraslado: values.datosTraslado,
  };
}

// Composición de la pantalla de detalle (tasks.md 5.5, 5.6, 6.3): wire de PresupuestoForm contra
// crear/actualizar (usePresupuestos), con manejo de error visible y sin loading infinito, más la
// sección de Autorización asociada — resuelta vía AutorizacionRepository.listByPresupuestoId
// (spec presupuesto-crud, Scenario "La autorización se crea sobre un presupuesto existente") y
// persistida vía AutorizacionRepository directamente (Decisión 10), sin pasar por un hook de
// lista completa. Solo aplica una vez que el presupuesto existe (tiene id) — mismo criterio que
// VehiculoDetail/PacienteDetail (mantenimiento/CUD solo en edición).
//
// `autorizacion-mensual` (design.md D5/D10/D11, tasks.md Fase 6a): reemplaza el estado singular
// `autorizacion: Autorizacion | null` de la Fase 4 (adaptación mínima, ver git history) por
// `autorizaciones: Autorizacion[]` + una `Table` de meses (D10) + acción "Agregar mes" (D4/D11).
// `filaAbierta` reemplaza a `autorizacionEditing`: en vez de un booleano (solo servía para una
// única fila posible), ahora identifica CUÁL fila está desplegada como `AutorizacionForm` inline —
// `null` (se ve la Table), `'nueva'` (alta de un mes más) o el `id` de una fila existente (edición
// de ESE mes). Nunca modal (D10, textual: "inline, nunca modal").
export function PresupuestoDetail({
  presupuesto,
  crear,
  crearLote,
  actualizar,
  pacientes,
  obrasSociales,
  autorizacionRepository,
  recorridoHabitualRepository,
  onCreated,
  onBack,
}: PresupuestoDetailProps) {
  // Sin resumen posible en alta (presupuesto null): el form arranca visible directamente.
  const [editing, setEditing] = useState(presupuesto === null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [autorizaciones, setAutorizaciones] = useState<Autorizacion[]>([]);
  const [autorizacionLoading, setAutorizacionLoading] = useState(false);
  const [filaAbierta, setFilaAbierta] = useState<string | 'nueva' | null>(null);
  const [autorizacionSubmitting, setAutorizacionSubmitting] = useState(false);
  const [autorizacionError, setAutorizacionError] = useState<string | null>(null);

  useEffect(() => {
    if (presupuesto === null) {
      setAutorizaciones([]);
      return;
    }
    let cancelled = false;
    setAutorizacionLoading(true);
    autorizacionRepository
      .listByPresupuestoId(presupuesto.id)
      .then((encontradas) => {
        if (cancelled) return;
        setAutorizaciones(encontradas);
        // D10, estado "sin ninguna autorización" (legacy pre-2026-08-15, sin backfill D3): un
        // presupuesto creado ANTES de la migración `20260815090000_presupuesto_autoriza_pendiente.sql`
        // puede no tener ninguna fila todavía. Para ESE caso puntual se abre directo el form de alta
        // (mismo criterio que la Fase 4) en vez de mostrar una Table vacía sin acción posible. Con al
        // menos una fila (legacy sin mes, con mes, o ambas) se muestra la Table (D10).
        setFilaAbierta(encontradas.length === 0 ? 'nueva' : null);
        setAutorizacionLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAutorizacionError(toErrorMessage(err));
        setAutorizacionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [presupuesto, autorizacionRepository]);

  // Dispatch de la bifurcación (design.md D9, tasks.md Fase 8): PresupuestoForm ya resolvió qué
  // rama corresponde — acá solo se traduce el `modo` del submit a la llamada de repository
  // correcta. `modo: 'lote'` SOLO puede llegar en alta (`presupuesto === null`): D9 dice
  // explícitamente que la edición nunca bifurca, así que PresupuestoForm nunca lo produce con
  // `initial` presente. Tras un alta en lote no hay un único presupuesto al que navegar — se
  // vuelve al listado (`onBack`), donde los N presupuestos nuevos ya aparecen.
  async function handleSubmit(submission: PresupuestoFormSubmission) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (submission.modo === 'lote') {
        await crearLote(submission.items.map(toPersistedValues));
        onBack();
        return;
      }

      const persisted = toPersistedValues(submission.values);
      if (presupuesto === null) {
        const creado = await crear(persisted);
        onCreated(creado);
      } else {
        await actualizar(presupuesto.id, persisted);
        setEditing(false);
      }
    } catch (err) {
      setSubmitError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitAutorizacion(values: AutorizacionFormValues) {
    if (presupuesto === null) return;
    setAutorizacionSubmitting(true);
    setAutorizacionError(null);
    try {
      if (filaAbierta === 'nueva') {
        const creada = await autorizacionRepository.create({ presupuestoId: presupuesto.id, ...values });
        setAutorizaciones((prev) => [...prev, creada]);
      } else if (filaAbierta !== null) {
        const actualizada = await autorizacionRepository.update(filaAbierta, values);
        setAutorizaciones((prev) => prev.map((a) => (a.id === actualizada.id ? actualizada : a)));
      }
      setFilaAbierta(null);
    } catch (err) {
      setAutorizacionError(toErrorMessage(err));
    } finally {
      setAutorizacionSubmitting(false);
    }
  }

  const paciente = presupuesto ? pacientes.find((p) => p.id === presupuesto.pacienteId) : undefined;
  const obraSocial = presupuesto ? obrasSociales.find((o) => o.id === presupuesto.obraSocialId) : undefined;

  // `undefined` en ALTA ('nueva' o filaAbierta === null, la Table no se despliega en ese caso) —
  // solo resuelve una fila real cuando `filaAbierta` es un `id` existente.
  const autorizacionEnEdicion =
    filaAbierta !== null && filaAbierta !== 'nueva' ? autorizaciones.find((a) => a.id === filaAbierta) : undefined;

  return (
    <div className="flex flex-col gap-xl py-xxl px-xl">
      <VolverAlListadoLink onClick={onBack} />

      {/* tasks.md 5.4, design.md D11/D13#11: después de `integracion-presupuestos` esta pantalla
          lee presupuestos y autorizaciones reales, pero `FacturacionRoute.tsx` (validación de
          cupo, RN-FA-02/RN-PA-03) sigue en mocks — dos fuentes distintas para la misma entidad en
          la misma app. Este cartel solo cuenta el lado de Presupuestos; `integracion-facturacion`
          actualiza el suyo para que las dos historias queden alineadas (D11 punto 2). */}
      <AvisoModeloDatos>
        Esta pantalla ya lee presupuestos y autorizaciones reales del servidor. El módulo de{' '}
        <strong>Facturación</strong> (la validación de cupo autorizado, reglas RN-FA-02/RN-PA-03)
        todavía valida contra datos de prueba, no contra estos datos reales — así que el cupo que
        ves acá puede no coincidir todavía con lo que Facturación usa para autorizar un viaje.
      </AvisoModeloDatos>

      <Section label="Presupuesto" title={presupuesto ? nombrePaciente(paciente) : 'Nuevo presupuesto'}>
        {presupuesto && !editing ? (
          <PresupuestoResumen
            presupuesto={presupuesto}
            paciente={paciente}
            obraSocial={obraSocial}
            onEdit={() => setEditing(true)}
          />
        ) : (
          <PresupuestoForm
            initial={
              presupuesto
                ? {
                    pacienteId: presupuesto.pacienteId,
                    obraSocialId: presupuesto.obraSocialId,
                    monto: presupuesto.monto,
                    fechaEmision: presupuesto.fechaEmision,
                    archivo: presupuesto.archivo,
                    vigenciaDesde: presupuesto.vigenciaDesde,
                    vigenciaHasta: presupuesto.vigenciaHasta,
                    conDependencia: presupuesto.conDependencia,
                    datosTraslado: presupuesto.datosTraslado,
                  }
                : undefined
            }
            pacientes={pacientes}
            obrasSociales={obrasSociales}
            recorridoHabitualRepository={recorridoHabitualRepository}
            onSubmit={handleSubmit}
            onCancel={presupuesto ? () => setEditing(false) : onBack}
            submitting={submitting}
            submitError={submitError}
          />
        )}
      </Section>

      {presupuesto && (
        <Section label="Autorización" title="Respuesta de la obra social">
          {/* autorizacion-mensual (tasks.md 6a.6, design.md D9/OQ-1/OQ-2): mismo cartel (mismo
              componente, misma decisión de D9) que el de `AutorizacionForm.tsx` — acá se avisa a
              nivel de la Table completa de meses, antes de entrar a cualquier fila puntual. */}
          <AvisoModeloDatos>
            Esta tabla ya admite <strong>un mes por fila</strong> (antes, una única autorización por
            presupuesto). Dos reglas de negocio sobre esa cardinalidad siguen sin resolver con
            Andrea: contra qué se compara el monto autorizado de cada mes — mensual, total del
            período, o sin relación directa (OQ-1) — y si la vigencia de un mes tiene que quedar
            contenida en ese mes calendario (OQ-2). Ver{' '}
            <code>knowledge-base/10_preguntas_abiertas.md</code>.
          </AvisoModeloDatos>

          {autorizacionError && (
            <div className="mb-md">
              <Alert tone="danger">{autorizacionError}</Alert>
            </div>
          )}

          {autorizacionLoading ? (
            <p className="font-body text-sm text-muted">Cargando autorización…</p>
          ) : filaAbierta !== null ? (
            <div className="flex flex-col gap-md">
              {autorizaciones.length === 0 && (
                <p className="m-0 font-body text-sm text-muted">No hay autorización cargada todavía.</p>
              )}
              <AutorizacionForm
                initial={
                  autorizacionEnEdicion
                    ? {
                        estado: autorizacionEnEdicion.estado,
                        montoAutorizado: autorizacionEnEdicion.montoAutorizado,
                        cupoMensualDias: autorizacionEnEdicion.cupoMensualDias,
                        cupoMensualKm: autorizacionEnEdicion.cupoMensualKm,
                        fechaRespuesta: autorizacionEnEdicion.fechaRespuesta,
                        vigenciaDesde: autorizacionEnEdicion.vigenciaDesde,
                        vigenciaHasta: autorizacionEnEdicion.vigenciaHasta,
                        conDependencia: autorizacionEnEdicion.conDependencia,
                        archivo: autorizacionEnEdicion.archivo,
                        periodoMes: autorizacionEnEdicion.periodoMes,
                      }
                    : undefined
                }
                montoPresupuesto={presupuesto.monto}
                presupuestoVigenciaDesde={presupuesto.vigenciaDesde}
                presupuestoVigenciaHasta={presupuesto.vigenciaHasta}
                presupuestoConDependencia={presupuesto.conDependencia}
                // autorizacion-mensual (tasks.md 6a.4, design.md D11): nunca incluye el propio
                // `periodoMes` de la fila en edición — re-guardar un mes sin cambiarlo no es un
                // duplicado contra sí mismo.
                periodosDelPresupuesto={autorizaciones
                  .filter((a) => a.id !== autorizacionEnEdicion?.id)
                  .map((a) => a.periodoMes)}
                // integracion-documentos-autorizaciones (tasks.md 4.2, design.md D3): sin fila
                // todavía (alta, `autorizacionEnEdicion` undefined) no hay id — AutorizacionForm
                // avisa que hay que guardar antes de poder adjuntar un archivo, en vez de intentar
                // llamar a uploadArchivo/removeArchivo sin id real.
                autorizacionId={autorizacionEnEdicion?.id}
                repository={autorizacionRepository}
                onSubmit={handleSubmitAutorizacion}
                onCancel={autorizaciones.length > 0 ? () => setFilaAbierta(null) : onBack}
                submitting={autorizacionSubmitting}
                submitError={null}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-md">
              <Table caption="Autorizaciones mensuales del presupuesto">
                <thead>
                  <Tr>
                    <Th scope="col" align="left">
                      Mes
                    </Th>
                    <Th scope="col" align="left">
                      Estado
                    </Th>
                    <Th scope="col" align="left">
                      Monto autorizado
                    </Th>
                    <Th scope="col" align="left">
                      Cupo
                    </Th>
                    <Th scope="col" align="left">
                      Vigencia
                    </Th>
                    <Th scope="col" align="left">
                      Adjunto
                    </Th>
                  </Tr>
                </thead>
                <tbody>
                  {autorizaciones.map((a) => {
                    const periodos = autorizaciones.map((x) => x.periodoMes);
                    const ordinal = ordinalMes(a.periodoMes, periodos);
                    const etiqueta = etiquetaPeriodoMes(a.periodoMes);
                    const rotulo = ordinal !== undefined ? `Mes ${ordinal} · ${etiqueta}` : etiqueta;
                    return (
                      <Tr key={a.id} divided interactive onClick={() => setFilaAbierta(a.id)}>
                        <Td>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setFilaAbierta(a.id);
                            }}
                            className="cursor-pointer border-none bg-transparent p-0 text-left font-body text-[13px] font-semibold text-primary"
                          >
                            {rotulo}
                          </button>
                        </Td>
                        <Td>
                          <Chip kind={ESTADO_AUTORIZACION_CHIP_KIND[a.estado]}>{ESTADO_AUTORIZACION_LABEL[a.estado]}</Chip>
                        </Td>
                        <Td>{a.montoAutorizado !== undefined ? `$${a.montoAutorizado.toLocaleString('es-AR')}` : 'Sin definir'}</Td>
                        <Td>
                          {a.cupoMensualDias ?? '—'} días · {a.cupoMensualKm ?? '—'} km
                        </Td>
                        <Td>
                          {a.vigenciaDesde ?? '—'} → {a.vigenciaHasta ?? '—'}
                        </Td>
                        <Td>
                          {/* D10/D12: "presencia + vista previa (reusa VistaPreviaArchivo)" — la
                              vista previa REAL (Overlay + VistaPreviaArchivo, "Ver documento") ya
                              vive en AutorizacionForm (D6b) y se reusa tal cual al abrir la fila;
                              acá solo se indica presencia para no resolver N URLs firmadas en
                              paralelo por cada fila de la tabla sin que nadie lo haya pedido. */}
                          <Chip kind={a.archivo ? 'success' : 'info'}>{a.archivo ? 'Con archivo' : 'Sin archivo'}</Chip>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>

              <div className="flex justify-end">
                <Button variant="secondary" requiereEscritura onClick={() => setFilaAbierta('nueva')}>
                  + Agregar mes
                </Button>
              </div>
            </div>
          )}
        </Section>
      )}

      <VolverAlListadoButton onClick={onBack} />
    </div>
  );
}
