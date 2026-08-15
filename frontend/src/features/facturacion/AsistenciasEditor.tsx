import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button, CamposSoloLectura } from '../../design-system/components';
import { Input, Label, Select } from '../../design-system/form';
import type { AsistenciaPrestacion } from '../../shared/types/factura';
import type { Prestacion } from '../../shared/types/prestacion';
import { generateId } from '../../shared/lib/id';

interface AsistenciasEditorProps {
  asistencias: AsistenciaPrestacion[];
  onChange: (asistencias: AsistenciaPrestacion[]) => void;
  /** Catálogo del paciente, ya filtrado por `activa` por el caller (FacturaForm) — este
   * componente no conoce el criterio de "activa" (mismo patrón que PresupuestoLineasEditor).
   * Sin catálogo (`undefined` o `[]`), el campo hace fallback al `<input>` de texto libre de
   * siempre para no romper pacientes sin prestaciones cargadas. */
  prestaciones?: Prestacion[];
  /** Nombre de la prestación derivada de la autorización elegida (modalidad `por-prestacion`,
   * ver `FacturaForm.prestacionDerivada`). Preselecciona el `<select>` en filas NUEVAS — nunca
   * fuerza el valor de filas ya cargadas, y sigue siendo editable. */
  prestacionPreseleccionada?: string;
}

const DEFAULT_FORM = { fecha: '', prestacion: '', dependencia: '', retorno: '', facturaSabados: false };

