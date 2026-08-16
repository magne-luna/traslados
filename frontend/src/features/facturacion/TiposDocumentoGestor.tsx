import { useState } from 'react';
import { usePermiso } from '../../shared/auth/usePermiso';
import { Button, Overlay } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Field, Input, Select } from '../../design-system/form';
import type { TipoDocumentoFactura } from '../../shared/types/tiposDocumento';
import { useTiposDocumento, useTiposDocumentoRepository } from './TiposDocumentoRepositoryContext';

// Gestor inline del catálogo `facturacion.tipos_documento` (RF-410, migración
// `20260816120000_tipos_documento_crud`, mismo molde que AccesoriosMovilidadSelector): alta,
// edición (nombre + requerido) y baja suave (vía `activa`) directamente desde la pantalla del
// detalle de factura, con el checklist documental reflejándose en el mismo render (el detalle
// arma sus ítems desde este mismo catálogo).
//
// Gateado por usePermiso('facturacion','write') — INDEPENDIENTE del PuedeEscribirContext de la
// ruta. Deliberadamente NO es un <form>: vive dentro del markup del detalle de factura y un
// <form> anidado rompe el submit del contexto; `guardar` se dispara por click.
//
// Los inactivos se listan tachados SOLO cuando el usuario tiene permiso de escritura (la gestión
// es la única razón de mostrarlos — listarTodos requiere `facturacion: write` en la RLS).

interface TiposDocumentoGestorProps {
  idBase: string;
}

type FormAbierto = { modo: 'crear' } | { modo: 'editar'; tipo: TipoDocumentoFactura } | null;

interface FormEstado {
  nombre: string;
  requerido: boolean;
}

const formInicial: FormEstado = { nombre: '', requerido: false };

