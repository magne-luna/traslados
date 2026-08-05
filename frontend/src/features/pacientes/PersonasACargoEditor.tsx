import { useId, useState } from 'react';
import { Button, CamposSoloLectura, InlineIcon } from '../../design-system/components';
import { iconTacho } from '../../design-system/icons';
import { Field, Input } from '../../design-system/form';
import { Card } from '../../design-system/layout';
import type { PersonaACargo } from '../../shared/types/paciente';

interface PersonasACargoEditorProps {
  personasACargo: PersonaACargo[];
  onChange: (personasACargo: PersonaACargo[]) => void;
}

function iniciales(persona: Pick<PersonaACargo, 'nombre' | 'apellido'>): string {
  return `${persona.nombre.charAt(0)}${persona.apellido.charAt(0)}`.toUpperCase();
}

// Editor de personas a cargo (tasks.md 7.1): alta/edición/baja, sin reorder (design.md Risks —
// no se requiere acá, a diferencia del checklist de FE-2). Persiste vía actualizar() en el
// padre (PacienteDetail), mismo patrón "onChange dispara persistencia" que ChecklistEditor.
// Cada persona ya cargada se muestra de solo lectura (nunca como inputs editables inline —
// decisión del usuario); "Editar" precarga el mismo form de abajo en modo edición. Key por `id`
// (nunca por índice del array) — react-best-practices, dato sensible de menores.
//
// NOTA (tasks.md 12.3, gobernanza MEDIO): el `<li>` de cada fila usa `flex flex-wrap
// items-center justify-between` con padding asimétrico (`px-md py-sm`) — Card (layout.tsx) solo
// soporta `flex flex-col` con padding uniforme en su base, así que NO se migra a Card acá (mismo
// límite ya visto en AsignacionSemanalTabla.tsx, sección 11.2). Excepción permanente confirmada
// por el usuario: queda como `<li>` nativo, sin ampliar Card por un solo caso.
export function PersonasACargoEditor({ personasACargo, onChange }: PersonasACargoEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [telefonoAlternativo, setTelefonoAlternativo] = useState('');
  const formId = useId();

  function limpiarForm() {
    setEditingId(null);
    setNombre('');
    setApellido('');
    setDni('');
    setTelefono('');
    setTelefonoAlternativo('');
  }

  function handleEdit(persona: PersonaACargo) {
    setEditingId(persona.id);
    setNombre(persona.nombre);
    setApellido(persona.apellido);
    setDni(persona.dni);
    setTelefono(persona.telefono ?? '');
    setTelefonoAlternativo(persona.telefonoAlternativo ?? '');
  }

  function handleSubmit() {
    if (!nombre.trim() || !apellido.trim() || !dni.trim()) return;
    const datos = {
      nombre,
      apellido,
      dni,
      telefono: telefono.trim() === '' ? undefined : telefono,
      telefonoAlternativo: telefonoAlternativo.trim() === '' ? undefined : telefonoAlternativo,
    };

    if (editingId) {
      onChange(personasACargo.map((persona) => (persona.id === editingId ? { id: editingId, ...datos } : persona)));
    } else {
      onChange([...personasACargo, { id: crypto.randomUUID(), ...datos }]);
    }
    limpiarForm();
  }

  function handleRemove(id: string) {
    onChange(personasACargo.filter((persona) => persona.id !== id));
    if (editingId === id) limpiarForm();
  }

  return (
    <Card radius="md" gap="lg">
      {/* gateo-pacientes (design.md D2, tasks.md 4.4): cuelga de PacienteDetail, fuera de
          PacienteForm — un único envoltorio cubre los 3 <button> nativos ("Editar", "Quitar" por
          fila y "Cancelar" del form inline), los 5 campos y el Button "Agregar/Guardar cambios".
          A diferencia de CudFields (D2), acá NO se talla una excepción para "Cancelar": queda
          agrupado con los otros 2 <button> nativos, tal como lo pide tasks.md 4.4. Las personas a
          cargo ya cargadas siguen legibles, el fieldset solo deshabilita controles. */}
      <CamposSoloLectura>
      <div className="flex flex-col gap-lg">
      {personasACargo.length === 0 ? (
        <p className="m-0 font-body text-sm text-muted">No hay personas a cargo registradas todavía.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-sm p-0">
          {personasACargo.map((persona) => (
            <li
              key={persona.id}
              data-persona-id={persona.id}
              className="flex flex-wrap items-center justify-between gap-sm rounded-md border border-border bg-surface-soft px-md py-sm"
            >
              <div className="flex items-center gap-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-border-strong font-body text-[13px] font-bold text-ink">
                  {iniciales(persona)}
                </span>
                <div className="flex flex-col gap-xs">
                  <span className="font-body text-[13px] font-semibold text-ink">
                    {persona.nombre} {persona.apellido}
                  </span>
                  <div className="flex flex-wrap items-center gap-xs">
                    <span className="rounded-pill bg-surface px-md py-xs font-mono text-[11px] text-muted">DNI: {persona.dni}</span>
                    {persona.telefono && (
                      <span className="rounded-pill bg-surface px-md py-xs font-mono text-[11px] text-muted">
                        Tel: {persona.telefono}
                      </span>
                    )}
                    {persona.telefonoAlternativo && (
                      <span className="rounded-pill bg-surface px-md py-xs font-mono text-[11px] text-muted">
                        Alt: {persona.telefonoAlternativo}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-md">
                <button
                  type="button"
                  onClick={() => handleEdit(persona)}
                  aria-label={`Editar ${persona.nombre} ${persona.apellido}`}
                  className="cursor-pointer border-none bg-transparent p-0 font-body text-xs font-semibold text-primary"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(persona.id)}
                  aria-label={`Quitar ${persona.nombre} ${persona.apellido}`}
                  className="flex cursor-pointer items-center gap-xs border-none bg-transparent p-0 font-body text-xs font-semibold text-danger"
                >
                  <InlineIcon>{iconTacho}</InlineIcon>
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-md border-t border-border pt-md">
        <div className="flex items-center justify-between gap-sm">
          <p className="m-0 font-body text-[14px] font-bold text-ink">{editingId ? 'Editar persona' : 'Agregar nueva persona'}</p>
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

        <div className="grid grid-cols-1 gap-md md:grid-cols-3">
          <Field label="Nombre" htmlFor={`${formId}-nombre`}>
            <Input
              id={`${formId}-nombre`}
              placeholder="Ej. Juan"
              density="comfortable"
              placeholderTone="faint"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </Field>
          <Field label="Apellido" htmlFor={`${formId}-apellido`}>
            <Input
              id={`${formId}-apellido`}
              placeholder="Ej. Pérez"
              density="comfortable"
              placeholderTone="faint"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
            />
          </Field>
          <Field label="DNI" htmlFor={`${formId}-dni`}>
            <Input
              id={`${formId}-dni`}
              placeholder="Sin puntos"
              density="comfortable"
              placeholderTone="faint"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
            />
          </Field>
          <Field label="Teléfono" htmlFor={`${formId}-telefono`}>
            <Input
              id={`${formId}-telefono`}
              density="comfortable"
              placeholderTone="faint"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </Field>
          <Field label="Teléfono alternativo" htmlFor={`${formId}-telefono-alternativo`}>
            <Input
              id={`${formId}-telefono-alternativo`}
              density="comfortable"
              placeholderTone="faint"
              value={telefonoAlternativo}
              onChange={(e) => setTelefonoAlternativo(e.target.value)}
            />
          </Field>
          <div className="flex items-end justify-end">
            <Button variant="primary" onClick={handleSubmit}>
              {editingId ? 'Guardar cambios' : '+ Agregar persona a cargo'}
            </Button>
          </div>
        </div>
      </div>
      </div>
      </CamposSoloLectura>
    </Card>
  );
}
