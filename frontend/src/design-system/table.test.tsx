import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table, Tr, Th, Td } from './table';

function classSet(className: string): string[] {
  return className.split(' ').filter(Boolean).sort();
}

describe('Table', () => {
  it('reproduce el markup de ResumenAnualPanel: div.overflow-x-auto > table > caption sr-only', () => {
    const { container } = render(
      <Table caption="Desglose mensual del año 2026" minWidth="md">
        <thead>
          <tr>
            <Th scope="col">Mes</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <Td>Ene</Td>
          </tr>
        </tbody>
      </Table>,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(classSet(wrapper.className)).toEqual(classSet('overflow-x-auto'));

    const table = screen.getByRole('table', { name: 'Desglose mensual del año 2026' });
    expect(classSet(table.className)).toEqual(classSet('w-full min-w-105 border-collapse font-body text-[13px] text-text'));

    const caption = screen.getByText('Desglose mensual del año 2026');
    expect(caption.tagName).toBe('CAPTION');
    expect(classSet(caption.className)).toEqual(classSet('sr-only'));
  });

  it('minWidth="none" (default) no agrega min-w-*; minWidth="lg" agrega min-w-150', () => {
    const { rerender } = render(
      <Table caption="cap">
        <tbody>
          <tr>
            <Td>x</Td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(screen.getByRole('table').className).not.toContain('min-w-');

    rerender(
      <Table caption="cap" minWidth="lg">
        <tbody>
          <tr>
            <Td>x</Td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(screen.getByRole('table').className).toContain('min-w-150');
  });

  it('minWidth="xl" agrega min-w-120 (FacturadoVsCobradoPanel)', () => {
    render(
      <Table caption="cap" minWidth="xl">
        <tbody>
          <tr>
            <Td>x</Td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(classSet(screen.getByRole('table').className)).toEqual(
      classSet('w-full min-w-120 border-collapse font-body text-[13px] text-text'),
    );
  });

  it('scrollable={false} no envuelve en div.overflow-x-auto', () => {
    const { container } = render(
      <Table caption="cap" scrollable={false}>
        <tbody>
          <tr>
            <Td>x</Td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(container.querySelector('.overflow-x-auto')).not.toBeInTheDocument();
    expect(container.firstChild).toBe(screen.getByRole('table'));
  });

  it('thead/tbody nativos del caller pasan sin envolverse', () => {
    render(
      <Table caption="cap">
        <thead data-testid="thead-nativo">
          <tr>
            <Th scope="col">Mes</Th>
          </tr>
        </thead>
        <tbody data-testid="tbody-nativo">
          <tr>
            <Td>Ene</Td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(screen.getByTestId('thead-nativo').tagName).toBe('THEAD');
    expect(screen.getByTestId('tbody-nativo').tagName).toBe('TBODY');
  });
});

describe('Th / Td', () => {
  it('Th: scope llega al DOM, align y numeric por lookup', () => {
    render(
      <table>
        <thead>
          <tr>
            <Th scope="col" align="left">
              Mes
            </Th>
            <Th scope="col" align="right" numeric>
              Facturado
            </Th>
            <Th scope="row">Ene</Th>
          </tr>
        </thead>
      </table>,
    );
    const mes = screen.getByText('Mes');
    expect(mes).toHaveAttribute('scope', 'col');
    expect(classSet(mes.className)).toEqual(classSet('px-sm py-xs text-left'));

    const facturado = screen.getByText('Facturado');
    expect(classSet(facturado.className)).toEqual(classSet('px-sm py-xs text-right tabular-nums'));

    const ene = screen.getByText('Ene');
    expect(ene).toHaveAttribute('scope', 'row');
  });

  it('Th: weight="medium" agrega font-medium; sin weight (default "normal") no lo agrega', () => {
    render(
      <table>
        <thead>
          <tr>
            <Th scope="row" align="left" weight="medium">
              Ene
            </Th>
            <Th scope="col">Mes</Th>
          </tr>
        </thead>
      </table>,
    );
    expect(classSet(screen.getByText('Ene').className)).toEqual(classSet('px-sm py-xs text-left font-medium'));
    expect(classSet(screen.getByText('Mes').className)).toEqual(classSet('px-sm py-xs'));
  });

  it('Td: align y numeric por lookup', () => {
    render(
      <table>
        <tbody>
          <tr>
            <Td align="right" numeric>
              $100
            </Td>
            <Td>texto</Td>
          </tr>
        </tbody>
      </table>,
    );
    expect(classSet(screen.getByText('$100').className)).toEqual(classSet('px-sm py-xs text-right tabular-nums'));
    expect(classSet(screen.getByText('texto').className)).toEqual(classSet('px-sm py-xs'));
  });
});

describe('Tr', () => {
  it('divided agrega border-t border-border; sin divided no agrega nada (fila de thead vs tbody)', () => {
    render(
      <table>
        <thead>
          <Tr>
            <Th scope="col">Mes</Th>
          </Tr>
        </thead>
        <tbody>
          <Tr divided>
            <Td>Ene</Td>
          </Tr>
        </tbody>
      </table>,
    );
    const theadRow = screen.getByText('Mes').closest('tr') as HTMLElement;
    const tbodyRow = screen.getByText('Ene').closest('tr') as HTMLElement;
    expect(theadRow.className).toBe('');
    expect(classSet(tbodyRow.className)).toEqual(classSet('border-t border-border'));
  });

  it('emphasis="total" agrega border-t-2 border-border-strong font-semibold (tfoot de FacturadoVsCobradoPanel)', () => {
    render(
      <table>
        <tfoot>
          <Tr emphasis="total">
            <Th scope="row" align="left">Total del rango</Th>
          </Tr>
        </tfoot>
      </table>,
    );
    const tfootRow = screen.getByText('Total del rango').closest('tr') as HTMLElement;
    expect(classSet(tfootRow.className)).toEqual(classSet('border-t-2 border-border-strong font-semibold'));
  });

  // cuentas-gestion (tasks.md 7.2): "fila 100% clickeable, como el resto de la app" — mismo
  // criterio de click-por-conveniencia-de-mouse que Card interactive (design-system/layout.tsx),
  // sin asumir el rol semántico de "button" en un <tr> (la accesibilidad por teclado la resuelve
  // un control real dentro de la fila, ver CuentasList.tsx).
  it('interactive agrega cursor-pointer/hover y dispara onClick al hacer click en la fila', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <table>
        <tbody>
          <Tr interactive onClick={onClick}>
            <Td>Fila clickeable</Td>
          </Tr>
        </tbody>
      </table>,
    );

    const row = screen.getByText('Fila clickeable').closest('tr') as HTMLElement;
    expect(classSet(row.className)).toEqual(classSet('cursor-pointer transition-colors hover:bg-surface-soft'));

    await user.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('sin interactive, onClick no se cablea aunque se pase (triangulación)', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <table>
        <tbody>
          <Tr onClick={onClick}>
            <Td>Fila no clickeable</Td>
          </Tr>
        </tbody>
      </table>,
    );

    await user.click(screen.getByText('Fila no clickeable'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
