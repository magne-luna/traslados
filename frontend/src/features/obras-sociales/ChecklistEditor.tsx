import { useId, useRef, useState, type DragEvent } from 'react';
import { AvisoModeloDatos, Button, CamposSoloLectura, InlineIcon, SectionBadge } from '../../design-system/components';
import { Input } from '../../design-system/form';
import { Card } from '../../design-system/layout';
import { iconOjo, iconReordenar } from '../../design-system/icons';
import { DocumentChecklist } from '../../shared/components/DocumentChecklist';
import { generateId } from '../../shared/lib/id';
import { move, moveDown, moveUp } from '../../shared/lib/reorder';
import type { ChecklistItem } from '../../shared/types/documento';
import { ChecklistItemRow } from './ChecklistItemRow';

interface ChecklistEditorProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}

function noop(): void {
  // Previsualización de solo lectura: DocumentChecklist espera onUpload/onRemove porque
  // también sirve para cargar documentos reales (FE-1) — acá solo se reutiliza su render.
}

// Editor del checklist documental por obra social (tasks.md 5.*, RN-FA-08). Agregar/quitar/
// alternar requerido opera directo sobre el array `items` recibido; el reorder (drag-and-drop
// nativo HTML5 + botones subir/bajar) usa la utilidad pura shared/lib/reorder. El nombre de un
// ítem existente no es editable inline (decisión del usuario) — para corregir un nombre hay que
// quitar el ítem y agregarlo de nuevo. La persistencia real (ObraSocialRepository.update()) la
// dispara el padre al recibir onChange — ver ObraSocialDetail.tsx.
export function ChecklistEditor({ items, onChange }: ChecklistEditorProps) {
  const [nuevoNombre, setNuevoNombre] = useState('');
  const dragIndexRef = useRef<number | null>(null);
  const formId = useId();

  function handleAdd() {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    onChange([...items, { id: generateId('item'), nombre, requerido: true }]);
    setNuevoNombre('');
  }

  function handleToggleRequerido(id: string) {
    onChange(items.map((item) => (item.id === id ? { ...item, requerido: !item.requerido } : item)));
  }

  function handleRemove(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>) {
    event.preventDefault();
  }

  function handleDrop(targetIndex: number) {
    const fromIndex = dragIndexRef.current;
    dragIndexRef.current = null;
    if (fromIndex === null) return;
    onChange(move(items, fromIndex, targetIndex));
  }

  return (
    <div className="flex flex-col gap-md">
      {/* Cartel más importante del change (integracion-obra-social D3, checkpoint confirmado por
          la usuaria 2026-07-31): el nombre del ítem ya no es un array embebido — se persiste
          relacional contra `obra_social.tipos_documento`, un catálogo COMPARTIDO con Pacientes
          (`pacientes.documentos.id_tipo_documento`) y con Facturación
          (`facturacion.documento_factura.id_tipo_documento`), ambas `ON DELETE RESTRICT`. */}
      <AvisoModeloDatos>
        El nombre de cada ítem se guarda en un catálogo de tipos de documento compartido con
        Pacientes (y con Facturación) — conviene revisar la ortografía antes de guardar. Un ítem ya
        usado por documentos de pacientes no se puede quitar del catálogo.
      </AvisoModeloDatos>

      <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
      <Card gap="md">
        <SectionBadge tone="config">Configuración</SectionBadge>

        {/* gateo-obrasocial (design.md D3): agregar, reordenar por botones y eliminar son
            escritura; el checklist debajo sigue siendo legible porque el <fieldset> solo
            deshabilita controles, no oculta contenido. El arrastre NO queda cubierto acá — ver
            comentario D4 en ChecklistItemRow.tsx. */}
        <CamposSoloLectura>
        <div className="flex flex-col gap-md">
        <div className="flex items-end gap-sm">
          <div className="flex flex-1 flex-col gap-xs">
            <label htmlFor={`${formId}-nuevo-item`} className="font-body text-[12px] font-semibold text-muted">
              Nuevo ítem
            </label>
            <Input
              id={`${formId}-nuevo-item`}
              density="comfortable"
              value={nuevoNombre}
              onChange={(event) => setNuevoNombre(event.target.value)}
            />
          </div>
          <Button variant="secondary" onClick={handleAdd}>
            Agregar
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="font-body text-sm text-muted">Sin ítems todavía — agregá el primero arriba.</p>
        ) : (
          <>
            <p className="m-0 flex items-center gap-xs font-body text-xs text-muted">
              <InlineIcon>{iconReordenar}</InlineIcon>
              Arrastrá para reordenar
            </p>
            <ul className="m-0 flex list-none flex-col gap-xs p-0">
              {items.map((item, index) => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === items.length - 1}
                  onToggleRequerido={handleToggleRequerido}
                  onRemove={handleRemove}
                  onMoveUp={(i) => onChange(moveUp(items, i))}
                  onMoveDown={(i) => onChange(moveDown(items, i))}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              ))}
            </ul>
          </>
        )}
        </div>
        </CamposSoloLectura>
      </Card>

      <Card gap="md" background="surface-soft">
        <div className="flex flex-wrap items-center gap-sm">
          <SectionBadge tone="preview" icon={<InlineIcon size={12}>{iconOjo}</InlineIcon>}>
            Vista previa
          </SectionBadge>
          <span className="font-body text-xs text-muted">Así lo ve quien carga los documentos</span>
        </div>

        {items.length === 0 ? (
          <p className="font-body text-sm text-muted">Agregá ítems en Configuración para ver la vista previa.</p>
        ) : (
          <>
            <DocumentChecklist items={items} documentos={[]} onUpload={noop} onRemove={noop} readOnly />
            <p className="m-0 text-center font-body text-xs text-faint">Solo lectura — no se puede editar desde acá</p>
          </>
        )}
      </Card>
      </div>
    </div>
  );
}
