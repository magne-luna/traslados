import { Button } from './components';

// Componente presentacional puro (design.md §D6): anterior/siguiente, "Página N de M", total de
// resultados. Sin estado propio — el dueño del estado es `usePaginaListado`
// (shared/lib/paginacion/usePaginaListado.ts), este componente solo lo muestra y devuelve la
// intención de navegar.
//
// A11y (§D6): los controles son botones nativos (`Button`, alcanzables/accionables por teclado);
// en los extremos quedan `disabled` pero VISIBLES — ocultarlos movería el layout entre páginas
// (no aplica cuando hay una sola página total, ver más abajo). El estado deshabilitado se
// comunica por el atributo `disabled` + texto ("Anterior"/"Siguiente"), nunca solo por color.
//
// Fase 0: sin consumidores todavía — el montaje real en PacientesList/ConductoresList/
// ObrasSocialesList llega en las fases 2 y 3 (design.md, tabla de fases).
export interface PaginadorProps {
  /** Página actual, 1-based. */
  pagina: number;
  totalPaginas: number;
  /** Total de filas que matchean el filtro (no `items.length` de la página actual). */
  total: number;
  onCambiarPagina: (pagina: number) => void;
}

export function Paginador({ pagina, totalPaginas, total, onCambiarPagina }: PaginadorProps) {
  // Una sola página (o cero): no hay nada que navegar. Se oculta la fila de navegación en vez de
  // mostrar "anterior"/"siguiente" deshabilitados para siempre — el caso de 5.3 (deshabilitado
  // pero visible) es sobre los EXTREMOS de una paginación con más de una página, donde el layout
  // debe mantenerse estable entre páginas; acá no hay "entre páginas" posible.
  const hayNavegacion = totalPaginas > 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-md font-body text-[13px] text-muted">
      <span>
        {total} {total === 1 ? 'resultado' : 'resultados'}
      </span>
      {hayNavegacion && (
        <div className="flex items-center gap-md">
          <Button
            variant="secondary"
            size="sm"
            disabled={pagina <= 1}
            ariaLabel="Página anterior"
            onClick={() => onCambiarPagina(pagina - 1)}
          >
            ‹ Anterior
          </Button>
          <span className="text-ink">
            Página {pagina} de {totalPaginas}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={pagina >= totalPaginas}
            ariaLabel="Página siguiente"
            onClick={() => onCambiarPagina(pagina + 1)}
          >
            Siguiente ›
          </Button>
        </div>
      )}
    </div>
  );
}
