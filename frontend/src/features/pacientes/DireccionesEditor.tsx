import { useId, useState } from 'react';
import { AvisoModeloDatos, Button, CamposSoloLectura, InlineIcon, Overlay } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Field, Input, Select } from '../../design-system/form';
import { Card } from '../../design-system/layout';
import type { Direccion, TipoDireccion } from '../../shared/types/paciente';
import { TIPO_DIRECCION_ICON, TIPO_DIRECCION_LABELS, TIPO_DIRECCION_OPTIONS } from './direccionOptions';

interface DireccionesEditorProps {
  direcciones: Direccion[];
  onChange: (direcciones: Direccion[]) => void;
  /** documentos-checklist-por-actividad (tasks.md 6.1, design.md Checkpoint (e) VEREDICTO opción
   * A): cantidad de documentos cargados por dirección (`Direccion.id` → cantidad), calculada por
   * `PacienteDetail` (este editor nunca hace su propio fetch de documentos). Sin entrada para un
   * `id`, o sin la prop entera, se asume 0 — mismo comportamiento que antes de este change. */
  documentosPorDireccion?: Record<string, number>;
}

// Editor de direcciones múltiples (tasks.md 8.1/8.2, RF-113): catálogo de lugares del paciente,
// cada uno un registro independiente identificado por `id`. Sin `tramo` propio (RN-HR-02): el
// tramo ida/vuelta es del recorrido que usa la dirección, no de la dirección en sí — ver
// `Tramo`/`Direccion` en shared/types/paciente.ts. Cada dirección ya cargada se muestra de solo
// lectura (nunca como inputs editables inline); "Editar" precarga el mismo form de abajo en modo
// edición — mismo patrón que PersonasACargoEditor.tsx (decisión del usuario, 2026-08-06: antes
// era "quitar y volver a cargar", como el checklist de obras-sociales-ui; ahora corrige in situ).
//
// NOTA (tasks.md 12.3, gobernanza MEDIO): el `<li>` de cada fila usa `flex flex-wrap
// items-center justify-between` con padding asimétrico (`px-md py-sm`) — Card (layout.tsx) solo
// soporta `flex flex-col` con padding uniforme en su base, así que NO se migra a Card acá (mismo
// límite ya visto en AsignacionSemanalTabla.tsx, sección 11.2). Excepción permanente confirmada
// por el usuario: queda como `<li>` nativo, sin ampliar Card por un solo caso.
export function DireccionesEditor({ direcciones, onChange, documentosPorDireccion }: DireccionesEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoDireccion>('domicilio');
  const [calle, setCalle] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [descripcion, setDescripcion] = useState('');
  // documentos-checklist-por-actividad (tasks.md 6.2, design.md Checkpoint (e) VEREDICTO opción
  // A): dirección pendiente de confirmación de borrado — no-null solo mientras tiene ≥1 documento
  // cargado y el usuario todavía no confirmó ni canceló.
  const [confirmandoQuitar, setConfirmandoQuitar] = useState<Direccion | null>(null);
  const formId = useId();

  function limpiarForm() {
    setEditingId(null);
    setTipo('domicilio');
    setCalle('');
    setLocalidad('');
    setDescripcion('');
  }

  function handleEdit(direccion: Direccion) {
    setEditingId(direccion.id);
    setTipo(direccion.tipo);
    setCalle(direccion.calle);
    setLocalidad(direccion.localidad);
    setDescripcion(direccion.descripcion ?? '');
  }

  function handleSubmit() {
    if (!calle.trim() || !localidad.trim()) return;
    const datos = { tipo, calle, localidad, descripcion: descripcion.trim() || undefined };

    if (editingId) {
      onChange(direcciones.map((direccion) => (direccion.id === editingId ? { id: editingId, ...datos } : direccion)));
    } else {
      onChange([...direcciones, { id: crypto.randomUUID(), ...datos }]);
    }
    limpiarForm();
  }

  function handleRemove(id: string) {
    onChange(direcciones.filter((direccion) => direccion.id !== id));
    if (editingId === id) limpiarForm();
  }

  // tasks.md 6.2/6.3: si la actividad tiene ≥1 documento cargado, no se quita directo — se abre el
  // diálogo de advertencia y la baja queda a cargo de "Quitar de todas formas". Sin documentos
  // (o sin la prop `documentosPorDireccion`), comportamiento idéntico al de antes de este change.
  function handleRemoveClick(direccion: Direccion) {
    const cantidadDocumentos = documentosPorDireccion?.[direccion.id] ?? 0;
    if (cantidadDocumentos > 0) {
      setConfirmandoQuitar(direccion);
      return;
    }
    handleRemove(direccion.id);
  }

  function confirmarQuitar() {
    if (!confirmandoQuitar) return;
    handleRemove(confirmandoQuitar.id);
    setConfirmandoQuitar(null);
  }

  const cantidadAQuitar = confirmandoQuitar ? (documentosPorDireccion?.[confirmandoQuitar.id] ?? 0) : 0;

  return (
    <>
      {/* tasks.md 5.3 (integracion-pacientes), design.md D9 #4/#6: días/horario no tienen columna
          propia (los días/horarios habituales viven en pacientes.recorridos, módulo Hojas de
          Ruta) y paciente.domicilio es una columna legacy suelta que duplica esta lista — se lee
          para no perderla, pero este editor nunca la escribe. `localidad` sí se persiste (columna
          NOT NULL desde 20260729120000_schema_pacientes_gaps.sql, discrepancia #3 cerrada) — ya
          no forma parte de este aviso. Fuera de Card: es un aviso de modelo de datos, no un dato
          de una dirección puntual. */}
      <AvisoModeloDatos>
        La base no guarda <strong>días</strong> ni <strong>horario</strong> de cada dirección: los
        días y horarios habituales viven en `pacientes.recorridos`, dentro del módulo{' '}
        <strong>Hojas de Ruta</strong>, no acá. Además, `paciente.domicilio` es una columna suelta
        y legacy que duplica esta lista de direcciones — se lee para no perderla, pero no se
        actualiza desde este editor.
      </AvisoModeloDatos>

    <Card radius="md" gap="lg">
      {/* gateo-pacientes (design.md D2): cuelga de PacienteDetail, fuera de PacienteForm, así que
          no lo alcanza el envoltorio de la sección de datos personales — tiene el suyo propio.
          Una sola inserción cubre los <button> nativos ("Editar"/"Quitar" por fila, "Cancelar"
          del form inline) y el bloque de alta/edición completo (campos + Button); las direcciones
          ya cargadas siguen legibles porque el fieldset solo deshabilita controles, no oculta
          contenido. */}
      <CamposSoloLectura>
      <div className="flex flex-col gap-lg">
      {direcciones.length === 0 ? (
        <p className="m-0 font-body text-sm text-muted">No hay direcciones registradas todavía.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-sm p-0">
          {direcciones.map((direccion) => (
            <li
              key={direccion.id}
              data-direccion-id={direccion.id}
              className="flex flex-wrap items-center justify-between gap-sm rounded-md border border-border bg-surface-soft px-md py-sm"
            >
              <div className="flex items-center gap-sm">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-info-soft text-info">
                  <InlineIcon size={18}>{TIPO_DIRECCION_ICON[direccion.tipo]}</InlineIcon>
                </span>
                <div className="flex flex-col gap-xs">
                  <span className="font-body text-[14px] font-semibold text-ink">
                    {TIPO_DIRECCION_LABELS[direccion.tipo]}
                    {direccion.descripcion ? ` — ${direccion.descripcion}` : ''}
                  </span>
                  <span className="font-body text-[13px] text-muted">
                    {direccion.calle}, {direccion.localidad}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-md">
                <button
                  type="button"
                  onClick={() => handleEdit(direccion)}
                  aria-label={`Editar ${TIPO_DIRECCION_LABELS[direccion.tipo]} (${direccion.calle})`}
                  className="cursor-pointer border-none bg-transparent p-0 font-body text-xs font-semibold text-primary"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveClick(direccion)}
                  aria-label={`Quitar ${TIPO_DIRECCION_LABELS[direccion.tipo]} (${direccion.calle})`}
                  className="cursor-pointer border-none bg-transparent p-0 font-body text-xs font-semibold text-danger"
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-md border-t border-border pt-md">
        <div className="flex items-center justify-between gap-sm">
          <p className="m-0 font-body text-[14px] font-bold text-ink">{editingId ? 'Editar dirección' : 'Agregar nueva dirección'}</p>
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

        <div className="grid grid-cols-1 gap-md md:grid-cols-4">
          <Field label="Tipo de lugar" htmlFor={`${formId}-tipo`}>
            <Select
              id={`${formId}-tipo`}
              density="comfortable"
              placeholderTone="faint"
              value={tipo}
              onChange={(event) => setTipo(event.target.value as TipoDireccion)}
            >
              {TIPO_DIRECCION_OPTIONS.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {TIPO_DIRECCION_LABELS[opcion]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Calle y número" htmlFor={`${formId}-calle`}>
            <Input
              id={`${formId}-calle`}
              placeholder="Ej. Av. Santa Fe 1234"
              density="comfortable"
              placeholderTone="faint"
              value={calle}
              onChange={(event) => setCalle(event.target.value)}
            />
          </Field>

          <Field label="Localidad" htmlFor={`${formId}-localidad`}>
            <Input
              id={`${formId}-localidad`}
              placeholder="Ej. CABA"
              density="comfortable"
              placeholderTone="faint"
              value={localidad}
              onChange={(event) => setLocalidad(event.target.value)}
            />
          </Field>

          <Field label="Descripción (opcional)" htmlFor={`${formId}-descripcion`}>
            <Input
              id={`${formId}-descripcion`}
              placeholder="Ej. Kinesióloga"
              density="comfortable"
              placeholderTone="faint"
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" onClick={handleSubmit}>
            {editingId ? 'Guardar cambios' : '+ Agregar dirección'}
          </Button>
        </div>
      </div>
      </div>
      </CamposSoloLectura>
    </Card>

    {/* tasks.md 6.2, design.md Checkpoint (e) VEREDICTO opción A: diálogo de solo lectura (sin
        inputs, permitido por Overlay) que advierte cuántos documentos se pierden y exige
        confirmación explícita antes de concretar el "Quitar". */}
    {confirmandoQuitar && (
      <Overlay
        open
        onClose={() => setConfirmandoQuitar(null)}
        title={`Quitar ${TIPO_DIRECCION_LABELS[confirmandoQuitar.tipo]}`}
      >
        <Alert tone="warning" role="alert">
          Esta dirección tiene {cantidadAQuitar} {cantidadAQuitar === 1 ? 'documento cargado' : 'documentos cargados'}.
          Si la quitás, vas a perder el acceso a esa documentación.
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
