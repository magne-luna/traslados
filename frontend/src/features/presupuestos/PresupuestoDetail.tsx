import { useEffect, useState } from 'react';
import {
  AvisoModeloDatos,
  Button,
  Chip,
  InlineIcon,
  Section,
  VolverAlListadoButton,
  VolverAlListadoLink,
} from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
import { iconCalendario, iconLapiz, iconMoneda } from '../../design-system/icons';
import { ESTADO_AUTORIZACION_CHIP_KIND, ESTADO_AUTORIZACION_LABEL } from '../../shared/lib/presupuestos/estadoAutorizacionCopy';
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
// ⚠️ `autorizacion-mensual` (design.md D5, tasks.md Fase 4): `getByPresupuestoId` (1 fila o `null`)
// se reemplaza por `listByPresupuestoId` (N filas por mes). Esta pantalla sigue modelando UNA
// `Autorizacion` en estado (`autorizacion: Autorizacion | null`) — la lista completa de meses con
// su propia UI (Table, "Agregar mes", D10/D11) es trabajo de Fase 6a, no de esta fase (repository
// layer). Adaptación mínima acá: toma la PRIMERA fila de la lista (con la Edge Function real
// ordenando `periodo_mes NULLS FIRST`, D5, esa primera fila es la legacy si existe, o si no el mes
// más antiguo) — hoy, sin backfill (D3), sigue siendo exactamente la única fila que existía antes
// de este change para cualquier presupuesto ya creado.
// TODO(autorizacion-mensual Fase 6a): reemplazar este estado singular por
// `autorizaciones: Autorizacion[]` + Table de meses + "Agregar mes" (D10/D11).
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

  const [autorizacion, setAutorizacion] = useState<Autorizacion | null>(null);
  const [autorizacionLoading, setAutorizacionLoading] = useState(false);
  const [autorizacionEditing, setAutorizacionEditing] = useState(false);
  const [autorizacionSubmitting, setAutorizacionSubmitting] = useState(false);
  const [autorizacionError, setAutorizacionError] = useState<string | null>(null);

  useEffect(() => {
    if (presupuesto === null) {
      setAutorizacion(null);
      return;
    }
    let cancelled = false;
    setAutorizacionLoading(true);
    autorizacionRepository
      .listByPresupuestoId(presupuesto.id)
      .then((encontradas) => {
        if (cancelled) return;
        // Adaptación mínima Fase 4 (ver comentario arriba): toma la primera fila de la lista, nunca
        // descarta un array con más de una silenciosamente -- Fase 6a reemplaza esto por la Table
        // completa de meses.
        const found = encontradas.length > 0 ? (encontradas[0] ?? null) : null;
        setAutorizacion(found);
        // Requerimiento aprobado 2026-08-15 (migración `20260815090000_presupuesto_autoriza_pendiente.sql`):
        // `facturacion.crear_presupuesto_completo`/`crear_presupuestos_lote` ahora crean la
        // autorización 1:1 en 'pendiente' en la MISMA transacción que el presupuesto, así que
        // `found` prácticamente nunca es null para un presupuesto creado después de esa migración
        // -- `autorizacionEditing` queda en `false` y el bloque de abajo muestra el resumen
        // (Card + "Editar autorización"), nunca dispara AutorizacionForm en modo ALTA. `found ===
        // null` solo puede ocurrir para presupuestos creados ANTES de esa migración (dato legacy
        // sin autorización todavía) -- para ese caso puntual sí corresponde el estado vacío con el
        // form de alta manual, cubierto en PresupuestoDetail.test.tsx.
        setAutorizacionEditing(found === null);
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
      if (autorizacion === null) {
        const creada = await autorizacionRepository.create({ presupuestoId: presupuesto.id, ...values });
        setAutorizacion(creada);
      } else {
        const actualizada = await autorizacionRepository.update(autorizacion.id, values);
        setAutorizacion(actualizada);
      }
      setAutorizacionEditing(false);
    } catch (err) {
      setAutorizacionError(toErrorMessage(err));
    } finally {
      setAutorizacionSubmitting(false);
    }
  }

  const paciente = presupuesto ? pacientes.find((p) => p.id === presupuesto.pacienteId) : undefined;
  const obraSocial = presupuesto ? obrasSociales.find((o) => o.id === presupuesto.obraSocialId) : undefined;

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
          {autorizacionError && (
            <div className="mb-md">
              <Alert tone="danger">{autorizacionError}</Alert>
            </div>
          )}

          {autorizacionLoading ? (
            <p className="font-body text-sm text-muted">Cargando autorización…</p>
          ) : autorizacion && !autorizacionEditing ? (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-sm">
                <Chip kind={ESTADO_AUTORIZACION_CHIP_KIND[autorizacion.estado]}>
                  {ESTADO_AUTORIZACION_LABEL[autorizacion.estado]}
                </Chip>
              </div>

              <div className="grid grid-cols-2 gap-md border-y border-border py-md md:grid-cols-4">
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-xs font-body text-[11px] text-muted">
                    <InlineIcon>{iconMoneda}</InlineIcon>
                    Monto autorizado
                  </span>
                  <span className="font-mono text-[13px] font-semibold text-ink">
                    {autorizacion.montoAutorizado !== undefined ? `$${autorizacion.montoAutorizado.toLocaleString('es-AR')}` : 'Sin definir'}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-body text-[11px] text-muted">Cupo mensual</span>
                  <span className="font-body text-[13px] font-semibold text-ink">
                    {autorizacion.cupoMensualDias ?? '—'} días · {autorizacion.cupoMensualKm ?? '—'} km
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-xs font-body text-[11px] text-muted">
                    <InlineIcon>{iconCalendario}</InlineIcon>
                    Fecha de respuesta
                  </span>
                  <span className="font-body text-[13px] font-semibold text-ink">{autorizacion.fechaRespuesta ?? 'Sin definir'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-xs font-body text-[11px] text-muted">
                    <InlineIcon>{iconCalendario}</InlineIcon>
                    Vigencia desde
                  </span>
                  <span className="font-body text-[13px] font-semibold text-ink">{autorizacion.vigenciaDesde ?? 'Sin definir'}</span>
                </div>
                {/* tasks.md 8.8, design.md D1: completa el par vigenciaDesde/vigenciaHasta ya
                    visible acá — la autorización puede recortar el período pedido. */}
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-xs font-body text-[11px] text-muted">
                    <InlineIcon>{iconCalendario}</InlineIcon>
                    Vigencia hasta
                  </span>
                  <span className="font-body text-[13px] font-semibold text-ink">{autorizacion.vigenciaHasta ?? 'Sin definir'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-body text-[11px] text-muted">Con dependencia (CD/SD)</span>
                  <span className="font-body text-[13px] font-semibold text-ink">
                    {autorizacion.conDependencia === undefined ? 'No cargado' : autorizacion.conDependencia ? 'Sí' : 'No'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="secondary" requiereEscritura onClick={() => setAutorizacionEditing(true)}>
                  <InlineIcon>{iconLapiz}</InlineIcon>
                  Editar autorización
                </Button>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-md">
              {autorizacion === null && <p className="m-0 font-body text-sm text-muted">No hay autorización cargada todavía.</p>}
              <AutorizacionForm
                initial={
                  autorizacion
                    ? {
                        estado: autorizacion.estado,
                        montoAutorizado: autorizacion.montoAutorizado,
                        cupoMensualDias: autorizacion.cupoMensualDias,
                        cupoMensualKm: autorizacion.cupoMensualKm,
                        fechaRespuesta: autorizacion.fechaRespuesta,
                        vigenciaDesde: autorizacion.vigenciaDesde,
                        vigenciaHasta: autorizacion.vigenciaHasta,
                        conDependencia: autorizacion.conDependencia,
                        archivo: autorizacion.archivo,
                      }
                    : undefined
                }
                montoPresupuesto={presupuesto.monto}
                presupuestoVigenciaDesde={presupuesto.vigenciaDesde}
                presupuestoVigenciaHasta={presupuesto.vigenciaHasta}
                presupuestoConDependencia={presupuesto.conDependencia}
                // integracion-documentos-autorizaciones (tasks.md 4.2, design.md D3): `autorizacion`
                // solo es `null` en el caso legado sin fila creada todavía (comentario más arriba,
                // "found === null") — sin id, AutorizacionForm avisa que hay que guardar antes de
                // poder adjuntar un archivo, en vez de intentar llamar a uploadArchivo/removeArchivo
                // sin id real.
                autorizacionId={autorizacion?.id}
                repository={autorizacionRepository}
                onSubmit={handleSubmitAutorizacion}
                onCancel={autorizacion ? () => setAutorizacionEditing(false) : onBack}
                submitting={autorizacionSubmitting}
                submitError={null}
              />
            </div>
          )}
        </Section>
      )}

      <VolverAlListadoButton onClick={onBack} />
    </div>
  );
}
