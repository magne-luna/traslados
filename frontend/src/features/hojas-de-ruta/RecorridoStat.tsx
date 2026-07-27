import type { ReactNode } from 'react';

interface RecorridoStatProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}

// Bloque ícono + label/valor del pie de un RecorridoCard en modo solo-lectura (Vehículo ·
// Conductor · Notas del recorrido) — RecorridoVehiculoConductor (vehículo/conductor) y
// RecorridoCard (notas) comparten este mismo componente para que los tres bloques, repartidos
// entre dos archivos, se vean idénticos (mismo criterio de deduplicación que llevó a los
// primitivos de formulario del design system, ver design-system/form.tsx).
export function RecorridoStat({ icon, label, value }: RecorridoStatProps) {
  return (
    <div className="flex items-center gap-sm px-lg py-xs text-muted first:pl-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="font-body text-[11px] font-semibold text-muted">{label}</span>
        <span className="font-body text-[14px] font-semibold text-ink">{value}</span>
      </div>
    </div>
  );
}
