import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert, Pill, EmptyState } from './feedback';

function classSet(className: string): string[] {
  return className.split(' ').filter(Boolean).sort();
}

describe('Alert', () => {
  it('emphasis="flat" + size="md" (defaults) + tone="danger": reproduce la caja de error actual y role="alert"', () => {
    render(<Alert tone="danger">Ocurrió un error</Alert>);
    const alert = screen.getByRole('alert');
    expect(classSet(alert.className)).toEqual(
      classSet('rounded-sm border border-danger-soft bg-danger-soft px-md py-sm font-body text-[13px] text-danger'),
    );
    expect(alert).toHaveTextContent('Ocurrió un error');
  });

  it('size="sm" produce text-[12px] (AsignacionPanel/VistaGlobalHojaDeRuta)', () => {
    render(
      <Alert tone="danger" size="sm">
        Error chico
      </Alert>,
    );
    expect(classSet(screen.getByRole('alert').className)).toEqual(
      classSet('rounded-sm border border-danger-soft bg-danger-soft px-md py-sm font-body text-[12px] text-danger'),
    );
  });

  it('emphasis="accent" reproduce el molde de AvisoModeloDatos/AvisoPendienteCliente', () => {
    render(
      <Alert tone="warning" emphasis="accent" role="note">
        Discrepancia con el docx
      </Alert>,
    );
    const note = screen.getByRole('note');
    expect(classSet(note.className)).toEqual(
      classSet('rounded-sm border border-warning border-l-4 border-l-warning bg-warning-soft px-md py-sm font-body text-[12px] text-warning'),
    );
  });

  it.each(['success', 'warning', 'danger', 'info', 'secondary'] as const)(
    'tone=%s resuelve por lookup contra chipColors (border-soft de flat, bg y color de texto)',
    (tone) => {
      render(<Alert tone={tone}>mensaje</Alert>);
      const el = screen.getByText('mensaje');
      const classes = el.className;
      expect(classes).toContain('bg-');
      expect(classes).toContain('text-');
    },
  );

  it('title se antepone en negrita', () => {
    render(
      <Alert tone="info" title="Aviso:">
        contenido
      </Alert>,
    );
    expect(screen.getByText('Aviso:').tagName).toBe('SPAN');
    expect(screen.getByText('Aviso:').className).toContain('font-semibold');
  });

  it('icon se renderiza en un slot a la izquierda', () => {
    render(
      <Alert tone="info" icon={<span data-testid="icono">i</span>}>
        contenido
      </Alert>,
    );
    expect(screen.getByTestId('icono')).toBeInTheDocument();
  });

  it('role explícito le gana al default derivado del tono', () => {
    render(
      <Alert tone="danger" role="status">
        contenido
      </Alert>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el default de role es "alert" si tone==="danger", si no "note"', () => {
    render(<Alert tone="success">ok</Alert>);
    expect(screen.getByRole('note')).toBeInTheDocument();
  });

  it('no trae margen externo propio (nada de mb-md)', () => {
    render(<Alert tone="danger">contenido</Alert>);
    expect(screen.getByRole('alert').className).not.toContain('mb-md');
  });
});

describe('Pill', () => {
  it('emphasis="normal" (default) reproduce ObrasSocialesList.tsx:125', () => {
    render(<Pill>CUD Vigente</Pill>);
    expect(classSet(screen.getByText('CUD Vigente').className)).toEqual(
      classSet('rounded-pill bg-surface-soft px-md py-xs font-body text-[11px] text-muted'),
    );
  });

  it('emphasis="strong" agrega font-semibold (el "+N más" de ObrasSocialesList.tsx:131)', () => {
    render(<Pill emphasis="strong">+2 más</Pill>);
    expect(classSet(screen.getByText('+2 más').className)).toEqual(
      classSet('rounded-pill bg-surface-soft px-md py-xs font-body text-[11px] text-muted font-semibold'),
    );
  });
});

describe('EmptyState', () => {
  it('reproduce ObrasSocialesList.tsx:57-62 con el slot action', () => {
    render(<EmptyState message="No hay obras sociales cargadas todavía." action={<button type="button">Crear la primera obra social</button>} />);
    const message = screen.getByText('No hay obras sociales cargadas todavía.');
    expect(message.tagName).toBe('P');
    expect(classSet(message.className)).toEqual(classSet('m-0 font-body text-sm text-muted'));
    expect(classSet((message.parentElement as HTMLElement).className)).toEqual(
      classSet('flex flex-col items-start gap-md rounded-sm border border-border bg-surface-soft p-xl'),
    );
    expect(screen.getByRole('button', { name: 'Crear la primera obra social' })).toBeInTheDocument();
  });

  it('sin action no renderiza ningún nodo extra', () => {
    render(<EmptyState message="Vacío" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
