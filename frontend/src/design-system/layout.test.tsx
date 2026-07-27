import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card, CardForm, Panel } from './layout';

function classSet(className: string): string[] {
  return className.split(' ').filter(Boolean).sort();
}

describe('Card', () => {
  it('defaults (radius="sm", padding="lg", gap="md", sin elevated/interactive) reproducen PresupuestoResumen.tsx:24', () => {
    render(<Card>contenido</Card>);
    const card = screen.getByText('contenido');
    expect(classSet(card.className)).toEqual(
      classSet('flex flex-col border border-border bg-surface rounded-sm p-lg gap-md'),
    );
  });

  it('radius="md" + elevated + interactive reproducen las 4 tarjetas clickeables de listado (PacientesList.tsx:98)', () => {
    render(
      <Card radius="md" elevated interactive onClick={vi.fn()}>
        contenido
      </Card>,
    );
    const card = screen.getByText('contenido');
    expect(classSet(card.className)).toEqual(
      classSet(
        'flex flex-col border border-border bg-surface rounded-md p-lg gap-md shadow-sm cursor-pointer transition-colors hover:border-border-strong hover:bg-surface-soft',
      ),
    );
  });

  it.each(['sm', 'md', 'lg', 'xl'] as const)('gap="%s" agrega gap-%s', (gap) => {
    render(
      <Card gap={gap}>
        <span data-testid="contenido-card">contenido</span>
      </Card>,
    );
    const card = screen.getByTestId('contenido-card').parentElement as HTMLElement;
    expect(card.className).toContain(`gap-${gap}`);
  });

  it('background="surface-soft" reproduce el panel "Vista previa" de ChecklistEditor/PlantillaFacturaEditor', () => {
    render(
      <Card background="surface-soft" gap="md">
        contenido
      </Card>,
    );
    const card = screen.getByText('contenido');
    expect(classSet(card.className)).toEqual(
      classSet('flex flex-col border border-border bg-surface-soft rounded-sm p-lg gap-md'),
    );
  });

  it('dispara onClick cuando interactive', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Card interactive onClick={onClick}>
        clickeable
      </Card>,
    );
    await user.click(screen.getByText('clickeable'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('CardForm', () => {
  it('mismo contenedor sobre <form onSubmit>, reproduce ObraSocialForm.tsx:68 (gap="xl")', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <CardForm onSubmit={onSubmit} gap="xl">
        <button type="submit">Guardar</button>
      </CardForm>,
    );
    const form = screen.getByRole('button', { name: 'Guardar' }).closest('form') as HTMLFormElement;
    expect(classSet(form.className)).toEqual(
      classSet('flex flex-col border border-border bg-surface rounded-sm p-lg gap-xl'),
    );
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('Panel', () => {
  it('reproduce ResumenAnualPanel.tsx:24-28: section aria-labelledby + h2, getByRole("region") por nombre', () => {
    render(
      <Panel title="Resumen anual" titleId="resumen-anual-heading">
        contenido
      </Panel>,
    );
    const region = screen.getByRole('region', { name: 'Resumen anual' });
    expect(classSet(region.className)).toEqual(
      classSet('flex flex-col border border-border bg-surface rounded-sm p-lg gap-md shadow-sm'),
    );
    const heading = screen.getByText('Resumen anual');
    expect(heading.tagName).toBe('H2');
    expect(heading).toHaveAttribute('id', 'resumen-anual-heading');
    expect(classSet(heading.className)).toEqual(classSet('m-0 font-heading text-[18px] font-bold text-ink'));
  });

  it('renderiza el slot action a la derecha del título', () => {
    render(
      <Panel title="Resumen anual" titleId="heading-1" action={<button type="button">Exportar</button>}>
        contenido
      </Panel>,
    );
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
  });

  it('elevated default true agrega shadow-sm', () => {
    render(
      <Panel title="t" titleId="h">
        c
      </Panel>,
    );
    expect(screen.getByRole('region').className).toContain('shadow-sm');
  });
});