// Alta/baja/edición de las AsistenciaPrestacion embebidas en la factura (tasks.md 7.5, RN-FA-01):
// a propósito NO consulta ninguna fuente de recorridos/hojas de ruta/vehículos/conductores — las
// prestaciones declaradas se facturan íntegramente, independientes del recorrido efectivo
// (design.md Decisión 2). Mismo patrón de alta simple que GastosVehiculo.
//
// Migrado a Input/Label sueltos (tasks.md 16.2, design.md Decisión 3): campos de fila con su
// densidad actual ('comfortable', la default) — NO se usa la molécula Field porque el checkbox
// "Factura sábados" y el botón "Agregar" van en su propia fila aparte, algo que Field no modela.
//
// Grilla 2 columnas en vez de `flex flex-wrap` (feedback de usuario 2026-08-05: "esto no me
// termina de convencer" — con la columna angosta del panel de contexto, "Retorno" quedaba solo
// en una segunda fila y "Agregar" se veía apretado contra el borde). Mismo patrón `grid
// grid-cols-1 gap-md md:grid-cols-2` que ya usan FacturaFormDatosBasicos/FacturaFormEconomicos:
// 2 campos por fila, previsible sea cual sea el ancho disponible, en vez de depender de cuánto
// entre por content-width.
export function AsistenciasEditor({ asistencias, onChange, prestaciones, prestacionPreseleccionada }: AsistenciasEditorProps) {
  const [form, setForm] = useState(() => ({ ...DEFAULT_FORM, prestacion: prestacionPreseleccionada ?? '' }));
  const formId = useId();
  const hayCatalogo = (prestaciones?.length ?? 0) > 0;

  // Preselecciona la fila NUEVA con la prestación derivada de la autorización (modalidad
  // por-prestacion, FacturaForm.prestacionDerivada) sin forzar filas ya cargadas: solo pisa el
  // valor si el campo sigue vacío (mismo criterio "no forzar en filas ya cargadas" del prompt).
  useEffect(() => {
    if (!prestacionPreseleccionada) return;
    setForm((prev) => (prev.prestacion === '' ? { ...prev, prestacion: prestacionPreseleccionada } : prev));
  }, [prestacionPreseleccionada]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.fecha || !form.prestacion) return;
    const nueva: AsistenciaPrestacion = { id: generateId('asistencia'), ...form };
    onChange([...asistencias, nueva]);
    setForm({ ...DEFAULT_FORM, prestacion: prestacionPreseleccionada ?? '' });
  }

  function handleQuitar(id: string) {
    onChange(asistencias.filter((asistencia) => asistencia.id !== id));
  }

  return (
    <div className="flex flex-col gap-md">
      {asistencias.length === 0 ? (
        <p className="m-0 font-body text-sm text-muted">No hay asistencias cargadas todavía.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {asistencias.map((asistencia) => (
            <li
              key={asistencia.id}
              className="flex flex-wrap items-center justify-between gap-sm rounded-sm border border-border bg-surface-soft px-md py-xs"
            >
              <div className="flex flex-wrap items-center gap-sm font-body text-[13px] text-text">
                <span className="font-mono text-[12px] text-muted">{asistencia.fecha}</span>
                <span className="font-semibold">{asistencia.prestacion}</span>
                <span className="text-muted">
                  {asistencia.dependencia} → {asistencia.retorno}
                </span>
                {asistencia.facturaSabados && <span className="text-muted">(factura sábados)</span>}
              </div>
              {/* gateo-facturacion (design.md D2, tasks.md 5.4): "Quitar" es un <button>
                  nativo — el envoltorio de solo lectura lo cubre igual que al alta de abajo.
                  Las asistencias ya cargadas (texto de la izquierda) siguen legibles con solo
                  `read`. */}
              <CamposSoloLectura>
              <button
                type="button"
                onClick={() => handleQuitar(asistencia.id)}
                className="cursor-pointer border-none bg-transparent p-0 font-body text-xs font-semibold text-danger"
              >
                Quitar
              </button>
              </CamposSoloLectura>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit}>
        {/* gateo-facturacion (design.md D2, tasks.md 5.4): editar asistencias es una escritura
            no-CRUD gateada al mismo nivel `write` — ninguna requiere `admin` (decisión 5). Sin
            `Cancelar` en este alta: el envoltorio cubre campos y submit por igual. */}
        <CamposSoloLectura>
        <div className="flex flex-col gap-md">
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <div className="flex flex-col gap-xs">
          <Label htmlFor={`${formId}-fecha`}>Fecha</Label>
          <Input
            id={`${formId}-fecha`}
            type="date"
            value={form.fecha}
            onChange={(event) => setForm((prev) => ({ ...prev, fecha: event.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-xs">
          <Label htmlFor={`${formId}-prestacion`}>Prestación</Label>
          {hayCatalogo ? (
            // Mismo patrón que PresupuestoLineasEditor.tsx: <select> con las opciones del
            // catálogo del paciente. `AsistenciaPrestacion.prestacion` sigue siendo el NOMBRE
            // (string), no el id — el value del <select> es el id (para poder distinguir
            // prestaciones homónimas) y onChange resuelve y guarda el nombre.
            <Select
              id={`${formId}-prestacion`}
              value={prestaciones?.find((p) => p.nombre === form.prestacion)?.id ?? ''}
              onChange={(event) => {
                const nombre = prestaciones?.find((p) => p.id === event.target.value)?.nombre ?? '';
                setForm((prev) => ({ ...prev, prestacion: nombre }));
              }}
            >
              <option value="">Seleccionar prestación…</option>
              {prestaciones?.map((prestacion) => (
                <option key={prestacion.id} value={prestacion.id}>
                  {prestacion.nombre}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id={`${formId}-prestacion`}
              type="text"
              value={form.prestacion}
              onChange={(event) => setForm((prev) => ({ ...prev, prestacion: event.target.value }))}
            />
          )}
        </div>

        <div className="flex flex-col gap-xs">
          <Label htmlFor={`${formId}-dependencia`}>Dependencia</Label>
          <Input
            id={`${formId}-dependencia`}
            type="text"
            value={form.dependencia}
            onChange={(event) => setForm((prev) => ({ ...prev, dependencia: event.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-xs">
          <Label htmlFor={`${formId}-retorno`}>Retorno</Label>
          <Input
            id={`${formId}-retorno`}
            type="text"
            value={form.retorno}
            onChange={(event) => setForm((prev) => ({ ...prev, retorno: event.target.value }))}
          />
        </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-md">
          <label className="flex items-center gap-xs font-body text-[12px] text-muted">
            <input
              type="checkbox"
              checked={form.facturaSabados}
              onChange={(event) => setForm((prev) => ({ ...prev, facturaSabados: event.target.checked }))}
            />
            Factura sábados
          </label>

          <Button type="submit" variant="primary">
            Agregar
          </Button>
        </div>
        </div>
        </CamposSoloLectura>
      </form>
    </div>
  );
}
