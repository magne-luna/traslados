import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Chip } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { MAX_ITEMS_TARJETA } from '../../shared/lib/reportes/constantes';

export type SeveridadTarjeta = 'critico' | 'alerta';

export interface TarjetaResumenItem {
  id: string;
  label: ReactNode;
  severidad?: SeveridadTarjeta;
}

export interface TarjetaResumenProps {
  titulo: string;
  cargando: boolean;
  error: string | null;
  items: TarjetaResumenItem[];
  mensajeVacio: string;
  enlace: { to: string; label: string };
}

const SEVERIDAD_LABEL: Record<SeveridadTarjeta, string> = { critico: 'Crítico', alerta: 'Alerta' };
const SEVERIDAD_CHIP: Record<SeveridadTarjeta, 'danger' | 'warning'> = { critico: 'danger', alerta: 'warning' };

// Componente genérico de tarjeta de resumen (tasks.md 6.3, spec dashboard-tarjetas-alertas):
// las tres tarjetas de alerta (mora, CUD, mantenimiento) se componen sobre este mismo
// componente — un solo lugar donde vive el conteo total, el acotado a MAX_ITEMS_TARJETA, el
// enlace al módulo de origen y los tres estados (carga/error/vacío).
export function TarjetaResumen({ titulo, cargando, error, items, mensajeVacio, enlace }: TarjetaResumenProps) {
  const visibles = items.slice(0, MAX_ITEMS_TARJETA);
  // El id de aria-labelledby no puede contener espacios: aria-labelledby tokeniza su valor por
  // whitespace, así que un título como "Facturas en mora" rompía la referencia (buscaba tres
  // ids separados en vez de uno). useId() da un id estable y válido (bug encontrado en la
  // auditoría de tasks.md 7.2, spec dashboard-composicion "Estructura semántica").
  const headingId = useId();

  return (
    // NOTA (tasks.md 14.1, sección 17, gobernanza MEDIO): el contenedor NO migra a `Panel` —
    // excepción permanente confirmada por el usuario, no un stop pendiente. `Panel`
    // (design-system/layout.tsx) fija su encabezado como `<h2 class="m-0 font-heading
    // text-[18px] font-bold text-ink">`; esta tarjeta usa `<h3 class="m-0 font-body text-[13px]
    // font-semibold text-muted">` junto a un contador `text-[24px]`, tipografía y nivel de
    // heading distintos de los otros 3 paneles reales del dashboard (Recorridos del día,
    // Facturado vs. cobrado, Resumen anual — confirmado por `DashboardAccesibilidad.test.tsx`).
    // Forzarla a `Panel` cambiaría el tamaño/peso/color del título (viola REGLA 0): es una
    // mini-card de estadística, no el patrón `Panel`, y así se queda. Solo su caja de error
    // migró a `Alert`.
    <section aria-labelledby={headingId} className="flex flex-col gap-sm rounded-sm border border-border bg-surface p-lg shadow-sm">
      <div className="flex items-center justify-between gap-sm">
        <h3 id={headingId} className="m-0 font-body text-[13px] font-semibold text-muted">
          {titulo}
        </h3>
        <span className="font-heading text-[24px] font-bold text-ink">{items.length}</span>
      </div>

      {error && (
        <Alert tone="danger" size="sm">
          {error}
        </Alert>
      )}

      {cargando ? (
        <p className="m-0 font-body text-sm text-muted">Cargando…</p>
      ) : !error && items.length === 0 ? (
        <p className="m-0 font-body text-sm text-muted">{mensajeVacio}</p>
      ) : !error ? (
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {visibles.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-sm font-body text-[13px] text-text">
              <span>{item.label}</span>
              {item.severidad && <Chip kind={SEVERIDAD_CHIP[item.severidad]}>{SEVERIDAD_LABEL[item.severidad]}</Chip>}
            </li>
          ))}
        </ul>
      ) : null}

      <Link to={enlace.to} className="font-body text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
        {enlace.label}
      </Link>
    </section>
  );
}
