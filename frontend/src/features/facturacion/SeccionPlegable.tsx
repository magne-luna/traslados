import { useId, type ReactNode } from 'react';
import { InlineIcon } from '../../design-system/components';
import { Card } from '../../design-system/layout';
import { iconFlechaAbajo } from '../../design-system/icons';

interface SeccionPlegableProps {
  titulo: string;
  /** Texto corto mostrado a la derecha del título cuando la sección está cerrada. */
  resumen?: string;
  abierta: boolean;
  onToggle: () => void;
  /** pacientes-checklist-simplificacion: acción propia del encabezado (ej. "Exportar"), a la
   * derecha del título — afuera del botón de toggle para no anidar `<button>`s. Opcional: sin
   * ella, el encabezado queda idéntico a como estaba (ningún caller de Facturación la pasa hoy). */
  accion?: ReactNode;
  children: ReactNode;
}

// Sección colapsable de un formulario largo (elegida sobre las otras 2 variantes exploradas con
// el skill `prototype` para el formulario de factura ya completo, 2026-08-05). El toggle vive
// FUERA de cualquier `CamposSoloLectura`: colapsar/expandir es navegación, no una escritura, así
// que debe seguir funcionando para una cuenta de solo lectura — cada caller gatea con
// `CamposSoloLectura` únicamente los campos dentro de `children`, nunca este componente entero.
//
// El colapso usa `grid-template-rows` 0fr/1fr (clases estáticas, nunca `style` inline — regla
// dura del proyecto) en vez de medir altura con JS: technique estándar para animar hacia una
// altura desconocida sin layout thrashing.
export function SeccionPlegable({ titulo, resumen, abierta, onToggle, accion, children }: SeccionPlegableProps) {
  const bodyId = useId();
  return (
    <Card radius="sm" padding="lg" gap="sm">
      <div className="flex w-full items-center justify-between gap-sm">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-sm border-0 bg-transparent p-0 text-left"
          aria-expanded={abierta}
          aria-controls={bodyId}
        >
          <h3 className="m-0 truncate font-heading text-[15px] font-bold text-ink">{titulo}</h3>
          <div className="flex shrink-0 items-center gap-sm">
            {!abierta && resumen && <span className="font-body text-[12px] text-muted">{resumen}</span>}
            <span className={`text-muted transition-transform duration-200 ${abierta ? 'rotate-180' : ''}`}>
              <InlineIcon size={16}>{iconFlechaAbajo}</InlineIcon>
            </span>
          </div>
        </button>
        {accion}
      </div>
      <div
        id={bodyId}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${abierta ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="flex flex-col gap-md overflow-hidden">{children}</div>
      </div>
    </Card>
  );
}
