import { useState } from 'react';
import { usePermiso } from '../../shared/auth/usePermiso';
import { Button, ChecklistOption, Overlay } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Field, Input, Select } from '../../design-system/form';
import { iconoAccesorioMap, iconoAccesorioPara, labelAccesorio } from '../../shared/lib/accesorios/IconoAccesorio';
import type { AccesorioCatalogo } from '../../shared/types/catalogoAccesorios';
import { useCatalogoAccesorios, useCatalogoAccesoriosRepository } from './CatalogoAccesoriosRepositoryContext';

// Selector reutilizable de accesorios de movilidad (tasks.md 4.2, design D3 — plan recortado sin
// EF nueva): único componente compartido por PacienteDatosPersonalesFields y VehiculoForm (import
// cross-feature). Alimentado por el catálogo activo del repository, con gestión inline gateada por
// usePermiso('pacientes','write') — INDEPENDIENTE del módulo de la ruta (en VehiculoForm el
// PuedeEscribirContext de ruta es 'vehiculos' y no sirve acá).
//
// Deliberadamente NO muestra un estado "cargando" visible: el catálogo entra con la fuente de la
// página; el selector solo tolera los estados vacío y de carga sin bloquear flickers de form.

interface AccesoriosMovilidadSelectorProps {
  idBase: string;
  titulo: string;
  seleccion: string[];
  onChange: (seleccion: string[]) => void;
}

type FormAbierto = { modo: 'crear' } | { modo: 'editar'; accesorio: AccesorioCatalogo } | null;

interface FormEstado {
  nombre: string;
  icono: string;
}

const formInicial: FormEstado = { nombre: '', icono: 'silla-plegable' };

