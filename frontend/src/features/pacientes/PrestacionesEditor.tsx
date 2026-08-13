import { useId, useState } from 'react';
import { CamposSoloLectura } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Field, Input } from '../../design-system/form';
import { Card } from '../../design-system/layout';
import { Button, Overlay } from '../../design-system/components';
import type { Prestacion } from '../../shared/types/prestacion';

interface PrestacionesEditorProps {
  /** Dueño del catálogo — necesario para armar una `Prestacion` nueva (design.md D7: el catálogo
   * cuelga del paciente, nunca es global). */
  pacienteId: string;
  prestaciones: Prestacion[];
  onChange: (prestaciones: Prestacion[]) => void;
  /** presupuesto-prestaciones (design.md D1, tasks.md 4.3): cantidad de presupuestos asociados a
   * cada prestación (`Prestacion.id` → cantidad), calculada por quien use este editor (mismo
   * criterio que `documentosPorDireccion` en `DireccionesEditor` — este componente nunca hace su
   * propio fetch). En PR 1 (`presupuesto-prestaciones`) `facturacion.presupuesto.prestacion_id`
   * todavía no existe (PR 2), así que ningún caller puede calcular este número todavía — la prop
   * queda lista para cuando sí pueda, sin entrada = 0, mismo comportamiento que sin la prop. */
  presupuestosPorPrestacion?: Record<string, number>;
}

