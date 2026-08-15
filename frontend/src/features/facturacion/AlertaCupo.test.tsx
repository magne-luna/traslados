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

// Cartel de fuente mixta retirado (fix directo 2026-08-15): `AlertaCupo` mostraba un
// `AvisoModeloDatos` (integracion-facturacion, design.md D9, tasks.md 6.4) porque el cupo
// autorizado salía de `mockAutorizacionRepository` en `FacturacionRoute.tsx` mientras
// Factura/Cobro ya eran reales. Con el swap de Presupuesto/Autorizacion a Supabase real en
// `FacturacionRoute.tsx`, `resolverCupoAutorizado` compara contra la autorización real: ya no hay
// fuente mixta que avisar, así que el aviso se retiró del componente.
describe('AlertaCupo — sin aviso de fuente mixta (retirado tras swap a Supabase real)', () => {
  it('no muestra ningún cartel de "modelo de datos" (la fuente ya no es mixta)', () => {
    render(
      <AlertaCupo resultado={{ cupoDisponible: true, excedeDias: false, excedeKm: false, mensaje: 'Dentro del cupo autorizado.' }} />,
    );
    expect(screen.queryByText(/modelo de datos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/puede no reflejar autorizaciones recientes/i)).not.toBeInTheDocument();
  });
});