export function AccesoriosMovilidadSelector({ idBase, titulo, seleccion, onChange }: AccesoriosMovilidadSelectorProps) {
  const repository = useCatalogoAccesoriosRepository();
  const { accesorios, error, refrescar } = useCatalogoAccesorios();
  const puedeGestionar = usePermiso('pacientes', 'write');

  const [formAbierto, setFormAbierto] = useState<FormAbierto>(null);
  const [form, setForm] = useState<FormEstado>(formInicial);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [menuAbiertoId, setMenuAbiertoId] = useState<string | null>(null);
  const [confirmandoDesactivar, setConfirmandoDesactivar] = useState<AccesorioCatalogo | null>(null);

  function toggle(tipo: string) {
    onChange(seleccion.includes(tipo) ? seleccion.filter((t) => t !== tipo) : [...seleccion, tipo]);
  }

  function abrirCrear() {
    setForm(formInicial);
    setErrorForm(null);
    setFormAbierto({ modo: 'crear' });
  }

  function abrirEditar(accesorio: AccesorioCatalogo) {
    setForm({ nombre: accesorio.tipo, icono: accesorio.icono });
    setErrorForm(null);
    setFormAbierto({ modo: 'editar', accesorio });
    setMenuAbiertoId(null);
  }

  async function guardar() {
    if (guardando) return;
    const tipo = form.nombre.trim();
    if (!tipo) {
      setErrorForm('Escribí un nombre para el accesorio.');
      return;
    }
    setGuardando(true);
    setErrorForm(null);
    try {
      if (formAbierto?.modo === 'editar') {
        const actualizado = await repository.editar(formAbierto.accesorio.id, { tipo, icono: form.icono });
        // El tipo es también clave de selección: si estaba seleccionado, sobrevive renombrado.
        if (seleccion.includes(formAbierto.accesorio.tipo)) {
          onChange([...seleccion.filter((t) => t !== formAbierto.accesorio.tipo), actualizado.tipo]);
        }
      } else {
        const nuevo = await repository.crear(tipo, form.icono);
        // Alta inline: queda seleccionado en el mismo render (spec "Alta exitosa").
        onChange([...seleccion, nuevo.tipo]);
      }
      setFormAbierto(null);
      await refrescar();
    } catch (e: unknown) {
      setErrorForm(e instanceof Error ? e.message : 'No se pudo guardar el accesorio.');
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarDesactivacion() {
    if (!confirmandoDesactivar) return;
    await repository.desactivar(confirmandoDesactivar.id);
    setConfirmandoDesactivar(null);
    setMenuAbiertoId(null);
    await refrescar();
  }

  async function reactivar(accesorio: AccesorioCatalogo) {
    await repository.reactivar(accesorio.id);
    await refrescar();
  }

  return (
    <fieldset className="mt-md flex flex-col gap-xs border-none p-0">
      <legend className="mb-lg flex w-full items-baseline gap-sm">
        <span className="font-heading text-[15px] font-bold text-ink">{titulo}</span>
        <span className="h-px flex-1 bg-border" />
      </legend>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-5">
        {accesorios.map((accesorio) => {
          const seleccionado = seleccion.includes(accesorio.tipo);
          const activo = accesorio.activa;
          const label = labelAccesorio(accesorio.tipo);
          return (
            <div key={accesorio.id} className="relative flex flex-col gap-xs rounded-sm border border-transparent p-0">
              <ChecklistOption
                id={`${idBase}-accesorio-${accesorio.id}`}
                label={
                  <span className={`flex items-center gap-xs ${activo ? '' : 'text-muted line-through'}`}>
                    <span className={activo ? '' : 'opacity-60'}>{label}</span>
                    {!activo && <span className="font-body text-[11px] text-muted">Inactiva</span>}
                  </span>
                }
                icon={iconoAccesorioPara(accesorio.icono)}
                selected={seleccionado && activo}
                onChange={() => {
                  if (activo) toggle(accesorio.tipo);
                }}
                ariaLabel={label}
              />
              {puedeGestionar && activo && (
                <div className="absolute right-1 top-1">
                  <button
                    type="button"
                    aria-label={`Menú de ${label}`}
                    aria-haspopup="menu"
                    aria-expanded={menuAbiertoId === accesorio.id}
                    onClick={() => setMenuAbiertoId(menuAbiertoId === accesorio.id ? null : accesorio.id)}
                    className="cursor-pointer rounded-sm border-none bg-transparent px-xs font-body text-sm font-bold text-muted hover:text-ink"
                  >
                    ⋮
                  </button>
                  {menuAbiertoId === accesorio.id && (
                    <div
                      role="menu"
                      className="absolute right-0 top-6 z-10 flex w-36 flex-col gap-xs rounded-sm border border-border bg-surface p-xs shadow-md"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => abrirEditar(accesorio)}
                        className="cursor-pointer border-none bg-transparent px-sm py-xs text-left font-body text-[13px] text-ink hover:bg-surface-soft"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => setConfirmandoDesactivar(accesorio)}
                        className="cursor-pointer border-none bg-transparent px-sm py-xs text-left font-body text-[13px] text-danger hover:bg-surface-soft"
                      >
                        Desactivar
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!activo && puedeGestionar && (
                <button
                  type="button"
                  onClick={() => reactivar(accesorio)}
                  aria-label={`Reactivar ${label}`}
                  className="cursor-pointer border-none bg-transparent p-0 font-body text-xs font-semibold text-primary"
                >
                  Reactivar
                </button>
              )}
            </div>
          );
        })}
      </div>

      {puedeGestionar && (
        <div className="flex flex-col gap-md border-t border-border pt-md">
          {formAbierto ? (
            // No es un <form>: este bloque vive dentro del <form> del alta de paciente/vehículo
            // (PacienteForm/VehiculoForm vía CardForm) — un <form> anidado es HTML inválido y el
            // navegador terminaba disparando el submit del formulario grande (recarga completa
            // de página) en vez de este guardado puntual, y el accesorio nunca llegaba a
            // persistirse. `guardar` se dispara por click, no por onSubmit.
            <div className="flex flex-col gap-md">
              {errorForm && (
                <Alert tone="danger" role="alert">
                  {errorForm}
                </Alert>
              )}
              <div className="grid grid-cols-1 gap-md md:grid-cols-2">
                <Field label="Nombre" htmlFor={`${idBase}-accesorio-nombre`}>
                  <Input
                    id={`${idBase}-accesorio-nombre`}
                    placeholder="Ej. Silla eléctrica"
                    density="comfortable"
                    placeholderTone="faint"
                    value={form.nombre}
                    onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                  />
                </Field>
                <Field label="Ícono" htmlFor={`${idBase}-accesorio-icono`}>
                  <Select
                    id={`${idBase}-accesorio-icono`}
                    density="comfortable"
                    value={form.icono}
                    onChange={(event) => setForm((prev) => ({ ...prev, icono: event.target.value }))}
                  >
                    {Object.keys(iconoAccesorioMap).map((clave) => (
                      <option key={clave} value={clave}>
                        {labelAccesorio(clave)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="flex justify-end gap-sm">
                <Button variant="secondary" onClick={() => setFormAbierto(null)}>
                  Cancelar
                </Button>
                <Button variant="primary" disabled={guardando} onClick={guardar}>
                  {formAbierto.modo === 'editar' ? 'Guardar cambios' : 'Guardar'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-start">
              <Button variant="secondary" onClick={abrirCrear}>
                + Agregar accesorio
              </Button>
            </div>
          )}
        </div>
      )}

      {confirmandoDesactivar && (
        <Overlay open onClose={() => setConfirmandoDesactivar(null)} title={`Desactivar ${labelAccesorio(confirmandoDesactivar.tipo)}`}>
          <Alert tone="warning" role="alert">
            Este accesorio queda visible en los pacientes y vehículos que ya lo usan, y deja de
            ofrecerse en asignaciones nuevas.
          </Alert>
          <div className="flex justify-end gap-sm">
            <Button variant="secondary" onClick={() => setConfirmandoDesactivar(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmarDesactivacion}>
              Desactivar de todas formas
            </Button>
          </div>
        </Overlay>
      )}
    </fieldset>
  );
}