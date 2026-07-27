import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './components';

// Tests permanentes de Button (tasks.md 8.1-8.3): comportamiento, nunca strings de clases
// Tailwind (Decisión 12, design.md) — la comparación de clases exacta vive en el test temporal
// de Evidencia A (components.button-evidence.test.tsx, se borra antes de cerrar la sección 8).
describe('Button', () => {
  it('disabled: no dispara onClick y pasa el atributo nativo', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Guardar
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('sin disabled (default false) sí dispara onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('variant="secondary-accent" y size="sm"/"xs" se aceptan como props válidas', () => {
    render(
      <>
        <Button variant="secondary-accent" size="sm">
          Editar
        </Button>
        <Button variant="secondary-accent" size="xs">
          ↑
        </Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '↑' })).toBeInTheDocument();
  });
});
