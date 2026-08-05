import type { ReactElement } from 'react';

// Stepper (change `facturacion-wizard-paciente-prestador`, design.md): indicador visual de
// progreso para el único flujo de la app organizado en pasos secuenciales ("Nueva factura",
// FacturaForm.tsx) — el resto del sistema es "list+detail inline, nunca modal"
// (knowledge-base/08_arquitectura_propuesta.md), así que esta primitiva es deliberadamente chica
// y específica (N pasos con label fijo por caller), no un framework de wizard genérico para
// retrofitear en otras pantallas. Puramente presentacional: no decide navegación ni gating — el
// caller sigue siendo dueño de `currentStep`/avanzar/retroceder (ver Button "Siguiente"/"Atrás" en
// FacturaForm.tsx, que reusa el Button del design system en vez de que esta primitiva invente
// botones propios).
export interface StepperStep {
  label: string;
}

type StepEstado = 'completado' | 'activo' | 'pendiente';

function estadoDelPaso(index: number, currentStep: number): StepEstado {
  if (index < currentStep) return 'completado';
  if (index === currentStep) return 'activo';
  return 'pendiente';
}

const circuloClasses: Record<StepEstado, string> = {
  completado: 'border-primary bg-primary text-white',
  activo: 'border-primary bg-surface text-primary',
  pendiente: 'border-border-strong bg-surface text-muted',
};

const labelEstadoClasses: Record<StepEstado, string> = {
  completado: 'text-text',
  activo: 'font-semibold text-ink',
  pendiente: 'text-muted',
};

export function Stepper({ steps, currentStep }: { steps: StepperStep[]; currentStep: number }): ReactElement {
  return (
    <ol className="flex items-center" aria-label="Progreso del formulario">
      {steps.map((step, index) => {
        const estado = estadoDelPaso(index, currentStep);
        const esUltimo = index === steps.length - 1;
        return (
          <li key={step.label} className={`flex items-center gap-sm ${esUltimo ? 'flex-none' : 'flex-1'}`}>
            <span
              aria-current={estado === 'activo' ? 'step' : undefined}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-pill border-[1.5px] font-body text-[12px] font-semibold ${circuloClasses[estado]}`}
            >
              {index + 1}
            </span>
            <span className={`font-body text-[13px] whitespace-nowrap ${labelEstadoClasses[estado]}`}>{step.label}</span>
            {!esUltimo && <div className="mx-sm h-px flex-1 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
