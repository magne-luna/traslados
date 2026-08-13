import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { AlertaCupo } from './AlertaCupo';

describe('AlertaCupo', () => {
  it('muestra el mensaje comparativo cuando excede el cupo de días', () => {
    render(
      <AlertaCupo
        resultado={{
          cupoDisponible: true,
          excedeDias: true,
          excedeKm: false,
          mensaje: 'tenés autorizados 20 días, estás facturando 22.',
        }}
      />,
    );
    expect(screen.getByText(/tenés autorizados 20 días, estás facturando 22/i)).toBeInTheDocument();
  });

  it('avisa explícitamente cuando no hay cupo contra el cual validar', () => {
    render(
      <AlertaCupo
        resultado={{ cupoDisponible: false, excedeDias: false, excedeKm: false, mensaje: 'No hay cupo autorizado cargado para validar esta factura.' }}
      />,
    );
    expect(screen.getByText(/no hay cupo autorizado/i)).toBeInTheDocument();
  });

  it('muestra el mensaje de "dentro del cupo" cuando no hay exceso (persistente, no un toast)', () => {
    render(
      <AlertaCupo resultado={{ cupoDisponible: true, excedeDias: false, excedeKm: false, mensaje: 'Dentro del cupo autorizado.' }} />,
    );
    expect(screen.getByText(/dentro del cupo autorizado/i)).toBeInTheDocument();
  });
});

// Lectura preservada (gateo-facturacion, tasks.md 6.1, design.md D4). `AlertaCupo` es puramente
// presentacional (sin `usePuedeEscribir`) — debe seguir renderizándose completa con nivel `read`.
describe('AlertaCupo — lectura preservada en modo solo lectura', () => {
  it('con solo `read`: se renderiza completa', () => {
    render(
      <PuedeEscribirContext.Provider value={false}>
        <AlertaCupo resultado={{ cupoDisponible: true, excedeDias: false, excedeKm: false, mensaje: 'Dentro del cupo autorizado.' }} />
      </PuedeEscribirContext.Provider>,
    );
    expect(screen.getByText(/dentro del cupo autorizado/i)).toBeInTheDocument();
  });
});

// Cartel de fuente mixta (integracion-facturacion, design.md D9 — opción A aprobada 2026-08-12,
// tasks.md 6.4): la validación de cupo compara facturas reales contra autorizaciones que todavía
// son fixture de localStorage (Presupuestos/Autorizaciones no se integran en este change). El
// mensaje tiene que ser legible en términos de negocio, sin jerga interna ("fixture",
// "localStorage" nunca aparecen en la UI).
describe('AlertaCupo — aviso de fuente mixta (tasks.md 6.4, design.md D9 opción A)', () => {
  it('muestra un aviso de que el cupo puede no reflejar autorizaciones recientes', () => {
    render(
      <AlertaCupo resultado={{ cupoDisponible: true, excedeDias: false, excedeKm: false, mensaje: 'Dentro del cupo autorizado.' }} />,
    );
    expect(screen.getByText(/modelo de datos/i)).toBeInTheDocument();
    expect(screen.getByText(/puede no reflejar autorizaciones recientes/i)).toBeInTheDocument();
  });

  it('nunca menciona jerga interna (fixture / localStorage) en el mensaje al usuario', () => {
    render(
      <AlertaCupo resultado={{ cupoDisponible: true, excedeDias: false, excedeKm: false, mensaje: 'Dentro del cupo autorizado.' }} />,
    );
    expect(screen.queryByText(/fixture/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/localstorage/i)).not.toBeInTheDocument();
  });

  it('el aviso de fuente mixta se muestra incluso cuando no hay exceso de cupo', () => {
    render(
      <AlertaCupo resultado={{ cupoDisponible: false, excedeDias: false, excedeKm: false, mensaje: 'No hay cupo autorizado cargado para validar esta factura.' }} />,
    );
    expect(screen.getByText(/puede no reflejar autorizaciones recientes/i)).toBeInTheDocument();
  });
});
