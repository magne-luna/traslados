import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Overlay } from './components';

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

// Tests de Overlay (tasks.md 3.1/3.2, Checkpoint (d) de design.md — overlay centrado con
// backdrop, genérico y reutilizable). OverlayHost simula el uso real: un botón que abre, un
// botón de fondo (para probar que no se puede tabular hasta él mientras está abierto) y el
// propio Overlay con un botón interno — necesario para los tests de foco/teclado, que requieren
// estado real de open/close, no solo un render estático.
function OverlayHost({ conBotonInterno = true }: { conBotonInterno?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Abrir overlay</button>
      <button>Botón de fondo</button>
      <Overlay open={open} onClose={() => setOpen(false)} title="Título de prueba">
        <p>Contenido de prueba</p>
        {conBotonInterno && <button>Botón interno</button>}
      </Overlay>
    </div>
  );
}

describe('Overlay', () => {
  it('open=false: no renderiza nada', () => {
    render(<Overlay open={false} onClose={() => {}} title="Título">Contenido</Overlay>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('open=true: role=dialog, aria-modal=true y aria-labelledby apunta al título visible', () => {
    render(
      <Overlay open onClose={() => {}} title="Previsualización">
        Contenido
      </Overlay>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const titulo = document.getElementById(labelledBy as string);
    expect(titulo).toHaveTextContent('Previsualización');
  });

  it('Escape cierra (llama onClose)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Overlay open onClose={onClose} title="Título">
        Contenido
      </Overlay>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('click en el backdrop cierra, click dentro del contenido NO cierra', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Overlay open onClose={onClose} title="Título">
        <p>Contenido de prueba</p>
      </Overlay>,
    );
    await user.click(screen.getByText('Contenido de prueba'));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mueve el foco al diálogo al abrir', async () => {
    const user = userEvent.setup();
    render(<OverlayHost />);
    await user.click(screen.getByRole('button', { name: 'Abrir overlay' }));
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('devuelve el foco al elemento que abrió, al cerrar con Escape', async () => {
    const user = userEvent.setup();
    render(<OverlayHost />);
    const abrir = screen.getByRole('button', { name: 'Abrir overlay' });
    await user.click(abrir);
    expect(screen.getByRole('dialog')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
  });

  it('el contenido de fondo no es alcanzable por Tab mientras está abierto (trampa de foco)', async () => {
    const user = userEvent.setup();
    render(<OverlayHost />);
    await user.click(screen.getByRole('button', { name: 'Abrir overlay' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveFocus();

    // Dos elementos tabulables dentro del diálogo: el botón "Cerrar" (primero, por orden en el
    // DOM) y "Botón interno" (último). Tab hacia adelante recorre ambos y al llegar al último
    // vuelve a wrappear al primero — nunca escapa a "Botón de fondo", que está fuera del diálogo.
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Botón interno' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();

    // Shift+Tab desde el primero (Cerrar) debe wrappear hacia atrás al último (Botón interno),
    // nunca escapar hacia "Abrir overlay" (que quedó antes en el DOM, fuera del diálogo).
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Botón interno' })).toHaveFocus();
  });
});