export function TiposDocumentoGestor({ idBase }: TiposDocumentoGestorProps) {
  const repository = useTiposDocumentoRepository();
  const { tiposDocumento, error, refrescar } = useTiposDocumento();
  const puedeGestionar = usePermiso('facturacion', 'write');

  const [formAbierto, setFormAbierto] = useState<FormAbierto>(null);
  const [form, setForm] = useState<FormEstado>(formInicial);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [menuAbiertoId, setMenuAbiertoId] = useState<string | null>(null);
  const [confirmandoDesactivar, setConfirmandoDesactivar] = useState<TipoDocumentoFactura | null>(null);

  function abrirCrear() {
    setForm(formInicial);
    setErrorForm(null);
    setFormAbierto({ modo: 'crear' });
  }

  function abrirEditar(tipo: TipoDocumentoFactura) {
    setForm({ nombre: tipo.tipo, requerido: tipo.requerido });
    setErrorForm(null);
    setFormAbierto({ modo: 'editar', tipo });
    setMenuAbiertoId(null);
  }

  async function guardar() {
    if (guardando) return;
    const nombre = form.nombre.trim();
    if (!nombre) {
      setErrorForm('Escribí un nombre para el tipo de documento.');
      return;
    }
    setGuardando(true);
    setErrorForm(null);
    try {
      if (formAbierto?.modo === 'editar') {
        await repository.editar(formAbierto.tipo.id, { tipo: nombre, requerido: form.requerido });
      } else {
        await repository.crear(nombre, form.requerido);
      }
      setFormAbierto(null);
      await refrescar();
    } catch (e: unknown) {
      setErrorForm(e instanceof Error ? e.message : 'No se pudo guardar el tipo de documento.');
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

  async function reactivar(tipo: TipoDocumentoFactura) {
    await repository.reactivar(tipo.id);
    await refrescar();
  }

  return (
    <div className="flex flex-col gap-md">
      {error && <Alert tone="danger">{error}</Alert>}

      {puedeGestionar && (
        <ul className="flex flex-col gap-xs" aria-label="Catálogo de tipos de documento">
          {tiposDocumento.map((tipo) => {
            const activo = tipo.activa;
            return (
              <li
                key={tipo.id}
                className="relative flex items-center justify-between gap-sm rounded-sm border border-border bg-surface px-sm py-xs"
              >
                <span className={`flex items-center gap-sm font-body text-[13px] ${activo ? 'text-ink' : 'text-muted line-through'}`}>
                  {tipo.tipo}
                  {tipo.requerido && !activo && <span className="font-body text-[11px] text-muted">Requerido</span>}
                  {tipo.requerido && activo && <span className="font-body text-[11px] font-semibold text-primary">Obligatorio</span>}
                  {!activo && <span className="font-body text-[11px] text-muted">Inactivo</span>}
                </span>
                <span className="flex items-center gap-xs">
                  {activo ? (
                    <>
                      <button
                        type="button"
                        aria-label={`Menu de ${tipo.tipo}`}
                        aria-haspopup="menu"
                        aria-expanded={menuAbiertoId === tipo.id}
                        onClick={() => setMenuAbiertoId(menuAbiertoId === tipo.id ? null : tipo.id)}
                        className="cursor-pointer rounded-sm border-none bg-transparent px-xs font-body text-sm font-bold text-muted hover:text-ink"
                      >
                        ⋮
                      </button>
                      {menuAbiertoId === tipo.id && (
                        <div
                          role="menu"
                          className="absolute right-0 top-6 z-10 flex w-36 flex-col gap-xs rounded-sm border border-border bg-surface p-xs shadow-md"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => abrirEditar(tipo)}
                            className="cursor-pointer border-none bg-transparent px-sm py-xs text-left font-body text-[13px] text-ink hover:bg-surface-soft"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => setConfirmandoDesactivar(tipo)}
                            className="cursor-pointer border-none bg-transparent px-sm py-xs text-left font-body text-[13px] text-danger hover:bg-surface-soft"
                          >
                            Desactivar
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => reactivar(tipo)}
                      aria-label={`Reactivar ${tipo.tipo}`}
                      className="cursor-pointer border-none bg-transparent p-0 font-body text-xs font-semibold text-primary"
                    >
                      Reactivar
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {puedeGestionar && (
        <div className="flex flex-col gap-md border-t border-border pt-md">
          {formAbierto ? (
            // No es un <form> anidado (mismo criterio que AccesoriosMovilidadSelector): el gestor
            // vive dentro del markup del detalle de factura y un <form> aquí rompería el submit de
            // cualquier formulario del contexto. `guardar` se dispara por click.
            <div className="flex flex-col gap-md">
              {errorForm && (
                <Alert tone="danger" role="alert">
                  {errorForm}
                </Alert>
              )}
              <div className="grid grid-cols-1 gap-md md:grid-cols-2">
                <Field label="Nombre" htmlFor={`${idBase}-tipo-nombre`}>
                  <Input
                    id={`${idBase}-tipo-nombre`}
                    placeholder="Ej. Orden de traslado"
                    density="comfortable"
                    placeholderTone="faint"
                    value={form.nombre}
                    onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                  />
                </Field>
                <Field label="Obligatoriedad" htmlFor={`${idBase}-tipo-requerido`}>
                  <Select
                    id={`${idBase}-tipo-requerido`}
                    density="comfortable"
                    value={form.requerido ? 'obligatorio' : 'opcional'}
                    onChange={(event) => setForm((prev) => ({ ...prev, requerido: event.target.value === 'obligatorio' }))}
                  >
                    <option value="opcional">Opcional</option>
                    <option value="obligatorio">Obligatorio</option>
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
                + Agregar tipo de documento
              </Button>
            </div>
          )}
        </div>
      )}

      {confirmandoDesactivar && (
        <Overlay open onClose={() => setConfirmandoDesactivar(null)} title={`Desactivar ${confirmandoDesactivar.tipo}`}>
          <Alert tone="warning" role="alert">
            Las facturas que ya usan este tipo de documento no se tocan, y deja de ofrecerse en el
            checklist de documentos nuevos.
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
    </div>
  );
}