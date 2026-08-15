import { useEffect, useId, useState } from 'react';
import { Button } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Field, Input, Select } from '../../design-system/form';
import { Card } from '../../design-system/layout';
import { usePuedeEscribirModulo } from '../../shared/auth/usePuedeEscribirModulo';
import type { RecorridoHabitualRepository } from '../../shared/lib/pacientes/RecorridoHabitualRepository';
import type { Direccion } from '../../shared/types/paciente';
import type { DiaSemana, NuevoRecorridoHabitual, RecorridoHabitual } from '../../shared/types/recorridoHabitual';
import { etiquetaActividad } from './actividadDocumental';
import { DIA_SEMANA_LABELS, DIA_SEMANA_OPTIONS } from './diaSemanaOptions';

interface RecorridosHabitualesEditorProps {
  pacienteId: string;
  /** Catálogo completo del paciente (RF-110) — origen y destino de cada destino habitual son dos
   * direcciones de este mismo catálogo (`Paciente.direcciones`), igual que hojas de ruta. */
  direcciones: Direccion[];
  repository: RecorridoHabitualRepository;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}

function etiquetaDireccion(direccion: Direccion): string {
  return `${etiquetaActividad(direccion)} · ${direccion.calle}`;
}

// Editor de "Destinos habituales" (RF-110, `pacientes.recorridos`): días y horarios recurrentes
// (escuela, terapias, CET) entre dos direcciones del catálogo del paciente. A diferencia de
// DireccionesEditor/PrestacionesEditor (que persisten como un campo/colección embebida del
// Paciente vía `actualizar(paciente.id, {...})`), esta sección tiene su PROPIA tabla y su PROPIO
// repository (`pacientes.recorridos`, sin columna en `pacientes.paciente`) — hace su propio
// fetch/create/remove async, mismo patrón que PacienteDocumentos.tsx con `documentoRepository`.
//
// GATEO CRUZADO DE MÓDULO (investigación previa a este change): esta sección vive en la ficha de
// Pacientes, pero RLS gatea su escritura contra el módulo Hojas de Ruta
// (`modulos.tiene_permiso('hojas_de_ruta', 'write')`), no Pacientes — porque `pacientes.recorridos`
// es la tabla que arma la hoja de ruta, RN-HR de ese dominio. `usePuedeEscribir()`
// (shared/auth/usePuedeEscribir.ts) NO sirve acá: se resuelve contra el módulo de la RUTA activa
// (siempre `pacientes` en esta pantalla), no contra un módulo elegido por el componente — ver su
// propio comentario ("sin argumentos a propósito"). Tampoco `CamposSoloLectura` (design-
// system/components.tsx), que está hardwireado a `usePuedeEscribir()`. Se usa en cambio
// `usePuedeEscribirModulo('hojas_de_ruta')` (variante parametrizada, creada para este caso) y un
// `<fieldset disabled>` propio en vez de `<CamposSoloLectura>`.
export function RecorridosHabitualesEditor({ pacienteId, direcciones, repository }: RecorridosHabitualesEditorProps) {
  const puedeEscribir = usePuedeEscribirModulo('hojas_de_ruta');

  const [recorridos, setRecorridos] = useState<RecorridoHabitual[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [direccionInicialId, setDireccionInicialId] = useState('');
  const [direccionFinalId, setDireccionFinalId] = useState('');
  const [diaSemana, setDiaSemana] = useState<DiaSemana>('lunes');
  const [hora, setHora] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const formId = useId();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    repository
      .list(pacienteId)
      .then((datos) => {
        if (active) setRecorridos(datos);
      })
      .catch((err: unknown) => {
        if (active) setLoadError(toErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pacienteId, repository]);

  function limpiarForm() {
    setDireccionInicialId('');
    setDireccionFinalId('');
    setDiaSemana('lunes');
    setHora('');
    setFormError(null);
  }

  async function handleSubmit() {
    if (!direccionInicialId || !direccionFinalId || !hora) return;

    const nuevo: NuevoRecorridoHabitual = {
      pacienteId,
      direccionInicialId,
      direccionFinalId,
      diaSemana,
      hora,
    };

    setSubmitting(true);
    setFormError(null);
    try {
      const creado = await repository.create(nuevo);
      setRecorridos((prev) => [...prev, creado]);
      limpiarForm();
    } catch (err) {
      setFormError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    setFormError(null);
    try {
      await repository.remove(id);
      setRecorridos((prev) => prev.filter((recorrido) => recorrido.id !== id));
    } catch (err) {
      setFormError(toErrorMessage(err));
    }
  }

  function etiquetaDe(direccionId: string): string {
    const direccion = direcciones.find((d) => d.id === direccionId);
    return direccion ? etiquetaDireccion(direccion) : direccionId;
  }

  if (loading) {
    return <p className="font-body text-sm text-muted">Cargando destinos habituales…</p>;
  }

  if (loadError) {
    return <Alert tone="danger">{loadError}</Alert>;
  }

  // RN implícita de RF-110: un destino habitual necesita DOS direcciones distintas del catálogo
  // (inicial y final) — sin al menos 2 direcciones cargadas no hay con qué armar el alta. Se
  // sigue mostrando la lista de destinos ya cargados (si los hubiera, ej. tras borrar direcciones
  // después de cargarlos), pero el form de alta queda bloqueado con una explicación en vez de dos
  // selects vacíos sin salida.
  const puedeArmarDestino = direcciones.length >= 2;

  return (
    <Card radius="md" gap="lg">
      <div className="flex flex-col gap-lg">
        {formError && <Alert tone="danger">{formError}</Alert>}

        {recorridos.length === 0 ? (
          <p className="m-0 font-body text-sm text-muted">No hay destinos habituales registrados todavía.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-sm p-0">
            {recorridos.map((recorrido) => (
              <li
                key={recorrido.id}
                data-recorrido-habitual-id={recorrido.id}
                className="flex flex-wrap items-center justify-between gap-sm rounded-md border border-border bg-surface-soft px-md py-sm"
              >
                <div className="flex flex-col gap-xs">
                  <span className="font-body text-[14px] font-semibold text-ink">
                    {etiquetaDe(recorrido.direccionInicialId)} → {etiquetaDe(recorrido.direccionFinalId)}
                  </span>
                  <span className="font-body text-[13px] text-muted">
                    {DIA_SEMANA_LABELS[recorrido.diaSemana]}, {recorrido.hora}
                  </span>
                </div>
                <fieldset disabled={!puedeEscribir} className="m-0 border-0 p-0">
                  <button
                    type="button"
                    onClick={() => handleRemove(recorrido.id)}
                    aria-label={`Quitar destino habitual ${etiquetaDe(recorrido.direccionInicialId)} → ${etiquetaDe(recorrido.direccionFinalId)}`}
                    className="cursor-pointer border-none bg-transparent p-0 font-body text-xs font-semibold text-danger"
                  >
                    Quitar
                  </button>
                </fieldset>
              </li>
            ))}
          </ul>
        )}

        {!puedeArmarDestino ? (
          <p className="m-0 font-body text-sm text-muted">
            Este paciente necesita al menos 2 direcciones cargadas (sección Direcciones, más arriba)
            para poder armar un destino habitual.
          </p>
        ) : (
          <fieldset disabled={!puedeEscribir} className="m-0 flex flex-col gap-md border-0 border-t border-border p-0 pt-md">
            <p className="m-0 font-body text-[14px] font-bold text-ink">Agregar destino habitual</p>

            <div className="grid grid-cols-1 gap-md md:grid-cols-4">
              <Field label="Dirección inicial" htmlFor={`${formId}-inicial`}>
                <Select
                  id={`${formId}-inicial`}
                  density="comfortable"
                  placeholderTone="faint"
                  value={direccionInicialId}
                  onChange={(event) => setDireccionInicialId(event.target.value)}
                >
                  <option value="">Elegí una dirección</option>
                  {direcciones.map((direccion) => (
                    <option key={direccion.id} value={direccion.id}>
                      {etiquetaDireccion(direccion)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Dirección final" htmlFor={`${formId}-final`}>
                <Select
                  id={`${formId}-final`}
                  density="comfortable"
                  placeholderTone="faint"
                  value={direccionFinalId}
                  onChange={(event) => setDireccionFinalId(event.target.value)}
                >
                  <option value="">Elegí una dirección</option>
                  {direcciones.map((direccion) => (
                    <option key={direccion.id} value={direccion.id}>
                      {etiquetaDireccion(direccion)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Día de la semana" htmlFor={`${formId}-dia`}>
                <Select
                  id={`${formId}-dia`}
                  density="comfortable"
                  placeholderTone="faint"
                  value={diaSemana}
                  onChange={(event) => setDiaSemana(event.target.value as DiaSemana)}
                >
                  {DIA_SEMANA_OPTIONS.map((opcion) => (
                    <option key={opcion} value={opcion}>
                      {DIA_SEMANA_LABELS[opcion]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Hora" htmlFor={`${formId}-hora`}>
                <Input
                  id={`${formId}-hora`}
                  type="time"
                  density="comfortable"
                  placeholderTone="faint"
                  value={hora}
                  onChange={(event) => setHora(event.target.value)}
                />
              </Field>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Guardando…' : '+ Agregar destino habitual'}
              </Button>
            </div>
          </fieldset>
        )}
      </div>
    </Card>
  );
}
