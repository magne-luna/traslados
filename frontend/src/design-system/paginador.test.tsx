import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Paginador } from './paginador';

describe('Paginador', () => {
  it('renderiza "Página 3 de 7" y el total de resultados', () => {
    render(<Paginador pagina={3} totalPaginas={7} total={134} onCambiarPagina={vi.fn()} />);

    expect(screen.getByText('Página 3 de 7')).toBeInTheDocument();
    expect(screen.getByText(/134/)).toBeInTheDocument();
  });

  it('en la primera página, "anterior" queda disabled y VISIBLE (no oculto)', () => {
    render(<Paginador pagina={1} totalPaginas={5} total={100} onCambiarPagina={vi.fn()} />);

    const anterior = screen.getByRole('button', { name: 'Página anterior' });
    expect(anterior).toBeInTheDocument();
    expect(anterior).toBeDisabled();

    const siguiente = screen.getByRole('button', { name: 'Página siguiente' });
    expect(siguiente).toBeInTheDocument();
    expect(siguiente).toBeEnabled();
  });

  it('en la última página, "siguiente" queda disabled y visible; "anterior" sigue habilitado', () => {
    render(<Paginador pagina={5} totalPaginas={5} total={100} onCambiarPagina={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeEnabled();
  });

  it('click en "siguiente" invoca onCambiarPagina con pagina + 1', async () => {
    const user = userEvent.setup();
    const onCambiarPagina = vi.fn();
    render(<Paginador pagina={3} totalPaginas={7} total={134} onCambiarPagina={onCambiarPagina} />);

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));

    expect(onCambiarPagina).toHaveBeenCalledWith(4);
  });

  it('click en "anterior" invoca onCambiarPagina con pagina - 1', async () => {
    const user = userEvent.setup();
    const onCambiarPagina = vi.fn();
    render(<Paginador pagina={3} totalPaginas={7} total={134} onCambiarPagina={onCambiarPagina} />);

    await user.click(screen.getByRole('button', { name: 'Página anterior' }));

    expect(onCambiarPagina).toHaveBeenCalledWith(2);
  });

  it('con una sola página no ofrece navegación pero sigue informando el total', () => {
    render(<Paginador pagina={1} totalPaginas={1} total={3} onCambiarPagina={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Página anterior' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Página siguiente' })).not.toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it('total en singular ("1 resultado") vs. plural ("0 resultados")', () => {
    const { rerender } = render(<Paginador pagina={1} totalPaginas={1} total={1} onCambiarPagina={vi.fn()} />);
    expect(screen.getByText('1 resultado')).toBeInTheDocument();

    rerender(<Paginador pagina={1} totalPaginas={1} total={0} onCambiarPagina={vi.fn()} />);
    expect(screen.getByText('0 resultados')).toBeInTheDocument();
  });

  it('a11y: los controles son alcanzables por teclado (Tab) y accionables con Enter', async () => {
    const user = userEvent.setup();
    const onCambiarPagina = vi.fn();
    render(<Paginador pagina={3} totalPaginas={7} total={134} onCambiarPagina={onCambiarPagina} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onCambiarPagina).toHaveBeenCalledWith(2);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toHaveFocus();
  });

  it('a11y: el estado deshabilitado se comunica por el atributo disabled, no solo por color', () => {
    render(<Paginador pagina={1} totalPaginas={5} total={100} onCambiarPagina={vi.fn()} />);

    // `disabled` nativo es lo que un lector de pantalla anuncia y lo que impide el foco/click —
    // no dependemos de ninguna clase de color para transmitir el estado.
    expect(screen.getByRole('button', { name: 'Página anterior' })).toHaveAttribute('disabled');
  });
});
