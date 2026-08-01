import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Factura } from '../../shared/types/factura';
import type { ValidarCupoFacturacionResultado } from '../../shared/lib/facturacion/validarCupoFacturacion';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { FacturaAccionesEmision } from './FacturaAccionesEmision';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

const facturaAFacturar: Factura = {
  id: 'factura-1',
  pacienteId: 'paciente-martina',
  descripcion: '',
  dias: 10,
  valorKm: 300,
  monto: 3000,
  estado: 'a-facturar',
  fechaInicial: '2026-08-01',
  fechaTope: '2026-08-31',
  tipoComprobante: 'A',
  cantidadKm: 10,
  prestacion: 'Kinesiología',
  mesFacturado: 8,
  anioFacturado: 2026,
  dependenciaYRetorno: 'Escuela / domicilio',
  domicilioId: 'dir-1',
  asistencias: [],
};

// Gateo de escritura (gateo-facturacion, tasks.md 5.1, design.md D2). Emitir factura y confirmar
// emisión son escrituras que no son un CRUD limpio, pero se gatean al mismo nivel `write` que
// Guardar — ninguna requiere `admin` (decisión 5 de la usuaria).
describe('FacturaAccionesEmision — gateo de escritura', () => {
  it('sin permiso de escritura: "Emitir factura" queda visible y no se puede activar', () => {
    renderConPermiso(
      false,
      <FacturaAccionesEmision
        factura={facturaAFacturar}
        paciente={undefined}
        submitting={false}
        onEmitir={vi.fn()}
        cupoParaConfirmar={null}
        onConfirmarEmision={vi.fn()}
      />,
    );

    const emitir = screen.getByRole('button', { name: /^emitir factura$/i });
    expect(emitir).toBeVisible();
    expect(emitir).toBeDisabled();
  });

  it('sin permiso de escritura: "Confirmar emisión" queda visible y no se puede activar', () => {
    renderConPermiso(
      false,
      <FacturaAccionesEmision
        factura={facturaAFacturar}
        paciente={undefined}
        submitting={false}
        onEmitir={vi.fn()}
        cupoParaConfirmar={
          {
            cupoDisponible: true,
            excedeDias: true,
            excedeKm: false,
            mensaje: 'Tenés autorizados 5 días',
          } satisfies ValidarCupoFacturacionResultado
        }
        onConfirmarEmision={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /confirmar emisión/i })).toBeDisabled();
  });

  it('con permiso de escritura (sin admin): las dos acciones están activables — no requieren admin (decisión 5)', async () => {
    const user = userEvent.setup();
    const onEmitir = vi.fn();

    renderConPermiso(
      true,
      <FacturaAccionesEmision
        factura={facturaAFacturar}
        paciente={undefined}
        submitting={false}
        onEmitir={onEmitir}
        cupoParaConfirmar={null}
        onConfirmarEmision={vi.fn()}
      />,
    );

    const emitir = screen.getByRole('button', { name: /^emitir factura$/i });
    expect(emitir).toBeEnabled();
    await user.click(emitir);
    expect(onEmitir).toHaveBeenCalledTimes(1);
  });
});
