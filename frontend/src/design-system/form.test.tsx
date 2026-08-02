import { useState, type ChangeEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Label, Input, Select, Textarea, FieldError, Field } from './form';

function classSet(className: string): string[] {
  return className.split(' ').filter(Boolean).sort();
}

describe('Label', () => {
  it('asocia el label al control mediante htmlFor/id (getByLabelText lo encuentra)', () => {
    render(
      <>
        <Label htmlFor="nombre">Nombre</Label>
        <input id="nombre" />
      </>,
    );

    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
  });
});

describe('Input', () => {
  it('con density="comfortable" (default) reproduce fieldClasses actual', async () => {
    const handleChange = vi.fn();
    render(<Input aria-label="campo" value="" onChange={handleChange} />);

    const input = screen.getByLabelText('campo');
    expect(classSet(input.className)).toEqual(
      classSet('w-full rounded-sm border border-border-strong bg-surface px-md py-2 font-body text-[13px] text-text'),
    );
  });

  it('con density="compact" reproduce las clases de PlantillaCampoRow', () => {
    render(<Input aria-label="campo" density="compact" value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText('campo');
    expect(classSet(input.className)).toEqual(
      classSet('w-full rounded-sm border border-border-strong bg-surface px-sm py-1.5 font-body text-[13px] text-text'),
    );
  });

  it('con density="tight" reproduce las clases de FacturaCobrosSection', () => {
    render(<Input aria-label="campo" density="tight" value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText('campo');
    expect(classSet(input.className)).toEqual(
      classSet('w-full rounded-sm border border-border-strong bg-surface px-sm py-1 font-body text-xs text-text'),
    );
  });

  it('con tone="muted" no lleva font-body ni tamaño (NuevoRecorridoForm/RecorridoVehiculoConductor)', () => {
    render(<Input aria-label="campo" tone="muted" value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText('campo');
    expect(classSet(input.className)).toEqual(
      classSet('w-full rounded-sm border border-border-strong bg-surface px-md py-2 text-muted'),
    );
  });

  it('con placeholderTone="faint" agrega placeholder:text-faint (DireccionesEditor/PersonasACargoEditor)', () => {
    render(<Input aria-label="campo" placeholderTone="faint" value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText('campo');
    expect(classSet(input.className)).toEqual(
      classSet(
        'w-full rounded-sm border border-border-strong bg-surface px-md py-2 font-body text-[13px] text-text placeholder:text-faint',
      ),
    );
  });

  it('con fullWidth={false} no agrega w-full', () => {
    render(<Input aria-label="campo" fullWidth={false} value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText('campo');
    expect(classSet(input.className)).toEqual(
      classSet('rounded-sm border border-border-strong bg-surface px-md py-2 font-body text-[13px] text-text'),
    );
  });

  it('con invalid agrega border-danger, aria-invalid y aria-describedby; sin invalid no agrega ninguno', () => {
    const { rerender } = render(<Input aria-label="campo" id="nombre" invalid value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText('campo');
    expect(classSet(input.className)).toContain('border-danger');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'nombre-error');

    rerender(<Input aria-label="campo" id="nombre" value="" onChange={vi.fn()} />);
    expect(classSet(input.className)).not.toContain('border-danger');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('reenvía props nativas (value/onChange/placeholder) y permite escribir', async () => {
    const user = userEvent.setup();
    function Wrapper() {
      const [value, setValue] = useState('');
      return <Input aria-label="campo" value={value} onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value)} placeholder="Ej. OSDE" />;
    }
    render(<Wrapper />);
    const input = screen.getByLabelText('campo') as HTMLInputElement;
    expect(input.placeholder).toBe('Ej. OSDE');
    await user.type(input, 'Swiss');
    expect(input).toHaveValue('Swiss');
  });
});

describe('Select', () => {
  it('mismos ejes de densidad/tone que Input y reenvía children (options)', () => {
    render(
      <Select aria-label="comprobante" value="A" onChange={vi.fn()}>
        <option value="A">A</option>
        <option value="B">B</option>
      </Select>,
    );
    const select = screen.getByLabelText('comprobante') as HTMLSelectElement;
    expect(classSet(select.className)).toEqual(
      classSet(
        'w-full rounded-sm border border-border-strong bg-surface appearance-none pl-md pr-xl py-2 font-body text-[13px] text-text',
      ),
    );
    expect(select).toHaveValue('A');
  });

  it('con tone="muted" reproduce el select de NuevoRecorridoForm', () => {
    render(
      <Select aria-label="vehiculo" tone="muted" value="" onChange={vi.fn()}>
        <option value="">Elegir…</option>
      </Select>,
    );
    expect(classSet(screen.getByLabelText('vehiculo').className)).toEqual(
      classSet('w-full rounded-sm border border-border-strong bg-surface appearance-none pl-md pr-xl py-2 text-muted'),
    );
  });
});

describe('Textarea', () => {
  it('mismos ejes de densidad/tone que Input', () => {
    render(<Textarea aria-label="observaciones" density="comfortable" value="" onChange={vi.fn()} />);
    const textarea = screen.getByLabelText('observaciones');
    expect(classSet(textarea.className)).toEqual(
      classSet('w-full rounded-sm border border-border-strong bg-surface px-md py-2 font-body text-[13px] text-text'),
    );
  });
});

describe('FieldError', () => {
  it('renderiza un span con el id dado y el texto del error', () => {
    render(<FieldError id="nombre-error">El nombre es obligatorio</FieldError>);
    const error = screen.getByText('El nombre es obligatorio');
    expect(error.tagName).toBe('SPAN');
    expect(error).toHaveAttribute('id', 'nombre-error');
    expect(classSet(error.className)).toEqual(classSet('font-body text-xs text-danger'));
  });

  it('no renderiza ningún nodo si no hay contenido', () => {
    const { container } = render(<FieldError id="nombre-error">{''}</FieldError>);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Field', () => {
  it('sin error: div.flex.flex-col.gap-xs + Label + children, getByLabelText encuentra el hijo', () => {
    const { container } = render(
      <Field label="Nombre" htmlFor="nombre">
        <input id="nombre" />
      </Field>,
    );
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
    expect(classSet((container.firstChild as HTMLElement).className)).toEqual(classSet('flex flex-col gap-xs'));
    expect(screen.queryByText(/./, { selector: 'span' })).not.toBeInTheDocument();
  });

  it('con error: agrega FieldError con id {htmlFor}-error', () => {
    render(
      <Field label="Nombre" htmlFor="nombre" error="El nombre es obligatorio">
        <input id="nombre" />
      </Field>,
    );
    const error = screen.getByText('El nombre es obligatorio');
    expect(error).toHaveAttribute('id', 'nombre-error');
  });

  it('con hint: texto auxiliar con id propio, convive con el error sin pisarlo', () => {
    render(
      <Field label="Identificador" htmlFor="identificador" hint="Ayuda auxiliar" error="Requerido">
        <input id="identificador" />
      </Field>,
    );
    expect(screen.getByText('Ayuda auxiliar')).toHaveAttribute('id', 'identificador-hint');
    expect(screen.getByText('Requerido')).toHaveAttribute('id', 'identificador-error');
  });
});