// Catálogo de prestaciones del paciente (presupuesto-prestaciones, design.md D1/D7, tasks.md Fase
// 4 — PR 1 de la serie encadenada). Copia estructural directa de `DireccionesEditor.tsx`: alta /
// edición / baja in-place, con confirmación cuando la baja tiene dependencias.
//
// Decisión de UI no obvia (tasks.md 4.3, "usá criterio"): a diferencia de `DireccionesEditor`
// (que solo lista lo cargado), acá se listan TODAS las prestaciones, activas E inactivas — nunca se
// ocultan. Una prestación `activa: false` se ve tachada/atenuada, sin acciones de "Editar"/"Quitar"
// (ya está dada de baja), con una única acción "Reactivar" que vuelve a `activa: true`. Elegido
// sobre "ocultar las inactivas" porque el catálogo es historial además de selector: un presupuesto
// viejo (PR 2) puede referenciar una prestación inactiva, y ocultarla del todo en la ficha del
// paciente sería peor para trazabilidad que mostrarla atenuada.
export function PrestacionesEditor({ pacienteId, prestaciones, onChange, presupuestosPorPrestacion }: PrestacionesEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [confirmandoQuitar, setConfirmandoQuitar] = useState<Prestacion | null>(null);
  const formId = useId();

  function limpiarForm() {
    setEditingId(null);
    setNombre('');
    setDescripcion('');
  }

  function handleEdit(prestacion: Prestacion) {
    setEditingId(prestacion.id);
    setNombre(prestacion.nombre);
    setDescripcion(prestacion.descripcion ?? '');
  }

  function handleSubmit() {
    if (!nombre.trim()) return;
    const descripcionValor = descripcion.trim() || undefined;

    if (editingId) {
      onChange(
        prestaciones.map((prestacion) =>
          prestacion.id === editingId ? { ...prestacion, nombre: nombre.trim(), descripcion: descripcionValor } : prestacion,
        ),
      );
    } else {
      onChange([
        ...prestaciones,
        { id: crypto.randomUUID(), pacienteId, nombre: nombre.trim(), descripcion: descripcionValor, activa: true },
      ]);
    }
    limpiarForm();
  }

  function aplicarBaja(id: string) {
    onChange(prestaciones.map((prestacion) => (prestacion.id === id ? { ...prestacion, activa: false } : prestacion)));
    if (editingId === id) limpiarForm();
  }

  function handleQuitarClick(prestacion: Prestacion) {
    const cantidadPresupuestos = presupuestosPorPrestacion?.[prestacion.id] ?? 0;
    if (cantidadPresupuestos > 0) {
      setConfirmandoQuitar(prestacion);
      return;
    }
    aplicarBaja(prestacion.id);
  }

  function confirmarQuitar() {
    if (!confirmandoQuitar) return;
    aplicarBaja(confirmandoQuitar.id);
    setConfirmandoQuitar(null);
  }

  function handleReactivar(prestacion: Prestacion) {
    onChange(prestaciones.map((p) => (p.id === prestacion.id ? { ...p, activa: true } : p)));
  }

  const cantidadPresupuestosAQuitar = confirmandoQuitar ? (presupuestosPorPrestacion?.[confirmandoQuitar.id] ?? 0) : 0;

  return (
    <>
      <Card radius="md" gap="lg">
        <CamposSoloLectura>
          <div className="flex flex-col gap-lg">
            {prestaciones.length === 0 ? (
              <p className="m-0 font-body text-sm text-muted">No hay prestaciones registradas todavía.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-sm p-0">
                {prestaciones.map((prestacion) => (
                  <li
                    key={prestacion.id}
                    data-prestacion-id={prestacion.id}
                    className="flex flex-wrap items-center justify-between gap-sm rounded-md border border-border bg-surface-soft px-md py-sm"
                  >
                    <div className={`flex flex-col gap-xs ${prestacion.activa ? '' : 'opacity-60'}`}>
                      <span className={`font-body text-[14px] font-semibold text-ink ${prestacion.activa ? '' : 'line-through'}`}>
                        {prestacion.nombre}
                      </span>
                      {prestacion.descripcion && (
                        <span className="font-body text-[13px] text-muted">{prestacion.descripcion}</span>
                      )}
                      {!prestacion.activa && <span className="font-body text-[12px] text-muted">Inactiva</span>}
                    </div>
                    <div className="flex items-center gap-md">
                      {prestacion.activa ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEdit(prestacion)}
                            aria-label={`Editar ${prestacion.nombre}`}
                            className="cursor-pointer border-none bg-transparent p-0 font-body text-xs font-semibold text-primary"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuitarClick(prestacion)}
                            aria-label={`Quitar ${prestacion.nombre}`}
                            className="cursor-pointer border-none bg-transparent p-0 font-body text-xs font-semibold text-danger"
                          >
                            Quitar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReactivar(prestacion)}
                          aria-label={`Reactivar ${prestacion.nombre}`}
                          className="cursor-pointer border-none bg-transparent p-0 font-body text-xs font-semibold text-primary"
                        >
                          Reactivar
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-col gap-md border-t border-border pt-md">
              <div className="flex items-center justify-between gap-sm">
                <p className="m-0 font-body text-[14px] font-bold text-ink">{editingId ? 'Editar prestación' : 'Agregar prestación'}</p>
                {editingId && (
                  <button
                    type="button"
                    onClick={limpiarForm}
                    className="cursor-pointer border-none bg-transparent p-0 font-body text-xs font-semibold text-muted"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-md md:grid-cols-2">
                <Field label="Nombre de la prestación" htmlFor={`${formId}-nombre`}>
                  <Input
                    id={`${formId}-nombre`}
                    placeholder="Ej. Kinesiología"
                    density="comfortable"
                    placeholderTone="faint"
                    value={nombre}
                    onChange={(event) => setNombre(event.target.value)}
                  />
                </Field>

                <Field label="Descripción (opcional)" htmlFor={`${formId}-descripcion`}>
                  <Input
                    id={`${formId}-descripcion`}
                    placeholder="Ej. Sesión semanal"
                    density="comfortable"
                    placeholderTone="faint"
                    value={descripcion}
                    onChange={(event) => setDescripcion(event.target.value)}
                  />
                </Field>
              </div>

              <div className="flex justify-end">
                <Button variant="primary" onClick={handleSubmit}>
                  {editingId ? 'Guardar cambios' : '+ Agregar prestación'}
                </Button>
              </div>
            </div>
          </div>
        </CamposSoloLectura>
      </Card>

      {confirmandoQuitar && (
        <Overlay open onClose={() => setConfirmandoQuitar(null)} title={`Quitar ${confirmandoQuitar.nombre}`}>
          <Alert tone="warning" role="alert">
            Esta prestación tiene {cantidadPresupuestosAQuitar}{' '}
            {cantidadPresupuestosAQuitar === 1 ? 'presupuesto asociado' : 'presupuestos asociados'}. Si la
            quitás, esos presupuestos conservan la referencia, pero la prestación deja de ofrecerse para
            presupuestos nuevos.
          </Alert>
          <div className="flex justify-end gap-sm">
            <Button variant="secondary" onClick={() => setConfirmandoQuitar(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmarQuitar}>
              Quitar de todas formas
            </Button>
          </div>
        </Overlay>
      )}
    </>
  );
}
