import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PuedeEscribirContext } from '../shared/auth/PuedeEscribirContext';
import { Button, CamposSoloLectura, AvisoSoloLectura } from './components';

// Tests de las primitivas de design system del mecanismo compartido de gateo de escritura
// (tasks.md 3.1-3.5, design.md D3/D5/D6). `envolver(...)` monta cada caso dentro de un
// PuedeEscribirContext.Provider explícito, sin pasar por RequireAuth/router — estas primitivas
// son consumidoras de usePuedeEscribir(), no de la resolución de ruta, que ya está cubierta en
// usePuedeEscribir.test.tsx.
function envolver(puedeEscribir: boolean | null, children: React.ReactNode) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{children}</PuedeEscribirContext.Provider>);
}

describe('CamposSoloLectura — envoltorio sobre <fieldset disabled> (tasks.md 3.1)', () => {
  it('sin permiso de escritura: input, select, textarea y button hijos directos quedan deshabilitados', () => {
    envolver(
      false,
      <CamposSoloLectura>
        <input aria-label="nombre" />
        <select aria-label="tipo">
          <option value="a">a</option>
        </select>
        <textarea aria-label="notas" />
        <button type="button">Guardar</button>
      </CamposSoloLectura>,
    );

    expect(screen.getByRole('textbox', { name: 'nombre' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'tipo' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'notas' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('con permiso de escritura: todos los controles quedan habilitados', () => {
    envolver(
      true,
      <CamposSoloLectura>
        <input aria-label="nombre" />
        <button type="button">Guardar</button>
      </CamposSoloLectura>,
    );

    expect(screen.getByRole('textbox', { name: 'nombre' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('un <button> nativo anidado dos niveles más abajo también queda deshabilitado (caso ChecklistItemRow/PlantillaCampoRow)', () => {
    envolver(
      false,
      <CamposSoloLectura>
        <div>
          <div>
            <button type="button">Quitar</button>
          </div>
        </div>
      </CamposSoloLectura>,
    );

    expect(screen.getByRole('button', { name: 'Quitar' })).toBeDisabled();
  });
});

describe('CamposSoloLectura — no altera el layout (tasks.md 3.2)', () => {
  it('renderiza un <fieldset> con las utilidades de reseteo de agente de usuario, sin estilos inline', () => {
    envolver(
      false,
      <CamposSoloLectura>
        <input aria-label="nombre" />
      </CamposSoloLectura>,
    );

    const fieldset = screen.getByRole('group') as HTMLFieldSetElement;
    expect(fieldset.tagName).toBe('FIELDSET');
    expect(fieldset).not.toHaveAttribute('style');
    for (const clase of ['min-w-0', 'border-0', 'p-0', 'm-0']) {
      expect(fieldset.className).toContain(clase);
    }
  });
});

describe('Button — prop opt-in de escritura (tasks.md 3.3)', () => {
  it('con la prop declarada y sin permiso: deshabilitado y visible, con BUTTON_DISABLED_CLASSES', () => {
    envolver(
      false,
      <Button requiereEscritura onClick={() => {}}>
        Guardar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toBeVisible();
    expect(button).toBeDisabled();
    expect(button.className).toContain('disabled:cursor-not-allowed');
    expect(button.className).toContain('disabled:opacity-40');
  });

  it('con la prop declarada y con permiso: habilitado', () => {
    envolver(
      true,
      <Button requiereEscritura onClick={() => {}}>
        Guardar
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('sin la prop y sin permiso: habilitado (retrocompatibilidad de los ~78 call sites existentes)', () => {
    envolver(
      false,
      <Button onClick={() => {}}>Cancelar</Button>,
    );

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
  });

  it('con la prop y además disabled propio, sin permiso: deshabilitado (disyunción)', () => {
    envolver(
      false,
      <Button requiereEscritura disabled onClick={() => {}}>
        Guardar
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('con la prop y además disabled propio, con permiso: sigue deshabilitado — el gateo nunca habilita lo que la lógica propia bloqueaba', () => {
    envolver(
      true,
      <Button requiereEscritura disabled onClick={() => {}}>
        Guardar
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('deshabilitado por el gateo: no dispara onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    envolver(
      false,
      <Button requiereEscritura onClick={onClick}>
        Guardar
      </Button>,
    );

    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('AvisoSoloLectura — aviso visible de modo solo lectura (tasks.md 3.5)', () => {
  it('sin permiso de escritura: muestra el aviso reutilizando Alert', () => {
    envolver(false, <AvisoSoloLectura />);

    expect(screen.getByRole('note')).toHaveTextContent(/solo lectura/i);
  });

  it('con permiso de escritura: no muestra ningún aviso', () => {
    envolver(true, <AvisoSoloLectura />);

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('fuera de un proveedor (ruta sin módulo propio): no muestra ningún aviso', () => {
    render(<AvisoSoloLectura />);

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
