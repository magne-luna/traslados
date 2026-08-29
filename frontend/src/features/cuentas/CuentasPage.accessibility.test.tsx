import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderConQuery } from '../../shared/test/queryWrapper';
import userEvent from '@testing-library/user-event';
import type { Cuenta, CuentaRepository } from '../../shared/lib/cuentas/CuentaRepository';
import { CuentaRepositoryProvider } from './CuentaRepositoryContext';
import { CuentasPage } from './CuentasPage';

// tasks.md 7.10 (WCAG 2.1 AA, frontend-ui-design): recorrido completo por teclado — seleccionar
// cuenta → editar los 4 niveles → guardar — con foco siempre visible (nunca `outline-none` sin
// reemplazo). El contraste (≥4.5:1 texto normal / ≥3:1 componentes de interfaz) no se mide acá
// con un algoritmo de color: se hereda de los tokens ya auditados del design system (Button,
// Select, Field, Chip, Alert) — esta pantalla no introduce ningún color nuevo, ver verificación
// estática más abajo.

// empleado, no admin: un admin siempre tiene acceso total (tienePermiso short-circuitea, ver
// shared/lib/auth/permisos.ts) y CuentaDetail ya ni muestra la matriz editable para esas cuentas
// (mostraría un Alert en vez de los <select>) — este recorrido de teclado necesita la matriz real.
const EMPLEADO: Cuenta = {
  id: 'u1',
  email: 'andrea@x.com',
  nombre: 'Andrea',
  apellido: 'Pastor',
  rol: 'empleado',
  permisos: {},
};

function buildFakeRepository(): CuentaRepository {
  return {
    listarCuentas: vi.fn().mockResolvedValue([EMPLEADO]),
    crearCuenta: vi.fn().mockResolvedValue(undefined),
    actualizarPermisos: vi.fn().mockResolvedValue(undefined),
  };
}

describe('Accesibilidad de la pantalla de cuentas (tasks.md 7.10)', () => {
  it('recorrido completo por teclado: seleccionar cuenta, editar los 4 niveles y guardar', async () => {
    const user = userEvent.setup();
    const repository = buildFakeRepository();

    renderConQuery(
      <CuentaRepositoryProvider repository={repository}>
        <CuentasPage />
      </CuentaRepositoryProvider>,
    );

    await screen.findByText('andrea@x.com');

    // Seleccionar la cuenta con el teclado: el email es un <button> real, tabulable.
    const emailBtn = screen.getByRole('button', { name: /andrea@x\.com/i });
    emailBtn.focus();
    expect(emailBtn).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: 'Andrea Pastor' })).toBeInTheDocument();

    // Editar los 4 niveles de la matriz — cada <select> es nativamente operable por teclado y
    // está etiquetado por módulo (Field -> <label htmlFor>, ya cubierto en MatrizPermisos.test.tsx).
    const pacientes = screen.getByRole('combobox', { name: /^pacientes$/i });
    const obraSocial = screen.getByRole('combobox', { name: /obras sociales/i });
    const facturacion = screen.getByRole('combobox', { name: /facturación/i });
    const conductores = screen.getByRole('combobox', { name: /conductores/i });

    pacientes.focus();
    expect(pacientes).toHaveFocus();
    await user.selectOptions(pacientes, 'read');
    await user.selectOptions(obraSocial, 'write');
    await user.selectOptions(facturacion, 'admin');
    await user.selectOptions(conductores, 'read');

    // Guardar con el teclado (Tab hasta el botón + Enter), sin necesitar el mouse.
    const guardarBtn = screen.getByRole('button', { name: /guardar cambios/i });
    guardarBtn.focus();
    expect(guardarBtn).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(repository.actualizarPermisos).toHaveBeenCalledWith('u1', [
      { modulo: 'pacientes', nivelAcceso: 'read' },
      { modulo: 'obra_social', nivelAcceso: 'write' },
      { modulo: 'facturacion', nivelAcceso: 'admin' },
      { modulo: 'conductores', nivelAcceso: 'read' },
    ]);
  });

  it('ningún componente nuevo de cuentas-gestion suprime el indicador de foco (nunca outline-none sin reemplazo)', async () => {
    // Verificación estática de código fuente vía import `?raw` de Vite (mismo criterio que
    // SupabaseCuentaRepository.test.ts 6.6): ninguno de los componentes de esta feature debe
    // usar `outline-none`/`focus:outline-none` — eso violaría "indicadores de foco visibles"
    // (spec "Accesibilidad de la pantalla de cuentas").
    const fuentes = await Promise.all([
      import('./CuentasList.tsx?raw'),
      import('./MatrizPermisos.tsx?raw'),
      import('./CuentaForm.tsx?raw'),
      import('./CuentaDetail.tsx?raw'),
      import('./CuentasPage.tsx?raw'),
    ]);

    for (const modulo of fuentes) {
      const fuente = modulo.default;
      expect(fuente).not.toMatch(/outline-none/);
    }
  });
});
